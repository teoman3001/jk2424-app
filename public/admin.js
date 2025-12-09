// JK2424 ADMIN PANEL JS
// Basit rezervasyon listesi + status değiştirme

// Tüm istekler için backend base URL
const API_BASE = 'https://jk2424-backend.onrender.com/api';

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
  span.className = 'pill-status ' + (status || 'pending');
  span.textContent = (status || 'pending').replace(/_/g, ' ');
  return span;
}

async function loadBookings() {
  const tbody = document.getElementById('bookingsBody');
  if (!tbody) return;

  tbody.innerHTML = '<tr><td colspan="7">Loading bookings...</td></tr>';

  try {
    const res = await fetch(`${API_BASE}/bookings`);
    const data = await res.json();

    if (!res.ok || !data.ok) {
      throw new Error(data.error || data.message || 'Could not load bookings.');
    }

    const bookings = data.bookings || [];
    if (!bookings.length) {
      tbody.innerHTML = '<tr><td colspan="7">No bookings found.</td></tr>';
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

      // Trip (pickup / stop / dropoff + datetime)
      const tdTrip = document.createElement('td');
      tdTrip.innerHTML =
        `<strong>${b.pickup_address || b.pickup || '-'}</strong>` +
        (b.stop ? `<br/><small>Stop: ${b.stop}</small>` : '') +
        `<br/><small>→ ${b.dropoff_address || b.dropoff || '-'}</small>` +
        (b.pickup_datetime
          ? `<br/><small>${new Date(b.pickup_datetime).toLocaleString()}</small>`
          : '');
      tr.appendChild(tdTrip);

      // Customer
      const tdCustomer = document.createElement('td');
      tdCustomer.innerHTML =
        `<strong>${b.passenger_name || b.customer_name || '-'}</strong>` +
        (b.notes ? `<br/><small>${b.notes}</small>` : '');
      tr.appendChild(tdCustomer);

      // Miles (şimdilik DB’de yok → boş geçiyoruz)
      const tdMiles = document.createElement('td');
      tdMiles.textContent = b.miles != null
        ? Number(b.miles).toFixed(2) + ' mi'
        : '-';
      tr.appendChild(tdMiles);

      // Total (estimated_price)
      const tdTotal = document.createElement('td');
      if (b.estimated_price != null) {
        tdTotal.textContent = '$' + Number(b.estimated_price).toFixed(2);
      } else if (b.total != null) {
        tdTotal.textContent = '$' + Number(b.total).toFixed(2);
      } else {
        tdTotal.textContent = '-';
      }
      tr.appendChild(tdTotal);

      // Status + dropdown
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
        if (opt === (b.status || 'pending')) o.selected = true;
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
    const res = await fetch(`${API_BASE}/bookings/${id}/status`, {
      method: 'POST', // server.js şu an POST kullanıyor
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || data.message || 'Could not update status.');
    }
    await loadBookings();
  } catch (err) {
    console.error(err);
    alert('Error updating status. Check logs.');
  }
}

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
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

  loadBookings();
});
