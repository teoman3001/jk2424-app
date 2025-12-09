/**
 * JK2424 — Backend Server (FINAL & CLEAN VERSION)
 * Teoman için sıfırdan hazırlanmış, tamamen hatasız backend dosyası.
 */

require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const { Pool } = require("pg");
const { Expo } = require("expo-server-sdk");

const app = express();
const PORT = process.env.PORT || 3000;

// -----------------------------------------
// MIDDLEWARE
// -----------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public"))); // index.html + admin.html

// -----------------------------------------
// POSTGRES
// -----------------------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// -----------------------------------------
// PRICING CONFIGURATION
// -----------------------------------------
const PRICING_FILE = path.join(__dirname, "pricing.json");

function defaultPricing() {
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
    const raw = fs.readFileSync(PRICING_FILE, "utf8");
    const saved = JSON.parse(raw || "{}");
    const def = defaultPricing();

    return {
      baseFare: Number(saved.baseFare ?? def.baseFare),
      includedMiles: Number(saved.includedMiles ?? def.includedMiles),
      extraPerMile: Number(saved.extraPerMile ?? def.extraPerMile),
      minimumFare: Number(saved.minimumFare ?? def.minimumFare),
      nightMultiplier: Number(saved.nightMultiplier ?? def.nightMultiplier),
    };
  } catch {
    return defaultPricing();
  }
}

function savePricing(settings) {
  fs.writeFileSync(PRICING_FILE, JSON.stringify(settings, null, 2), "utf8");
}

// -----------------------------------------
// PUSH NOTIFICATION (Expo)
// -----------------------------------------
const expo = new Expo();

async function sendPushNotification(pushToken, title, body, extra = {}) {
  if (!Expo.isExpoPushToken(pushToken)) {
    throw new Error("Invalid Expo push token");
  }

  const messages = [
    {
      to: pushToken,
      sound: "default",
      title,
      body,
      data: extra,
    },
  ];

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    const t = await expo.sendPushNotificationsAsync(chunk);
    tickets.push(...t);
  }

  return tickets;
}

// -----------------------------------------
// FRONTEND ROUTES
// -----------------------------------------
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// -----------------------------------------
// ADMIN — PRICING API
// -----------------------------------------
app.get("/api/admin/pricing", (req, res) => {
  const settings = loadPricing();
  res.json({ ok: true, settings });
});

app.post("/api/admin/pricing", (req, res) => {
  try {
    const settings = {
      baseFare: Number(req.body.baseFare),
      includedMiles: Number(req.body.includedMiles),
      extraPerMile: Number(req.body.extraPerMile),
      minimumFare: Number(req.body.minimumFare),
      nightMultiplier: Number(req.body.nightMultiplier),
    };

    savePricing(settings);
    res.json({ ok: true });
  } catch (err) {
    console.error("Pricing save error:", err);
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

// -----------------------------------------
// /api/calc-price — Distance + Pricing
// -----------------------------------------
app.get("/api/calc-price", async (req, res) => {
  try {
    const { pickup, stop, dropoff } = req.query;

    if (!pickup || !dropoff) {
      return res.status(400).json({ error: "Pickup ve dropoff gerekli." });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Google Maps API key eksik." });
    }

    const origin = encodeURIComponent(pickup);
    const dest = encodeURIComponent(dropoff);
    let url =
      `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}` +
      `&destination=${dest}&key=${apiKey}`;

    if (stop) {
      url += `&waypoints=${encodeURIComponent(stop)}`;
    }

    const gRes = await fetch(url);
    const gData = await gRes.json();

    if (!gData.routes?.length) {
      return res.status(500).json({ error: "Rota bulunamadı." });
    }

    let meters = 0;
    gData.routes[0].legs.forEach((leg) => {
      meters += leg.distance?.value || 0;
    });

    const miles = meters / 1609.34;

    res.json({
      ok: true,
      miles: Number(miles.toFixed(2)),
      pricing: loadPricing(),
    });
  } catch (err) {
    console.error("calc-price error:", err);
    res.status(500).json({ error: "Server error." });
  }
});

// -----------------------------------------
// BOOKINGS — Create Reservation (/api/bookings2)
// -----------------------------------------
app.post("/api/bookings2", async (req, res) => {
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

    if (!pickup || !dropoff || !rideDate || !rideTime) {
      return res.status(400).json({
        ok: false,
        message: "Trip details eksik.",
      });
    }

    if (!customerName || !customerPhone || !customerEmail) {
      return res.status(400).json({
        ok: false,
        message: "Name, phone, email zorunlu.",
      });
    }

    const query = `
      INSERT INTO bookings (
        pickup, stop, dropoff,
        ride_date, ride_time, ampm,
        miles, total,
        customer_name, customer_phone, customer_email,
        notes, status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')
      RETURNING id;
    `;

    const result = await pool.query(query, [
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
    ]);

    res.json({ ok: true, id: result.rows[0].id });
  } catch (err) {
    console.error("/api/bookings2 error:", err);
    res.status(500).json({ ok: false, message: "Server error." });
  }
});

// -----------------------------------------
// ADMIN — BOOKINGS LIST
// -----------------------------------------
app.get("/api/admin/bookings", async (req, res) => {
  try {
    const q = "SELECT * FROM bookings ORDER BY created_at DESC;";
    const result = await pool.query(q);
    res.json({ ok: true, bookings: result.rows });
  } catch (err) {
    console.error("load bookings error:", err);
    res.status(500).json({ ok: false });
  }
});

// -----------------------------------------
// ADMIN — UPDATE STATUS
// -----------------------------------------
app.patch("/api/admin/bookings/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    const allowed = [
      "pending",
      "confirmed",
      "paid",
      "on_the_way",
      "arrived",
      "completed",
      "cancelled",
    ];

    if (!allowed.includes(status)) {
      return res.status(400).json({ ok: false, message: "Geçersiz status." });
    }

    await pool.query("UPDATE bookings SET status = $1 WHERE id = $2", [
      status,
      id,
    ]);

    res.json({ ok: true });
  } catch (err) {
    console.error("status update error:", err);
    res.status(500).json({ ok: false });
  }
});

// -----------------------------------------
// PUSH TEST
// -----------------------------------------
app.post("/api/push/send-test", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ ok: false });

    const tickets = await sendPushNotification(
      token,
      "JK2424 Test Notification",
      "This is a test notification."
    );

    res.json({ ok: true, tickets });
  } catch (err) {
    console.error("push test error:", err);
    res.status(500).json({ ok: false });
  }
});

// -----------------------------------------
// START SERVER
// -----------------------------------------
app.listen(PORT, () => {
  console.log("JK2424 Backend running at port", PORT);
});
