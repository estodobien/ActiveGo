import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('header');
  if (!header) return;

  renderHeader(header);
});

async function renderHeader(header) {
  const { data: { session } } = await supabase.auth.getSession();

  /* ===============================
     👤 ГОСТЬ
  =============================== */
  if (!session) {
    window.__USER_ROLE__ = 'guest';

    header.innerHTML = `
      <div class="header">
        <div class="logo">
          <a href="index.html">ActiveGo</a>
        </div>

        <nav class="nav">
          <a href="catalog.html">Каталог</a>

          <a href="login.html" class="btn-outline">
            Мой кабинет
          </a>

          <a href="register.html?role=client" class="btn-outline">
            Регистрация клиента
          </a>

          <a href="register.html?role=provider" class="btn-primary">
            Стать партнёром
          </a>
        </nav>
      </div>
    `;
    return;
  }

  /* ===============================
     🔑 ОПРЕДЕЛЕНИЕ РОЛИ
  =============================== */
  const userId = session.user.id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  const role = profile?.role || 'client';
  window.__USER_ROLE__ = role;

  /* ===============================
     👤 CLIENT
  =============================== */
  if (role === 'client') {
    header.innerHTML = `
      <div class="header">
        <div class="logo">
          <a href="index.html">ActiveGo</a>
        </div>

        <nav class="nav">
          <a href="catalog.html">Каталог</a>

          <a href="cart.html" class="cart-link">
            🛒 Корзина <span id="cartCount"></span>
          </a>

          <a href="dashboard.html">Мои бронирования</a>
          <a href="profile-client.html">Профиль</a>


          <span class="role-badge">Клиент</span>

          <a href="#" id="logoutBtn" class="nav-action">Выйти</a>
        </nav>
      </div>
    `;

    updateCartCount();
  }

  /* ===============================
     🧑‍💼 PROVIDER
  =============================== */
  if (role === 'provider') {
    header.innerHTML = `
      <div class="header">
        <div class="logo">
          <a href="index.html">ActiveGo</a>
        </div>

        <nav class="nav">
          <a href="dashboard-provider.html">Обзор</a>
          <a href="provider-services.html">Мои услуги</a>
          <a href="provider-bookings.html">Мои бронирования</a>
          <a href="provider-payouts.html">Выплаты</a>

          <a href="add-service.html" class="btn-primary">
            Добавить услугу
          </a>

          <span class="role-badge">Поставщик</span>

          <a href="#" id="logoutBtn" class="nav-action">Выйти</a>
        </nav>
      </div>
    `;
  }

  /* ===============================
     👑 ADMIN
  =============================== */
  if (role === 'admin') {
    header.innerHTML = `
      <div class="header">
        <div class="logo">
          <a href="index.html">ActiveGo</a>
        </div>

        <nav class="nav">
          <a
            href="/admin/admin-layout.html?page=dashboard"
            class="btn-primary"
          >
            Админ-панель
          </a>

          <span class="role-badge">Админ</span>

          <a href="#" id="logoutBtn" class="nav-action">Выйти</a>
        </nav>
      </div>
    `;
  }

  /* ===============================
     LOGOUT
  =============================== */
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = 'index.html';
    });
  }
}

/* ===============================
   CART COUNT
=============================== */
async function updateCartCount() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { count, error } = await supabase
    .from('cart_items')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('Cart count error:', error);
    return;
  }

  const badge = document.getElementById('cartCount');
  if (!badge) return;

  badge.textContent = count > 0 ? `(${count})` : '';
}
