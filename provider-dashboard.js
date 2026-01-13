import { supabase } from './supabaseClient.js';

/* ===============================
   SESSION + PROVIDER GUARD
=============================== */

const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  window.location.href = 'login.html';
  throw new Error('No session');
}

const providerId = session.user.id;

const { data: profile, error } = await supabase
  .from('profiles')
  .select(`
    role,
    onboarding_completed,
    created_at,
    notify_channel,
    telegram_id,
    telegram_username,
    whatsapp_phone,
    name
  `)
  .eq('id', providerId)
  .single();

if (error || !profile) {
  console.error('Profile not found', error);
  window.location.href = 'index.html';
  throw new Error('Profile not found');
}

if (profile.role !== 'provider') {
  window.location.href = 'index.html';
  throw new Error('Not provider');
}

/* ===============================
   ONBOARDING STATE (SOFT)
=============================== */

const onboardingRequired = !profile.onboarding_completed;

/* =========================
   PAGE ELEMENTS
========================= */

const onboardingWarning = document.getElementById('onboardingWarning');
const profileBox = document.getElementById('providerProfileBox');

const statIncomeEl   = document.getElementById('statIncome');
const statPayoutEl   = document.getElementById('statPayout');
const statBookingsEl = document.getElementById('statBookings');
const statUpcomingEl = document.getElementById('statUpcoming');
const statServicesEl = document.getElementById('statServices');

const periodButtons = document.querySelectorAll('.period-btn');
const now = new Date();

/* =========================
   SHOW SOFT WARNING
========================= */

if (onboardingRequired && onboardingWarning) {
  onboardingWarning.style.display = 'block';
}

/* =========================
   HELPERS
========================= */

function formatFullDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function getPeriodRange(period) {
  const d = new Date();

  if (period === 'month') {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  if (period === 'year') {
    return new Date(d.getFullYear(), 0, 1);
  }

  return null; // all time
}

/* =========================
   PROVIDER PROFILE
========================= */

function renderProviderProfile(totalBookings) {
  if (!profileBox) return;

  let contactBlock = '';

  if (profile.notify_channel === 'telegram') {
    contactBlock = profile.telegram_id
      ? `<p>Telegram — привязан ✅</p>`
      : `
        <p>Telegram — не привязан</p>
        <ol style="font-size:14px;">
          <li><a href="https://t.me/ActiveGoBot" target="_blank">👉 Открыть бота</a></li>
          <li>Нажмите <b>Start</b></li>
          <li>Введите email регистрации</li>
        </ol>
      `;
  }

  if (profile.notify_channel === 'whatsapp') {
    contactBlock = `<p>WhatsApp — ${profile.whatsapp_phone || '—'}</p>`;
  }

  profileBox.innerHTML = `
    <h3>👤 Профиль поставщика</h3>

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
      <span>${totalBookings}</span>
    </div>

    <div class="profile-item">
      <strong>📅 С нами с</strong>
      <span>${formatFullDate(profile.created_at)}</span>
    </div>
  `;
}

/* =========================
   STATS + PAYOUTS
========================= */

async function loadStats(period = 'month') {
  const fromDate = getPeriodRange(period);

  /* ---- Orders ---- */
  let ordersQuery = supabase
    .from('orders')
    .select('total_price, booking_date, status, created_at')
    .eq('provider_id', providerId);

  if (fromDate) {
    ordersQuery = ordersQuery.gte('created_at', fromDate.toISOString());
  }

  const { data: orders = [] } = await ordersQuery;

  const totalBookings = orders.length;

  /* ---- Income ---- */
  const income = orders
    .filter(o => ['confirmed', 'approved'].includes(o.status))
    .reduce((sum, o) => sum + Number(o.total_price), 0);

  /* ---- Upcoming ---- */
  const upcoming = orders.filter(o =>
    ['confirmed', 'approved'].includes(o.status) &&
    new Date(o.booking_date) > now
  ).length;

  /* ---- Completed ---- */
  const { data: completedOrders = [] } = await supabase
    .from('orders')
    .select('total_price, booking_date')
    .eq('provider_id', providerId)
    .in('status', ['confirmed', 'approved'])
    .lt('booking_date', now.toISOString());

  const totalEarned = completedOrders.reduce(
    (sum, o) => sum + Number(o.total_price), 0
  );

  /* ---- Payouts ---- */
  const { data: payouts = [] } = await supabase
    .from('provider_payouts')
    .select('amount, paid_at')
    .eq('provider_id', providerId)
    .eq('status', 'paid');

  const paidTotal = payouts.reduce(
    (sum, p) => sum + Number(p.amount), 0
  );

  const lastPayout = payouts.length
    ? payouts.sort((a, b) =>
        new Date(b.paid_at) - new Date(a.paid_at)
      )[0]
    : null;

  const payoutDue = Math.max(totalEarned - paidTotal, 0);

  /* ---- Active services ---- */
  const { data: services = [] } = await supabase
    .from('services')
    .select('id')
    .eq('provider_id', providerId)
    .eq('status', 'active');

  /* ---- Render ---- */
  if (statIncomeEl) {
    statIncomeEl.textContent = `${income.toFixed(2)} €`;
  }

  if (statPayoutEl) {
    statPayoutEl.innerHTML = `
      ${payoutDue.toFixed(2)} €
      ${
        lastPayout
          ? `<div class="stat-hint">
               Последняя выплата: ${lastPayout.amount} € —
               ${formatFullDate(lastPayout.paid_at)}
             </div>`
          : `<div class="stat-hint">Выплат ещё не было</div>`
      }
    `;
  }

  if (statBookingsEl) statBookingsEl.textContent = totalBookings;
  if (statUpcomingEl) statUpcomingEl.textContent = upcoming;
  if (statServicesEl) statServicesEl.textContent = services.length;

  renderProviderProfile(totalBookings);
}

/* =========================
   PERIOD SWITCH
========================= */

periodButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    periodButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadStats(btn.dataset.period);
  });
});

/* =========================
   START
========================= */

loadStats('month');
