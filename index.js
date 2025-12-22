// ===============================
// JK2424 – FRONTEND LOGIC
// ===============================

// Elements
const step2Card = document.getElementById("step2-card");
const resultBox = document.getElementById("estimate-box");
const statusBox = document.getElementById("status-box"); // optional UI area

step2Card.classList.add("hidden");
resultBox.classList.add("hidden");
if (statusBox) statusBox.classList.add("hidden");

// ===============================
// BACKEND API CONFIG
// ===============================
const BACKEND_BASE = "https://jk2424-backend.onrender.com";
const CALC_API = `${BACKEND_BASE}/calc`;
const BOOKING_API = `${BACKEND_BASE}/bookings`;

// ===============================
// HELPERS
// ===============================
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
    const params = new URLSearchParams({
      pickup,
      dropoff,
      stop: stop || ""
    });

    const response = await fetch(`${CALC_API}?${params.toString()}`);
    if (!response.ok) throw new Error("Backend request failed");

    const data = await response.json();
    if (!data.success) {
      alert("Price calculation failed.");
      return;
    }

    step2Card.classList.remove("hidden");
    resultBox.classList.remove("hidden");

    document.getElementById("miles").innerText = `${data.miles} mi`;
    document.getElementById("price").innerText = `$${data.price}`;

  } catch (error) {
    console.error("Calculation error:", error);
    alert("Server error while calculating price.");
  }
});

// ===============================
// CREATE BOOKING
// ===============================
document.getElementById("sendBookingBtn")?.addEventListener("click", async () => {
  const payload = {
    pickup: document.getElementById("pickup").value.trim(),
    stop: document.getElementById("extra_stop").value.trim(),
    dropoff: document.getElementById("dropoff").value.trim(),
    rideDate: document.getElementById("ride_date")?.value || "",
    rideTime: document.getElementById("ride_time")?.value || "",
    ampm: document.getElementById("ampm")?.value || "AM",
    miles: document.getElementById("miles").innerText.replace(" mi", ""),
    total: document.getElementById("price").innerText.replace("$", ""),
    customerName: document.getElementById("full_name")?.value || "Guest",
    customerPhone: document.getElementById("phone")?.value || "",
    customerEmail: document.getElementById("email")?.value || "",
    notes: document.getElementById("notes")?.value || ""
  };

  try {
    const res = await fetch(BOOKING_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!data.success) {
      alert("Booking failed.");
      return;
    }

    // Save booking ID for live tracking
    localStorage.setItem("jk2424_booking_id", data.booking.id);

    alert("Reservation sent. Waiting for confirmation...");
    startStatusPolling(data.booking.id);

  } catch (err) {
    console.error("Booking error:", err);
    alert("Server error while sending reservation.");
  }
});

// ===============================
// LIVE STATUS POLLING (FAZ 2)
// ===============================
async function startStatusPolling(bookingId) {
  if (statusBox) statusBox.classList.remove("hidden");

  while (true) {
    try {
      const res = await fetch(`${BOOKING_API}/${bookingId}`);
      if (!res.ok) throw new Error("Polling failed");

      const data = await res.json();
      if (data.success) {
        if (statusBox) {
          statusBox.innerText = `Status: ${data.booking.status}`;
        }

        // Stop polling when completed
        if (data.booking.status === "completed") {
          break;
        }
      }
    } catch (err) {
      console.error("Polling error:", err);
    }

    await sleep(5000); // every 5 seconds
  }
}

// ===============================
// AUTO RESUME POLLING (PAGE RELOAD)
// ===============================
const savedBookingId = localStorage.getItem("jk2424_booking_id");
if (savedBookingId) {
  startStatusPolling(savedBookingId);
}
