/*
  admin-loader.js
  ADMIN ONLY

  Назначение:
  - загружает страницы админки в admin-layout
  - единая точка рендера
  - вручную подключает JS (ВАЖНО)
*/

const pageParam =
  new URLSearchParams(window.location.search).get('page') ||
  'dashboard';

const pageMap = {
  dashboard: {
    html: 'admin-dashboard.html',
  },

  services: {
    html: 'admin-services.html',
    js: '/js/admin/services/admin-services.js',
  },

  bookings: {
    html: 'admin-bookings.html',
    js: '/js/admin/bookings/admin-bookings.js',
  },

  users: {
    html: 'admin-users.html',
    js: '/js/admin/users/admin-users.js',
  },

  'service-view': {
    html: 'admin-service-view.html',
    js: '/js/admin/services/admin-service-view.js',
  },

  /* =========================
     🆕 FULL ADMIN EDIT
  ========================= */
  'service-edit': {
    html: 'admin-service-edit.html',
    js: '/js/admin/services/admin-service-edit.js',
  },
};

loadPage(pageParam);

/* =========================
   LOAD PAGE
========================= */

async function loadPage(page) {
  const config = pageMap[page];

  if (!config) {
    renderNotFound();
    return;
  }

  try {
    console.info('[ADMIN][LOADER] loading page:', page);

    // 1️⃣ HTML
    const res = await fetch(`/admin/pages/${config.html}`);
    if (!res.ok) throw new Error('Page not found');

    const html = await res.text();
    const container = document.getElementById('adminContent');

    if (!container) {
      console.error('[ADMIN][LOADER] adminContent not found');
      return;
    }

    container.innerHTML = html;

    // 2️⃣ JS (ТОЛЬКО ЕСЛИ ЕСТЬ)
    if (config.js) {
      await loadAdminScript(config.js);
    }
  } catch (err) {
    console.error('[ADMIN][LOADER]', err);
    renderNotFound();
  }
}

/* =========================
   LOAD JS
========================= */

function loadAdminScript(src) {
  return new Promise((resolve, reject) => {
    const old = document.querySelector('script[data-admin-script]');
    if (old) old.remove();

    const script = document.createElement('script');
    script.type = 'module';
    script.src = src;
    script.dataset.adminScript = 'true';

    script.onload = () => {
      console.info('[ADMIN][LOADER] script loaded:', src);
      resolve();
    };

    script.onerror = () => {
      console.error('[ADMIN][LOADER] script failed:', src);
      reject();
    };

    document.body.appendChild(script);
  });
}

/* =========================
   NOT FOUND
========================= */

function renderNotFound() {
  const container = document.getElementById('adminContent');
  if (!container) return;

  container.innerHTML = `
    <h2>Страница админки не найдена</h2>
    <p>Проверь параметр <code>?page=</code> в URL</p>
  `;
}
