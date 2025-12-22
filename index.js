// ===============================
// JK2424 – FRONTEND PRICE LOGIC
// ===============================

// Elements
const step2Card = document.getElementById("step2-card");
const resultBox = document.getElementById("estimate-box");
const calculateBtn = document.getElementById("calculateBtn");

step2Card.classList.add("hidden");
resultBox.classList.add("hidden");

// ===============================
// CALCULATE PRICE
// ===============================

calculateBtn.addEventListener("click", async () => {
    const pickup = document.getElementById("pickup").value.trim();
    const stop = document.getElementById("extra_stop").value.trim();
    const dropoff = document.getElementById("dropoff").value.trim();

    if (!pickup || !dropoff) {
        alert("Please enter pickup and drop-off locations.");
        return;
    }

    // 🔒 Backend endpoint (TEK ve NET)
    const API_URL = "https://jk2424-backend.onrender.com/calc";

    // 🔗 Query string
    const query = new URLSearchParams({
        pickup,
        dropoff,
        stop
    }).toString();

    try {
        const response = await fetch(`${API_URL}?${query}`);

        // ❗ HTML gelirse burada yakalar
        if (!response.ok) {
            throw new Error("Backend response not OK");
        }

        const data = await response.json();

        if (!data.success) {
            alert("Price calculation failed.");
            return;
        }

        // ✅ Show result
        step2Card.classList.remove("hidden");
        resultBox.classList.remove("hidden");

        document.getElementById("miles").innerText = `${data.miles} mi`;
        document.getElementById("price").innerText = `$${data.price}`;

    } catch (error) {
        console.error("CALC ERROR:", error);
        alert("Server error while calculating price.");
    }
});
