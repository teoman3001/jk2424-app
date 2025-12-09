/* -----------------------------
   GOOGLE PLACES AUTOCOMPLETE
------------------------------ */
let pickupAutocomplete, stopAutocomplete, dropoffAutocomplete;

function initAutocomplete() {
  const options = {
    fields: ["formatted_address", "geometry", "name"],
    types: ["geocode"]
  };

  pickupAutocomplete = new google.maps.places.Autocomplete(
    document.getElementById("pickup"),
    options
  );

  stopAutocomplete = new google.maps.places.Autocomplete(
    document.getElementById("stop"),
    options
  );

  dropoffAutocomplete = new google.maps.places.Autocomplete(
    document.getElementById("dropoff"),
    options
  );
}

window.initAutocomplete = initAutocomplete;
document.addEventListener("DOMContentLoaded", initAutocomplete);


/* -----------------------------
   DATE AUTO-FORMAT (MM/DD/YYYY)
------------------------------ */
const dateInput = document.getElementById("rideDate");

dateInput.addEventListener("input", () => {
  let v = dateInput.value.replace(/\D/g, "");
  if (v.length >= 3 && v.length <= 4) v = v.replace(/(\d{2})(\d+)/, "$1/$2");
  if (v.length >= 5) v = v.replace(/(\d{2})(\d{2})(\d+)/, "$1/$2/$3");
  dateInput.value = v.slice(0, 10);
});


/* -----------------------------
   TIME AUTO-FORMAT (HH:MM)
------------------------------ */
const timeInput = document.getElementById("rideTime");

timeInput.addEventListener("input", () => {
  let v = timeInput.value.replace(/\D/g, "");
  if (v.length >= 3) v = v.replace(/(\d{2})(\d+)/, "$1:$2");
  timeInput.value = v.slice(0, 5);
});


/* -----------------------------
   AM / PM BUTTONS
------------------------------ */
let ampm = "AM";

document.getElementById("amBtn").addEventListener("click", () => {
  ampm = "AM";
  document.getElementById("amBtn").classList.add("active");
  document.getElementById("pmBtn").classList.remove("active");
});

document.getElementById("pmBtn").addEventListener("click", () => {
  ampm = "PM";
  document.getElementById("pmBtn").classList.add("active");
  document.getElementById("amBtn").classList.remove("active");
});


/* -----------------------------
   PRICE CALCULATION
------------------------------ */
document.getElementById("calcPriceBtn").addEventListener("click", async () => {
  const pickup = document.getElementById("pickup").value.trim();
  const stop = document.getElementById("stop").value.trim();
  const dropoff = document.getElementById("dropoff").value.trim();
  const date = dateInput.value.trim();
  const time = timeInput.value.trim();

  if (!pickup || !dropoff || !date || !time) {
    showCalcMsg("Please fill out all required fields.", true);
    return;
  }

  showCalcMsg("Calculating...", false);

  const datetime = `${date} ${time} ${ampm}`;

  try {
    const res = await fetch("/calculate-price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickup,
        stop,
        dropoff,
        datetime
      })
    });

    const data = await res.json();

    if (!data.success) {
      showCalcMsg("Could not calculate price.", true);
      return;
    }

    updateEstimateUI(data);
    showStep2(data);

  } catch (err) {
    showCalcMsg("Connection error.", true);
  }
});


function showCalcMsg(msg, error = false) {
  const el = document.getElementById("calcMsg");
  el.textContent = msg;
  el.style.color = error ? "#f55" : "#f5d05c";
}


/* -----------------------------
   UPDATE ESTIMATE UI
------------------------------ */
function updateEstimateUI(data) {
  document.getElementById("estimateEmptyText").style.display = "none";
  document.getElementById("estimateDetails").style.display = "block";

  document.getElementById("estDistance").textContent = data.distanceText;
  document.getElementById("estBaseFare").textContent = `$${data.baseFare.toFixed(2)}`;
  document.getElementById("estExtraMiles").textContent = data.extraMilesText;
  document.getElementById("estNightFare").textContent = data.nightFareText;
  document.getElementById("estTotal").textContent = `$${data.total.toFixed(2)}`;

  document.getElementById("mapsLink").href = data.mapsUrl;
}


/* -----------------------------
   SHOW STEP 2 AFTER PRICE
------------------------------ */
function showStep2(data) {
  const step2 = document.getElementById("step2Card");
  step2.style.display = "block";

  document.getElementById("summaryPickup").textContent = `Pickup: ${data.pickup}`;
  document.getElementById("summaryDropoff").textContent = `Drop-off: ${data.dropoff}`;
  document.getElementById("summaryDateTime").textContent = `Date & Time: ${data.datetime}`;
  document.getElementById("summaryTotal").textContent = `Estimated Price: $${data.total.toFixed(2)}`;
}


/* -----------------------------
   SEND BOOKING REQUEST
------------------------------ */
document.getElementById("sendBookingBtn").addEventListener("click", async () => {
  const fullName = document.getElementById("fullName").value.trim();
  const phone = document.getElementById("mobilePhone").value.trim();
  const email = document.getElementById("email").value.trim();
  const notes = document.getElementById("notes").value.trim();

  if (!fullName || !phone || !email) {
    showBookingMsg("Please complete all required fields.", true);
    return;
  }

  showBookingMsg("Sending reservation...", false);

  try {
    const res = await fetch("/send-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        phone,
        email,
        notes
      })
    });

    const data = await res.json();

    if (!data.success) {
      showBookingMsg("Could not send reservation.", true);
      return;
    }

    showBookingMsg("Reservation sent successfully!", false);

  } catch (err) {
    showBookingMsg("Connection error.", true);
  }
});


function showBookingMsg(msg, error = false) {
  const el = document.getElementById("bookingMsg");
  el.textContent = msg;
  el.style.color = error ? "#f55" : "#5cf57a";
}
