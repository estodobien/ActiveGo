import { supabaseAdmin } from './_supabaseAdmin.js';

export async function handler() {
  try {
    /* =========================
       1️⃣ Загружаем бронирования
    ========================= */

    const { data: orders, error } = await supabaseAdmin
  .from('orders')
  .select(`
    id,
    booking_date,
    status,
    total_price,
    cancelled_by,
    user_id,
    provider_id,
    service:services (
      id,
      title
    )  
  `)
  .order('created_at', { ascending: false });

    if (error) {
      console.error('[ADMIN][BOOKINGS][ORDERS]', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message }),
      };
    }

    if (!orders || orders.length === 0) {
      return {
        statusCode: 200,
        body: JSON.stringify([]),
      };
    }

    /* =========================
       2️⃣ Собираем ID профилей
    ========================= */

    const profileIds = [
      ...new Set(
        orders
          .flatMap(o => [o.user_id, o.provider_id])
          .filter(Boolean)
      ),
    ];

    /* =========================
       3️⃣ Загружаем профили
    ========================= */

    const { data: profiles, error: profilesError } =
      await supabaseAdmin
        .from('profiles')
        .select(`
          id,
          name,
          email,
          telegram_username,
          whatsapp_phone
        `)
        .in('id', profileIds);

    if (profilesError) {
      console.error('[ADMIN][BOOKINGS][PROFILES]', profilesError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: profilesError.message }),
      };
    }

    const profileMap = Object.fromEntries(
      (profiles || []).map(p => [p.id, p])
    );

    /* =========================
       4️⃣ Финальная сборка
    ========================= */

    const result = orders.map(o => ({
      id: o.id, // ← UUID, КРИТИЧЕСКИ ВАЖНО
      booking_date: o.booking_date,
      status: o.status,
      total_price: o.total_price,
      cancelled_by: o.cancelled_by,
      created_at: o.created_at,
      service: o.service || null,
      client: profileMap[o.user_id] || null,
      provider: profileMap[o.provider_id] || null,
    }));

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (err) {
    console.error('[ADMIN][BOOKINGS][FATAL]', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}
