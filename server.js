const fs = require('fs');
const fetch = require('node-fetch');
require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ------------ MIDDLEWARE ------------
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ------------ POSTGRES ------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ------------ PRICING (JSON dosyadan okuma / yazma) ------------
const PRICING_FILE = path.join(__dirname, 'pricing.json');

function getDefaultPricing() {
  return {
    baseFare: 65,        // 65 $
    includedMiles: 15,   // 15 mile kadar dahil
    extraPerMile: 2,     // sonrası mile başı 2 $
    minFare: 65,         // minimum ücret
    nightMultiplier: 1.25 // gece çarpanı (ör. 1.25 = %25 zam)
  };
}

function loadPricing() {
  try {
    const raw = fs.readFileSync(PRICING_FILE, 'utf8');
    const data = JSON.parse(raw);
    const def = getDefaultPricing();

    return {
      baseFare: Number(data.baseFare) || def.baseFare,
      includedMiles: Number(data.includedMiles) || def.includedMiles,
      extraPerMile: Number(data.extraPerMile) || def.extraPerMile,
      minFare: Number(data.minFare) || def.minFare,
      nightMultiplier: Number(data.nightMultiplier) || def.nightMultiplier
    };
  } catch (err) {
    console.warn('⚠ pricing.json okunamadı, varsayılan kullanılıyor', err.message);
    return getDefaultPricing();
  }
}

async function savePricingSettings(settings) {
  const clean = {
    baseFare: Number(settings.baseFare) || 0,
    includedMiles: Number(settings.includedMiles) || 0,
    extraPerMile: Number(settings.extraPerMile) || 0,
    minFare: Number(settings.minFare) || 0,
    nightMultiplier: Number(settings.nightMultiplier) || 1
  };

  fs.writeFileSync(PRICING_FILE, JSON.stringify(clean, null, 2), 'utf8');
}

// ------ ADMIN API: pricing get / save ------
app.get('/api/admin/pricing', (req, res) => {
  try {
    const settings = loadPricing();
    res.json({ ok: true, settings });
  } catch (err) {
    console.error('GET /api/admin/pricing hata:', err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
});

app.post('/api/admin/pricing', async (req, res) => {
  try {
    const { baseFare, includedMiles, extraPerMile, minFare, nightMultiplier } = req.body;

    await savePricingSettings({
      baseFare,
      includedMiles,
      extraPerMile,
      minFare,
      nightMultiplier
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/admin/pricing hata:', err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// ---------- PRICE CALCULATION (Google Directions + dynamic pricing) ----------
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
      )}&destination=${encodeURIComponent(
        dropoff
      )}&waypoints=${encodeURIComponent(stop)}&key=${apiKey}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      return res.status(500).json({ error: 'Google API Error', details: data });
    }

    const meters = data.routes[0].legs.reduce((sum, leg) => sum + leg.distance.value, 0);
    const miles = meters / 1609.34;

    // Dinamik pricing dosyadan
    const pricing = loadPricing();
    const baseFare = pricing.baseFare;
    const baseMiles = pricing.includedMiles;
    const extraPerMile = pricing.extraPerMile;

    let totalPrice = baseFare;
    const extraMiles = Math.max(0, miles - baseMiles);
    if (extraMiles > 0) {
      totalPrice += extraMiles * extraPerMile;
    }

    // Gece çarpanı burada uygulanmıyor; frontend AM/PM + saat bilgisiyle uygular.
    res.json({
      miles: Number(miles.toFixed(2)),
      baseFare,
      baseMiles,
      extraPerMile,
      extraMiles: Number(extraMiles.toFixed(2)),
      price: Number(totalPrice.toFixed(2)),
      nightMultiplier: pricing.nightMultiplier
    });
  } catch (error) {
    console.error('Error calculating price:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- BOOKINGS TABLOSU ----------
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
  return dateStr; // YYYY-MM-DD zaten
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

// Start server
app.listen(PORT, () => {
  console.log(`JK2424 server ayakta: http://localhost:${PORT}`);
});
