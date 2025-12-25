// JK2424 ADMIN PANEL JS - INDEPENDENT OPS VERSION
const API_BASE = 'https://jk2424-backend.onrender.com';

// --- PRICING ENGINE ---
async function loadPricing() {
    const statusEl = document.getElementById('pricingStatus');
    if (statusEl) {
        statusEl.textContent = 'Loading pricing...';
        statusEl.className = 'status';
    }

    try {
        const res = await fetch(`${API_BASE}/api/admin/pricing`);
        const data = await res.json();

        if (!res.ok || !data.ok) throw new Error(data.message || 'Could not load pricing.');

        const s = data.settings || {};
        document.getElementById('baseFare').value = s.baseFare ?? 65;
        document.getElementById('includedMiles').value = s.includedMiles ?? 15;
        document.getElementById('extraPerMile').value = s.extraPerMile ?? 2;
        document.getElementById('minimumFare').value = s.minimumFare ?? s.baseFare ?? 65;
        document.getElementById('nightMultiplier').value = s.nightMultiplier ?? 1.25;

        if (statusEl) {
            statusEl.textContent = 'Pricing loaded.';
            statusEl.className = 'status ok';
        }
    } catch (err) {
        console.error(err);
        if (statusEl) {
            statusEl.textContent = 'Error loading pricing.';
            statusEl.className = 'status err';
        }
    }
}

async function savePricing() {
    const btn = document.getElementById('savePricingBtn');
    const statusEl = document.getElementById('pricingStatus');

    const payload = {
        baseFare: Number(document.getElementById('baseFare').value),
        includedMiles: Number(document.getElementById('includedMiles').value),
        extraPerMile: Number(document.getElementById('extraPerMile').value),
        minimumFare: Number(document.getElementById('minimumFare').value),
        nightMultiplier: Number(document.getElementById('nightMultiplier').value),
    };

    if (btn) btn.disabled = true;
    if (statusEl) {
        statusEl.textContent = 'Saving...';
        statusEl.className = 'status';
    }

    try {
        const res = await fetch(`${API_BASE}/api/admin/pricing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.message || 'Could not save pricing.');

        if (statusEl) {
            statusEl.textContent = 'Pricing saved.';
            statusEl.className = 'status ok';
        }
    } catch (err) {
        console.error(err);
        if (statusEl) {
            statusEl.textContent = 'Error saving pricing.';
            statusEl.className = 'status err';
        }
    } finally {
        if (btn) btn.disabled = false;
    }
}

// --- INDEPENDENT STATUS ENGINE ---
// Müşteri tarafındaki yeni sayfaları tetikleyen statüler eklendi
const STATUS_OPTIONS = [
    'pending',
    'Approved',          // Müşteriye Ödeme Seçim sayfasını açar
    'PaymentRequested',  // Müşteriye direkt Zelle sayfasını açar
    'Confirmed',         // Müşteriye Rezervasyon Kesinleşti sayfasını açar
    'Completed',
    'cancelled',
];

async function loadBookings() {
    const tbody = document.getElementById('bookingsBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7">Loading bookings...</td></tr>';

    try {
        const res = await fetch(`${API_BASE}/api/admin/bookings`);
        const data = await res.json();

        if (!res.ok || !data.ok) throw new Error(data.message || 'Could not load bookings.');

        const bookings = data.bookings || [];
        if (!bookings.length) {
            tbody.innerHTML = '<tr><td colspan="7">No bookings found.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        bookings.forEach((b) => {
            const tr = document.createElement('tr');
            
            // Trip Info Cell
            const tdTrip = document.createElement('td');
            tdTrip.innerHTML = `<strong>${b.pickup}</strong><br/><small>→ ${b.dropoff}</small><br/><small>${b.ride_date} · ${b.ride_time} ${b.ampm}</small>`;
            tr.appendChild(tdTrip);

            // Customer Info Cell
            const tdCustomer = document.createElement('td');
            tdCustomer.innerHTML = `<strong>${b.customer_name}</strong><br/><small>${b.customer_phone}</small>${b.notes ? `<br/><small style="color:#f5d05c">Note: ${b.notes}</small>` : ''}`;
            tr.appendChild(tdCustomer);

            // Total Cell
            const tdTotal = document.createElement('td');
            tdTotal.textContent = b.total != null ? `$${Number(b.total).toFixed(2)}` : '-';
            tr.appendChild(tdTotal);

            // Status Control Cell (ZİNCİRİ KIRAN YENİ YAPI)
            const tdStatus = document.createElement('td');
            const select = document.createElement('select');
            select.style.padding = "5px";
            select.style.borderRadius = "5px";
            select.style.background = "#000";
            select.style.color = "#f5d05c";
            select.style.border = "1px solid #333";

            STATUS_OPTIONS.forEach((opt) => {
                const o = document.createElement('option');
                o.value = opt;
                o.textContent = opt.charAt(0).toUpperCase() + opt.slice(1).replace(/_/g, ' ');
                if (opt === b.status) o.selected = true;
                select.appendChild(o);
            });

            // Seçim değiştiğinde direkt bağımsız update fonksiyonunu çağırır
            select.onchange = (e) => updateIndependentStatus(b.id, e.target.value);
            
            tdStatus.appendChild(select);
            tr.appendChild(tdStatus);
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="7">Error loading bookings.</td></tr>';
    }
}

// ZİNCİRİ KIRAN BAĞIMSIZ GÜNCELLEME FONKSİYONU
async function updateIndependentStatus(id, newStatus) {
    try {
        // PATCH yerine yeni POST endpoint'ini kullanarak zinciri kırıyoruz
        const res = await fetch(`${API_BASE}/update-booking`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, status: newStatus }),
        });
        
        const data = await res.json();
        if (res.ok && data.success) {
            console.log(`Status updated to ${newStatus}. Customer screen will update.`);
            await loadBookings(); // Listeyi tazele
        } else {
            alert("Update failed on server.");
        }
    } catch (err) {
        console.error(err);
        alert('Connection error. Could not update status.');
    }
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
    loadPricing();
    loadBookings();
    // Her 15 saniyede bir yeni siparişleri kontrol et
    setInterval(loadBookings, 15000);
});
