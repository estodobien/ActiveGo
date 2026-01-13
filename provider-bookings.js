import { supabase } from './supabaseClient.js';

const bookingsEl = document.getElementById('providerBookings');

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

function renderStatus(status) {
  if (status === 'confirmed' || status === 'approved') {
    return '<span class="booking-status approved">🟢 Оплачено</span>';
  }

  if (
    status === 'cancelled' ||
    status === 'cancelled_by_client' ||
    status === 'cancelled_by_provider'
  ) {
    return '<span class="booking-status cancelled">🔴 Отменено</span>';
  }

  return `<span class="booking-status">⚪ ${status}</span>`;
}

/* =========================
   ЗАГРУЗКА АКТИВНЫХ БРОНИРОВАНИЙ
========================= */
const { data, error } = await supabase
  .from('orders')
  .select(`
    id,
    booking_date,
    quantity,
    unit_price,
    total_price,
    status,
    services (
      title,
      location,
      duration_min,
      duration_max,
      main_image
    )
  `)
  .eq('provider_id', providerId)
  .in('status', ['confirmed', 'approved'])
  .gte('booking_date', today)
  .order('booking_date', { ascending: true });

if (error) {
  console.error(error);
  bookingsEl.innerHTML = '<p>Ошибка загрузки бронирований</p>';
} else {
  bookingsEl.innerHTML = data?.length
    ? data.map(renderCard).join('')
    : `
      <div class="card" style="text-align:center;">
        <p style="font-size:14px;color:#666;">
          Актуальных бронирований нет
        </p>
      </div>
    `;
}

/* =========================
   РЕНДЕР КАРТОЧКИ
========================= */
function renderCard(o) {
  const s = o.services || {};

  return `
    <div class="booking-card">
      <h3>${s.title || 'Услуга'}</h3>

      <div class="booking-meta">
        📅 ${formatDate(o.booking_date)} · 👥 ${o.quantity} чел
      </div>

      ${s.duration_min
        ? `<div class="booking-meta">
             ⏱ ${s.duration_min}–${s.duration_max} ч
           </div>`
        : ''
      }

      <div class="booking-meta">
        📍 ${s.location || '—'}
      </div>

      <div class="booking-meta">
        💰 <strong>${o.total_price} €</strong>
        <span style="font-size:13px;color:#666;">
          (${o.unit_price} € × ${o.quantity})
        </span>
      </div>

      ${renderStatus(o.status)}

      <div style="margin-top:10px;font-size:13px;color:#666;">
        Связь с клиентом осуществляется через ActiveGo
      </div>

      <div style="margin-top:14px;">
        <a
          href="booking.html?id=${o.id}&role=provider"
          class="btn-outline">
          Подробнее
        </a>
      </div>
    </div>
  `;
}
