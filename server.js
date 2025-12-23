const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ===================================================
// 1. PRICING SETTINGS (Admin’den değiştirilebilir)
// ===================================================
let pricingSettings = {
  baseFare: 65,
  includedMiles: 8,
  extraPerMile: 2,
  nightMultiplier: 1.25,
  minimumFare: 65
};

// ===================================================
// VERİ DEPOLAMA (In-memory)
// ===================================================
let customers = []; 
let bookings = [];

// ===================================================
// YARDIMCI FONKSİYONLAR
// ===================================================
function normalizePhone(phone) {
  return phone.replace(/\D/g, ""); 
}

// Yeni: Fiyat Hesaplama Motoru
function calculatePrice(miles, isNight) {
  const base = pricingSettings.baseFare;
  const included = pricingSettings.includedMiles;
  const extraRate = pricingSettings.extraPerMile;

  let extraMiles = Math.max(0, miles - included);
  let extraCost = extraMiles * extraRate;

  let subtotal = base + extraCost;

  if (isNight) {
    subtotal = subtotal * pricingSettings.nightMultiplier;
  }

  const total = Math.max(subtotal, pricingSettings.minimumFare);

  return {
    miles: Number(miles.toFixed(2)),
    baseFare: base,
    includedMiles: included,
    extraMiles: Number(extraMiles.toFixed(2)),
    extraCost: Number(extraCost.toFixed(2)),
    nightApplied: isNight,
    nightMultiplier: pricingSettings.nightMultiplier,
    total: Number(total.toFixed(2))
  };
}

// ===================================================
// ANA SAYFA
// ===================================================
app.get("/", (req, res) => {
  res.send("JK2424 Backend - Pricing Engine v1.1 is running");
});

// ===================================================
// 2. /calc ENDPOINT (Kural Kırılımlı Hesaplama)
// ===================================================
app.get("/calc", (req, res) => {
  const { pickup, dropoff, isNight } = req.query;

  if (!pickup || !dropoff) {
    return res.json({ success: false, error: "Missing pickup or dropoff" });
  }

  // Şimdilik gerçek Google mesafesi yok → mock (Adım 2'de bağlanacak)
  const miles = 13.63;

  const pricing = calculatePrice(miles, isNight === "true");

  res.json({
    success: true,
    pricing
  });
});

// ===================================================
// 3. PRICING SETTINGS ENDPOINTS (Admin Altyapısı)
// ===================================================
app.get("/pricing", (req, res) => {
  res.json({ success: true, pricingSettings });
});

app.post("/pricing", (req, res) => {
  const {
    baseFare,
    includedMiles,
    extraPerMile,
    nightMultiplier,
    minimumFare
  } = req.body;

  pricingSettings = {
    baseFare: Number(baseFare),
    includedMiles: Number(includedMiles),
    extraPerMile: Number(extraPerMile),
    nightMultiplier: Number(nightMultiplier),
    minimumFare: Number(minimumFare)
  };

  res.json({ success: true, pricingSettings });
});

// ===================================================
// 4. REZERVASYON OLUŞTURMA (POST /bookings)
// ===================================================
app.post("/bookings", (req, res) => {
  const {
    pickup, stop, dropoff, rideDate, rideTime, ampm,
    miles, total, customerName, customerPhone, customerEmail, notes
  } = req.body;

  if (!pickup || !dropoff || !customerName || !customerPhone) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const phoneKey = normalizePhone(customerPhone);
  let customer = customers.find(c => c.phone === phoneKey);
  
  if (!customer) {
    customer = {
      id: crypto.randomUUID(),
      name: customerName,
      phone: phoneKey,
      email: customerEmail || "",
      createdAt: new Date().toISOString()
    };
    customers.push(customer);
  }

  const booking = {
    id: crypto.randomUUID(),
    customerId: customer.id,
    pickup, stop, dropoff, rideDate, rideTime, ampm, miles, total,
    notes: notes || "",
    status: "pending",
    createdAt: new Date().toISOString(),
    updatedAt: null
  };

  bookings.unshift(booking);

  res.status(201).json({
    success: true,
    booking: {
      id: booking.id,
      status: booking.status,
      total: booking.total
    }
  });
});

// ===================================================
// 5. TEKİL REZERVASYON SORGULAMA (track.html)
// ===================================================
app.get("/bookings/:id", (req, res) => {
  const booking = bookings.find(b => b.id === req.params.id);
  if (!booking) {
    return res.status(404).json({ success: false, message: "Booking not found" });
  }
  const customer = customers.find(c => c.id === booking.customerId) || {};
  res.json({
    success: true,
    booking: { ...booking, customerName: customer.name, customerPhone: customer.phone }
  });
});

// ===================================================
// 6. LİSTELEME VE STATUS GÜNCELLEME (Admin)
// ===================================================
app.get("/bookings", (req, res) => {
  const enriched = bookings.map(b => {
    const c = customers.find(x => x.id === b.customerId) || {};
    return { ...b, customerName: c.name, customerPhone: c.phone };
  });
  res.json({ success: true, bookings: enriched });
});

app.patch("/bookings/:id/status", (req, res) => {
  const { status } = req.body;
  const idx = bookings.findIndex(b => b.id === req.params.id);
  if (idx !== -1) {
    bookings[idx].status = status;
    bookings[idx].updatedAt = new Date().toISOString();
    return res.json({ success: true, booking: bookings[idx] });
  }
  res.status(404).json({ success: false, message: "Not found" });
});

app.listen(PORT, () => {
  console.log("🚀 JK2424 Server (v1.1) running on port", PORT);
});
