import { supabase } from './supabaseClient.js';

/* ===============================
   SESSION CHECK
=============================== */
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  window.location.href = 'login.html';
  throw new Error('No session');
}

const userId = session.user.id;

/* ===============================
   LOAD PROFILE
=============================== */
const { data: profile, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();

if (error || !profile) {
  alert('Профиль не найден');
  throw error;
}

if (profile.role !== 'client') {
  window.location.href = 'index.html';
  throw new Error('Not client');
}
/* ===============================
   ENSURE EMAIL IN PROFILE
=============================== */
if (!profile.email && session.user.email) {
  await supabase
    .from('profiles')
    .update({
      email: session.user.email
    })
    .eq('id', userId);

  profile.email = session.user.email;
}

/* ===============================
   ELEMENTS
=============================== */
const form = document.getElementById('clientProfileForm');
const result = document.getElementById('result');

const nameInput = document.getElementById('name');
const emailInput = document.getElementById('email');
const notifyChannelSelect = document.getElementById('notify_channel');
const notifyValueInput = document.getElementById('notify_value');
const countryInput = document.getElementById('country');
const languageMainSelect = document.getElementById('language_main');

const extraLanguagesBox = document.getElementById('extraLanguages');
const addLanguageSelect = document.getElementById('addLanguageSelect');

/* ===============================
   STATE
=============================== */
let extraLanguages = Array.isArray(profile.languages_extra)
  ? [...profile.languages_extra]
  : [];

/* ===============================
   FILL FORM
=============================== */
nameInput.value = profile.name || '';
emailInput.value = session.user.email || '';
countryInput.value = profile.country || '';
languageMainSelect.value = profile.language_main || '';
notifyChannelSelect.value = profile.notify_channel || '';

/* --- contact value --- */
if (profile.notify_channel === 'telegram') {
  notifyValueInput.value = profile.telegram_username || '';
}
if (profile.notify_channel === 'whatsapp') {
  notifyValueInput.value = profile.whatsapp_phone || '';
}
if (profile.notify_channel === 'email') {
  notifyValueInput.value = profile.email || session.user.email;
}

/* ===============================
   NOTIFY PLACEHOLDER
=============================== */
function updateNotifyPlaceholder() {
  const channel = notifyChannelSelect.value;

  notifyValueInput.value = '';

  if (channel === 'email') {
    notifyValueInput.placeholder = 'Email для связи';
    notifyValueInput.value = session.user.email;
  } else if (channel === 'telegram') {
    notifyValueInput.placeholder = 'Telegram username или ID';
  } else if (channel === 'whatsapp') {
    notifyValueInput.placeholder = 'Номер WhatsApp с кодом страны';
  } else {
    notifyValueInput.placeholder = 'Выберите способ связи выше';
  }
}

notifyChannelSelect.addEventListener('change', updateNotifyPlaceholder);
updateNotifyPlaceholder();

/* ===============================
   EXTRA LANGUAGES UI
=============================== */
function renderExtraLanguages() {
  extraLanguagesBox.innerHTML = '';

  extraLanguages.forEach(lang => {
    const tag = document.createElement('div');
    tag.style.cssText = `
      display:inline-flex;
      align-items:center;
      padding:6px 10px;
      margin:4px;
      background:#edf2ff;
      border-radius:8px;
      font-size:13px;
      gap:6px;
    `;

    tag.innerHTML = `
      <span>${lang}</span>
      <button type="button" style="border:none;background:none;cursor:pointer;">✕</button>
    `;

    tag.querySelector('button').addEventListener('click', () => {
      extraLanguages = extraLanguages.filter(l => l !== lang);
      renderExtraLanguages();
    });

    extraLanguagesBox.appendChild(tag);
  });
}

renderExtraLanguages();

/* --- add language --- */
addLanguageSelect.addEventListener('change', () => {
  const value = addLanguageSelect.value;

  if (!value) return;
  if (extraLanguages.includes(value)) {
    addLanguageSelect.value = '';
    return;
  }

  extraLanguages.push(value);
  addLanguageSelect.value = '';
  renderExtraLanguages();
});

/* ===============================
   SAVE
=============================== */
form.addEventListener('submit', async e => {
  e.preventDefault();

  const payload = {
    name: nameInput.value.trim(),
    country: countryInput.value.trim() || null,
    language_main: languageMainSelect.value || null,
    languages_extra: extraLanguages.length ? extraLanguages : null,

    notify_channel: notifyChannelSelect.value || null,

    // 🔒 EMAIL — ВСЕГДА ИЗ AUTH
    email: session.user.email
  };

  // 📞 КОНТАКТ ДЛЯ УВЕДОМЛЕНИЙ
  if (payload.notify_channel === 'telegram') {
    payload.telegram_username = notifyValueInput.value.trim() || null;
    payload.whatsapp_phone = null;
  }

  if (payload.notify_channel === 'whatsapp') {
    payload.whatsapp_phone = notifyValueInput.value.trim() || null;
    payload.telegram_username = null;
  }

  if (payload.notify_channel === 'email') {
    // email уже установлен выше, тут ничего не меняем
    payload.telegram_username = null;
    payload.whatsapp_phone = null;
  }

  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId);

  if (error) {
    alert('Ошибка сохранения профиля');
    console.error(error);
    return;
  }

  result.innerHTML = `
    <div style="
      padding:14px;
      background:#e6fffa;
      border:1px solid #b2f5ea;
      border-radius:10px;
      font-size:14px;
    ">
      ✅ Профиль обновлён
    </div>
  `;
});

