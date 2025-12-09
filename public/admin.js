// JK2424 ADMIN PANEL JS
// Pricing ayarları + rezervasyon listesi

// TÜM API istekleri için backend base URL
const API_BASE = 'https://jk2424-backend.onrender.com';

async function loadPricing() {
  const statusEl = document.getElementById('pricingStatus');
  statusEl.textContent = 'Loading pricing...';
  statusEl.className = 'status';

  try {
    const res = await fetch(`${API_BASE}/api/admin/pricing`);
    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.message || 'Could not load pricing.');
    }

    const s = data.settings || {};

    document.getElementById('baseFare').value = s.baseFare ?? 65;
    document.getElementById('includedMiles').value = s.includedMiles ?? 15;
    document.getElementById('extraPerMile').value = s.extraPerMile ?? 2;
    document.getElementById('minimumFare').value =
      s.minimumFare ?? s.baseFare ?? 65;
    document.getElementById('nightMultiplier').value =
      s.nightMultiplier ?? 1.25;

    statusEl.textContent = 'Pricing loaded.';
    statusEl.className = 'status ok';
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Error loading pricing.';
    statusEl.className = 'status err';
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
    nightMultiplier: Number(
      document.getElementById('nightMultiplier').value
    ),
  };

  btn.disabled = true;
  statusEl.textContent = 'Saving...';
  statusEl.className = 'status';

  try {
    const res = await fetch(`${API_BASE}/api/admin/pricing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.message || 'Could not save pricing.');
    }

    statusEl.textContent = 'Pricing saved.';
    statusEl.className = 'status ok';
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Error saving pricing.';
    statusEl.className = 'status err';
  } finally {
    btn.disabled = false;
  }
}

const STATUS_OPTIONS = [
  'pending',
  'confirmed',
  'paid',
  'on_the_way',
  'arrived',
  'completed',
  'cancelled',
];

function renderStatusPill(status) {
  const span = document.createElement('span');
  span.className = 'pill-status ' + status;
  span.textContent = status.replace(/_/g, ' ');
  return span;
}

async function loadBookings() {
  const tbody = document.getElementById('bookingsBody');
  tbody.innerHTML = '<tr><td colspan="7">Loading bookings...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/api/admin/bookings`);
    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.message || 'Could not load bookings.');
    }

    const bookings = data.bookings || [];
    if (!bookings.length) {
      tbody.innerHTML =
        '<tr><td colspan="7">No bookings found.</td></tr>';
      return;
    }

    tbody.innerHTML = '';

    bookings.forEach((b) => {
      const tr = document.createElement('tr');

      // ID
      const tdId = document.createElement('td');
      tdId.textContent = b.id;
      tr.appendChild(tdId);

      // Created
      const tdCreated = document.createElement('td');
      tdCreated.textContent = b.created_at
        ? new Date(b.created_at).toLocaleString()
        : '-';
      tr.appendChild(tdCreated);

      // Trip
      const tdTrip = document.createElement('td');
      tdTrip.innerHTML =
        `<strong>${b.pickup}</strong>` +
        (b.stop ? `<br/><small>Stop: ${b.stop}</small>` : '') +
        `<br/><small>→ ${b.dropoff}</small>` +
        `<br/><small>${b.ride_date} · ${b.ride_time} ${b.ampm}</small>`;
      tr.appendChild(tdTrip);

      // Customer
      const tdCustomer = document.createElement('td');
      tdCustomer.innerHTML =
        `<strong>${b.customer_name}</strong>` +
        `<br/><small>${b.customer_phone}</small>` +
        `<br/><small>${b.customer_email}</small>` +
        (b.notes ? `<br/><small>Notes: ${b.notes}</small>` : '');
      tr.appendChild(tdCustomer);

      // Miles
      const tdMiles = document.createElement('td');
      tdMiles.textContent =
        (b.miles != null ? Number(b.miles).toFixed(2) : '-') + ' mi';
      tr.appendChild(tdMiles);

      // Total
      const tdTotal = document.createElement('td');
      tdTotal.textContent =
        b.total != null ? `$${Number(b.total).toFixed(2)}` : '-';
      tr.appendChild(tdTotal);

      // Status + select
      const tdStatus = document.createElement('td');

      const pill = renderStatusPill(b.status || 'pending');
      tdStatus.appendChild(pill);
      tdStatus.appendChild(document.createElement('br'));

      const select = document.createElement('select');
      select.dataset.id = b.id;
      STATUS_OPTIONS.forEach((opt) => {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt.replace(/_/g, ' ');
        if (opt === b.status) o.selected = true;
        select.appendChild(o);
      });
      tdStatus.appendChild(select);

      tr.appendChild(tdStatus);
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    tbody.innerHTML =
      '<tr><td colspan="7">Error loading bookings.</td></tr>';
  }
}

async function updateBookingStatus(id, status) {
  try {
    const res = await fetch(
      `${API_BASE}/api/admin/bookings/${id}/status`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }
    );
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.message || 'Could not update status.');
    }
    // Listeyi yenile
    await loadBookings();
  } catch (err) {
    console.error(err);
    alert('Error updating status. Check console/logs.');
  }
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
  // Pricing
  const btn = document.getElementById('savePricingBtn');
  if (btn) {
    btn.addEventListener('click', savePricing);
  }

  // Status dropdown dinleyicisi
  const tbody = document.getElementById('bookingsBody');
  if (tbody) {
    tbody.addEventListener('change', (e) => {
      const target = e.target;
      if (target.tagName === 'SELECT') {
        const id = target.dataset.id;
        const value = target.value;
        if (id && value) {
          updateBookingStatus(id, value);
        }
      }
    });
  }

  // İlk yükleme
  loadPricing();
  loadBookings();
});
