// ===============================
// JK2424 – FRONTEND PRICE LOGIC
// ===============================

// Elements
const step1Card = document.getElementById("step1-card");
const step2Card = document.getElementById("step2-card");
const resultBox = document.getElementById("estimate-box");

resultBox.classList.add("hidden");
step2Card.classList.add("hidden");

// ===============================
// GOOGLE AUTOCOMPLETE
// ===============================

let pickupAutocomplete, stopAutocomplete, dropoffAutocomplete;

function initAutocomplete() {
    pickupAutocomplete = new google.maps.places.Autocomplete(
        document.getElementById("pickup"),
        { types: ["geocode"] }
    );

    stopAutocomplete = new google.maps.places.Autocomplete(
        document.getElementById("extra_stop"),
        { types: ["geocode"] }
    );

    dropoffAutocomplete = new google.maps.places.Autocomplete(
        document.getElementById("dropoff"),
        { types: ["geocode"] }
    );
}

// ===============================
// PRICE CALCULATION (BACKEND)
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
        const response = await fetch(
            `https://jk2424-backend.onrender.com/calc?pickup=${encodeURIComponent(
                pickup
            )}&stop=${encodeURIComponent(stop)}&dropoff=${encodeURIComponent(dropoff)}`
        );

        const data = await response.json();

        if (!data.success) {
            alert(data.error || "Unable to calculate price.");
            return;
        }

        // Show STEP 2
        step2Card.classList.remove("hidden");
        resultBox.classList.remove("hidden");

        // Display results
        document.getElementById("miles").innerText = `${data.miles} mi`;
        document.getElementById("price").innerText = `$${data.price}`;

    } catch (error) {
        console.error("Calculation error:", error);
        alert("A server error occurred.");
    }
});

// ===============================
// AM / PM BUTTONS
// ===============================

function selectAMPM(value) {
    const amBtn = document.getElementById("amBtn");
    const pmBtn = document.getElementById("pmBtn");

    if (value === "AM") {
        amBtn.classList.add("active");
        pmBtn.classList.remove("active");
    } else {
        pmBtn.classList.add("active");
        amBtn.classList.remove("active");
    }
}
