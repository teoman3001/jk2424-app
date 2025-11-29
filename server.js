console.log("### JK2424 ACTIVE SERVER FILE LOADED ###");

// server.js
// JK2424 – Backend sunucu

require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- MIDDLEWARE ----------
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- POSTGRES ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// ---------- PRICING JSON (dosyadan okuma / yazma) ----------
const PRICING_FILE = path.join(__dirname, 'pricing.json');

function getDefaultPricing() {
  return {
    baseFare: 65,
    includedMiles: 15,
    extraPerMile: 2,
    minimumFare: 65,
    nightMultiplier: 1.25,
  };
}

function loadPricing() {
  try {
    const raw = fs.readFileSync(PRICING_FILE, 'utf8');
    const data = JSON.parse(raw || '{}');
    const def = getDefaultPricing();

    return {
      baseFare: Number(data.baseFare || def.baseFare),
      includedMiles: Number(data.includedMiles || def.includedMiles),
      extraPerMile: Number(data.extraPerMile || def.extraPerMile),
      minimumFare: Number(data.minimumFare || def.minimumFare),
      nightMultiplier: Number(data.nightMultiplier || def.nightMultiplier),
    };
  } catch (err) {
    console.warn('Pricing file missing/invalid, using defaults:', err.message);
    return getDefaultPricing();
  }
}

async function savePricing(settings) {
  const clean = {
    baseFare: Number(settings.baseFare),
    includedMiles: Number(settings.includedMiles),
    extraPerMile: Number(settings.extraPerMile),
    minimumFare: Number(settings.minimumFare),
    nightMultiplier: Number(settings.nightMultiplier),
  };

  fs.writeFileSync(PRICING_FILE, JSON.stringify(clean, null, 2), 'utf8');
}

// ---------- ROUTES ----------

// Ana sayfa (müşteri tarafı)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Admin paneli (eğer ayrı html kullanıyorsan)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// ---------- ADMIN – PRICING API ----------

// Ayarları getir
app.get('/api/admin/pricing', async (req, res) => {
  try {
    const settings = loadPricing();
    res.json({ ok: true, settings });
  } catch (err) {
    console.error('GET /api/admin/pricing error:', err);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

// Ayarları kaydet
app.post('/api/admin/pricing', async (req, res) => {
  try {
    const {
      baseFare,
      includedMiles,
      extraPerMile,
      minimumFare,
      nightMultiplier,
    } = req.body || {};

    await savePricing({
      baseFare,
      includedMiles,
      extraPerMile,
      minimumFare,
      nightMultiplier,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/admin/pricing error:', err);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

// ---------- PRICE CALCULATION API ----------
// Mesafeyi Google Directions API ile hesaplar, paneldeki pricing ayarlarını döner.
// Frontend (index.html) toplam ücreti kendisi hesaplıyor.

app.get('/api/calc-price', async (req, res) => {
  try {
    const { pickup, stop, dropoff } = req.query;

    if (!pickup || !dropoff) {
      return res.status(400).json({ error: 'Pickup ve drop-off zorunlu.' });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Google Maps API anahtarı eksik.' });
    }

    const origin = encodeURIComponent(pickup);
    const destination = encodeURIComponent(dropoff);

    let url =
      `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}` +
      `&destination=${destination}&key=${apiKey}`;

    if (stop) {
      const waypoint = encodeURIComponent(stop);
      url += `&waypoints=${waypoint}`;
    }

    // Node 18+ için global fetch var; yoksa hata verir.
    const gmRes = await fetch(url);
    const gmData = await gmRes.json();

    if (!gmData.routes || gmData.routes.length === 0) {
      console.error('Directions cevap:', gmData);
      return res.status(500).json({ error: 'Rota bulunamadı.' });
    }

    let meters = 0;
    gmData.routes[0].legs.forEach((leg) => {
      if (leg.distance && leg.distance.value) {
        meters += leg.distance.value;
      }
    });

    const miles = meters / 1609.34;
    const pricing = loadPricing();

    return res.json({
      ok: true,
      miles: Number(miles.toFixed(2)),
      pricing,
    });
  } catch (err) {
    console.error('GET /api/calc-price hata:', err);
    res.status(500).json({ error: 'Mesafe hesaplanırken sunucu hatası.' });
  }
});

// ---------- BOOKINGS API ----------

// Rezervasyon oluşturma (index.html'den gelen /api/bookings2 isteği)
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
      notes,
    } = req.body || {};

    if (!pickup || !dropoff || !rideDate || !rideTime) {
      return res
        .status(400)
        .json({ ok: false, message: 'Trip details eksik.' });
    }

    if (!customerName || !customerPhone || !customerEmail) {
      return res
        .status(400)
        .json({ ok: false, message: 'Name, phone ve email zorunlu.' });
    }

    const client = await pool.connect();
    let newId;

    try {
      const insertQuery = `
        INSERT INTO bookings (
          pickup,
          stop,
          dropoff,
          ride_date,
          ride_time,
          ampm,
          miles,
          total,
          customer_name,
          customer_phone,
          customer_email,
          notes,
          status
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
        )
        RETURNING id;
      `;

      const result = await client.query(insertQuery, [
        pickup,
        stop || null,
        dropoff,
        rideDate,
        rideTime,
        ampm,
        miles,
        total,
        customerName,
        customerPhone,
        customerEmail,
        notes || null,
        'pending',
      ]);

      newId = result.rows[0].id;
    } finally {
      client.release();
    }

    console.log('New booking saved. id =', newId);
    res.json({ ok: true, id: newId, message: 'Rezervasyon isteğin alındı.' });
  } catch (err) {
    console.error('POST /api/bookings2 hatası:', err);
    res.status(500).json({ ok: false, message: 'Sunucu hatası.' });
  }
});

// Admin: tüm rezervasyonları listele
app.get('/api/admin/bookings', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM bookings ORDER BY created_at DESC;'
    );
    res.json({ ok: true, bookings: result.rows });
  } catch (err) {
    console.error('GET /api/admin/bookings hatası:', err);
    res.status(500).json({ ok: false, message: 'Sunucu hatası.' });
  }
});

// Admin: rezervasyon status güncelle
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
      'cancelled',
    ];

    if (!allowed.includes(status)) {
      return res.status(400).json({ ok: false, message: 'Geçersiz status.' });
    }

    await pool.query('UPDATE bookings SET status = $1 WHERE id = $2;', [
      status,
      id,
    ]);

    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/admin/bookings/:id/status hatası:', err);
    res.status(500).json({ ok: false, message: 'Sunucu hatası.' });
  }
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`JK2424 server ayakta: http://localhost:${PORT}`);
});
