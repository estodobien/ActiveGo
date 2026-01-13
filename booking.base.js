import { supabase } from './supabaseClient.js';

/* =========================
   INIT BOOKING BASE
========================= */
export async function initBookingBase() {

  /* =========================
     PARAMS + ROLE
  ========================= */
  const params = new URLSearchParams(window.location.search);
  const bookingId = params.get('id');

  const role =
    params.get('role') === 'provider'
      ? 'provider'
      : 'client';

  if (!bookingId) {
    alert('Бронирование не найдено');
    throw new Error('No booking id');
  }

  /* =========================
     AUTH
  ========================= */
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = 'login.html';
    throw new Error('Not authorized');
  }

  /* =========================
     LOAD BOOKING
  ========================= */
  const { data: booking, error } = await supabase
    .from('orders')
    .select(`
      id,
      booking_date,
      booking_date_from,
      booking_date_to,
      quantity,
      unit_price,
      total_price,
      status,
      created_at,
      service_id,
      user_id,
      provider_id
    `)
    .eq('id', bookingId)
    .single();

  if (error || !booking) {
    alert('Бронирование не найдено');
    throw error;
  }

  /* =========================
     ACCESS CHECK
  ========================= */
  if (
    (role === 'client' && booking.user_id !== session.user.id) ||
    (role === 'provider' && booking.provider_id !== session.user.id)
  ) {
    alert('Нет доступа к бронированию');
    throw new Error('Access denied');
  }

  /* =========================
     LOAD SERVICE
  ========================= */
  let service = null;

  if (booking.service_id) {
    const { data } = await supabase
      .from('services')
      .select(`
        id,
        title,
        location,
        duration_min,
        duration_max,
        rating_avg,
        rating_count
      `)
      .eq('id', booking.service_id)
      .single();

    service = data;
  }

  /* =========================
     HELPERS
  ========================= */
  function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('ru-RU');
  }

  function renderStatus(status) {
    if (status === 'confirmed' || status === 'approved') {
      return '<span class="booking-status approved">🟢 Оплачено</span>';
    }
    if (status === 'cancelled_by_client') {
      return '<span class="booking-status cancelled">🔴 Отменено клиентом</span>';
    }
    if (status === 'cancelled_by_provider') {
      return '<span class="booking-status cancelled">🔴 Отменено поставщиком</span>';
    }
    if (status === 'cancelled_by_provider_review') {
      return '<span class="booking-status cancelled">🟠 Отмена на рассмотрении</span>';
    }
    return `<span class="booking-status">⚪ ${status}</span>`;
  }

  /* =========================
     RENDER BASE UI
  ========================= */
  document.getElementById('bookingNumber').textContent = booking.id;
  document.getElementById('bookingStatus').innerHTML =
    renderStatus(booking.status);

  document.getElementById('serviceTitle').textContent =
    service?.title || '—';

  document.getElementById('bookingDate').textContent =
    formatDate(
      booking.booking_date_from ||
      booking.booking_date
    );

  document.getElementById('quantity').textContent =
    booking.quantity;

  document.getElementById('totalPrice').textContent =
    booking.total_price;

  document.getElementById('meetingPoint').textContent =
    service?.location || 'Будет сообщено дополнительно';

  document.getElementById('meetingTime').textContent =
    service?.duration_min
      ? `${service.duration_min}–${service.duration_max} ч`
      : 'Будет указано ближе к дате';

  document.getElementById('instructions').textContent =
    'Подробные инструкции будут доступны ближе к дате события';

  /* =========================
     RETURN CONTEXT
  ========================= */
  return {
    booking,
    service,
    role,
    session
  };
}
