const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

// DATABASE_URL zorunlu
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("WARNING: DATABASE_URL tanımlı değil. Lütfen PostgreSQL bağlantı adresini ayarla.");
}

const pool = new Pool({
  connectionString
});

app.use(cors());
app.use(express.json());

const ALLOWED_STATUSES = [
  "confirmed",
  "paid",
  "on_the_way",
  "arrived",
  "in_progress",
  "completed"
];

// Admin: tüm rezervasyonları listele
app.get("/api/admin/bookings", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, passenger_name, pickup_address, dropoff_address, pickup_datetime, passengers, vehicle_type, estimated_price, notes, status, created_at FROM bookings ORDER BY created_at DESC"
    );

    // Admin HTML'in beklediği format:
    const bookings = result.rows.map((row) => ({
      id: row.id.toString(),
      passenger_name: row.passenger_name,
      pickup_address: row.pickup_address,
      dropoff_address: row.dropoff_address,
      pickup_datetime: row.pickup_datetime,
      passengers: row.passengers,
      vehicle_type: row.vehicle_type,
      estimated_price: row.estimated_price,
      notes: row.notes,
      status: row.status,
      created_at: row.created_at
    }));

    return res.json({ bookings });
  } catch (err) {
    console.error("Error in GET /api/admin/bookings:", err);
    return res.status(500).json({ error: "Failed to load bookings" });
  }
});

// Admin: status güncelle
app.patch("/api/admin/bookings/:id/status", async (req, res) => {
  const bookingId = req.params.id;
  const { status } = req.body;

  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const result = await pool.query(
      "UPDATE bookings SET status = $1 WHERE id = $2 RETURNING id, passenger_name, pickup_address, dropoff_address, pickup_datetime, passengers, vehicle_type, estimated_price, notes, status, created_at",
      [status, bookingId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    const row = result.rows[0];

    const updated = {
      id: row.id.toString(),
      passenger_name: row.passenger_name,
      pickup_address: row.pickup_address,
      dropoff_address: row.dropoff_address,
      pickup_datetime: row.pickup_datetime,
      passengers: row.passengers,
      vehicle_type: row.vehicle_type,
      estimated_price: row.estimated_price,
      notes: row.notes,
      status: row.status,
      created_at: row.created_at
    };

    console.log("Status updated in DB:", { id: updated.id, status: updated.status });

    // BURAYA BİLDİRİM HOOK'LARINI EKLEYECEĞİZ
    // notifyOnStatusChange(updated).catch(console.error);

    return res.json(updated);
  } catch (err) {
    console.error("Error in PATCH /api/admin/bookings/:id/status:", err);
    return res.status(500).json({ error: "Failed to update status" });
  }
});

app.listen(PORT, () => {
  console.log(`JK2424 backend running on port ${PORT}`);
});
