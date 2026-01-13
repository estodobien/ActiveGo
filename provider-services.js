import { supabase } from './supabaseClient.js';

/* =========================
   ЭЛЕМЕНТЫ
========================= */
const servicesEl = document.getElementById('providerServices');

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
function renderServiceStatus(status) {
  if (status === 'active') {
    return '<span class="booking-status approved">🟢 Активна</span>';
  }

  if (status === 'pending') {
    return '<span class="booking-status">🟡 На модерации</span>';
  }

  return '<span class="booking-status cancelled">🔴 Отклонена</span>';
}

/* =========================
   ЗАГРУЗКА УСЛУГ
========================= */
async function loadServices() {
  const { data, error } = await supabase
    .from('services')
    .select(`
      id,
      title,
      main_image,
      status,
      price,
      created_at
    `)
    .eq('provider_id', providerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error(error);
    servicesEl.innerHTML = '<p>Ошибка загрузки услуг</p>';
    return;
  }

  servicesEl.innerHTML = data.length
    ? data.map(renderServiceCard).join('')
    : `
      <div class="card">
        <p>У вас пока нет услуг</p>
        <a href="add-service.html" class="btn" style="margin-top:12px;">
          Создать первую услугу
        </a>
      </div>
    `;

  bindCardActions();
}

/* =========================
   КАРТОЧКА УСЛУГИ
========================= */
function renderServiceCard(service) {
  return `
    <div
      class="booking-card service-card"
      data-id="${service.id}"
      style="display:flex;gap:16px;"
    >

      <img
        src="${service.main_image || 'https://via.placeholder.com/120'}"
        style="width:120px;height:90px;object-fit:cover;border-radius:8px;"
      />

      <div style="flex:1;">
        <h3>${service.title}</h3>

        <div class="booking-meta">
          💰 ${service.price} €
        </div>

        ${renderServiceStatus(service.status)}

        <!-- мини-бейджи (заглушка под статистику) -->
        <div style="margin-top:6px;font-size:12px;color:#666;">
          🗓 даты • 📦 бронирования • ⭐ рейтинг
        </div>

        <div
          class="service-card-actions"
          style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;"
        >
          <button class="btn btn-small manage-btn">📅 Даты и доступность</button>
          <button class="btn btn-small edit-btn">✏️ Редактировать услугу</button>
        </div>
      </div>
    </div>
  `;
}

/* =========================
   ОБРАБОТЧИКИ КАРТОЧЕК
========================= */
function bindCardActions() {
  const cards = document.querySelectorAll('.service-card');

  cards.forEach(card => {
    const serviceId = card.dataset.id;

    // ✅ клик по карточке → ДЕТАЛИ
    card.addEventListener('click', () => {
      window.location.href =
        `edit-service.html?id=${serviceId}&tab=details`;
    });

    // 📅 Управление (даты / доступность)
    const manageBtn = card.querySelector('.manage-btn');
    manageBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.href =
        `edit-service.html?id=${serviceId}&tab=availability`;
    });

    // ✏️ Редактировать услугу
    const editBtn = card.querySelector('.edit-btn');
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.href =
        `edit-service.html?id=${serviceId}&tab=edit`;
    });
  });
}

/* =========================
   СТАРТ
========================= */
loadServices();
