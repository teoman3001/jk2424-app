const BACKEND = 'https://jk2424-backend.onrender.com';
let currentAmpm = 'AM';

window.addEventListener('DOMContentLoaded', () => {
    initMap();
    document.getElementById('amBtn').onclick = () => { currentAmpm = 'AM'; updateToggle(); };
    document.getElementById('pmBtn').onclick = () => { currentAmpm = 'PM'; updateToggle(); };

    if (typeof google !== 'undefined') {
        const opt = { componentRestrictions: { country: 'us' } };
        new google.maps.places.Autocomplete(document.getElementById('pickup'), opt);
        new google.maps.places.Autocomplete(document.getElementById('stop'), opt);
        new google.maps.places.Autocomplete(document.getElementById('dropoff'), opt);
    }
});

function initMap() {
    new google.maps.Map(document.getElementById("map"), {
        center: { lat: 38.9072, lng: -77.0369 }, zoom: 12, disableDefaultUI: true,
        styles: [ { "elementType": "geometry", "stylers": [ { "color": "#212121" } ] }, { "elementType": "labels.text.fill", "stylers": [ { "color": "#757575" } ] } ]
    });
}

function openSheet() { document.getElementById('sheet').classList.add('active'); }
function updateToggle() {
    document.getElementById('amBtn').className = currentAmpm === 'AM' ? 't-btn active' : 't-btn';
    document.getElementById('pmBtn').className = currentAmpm === 'PM' ? 't-btn active' : 't-btn';
}

async function calculatePrice() {
    const p = document.getElementById('pickup').value;
    const d = document.getElementById('dropoff').value;
    try {
        const res = await fetch(`${BACKEND}/calc?pickup=${encodeURIComponent(p)}&dropoff=${encodeURIComponent(d)}&isNight=${currentAmpm==='PM'}`);
        const data = await res.json();
        if(data.success) {
            document.getElementById('resDist').innerText = data.pricing.miles + " miles total";
            document.getElementById('resTotal').innerText = "$" + data.pricing.total.toFixed(2);
            document.getElementById('step1').style.display = 'none';
            document.getElementById('step2').style.display = 'block';
        }
    } catch (e) { alert("Error."); }
}
// sendBooking ve checkLastBooking fonksiyonları aynı kalacak.
