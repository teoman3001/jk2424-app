
const fetch = require("node-fetch");
require("dotenv").config();

const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- MIDDLEWARE ----------
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------- POSTGRESQL ----------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function ensureBookingsTable() {
  const createSql = `
    CREATE TABLE IF NOT EXISTS bookings (
      id             BIGSERIAL PRIMARY KEY,
      pickup         TEXT NOT NULL,
      stop           TEXT,
      dropoff        TEXT NOT NULL,
      ride_date      DATE NOT NULL,
      ride_time      VARCHAR(10) NOT NULL,
      ampm           VARCHAR(12) NOT NULL,
      miles          NUMERIC(10,2),
      total          NUMERIC(10,2),
      customer_name  TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      notes          TEXT,
      status         VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at     TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;
  await pool.query(createSql);
  console.log("✅ bookings tablosu hazır.");
}

ensureBookingsTable().catch((err) => {
  console.error("❌ Tablo oluşturulurken hata:", err);
});

// ---------- HELPERS ----------
function normalizeDate(str) {
  if (!str) return null;
  return str; // 'YYYY-MM-DD' formatında geliyor
}

// ---------- GOOGLE ROUTES: MESAFE + FİYAT ----------

app.get("/api/calc-price", async (req, res) => {
  try {
    const { pickup, stop, dropoff } = req.query;
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "Server config error: GOOGLE_MAPS_API_KEY missing" });
    }

    if (!pickup || !dropoff) {
      return res
        .status(400)
        .json({ error: "Pickup and dropoff are required." });
    }

    const body = {
      origin: { address: pickup },
      destination: { address: dropoff },
      travelMode: "DRIVE",
    };

    if (stop && stop.trim() !== "") {
      body.intermediates = [{ address: stop }];
    }

    const response = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.legs.distanceMeters",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("Google Routes HTTP error:", response.status, text);
      return res.status(500).json({
        error: "Google Routes HTTP error",
        status: response.status,
        body: text,
      });
    }

    const data = await response.json();

    if (data.error) {
      console.error("Google Routes API error object:", data.error);
      return res
        .status(500)
        .json({ error: "Google Routes API error", details: data.error });
    }

    if (!data.routes || !data.routes.length) {
      console.error("Google Routes API: no routes", data);
      return res.status(500).json({
        error: "Google Routes API returned no routes",
        details: data,
      });
    }

    const legs = data.routes[0].legs || [];
    const meters = legs.reduce(
      (sum, leg) => sum + (leg.distanceMeters || 0),
      0
    );
    const miles = meters / 1609.34;

    const baseFare = 3;
    const costPerMile = 2;
    const totalPrice = baseFare + miles * costPerMile;

    return res.json({
      miles: Number(miles.toFixed(2)),
      price: Number(totalPrice.toFixed(2)),
    });
  } catch (error) {
    console.error("Error calculating price:", error);
    return res.status(500).json({
      error: "Server error while calculating price",
      details: String(error),
    });
  }
});

// ---------- BOOKING KAYDETME ORTAK HANDLER ----------

async function handleCreateBooking(req, res) {
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
    } = req.body;

    const date = normalizeDate(rideDate);

    if (
      !pickup ||
      !dropoff ||
      !date ||
      !rideTime ||
      !ampm ||
      !customerName ||
      !customerPhone
    ) {
      return res
        .status(400)
        .json({ ok: false, message: "Eksik zorunlu alanlar var." });
    }

    const insertSql = `
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
      date,
      rideTime,
      ampm,
      miles ? Number(miles) : null,
      total ? Number(total) : null,
      customerName,
      customerPhone,
      customerEmail || null,
      notes || null,
    ];

    const result = await pool.query(insertSql, values);
    const newId = result.rows[0].id;

    console.log("✅ Yeni rezervasyon kaydedildi, id =", newId);

    return res.json({
      ok: true,
      id: newId,
      message: "Rezervasyon isteğin alındı.",
    });
  } catch (err) {
    console.error("Booking insert hatası:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Sunucu hatası.", details: String(err) });
  }
}

// Bu handler'i birden fazla endpoint'e bağlayalım; front-end hangisini kullanırsa kullansın çalışsın:
app.post("/api/bookings", handleCreateBooking);
app.post("/api/bookings2", handleCreateBooking);
app.post("/booking2", handleCreateBooking); // eski sürüm uyumluluğu

// ---------- ADMIN API ----------

app.get("/api/admin/bookings", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM bookings ORDER BY created_at DESC;"
    );
    return res.json({ ok: true, bookings: result.rows });
  } catch (err) {
    console.error("GET /api/admin/bookings hatası:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Sunucu hatası.", details: String(err) });
  }
});

app.patch("/api/admin/bookings/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = [
      "pending",
      "confirmed",
      "on_the_way",
      "arrived",
      "completed",
      "cancelled",
    ];

    if (!allowed.includes(status)) {
      return res
        .status(400)
        .json({ ok: false, message: "Geçersiz status." });
    }

    await pool.query("UPDATE bookings SET status = $1 WHERE id = $2;", [
      status,
      id,
    ]);

    return res.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/admin/bookings/:id/status hatası:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Sunucu hatası.", details: String(err) });
  }
});

// ---------- PAGES ----------

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Sunucu
app.listen(PORT, () => {
  console.log(`JK2424 server ayakta: http://localhost:${PORT}`);
});
