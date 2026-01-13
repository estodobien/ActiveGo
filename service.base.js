import { supabase } from './supabaseClient.js';
import { initRentalLogic } from './service.rental.js';
import { initTourLogic } from './service.tour.js';

/* =========================
   USER ROLE + SESSION
========================= */
let USER_ROLE = 'guest';
let CURRENT_SESSION = null;

const { data: { session } } = await supabase.auth.getSession();
CURRENT_SESSION = session;

if (session) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  USER_ROLE = profile?.role || 'client';
}

/* =========================
   SERVICE ID + MODE
========================= */
const params = new URLSearchParams(window.location.search);
const serviceId = params.get('id');
const isAdminMode =
  params.get('mode') === 'admin' && USER_ROLE === 'admin';

const container = document.getElementById('serviceDetails');

if (!serviceId) {
  container.innerHTML = '<p>Услуга не найдена</p>';
  throw new Error('Service ID missing');
}

/* =========================
   LOAD SERVICE
========================= */
let service = null;

if (isAdminMode) {
  const res = await fetch(`/.netlify/functions/admin-service-get?id=${serviceId}`);
  if (!res.ok) {
    container.innerHTML = '<p>Услуга не найдена</p>';
    throw new Error('Admin service load failed');
  }
  service = await res.json();
} else {
  const { data, error } = await supabase
    .from('services')
    .select(`
      id,
      provider_id,
      provider_name,
      title,
      description,
      price,
      pricing_type,
      unit_label,
      duration_min,
      duration_max,
      location,
      main_image,
      gallery_images,
      activity_type,
      total_units,
      rental_day_mode,
      service_flow,
      meeting_address,
      meeting_map_link,
      event_day_instructions,
      cancellation_policy,
      contact_phone,
      activity_details
    `)
    .eq('id', serviceId)
    .eq('status', 'active')
    .single();

  if (error || !data) {
    container.innerHTML = '<p>Услуга не найдена</p>';
    throw error;
  }

  service = data;
}

/* =========================
   META DATA
========================= */
const providerDisplayName =
  service.provider_name && service.provider_name.trim()
    ? service.provider_name
    : 'Поставщик еще не заполнил свои данные';

/* реальные бронирования */
let bookingsCount = 0;
const { count: bookingsCnt, error: bookingsErr } = await supabase
  .from('orders')
  .select('id', { count: 'exact', head: true })
  .eq('service_id', service.id)
  .in('status', ['approved', 'completed']);

if (!bookingsErr && typeof bookingsCnt === 'number') {
  bookingsCount = bookingsCnt;
}

/* =========================
   NORMALIZATION
========================= */
const UNIT_LABEL =
  service.unit_label ||
  (service.pricing_type === 'per_unit' ? 'ед.' : 'чел.');

/* =========================
   CART STATE
========================= */
let cartData = {
  service_date_id: null,
  booking_date: null,
  booking_date_from: null,
  booking_date_to: null,
  quantity: 1,
  unit_price: service.price,
  total_price: service.price
};

/* =========================
   LOAD DATA
========================= */
let rentalCalendar = [];
let serviceDates = [];

if (service.activity_type === 'rental') {
  const today = new Date().toISOString().slice(0, 10);
  const to = new Date();
  to.setDate(to.getDate() + 120);

  const { data, error } = await supabase.rpc(
    'get_rental_calendar',
    {
      p_service_id: serviceId,
      p_date_from: today,
      p_date_to: to.toISOString().slice(0, 10)
    }
  );

  if (error) console.error('RPC calendar error', error);
  rentalCalendar = data || [];
} else {
  const { data, error } = await supabase
    .from('service_dates')
    .select('*')
    .eq('service_id', serviceId)
    .eq('status', 'active')
    .order('date', { ascending: true });

  if (error) console.error('Service dates load error', error);
  serviceDates = data || [];
}

/* =========================
   GALLERY
========================= */
const images =
  [service.main_image, ...(service.gallery_images || [])].filter(Boolean);

let currentIndex = 0;

function renderGallery() {
  if (!images.length) {
    return `<p><em>Фотографии будут добавлены позже</em></p>`;
  }

  return `
    <div class="gallery">
      <div class="gallery-main">
        <button class="gallery-btn left" onclick="prevImage()">‹</button>
        <img src="${images[currentIndex]}" />
        <button class="gallery-btn right" onclick="nextImage()">›</button>
      </div>

      <div class="gallery-thumbs">
        ${images.map((img, index) => `
          <img
            src="${img}"
            class="${index === currentIndex ? 'active' : ''}"
            onclick="setImage(${index})"
          />
        `).join('')}
      </div>
    </div>
  `;
}

/* =========================
   CONTENT RENDERERS
========================= */
function renderTourContent(service) {
  return `
    ${service.service_flow ? `
      <section class="service-block">
        <h3>Как проходит тур</h3>
        <pre>${service.service_flow}</pre>
      </section>
    ` : ''}

    ${(service.duration_min || service.duration_max) ? `
      <section class="service-block">
        <h3>Продолжительность</h3>
        <p>${service.duration_min}–${service.duration_max} часов</p>
      </section>
    ` : ''}

    ${service.meeting_address ? `
  <section class="service-block">
    <h3>📍 Место встречи</h3>

    <p style="font-size:14px;color:#666;">
      Точка сбора перед началом тура.
      Отсюда начинается поездка.
    </p>

    <p><strong>${service.meeting_address}</strong></p>

    <iframe
      src="${
        service.meeting_map_link?.includes('embed')
          ? service.meeting_map_link
          : `https://www.google.com/maps?q=${encodeURIComponent(service.meeting_address)}&output=embed`
      }"
      width="100%"
      height="260"
      style="border:0;border-radius:10px;margin-top:8px;"
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade">
    </iframe>
  </section>
` : ''}

    ${service.event_day_instructions ? `
      <section class="service-block">
        <h3>В день тура</h3>
        <p>${service.event_day_instructions}</p>
      </section>
    ` : ''}
  `;
}

function renderRentalContent(service) {
  let details = {};
  try {
    details = service.activity_details
      ? JSON.parse(service.activity_details)
      : {};
  } catch {}

  return `
    ${details.included_items ? `
      <section class="service-block">
        <h3>Что включено</h3>
        <p>${details.included_items}</p>
      </section>
    ` : ''}

    ${(details.deposit_required !== undefined) ? `
      <section class="service-block">
        <h3>Залог и документы</h3>
        <p>
          ${details.deposit_required
            ? `Залог: ${details.deposit_amount || 0} €`
            : 'Залог не требуется'}
        </p>
        ${details.documents_required
          ? `<p>Документы: ${details.documents_required}</p>`
          : ''}
      </section>
    ` : ''}

    ${service.event_day_instructions ? `
      <section class="service-block">
        <h3>Получение и возврат</h3>
        <p>${service.event_day_instructions}</p>
      </section>
    ` : ''}
  `;
}

/* =========================
   BOOKING FORM
========================= */
function renderBookingForm() {
  if (service.activity_type === 'rental') {
    return `
      <label>Даты аренды</label>
      <input type="text" id="dateRange" placeholder="Выберите даты">

      <label>Количество (${UNIT_LABEL})</label>
      <input type="number" id="quantity" min="1" value="1">

      <div id="availabilityInfo"
           style="margin:6px 0;font-size:14px;color:#555"></div>

      <div class="booking-summary" id="bookingSummary"></div>

      <button class="btn" id="addToCartBtn">Добавить в корзину</button>
      <div id="cartResult"></div>
    `;
  }

  return `
    <label>Дата</label>
    <select id="bookingDate">
      <option value="">Выберите дату</option>
    </select>

    <label>Количество (${UNIT_LABEL})</label>
    <input type="number" id="quantity" min="1" value="1">

    <div class="booking-summary" id="bookingSummary"></div>
    <button class="btn" id="addToCartBtn">Добавить в корзину</button>
    <div id="cartResult"></div>
  `;
}

/* =========================
   RENDER PAGE
========================= */
function renderPage() {
  container.innerHTML = `
    <h1>${service.title}</h1>

    <div class="service-meta" style="margin-bottom:12px;color:#666;">
      ⭐ — · ${bookingsCount} бронирований · ${providerDisplayName}
    </div>

    <div class="service-layout">
      <div class="service-main">
        ${renderGallery()}
        <p>${service.description}</p>

        ${
          service.activity_type === 'tour'
            ? renderTourContent(service)
            : ''
        }

        ${
          service.activity_type === 'rental'
            ? renderRentalContent(service)
            : ''
        }
      </div>

      <div class="service-sidebar">
        <div class="booking-box" id="bookingBox">
          <div class="booking-price">
            <span id="priceValue">${service.price}</span> €
            <span>/ ${UNIT_LABEL}</span>
          </div>

          <div class="booking-form-wrapper">
            ${
              USER_ROLE === 'provider'
                ? `<p>Бронирование доступно только клиентам</p>`
                : renderBookingForm()
            }
          </div>
        </div>
      </div>
    </div>
  `;

  if (USER_ROLE !== 'provider') {
    const SERVICE_LOGIC = {
      rental: initRentalLogic,
      tour: initTourLogic
    };

    SERVICE_LOGIC[service.activity_type]?.({
      service,
      cartData,
      rentalCalendar,
      serviceDates
    });

    const btn = document.getElementById('addToCartBtn');
    if (btn) btn.addEventListener('click', addToCart);
  }
}

/* =========================
   ADD TO CART
========================= */
async function addToCart() {
  const result = document.getElementById('cartResult');

  if (!CURRENT_SESSION) {
    result.textContent = 'Войдите в аккаунт';
    return;
  }

  if (
    service.activity_type === 'rental' &&
    (!cartData.booking_date_from || !cartData.booking_date_to)
  ) {
    result.textContent = 'Выберите период';
    return;
  }

  if (
    service.activity_type !== 'rental' &&
    !cartData.booking_date
  ) {
    result.textContent = 'Выберите дату';
    return;
  }

  const { error } = await supabase
    .from('cart_items')
    .insert({
      user_id: CURRENT_SESSION.user.id,
      provider_id: service.provider_id,
      service_id: service.id,
      service_date_id: cartData.service_date_id ?? null,
      service_title: service.title,
      booking_date:
        cartData.booking_date_from || cartData.booking_date,
      booking_date_from: cartData.booking_date_from ?? null,
      booking_date_to: cartData.booking_date_to ?? null,
      quantity: cartData.quantity,
      unit_price: cartData.unit_price,
      total_price: cartData.total_price
    });

  result.textContent = error
    ? 'Ошибка добавления'
    : 'Добавлено в корзину ✅';
}

/* =========================
   GALLERY CONTROLS
========================= */
window.prevImage = () => {
  currentIndex = (currentIndex - 1 + images.length) % images.length;
  renderPage();
};

window.nextImage = () => {
  currentIndex = (currentIndex + 1) % images.length;
  renderPage();
};

window.setImage = (index) => {
  currentIndex = index;
  renderPage();
};

/* =========================
   START
========================= */
renderPage();
