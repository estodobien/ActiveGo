import { supabase } from './supabaseClient.js';

/* =========================
   ЭЛЕМЕНТЫ СТРАНИЦЫ
========================= */
const activeBookingsEl = document.getElementById('activeBookings');
const pastBookingsEl = document.getElementById('pastBookings');
const profileBox = document.getElementById('profileBox');

/* =========================
   АВТОРИЗАЦИЯ
========================= */
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  window.location.href = 'login.html';
  throw new Error('Not authorized');
}

const userId = session.user.id;
const today = new Date().toISOString().split('T')[0];

/* =========================
   ВСПОМОГАТЕЛЬНЫЕ
========================= */
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('ru-RU');
}

function formatFullDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function renderCancelReason(reason) {
  const map = {
    weather: 'Погодные условия',
    provider_issue: 'Проблема у поставщика',
    other: 'Другая причина'
  };
  return map[reason] || reason;
}

/* =========================
   СТАТУС (UI)
========================= */
function renderStatus(status, bookingDate) {
  if (
    (status === 'confirmed' || status === 'approved') &&
    bookingDate < today
  ) {
    return '<span class="booking-status completed">🟦 Завершено</span>';
  }

  if (status === 'confirmed' || status === 'approved') {
    return '<span class="booking-status approved">🟢 Оплачено</span>';
  }

  if (status === 'cancelled_by_client') {
    return '<span class="booking-status cancelled">🔴 Отменено вами</span>';
  }

  if (status === 'cancelled_by_provider') {
    return '<span class="booking-status cancelled">🔴 Отменено поставщиком</span>';
  }

  if (status === 'cancelled_by_provider_review') {
    return '<span class="booking-status cancelled">🟠 Отменено поставщиком (на проверке)</span>';
  }

  if (status === 'cancelled_by_admin') {
    return '<span class="booking-status cancelled">🔴 Отменено администратором</span>';
  }

  return `<span class="booking-status">⚪ ${status}</span>`;
}

/* =========================
   ПУСТЫЕ СОСТОЯНИЯ
========================= */
function renderEmptyActive() {
  return `
    <div class="card" style="text-align:center;">
      <p style="font-size:15px;margin-bottom:12px;">
        У вас пока нет активных бронирований
      </p>
      <a href="catalog.html" class="btn">
        Перейти в каталог
      </a>
    </div>
  `;
}

function renderEmptyPast() {
  return `
    <div class="card" style="text-align:center;">
      <p style="font-size:14px;color:#666;">
        Прошлых бронирований пока нет
      </p>
    </div>
  `;
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
    unit_price,
    total_price,
    status,
    cancel_reason,
    provider_cancel_reason,
    created_at,
    services (
      title,
      location,
      duration_min,
      duration_max
    )
  `)
  .eq('user_id', userId)
  .order('booking_date', { ascending: true });

if (error) {
  console.error(error);
  activeBookingsEl.innerHTML = '<p>Ошибка загрузки бронирований</p>';
  throw error;
}

/* =========================
   КАРТОЧКА БРОНИРОВАНИЯ
========================= */
function renderBookingCard(b) {
  const s = b.services || {};

  return `
    <div class="booking-card">
      <h3>${s.title || 'Услуга'}</h3>

      <div class="booking-meta">
        📅 ${formatDate(b.booking_date)} · 👥 ${b.quantity}
      </div>

      ${s.duration_min ? `
        <div class="booking-meta">
          ⏱ ${s.duration_min}–${s.duration_max} ч
        </div>` : ''}

      ${s.location ? `
        <div class="booking-meta">
          📍 ${s.location}
        </div>` : ''}

      <div class="booking-meta">
        💰 <strong>${b.total_price} €</strong>
      </div>

      ${renderStatus(b.status, b.booking_date)}

      ${b.provider_cancel_reason ? `
        <div class="booking-meta" style="color:#a33;font-size:13px;">
          ❗ Причина отмены: ${renderCancelReason(b.provider_cancel_reason)}
        </div>
      ` : ''}

      <div style="margin-top:8px;">
        <a href="booking.html?id=${b.id}"
           style="font-size:14px;color:#0a7cff;">
          Подробнее →
        </a>
      </div>
    </div>
  `;
}

/* =========================
   РАЗДЕЛЕНИЕ: АКТИВНЫЕ / АРХИВ
========================= */
const ACTIVE_STATUSES = ['confirmed', 'approved'];
const ARCHIVE_STATUSES = [
  'cancelled_by_client',
  'cancelled_by_provider',
  'cancelled_by_provider_review',
  'cancelled_by_admin'
];

const active = [];
const past = [];

(orders || []).forEach(o => {
  if (ARCHIVE_STATUSES.includes(o.status)) {
    past.push(o);
    return;
  }

  if (ACTIVE_STATUSES.includes(o.status) && o.booking_date < today) {
    past.push(o);
    return;
  }

  if (ACTIVE_STATUSES.includes(o.status)) {
    active.push(o);
    return;
  }

  past.push(o);
});

/* =========================
   ВЫВОД
========================= */
activeBookingsEl.innerHTML = active.length
  ? active.map(renderBookingCard).join('')
  : renderEmptyActive();

pastBookingsEl.innerHTML = past.length
  ? past.map(renderBookingCard).join('')
  : renderEmptyPast();

/* =========================
   ПРОФИЛЬ
========================= */
async function loadProfile() {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) {
    profileBox.innerHTML = '<p>Профиль не найден</p>';
    return;
  }

  let contactBlock = '';

  if (profile.notify_channel === 'telegram') {
    contactBlock = profile.telegram_id
      ? `<p>Telegram — привязан ✅</p>`
      : `
        <p>Telegram — не привязан</p>
        <ol style="font-size:14px;">
          <li>
            <a href="https://t.me/ActiveGoBot" target="_blank">
              👉 Открыть бота в Telegram
            </a>
          </li>
          <li>Нажми <b>Start</b></li>
          <li>Введи email регистрации</li>
        </ol>
      `;
  }

  if (profile.notify_channel === 'whatsapp') {
    contactBlock = `<p>WhatsApp — ${profile.whatsapp_phone || '—'}</p>`;
  }

  profileBox.innerHTML = `
    <h3>👤 Профиль</h3>

    <div class="profile-item">
      <strong>${profile.name || '—'}</strong>
      <span>${session.user.email}</span>
    </div>

    <div class="profile-item">
      <strong>🔔 Уведомления</strong>
      <span>${profile.notify_channel || 'Email'}</span>
    </div>

    ${contactBlock}

    <div class="profile-item">
      <strong>📦 Всего бронирований</strong>
      <span>${orders?.length || 0}</span>
    </div>

    <div class="profile-item">
      <strong>📅 С нами с</strong>
      <span>${formatFullDate(profile.created_at)}</span>
    </div>
  `;
}

loadProfile();
