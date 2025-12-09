// =========================
// JK2424 - INDEX.JS (C MODE)
// Modernized version with full backward compatibility
// =========================

// -------------------------
// Google Autocomplete Init
// -------------------------
let pickupAutocomplete, extraAutocomplete, dropoffAutocomplete;

function initAutocomplete() {
    const pickup = document.getElementById("pickup");
    const extra = document.getElementById("extra_stop");
    const dropoff = document.getElementById("dropoff");

    pickupAutocomplete = new google.maps.places.Autocomplete(pickup, {
        types: ["geocode"]
    });
    extraAutocomplete = new google.maps.places.Autocomplete(extra, {
        types: ["geocode"]
    });
    dropoffAutocomplete = new google.maps.places.Autocomplete(dropoff, {
        types: ["geocode"]
    });
}


// -------------------------
// Auto-format DATE (MMDDYYYY → MM/DD/YYYY)
// -------------------------
const dateInput = document.getElementById("date");
dateInput.addEventListener("input", function () {
    let v = this.value.replace(/\D/g, "");

    if (v.length >= 5)
        v = v.replace(/(\d{2})(\d{2})(\d{1,4})/, "$1/$2/$3");
    else if (v.length >= 3)
        v = v.replace(/(\d{2})(\d{1,2})/, "$1/$2");

    this.value = v;
});


// -------------------------
// Auto-format TIME (HHMM → HH:MM)
// -------------------------
const timeInput = document.getElementById("time");
timeInput.addEventListener("input", function () {
    let v = this.value.replace(/\D/g, "");

    if (v.length >= 3)
        v = v.replace(/(\d{2})(\d{1,2})/, "$1:$2");

    this.value = v.slice(0, 5);
});


// -------------------------
// Step 2 Hidden by Default
// -------------------------
const step2 = document.getElementById("step2");
if (step2) step2.style.display = "none";


// -------------------------
// AM / PM Buttons
// -------------------------
let selectedPeriod = "AM";

document.getElementById("amBtn").addEventListener("click", function () {
    selectedPeriod = "AM";
    this.classList.add("active");
    document.getElementById("pmBtn").classList.remove("active");
});

document.getElementById("pmBtn").addEventListener("click", function () {
    selectedPeriod = "PM";
    this.classList.add("active");
    document.getElementById("amBtn").classList.remove("active");
});


// -------------------------
// PRICE CALCULATION
// -------------------------
document.getElementById("calculateBtn").addEventListener("click", async function () {
    const pickup = document.getElementById("pickup").value.trim();
    const extra_stop = document.getElementById("extra_stop").value.trim();
    const dropoff = document.getElementById("dropoff").value.trim();
    const date = document.getElementById("date").value.trim();
    const time = document.getElementById("time").value.trim();

    if (!pickup || !dropoff || !date || !time) {
        alert("Please complete all required fields.");
        return;
    }

    const fullTime = `${time} ${selectedPeriod}`;

    try {
        const response = await fetch("/api/calc-price", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                pickup,
                extra_stop,
                dropoff,
                date,
                time: fullTime
            })
        });

        const data = await response.json();

        if (data.error) {
            alert("Error: " + data.error);
            return;
        }

        // Fiyat ekranı
        document.getElementById("calculated_price").innerText =
            `$${data.price} • Distance: ${data.distance} miles`;

        // STEP 2 GOES LIVE
        step2.style.display = "block";

        // Smooth scroll
        step2.scrollIntoView({ behavior: "smooth" });

    } catch (err) {
        alert("Server connection failed.");
        console.error(err);
    }
});


// -------------------------
// SEND RESERVATION
// -------------------------
document.getElementById("sendBtn").addEventListener("click", async function () {

    const fullName = document.getElementById("fullname").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const email = document.getElementById("email").value.trim();
    const notes = document.getElementById("notes").value.trim();

    if (!fullName || !phone) {
        alert("Please enter your name and phone number.");
        return;
    }

    try {
        const response = await fetch("/api/reservation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fullName,
                phone,
                email,
                notes
            })
        });

        const data = await response.json();

        if (data.success) {
            alert("Your reservation has been submitted!");
        } else {
            alert("Error submitting reservation.");
        }

    } catch (err) {
        alert("Could not send reservation.");
        console.error(err);
    }
});


// -------------------------
// LOAD GOOGLE AUTO
// -------------------------
window.initAutocomplete = initAutocomplete;

