import fetch from 'node-fetch';

/* =========================
   CONFIG
========================= */
const BOT_TOKEN = '8547221152:AAGg6aoqZM2ASmGUXMX1RYJt-U1WFfhRuxY';
const SUPABASE_URL = 'https://mzkrwlbwrwyempyrhsrt.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16a3J3bGJ3cnd5ZW1weXJoc3J0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjAzNzEwMiwiZXhwIjoyMDgxNjEzMTAyfQ.vbzodWWgXc3RM37FkhuY43n3kdUO6vtJH9nBE5idnwE';

let offset = 0;
console.log('🤖 Telegram bot started');

/* =========================
   POLLING
========================= */
async function pollTelegram() {
  const res = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?timeout=30&offset=${offset}`
  );
  const data = await res.json();
  if (!data.ok || !Array.isArray(data.result)) return;

  for (const u of data.result) {
    offset = u.update_id + 1;

    /* CALLBACK BUTTONS */
    if (u.callback_query) {
      await handleCallback(u.callback_query);
      continue;
    }

    const msg = u.message;
    if (!msg?.text) continue;

    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (text === '/start') {
      await send(chatId, 'Введи email, с которым ты зарегистрирован на ActiveGo');
      continue;
    }

    const ok = await linkTelegram(text.toLowerCase(), chatId);
    await send(chatId, ok ? '✅ Telegram привязан' : '❌ Email не найден');
  }
}

/* =========================
   LINK TELEGRAM
========================= */
async function linkTelegram(email, chatId) {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=id&email=eq.${encodeURIComponent(email)}`,
    { headers: auth() }
  );
  const rows = await r.json();
  if (!rows.length) return false;

  await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${rows[0].id}`, {
    method: 'PATCH',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ telegram_id: chatId, notify_channel: 'telegram' }),
  });

  return true;
}

/* =========================
   NOTIFY PROVIDERS
========================= */
async function notifyProviders() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/bookings?` +
    `select=id,provider_id,booking_date,participants,total_price,services(title)&` +
    `status=eq.pending&provider_notified=eq.false`,
    { headers: auth() }
  );

  const bookings = await r.json();
  if (!bookings.length) return;

  for (const b of bookings) {
    const p = await getProfile(b.provider_id);
    if (!p) continue;

    const text = `
📢 Новое бронирование

🛎 Услуга: ${b.services?.title || '—'}
📅 Дата: ${b.booking_date}
👥 Участников: ${b.participants}
💰 Сумма: ${b.total_price} €
    `.trim();

    await sendWithButtons(p.telegram_id, text, b.id);
    await mark(b.id, { provider_notified: true });
  }
}

/* =========================
   NOTIFY CLIENTS
========================= */
async function notifyClients() {
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/bookings?` +
    `select=id,user_id,status,booking_date,participants,total_price,services(title)&` +
    `status=in.(approved,rejected)&client_notified=eq.false`,
    { headers: auth() }
  );

  const bookings = await r.json();
  if (!bookings.length) return;

  for (const b of bookings) {
    const c = await getProfile(b.user_id);
    if (!c) {
      await mark(b.id, { client_notified: true });
      continue;
    }

    const text = `
${b.status === 'approved' ? '✅ Бронирование подтверждено' : '❌ Бронирование отклонено'}

🛎 Услуга: ${b.services?.title || '—'}
📅 Дата: ${b.booking_date}
👥 Участников: ${b.participants}
💰 Сумма: ${b.total_price} €
    `.trim();

    await send(c.telegram_id, text);
    await mark(b.id, { client_notified: true });
  }
}

/* =========================
   CALLBACK
========================= */
async function handleCallback(q) {
  const [action, id] = q.data.split(':');
  if (!id) return;

  const status = action === 'approve' ? 'approved' : 'rejected';

  await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, client_notified: false }),
  });

  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: q.id }),
  });
}

/* =========================
   HELPERS
========================= */
function auth() {
  return {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  };
}

async function getProfile(id) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`, {
    headers: auth(),
  });
  const p = (await r.json())[0];
  return p?.notify_channel === 'telegram' && p.telegram_id ? p : null;
}

async function mark(id, body) {
  await fetch(`${SUPABASE_URL}/rest/v1/bookings?id=eq.${id}`, {
    method: 'PATCH',
    headers: { ...auth(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function send(chatId, text) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

async function sendWithButtons(chatId, text, bookingId) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: {
        inline_keyboard: [[
          { text: '✅ Подтвердить', callback_data: `approve:${bookingId}` },
          { text: '❌ Отклонить', callback_data: `reject:${bookingId}` },
        ]],
      },
    }),
  });
}

/* =========================
   START
========================= */
setInterval(pollTelegram, 3000);
setInterval(notifyProviders, 4000);
setInterval(notifyClients, 4000);
