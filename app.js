// JK2424 CORE LOGIC
const BACKEND = 'https://jk2424-backend.onrender.com';
let currentAmpm = 'AM';
let lastQuote = null;

// NAVIGATION
function goBack() {
  document.getElementById('sectionStep2').classList.add('hidden');
  document.getElementById('sectionStep1').classList.remove('hidden');
  document.getElementById('headerBack').style.visibility = 'hidden';
}

function checkLastBooking() {
  const id = localStorage.getItem("jk2424_booking_id");
  if(id) window.location.href = "track.html?id=" + id;
  else alert("No active booking found.");
}

// PRICING ENGINE
async function calculatePrice() {
  const btn = document.getElementById('calcBtn');
  const p = document.getElementById('pickup').value;
  const d = document.getElementById('dropoff').value;
  const t = document.getElementById('rideTime').value;

  if(!p || !d || t.length < 5) return alert("Complete all fields.");

  try {
    btn.innerText = "Processing..."; btn.disabled = true;
    const hr = parseInt(t.split(':')[0]);
    let finalHr = (currentAmpm === 'PM' && hr !== 12) ? hr + 12 : (currentAmpm === 'AM' && hr === 12) ? 0 : hr;
    const isNight = (finalHr >= 22 || finalHr < 5);

    const res = await fetch(`${BACKEND}/calc?pickup=${encodeURIComponent(p)}&dropoff=${encodeURIComponent(d)}&stop=${encodeURIComponent(document.getElementById('stop').value)}&isNight=${isNight}`);
    const data = await res.json();
    
    if(data.success) {
      lastQuote = { pickup:p, dropoff:d, stop:document.getElementById('stop').value, rideDate:document.getElementById('rideDate').value, rideTime:t, ampm:currentAmpm, total:data.pricing.total, miles:data.pricing.miles };
      
      document.getElementById('sumRoute').innerText = `From: ${p} → To: ${d}`;
      document.getElementById('sumTime').innerText = `At: ${lastQuote.rideDate} @ ${t} ${currentAmpm}`;
      document.getElementById('sumTotal').innerText = `$${data.pricing.total.toFixed(2)}`;
      
      document.getElementById('sectionStep1').classList.add('hidden');
      document.getElementById('sectionStep2').classList.remove('hidden');
      document.getElementById('headerBack').style.visibility = 'visible';
    }
  } catch (e) { alert("Error connecting to server."); } 
  finally { btn.innerText = "Calculate Price"; btn.disabled = false; }
}

// BOOKING
async function sendBooking() {
  const btn = document.getElementById('bookBtn');
  const name = document.getElementById('fullName').value;
  const phone = document.getElementById('phone').value;
  if(!name || !phone) return alert("Missing info.");

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
  } catch (e) { alert("Failed to send reservation."); }
}
