import { supabaseAdmin } from './_supabaseAdmin.js';

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    /* =========================
       AUTH TOKEN
    ========================= */
    const authHeader = event.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Missing auth token' }),
      };
    }

    /* =========================
       VERIFY USER
    ========================= */
    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid token' }),
      };
    }

    /* =========================
       VERIFY ADMIN ROLE
    ========================= */
    const { data: profile, error: profileError } =
      await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profileError || profile?.role !== 'admin') {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Access denied' }),
      };
    }

    /* =========================
       PAYLOAD
    ========================= */
    const { service_id, payload } = JSON.parse(event.body || '{}');

    if (!service_id || !payload) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing data' }),
      };
    }

    /* =========================
       UPDATE SERVICE
    ========================= */
    const { error } = await supabaseAdmin
      .from('services')
      .update(payload)
      .eq('id', service_id);

    if (error) {
      console.error('[ADMIN SERVICE EDIT]', error);
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
    console.error('[ADMIN SERVICE EDIT][FATAL]', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
}
