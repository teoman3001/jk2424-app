const fetch = require('node-fetch');
require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// JSON & static
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ---------------------- PRICING FILE HELPERS ----------------------
const PRICING_FILE = path.join(__dirname, "pricing.json");

// Default values (fallback)
const defaultPricing = {
  baseFare: 65,
  includedMiles: 15,
  extraPerMile: 2,
  minFare: 65
};

// Load pricing.json safely
function loadPricing() {
  try {
    if (!fs.existsSync(PRICING_FILE)) {
      fs.writeFileSync(PRICING_FILE, JSON.stringify(defaultPricing, null, 2));
      return defaultPricing;
    }
    const raw = fs.readFileSync(PRICING_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("pricing.json okunamadı:", err);
    return defaultPricing;
  }
}

// Save pricing.json safely
function savePricing(p) {
  try {
    fs.writeFileSync(PRICING_FILE, JSON.stringify(p, null, 2));
    return true;
  } catch (err) {
    console.error("pricing.json yazılamadı:", err);
    return false;
  }
}

// ---------------------- GOOGLE DISTANCE + PRICING ----------------------
app.get('/api/calc-price', async (req, res) => {
  try {
    const { pickup, stop, dropoff } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!pickup || !dropoff) {
      return res.status(400).json({ error: 'Pickup and dropoff required' });
    }

    let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
      pickup
    )}&destination=${encodeURIComponent(dropoff)}&key=${apiKey}`;

    if (stop && stop.trim() !== '') {
      url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
        pickup
      )}&destination=${encodeURIComponent(dropoff)}&waypoints=${encodeURIComponent(stop)}&key=${apiKey}`;
    }

    const r = await fetch(url);
    const data = await r.json();

    if (data.status !== 'OK') {
      return res.status(500).json({ error: 'Google API Error', details: data });
    }

    const meters = data.routes[0].legs.reduce((sum, leg) => sum + leg.distance.value, 0);
    const miles = meters / 1609.34;

    // Load dynamic pricing
    const pricing = loadPricing();

    let price = pricing.baseFare;
    const extraMiles = Math.max(0, miles - pricing.includedMiles);
    if (extraMiles > 0) price += extraMiles * pricing.extraPerMile;

    if (price < pricing.minFare) price = pricing.minFare;

    res.json({
      miles: Number(miles.toFixed(2)),
      pricing,
      dayPrice: Number(price.toFixed(2)),
      extraMiles: Number(extraMiles.toFixed(2))
    });
  } catch (err) {
    console.error("calc-price hata:", err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------------------- PRICING ADMIN ENDPOINT ----------------------
app.get("/api/admin/pricing", (req, res) => {
  const data = loadPricing();
  res.json({ ok: true, pricing: data });
});

app.post("/api/admin/pricing", (req, res) => {
  const { baseFare, includedMiles, extraPerMile, minFare } = req.body;

  const updated = {
    baseFare: Number(baseFare),
    includedMiles: Number(includedMiles),
    extraPerMile: Number(extraPerMile),
    minFare: Number(minFare)
  };

  if (!savePricing(updated)) {
    return res.status(500).json({ ok: false, message: "pricing.json yazılamadı" });
  }

  res.json({ ok: true, pricing: updated });
});

// ---------------------- BOOKINGS TABLE ----------------------
async function ensureBookingsTable() {
  const createSql = `
    CREATE TABLE IF NOT EXISTS bookings (
      id BIGSERIAL PRIMARY KEY,
      pickup TEXT NOT NULL,
      stop TEXT,
      dropoff TEXT NOT NULL,
      ride_date DATE NOT NULL,
      ride_time VARCHAR(10) NOT NULL,
      ampm VARCHAR(2) NOT NULL,
      miles NUMERIC(10,2),
      total NUMERIC(10,2),
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      notes TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;
  await pool.query(createSql);
  console.log("✓ bookings tablosu hazır");
}

ensureBookingsTable().catch(console.error);

// ---------------------- CREATE BOOKING ----------------------
app.post('/api/bookings2', async (req, res) => {
  try {
    const {
      pickup, stop, dropoff,
      rideDate, rideTime, ampm,
      miles, total,
      customerName, customerPhone, customerEmail, notes
    } = req.body;

    if (!pickup || !dropoff || !rideDate || !rideTime || !ampm || !customerName || !customerPhone) {
      return res.status(400).json({ ok: false, message: 'Eksik alanlar var.' });
    }

    const sql = `
      INSERT INTO bookings
        (pickup, stop, dropoff, ride_date, ride_time, ampm, miles, total,
         customer_name, customer_phone, customer_email, notes, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')
      RETURNING id;
    `;

    const values = [
      pickup,
      stop || null,
      dropoff,
      rideDate,
      rideTime,
      ampm,
      miles ? Number(miles) : null,
      total ? Number(total) : null,
      customerName,
      customerPhone,
      customerEmail || null,
      notes || null
    ];

    const result = await pool.query(sql, values);

    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    console.error("bookings2 hata:", err);
    res.status(500).json({ ok: false });
  }
});

// ---------------------- ADMIN BOOKINGS ----------------------
app.get('/api/admin/bookings', async (req, res) => {
  try {
    const r = await pool.query("SELECT * FROM bookings ORDER BY created_at DESC");
    res.json({ ok: true, bookings: r.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

app.patch('/api/admin/bookings/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = [
      'pending', 'confirmed', 'paid',
      'on_the_way', 'arrived', 'completed', 'cancelled'
    ];

    if (!allowed.includes(status)) {
      return res.status(400).json({ ok: false, message: 'Geçersiz status.' });
    }

    await pool.query("UPDATE bookings SET status = $1 WHERE id = $2", [status, id]);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

// ---------------------- PAGES ----------------------
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ---------------------- START ----------------------
app.listen(PORT, () => {
  console.log(`JK2424 backend çalışıyor: http://localhost:${PORT}`);
});
