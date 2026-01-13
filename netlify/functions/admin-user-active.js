import { supabaseAdmin } from './_supabaseAdmin.js';

/*
  admin-user-active.js
  НАЗНАЧЕНИЕ:
  - активация / блокировка пользователя (is_active)
  - используется только администратором
  - service_role (RLS bypass)
*/

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { user_id, is_active, admin_id } = JSON.parse(event.body);

    if (!user_id || typeof is_active !== 'boolean' || !admin_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing or invalid parameters' }),
      };
    }

    /* 1️⃣ обновляем статус пользователя */
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ is_active })
      .eq('id', user_id);

    if (updateError) {
      console.error('[ADMIN][USER][ACTIVE]', updateError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: updateError.message }),
      };
    }

    /* 2️⃣ логируем действие */
    await supabaseAdmin.from('admin_actions').insert({
      admin_id,
      entity_type: 'user',
      entity_id: user_id,
      action_type: is_active ? 'activate' : 'suspend',
      reason: is_active ? 'activate user' : 'suspend user',
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error('[ADMIN][USER][ACTIVE][FATAL]', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
ы