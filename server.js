const express = require("express");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// PUBLIC KLASÖRÜNÜ SERVE ET
app.use(express.static(path.join(__dirname, "public")));

// ANA SAYFA
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ADMIN SAYFASI
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// PRICING SAYFASI
app.get("/pricing", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pricing.html"));
});

// BACKEND URL -> SENİN BACKEND'İN
const BACKEND_URL = "https://jk2424-backend.onrender.com";

// Rezervasyon gönderme (frontend → backend)
app.post("/api/reservations", async (req, res) => {
  try {
    const response = await fetch(`${BACKEND_URL}/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.json(data);

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Admin → Rezervasyon listesi
app.get("/api/admin/reservations", async (req, res) => {
  try {
    const response = await fetch(`${BACKEND_URL}/reservations`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Admin → Status değiştirme
app.post("/api/admin/update-status", async (req, res) => {
  try {
    const response = await fetch(`${BACKEND_URL}/update-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.json(data);

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// PORT AYARI
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Frontend running on ${PORT}`));
