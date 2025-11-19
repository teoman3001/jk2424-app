const fetch = require('node-fetch');
require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Static & JSON middlewares
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Postgres connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ---------- PRICE CALCULATION (Google Directions + formula) ----------
app.get('/api/calc-price', async (req, res) => {
  try {
    const { pickup, stop, dropoff } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!pickup || !dropoff) {
      return res.status(400).json({ error: 'Pickup and dropoff are required.' });
    }

    let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
      pickup
    )}&destination=${encodeURIComponent(dropoff)}&key=${apiKey}`;

    if (stop && stop.trim() !== '') {
      url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
        pickup
      )}&destination=${encodeURIComponent(dropoff)}&waypoints=${encodeURIComponent(stop)}&key=${apiKey}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      return res.status(500).json({ error: 'Google API Error', details: data });
    }

    const meters = data.routes[0].legs.reduce((sum, leg) => sum + leg.distance.value, 0);
    const miles = meters / 1609.34;

    // Pricing:
    //  - Base fare 65 USD covers up to 15 miles
    //  - After 15 miles: +2 USD per extra mile
    const baseFare = 65;
    const baseMiles = 15;
    const extraPerMile = 2;

    let totalPrice = baseFare;
    const extraMiles = Math.max(0, miles - baseMiles);
    if (extraMiles > 0) {
      totalPrice += extraMiles * extraPerMile;
    }

    // Night fare (1.25x) is calculated later on the client after AM/PM & time are chosen.
    // Here we just return the "day" price; frontend already has the distance to recompute if needed.
    res.json({
      miles: Number(miles.toFixed(2)),
      baseFare,
      baseMiles,
      extraPerMile,
      extraMiles: Number(extraMiles.toFixed(2)),
      price: Number(totalPrice.toFixed(2))
    });
  } catch (error) {
    console.error('Error calculating price:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- Ensure bookings table ----------
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
  console.log('✓ bookings tablosu hazır.');
}

ensureBookingsTable().catch((err) => {
  console.error('Tablo oluşturulurken hata:', err);
});

// Helper: normalize date string
function normalizeDate(dateStr) {
  if (!dateStr) return null;
  // input is already YYYY-MM-DD from the form
  return dateStr;
}

// ---------- PUBLIC API: create booking from customer form ----------
app.post('/api/bookings2', async (req, res) => {
  try {
    const {
      pickup,
      stop,
      dropoff,
      rideDate,
      rideTime,
      ampm,
      miles,
      total,
      customerName,
      customerPhone,
      customerEmail,
      notes
    } = req.body;

    const ride_date = normalizeDate(rideDate);

    if (!pickup || !dropoff || !ride_date || !rideTime || !ampm || !customerName || !customerPhone) {
      return res.status(400).json({ ok: false, message: 'Eksik alanlar var.' });
    }

    const insertSql = `
      INSERT INTO bookings
        (pickup, stop, dropoff, ride_date, ride_time, ampm, miles, total, customer_name, customer_phone, customer_email, notes, status)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING id;
    `;

    const values = [
      pickup,
      stop || null,
      dropoff,
      ride_date,
      rideTime,
      ampm,
      miles ? Number(miles) : null,
      total ? Number(total) : null,
      customerName,
      customerPhone,
      customerEmail || null,
      notes || null,
      'pending'
    ];

    const result = await pool.query(insertSql, values);
    const newId = result.rows[0].id;

    console.log('✓ new booking saved. id =', newId);
    res.json({ ok: true, id: newId, message: 'Rezervasyon isteğin alındı.' });
  } catch (err) {
    console.error('POST /api/bookings2 hata:', err);
    res.status(500).json({ ok: false, message: 'Sunucu hatası.' });
  }
});

// ---------- ADMIN API: list & update bookings ----------
app.get('/api/admin/bookings', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM bookings ORDER BY created_at DESC;');
    res.json({ ok: true, bookings: result.rows });
  } catch (err) {
    console.error('GET /api/admin/bookings hata:', err);
    res.status(500).json({ ok: false, message: 'Sunucu hatası.' });
  }
});

app.patch('/api/admin/bookings/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = [
      'pending',
      'confirmed',
      'paid',
      'on_the_way',
      'arrived',
      'completed',
      'cancelled'
    ];

    if (!allowed.includes(status)) {
      return res.status(400).json({ ok: false, message: 'Geçersiz status.' });
    }

    await pool.query('UPDATE bookings SET status = $1 WHERE id = $2', [status, id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/bookings/:id/status hata:', err);
    res.status(500).json({ ok: false, message: 'Sunucu hatası.' });
  }
});

// ---------- PAGES ----------
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// The public index is already served statically from /public
// Start server
app.listen(PORT, () => {
  console.log(`JK2424 server ayakta: http://localhost:${PORT}`);
});