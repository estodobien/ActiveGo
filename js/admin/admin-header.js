// admin-header.js
// ADMIN ONLY
// Отвечает ТОЛЬКО за UI-часть админки
// Supabase используется ИСКЛЮЧИТЕЛЬНО для auth (logout)

import { supabase } from '/supabaseClient.js';

document.addEventListener('admin:ready', async () => {
  await injectAdminHeader();
  highlightActivePage();
  bindLogout();
});

/* =========================
   INSERT HEADER
========================= */

async function injectAdminHeader() {
  // защита от двойной вставки
  if (document.querySelector('.admin-nav')) return;

  const layout = document.querySelector('.admin-layout');
  if (!layout) {
    console.error('[ADMIN][HEADER] .admin-layout not found');
    return;
  }

  const res = await fetch('/admin/admin-header.html');
  if (!res.ok) {
    console.error('[ADMIN][HEADER] failed to load header');
    return;
  }

  const html = await res.text();
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;

  // ⬅️ КЛЮЧЕВОЕ ИЗМЕНЕНИЕ:
  // header вставляется ВНУТРЬ admin-layout
  layout.prepend(wrapper);
}

/* =========================
   ACTIVE PAGE
========================= */

function highlightActivePage() {
  const page =
    new URLSearchParams(window.location.search).get('page') ||
    'dashboard';

  document
    .querySelectorAll('.admin-nav__menu a')
    .forEach(link => {
      if (link.dataset.page === page) {
        link.classList.add('active');
      }
    });
}

/* =========================
   LOGOUT
========================= */

function bindLogout() {
  const btn = document.getElementById('adminLogoutBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (!confirm('Выйти из панели администратора?')) return;

    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn('[ADMIN][LOGOUT]', err);
    }

    window.location.href = '/';
  });
}
