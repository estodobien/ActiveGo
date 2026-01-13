import { supabase } from './supabaseClient.js';

console.log('PROVIDER ONBOARDING JS LOADED');

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
   PROFILE + ROLE CHECK
=============================== */
const { data: profile, error } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();

if (error || !profile) {
  alert('Профиль не найден');
  throw new Error('Profile not found');
}

if (profile.role !== 'provider') {
  window.location.href = 'index.html';
  throw new Error('Not provider');
}

/* ===============================
   FORM
=============================== */
const form = document.getElementById('providerOnboardingForm');
const result = document.getElementById('result');

if (!form) {
  console.warn('Onboarding form not found');
  throw new Error('Form not found');
}

form.addEventListener('submit', async e => {
  e.preventDefault();

  const company_name = document.getElementById('company_name').value.trim();
  const provider_type = document.getElementById('provider_type').value;
  const activity_description =
    document.getElementById('activity_description').value.trim();
  const country = document.getElementById('country').value.trim();
  const city = document.getElementById('city').value.trim();
  const tax_number = document.getElementById('tax_number').value.trim();

  const adminContactType =
    document.getElementById('admin_contact_type').value;

  const adminContactValue =
    document.getElementById('admin_contact_value').value.trim();

  if (
    !company_name ||
    !provider_type ||
    !activity_description ||
    !country ||
    !city ||
    !tax_number ||
    !adminContactType ||
    !adminContactValue
  ) {
    alert('Заполните все поля');
    return;
  }

  /* ===============================
     UPDATE PAYLOAD
  =============================== */
  const updatePayload = {
    company_name,
    provider_type,
    activity_description,
    country,
    city,
    tax_number,
    notify_channel: adminContactType,
    onboarding_completed: true
  };

  if (adminContactType === 'telegram') {
    updatePayload.telegram_username = adminContactValue;
  }

  if (adminContactType === 'whatsapp') {
    updatePayload.whatsapp_phone = adminContactValue;
  }

  if (adminContactType === 'email') {
    updatePayload.email = adminContactValue;
  }

  /* ===============================
     UPDATE PROFILE
  =============================== */
  const { error: updateError } = await supabase
    .from('profiles')
    .update(updatePayload)
    .eq('id', userId);

  if (updateError) {
    console.error(updateError);
    alert('Ошибка сохранения профиля');
    return;
  }

  result.innerHTML = `
    <div style="
      padding:16px;
      background:#f0f9ff;
      border:1px solid #cfe8ff;
      border-radius:12px;
      font-size:14px;
      line-height:1.5;
    ">
      ✅ Профиль отправлен на модерацию.<br><br>
      Пока вы можете просматривать кабинет, но
      публикация услуг станет доступна после проверки.
    </div>
  `;

  setTimeout(() => {
    window.location.href = 'dashboard-provider.html';
  }, 1400);
});
