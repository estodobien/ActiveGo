import { supabase } from './supabaseClient.js';

/* =========================
   ЭЛЕМЕНТЫ
========================= */
const payoutsEl = document.getElementById('payoutsList');

/* =========================
   АВТОРИЗАЦИЯ
========================= */
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  window.location.href = 'login-provider.html';
  throw new Error('Not authorized');
}

const providerId = session.user.id;

/* =========================
   ВСПОМОГАТЕЛЬНЫЕ
========================= */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ru-RU');
}

function renderStatus(status) {
  if (status === 'paid') {
    return `<span class="booking-status approved">🟢 Выплачено</span>`;
  }
  return `<span class="booking-status pending">🟡 В обработке</span>`;
}

/* =========================
   ЗАГРУЗКА ВЫПЛАТ
========================= */
const { data: payouts, error } = await supabase
  .from('provider_payouts')
  .select('*')
  .eq('provider_id', providerId)
  .order('created_at', { ascending: false });

if (error) {
  console.error(error);
  payoutsEl.innerHTML = '<p>Ошибка загрузки выплат</p>';
}

/* =========================
   ПУСТОЕ СОСТОЯНИЕ
========================= */
if (!payouts || payouts.length === 0) {
  payoutsEl.innerHTML = `
    <div class="card" style="text-align:center;">
      <p style="font-size:15px;">
        Выплат пока нет
      </p>
      <p style="font-size:14px;color:#666;">
        После первой выплаты здесь появится история
      </p>
    </div>
  `;
  return;
}

/* =========================
   РЕНДЕР
========================= */
payoutsEl.innerHTML = payouts.map(p => `
  <div class="card" style="margin-bottom:16px;">
    <h3 style="margin-bottom:8px;">💸 Выплата</h3>

    <div class="profile-item">
      <strong>📅 Период</strong>
      <span>${formatDate(p.period_from)} – ${formatDate(p.period_to)}</span>
    </div>

    <div class="profile-item">
      <strong>📦 Заказов</strong>
      <span>${p.orders_count || 0}</span>
    </div>

    <div class="profile-item">
      <strong>💰 Сумма</strong>
      <span><strong>${Number(p.amount).toFixed(2)} €</strong></span>
    </div>

    <div class="profile-item">
      <strong>Статус</strong>
      <span>${renderStatus(p.status)}</span>
    </div>

    ${p.paid_at ? `
      <div class="profile-item">
        <strong>📅 Дата выплаты</strong>
        <span>${formatDate(p.paid_at)}</span>
      </div>
    ` : ''}

    ${p.comment ? `
      <div style="margin-top:10px;font-size:14px;color:#666;">
        💬 ${p.comment}
      </div>
    ` : ''}
  </div>
`).join('');
