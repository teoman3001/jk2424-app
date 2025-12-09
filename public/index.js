// =========================
// GOOGLE AUTOCOMPLETE
// =========================
function initAutocomplete() {
    new google.maps.places.Autocomplete(
        document.getElementById("pickup"),
        { types: ["geocode"] }
    );
    new google.maps.places.Autocomplete(
        document.getElementById("extra_stop"),
        { types: ["geocode"] }
    );
    new google.maps.places.Autocomplete(
        document.getElementById("dropoff"),
        { types: ["geocode"] }
    );
}
window.onload = initAutocomplete;

// =========================
// DATE AUTO-FORMAT
// =========================
document.getElementById("date").addEventListener("input", function () {
    let v = this.value.replace(/\D/g, "");
    if (v.length >= 3 && v.length <= 4)
        this.value = v.slice(0, 2) + "/" + v.slice(2);
    else if (v.length > 4)
        this.value = v.slice(0, 2) + "/" + v.slice(2, 4) + "/" + v.slice(4, 8);
});

// =========================
// TIME AUTO-FORMAT
// =========================
document.getElementById("time").addEventListener("input", function () {
    let v = this.value.replace(/\D/g, "");
    if (v.length >= 3)
        this.value = v.slice(0, 2) + ":" + v.slice(2, 4);
});

// =========================
// AM / PM SWITCH
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
        alert("Please enter both pickup and dropoff locations.");
        return;
    }

    const query = new URLSearchParams({
        pickup,
        dropoff,
        stop: document.getElementById("extra_stop").value.trim(),
    });

    try {
        const res = await fetch(`/api/calc-price?${query.toString()}`);
        const data = await res.json();

        if (!data || !data.distance || !data.total) {
            alert("Invalid calculation response.");
            return;
        }

        document.getElementById("distanceText").textContent = data.distance + " miles";
        document.getElementById("totalText").textContent = "$" + data.total;

        document.getElementById("estimateBox").classList.remove("hidden");
        document.getElementById("step2").classList.remove("hidden");

    } catch (err) {
        console.error(err);
        alert("Price calculation failed.");
    }
});

// =========================
// SEND RESERVATION
// =========================
document.getElementById("sendBtn").addEventListener("click", async () => {
    const reservation = {
        pickup: document.getElementById("pickup").value.trim(),
        extra_stop: document.getElementById("extra_stop").value.trim(),
        dropoff: document.getElementById("dropoff").value.trim(),
        date: document.getElementById("date").value.trim(),
        time: document.getElementById("time").value.trim(),
        period: selectedPeriod,
        fullname: document.getElementById("fullname").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        email: document.getElementById("email").value.trim(),
        notes: document.getElementById("notes").value.trim(),
    };

    try {
        const res = await fetch("/save-reservation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reservation),
        });

        const data = await res.json();
        document.getElementById("resultMessage").textContent = data.message;
        document.getElementById("resultMessage").style.color = "#f5d05c";

    } catch (err) {
        console.error(err);
        alert("Failed to send reservation.");
    }
});
