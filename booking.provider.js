import { supabase } from './supabaseClient.js';
import { getCancelPolicy } from './cancel.rules.js';

/* =========================
   INIT PROVIDER BOOKING
========================= */
export async function initProviderBooking({
  booking,
  service,
  session
}) {
  const cancelBtn = document.getElementById('cancelBookingBtn');
  const cancelInfo = document.getElementById('cancelInfo');
  const cancelDeadlineEl = document.getElementById('cancelDeadline');

  /* =========================
     DEADLINE (48h)
  ========================= */
  const bookingDate =
    booking.booking_date_from || booking.booking_date;

  const bookingDateObj = new Date(bookingDate);
  const cancelDeadline =
    new Date(bookingDateObj.getTime() - 48 * 60 * 60 * 1000);

  if (cancelDeadlineEl) {
    cancelDeadlineEl.textContent =
      cancelDeadline.toLocaleString('ru-RU', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
  }

  /* =========================
     UI CONDITIONS
  ========================= */
  if (
    booking.status !== 'confirmed' &&
    booking.status !== 'approved'
  ) {
    cancelInfo.textContent = 'Бронирование уже не активно';
    return;
  }

  cancelBtn.style.display = 'inline-flex';
  cancelBtn.textContent = 'Отменить бронирование';

  cancelBtn.addEventListener('click', () => {
    cancelBtn.style.display = 'none';

    cancelInfo.innerHTML = `
      <p style="font-size:14px;">
        ❗ Вы собираетесь отменить бронирование клиента.
      </p>

      <p style="font-size:13px;color:#666;">
        Пожалуйста, укажите причину:
      </p>

      <select id="providerCancelReason" style="width:100%;margin-top:6px;">
        <option value="">— выберите причину —</option>
        <option value="weather">Погодные условия</option>
        <option value="provider_issue">Проблема у поставщика</option>
        <option value="other">Другая причина</option>
      </select>

      <div style="margin-top:12px;display:flex;gap:10px;">
        <button id="confirmProviderCancel" class="btn-outline">
          Подтвердить отмену
        </button>
        <button id="abortProviderCancel" class="btn-outline">
          Назад
        </button>
      </div>
    `;

    document
      .getElementById('abortProviderCancel')
      ?.addEventListener('click', () => {
        cancelInfo.textContent = '';
        cancelBtn.style.display = 'inline-flex';
      });

    document
      .getElementById('confirmProviderCancel')
      ?.addEventListener('click', async () => {

        const reason =
          document.getElementById('providerCancelReason')?.value;

        if (!reason) {
          cancelInfo.innerHTML =
            '<p style="color:red;font-size:13px;">Укажите причину отмены</p>';
          return;
        }

        cancelInfo.textContent = '⏳ Отменяем бронирование…';

        const policy = getCancelPolicy({
          booking,
          cancelledBy: 'provider',
          reason
        });

        /* =========================
           ♻️ RESTORE AVAILABILITY
        ========================= */
        if (policy.restoreAvailability) {

          if (
            booking.booking_date_from &&
            booking.booking_date_to &&
            booking.quantity
          ) {
            const from = new Date(booking.booking_date_from);
            const to   = new Date(booking.booking_date_to);

            for (
              let d = new Date(from);
              d <= to;
              d.setDate(d.getDate() + 1)
            ) {
              const date =
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
        const { error: orderError } = await supabase
          .from('orders')
          .update({
            status: policy.status,
            cancelled_at: new Date().toISOString(),
            cancelled_by: 'provider',
            provider_cancel_reason: reason,
            penalty_percent: policy.penaltyPercent || 0
          })
          .eq('id', booking.id);

        if (orderError) {
          console.error('[ORDER CANCEL ERROR]', orderError);
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
                event: 'cancelled_by_provider',
                order_ids: [booking.id]
              })
            }
          );
        } catch (e) {
          console.warn('Provider cancel notify failed', e);
        }

        cancelInfo.innerHTML = `
          <p style="font-size:14px;color:#666;">
            ❌ Бронирование отменено.<br>
            Клиент будет уведомлён.
          </p>
        `;

        const statusEl =
          document.getElementById('bookingStatus');

        if (statusEl) {
          statusEl.innerHTML =
            '<span class="booking-status cancelled">🔴 Отменено поставщиком</span>';
        }
      });
  });
}
