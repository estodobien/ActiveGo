import { supabaseAdmin } from './_supabaseAdmin.js';

export async function handler(event) {
  try {
    console.log('[ADMIN CANCEL] raw body:', event.body);

    const { booking_id, reason_text } = JSON.parse(event.body || '{}');

    console.log('[ADMIN CANCEL] parsed:', { booking_id, reason_text });

    if (!booking_id || !reason_text) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing params' }),
      };
    }

    const { error } = await supabaseAdmin.rpc(
      'admin_cancel_order',
      {
        p_order_id: Number(booking_id),   // ⚠ bigint
        p_reason_text: reason_text,        // ⚠ text
      }
    );

    if (error) {
      console.error('[ADMIN CANCEL][RPC ERROR]', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    console.error('[ADMIN CANCEL][FATAL]', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
