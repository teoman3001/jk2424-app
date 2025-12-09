// JK2424 FRONTEND INDEX.JS
const API_BASE = "https://jk2424-backend.onrender.com";

// ---- GOOGLE AUTOCOMPLETE ----
let pickupAutocomplete, stopAutocomplete, dropoffAutocomplete;

function initAutocomplete() {
  const pickupInput = document.getElementById("pickup");
  const stopInput = document.getElementById("extra_stop");
  const dropoffInput = document.getElementById("dropoff");

  pickupAutocomplete = new google.maps.places.Autocomplete(pickupInput);
  stopAutocomplete = new google.maps.places.Autocomplete(stopInput);
  dropoffAutocomplete = new google.maps.places.Autocomplete(dropoffInput);
}

// ---- PRICE CALCULATION ----
async function calculatePrice() {
  const pickup = document.getElementById("pickup").value.trim();
  const stop = document.getElementById("extra_stop").value.trim();
  const dropoff = document.getElementById("dropoff").value.trim();
  const date = document.getElementById("date").value;
  const time = document.getElementById("time").value;
  const ampm = document.querySelector('input[name="ampm"]:checked')?.value;

  if (!pickup || !dropoff || !date || !time || !ampm) {
    alert("Please fill all required fields.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/calc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickup,
        stop: stop || null,
        dropoff,
        date,
        time,
        ampm,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) throw new Error(data.message);

    document.getElementById("estimateBox").style.display = "block";
    document.getElementById("estDistance").textContent =
      data.distance.toFixed(2) + " miles";

    document.getElementById("estBaseFare").textContent = `$${data.baseFare}`;
    document.getElementById("estExtraMiles").textContent = `${data.extraMiles}`;
    document.getElementById("estExtraFee").textContent = `$${data.extraFee}`;
    document.getElementById("estNightFee").textContent = data.nightFee
      ? "Yes (+$" + data.nightFee + ")"
      : "No";

    document.getElementById("estTotal").textContent =
      "$" + data.total.toFixed(2);

    // Step 2 box
    document.getElementById("step2Box").style.display = "block";
    document.getElementById("reviewPickup").textContent = pickup;
    document.getElementById("reviewStop").textContent = stop || "-";
    document.getElementById("reviewDropoff").textContent = dropoff;
    document.getElementById("reviewDate").textContent = date;
    document.getElementById("reviewTime").textContent = `${time} ${ampm}`;
    document.getElementById("reviewTotal").textContent =
      "$" + data.total.toFixed(2);
  } catch (err) {
    console.error(err);
    alert("Error calculating price. Try again.");
  }
}

// ---- SEND RESERVATION ----
async function submitReservation() {
  const fullName = document.getElementById("fullname").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const email = document.getElementById("email").value.trim();
  const notes = document.getElementById("notes").value.trim();

  const pickup = document.getElementById("pickup").value.trim();
  const stop = document.getElementById("extra_stop").value.trim();
  const dropoff = document.getElementById("dropoff").value.trim();
  const date = document.getElementById("date").value;
  const time = document.getElementById("time").value;
  const ampm = document.querySelector('input[name="ampm"]:checked')?.value;

  if (!fullName || !phone || !email) {
    alert("Please fill passenger details.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/book`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickup,
        stop: stop || null,
        dropoff,
        date,
        time,
        ampm,
        fullname: fullName,
        phone,
        email,
        notes,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) throw new Error(data.message);

    alert("Reservation received! You will get a confirmation shortly.");
    window.location.reload();
  } catch (err) {
    console.error(err);
    alert("Error sending reservation.");
  }
}

// ---- INIT EVENTS ----
document.addEventListener("DOMContentLoaded", () => {
  document
    .getElementById("calcBtn")
    .addEventListener("click", calculatePrice);

  document
    .getElementById("reserveBtn")
    .addEventListener("click", submitReservation);
});

// Expose google init
window.initAutocomplete = initAutocomplete;
