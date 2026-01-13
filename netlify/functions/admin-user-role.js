import { supabaseAdmin } from './_supabaseAdmin.js';

/*
  admin-user-role.js
  НАЗНАЧЕНИЕ:
  - смена роли пользователя (client <-> provider)
  - используется только администратором
  - service_role (RLS bypass)
*/

export async function handler(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { user_id, new_role, admin_id } = JSON.parse(event.body);

    if (!user_id || !new_role || !admin_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing parameters' }),
      };
    }

    if (!['client', 'provider'].includes(new_role)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid role' }),
      };
    }

    /* 1️⃣ обновляем роль */
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ role: new_role })
      .eq('id', user_id);

    if (updateError) {
      console.error('[ADMIN][USER][ROLE]', updateError);
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
      action_type: 'role_change',
      reason: `set role ${new_role}`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error('[ADMIN][USER][ROLE][FATAL]', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
