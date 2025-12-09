// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fetch = require('node-fetch'); // GOOGLE API için gerekli

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- DB BAĞLANTISI ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.use(cors());
app.use(express.json());

// ---------- SSE (REAL-TIME) ALT YAPISI ----------
const sseClients = new Set();

function pushEvent(eventName, payload) {
  const data = JSON.stringify(payload || {});

  for (const res of sseClients) {
    try {
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${data}\n\n`);
    } catch (err) {
      console.error('Error pushing SSE event:', err.message);
    }
  }
}

app.get('/api/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  if (res.flushHeaders) res.flushHeaders();

  res.write('event: connected\n');
  res.write('data: {}\n\n');

  sseClients.add(res);
  console.log('SSE client connected. Total:', sseClients.size);

  req.on('close', () => {
    sseClients.delete(res);
    console.log('SSE client disconnected. Total:', sseClients.size);
  });
});

// ---------- NOTIFICATION OLUŞTURMA ----------
function buildNotificationsForStatus(booking, newStatus) {
  const pickup = booking.pickup_address;
  const dropoff = booking.dropoff_address;
  const when = booking.pickup_datetime;

  const baseInfo =
    `Pickup: ${pickup}\n` +
    `Drop-off: ${dropoff}\n` +
    `Pickup time: ${when}\n`;

  const notifications = [];

  switch (newStatus) {
    case 'confirmed':
      notifications.push({
        to: 'customer',
        title: 'Your JK2424 trip is confirmed',
        body:
          `Dear ${booking.passenger_name}, your ride is confirmed.\n` +
          baseInfo +
          `Please complete your payment to finalize your booking.`
      });
      notifications.push({
        to: 'driver',
        title: 'New confirmed booking',
        body: `New confirmed trip assigned.\n` + baseInfo
      });
      break;

    case 'paid':
      notifications.push({
        to: 'customer',
        title: 'Payment received',
        body:
          `Thank you. Your payment has been received.\n` +
          `Your driver will be assigned and you will be notified when they are on the way.`
      });
      notifications.push({
        to: 'driver',
        title: 'New paid trip',
        body: `Trip is fully paid.\n` + baseInfo
      });
      break;

    case 'on_the_way':
      notifications.push({
        to: 'customer',
        title: 'Your driver is on the way',
        body:
          `Your driver is on the way to pickup.\n` +
          baseInfo +
          `We will share live ETA information shortly.`
      });
      notifications.push({
        to: 'driver',
        title: 'Navigate to pickup',
        body: `Drive to pickup location.\n` + baseInfo
      });
      break;

    case 'arrived':
      notifications.push({
        to: 'customer',
        title: 'Your car has arrived',
        body:
          `Your JK2424 car has arrived and is waiting for you.\n` +
          baseInfo
      });
      notifications.push({
        to: 'driver',
        title: 'Waiting for passenger',
        body:
          `You have arrived at pickup location.\n` +
          baseInfo
      });
      break;

    case 'in_progress':
      notifications.push({
        to: 'customer',
        title: 'Your trip is in progress',
        body:
          `Your ride has started. Enjoy your trip.\n` + baseInfo
      });
      break;

    case 'completed':
      notifications.push({
        to: 'customer',
        title: 'Trip completed',
        body:
          `Thank you for riding with JK2424.\n` +
          `We would appreciate your feedback and an optional tip.`
      });
      break;
  }

  return notifications;
}

function logAndBroadcastNotifications(booking, newStatus) {
  const notifications = buildNotificationsForStatus(booking, newStatus);

  notifications.forEach((n) => {
    console.log("NOTIFICATION ->", n);

    pushEvent("notification", {
      to: n.to,
      bookingId: booking.id,
      title: n.title,
      body: n.body,
      status: newStatus
    });
  });
}

// ---------- HEALTH CHECK ----------
app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'JK2424 backend running.' });
});

// ---------- TÜM REZERVASYONLAR ----------
app.get('/api/bookings', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM bookings ORDER BY created_at DESC'
    );
    res.json({ ok: true, bookings: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'DB error loading bookings' });
  }
});

// ---------- YENİ REZERVASYON ----------
app.post('/api/bookings', async (req, res) => {
  try {
    const {
      passenger_name,
      pickup_address,
      dropoff_address,
      pickup_datetime,
      passengers,
      vehicle_type,
      estimated_price,
      notes
    } = req.body;

    const insertQuery = `
      INSERT INTO bookings
      (passenger_name, pickup_address, dropoff_address,
       pickup_datetime, passengers, vehicle_type,
       estimated_price, notes, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending')
      RETURNING *;
    `;

    const values = [
      passenger_name,
      pickup_address,
      dropoff_address,
      pickup_datetime,
      passengers || 1,
      vehicle_type || 'Mercedes EQS',
      estimated_price || null,
      notes || null
    ];

    const { rows } = await pool.query(insertQuery, values);
    const booking = rows[0];

    pushEvent('booking_created', booking);

    res.json({ ok: true, booking });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'DB error creating booking' });
  }
});

// ---------- STATUS GÜNCELLE ----------
app.post('/api/bookings/:id/status', async (req, res) => {
  const bookingId = req.params.id;
  const { status } = req.body;

  try {
    const { rows } = await pool.query(
      'UPDATE bookings SET status = $2 WHERE id = $1 RETURNING *',
      [bookingId, status]
    );

    if (!rows.length) {
      return res.status(404).json({ ok: false, error: 'Booking not found' });
    }

    const booking = rows[0];

    pushEvent('status_updated', {
      id: booking.id,
      status: booking.status
    });

    logAndBroadcastNotifications(booking, booking.status);

    res.json({ ok: true, booking });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'DB error updating status' });
  }
});

// ---------- GOOGLE API İLE FİYAT HESABI ----------
app.get('/api/calc-price', async (req, res) => {
  try {
    const { pickup, stop, dropoff } = req.query;

    if (!pickup || !dropoff) {
      return res.status(400).json({
        ok: false,
        error: 'pickup and dropoff are required'
      });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    let miles = 0;

    if (apiKey) {
      let url =
        'https://maps.googleapis.com/maps/api/directions/json?origin=' +
        encodeURIComponent(pickup) +
        '&destination=' +
        encodeURIComponent(dropoff);

      if (stop) {
        url += '&waypoints=' + encodeURIComponent(stop);
      }

      url += '&key=' + apiKey;

      const response = await fetch(url);
      const data = await response.json();

      if (data.routes?.[0]?.legs?.length) {
        let totalMeters = 0;
        for (const leg of data.routes[0].legs) {
          totalMeters += leg.distance.value;
        }
        miles = totalMeters / 1609.34;
      } else {
        miles = 20;
      }
    } else {
      miles = 20;
    }

    if (miles <= 0) miles = 20;

    const baseFare = 65;
    const includedMiles = 15;
    const extraPerMile = 2;
    const nightMultiplier = 1.25;

    res.json({
      ok: true,
      miles,
      pricing: { baseFare, includedMiles, extraPerMile, nightMultiplier }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Error calculating price' });
  }
});

// ---------- SUNUCUYU BAŞLAT ----------
app.listen(PORT, () => {
  console.log(`JK2424 backend running on port ${PORT}`);
});
