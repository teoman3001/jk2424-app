const BACKEND = 'https://jk2424-backend.onrender.com';
let currentAmpm = 'AM';
let lastQuote = null;

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('amBtn').onclick = () => { currentAmpm = 'AM'; document.getElementById('amBtn').classList.add('active'); document.getElementById('pmBtn').classList.remove('active'); };
    document.getElementById('pmBtn').onclick = () => { currentAmpm = 'PM'; document.getElementById('pmBtn').classList.add('active'); document.getElementById('amBtn').classList.remove('active'); };
    if (typeof google !== 'undefined') {
        const opt = { componentRestrictions: { country: 'us' } };
        new google.maps.places.Autocomplete(document.getElementById('pickup'), opt);
        new google.maps.places.Autocomplete(document.getElementById('stop'), opt);
        new google.maps.places.Autocomplete(document.getElementById('dropoff'), opt);
    }
});

function goBack() {
    document.getElementById('sectionStep2').classList.add('hidden');
    document.getElementById('estimateResultArea').classList.add('hidden');
    document.getElementById('sectionStep1').classList.remove('hidden');
    document.getElementById('headerBack').style.visibility = 'hidden';
}

function checkLastBooking() {
    const id = localStorage.getItem("jk2424_booking_id");
    if(id) window.location.href = "track.html?id=" + id;
    else alert("No active booking found.");
}

async function calculatePrice() {
    const btn = document.getElementById('calcBtn');
    const p = document.getElementById('pickup').value;
    const d = document.getElementById('dropoff').value;
    const t = document.getElementById('rideTime').value;

    if(!p || !d || t.length < 5) return alert("Complete details.");

    try {
        btn.innerText = "Processing..."; btn.disabled = true;
        const hr = parseInt(t.split(':')[0]);
        let finalHr = (currentAmpm === 'PM' && hr !== 12) ? hr + 12 : (currentAmpm === 'AM' && hr === 12) ? 0 : hr;
        const isNight = (finalHr >= 22 || finalHr < 5);

        // API ÇAĞRISI
        const res = await fetch(`${BACKEND}/calc?pickup=${encodeURIComponent(p)}&dropoff=${encodeURIComponent(d)}&stop=${encodeURIComponent(document.getElementById('stop').value)}&isNight=${isNight}`);
        
        if (!res.ok) throw new Error("Server error");
        const data = await res.json();
        
        // GÜVENLİ VERİ OKUMA (toFixed Hatasını Çözer)
        if(data.success && data.pricing) {
            const pricing = data.pricing;
            lastQuote = { pickup:p, dropoff:d, stop:document.getElementById('stop').value, rideDate:document.getElementById('rideDate').value, rideTime:t, ampm:currentAmpm, total:pricing.total, miles:pricing.miles };
            
            // 3. RESİM DETAYLARI
            document.getElementById('resDist').innerText = (pricing.miles || 0) + " miles";
            document.getElementById('resBase').innerText = "$65 (inc. 10 mi)";
            document.getElementById('resExtra').innerText = pricing.extraCost ? `$${pricing.extraCost.toFixed(2)} (${pricing.extraMiles} mi x $2.00)` : "$0.00";
            document.getElementById('resNight').innerText = pricing.nightApplied ? "Yes (x1.25)" : "No";
            document.getElementById('resTotal').innerText = pricing.total ? "$" + pricing.total.toFixed(2) : "$0.00";
            
            document.getElementById('sumTripInfo').innerText = `Pickup: ${p}\nDrop-off: ${d}\nSchedule: ${lastQuote.rideDate} @ ${t} ${currentAmpm}\nTotal Price: $${(pricing.total || 0).toFixed(2)}`;
            
            document.getElementById('sectionStep1').classList.add('hidden');
            document.getElementById('estimateResultArea').classList.remove('hidden');
            document.getElementById('sectionStep2').classList.remove('hidden');
            document.getElementById('headerBack').style.visibility = 'visible';
            window.scrollTo(0,0);
        } else {
            throw new Error("Invalid pricing data");
        }
    } catch (e) { 
        console.error("Calculate Error:", e);
        alert("Server is waking up. Please wait 10 seconds and try again."); 
    } finally { btn.innerText = "Calculate Price"; btn.disabled = false; }
}

async function sendBooking() {
    const btn = document.getElementById('bookBtn');
    if(!document.getElementById('fullName').value) return alert("Name required.");
    try {
        btn.innerText = "Sending..."; btn.disabled = true;
        const res = await fetch(`${BACKEND}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...lastQuote, customerName: document.getElementById('fullName').value, customerPhone: document.getElementById('phone').value })
        });
        const data = await res.json();
        if(data.success) {
            localStorage.setItem("jk2424_booking_id", data.booking.id);
            window.location.href = "track.html?id=" + data.booking.id;
        }
    } catch (e) { alert("Failed."); } finally { btn.innerText = "Confirm Booking"; btn.disabled = false; }
}
