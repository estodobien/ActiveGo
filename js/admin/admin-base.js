// admin-base.js
// ADMIN CORE
// SOURCE OF TRUTH compliant
// Авторизация админа + глобальный контекст + хелперы

import { supabase } from '/supabaseClient.js';

/* =========================
   GLOBAL ADMIN CONTEXT
========================= */

window.adminContext = {
  user: null,
  profile: null,
  isReady: false,
};

/* =========================
   INIT
========================= */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // ⛔ ВАЖНО: сначала дожидаемся сессии
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError || !sessionData?.session) {
      throw new Error('No active session');
    }

    await initAdmin(sessionData.session);

    window.adminContext.isReady = true;
    document.dispatchEvent(new CustomEvent('admin:ready'));
  } catch (err) {
    console.error('[ADMIN INIT ERROR]', err);
    redirectToHome();
  }
});

/* =========================
   ADMIN AUTH (VIA FUNCTION)
========================= */

async function initAdmin(session) {
  const accessToken = session.access_token;

  const res = await fetch('/.netlify/functions/admin-auth-check', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error('Admin access denied');
  }

  const data = await res.json();

  if (!data?.user || !data?.profile) {
    throw new Error('Invalid admin payload');
  }

  window.adminContext.user = data.user;
  window.adminContext.profile = data.profile;

  console.info(
    '[ADMIN] authenticated:',
    data.profile.email || data.profile.id
  );
}

/* =========================
   REDIRECT
========================= */

function redirectToHome() {
  window.location.href = '/';
}

/* =========================
   GLOBAL HELPERS
========================= */

// Price formatter
window.formatPrice = function formatPrice(value, currency = '€') {
  if (value === null || value === undefined) return '—';
  return `${Number(value).toFixed(2)} ${currency}`;
};

// Date formatter
window.formatDate = function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString();
};

// Safe text
window.safeText = function safeText(text) {
  return text ? String(text) : '—';
};

// Contacts
window.openTelegram = function openTelegram(telegramId) {
  if (!telegramId) return;
  window.open(`https://t.me/${telegramId}`, '_blank');
};

window.openWhatsApp = function openWhatsApp(phone) {
  if (!phone) return;
  const clean = phone.replace(/[^\d]/g, '');
  window.open(`https://wa.me/${clean}`, '_blank');
};

window.openEmail = function openEmail(email) {
  if (!email) return;
  window.location.href = `mailto:${email}`;
};

/* =========================
   ADMIN ACTION LOGGER
========================= */

window.logAdminAction = async function logAdminAction({
  entity_type,
  entity_id,
  action_type,
  reason = null,
}) {
  try {
    await fetch('/.netlify/functions/admin-log-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        entity_type,
        entity_id,
        action_type,
        reason,
      }),
    });
  } catch (err) {
    console.warn('[ADMIN LOG FAILED]', err);
  }
};

/* =========================
   READY GUARD
========================= */

window.waitForAdminReady = function waitForAdminReady(callback) {
  if (window.adminContext.isReady) {
    callback();
  } else {
    document.addEventListener('admin:ready', callback, { once: true });
  }
};
