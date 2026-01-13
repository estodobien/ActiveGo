/*
  admin-bookings.js
  ADMIN ONLY

  Назначение:
  - просмотр всех бронирований
  - контакты клиента и поставщика
  - отмена бронирования администратором
  - фильтры по статусу и датам

  ❗ Работает ТОЛЬКО через Netlify Functions
  ❗ Supabase в браузере НЕ используется
*/

let allBookings = [];
let cancelInProgress = false;

waitForAdminReady(async () => {
  await loadBookings();
  bindFilters();
});

/* =========================
   LOAD BOOKINGS (ADMIN)
========================= */

async function loadBookings() {
  try {
    const res = await fetch('/.netlify/functions/admin-bookings-get');
    if (!res.ok) throw new Error('Failed to load bookings');

    const data = await res.json();
    allBookings = Array.isArray(data) ? data : [];
    renderBookings(allBookings);
  } catch (err) {
    console.error('[ADMIN][BOOKINGS][LOAD]', err);
    alert('Не удалось загрузить бронирования');
  }
}

/* =========================
   RENDER
========================= */

function renderBookings(bookings) {
  const tbody = document.getElementById('bookingsBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!bookings.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">Бронирования не найдены</td>
      </tr>
    `;
    return;
  }

  bookings.forEach(booking => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>#${booking.id}</td>

      <td>${safeText(booking.service?.title)}</td>

      <td class="contacts">
        ${renderContacts(booking.client)}
      </td>

      <td class="contacts">
        ${renderContacts(booking.provider)}
      </td>

      <td>${formatDate(booking.booking_date)}</td>

      <td>
        <span class="status ${statusClass(booking.status)}">
          ${booking.status}
        </span>
      </td>

      <td>${formatPrice(booking.total_price)}</td>

      <td class="actions">
        ${renderActions(booking)}
      </td>
    `;

    tbody.appendChild(tr);
  });
}

/* =========================
   CONTACTS
========================= */

function renderContacts(profile) {
  if (!profile) return '—';

  return `
    <strong>${safeText(profile.name)}</strong><br>
    <a href="#" onclick="openEmail('${profile.email}')">email</a>
    ${profile.telegram_username
      ? ` | <a href="#" onclick="openTelegram('${profile.telegram_username.replace('@','')}')">tg</a>`
      : ''}
    ${profile.whatsapp_phone
      ? ` | <a href="#" onclick="openWhatsApp('${profile.whatsapp_phone}')">wa</a>`
      : ''}
  `;
}

/* =========================
   ACTIONS
========================= */

function renderActions(booking) {
  if (!booking?.id) return '—';
  if (booking.status?.startsWith('cancelled')) return '—';

  return `
    <button onclick="adminCancel('${booking.id}')">
      ❌ Отменить
    </button>
  `;
}

window.adminCancel = async function adminCancel(bookingId) {
  if (!bookingId || cancelInProgress) return;

  const reason = prompt('Укажите причину отмены бронирования администратором:');
  if (!reason) return;

  cancelInProgress = true;

  try {
    const res = await fetch('/.netlify/functions/admin-booking-cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        booking_id: bookingId,
        reason_text: reason,
      }),
    });

    if (!res.ok) throw new Error('Cancel failed');

    alert('Бронирование отменено');
    await loadBookings();
  } catch (err) {
    console.error('[ADMIN][BOOKINGS][CANCEL]', err);
    alert('Не удалось отменить бронирование');
  } finally {
    cancelInProgress = false;
  }
};

/* =========================
   FILTERS
========================= */

function bindFilters() {
  document.getElementById('statusFilter')?.addEventListener('change', applyFilters);
  document.getElementById('fromDate')?.addEventListener('change', applyFilters);
  document.getElementById('toDate')?.addEventListener('change', applyFilters);
}

function applyFilters() {
  const status = document.getElementById('statusFilter')?.value;
  const from = document.getElementById('fromDate')?.value;
  const to = document.getElementById('toDate')?.value;

  const filtered = allBookings.filter(b => {
    const matchStatus = status ? b.status === status : true;

    const date = b.booking_date ? new Date(b.booking_date) : null;
    const matchFrom = from && date ? date >= new Date(from) : true;
    const matchTo = to && date ? date <= new Date(to) : true;

    return matchStatus && matchFrom && matchTo;
  });

  renderBookings(filtered);
}

/* =========================
   HELPERS
========================= */

function statusClass(status) {
  if (!status) return '';
  if (status.startsWith('cancelled')) return 'cancelled';
  if (status === 'completed') return 'completed';
  return 'active';
}
