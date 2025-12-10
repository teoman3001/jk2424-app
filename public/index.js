// ================================
// JK2424 FRONTEND - FINAL VERSION
// ================================

// Backend URL (Render)
const BACKEND_URL = "https://jk2424-backend.onrender.com";

// -------------------------------
// STEP 1: CALCULATE PRICE
// -------------------------------
async function calculatePrice() {
  const pickup = document.getElementById("pickup").value.trim();
  const extra_stop = document.getElementById("extra_stop").value.trim();
  const dropoff = document.getElementById("dropoff").value.trim();
  const date = document.getElementById("date").value.trim();
  const time = document.getElementById("time").value.trim();
  const ampm = document.querySelector(".ampm-btn.active")?.textContent || "AM";

  if (!pickup || !dropoff || !date || !time) {
    alert("Please fill all required fields.");
    return;
  }

  const payload = {
    pickup,
    extra_stop,
    dropoff,
    date,
    time,
    ampm
  };

  try {
    const res = await fetch(`${BACKEND_URL}/calc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("CALC ERROR:", data);
      alert("Price calculation failed.");
      return;
    }

    // Show results
    document.getElementById("result_price").innerText = `$${data.price}`;
    document.getElementById("result_distance").innerText = `${data.miles} miles`;
    document.getElementById("result_duration").innerText = data.duration;

    // Make Step 2 visible
    document.getElementById("step2").style.display = "block";

  } catch (error) {
    console.error("SERVER ERROR:", error);
    alert("Server connection error.");
  }
}

// -------------------------------
// STEP 2: SEND RESERVATION
// -------------------------------
async function sendReservation() {
  const fullName = document.getElementById("fullname").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const email = document.getElementById("email").value.trim();
  const notes = document.getElementById("notes").value.trim();

  const pickup = document.getElementById("pickup").value.trim();
  const extra_stop = document.getElementById("extra_stop").value.trim();
  const dropoff = document.getElementById("dropoff").value.trim();
  const date = document.getElementById("date").value.trim();
  const time = document.getElementById("time").value.trim();
  const ampm = document.querySelector(".ampm-btn.active")?.textContent || "AM";

  if (!fullName || !phone || !email) {
    alert("Please complete passenger details.");
    return;
  }

  const payload = {
    fullName,
    phone,
    email,
    notes,
    pickup,
    extra_stop,
    dropoff,
    date,
    time,
    ampm
  };

  try {
    const res = await fetch(`${BACKEND_URL}/reservation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      console.error(data);
      alert("Reservation failed.");
      return;
    }

    alert("Reservation request sent successfully.");

  } catch (error) {
    console.error("SERVER ERROR:", error);
    alert("Server error while sending reservation.");
  }
}

// -------------------------------
// MAP AUTOCOMPLETE (Google Places)
// -------------------------------
function initAutocomplete() {
  const options = {
    fields: ["formatted_address", "geometry"],
    types: ["geocode"]
  };

  new google.maps.places.Autocomplete(document.getElementById("pickup"), options);
  new google.maps.places.Autocomplete(document.getElementById("extra_stop"), options);
  new google.maps.places.Autocomplete(document.getElementById("dropoff"), options);
}

// -------------------------------
// AM/PM BUTTON SELECTION
// -------------------------------
function selectAMPM(type) {
  document.getElementById("btnAM").classList.remove("active");
  document.getElementById("btnPM").classList.remove("active");

  if (type === "AM") {
    document.getElementById("btnAM").classList.add("active");
  } else {
    document.getElementById("btnPM").classList.add("active");
  }
}

window.initAutocomplete = initAutocomplete;
