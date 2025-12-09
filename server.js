// ==========================
// JK2424 • FINAL BACKEND API
// ==========================

const express = require("express");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// STATIC
app.use(express.static(path.join(__dirname, "public")));

// ==========================
// GOOGLE DISTANCE MATRIX KEY
// ==========================

const GOOGLE_KEY = process.env.GOOGLE_KEY || "AIzaSyCgnDJwKDpN2fWL5NCDCd44kunvC89_4-8";

// ==========================
// PRICE SETTINGS
// ==========================

const BASE_RATE_DAY = 3.0;     // Gündüz mil başına fiyat
const BASE_RATE_NIGHT = 3.5;   // Gece mil başına fiyat
const BASE_FEE = 25;           // Sabit ücret

// ==========================
// ROUTES (HTML PAGES)
// ==========================

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

// ==========================
// API: CALCULATE PRICE
// ==========================

app.get("/api/calc", async (req, res) => {

    try {
        const { pickup, dropoff, extra, date, time, period } = req.query;

        if (!pickup || !dropoff) {
            return res.status(400).json({ error: "Pickup and dropoff required" });
        }

        // NIGHT vs DAY
        const isNight = period === "PM" && Number(time.split(":")[0]) >= 8;
        const mileRate = isNight ? BASE_RATE_NIGHT : BASE_RATE_DAY;

        // Build Google API URL
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(
            pickup
        )}&destinations=${encodeURIComponent(
            dropoff
        )}${
            extra ? "|" + encodeURIComponent(extra) : ""
        }&units=imperial&key=${GOOGLE_KEY}`;

        const response = await axios.get(url);
        const matrix = response.data;

        if (!matrix.rows[0].elements[0].distance) {
            return res.status(400).json({ error: "Distance lookup failed" });
        }

        // Distance in miles
        let miles = matrix.rows[0].elements[0].distance.value / 1609.34;

        // Price calculation
        let total = BASE_FEE + miles * mileRate;
        total = Math.round(total * 100) / 100;

        return res.json({
            distance: miles.toFixed(2) + " miles",
            total: total
        });

    } catch (err) {
        console.error("CALC ERROR:", err);
        return res.status(500).json({ error: "Calculation failed" });
    }
});

// ==========================
// API: SAVE RESERVATION
// ==========================

app.post("/api/reserve", (req, res) => {
    const file = path.join(__dirname, "reservations.json");

    let existing = [];
    if (fs.existsSync(file)) {
        existing = JSON.parse(fs.readFileSync(file, "utf-8"));
    }

    const record = {
        id: existing.length + 1,
        ...req.body,
        created_at: new Date().toISOString(),
        status: "pending"
    };

    existing.push(record);

    fs.writeFileSync(file, JSON.stringify(existing, null, 2));

    return res.json({ success: true, message: "Reservation successful" });
});

// ==========================
// API: GET BOOKINGS (ADMIN)
// ==========================

app.get("/api/bookings", (req, res) => {
    const file = path.join(__dirname, "reservations.json");

    if (!fs.existsSync(file)) {
        return res.json([]);
    }

    const data = JSON.parse(fs.readFileSync(file));
    return res.json(data.reverse());
});

// ==========================
// API: UPDATE STATUS
// ==========================

app.post("/api/update-status", (req, res) => {
    const { id, status } = req.body;
    const file = path.join(__dirname, "reservations.json");

    if (!fs.existsSync(file)) {
        return res.status(400).json({ error: "No reservation database found" });
    }

    let data = JSON.parse(fs.readFileSync(file));

    let item = data.find((x) => x.id == id);
    if (!item) return res.status(404).json({ error: "Reservation not found" });

    item.status = status;

    fs.writeFileSync(file, JSON.stringify(data, null, 2));

    return res.json({ success: true, message: "Status updated" });
});

// ==========================
// START SERVER
// ==========================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("JK2424 API running on port " + PORT));
