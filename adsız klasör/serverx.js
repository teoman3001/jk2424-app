require('dotenv').config();
const fetch = require('node-fetch');
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- PostgreSQL ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ---------- Middleware ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Ensure bookings table exists
async function ensureBookingsTable() {
  const createSql = `
    CREATE TABLE IF NOT EXISTS bookings (
      id BIGSERIAL PRIMARY KEY,
      pickup TEXT NOT NULL,
      stop TEXT,
      dropoff TEXT NOT NULL,
      ride_date VARCHAR(10) NOT NULL,
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
  console.log('✅ bookings table is ready');
}

ensureBookingsTable().catch((err) => {
  console.error('Error ensuring bookings table:', err);
});

// ---------- Helpers ----------
function normalizeDate(dateStr) {
  // expect from HTML: YYYY-MM-DD
  if (!dateStr) return null;
  return dateStr;
}

function isNightRide(timeStr, ampm) {
  if (!timeStr || !ampm) return false;
  const [hStr] = timeStr.split(':');
  const hour = Number(hStr);
  if (Number.isNaN(hour)) return false;
  // 00:00–05:59 AM night
  return ampm.toUpperCase() === 'AM' && hour < 6;
}

// ---------- PRICE CALCULATION API ----------
app.get('/api/calc-price', async (req, res) => {
  try {
    const { pickup, stop, dropoff, date, time, ampm } = req.query;
    let { miles } = req.query;

    if (!pickup || !dropoff) {
      return res.status(400).json({ error: 'Pickup and dropoff are required.' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey && !miles) {
      return res.status(500).json({ error: 'Google Maps API key missing.' });
    }

    let distanceMiles;

    // If miles is provided manually, use it
    if (miles && !Number.isNaN(Number(miles))) {
      distanceMiles = Number(miles);
    } else {
      // Use Google Directions API
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
        console.error('Google API error:', data);
        return res.status(500).json({
          error: 'Google API Error',
          details: data
        });
      }

      const meters = data.routes[0].legs.reduce(
        (sum, leg) => sum + (leg.distance.value || 0),
        0
      );
      distanceMiles = meters / 1609.34;
    }

    // Round miles to 2 decimals
    distanceMiles = Number(distanceMiles.toFixed(2));

    // Pricing rules
    const baseFare = 65; // up to 15 miles
    const extraMileRate = 2; // per mile above 15
    const night = isNightRide(time, ampm);
    const nightMultiplier = night ? 1.25 : 1;

    let extraMiles = 0;
    if (distanceMiles > 15) {
      extraMiles = distanceMiles - 15;
    }

    const rawSubtotal = baseFare + extraMiles * extraMileRate;
    const total = Number((rawSubtotal * nightMultiplier).toFixed(2));

    const baseFareText = `Base fare (up to 15 miles): $${baseFare.toFixed(2)}`;
    const extraMilesText = `${extraMiles.toFixed(2)} × $${extraMileRate.toFixed(
      2
    )} = $${(extraMiles * extraMileRate).toFixed(2)}`;
    const nightFareText = night ? 'Yes (×1.25)' : 'No (×1.00)';

    res.json({
      miles: distanceMiles,
      price: total,
      baseFareText,
      extraMilesText,
      nightFareText,
      nightFare: night
    });
  } catch (err) {
    console.error('Error calculating price:', err);
    res.status(500).json({ error: 'Server error while calculating price.' });
  }
});

// ---------- CUSTOMER: CREATE BOOKING ----------
app.post('/api/bookings2', async (req, res) => {
  try {
    const {
      pickup,
      stop,
      dropoff,
      date,
      time,
      ampm,
      miles,
      total,
      customerName,
      customerPhone,
      customerEmail,
      notes
    } = req.body;

    if (!pickup || !dropoff || !date || !time || !ampm || !customerName || !customerPhone) {
      return res.status(400).json({ ok: false, message: 'Missing required fields.' });
    }

    const rideDate = normalizeDate(date);

    const insertSql = `
      INSERT INTO bookings
        (pickup, stop, dropoff, ride_date, ride_time, ampm, miles, total,
         customer_name, customer_phone, customer_email, notes, status)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')
      RETURNING id;
    `;

    const values = [
      pickup,
      stop || null,
      dropoff,
      rideDate,
      time,
      ampm,
      miles ? Number(miles) : null,
      total ? Number(total) : null,
      customerName,
      customerPhone,
      customerEmail ? customerEmail.toLowerCase() : null,
      notes || null
    ];

    const result = await pool.query(insertSql, values);
    const newId = result.rows[0].id;
    console.log('New booking created with id =', newId);

    res.json({ ok: true, id: newId, message: 'Reservation request received.' });
  } catch (err) {
    console.error('POST /api/bookings2 error:', err);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

// ---------- ADMIN: LIST BOOKINGS ----------
app.get('/api/admin/bookings', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM bookings ORDER BY created_at DESC;'
    );
    res.json({ ok: true, bookings: result.rows });
  } catch (err) {
    console.error('GET /api/admin/bookings error:', err);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

// ---------- ADMIN: UPDATE STATUS ----------
app.patch('/api/admin/bookings/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['pending', 'confirmed', 'on_the_way', 'arrived', 'completed', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ ok: false, message: 'Invalid status.' });
    }

    await pool.query('UPDATE bookings SET status = $1 WHERE id = $2;', [status, id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/bookings/:id/status error:', err);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

// ---------- CUSTOMER: MY BOOKINGS ----------
app.get('/api/my-bookings', async (req, res) => {
  try {
    const email = req.query.email;
    if (!email) {
      return res.status(400).json({ ok: false, message: 'Email is required.' });
    }

    const sql = `
      SELECT
        id,
        pickup,
        stop,
        dropoff,
        ride_date,
        ride_time,
        ampm,
        miles,
        total,
        status,
        created_at
      FROM bookings
      WHERE customer_email = $1
      ORDER BY ride_date DESC, ride_time DESC, created_at DESC
      LIMIT 50;
    `;
    const result = await pool.query(sql, [email.trim().toLowerCase()]);
    res.json({ ok: true, bookings: result.rows });
  } catch (err) {
    console.error('GET /api/my-bookings error:', err);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

// ---------- PAGES ----------
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// (index.html is served statically from /public)

app.listen(PORT, () => {
  console.log(`JK2424 server running at http://localhost:${PORT}`);
});
