import { supabaseAdmin } from './_supabaseAdmin.js';

export async function handler() {
  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        role,
        name,
        email,
        created_at,
        telegram_username,
        telegram_id,
        whatsapp_phone,
        notify_channel,
        completed_orders
      `)
      .order('created_at', { ascending: false });

    if (error) {
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
    console.error('[ADMIN][USERS][FATAL]', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
