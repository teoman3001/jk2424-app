console.log("JK2424 index.js loaded");

// API endpoint base
const API_BASE = "/api";

// Elements
const pickupInput = document.getElementById("pickup");
const stopInput = document.getElementById("extra_stop");
const dropoffInput = document.getElementById("dropoff");
const dateInput = document.getElementById("date");
const timeInput = document.getElementById("time");
const amBtn = document.getElementById("amBtn");
const pmBtn = document.getElementById("pmBtn");
const calcBtn = document.getElementById("calculateBtn");

const estimateBox = document.getElementById("estimateBox");
const distanceText = document.getElementById("distanceText");
const totalText = document.getElementById("totalText");

const fullnameInput = document.getElementById("fullname");
const phoneInput = document.getElementById("phone");
const emailInput = document.getElementById("email");
const notesInput = document.getElementById("notes");
const sendBtn = document.getElementById("sendBtn");
const resultMessage = document.getElementById("resultMessage");

let currentAmpm = "PM";
let lastQuote = null;

// ----------------------
// AM / PM Buttons
// ----------------------
amBtn.addEventListener("click", () => {
  currentAmpm = "AM";
  amBtn.classList.add("active");
  pmBtn.classList.remove("active");
});

pmBtn.addEventListener("click", () => {
  currentAmpm = "PM";
  pmBtn.classList.add("active");
  amBtn.classList.remove("active");
});

// ----------------------
// Auto-format DATE
// ----------------------
dateInput.addEventListener("input", () => {
  let v = dateInput.value.replace(/[^0-9]/g, "");

  if (v.length > 2 && v.length <= 4) v = v.slice(0, 2) + "/" + v.slice(2);
  else if (v.length > 4) v = v.slice(0, 2) + "/" + v.slice(2, 4) + "/" + v.slice(4, 8);

  dateInput.value = v.slice(0, 10);
});

// ----------------------
// Auto-format TIME
// ----------------------
timeInput.addEventListener("input", () => {
  let v = timeInput.value.replace(/[^0-9]/g, "");
  if (v.length > 2) v = v.slice(0, 2) + ":" + v.slice(2, 4);
  timeInput.value = v.slice(0, 5);
});

// ----------------------
// Convert to 24h
// ----------------------
function convertTo24h(timeStr, ampm) {
  const [hh, mm] = timeStr.split(":").map(Number);
  if (isNaN(hh) || isNaN(mm)) return null;

  let h = hh;
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;

  return { h, m: mm };
}

// ----------------------
// NIGHT FARE MULTIPLIER
// ----------------------
function getNightMultiplier(timeStr, ampm) {
  const t = convertTo24h(timeStr, ampm);
  if (!t) return 1;

  const totalMinutes = t.h * 60 + t.m;
  const isNight = totalMinutes >= 22 * 60 || totalMinutes < 5 * 60;

  return isNight ? 1.25 : 1.0;
}

// ----------------------
// Calculate Price
// ----------------------
calcBtn.addEventListener("click", async () => {
  const pickup = pickupInput.value.trim();
  const stop = stopInput.value.trim();
  const dropoff = dropoffInput.value.trim();
  const date = dateInput.value.trim();
  const time = timeInput.value.trim();

  if (!pickup || !dropoff) {
    alert("Pickup and drop-off required.");
    return;
  }

  if (!date || date.length < 8 || !time || time.length < 4) {
    alert("Please enter date and time.");
    return;
  }

  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    alert("Please enter time as HH:MM.");
    return;
  }

  const hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);

  if (hours < 1 || hours > 12 || minutes > 59) {
    alert("Invalid time. Use 01:00–12:59.");
    return;
  }

  // Call backend for distance
  const url =
    `/api/calc-price?pickup=${encodeURIComponent(pickup)}&stop=${encodeURIComponent(stop)}&dropoff=${encodeURIComponent(dropoff)}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      alert("Error: " + data.error);
      return;
    }

    const miles = Number(data.miles || 0);
    if (miles <= 0) {
      alert("Could not calculate distance.");
      return;
    }

    // Pricing from server
    const config = data.pricing || {};
    const baseFare = Number(config.baseFare ?? 65);
    const includedMiles = Number(config.includedMiles ?? 15);
    const extraPerMile = Number(config.extraPerMile ?? 2);
    const minimumFare = Number(config.minimumFare ?? baseFare);

    const nightMultiplier = getNightMultiplier(time, currentAmpm);

    const extraMiles = Math.max(0, miles - includedMiles);
    let total = (baseFare + extraMiles * extraPerMile) * nightMultiplier;

    if (total < minimumFare) total = minimumFare;

    // Set UI
    estimateBox.style.display = "block";
    distanceText.textContent = miles.toFixed(2) + " miles";
    totalText.textContent = "$" + total.toFixed(2);

    // Save
    lastQuote = {
      pickup,
      stop,
      dropoff,
      date,
      time,
      ampm: currentAmpm,
      miles,
      total
    };
  } catch (err) {
    console.error(err);
    alert("Server error calculating price.");
  }
});

// ----------------------
// Send Booking
// ----------------------
sendBtn.addEventListener("click", async () => {
  if (!lastQuote) {
    resultMessage.textContent = "Please calculate price first.";
    return;
  }

  const name = fullnameInput.value.trim();
  const phone = phoneInput.value.trim();
  const email = emailInput.value.trim();
  const notes = notesInput.value.trim();

  if (!name || !phone || !email) {
    resultMessage.textContent = "Name, phone, and email required.";
    return;
  }

  const parts = lastQuote.date.split("/");
  const month = parseInt(parts[0]);
  const day = parseInt(parts[1]);
  const year = parseInt(parts[2]);

  const t24 = convertTo24h(lastQuote.time, lastQuote.ampm);
  if (!t24) {
    resultMessage.textContent = "Invalid time.";
    return;
  }

  const isoDate = new Date(year, month - 1, day, t24.h, t24.m).toISOString();

  const combinedNotes =
    `Phone: ${phone}` +
    (email ? ` | Email: ${email}` : "") +
    (notes ? ` | Notes: ${notes}` : "");

  const payload = {
    passenger_name: name,
    pickup_address: lastQuote.pickup,
    dropoff_address: lastQuote.dropoff,
    pickup_datetime: isoDate,
    passengers: 1,
    vehicle_type: "Mercedes EQS",
    estimated_price: lastQuote.total,
    notes: combinedNotes
  };

  try {
    const res = await fetch(API_BASE + "/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      resultMessage.textContent = data.error || "Server error saving reservation.";
      return;
    }

    resultMessage.style.color = "#4cd964";
    resultMessage.textContent =
      "Reservation received. You will get confirmation shortly.";

    lastQuote = null;
  } catch (err) {
    console.error(err);
    resultMessage.textContent = "Server error sending booking.";
  }
});

// ----------------------
// Google Places Autocomplete
// ----------------------
function initAutocomplete() {
  const bounds = new google.maps.LatLngBounds(
    new google.maps.LatLng(38.3, -78.8),
    new google.maps.LatLng(39.9, -76.0)
  );

  const opts = {
    fields: ["formatted_address", "geometry", "name", "place_id"],
    componentRestrictions: { country: "us" },
    bounds
  };

  if (pickupInput) new google.maps.places.Autocomplete(pickupInput, opts);
  if (stopInput) new google.maps.places.Autocomplete(stopInput, opts);
  if (dropoffInput) new google.maps.places.Autocomplete(dropoffInput, opts);
}

window.addEventListener("load", () => {
  if (window.google && google.maps && google.maps.places) {
    initAutocomplete();
  } else {
    const x = setInterval(() => {
      if (window.google && google.maps && google.maps.places) {
        clearInterval(x);
        initAutocomplete();
      }
    }, 300);
  }
});
