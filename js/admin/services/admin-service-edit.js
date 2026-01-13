/*
  admin-service-edit.js
  ADMIN ONLY
  Полное редактирование услуги БЕЗ модерации
*/

import { supabase } from '/supabaseClient.js';

/* =========================
   PARAMS
========================= */

const params = new URLSearchParams(window.location.search);
const serviceId = params.get('id');

if (!serviceId) {
  alert('ID услуги не указан');
  throw new Error('Service ID missing');
}

/* =========================
   AUTH (ADMIN)
========================= */

const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  window.location.href = '/';
  throw new Error('No session');
}

// проверяем, что это админ
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', session.user.id)
  .single();

if (profileError || profile?.role !== 'admin') {
  alert('Нет прав администратора');
  window.location.href = '/';
  throw new Error('Not admin');
}

/* =========================
   ELEMENTS
========================= */

const form = document.getElementById('adminEditServiceForm');
const result = document.getElementById('result');

const titleEl = document.getElementById('title');
const descriptionEl = document.getElementById('description');
const priceEl = document.getElementById('price');
const locationEl = document.getElementById('location');
const contactPhoneEl = document.getElementById('contact_phone');

/* =========================
   LOAD SERVICE
========================= */

const { data: service, error: loadError } = await supabase
  .from('services')
  .select(`
    id,
    title,
    description,
    price,
    location,
    contact_phone,
    status
  `)
  .eq('id', serviceId)
  .single();

if (loadError || !service) {
  alert('Услуга не найдена');
  throw loadError;
}

/* =========================
   FILL FORM
========================= */

titleEl.value = service.title || '';
descriptionEl.value = service.description || '';
priceEl.value = service.price ?? '';
locationEl.value = service.location || '';
contactPhoneEl.value = service.contact_phone || '';

/* =========================
   SAVE (ADMIN)
========================= */

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  result.textContent = 'Сохраняем изменения…';

  const payload = {
    title: titleEl.value.trim(),
    description: descriptionEl.value.trim(),
    price: priceEl.value !== '' ? Number(priceEl.value) : null,
    location: locationEl.value.trim() || null,
    contact_phone: contactPhoneEl.value.trim() || null,

    // 🔥 КЛЮЧЕВОЕ: админ сразу публикует
    status: 'active',

    // админ подтвердил → сбрасываем diff
    admin_previous_data: null,
    admin_reject_reason: null,
  };

  const { error } = await supabase
    .from('services')
    .update(payload)
    .eq('id', serviceId);

  if (error) {
    console.error('[ADMIN FULL EDIT] UPDATE ERROR', error);
    result.textContent = 'Ошибка сохранения';
    return;
  }

  result.innerHTML = `
    <div style="
      padding:12px;
      background:#f0fff4;
      border:1px solid #c6f6d5;
      border-radius:10px;
      font-size:14px;
    ">
      ✅ Изменения сохранены и опубликованы
    </div>
  `;
});
