const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// PUBLIC
app.use(express.static(path.join(__dirname, "public")));

// PAGES
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public/admin.html"));
});

// SAVE RESERVATION
app.post("/save-reservation", (req, res) => {
  const reservation = req.body;
  const filePath = path.join(__dirname, "reservations.json");

  let existing = [];
  if (fs.existsSync(filePath)) {
    existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  }

  existing.push({ ...reservation, created_at: new Date().toISOString() });

  fs.writeFileSync(filePath, JSON.stringify(existing, null, 2));

  res.json({ success: true });
});

// SERVER
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("JK2424 server running on port " + PORT);
});
