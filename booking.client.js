import { supabase } from './supabaseClient.js';
import { getCancelPolicy } from './cancel.rules.js';

/* =========================
   INIT CLIENT BOOKING
========================= */
export async function initClientBooking({
  booking,
  service,
  session
}) {
  const cancelBtn = document.getElementById('cancelBookingBtn');
  const cancelInfo = document.getElementById('cancelInfo');
  const cancelDeadlineEl = document.getElementById('cancelDeadline');

  const reviewSection = document.getElementById('reviewSection');
  const starsEl = document.getElementById('stars');
  const reviewCommentEl = document.getElementById('reviewComment');
  const submitReviewBtn = document.getElementById('submitReviewBtn');
  const reviewInfo = document.getElementById('reviewInfo');

  /* =========================
     CANCEL UX (CLIENT)
  ========================= */
  const bookingDate =
    booking.booking_date_from || booking.booking_date;

  const bookingDateObj = new Date(bookingDate);
  const cancelDeadline =
    new Date(bookingDateObj.getTime() - 48 * 60 * 60 * 1000);

  cancelDeadlineEl.textContent =
    cancelDeadline.toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

  const now = new Date();

  const canCancelUI =
    (booking.status === 'confirmed' || booking.status === 'approved') &&
    now < cancelDeadline;

  if (booking.status === 'cancelled_by_client') {
    cancelInfo.textContent = '❌ Бронирование отменено вами';
  }
  else if (!canCancelUI) {
    cancelInfo.textContent =
      '⛔ Отмена недоступна менее чем за 48 часов до начала';
  }
  else {
    cancelBtn.style.display = 'inline-flex';
  }

  cancelBtn?.addEventListener('click', () => {
    cancelBtn.style.display = 'none';

    cancelInfo.innerHTML = `
      <p style="font-size:14px;">
        ❗ Вы уверены, что хотите отменить бронирование?
      </p>
      <p style="font-size:13px;color:#666;">
        Бесплатная отмена возможна до
        <strong>${cancelDeadlineEl.textContent}</strong>
      </p>

      <div style="margin-top:10px;display:flex;gap:10px;">
        <button id="confirmCancelBtn" class="btn-outline">
          Да, отменить
        </button>
        <button id="keepBookingBtn" class="btn-outline">
          Нет, оставить
        </button>
      </div>
    `;

    document
      .getElementById('keepBookingBtn')
      ?.addEventListener('click', () => {
        cancelInfo.textContent = '';
        cancelBtn.style.display = 'inline-flex';
      });

    document
      .getElementById('confirmCancelBtn')
      ?.addEventListener('click', async () => {

        cancelInfo.textContent = '⏳ Отменяем бронирование…';

        const policy = getCancelPolicy({
          booking,
          cancelledBy: 'client'
        });

        if (!policy.allowed) {
          cancelInfo.textContent = policy.message;
          cancelBtn.style.display = 'inline-flex';
          return;
        }

        /* =========================
           ♻️ RESTORE AVAILABILITY
        ========================= */
        if (policy.restoreAvailability) {

          if (booking.booking_date_from && booking.booking_date_to) {
            const from = new Date(booking.booking_date_from);
            const to   = new Date(booking.booking_date_to);

            for (
              let d = new Date(from);
              d <= to;
              d.setDate(d.getDate() + 1)
            ) {
              const date = d.toISOString().split('T')[0];

              await supabase.rpc('restore_day_booking', {
                p_service_id: booking.service_id,
                p_date: date,
                p_units: booking.quantity
              });
            }
          }

          if (
            !booking.booking_date_from &&
            !booking.booking_date_to
          ) {
            await supabase.rpc(
              'restore_tour_by_order',
              { p_order_id: booking.id }
            );
          }
        }

        /* =========================
           UPDATE ORDER STATUS
        ========================= */
        const { error } = await supabase
          .from('orders')
          .update({
            status: policy.status,
            cancelled_at: new Date().toISOString(),
            cancelled_by: 'client'
          })
          .eq('id', booking.id)
          .eq('user_id', session.user.id);

        if (error) {
          cancelInfo.textContent =
            'Ошибка при отмене. Попробуйте позже.';
          cancelBtn.style.display = 'inline-flex';
          return;
        }

        /* =========================
           🔔 NOTIFY (EDGE FUNCTION)
        ========================= */
        try {
          await fetch(
            "https://mzkrwlbwrwyempyrhsrt.functions.supabase.co/notify-booking-cancelled",
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`
              },
              body: JSON.stringify({
                event: 'cancelled_by_client',
                order_ids: [booking.id]
              })
            }
          );
        } catch (e) {
          console.warn('Cancel email notify failed', e);
        }

        cancelInfo.innerHTML = `
          <p style="font-size:14px;color:#666;">
            ❌ Бронирование отменено.<br>
            Мы уведомили поставщика.
          </p>
        `;
      });
  });

  /* =========================
     REVIEWS (A9)
  ========================= */
  const bookingEnded =
    booking.status === 'confirmed' &&
    new Date(bookingDate) < new Date();

  let existingReview = null;

  if (bookingEnded && service) {
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('service_id', service.id)
      .eq('user_id', session.user.id)
      .maybeSingle();

    existingReview = data;
  }

  if (bookingEnded && !existingReview) {
    reviewSection.style.display = 'block';
  }

  let selectedRating = 0;

  starsEl?.addEventListener('click', e => {
    if (e.target.textContent === '★') {
      selectedRating =
        [...e.target.parentNode.children].indexOf(e.target) + 1;

      starsEl.textContent =
        '★★★★★'.slice(0, selectedRating) +
        '☆☆☆☆☆'.slice(0, 5 - selectedRating);
    }
  });

  submitReviewBtn?.addEventListener('click', async () => {
    if (!selectedRating) {
      reviewInfo.textContent = 'Поставьте оценку';
      return;
    }

    await supabase.from('reviews').insert({
      service_id: service.id,
      user_id: session.user.id,
      rating: selectedRating,
      comment: reviewCommentEl.value
    });

    reviewInfo.textContent = 'Спасибо за отзыв!';
    submitReviewBtn.disabled = true;
  });
}
