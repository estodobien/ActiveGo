import { supabase } from './supabaseClient.js';

console.log('AUTH JS LOADED');

/* ===============================
   ПРОВЕРКА СЕССИИ ПРИ ЗАГРУЗКЕ
=============================== */
async function checkSessionAndRedirect() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return;

  // ❗ если email не подтверждён — никуда не редиректим
  if (!session.user.email_confirmed_at) {
    return;
  }

  const userId = session.user.id;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error || !profile) {
    console.warn('Profile not found yet');
    return;
  }

  if (profile.role === 'admin') {
    window.location.href = '/admin/admin-layout.html?page=dashboard';
  } else if (profile.role === 'provider') {
    window.location.href = 'dashboard-provider.html';
  } else {
    window.location.href = 'dashboard.html';
  }
}

checkSessionAndRedirect();

/* ===============================
   ВХОД
=============================== */
const loginForm = document.getElementById('loginForm');

if (loginForm) {
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      alert(error.message);
      return;
    }

    // ❗ если email не подтверждён
    if (!data.user.email_confirmed_at) {
      alert('Подтвердите email. Мы отправили вам письмо.');
      await supabase.auth.signOut();
      return;
    }

    await checkSessionAndRedirect();
  });
}

/* ===============================
   РЕГИСТРАЦИЯ
=============================== */
const registerForm = document.getElementById('registerForm');

if (registerForm) {
  registerForm.addEventListener('submit', async e => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const name = document.getElementById('name')?.value || '';

    const role =
      document.getElementById('role')?.value === 'provider'
        ? 'provider'
        : 'client';

    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      alert(error.message);
      return;
    }

    // 🧠 создаём профиль, если его ещё нет
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', data.user.id)
      .maybeSingle();

    if (!existingProfile) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: data.user.id,
          role,
          name
        });

      if (profileError) {
        console.warn('PROFILE INSERT WARNING:', profileError);
      }
    }

    // ✅ UX после регистрации
    registerForm.innerHTML = `
      <div style="
        padding:20px;
        background:#f9fafb;
        border:1px solid #e0e0e0;
        border-radius:12px;
        font-size:15px;
        line-height:1.5;
      ">
        <strong>📩 Подтвердите email</strong><br><br>

        Мы отправили письмо на:<br>
        <strong>${email}</strong><br><br>

        Перейдите по ссылке в письме, чтобы активировать аккаунт.
        <br><br>

        <span style="color:#666;font-size:14px;">
          Если письма нет — проверьте папку «Спам».
        </span>
      </div>
    `;
  });
}
