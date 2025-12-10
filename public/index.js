// =========================
// GOOGLE AUTOCOMPLETE
// =========================
function initAutocomplete() {
    const opts = { types: ["geocode"] };

    new google.maps.places.Autocomplete(document.getElementById("pickup"), opts);
    new google.maps.places.Autocomplete(document.getElementById("extra_stop"), opts);
    new google.maps.places.Autocomplete(document.getElementById("dropoff"), opts);
}

google.maps.event.addDomListener(window, "load", initAutocomplete);

// =========================
// AUTO DATE FORMAT
// =========================
document.getElementById("date").addEventListener("input", function () {
    let v = this.value.replace(/\D/g, "");
    if (v.length >= 3 && v.length <= 4) this.value = v.slice(0,2) + "/" + v.slice(2);
    else if (v.length > 4) this.value = v.slice(0,2) + "/" + v.slice(2,4) + "/" + v.slice(4,8);
});

// =========================
// AUTO TIME FORMAT (12-HOUR)
// =========================
document.getElementById("time").addEventListener("input", function () {
    let v = this.value.replace(/\D/g, "");
    if (v.length >= 3) this.value = v.slice(0,2) + ":" + v.slice(2,4);
});

// AM/PM
let selectedPeriod = "PM";
document.getElementById("amBtn").onclick = () => {
    selectedPeriod = "AM";
    amBtn.classList.add("active");
    pmBtn.classList.remove("active");
};
document.getElementById("pmBtn").onclick = () => {
    selectedPeriod = "PM";
    pmBtn.classList.add("active");
    amBtn.classList.remove("active");
};

// =========================
// CALCULATE PRICE
// =========================
document.getElementById("calculateBtn").onclick = async () => {
    const pickup = pickup.value.trim();
    const dropoff = dropoff.value.trim();

    if (!pickup || !dropoff) {
        alert("Please enter pickup and dropoff.");
        return;
    }

    const params = new URLSearchParams({
        pickup,
        dropoff,
        extra: extra_stop.value.trim(),
        date: date.value.trim(),
        time: time.value.trim(),
        period: selectedPeriod
    });

    const res = await fetch(`https://jk2424-backend.onrender.com/api/calc?${params}`);
    const data = await res.json();

    if (!data.ok) {
        alert("Could not calculate price.");
        return;
    }

    distanceText.textContent = data.distance;
    totalText.textContent = "$" + data.total;

    estimateBox.classList.remove("hidden");
    step2.classList.remove("hidden");
};

// =========================
// SEND RESERVATION
// =========================
document.getElementById("sendBtn").onclick = async () => {
    const body = {
        pickup: pickup.value.trim(),
        extra_stop: extra_stop.value.trim(),
        dropoff: dropoff.value.trim(),
        date: date.value.trim(),
        time: time.value.trim(),
        period: selectedPeriod,
        fullname: fullname.value.trim(),
        phone: phone.value.trim(),
        email: email.value.trim(),
        notes: notes.value.trim(),
    };

    const res = await fetch("https://jk2424-backend.onrender.com/api/reserve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });

    const data = await res.json();
    resultMessage.textContent = data.message;
    resultMessage.style.color = "#f9d25a";
};
