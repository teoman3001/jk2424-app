// server.js — JK2424 FINAL STABLE VERSION

const express = require("express");
const path = require("path");
const fs = require("fs");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// PUBLIC klasörünü statik servis et
app.use(express.static(path.join(__dirname, "public")));

// ---------------------------
// ROUTES (User Pages)
// ---------------------------

// Ana sayfa → index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Admin paneli → admin.html
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// Pricing → pricing.html
app.get("/pricing", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "pricing.html"));
});

// ---------------------------
// RESERVATION SAVE
// ---------------------------

app.post("/save-reservation", (req, res) => {
  const reservation = req.body;

  // Kaydı JSON dosyasına ekle
  const filePath = path.join(__dirname, "reservations.json");

  let existing = [];
  if (fs.existsSync(filePath)) {
    existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  existing.push({
    ...reservation,
    created_at: new Date().toISOString(),
  });

  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));

  res.json({ success: true, message: "Reservation saved successfully" });
});

// ---------------------------
// SERVER START
// ---------------------------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("JK2424 Server running on port " + PORT);
});
