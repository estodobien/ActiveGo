/*
  admin-service-view.js
  ADMIN ONLY
*/

waitForAdminReady(async () => {
  const serviceId = getServiceId();
  if (!serviceId) {
    alert('ID услуги не указан');
    return;
  }

  const service = await loadService(serviceId);
  if (!service) return;

  renderServicePreview(service.id);
  renderProviderContacts(service.provider);
  renderModerationBlock(service);

  // редактирование через модерацию (как поставщик)
  bindEdit(service.id);

  // полное редактирование админом
  bindAdminFullEdit(service.id);
});

/* =========================
   HELPERS
========================= */

function getServiceId() {
  return new URLSearchParams(window.location.search).get('id');
}

async function loadService(serviceId) {
  const res = await fetch(
    `/.netlify/functions/admin-service-get?id=${serviceId}`
  );

  if (!res.ok) {
    alert('Не удалось загрузить услугу');
    return null;
  }

  return await res.json();
}

/* =========================
   PREVIEW
========================= */

function renderServicePreview(serviceId) {
  const iframe = document.getElementById('servicePreview');
  if (!iframe) return;

  iframe.src = `/service.html?id=${serviceId}&mode=admin`;
}

/* =========================
   PROVIDER CONTACTS
========================= */

function renderProviderContacts(provider) {
  const el = document.getElementById('providerContacts');
  if (!el) return;

  if (!provider) {
    el.innerHTML = '<p>Поставщик не найден</p>';
    return;
  }

  el.innerHTML = `
    <h4>Контакты поставщика</h4>
    <p><strong>${safeText(provider.name)}</strong></p>
    <p>Email: ${safeText(provider.email)}</p>
    <p>Telegram: ${provider.telegram_id ?? '—'}</p>
    <p>WhatsApp: ${provider.whatsapp_phone ?? '—'}</p>
  `;
}

/* =========================
   DIFF (ЧТО ИЗМЕНИЛОСЬ)
========================= */

function renderDiffBlock(service) {
  const container = document.getElementById('serviceDiff');
  if (!container) return;

  const oldData = service.admin_previous_data;
  if (!oldData) {
    container.innerHTML = '<p>Нет данных о предыдущей версии</p>';
    return;
  }

  const fields = [
    { key: 'title', label: 'Название' },
    { key: 'description', label: 'Описание' },
    { key: 'price', label: 'Цена' },
    { key: 'location', label: 'Локация' },
    { key: 'contact_phone', label: 'Телефон' },
    { key: 'meeting_address', label: 'Место встречи' },
  ];

  const rows = fields
    .map(({ key, label }) => {
      const oldVal = oldData[key] ?? '—';
      const newVal = service[key] ?? '—';

      if (String(oldVal) === String(newVal)) return '';

      return `
        <div style="margin-bottom:12px;">
          <strong>${label}</strong>
          <div style="display:flex;gap:12px;margin-top:4px;">
            <div style="
              flex:1;
              padding:8px;
              background:#fff5f5;
              border:1px solid #fed7d7;
              border-radius:6px;
              font-size:13px;
            ">
              ❌ Было:<br>${escapeHtml(oldVal)}
            </div>

            <div style="
              flex:1;
              padding:8px;
              background:#f0fff4;
              border:1px solid #c6f6d5;
              border-radius:6px;
              font-size:13px;
            ">
              ✅ Стало:<br>${escapeHtml(newVal)}
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  container.innerHTML = `
    <h4>✏️ Изменения поставщика</h4>
    ${rows || '<p>Изменений нет</p>'}
  `;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* =========================
   MODERATION
========================= */

function renderModerationBlock(service) {
  const box = document.getElementById('moderationBlock');
  if (!box) return;

  if (service.status === 'pending') {
    box.innerHTML = `
      <h4>⏳ Услуга на модерации</h4>

      <div id="serviceDiff" style="
        margin-bottom:16px;
        padding:12px;
        border:1px dashed #cbd5e0;
        border-radius:10px;
        background:#f7fafc;
      "></div>

      <textarea
        id="rejectReason"
        placeholder="Причина отклонения (если отклоняете)"
        style="width:100%;margin-bottom:10px;"
      ></textarea>

      <button id="approveBtn">✅ Одобрить</button>
      <button id="rejectBtn">❌ Отклонить</button>
    `;

    renderDiffBlock(service);

    document.getElementById('approveBtn').onclick =
      () => updateStatus(service.id, 'active');

    document.getElementById('rejectBtn').onclick =
      () => {
        const reason =
          document.getElementById('rejectReason').value.trim();

        if (!reason) {
          alert('Укажите причину отклонения');
          return;
        }

        updateStatus(service.id, 'rejected', reason);
      };
  }

  if (service.status === 'active') {
    box.innerHTML = `
      <h4>✅ Услуга опубликована</h4>
      <button id="archiveBtn">🚫 Архивировать</button>
    `;

    document.getElementById('archiveBtn').onclick =
      () => updateStatus(service.id, 'archived');
  }

  if (service.status === 'rejected') {
    box.innerHTML = `
      <h4>❌ Услуга отклонена</h4>
      <p>${safeText(service.admin_reject_reason)}</p>

      <button id="reopenBtn">🔄 Вернуть на модерацию</button>
    `;

    document.getElementById('reopenBtn').onclick =
      () => updateStatus(service.id, 'pending');
  }
}

/* =========================
   ACTIONS
========================= */

async function updateStatus(serviceId, status, reason = null) {
  const res = await fetch('/.netlify/functions/admin-service-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ serviceId, status, reason }),
  });

  if (!res.ok) {
    alert('Ошибка изменения статуса');
    return;
  }

  await logAdminAction({
    entity_type: 'service',
    entity_id: serviceId,
    action_type: status,
    reason,
  });

  location.reload();
}

/* ===== РЕДАКТИРОВАНИЕ ЧЕРЕЗ МОДЕРАЦИЮ ===== */
function bindEdit(serviceId) {
  const btn = document.getElementById('editServiceBtn');
  if (!btn) return;

  btn.onclick = () => {
    window.location.href =
      `/edit-service.html?id=${serviceId}&mode=admin`;
  };
}

/* ===== ПОЛНОЕ РЕДАКТИРОВАНИЕ (АДМИН) ===== */
function bindAdminFullEdit(serviceId) {
  const btn = document.getElementById('adminFullEditBtn');
  if (!btn) return;

  btn.onclick = () => {
    window.location.href =
  `/add-service.html?id=${serviceId}&mode=admin`;

  };
}

