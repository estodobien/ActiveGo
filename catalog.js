import { supabase } from './supabaseClient.js';
import { initSearchComponent } from './search.js';

const container = document.getElementById('servicesContainer');

/* =========================================================
   READ SEARCH PARAMS
========================================================= */
const params = new URLSearchParams(window.location.search);
const searchQuery = params.get('q');
const activityType = params.get('type');

/* =========================================================
   USER ROLE
========================================================= */
let USER_ROLE = 'guest';

const { data: { session } } = await supabase.auth.getSession();

if (session) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  USER_ROLE = profile?.role || 'client';
}

/* =========================================================
   SKELETON LOADER
========================================================= */
function renderSkeletons(count = 8) {
  container.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'service-card skeleton';

    skeleton.innerHTML = `
      <div class="skeleton-img"></div>
      <div class="service-content">
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
      </div>
    `;

    container.appendChild(skeleton);
  }
}

/* 👉 показываем skeleton СРАЗУ */
renderSkeletons(8);

/* =========================================================
   LOAD SERVICES (WITH FILTERS)
========================================================= */
let query = supabase
  .from('services')
  .select(`
  id,
  title,
  description,
  location,
  price,
  status,
  main_image
`)

  .eq('status', 'active');

if (activityType) {
  query = query.eq('activity_type', activityType);
}

if (searchQuery) {
  const q = searchQuery.replace(/,/g, ''); // защита от запятых
  query = query.or(
    `title.ilike.%${q}%,description.ilike.%${q}%,location.ilike.%${q}%`
  );
}

const { data: services, error } = await query;

/* =========================================================
   RENDER RESULT
========================================================= */
if (error) {
  console.error(error);
  container.innerHTML = '<p>Ошибка загрузки каталога</p>';

} else if (!services || services.length === 0) {
  container.innerHTML = '<p>По вашему запросу ничего не найдено</p>';

} else {
  container.innerHTML = '';

  services.forEach(service => {
    const image = service.main_image || 'images/service-placeholder.jpg';

    const card = document.createElement('a');
    card.href = `service.html?id=${service.id}`;
    card.className = 'service-card';

    card.innerHTML = `
      <div class="service-image">
        <img src="${image}" alt="${service.title}" loading="lazy">
      </div>

      <div class="service-content">
        <h3>${service.title}</h3>

        <div class="service-footer">
          <span class="service-price">
            от ${service.price} €
          </span>

          ${
            USER_ROLE === 'provider'
              ? `<span style="font-size:13px;color:#777;">
                   👤 Просмотр как поставщик
                 </span>`
              : `<span class="service-cta">
                   Подробнее →
                 </span>`
          }
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

/* =========================================================
   INIT SEARCH COMPONENT
========================================================= */
initSearchComponent();
