import { supabase } from './supabaseClient.js';

const form = document.getElementById('registerProviderForm');

if (form) {
  form.addEventListener('submit', async e => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const name = document.getElementById('name').value.trim();

    // 1️⃣ Регистрируем пользователя в Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      alert(error.message);
      return;
    }

    const userId = data.user.id;

    // 2️⃣ Создаём профиль с ролью provider
    const { error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: userId,
          role: 'provider',
          name
        }
      ]);

    if (profileError) {
      alert('Ошибка создания профиля поставщика');
      console.error(profileError);
      return;
    }

    alert('Поставщик успешно зарегистрирован. Войдите в аккаунт.');
    window.location.href = 'login.html';
  });
}
