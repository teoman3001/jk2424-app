// =========================
// GOOGLE AUTOCOMPLETE SETUP
// =========================
function initAutocomplete() {
    const options = {
        types: ["geocode"],
        componentRestrictions: { country: "us" }
    };

    new google.maps.places.Autocomplete(document.getElementById("pickup"), options);
    new google.maps.places.Autocomplete(document.getElementById("extra_stop"), options);
    new google.maps.places.Autocomplete(document.getElementById("dropoff"), options);
}

google.maps.event.addDomListener(window, "load", initAutocomplete);



// =========================
// AUTO FORMAT DATE (MM/DD/YYYY)
// =========================
document.getElementById("date").addEventListener("input", function () {
    let v = this.value.replace(/\D/g, "");
    if (v.length >= 3 && v.length <= 4) {
        this.value = v.slice(0, 2) + "/" + v.slice(2);
    } else if (v.length > 4) {
        this.value = v.slice(0, 2) + "/" + v.slice(2, 4) + "/" + v.slice(4, 8);
    }
});



// =========================
// AUTO FORMAT TIME (HH:MM)
// =========================
document.getElementById("time").addEventListener("input", function () {
    let v = this.value.replace(/\D/g, "");
    if (v.length >= 3) {
        this.value = v.slice(0, 2) + ":" + v.slice(2, 4);
    }
});



// =========================
// AM / PM BUTTONS
// =========================
let selectedPeriod = "PM";

const amBtn = document.getElementById("amBtn");
const pmBtn = document.getElementById("pmBtn");

amBtn.addEventListener("click", () => {
    selectedPeriod = "AM";
    amBtn.classList.add("active");
    pmBtn.classList.remove("active");
});

pmBtn.addEventListener("click", () => {
    selectedPeriod = "PM";
    pmBtn.classList.add("active");
    amBtn.classList.remove("active");
});



// =========================
// CALCULATE PRICE
// =========================
document.getElementById("calculateBtn").addEventListener("click", async () => {
    const pickup = document.getElementById("pickup").value.trim();
    const extra = document.getElementById("extra_stop").value.trim();
    const dropoff = document.getElementById("dropoff").value.trim();
    const date = document.getElementById("date").value.trim();
    const time = document.getElementById("time").value.trim();

    if (!pickup || !dropoff) {
        alert("Pickup and drop-off locations are required.");
        return;
    }

    if (!date || !time) {
        alert("Please enter date and time.");
        return;
    }

    const query = new URLSearchParams({
        pickup,
        extra,
        dropoff,
        date,
        time,
        period: selectedPeriod
    });

    try {
        const res = await fetch(`/api/calc?${query.toString()}`);
        const data = await res.json();

        if (!data || !data.total) {
            alert("Price calculation error.");
            return;
        }

        document.getElementById("distanceText").textContent = data.distance;
        document.getElementById("totalText").textContent = "$" + data.total;

        document.getElementById("estimateBox").classList.remove("hidden");
        document.getElementById("step2").classList.remove("hidden");
    } catch (err) {
        console.error(err);
        alert("Server error during price calculation.");
    }
});



// =========================
// SEND RESERVATION REQUEST
// =========================
document.getElementById("sendBtn").addEventListener("click", async () => {
    const payload = {
        pickup: document.getElementById("pickup").value.trim(),
        extra_stop: document.getElementById("extra_stop").value.trim(),
        dropoff: document.getElementById("dropoff").value.trim(),
        date: document.getElementById("date").value.trim(),
        time: document.getElementById("time").value.trim(),
        period: selectedPeriod,
        fullname: document.getElementById("fullname").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        email: document.getElementById("email").value.trim(),
        notes: document.getElementById("notes").value.trim()
    };

    try {
        const res = await fetch("/api/reserve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        document.getElementById("resultMessage").textContent = data.message || "Request sent.";
        document.getElementById("resultMessage").style.color = "#f9d25a";
    } catch (err) {
        console.error(err);
        alert("Failed to send reservation.");
    }
});
