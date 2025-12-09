/* ================================================
   JK2424 • FINAL BACKEND SERVER
   Works with: index.html + index.js + admin panel
   ================================================ */

const express = require("express");
const path = require("path");
const fs = require("fs");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// -------------------------------------
// STATIC PUBLIC FOLDER
// -------------------------------------
app.use(express.static(path.join(__dirname, "public")));


// -------------------------------------
// GOOGLE DISTANCE MATRIX API
// -------------------------------------
const GOOGLE_API_KEY = process.env.GOOGLE_KEY || "AIzaSyAbHskisKfYgRuNTcVm6pTnFy_iDlWf0bc";

async function getDistanceMiles(origin, destination) {
    const url =
        `https://maps.googleapis.com/maps/api/distancematrix/json?` +
        `origins=${encodeURIComponent(origin)}` +
        `&destinations=${encodeURIComponent(destination)}` +
        `&mode=driving&units=imperial&key=${GOOGLE_API_KEY}`;

    const res = await fetch(url);
    const data = await res.json();

    try {
        const miles = data.rows[0].elements[0].distance.text.replace(" mi", "");
        return parseFloat(miles);
    } catch (err) {
        return null;
    }
}


// -------------------------------------
// PRICE CALCULATION API
// -------------------------------------
app.get("/api/calc", async (req, res) => {
    const { pickup, dropoff } = req.query;

    if (!pickup || !dropoff) {
        return res.json({ error: "Missing pickup or dropoff" });
    }

    const miles = await getDistanceMiles(pickup, dropoff);

    if (!miles) {
        return res.json({ error: "Distance calculation failed" });
    }

    // DEFAULT PRICING (gerekirse admin panelinden dinamik yapılacak)
    const BASE_FARE = 65;
    const INCLUDED_MILES = 15;
    const EXTRA_MILE_RATE = 2;

    let extraMiles = Math.max(0, miles - INCLUDED_MILES);
    let total = BASE_FARE + extraMiles * EXTRA_MILE_RATE;

    return res.json({
        distance: miles.toFixed(1) + " miles",
        total: total.toFixed(2)
    });
});


// -------------------------------------
// RESERVATION SAVE
// -------------------------------------
app.post("/api/reserve", (req, res) => {
    const filePath = path.join(__dirname, "reservations.json");

    let existing = [];
    if (fs.existsSync(filePath)) {
        existing = JSON.parse(fs.readFileSync(filePath, "utf8"));
    }

    existing.push({
        ...req.body,
        created_at: new Date().toISOString()
    });

    fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));

    return res.json({ success: true, message: "Reservation saved." });
});


// -------------------------------------
// ADMIN PANEL ROUTES
// -------------------------------------
app.get("/admin", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/pricing", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "pricing.html"));
});

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});


// -------------------------------------
// START SERVER
// -------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("JK2424 backend running on port " + PORT);
});
