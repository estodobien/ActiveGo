/*
  admin-users.js
  ADMIN ONLY

  Назначение:
  - просмотр всех пользователей
  - управление ролями (client ↔ provider)
  - управление активностью (is_active)
  - отображение контактов

  ❗ Supabase в браузере НЕ используется
  ❗ Все операции — через Netlify Functions (service_role)
*/

let allUsers = [];

waitForAdminReady(async () => {
  await loadUsers();
  bindFilters();
});

/* =========================
   LOAD USERS
========================= */

async function loadUsers() {
  try {
    const res = await fetch('/.netlify/functions/admin-users-get');
    if (!res.ok) throw new Error('Load failed');

    allUsers = await res.json();
    renderUsers(allUsers);
  } catch (err) {
    console.error('[ADMIN][USERS] load error', err);
    alert('Не удалось загрузить пользователей');
  }
}

/* =========================
   RENDER
========================= */

function renderUsers(users) {
  const tbody = document.getElementById('usersBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!users.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">Пользователи не найдены</td>
      </tr>
    `;
    return;
  }

  users.forEach(user => {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td>
        <strong>${safeText(user.name)}</strong><br>
        ${safeText(user.email)}
      </td>

      <td>
        <span class="admin-badge ${user.role}">
          ${user.role}
        </span>
      </td>

      <td class="contacts">
        ${renderContacts(user)}
      </td>

      <td>${formatDate(user.created_at)}</td>

      <td class="actions">
        ${renderActions(user)}
      </td>
    `;

    tbody.appendChild(tr);
  });
}

/* =========================
   CONTACTS
========================= */

function renderContacts(user) {
  return `
    <a href="#" onclick="openEmail('${user.email}')">email</a>
    ${user.telegram_username
      ? ` | <a href="#" onclick="openTelegram('${user.telegram_username.replace('@','')}')">tg</a>`
      : ''}
    ${user.whatsapp_phone
      ? ` | <a href="#" onclick="openWhatsApp('${user.whatsapp_phone}')">wa</a>`
      : ''}
  `;
}

/* =========================
   ACTIONS
========================= */

function renderActions(user) {
  if (user.role === 'admin') return '—';

  const nextRole = user.role === 'client' ? 'provider' : 'client';
  const roleLabel = nextRole === 'provider' ? 'Поставщик' : 'Клиент';

  return `
    <button onclick="changeRole('${user.id}', '${nextRole}')">
      Назначить: ${roleLabel}
    </button>
  `;
}

/* =========================
   ROLE CHANGE
========================= */

window.changeRole = async function changeRole(userId, newRole) {
  const roleLabel = newRole === 'provider' ? 'поставщик' : 'клиент';

  if (!confirm(`Изменить роль пользователя на "${roleLabel}"?`)) return;

  try {
    const res = await fetch('/.netlify/functions/admin-user-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        new_role: newRole,
        admin_id: window.adminContext.user.id,
      }),
    });

    if (!res.ok) throw new Error('Role change failed');

    await loadUsers();
  } catch (err) {
    console.error('[ADMIN][USERS] role change error', err);
    alert('Не удалось изменить роль пользователя');
  }
};

/* =========================
   FILTERS
========================= */

function bindFilters() {
  document
    .getElementById('searchInput')
    ?.addEventListener('input', applyFilters);

  document
    .getElementById('roleFilter')
    ?.addEventListener('change', applyFilters);
}

function applyFilters() {
  const search =
    document.getElementById('searchInput')?.value.toLowerCase() || '';

  const role =
    document.getElementById('roleFilter')?.value || '';

  const filtered = allUsers.filter(user => {
    const matchSearch =
      user.name?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search);

    const matchRole = role ? user.role === role : true;

    return matchSearch && matchRole;
  });

  renderUsers(filtered);
}
