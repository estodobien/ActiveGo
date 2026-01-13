// admin-log-action.js
// ADMIN ONLY
// Логирование действий администратора
// Работает через service_role (RLS bypass)

import { supabaseAdmin } from './_supabaseAdmin.js';

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed',
    };
  }

  try {
    const {
      entity_type,
      entity_id,
      action_type,
      reason = null,
    } = JSON.parse(event.body);

    if (!entity_type || !entity_id || !action_type) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: 'Missing required fields',
        }),
      };
    }

    /* ⛔ admin_id берём ИЗ ТОКЕНА, а не из фронта */
    const authHeader = event.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Missing auth token' }),
      };
    }

    /* 1️⃣ проверяем пользователя */
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid user token' }),
      };
    }

    /* 2️⃣ проверяем, что это админ */
    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from('profiles')
        .select('id, role')
        .eq('id', user.id)
        .single();

    if (profileError || profile?.role !== 'admin') {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Access denied' }),
      };
    }

    /* 3️⃣ пишем лог */
    const { error: insertError } = await supabaseAdmin
      .from('admin_actions')
      .insert({
        admin_id: user.id,
        entity_type,
        entity_id,
        action_type,
        reason,
      });

    if (insertError) {
      console.error('[ADMIN][LOG]', insertError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: insertError.message }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error('[ADMIN][LOG][FATAL]', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
