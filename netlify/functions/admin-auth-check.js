import { createClient } from '@supabase/supabase-js';

/*
  admin-auth-check.js
  ADMIN ONLY

  Назначение:
  - проверить текущую сессию
  - получить профиль пользователя
  - убедиться, что роль = admin
  - вернуть admin context для frontend

  ❗ Использует service_role
  ❗ Полностью обходит RLS
*/

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {

  console.log('ENV CHECK:', {
    SUPABASE_URL: process.env.SUPABASE_URL,
    HAS_SERVICE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  });

  try {
    // дальше твой существующий код

    /* =========================
       1. Получаем access token
    ========================= */

    const authHeader =
      event.headers.authorization ||
      event.headers.Authorization ||
      '';

    if (!authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'No auth token' }),
      };
    }

    const accessToken = authHeader.replace('Bearer ', '');

    /* =========================
       2. Проверяем пользователя
    ========================= */

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid session' }),
      };
    }

    /* =========================
       3. Загружаем профиль
    ========================= */

    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Profile not found' }),
      };
    }

    /* =========================
       4. Проверяем роль
    ========================= */

    if (profile.role !== 'admin') {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Access denied' }),
      };
    }

    /* =========================
       5. OK — возвращаем контекст
    ========================= */

    return {
      statusCode: 200,
      body: JSON.stringify({
        user: {
          id: user.id,
          email: user.email,
        },
        profile: {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role,
        },
      }),
    };
  } catch (err) {
    console.error('[ADMIN AUTH CHECK][FATAL]', err);

    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
