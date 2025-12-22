// ===============================
// JK2424 – FRONTEND PRICE LOGIC
// ===============================

// Elements
const step2Card = document.getElementById("step2-card");
const resultBox = document.getElementById("estimate-box");

step2Card.classList.add("hidden");
resultBox.classList.add("hidden");

// ===============================
// BACKEND API CONFIG
// ===============================
const API_URL = "https://jk2424-backend.onrender.com/calc";

// ===============================
// CALCULATE PRICE
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
        // Build query string safely
        const params = new URLSearchParams({
            pickup: pickup,
            dropoff: dropoff,
            stop: stop || ""
        });

        const response = await fetch(`${API_URL}?${params.toString()}`);

        if (!response.ok) {
            throw new Error("Backend request failed");
        }

        const data = await response.json();

        if (!data.success) {
            alert("Price calculation failed.");
            return;
        }

        // Show result
        step2Card.classList.remove("hidden");
        resultBox.classList.remove("hidden");

        document.getElementById("miles").innerText = `${data.miles} mi`;
        document.getElementById("price").innerText = `$${data.price}`;

    } catch (error) {
        console.error("Calculation error:", error);
        alert("Server error while calculating price.");
    }
});
