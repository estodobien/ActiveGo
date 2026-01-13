import { supabase } from './supabaseClient.js';
/* =========================
   PAGE MODE
========================= */
const urlParams = new URLSearchParams(window.location.search);
const editServiceId = urlParams.get('id');
const pageMode = urlParams.get('mode');

const isAdminEdit = pageMode === 'admin' && !!editServiceId;

/* =========================
   АВТОРИЗАЦИЯ
========================= */
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  window.location.href = 'login-provider.html';
  throw new Error('Not authenticated');
}

const providerId = session.user.id;

let providerName = null;

const { data: providerProfile } = await supabase
  .from('profiles')
  .select('company_name, name')
  .eq('id', providerId)
  .single();

if (providerProfile) {
  providerName =
    providerProfile.company_name ||
    providerProfile.name ||
    null;
}

/* =========================
   ADMIN EDIT UI
========================= */
if (isAdminEdit) {
  const pageTitle = document.getElementById('pageTitle');
  const pageHint = document.getElementById('pageHint');

  if (pageTitle) {
    pageTitle.textContent = 'Полное редактирование услуги';
  }

  if (pageHint) {
    pageHint.textContent =
      'Изменения будут опубликованы сразу без повторной модерации.';
  }
}
if (isAdminEdit) {
  const submitBtn = document.getElementById('submitBtn');
  if (submitBtn) {
    submitBtn.textContent = 'Сохранить изменения';
  }
}
/* =========================
   ADMIN EDIT — DISABLE REQUIRED
========================= */
if (isAdminEdit) {
  document
    .querySelectorAll('[required]')
    .forEach(el => el.removeAttribute('required'));
}

/* =========================
   SAFE HELPERS
========================= */
const byId = (id) => document.getElementById(id);
const hide = (el) => { if (el) el.style.display = 'none'; };
const show = (el) => { if (el) el.style.display = 'block'; };

/* =========================
   BASE ELEMENTS
========================= */
const form = byId('addServiceForm');
const result = byId('result');

const activityTypeInput = byId('activityType');

/* 🔽 pricing */
const pricingTypeInput = byId('pricing_type');
const unitLabelInput = byId('unit_label');

const titleInput = byId('title');
const descriptionInput = byId('description');
const serviceFlowInput = byId('serviceFlow');
const serviceFlowField = byId('serviceFlowField');

const priceInput = byId('price');

const durationMinInput = byId('durationMin');
const durationMaxInput = byId('durationMax');
const durationField = byId('durationField');

const meetingAddressInput = byId('meetingAddress');
const meetingMapLinkInput = byId('meetingMapLink');

const instructionsInput = byId('eventDayInstructions');
const contactPhoneInput = byId('contactPhone');
const cancellationPolicyInput = byId('cancellationPolicy');

const mainImageInput = byId('mainImage');
const galleryImagesInput = byId('galleryImages');

/* =========================
   TYPE BLOCKS
========================= */
const tourFields = byId('tourFields');
const experienceFields = byId('experienceFields');
const rentalFields = byId('rentalFields');
const accommodationFields = byId('accommodationFields');
const restaurantFields = byId('restaurantFields');

/* =========================
   TYPE INPUTS
========================= */
// EXPERIENCE
const experienceMinAgeInput = byId('experienceMinAge');
const experienceDifficultyInput = byId('experienceDifficulty');
const experienceWeatherInput = byId('experienceWeather');
const experienceKidsInput = byId('experienceKids');

// RENTAL
const rentalPriceUnitInput = byId('rentalPriceUnit');
const totalUnitsInput = byId('totalUnits');
const depositRequiredInput = byId('depositRequired');
const depositAmountInput = byId('depositAmount');
const documentsRequiredInput = byId('documentsRequired');
const includedItemsInput = byId('includedItems');

// ACCOMMODATION
const accommodationTypeInput = byId('accommodationType');
const accommodationGuestsInput = byId('accommodationGuests');
const accommodationBedroomsInput = byId('accommodationBedrooms');
const accommodationBathroomsInput = byId('accommodationBathrooms');
const accommodationKidsInput = byId('accommodationKids');
const accommodationPetsInput = byId('accommodationPets');
const accommodationAmenitiesInput = byId('accommodationAmenities');

// RESTAURANT
const restaurantOfferTypeInput = byId('restaurantOfferType');
const restaurantCuisineInput = byId('restaurantCuisine');
const restaurantFormatInput = byId('restaurantFormat');

// TOUR
const tourCapacityInput = byId('tourCapacity');
const tourDateInput = byId('tourDate');

/* =========================
   VISIBILITY LOGIC
========================= */
function resetTypeBlocks() {
  hide(tourFields);
  hide(experienceFields);
  hide(rentalFields);
  hide(accommodationFields);
  hide(restaurantFields);
}

activityTypeInput.addEventListener('change', () => {
  const type = activityTypeInput.value;

  resetTypeBlocks();

  if (type === 'experience') show(experienceFields);
  if (type === 'rental') show(rentalFields);
  if (type === 'tour') show(tourFields);
  if (type === 'accommodation') show(accommodationFields);
  if (type === 'restaurant') show(restaurantFields);

  const hideFlowAndDuration =
    type === 'rental' || type === 'accommodation' || type === 'restaurant';

  if (serviceFlowField) {
    serviceFlowField.style.display = hideFlowAndDuration ? 'none' : 'block';
  }

  if (durationField) {
    durationField.style.display = hideFlowAndDuration ? 'none' : 'block';
  }
});
/* =========================
   LOAD SERVICE FOR ADMIN EDIT
========================= */
async function loadServiceForAdminEdit() {
  const { data: service, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', editServiceId)
    .single();

  if (error || !service) {
    result.textContent = 'Не удалось загрузить услугу';
    throw error;
  }

  populateForm(service);
}
/* =========================
   POPULATE FORM (ADMIN EDIT)
========================= */
function populateForm(service) {
  // BASIC
  activityTypeInput.value = service.activity_type;
  activityTypeInput.dispatchEvent(new Event('change'));

  pricingTypeInput.value = service.pricing_type || 'per_person';
  unitLabelInput.value = service.unit_label || 'person';

  titleInput.value = service.title || '';
  descriptionInput.value = service.description || '';
  priceInput.value = service.price ?? '';

  // FLOW + DURATION
  if (service.service_flow && serviceFlowInput) {
    serviceFlowInput.value = service.service_flow;
  }

  if (durationMinInput) durationMinInput.value = service.duration_min ?? '';
  if (durationMaxInput) durationMaxInput.value = service.duration_max ?? '';

  // ADDRESS
  meetingAddressInput.value = service.meeting_address || '';
  meetingMapLinkInput.value = service.meeting_map_link || '';

  instructionsInput.value = service.event_day_instructions || '';
  contactPhoneInput.value = service.contact_phone || '';
  cancellationPolicyInput.value = service.cancellation_policy || '';

  // RENTAL
  if (service.activity_type === 'rental' && service.activity_details) {
    totalUnitsInput.value = service.total_units ?? '';

    rentalPriceUnitInput.value =
      service.activity_details.price_unit || 'day';

    depositRequiredInput.checked =
      service.activity_details.deposit_required || false;

    depositAmountInput.value =
      service.activity_details.deposit_amount || 0;

    documentsRequiredInput.value =
      service.activity_details.documents_required || '';

    includedItemsInput.value =
      service.activity_details.included_items || '';
  }

  // EXPERIENCE
  if (service.activity_type === 'experience' && service.activity_details) {
    experienceMinAgeInput.value =
      service.activity_details.min_age ?? '';

    experienceDifficultyInput.value =
      service.activity_details.difficulty || '';

    experienceWeatherInput.checked =
      service.activity_details.weather_dependent || false;

    experienceKidsInput.checked =
      service.activity_details.kids_allowed || false;
  }

  // ACCOMMODATION
  if (service.activity_type === 'accommodation' && service.activity_details) {
    accommodationTypeInput.value =
      service.activity_details.type || '';

    accommodationGuestsInput.value =
      service.activity_details.max_guests ?? '';

    accommodationBedroomsInput.value =
      service.activity_details.bedrooms ?? '';

    accommodationBathroomsInput.value =
      service.activity_details.bathrooms ?? '';

    accommodationKidsInput.checked =
      service.activity_details.kids_allowed || false;

    accommodationPetsInput.checked =
      service.activity_details.pets_allowed || false;

    accommodationAmenitiesInput.value =
      service.activity_details.amenities || '';
  }

  // RESTAURANT
  if (service.activity_type === 'restaurant' && service.activity_details) {
    restaurantOfferTypeInput.value =
      service.activity_details.offer_type || 'table';

    restaurantCuisineInput.value =
      service.activity_details.cuisine || '';

    restaurantFormatInput.value =
      service.activity_details.format || '';
  }
}
/* =========================
   INIT ADMIN EDIT
========================= */
if (isAdminEdit) {
  await loadServiceForAdminEdit();
}
/* =========================
   SUBMIT
========================= */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  result.textContent = 'Создаём услугу…';

  try {
    const activity_type = activityTypeInput.value;
    let total_units = null;

    /* ===== RENTAL VALIDATION ===== */
    if (!isAdminEdit && activity_type === 'rental') {
  total_units = Number(totalUnitsInput?.value);
  if (!total_units || total_units < 1) {
    result.textContent = 'Укажите общее количество единиц';
    return;
  }
}

    /* ===== TOUR DATA (VALIDATION ONLY FOR CREATE) ===== */
let tour_capacity = null;
let tour_date = null;

if (activity_type === 'tour') {
  tour_capacity = Number(tourCapacityInput?.value);
  tour_date = tourDateInput?.value;

  if (!isAdminEdit) {
    if (!tour_capacity || tour_capacity < 1) {
      result.textContent = 'Укажите максимальное количество участников';
      return;
    }

    if (!tour_date) {
      result.textContent = 'Укажите дату первого тура';
      return;
    }
  }
}

if (!isAdminEdit && !activity_type) {
  result.textContent = 'Выберите тип услуги';
  return;
}

    /* ===== PRICING ===== */
    const pricing_type = pricingTypeInput?.value || 'per_person';
    const unit_label =
      activity_type === 'tour'
        ? 'person'
        : unitLabelInput?.value?.trim() || 'person';

    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();
    const price = Number(priceInput.value);
    const meeting_address = meetingAddressInput.value.trim();
    const meeting_map_link = meetingMapLinkInput.value.trim();
    const instructions = instructionsInput.value.trim();
    const contact_phone = contactPhoneInput.value.trim();
    const cancellation_policy = cancellationPolicyInput.value.trim();

    let service_flow = null;
    let duration_min = 1;
    let duration_max = 1;

    if (!['rental', 'accommodation', 'restaurant'].includes(activity_type)) {
      service_flow = serviceFlowInput?.value.trim() || null;
      duration_min = Number(durationMinInput?.value);
      duration_max = Number(durationMaxInput?.value);

      if (!isAdminEdit && duration_min > duration_max) {
  result.textContent = 'Ошибка: минимальная длительность больше максимальной';
  return;
}
    }

    const mainImageFile = mainImageInput.files[0];
    if (!isAdminEdit && !mainImageFile) {
  result.textContent = 'Добавьте главное фото';
  return;
}

    /* ===== ACTIVITY DETAILS ===== */
    let activity_details = {};

    if (activity_type === 'experience') {
      activity_details = {
        min_age: experienceMinAgeInput?.value
          ? Number(experienceMinAgeInput.value)
          : null,
        difficulty: experienceDifficultyInput?.value || null,
        weather_dependent: experienceWeatherInput?.checked || false,
        kids_allowed: experienceKidsInput?.checked || false
      };
    }

    if (activity_type === 'rental') {
      activity_details = {
        price_unit: rentalPriceUnitInput?.value || 'day',
        deposit_required: depositRequiredInput?.checked || false,
        deposit_amount: depositRequiredInput?.checked
          ? Number(depositAmountInput?.value) || 0
          : 0,
        documents_required: documentsRequiredInput?.value.trim() || '',
        included_items: includedItemsInput?.value.trim() || ''
      };
    }

    if (activity_type === 'accommodation') {
      activity_details = {
        type: accommodationTypeInput?.value || null,
        max_guests: accommodationGuestsInput?.value
          ? Number(accommodationGuestsInput.value)
          : null,
        bedrooms: accommodationBedroomsInput?.value
          ? Number(accommodationBedroomsInput.value)
          : null,
        bathrooms: accommodationBathroomsInput?.value
          ? Number(accommodationBathroomsInput.value)
          : null,
        kids_allowed: accommodationKidsInput?.checked || false,
        pets_allowed: accommodationPetsInput?.checked || false,
        amenities: accommodationAmenitiesInput?.value.trim() || ''
      };
    }

    if (activity_type === 'restaurant') {
      activity_details = {
        offer_type: restaurantOfferTypeInput?.value || 'table',
        cuisine: restaurantCuisineInput?.value.trim() || '',
        format: restaurantFormatInput?.value || ''
      };
    }

    /* =========================
   CREATE / ADMIN UPDATE
========================= */

let serviceId;

if (isAdminEdit) {
  // 🛡 ADMIN — update existing service
  serviceId = editServiceId;

  const res = await fetch('/.netlify/functions/admin-service-edit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      service_id: serviceId,
      payload: {
        activity_type,
        pricing_type,
        unit_label,
        title,
        description,
        service_flow,
        price,
        total_units,
        duration_min,
        duration_max,
        meeting_address,
        meeting_map_link,
        event_day_instructions: instructions,
        contact_phone,
        cancellation_policy,
        activity_details,
        status: 'active'
      }
    }),
  });

  if (!res.ok) {
    result.textContent = 'Ошибка сохранения изменений (admin)';
    return;
  }

} else {
  // 👤 PROVIDER — create new service
  const { data: service, error } = await supabase
    .from('services')
    .insert({
      provider_id: providerId,
      provider_name: providerName,
      activity_type,
      pricing_type,
      unit_label,
      title,
      description,
      service_flow,
      price,
      total_units,
      duration_min,
      duration_max,
      meeting_address,
      meeting_map_link,
      event_day_instructions: instructions,
      contact_phone,
      cancellation_policy,
      activity_details,
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw error;

  serviceId = service.id;
}

    /* ===== CREATE FIRST TOUR DATE (ONLY CREATE) ===== */
if (!isAdminEdit && activity_type === 'tour') {

      const { error: dateError } = await supabase
        .from('service_dates')
        .insert({
          service_id: serviceId,
          date: tour_date,
          capacity: tour_capacity,
          booked: 0,
          status: 'active'
        });

      if (dateError) {
        console.error(dateError);
        result.textContent = 'Ошибка при создании даты тура';
        return;
      }
    }

    /* =========================
   IMAGES (CREATE + ADMIN EDIT)
========================= */
let mainImageUrl = null;
let galleryUrls = [];

// ===== MAIN IMAGE =====
if (mainImageFile) {
  const mainPath = `${providerId}/${serviceId}/main.jpg`;

  await supabase.storage
    .from('service-images')
    .upload(mainPath, mainImageFile, { upsert: true });

  const { data } = supabase.storage
    .from('service-images')
    .getPublicUrl(mainPath);

  mainImageUrl = data.publicUrl;
}

// ===== GALLERY =====
for (let i = 0; i < galleryImagesInput.files.length; i++) {
  const file = galleryImagesInput.files[i];
  const path = `${providerId}/${serviceId}/${i + 1}.jpg`;

  await supabase.storage
    .from('service-images')
    .upload(path, file, { upsert: true });

  const { data } = supabase.storage
    .from('service-images')
    .getPublicUrl(path);

  galleryUrls.push(data.publicUrl);
}

// ===== UPDATE IMAGE URLS ONLY IF CHANGED =====
if (mainImageUrl || galleryUrls.length) {
  await supabase
    .from('services')
    .update({
      ...(mainImageUrl ? { main_image: mainImageUrl } : {}),
      ...(galleryUrls.length ? { gallery_images: galleryUrls } : {})
    })
    .eq('id', serviceId);
}

// ===== RESULT =====
result.textContent = isAdminEdit
  ? 'Изменения опубликованы администратором ✅'
  : 'Услуга успешно отправлена на модерацию ✅';

if (isAdminEdit) {
  // 🔁 redirect back to admin service view
  setTimeout(() => {
    window.location.href =
     `/admin/admin-layout.html?page=service-view&id=${serviceId}`;

  }, 800);
} else {
  form.reset();
  resetTypeBlocks();
}

} catch (err) {
  console.error(err);
  result.textContent = isAdminEdit
    ? 'Ошибка при обновлении услуги'
    : 'Ошибка при создании услуги';
}
});


