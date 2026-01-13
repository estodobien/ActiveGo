import { supabase } from './supabaseClient.js';

/* =========================
   ЭЛЕМЕНТЫ
========================= */
const archiveEl = document.getElementById('archiveBookings');

/* =========================
   АВТОРИЗАЦИЯ
========================= */
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  window.location.href = 'login-provider.html';
  throw new Error('Not authorized');
}

const providerId = session.user.id;
const today = new Date().toISOString().split('T')[0];

/* =========================
   ВСПОМОГАТЕЛЬНЫЕ
========================= */
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('ru-RU');
}

function renderCancelReason(reason) {
  const map = {
    weather: 'Погодные условия',
    provider_issue: 'Проблема у поставщика',
    other: 'Другая причина'
  };
  return map[reason] || reason;
}

function renderStatus(status, bookingDate) {
  if (
    (status === 'confirmed' || status === 'approved') &&
    bookingDate < today
  ) {
    return '<span class="booking-status completed">🟦 Завершено</span>';
  }

  if (status === 'cancelled_by_client') {
    return '<span class="booking-status cancelled">🔴 Отменено клиентом</span>';
  }

  if (status === 'cancelled_by_provider') {
    return '<span class="booking-status cancelled">🔴 Отменено вами</span>';
  }

  if (status === 'cancelled_by_provider_review') {
    return '<span class="booking-status cancelled">🟠 Отменено (на проверке)</span>';
  }

  if (status === 'cancelled_by_admin') {
    return '<span class="booking-status cancelled">🔴 Отменено администратором</span>';
  }

  return `<span class="booking-status">⚪ ${status}</span>`;
}

/* =========================
   ЗАГРУЗКА БРОНИРОВАНИЙ
========================= */
const { data: orders, error } = await supabase
  .from('orders')
  .select(`
    id,
    booking_date,
    quantity,
    total_price,
    status,
    provider_cancel_reason,
    services (
      title,
      location,
      main_image
    )
  `)
  .eq('provider_id', providerId)
  .order('booking_date', { ascending: false });

if (error) {
  console.error(error);
  archiveEl.innerHTML = '<p>Ошибка загрузки архива</p>';
  throw error;
}

/* =========================
   ФИЛЬТРАЦИЯ АРХИВА
========================= */
const ARCHIVE_STATUSES = [
  'cancelled_by_client',
  'cancelled_by_provider',
  'cancelled_by_provider_review',
  'cancelled_by_admin'
];

const archiveOrders = (orders || []).filter(o => {
  if (ARCHIVE_STATUSES.includes(o.status)) return true;

  if (
    (o.status === 'confirmed' || o.status === 'approved') &&
    o.booking_date < today
  ) {
    return true;
  }

  return false;
});

/* =========================
   РЕНДЕР
========================= */
function renderArchiveCard(o) {
  const s = o.services || {};

  return `
    <div class="booking-card">
      <h3>${s.title || 'Услуга'}</h3>

      <div class="booking-meta">
        📅 ${formatDate(o.booking_date)} · 👥 ${o.quantity}
      </div>

      ${s.location ? `
        <div class="booking-meta">
          📍 ${s.location}
        </div>` : ''}

      <div class="booking-meta">
        💰 <strong>${o.total_price} €</strong>
      </div>

      ${renderStatus(o.status, o.booking_date)}

      ${o.provider_cancel_reason ? `
        <div class="booking-meta" style="color:#a33;font-size:13px;">
          ❗ Причина отмены: ${renderCancelReason(o.provider_cancel_reason)}
        </div>
      ` : ''}

      <div style="margin-top:10px;font-size:13px;color:#666;">
        Связь с клиентом осуществляется через ActiveGo
      </div>
    </div>
  `;
}

archiveEl.innerHTML = archiveOrders.length
  ? archiveOrders.map(renderArchiveCard).join('')
  : `
    <div class="card" style="text-align:center;">
      <p style="font-size:14px;color:#666;">
        Архив бронирований пока пуст
      </p>
    </div>
  `;
