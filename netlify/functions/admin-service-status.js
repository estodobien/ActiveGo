import { supabaseAdmin } from './_supabaseAdmin.js';

export async function handler(event) {
  try {
    const body = JSON.parse(event.body || '{}');
    const { serviceId, status, reason = null } = body;

    if (!serviceId || !status) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing serviceId or status' }),
      };
    }

    // Готовим payload
    const updatePayload = {
      status,
    };

    // если отклоняем — сохраняем причину
    if (status === 'rejected') {
      updatePayload.admin_reject_reason = reason || 'Без указания причины';
    }

    // если одобряем или возвращаем в pending — чистим причину
    if (status === 'active' || status === 'pending') {
      updatePayload.admin_reject_reason = null;
    }

    const { error } = await supabaseAdmin
      .from('services')
      .update(updatePayload)
      .eq('id', serviceId);

    if (error) {
      console.error('[ADMIN SERVICE STATUS ERROR]', error);
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
    console.error('[ADMIN SERVICE STATUS FATAL]', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
