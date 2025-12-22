// ===============================
// JK2424 – FRONTEND LOGIC (FINAL)
// ===============================

// Elements
const step2Card = document.getElementById("step2-card");
const resultBox = document.getElementById("estimate-box");
const statusBox = document.getElementById("status-box");

// Initial state
step2Card.classList.add("hidden");
resultBox.classList.add("hidden");
statusBox.classList.add("hidden");

// ===============================
// BACKEND API CONFIG
// ===============================
const BACKEND_BASE = "https://jk2424-backend.onrender.com";
const CALC_API = `${BACKEND_BASE}/calc`;
const BOOKING_API = `${BACKEND_BASE}/bookings`;

// ===============================
// HELPERS
// ===============================
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ===============================
// CALCULATE PRICE
// ===============================
document.getElementById("calculateBtn").addEventListener("click", async () => {
  const pickup = document.getElementById("pickup").value.trim();
  const stop = document.getElementById("extra_stop").value.trim();
  const dropoff = document.getElementById("dropoff").value.trim();

  if (!pickup || !dropoff) {
    alert("Please enter pickup and drop-off locations.");
    return;
  }

  try {
    const params = new URLSearchParams({ pickup, dropoff, stop });
    const res = await fetch(`${CALC_API}?${params}`);
    const data = await res.json();

    if (!data.success) throw new Error("Calc failed");

    step2Card.classList.remove("hidden");
    resultBox.classList.remove("hidden");

    document.getElementById("miles").innerText = `${data.miles} mi`;
    document.getElementById("price").innerText = `$${data.price}`;

  } catch (e) {
    alert("Price calculation error");
    console.error(e);
  }
});

// ===============================
// CREATE BOOKING
// ===============================
document.getElementById("sendBookingBtn").addEventListener("click", async () => {
  const payload = {
    pickup: document.getElementById("pickup").value,
    stop: document.getElementById("extra_stop").value,
    dropoff: document.getElementById("dropoff").value,
    rideDate: document.getElementById("ride_date").value,
    rideTime: document.getElementById("ride_time").value,
    ampm: document.getElementById("ampm").value,
    miles: document.getElementById("miles").innerText.replace(" mi",""),
    total: document.getElementById("price").innerText.replace("$",""),
    customerName: document.getElementById("full_name").value,
    customerPhone: document.getElementById("phone").value,
    customerEmail: document.getElementById("email").value,
    notes: document.getElementById("notes").value
  };

  try {
    const res = await fetch(BOOKING_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.success) throw new Error("Booking failed");

    localStorage.setItem("jk2424_booking_id", data.booking.id);

    statusBox.classList.remove("hidden");
    statusBox.innerText = "Status: pending";

    startStatusPolling(data.booking.id);

  } catch (e) {
    alert("Reservation failed");
    console.error(e);
  }
});

// ===============================
// LIVE STATUS POLLING
// ===============================
async function startStatusPolling(bookingId) {
  while (true) {
    try {
      const res = await fetch(`${BOOKING_API}/${bookingId}`);
      const data = await res.json();

      if (data.success) {
        statusBox.innerText = `Status: ${data.booking.status}`;

        if (data.booking.status === "completed") break;
      }
    } catch (e) {
      console.error("Polling error", e);
    }

    await sleep(5000);
  }
}

// ===============================
// AUTO RESUME (PAGE REFRESH)
// ===============================
const savedId = localStorage.getItem("jk2424_booking_id");
if (savedId) {
  statusBox.classList.remove("hidden");
  startStatusPolling(savedId);
}
