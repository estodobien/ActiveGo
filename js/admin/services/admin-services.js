/*
  admin-services.js
  ADMIN ONLY

  Назначение:
  - список всех услуг
  - поиск
  - фильтр по статусу
  - переход в admin-service-view

  ❗ Supabase НЕ используется
  ❗ Все данные — через Netlify Function
*/

let allServices = [];

waitForAdminReady(async () => {
  await loadServices();
  bindFilters();
});

/* =========================
   LOAD
========================= */

async function loadServices() {
  try {
    const res = await fetch('/.netlify/functions/admin-services-get');
    if (!res.ok) throw new Error('Failed to load services');

    allServices = await res.json();
    renderTable(allServices);
  } catch (err) {
    console.error('[ADMIN][SERVICES]', err);
    alert('Не удалось загрузить услуги');
  }
}

/* =========================
   RENDER
========================= */

function renderTable(services) {
  const tbody = document.getElementById('servicesTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!services.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">Услуги не найдены</td>
      </tr>
    `;
    return;
  }

  services.forEach(service => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>${safeText(service.title)}</td>
      <td>${safeText(service.provider?.name)}</td>
      <td>${formatPrice(service.price)}</td>
      <td>
        <span class="admin-badge ${service.status}">
          ${service.status}
        </span>
      </td>
      <td>
        <button data-id="${service.id}">Открыть</button>
      </td>
    `;

    tr.querySelector('button').addEventListener('click', () => {
      window.location.href =
        `/admin/admin-layout.html?page=service-view&id=${service.id}`;
    });

    tbody.appendChild(tr);
  });
}

/* =========================
   FILTERS
========================= */

function bindFilters() {
  document
    .getElementById('searchInput')
    ?.addEventListener('input', applyFilters);

  document
    .getElementById('statusFilter')
    ?.addEventListener('change', applyFilters);
}

function applyFilters() {
  const search =
    document.getElementById('searchInput')?.value.toLowerCase() || '';

  const status =
    document.getElementById('statusFilter')?.value || '';

  const filtered = allServices.filter(service => {
    const matchSearch =
      service.title?.toLowerCase().includes(search);

    const matchStatus =
      status ? service.status === status : true;

    return matchSearch && matchStatus;
  });

  renderTable(filtered);
}
