// =========================
// GOOGLE AUTOCOMPLETE SETUP
// =========================
function initAutocomplete() {
    const pickup = new google.maps.places.Autocomplete(
        document.getElementById("pickup"),
        { types: ["geocode"] }
    );
    const extraStop = new google.maps.places.Autocomplete(
        document.getElementById("extra_stop"),
        { types: ["geocode"] }
    );
    const dropoff = new google.maps.places.Autocomplete(
        document.getElementById("dropoff"),
        { types: ["geocode"] }
    );
}
google.maps.event.addDomListener(window, "load", initAutocomplete);

// =========================
// DATE AUTO-FORMAT
// =========================
document.getElementById("date").addEventListener("input", function () {
    let v = this.value.replace(/\D/g, "");
    if (v.length >= 3 && v.length <= 4) this.value = v.slice(0, 2) + "/" + v.slice(2);
    else if (v.length > 4) this.value = v.slice(0, 2) + "/" + v.slice(2, 4) + "/" + v.slice(4, 8);
});

// =========================
// TIME AUTO-FORMAT (12-hour)
// =========================
document.getElementById("time").addEventListener("input", function () {
    let v = this.value.replace(/\D/g, "");
    if (v.length >= 3) this.value = v.slice(0, 2) + ":" + v.slice(2, 4);
});

// =========================
// AM / PM BUTTON LOGIC
// =========================
let selectedPeriod = "PM";

document.getElementById("amBtn").addEventListener("click", () => {
    selectedPeriod = "AM";
    document.getElementById("amBtn").classList.add("active");
    document.getElementById("pmBtn").classList.remove("active");
});
document.getElementById("pmBtn").addEventListener("click", () => {
    selectedPeriod = "PM";
    document.getElementById("pmBtn").classList.add("active");
    document.getElementById("amBtn").classList.remove("active");
});

// =========================
// CALCULATE PRICE
// =========================
document.getElementById("calculateBtn").addEventListener("click", async () => {
    const pickup = document.getElementById("pickup").value.trim();
    const dropoff = document.getElementById("dropoff").value.trim();

    if (!pickup || !dropoff) {
        alert("Please enter both pickup and drop-off locations.");
        return;
    }

    const query = new URLSearchParams({
        pickup,
        dropoff,
        extra: document.getElementById("extra_stop").value.trim(),
        date: document.getElementById("date").value.trim(),
        time: document.getElementById("time").value.trim(),
        period: selectedPeriod
    });

    try {
        const res = await fetch(`/api/calc?${query.toString()}`);
        const data = await res.json();

        document.getElementById("distanceText").textContent = data.distance;
        document.getElementById("totalText").textContent = "$" + data.total;

        document.getElementById("estimateBox").classList.remove("hidden");
        document.getElementById("step2").classList.remove("hidden");
    } catch (err) {
        console.error(err);
        alert("Price calculation failed. Please try again.");
    }
});

// =========================
// SEND RESERVATION REQUEST
// =========================
document.getElementById("sendBtn").addEventListener("click", async () => {
    const details = {
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
            body: JSON.stringify(details)
        });

        const data = await res.json();

        document.getElementById("resultMessage").textContent = data.message;
        document.getElementById("resultMessage").style.color = "#f9d25a";
    } catch (err) {
        console.error(err);
        alert("Failed to send reservation.");
    }
});
