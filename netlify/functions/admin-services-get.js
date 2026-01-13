import { supabaseAdmin } from './_supabaseAdmin.js';

/*
  admin-services-get.js
  ADMIN ONLY

  Назначение:
  - получить список ВСЕХ услуг
  - используется в admin-services.js (таблица услуг)
  - service_role → полный bypass RLS
  - без фильтрации (фильтры на фронте)
*/

export async function handler() {
  try {
    const { data, error } = await supabaseAdmin
      .from('services')
      .select(`
        id,
        title,
        price,
        status,
        created_at,
        provider:profiles (
          id,
          name,
          email
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ADMIN][SERVICES][GET]', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data || []),
    };
  } catch (err) {
    console.error('[ADMIN][SERVICES][GET][FATAL]', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
