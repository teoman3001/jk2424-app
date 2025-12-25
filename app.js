// app.js
const BACKEND = 'https://jk2424-backend.onrender.com';
let currentAmpm = 'AM';
let lastQuote = null;

window.addEventListener('DOMContentLoaded', () => {
    // AM/PM Butonlarını Bağla
    document.getElementById('amBtn').onclick = () => { currentAmpm = 'AM'; document.getElementById('amBtn').classList.add('active'); document.getElementById('pmBtn').classList.remove('active'); };
    document.getElementById('pmBtn').onclick = () => { currentAmpm = 'PM'; document.getElementById('pmBtn').classList.add('active'); document.getElementById('amBtn').classList.remove('active'); };

    // Google Autocomplete'i Başlat
    if (typeof google !== 'undefined') {
        const opt = { componentRestrictions: { country: 'us' } };
        new google.maps.places.Autocomplete(document.getElementById('pickup'), opt);
        new google.maps.places.Autocomplete(document.getElementById('stop'), opt);
        new google.maps.places.Autocomplete(document.getElementById('dropoff'), opt);
    }
});

// Tarih Formatlayıcı
document.getElementById('rideDate').oninput = (e) => {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 2) v = v.slice(0,2) + '/' + v.slice(2);
    if (v.length > 5) v = v.slice(0,5) + '/' + v.slice(5,9);
    e.target.value = v.slice(0,10);
};

function goBack() {
    document.getElementById('sectionStep2').classList.add('hidden');
    document.getElementById('sectionStep1').classList.remove('hidden');
    document.getElementById('headerBack').style.visibility = 'hidden';
    window.scrollTo(0,0);
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
    const date = document.getElementById('rideDate').value;

    if(!p || !d || t.length < 5) return alert("Please complete trip details.");

    try {
        btn.innerText = "Processing..."; btn.disabled = true;
        const hr = parseInt(t.split(':')[0]);
        let finalHr = (currentAmpm === 'PM' && hr !== 12) ? hr + 12 : (currentAmpm === 'AM' && hr === 12) ? 0 : hr;
        const isNight = (finalHr >= 22 || finalHr < 5);

        const res = await fetch(`${BACKEND}/calc?pickup=${encodeURIComponent(p)}&dropoff=${encodeURIComponent(d)}&stop=${encodeURIComponent(document.getElementById('stop').value)}&isNight=${isNight}`);
        const data = await res.json();
        
        if(data.success) {
            lastQuote = { pickup:p, dropoff:d, stop:document.getElementById('stop').value, rideDate:date, rideTime:t, ampm:currentAmpm, total:data.pricing.total, miles:data.pricing.miles };
            
            // Step 2 Özetini Güncelle
            document.getElementById('sumRoute').innerText = `Pickup: ${p}\nDrop-off: ${d}`;
            document.getElementById('sumTime').innerText = `Schedule: ${date} @ ${t} ${currentAmpm}`;
            document.getElementById('sumTotal').innerText = `$${data.pricing.total.toFixed(2)}`;
            
            // Ekranları Değiştir
            document.getElementById('sectionStep1').classList.add('hidden');
            document.getElementById('sectionStep2').classList.remove('hidden');
            document.getElementById('headerBack').style.visibility = 'visible';
            window.scrollTo(0,0);
        }
    } catch (e) { alert("Server error."); } finally { btn.innerText = "Calculate Price"; btn.disabled = false; }
}

async function sendBooking() {
    const btn = document.getElementById('bookBtn');
    const name = document.getElementById('fullName').value;
    const phone = document.getElementById('phone').value;
    if(!name || !phone) return alert("Name and Phone required.");

    try {
        btn.innerText = "Sending..."; btn.disabled = true;
        const res = await fetch(`${BACKEND}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...lastQuote, customerName: name, customerPhone: phone, customerEmail: document.getElementById('email').value, notes: document.getElementById('notes').value })
        });
        const data = await res.json();
        if(data.success) {
            localStorage.setItem("jk2424_booking_id", data.booking.id);
            window.location.href = "track.html?id=" + data.booking.id;
        }
    } catch (e) { alert("Failed."); } finally { btn.innerText = "Confirm Booking"; btn.disabled = false; }
}
