import { supabase } from './supabaseClient.js';

/* =========================
   URL PARAMS
========================= */
const urlParams = new URLSearchParams(window.location.search);
const serviceId = urlParams.get('id');
const activeTab = urlParams.get('tab') || 'details';
const pageMode = urlParams.get('mode') || 'provider';

if (!serviceId) {
  alert('Ошибка: не передан ID услуги');
  throw new Error('Service ID is null');
}

/* =========================
   GLOBAL STATE
========================= */
let service = null;
let serviceLoaded = false;

/* =========================
   TAB LOGIC (SAFE)
========================= */
function setTabToUrl(tab) {
  const url = new URL(window.location.href);
  url.searchParams.set('tab', tab);
  window.history.replaceState({}, '', url);
}

function showTab(tab) {
  document.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab)
  );

  document.querySelectorAll('.tab-content').forEach(c => {
    c.style.display = c.id === `tab-${tab}` ? 'block' : 'none';
  });

  setTabToUrl(tab);

  if (!serviceLoaded) return;

  if (tab === 'availability') {
    if (service.activity_type === 'rental') {
      loadUnavailability();
    } else {
      loadDates();
    }
  }
}

/* =========================
   TAB CLICKS
========================= */
document.querySelector('.tabs')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  showTab(btn.dataset.tab);
});

/* =========================
   BASE ELEMENTS
========================= */
const form = document.getElementById('editServiceForm');
const result = document.getElementById('result');

const addDateForm = document.getElementById('addDateForm');
const datesList = document.getElementById('datesList');

const unavailabilityBlock = document.getElementById('unavailabilityBlock');
const addUnavailabilityForm = document.getElementById('addUnavailabilityForm');
const unavailabilityList = document.getElementById('unavailabilityList');

/* =========================
   AUTH + ROLE
========================= */
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  window.location.href = 'login-provider.html';
  throw new Error('Not authenticated');
}

const userId = session.user.id;

// получаем роль
const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', userId)
  .single();

if (profileError || !profile) {
  alert('Профиль не найден');
  throw profileError;
}

const USER_ROLE = profile.role;
const isAdminMode = USER_ROLE === 'admin' && pageMode === 'admin';

/* =========================
   LOAD SERVICE (EDIT)
========================= */
let query = supabase
  .from('services')
  .select(`
    id,
    provider_id,
    title,
    description,
    price,
    location,
    contact_phone,
    status,
    activity_type,
    total_units
  `)
  .eq('id', serviceId);

// 🔐 если НЕ админ — только свои услуги
if (!isAdminMode) {
  query = query.eq('provider_id', userId);
}

const { data: loadedService, error } = await query.single();

if (error || !loadedService) {
  alert('Услуга не найдена или у вас нет прав');
  throw error;
}

/* =========================
   ASSIGN + INIT
========================= */
service = loadedService;
serviceLoaded = true;

showTab(activeTab);

/* =========================
   FILL EDIT FORM (COMMON)
========================= */
if (form) {
  const titleInput = document.getElementById('title');
  const descriptionInput = document.getElementById('description');
  const priceInput = document.getElementById('price');
  const locationInput = document.getElementById('location');
  const contactPhoneInput = document.getElementById('contact_phone');

  if (titleInput) titleInput.value = service.title ?? '';
  if (descriptionInput) descriptionInput.value = service.description ?? '';
  if (priceInput) priceInput.value = service.price ?? '';
  if (locationInput) locationInput.value = service.location ?? '';
  if (contactPhoneInput)
    contactPhoneInput.value = service.contact_phone ?? '';
}

/* =========================
   TOTAL UNITS (RENTAL ONLY)
========================= */
const totalUnitsField =
  document.getElementById('totalUnitsField');
const totalUnitsInput =
  document.getElementById('total_units');

if (service.activity_type === 'rental') {
  if (totalUnitsField) {
    totalUnitsField.style.display = 'block';
  }

  if (totalUnitsInput) {
    totalUnitsInput.value =
      Number.isInteger(service.total_units)
        ? service.total_units
        : '';
  }
}

/* =========================
   PAGE HEADER + DETAILS TAB
========================= */
const serviceTitleEl = document.getElementById('serviceTitle');
if (serviceTitleEl) {
  serviceTitleEl.textContent = service.title;
}

// details (read-only)
const detailTitle = document.getElementById('detailTitle');
const detailDescription =
  document.getElementById('detailDescription');
const detailPrice = document.getElementById('detailPrice');
const detailStatus = document.getElementById('detailStatus');

if (detailTitle) detailTitle.textContent = service.title;
if (detailDescription)
  detailDescription.textContent = service.description;
if (detailPrice) detailPrice.textContent = service.price;
if (detailStatus) detailStatus.textContent = service.status;

/* =========================
   SWITCH AVAILABILITY MODEL
========================= */
if (service.activity_type === 'rental') {
  if (unavailabilityBlock)
    unavailabilityBlock.style.display = 'block';

  if (addDateForm)
    addDateForm.closest('.card').style.display = 'none';
} else {
  if (unavailabilityBlock)
    unavailabilityBlock.style.display = 'none';
}

/* =========================
   SAVE SERVICE (EDIT TAB) — FINAL
========================= */
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    result.textContent = 'Сохраняем изменения…';

    const titleEl = document.getElementById('title');
    const descriptionEl = document.getElementById('description');
    const priceEl = document.getElementById('price');

    const meetingAddressEl =
      document.getElementById('meeting_address');
    const meetingMapLinkEl =
      document.getElementById('meeting_map_link');
    const contactPhoneEl =
      document.getElementById('contact_phone');

    const totalUnitsInput =
      document.getElementById('total_units');
  
    /* =========================
       LOAD CURRENT VERSION
    ========================= */
    const { data: currentService, error: loadError } = await supabase
      .from('services')
      .select(`
        title,
        description,
        price,
        meeting_address,
        meeting_map_link,
        contact_phone,
        activity_type,
        total_units,
        status
      `)
      .eq('id', serviceId)
      .single();

    if (loadError || !currentService) {
      console.error('[EDIT SERVICE] LOAD CURRENT ERROR', loadError);
      result.textContent = 'Ошибка загрузки услуги';
      return;
    }

    /* =========================
       PAYLOAD
    ========================= */
    const payload = {
      title:
        titleEl && titleEl.value.trim() !== ''
          ? titleEl.value.trim()
          : currentService.title,

      description:
        descriptionEl && descriptionEl.value.trim() !== ''
          ? descriptionEl.value.trim()
          : currentService.description,

      price:
        priceEl && !Number.isNaN(Number(priceEl.value))
          ? Number(priceEl.value)
          : currentService.price,

      meeting_address:
        meetingAddressEl && meetingAddressEl.value.trim() !== ''
          ? meetingAddressEl.value.trim()
          : currentService.meeting_address ?? null,

      meeting_map_link:
        meetingMapLinkEl && meetingMapLinkEl.value.trim() !== ''
          ? meetingMapLinkEl.value.trim()
          : currentService.meeting_map_link ?? null,

      contact_phone:
        contactPhoneEl && contactPhoneEl.value.trim() !== ''
          ? contactPhoneEl.value.trim()
          : currentService.contact_phone ?? null,

      // 🔑 статус
      status: isAdminMode ? 'active' : 'pending'
    };

    /* ===== TOTAL UNITS (RENTAL) ===== */
    if (
      currentService.activity_type === 'rental' &&
      totalUnitsInput &&
      Number.isInteger(Number(totalUnitsInput.value)) &&
      Number(totalUnitsInput.value) > 0
    ) {
      payload.total_units = Number(totalUnitsInput.value);
    }

    /* =========================
       SAVE SNAPSHOT ONLY ON PROVIDER EDIT
    ========================= */
    if (!isAdminMode && currentService.status === 'active') {
      payload.admin_previous_data = currentService;
    }

    console.log('[EDIT SERVICE] FINAL UPDATE PAYLOAD', payload);

    /* =========================
   UPDATE
========================= */

if (isAdminMode) {
  // 🛡 ADMIN — через Netlify Function (service_role)
  const res = await fetch('/.netlify/functions/admin-service-edit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      service_id: serviceId,
      payload,
    }),
  });

  if (!res.ok) {
    result.textContent = 'Ошибка сохранения (admin)';
    return;
  }

  result.textContent = 'Изменения опубликованы администратором ✅';

} else {
  // 👤 PROVIDER — обычный flow (RLS)
  const { error } = await supabase
    .from('services')
    .update(payload)
    .eq('id', serviceId)
    .eq('provider_id', userId);

  if (error) {
    console.error('[EDIT SERVICE] UPDATE ERROR', error);
    result.textContent = 'Ошибка сохранения изменений';
    return;
  }

  result.textContent = 'Изменения отправлены на модерацию 🕒';
}
  });
}  

/* =========================
   SERVICE DATES (TOURS / ACTIVITIES)
========================= */
async function loadDates() {
  const { data, error } = await supabase
    .from('service_dates')
    .select('*')
    .eq('service_id', serviceId)
    .order('date', { ascending: true });

  if (error) {
    console.error(error);
    datesList.innerHTML = '<p>Ошибка загрузки дат</p>';
    return;
  }

  if (!data.length) {
    datesList.innerHTML = '<p>Даты ещё не добавлены</p>';
    return;
  }

  datesList.innerHTML = data.map(d => {
    const locked = d.booked > 0;

    return `
      <div class="booking-row" data-id="${d.id}" style="margin-bottom:10px;">
        <strong>${d.date}</strong>
        <span>Мест: ${d.capacity}</span>
        <span>Цена: ${d.price_override ?? service.price} €</span>
        ${locked ? `<span style="color:red;margin-left:6px;">Есть бронирования</span>` : ''}
        <button
          class="btn btn-small btn-outline delete-date"
          ${locked ? 'disabled' : ''}
        >
          Удалить
        </button>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.delete-date').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const row = e.target.closest('.booking-row');
      const dateId = row.dataset.id;

      if (!confirm('Удалить эту дату?')) return;

      const { error } = await supabase
        .from('service_dates')
        .delete()
        .eq('id', dateId);

      if (error) {
        alert('Ошибка удаления');
        return;
      }

      loadDates();
    });
  });
}

/* =========================
   INIT TOUR DATES LOGIC (CORRECT)
========================= */
if (
  activeTab === 'availability' &&
  service.activity_type !== 'rental'
) {
  loadDates();

  const capacityInput =
    document.getElementById('capacity');

  const priceOverrideInput =
    document.getElementById('price_override');

  // базовая цена по умолчанию
  if (priceOverrideInput && service.price) {
    priceOverrideInput.value = service.price;
  }

  addDateForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const date =
      document.getElementById('date').value;

    const capacity =
      Number(capacityInput.value);

    const rawPrice =
      priceOverrideInput.value;

    if (!date) {
      alert('Выберите дату');
      return;
    }

    if (!Number.isInteger(capacity) || capacity < 1) {
      alert('Укажите корректное количество мест');
      return;
    }

    const priceOverride =
      rawPrice === '' ||
      Number(rawPrice) === Number(service.price)
        ? null
        : Number(rawPrice);

    const { error } = await supabase
      .from('service_dates')
      .insert({
        service_id: serviceId,
        date,
        capacity,
        price_override: priceOverride,
        status: 'active',
        booked: 0
      });

    if (error) {
      if (error.code === '23505') {
        alert('Эта дата уже добавлена');
      } else {
        console.error(error);
        alert('Ошибка добавления даты');
      }
      return;
    }

    addDateForm.reset();

    if (priceOverrideInput && service.price) {
      priceOverrideInput.value = service.price;
    }

    loadDates();
  });
}

/* =========================
   SERVICE UNAVAILABILITY (RENTAL)
========================= */

async function loadUnavailability() {
  const { data, error } = await supabase
    .from('service_unavailability')
    .select('*')
    .eq('service_id', serviceId)
    .order('date_from', { ascending: true });

  if (error) {
    console.error(error);
    unavailabilityList.innerHTML = '<p>Ошибка загрузки периодов</p>';
    return;
  }

  if (!data.length) {
    unavailabilityList.innerHTML = '<p>Периоды недоступности не заданы</p>';
    return;
  }

  unavailabilityList.innerHTML = data.map(p => `
    <div class="booking-row" data-id="${p.id}" style="margin-bottom:10px;">
      <strong>${p.date_from}</strong> — <strong>${p.date_to}</strong>
      ${
        p.blocked_units === null
          ? `<span style="margin-left:8px;color:#c00;">Полная блокировка</span>`
          : `<span style="margin-left:8px;color:#555;">
               Недоступно: ${p.blocked_units} из ${service.total_units}
             </span>`
      }
      ${p.reason ? `<span style="margin-left:10px;color:#666;">${p.reason}</span>` : ''}
      <button class="btn btn-small btn-outline delete-unavailability">
        Удалить
      </button>
    </div>
  `).join('');

  document.querySelectorAll('.delete-unavailability').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const row = e.target.closest('.booking-row');
      const id = row.dataset.id;

      if (!confirm('Удалить период недоступности?')) return;

      const { error } = await supabase
        .from('service_unavailability')
        .delete()
        .eq('id', id);

      if (error) {
        alert('Ошибка удаления');
        return;
      }

      loadUnavailability();
    });
  });
}

/* =========================
   ADD UNAVAILABILITY (RENTAL)
========================= */

if (
  activeTab === 'availability' &&
  service.activity_type === 'rental'
) {
  loadUnavailability();

  const blockedUnitsInputEl =
    document.getElementById('blockedUnits');

  /* =========================
     LIVE LIMIT FOR BLOCKED UNITS
     (1 .. total_units)
  ========================= */
  if (blockedUnitsInputEl) {
    blockedUnitsInputEl.addEventListener('input', () => {
      if (blockedUnitsInputEl.value === '') return;

      let value = Number(blockedUnitsInputEl.value);
      const max = service.total_units;

      if (Number.isNaN(value)) {
        blockedUnitsInputEl.value = '';
        return;
      }

      if (value < 1) {
        blockedUnitsInputEl.value = 1;
      }

      if (value > max) {
        blockedUnitsInputEl.value = max;
      }
    });
  }

  /* =========================
   SUBMIT UNAVAILABILITY
========================= */
addUnavailabilityForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const dateFrom =
    document.getElementById('unavailableFrom').value;
  const dateTo =
    document.getElementById('unavailableTo').value;

  const rawReason =
    document.getElementById('unavailableReason').value.trim();
  const reason = rawReason === '' ? null : rawReason;

  const blockedUnitsRaw =
    document.getElementById('blockedUnits').value;

  /* =========================
     BASIC VALIDATION
  ========================= */
  if (!dateFrom || !dateTo) {
    alert('Укажите даты');
    return;
  }

  if (dateFrom > dateTo) {
    alert('Дата "с" не может быть позже даты "по"');
    return;
  }

  /* =========================
     TOTAL UNITS VALIDATION
  ========================= */
  const maxUnits = Number(service.total_units);

  if (!Number.isInteger(maxUnits) || maxUnits < 1) {
    alert('Ошибка конфигурации услуги: неверное общее количество единиц');
    return;
  }

  /* =========================
     BLOCKED UNITS LOGIC
     null → полная блокировка
  ========================= */
  let blockedUnits = null;

  if (blockedUnitsRaw !== '') {
    blockedUnits = Number(blockedUnitsRaw);

    if (!Number.isInteger(blockedUnits) || blockedUnits < 1) {
      alert('Количество должно быть положительным числом');
      return;
    }

    if (blockedUnits > maxUnits) {
      alert(`Нельзя заблокировать больше ${maxUnits} единиц`);
      return;
    }
  }

    /* =========================
       INSERT
    ========================= */
    const { error } = await supabase
      .from('service_unavailability')
      .insert({
        service_id: serviceId,
        date_from: dateFrom,
        date_to: dateTo,
        blocked_units: blockedUnits, // null = полная блокировка
        reason: reason
      });

    if (error) {
      console.error(error);
      alert('Ошибка добавления периода');
      return;
    }

    addUnavailabilityForm.reset();
    loadUnavailability();
  });
}
