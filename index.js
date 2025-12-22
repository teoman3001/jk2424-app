// ===============================
// JK2424 – FRONTEND PRICE LOGIC
// ===============================

// Elements
const step2Card = document.getElementById("step2-card");
const resultBox = document.getElementById("estimate-box");

step2Card.classList.add("hidden");
resultBox.classList.add("hidden");

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
        const response = await fetch(
            `https://jk2424-backend.onrender.com/calc?pickup=${encodeURIComponent(pickup)}&stop=${encodeURIComponent(stop)}&dropoff=${encodeURIComponent(dropoff)}`
        );

        const data = await response.json();

        if (!data.success) {
            alert("Price calculation failed.");
            return;
        }

        // Show result
        step2Card.classList.remove("hidden");
        resultBox.classList.remove("hidden");

        document.getElementById("miles").innerText = data.miles + " mi";
        document.getElementById("price").innerText = "$" + data.price;

    } catch (err) {
        console.error(err);
        alert("Server error while calculating price.");
    }
});
