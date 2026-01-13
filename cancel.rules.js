/*
  booking:
    - booking_date
    - booking_date_from

  cancelledBy:
    - 'client'
    - 'provider'
    - 'admin' (на будущее)

  reason:
    - string | null

  now:
    - Date
*/

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function diffCalendarDays(from, to) {
  const a = startOfDay(from);
  const b = startOfDay(to);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

export function getCancelPolicy({
  booking,
  cancelledBy,
  reason = null,
  now = new Date()
}) {
  const bookingDate =
    booking.booking_date_from || booking.booking_date;

  const daysBefore =
    diffCalendarDays(now, new Date(bookingDate));

  const result = {
    allowed: false,

    refundPercent: 0,
    penaltyPercent: 0,
    penaltyMaxPercent: 0,

    restoreAvailability: false,

    requiresAdminReview: false,
    providerReasonRequired: false,

    message: '',
    status: ''
  };

  /* =========================
     CLIENT CANCEL
  ========================= */
  if (cancelledBy === 'client') {
    if (daysBefore < 2) {
      result.message =
        'Отмена возможна не позднее чем за 48 часов до начала услуги';
      result.status = 'cancel_denied_too_late';
      return result;
    }

    result.allowed = true;
    result.refundPercent = 100;
    result.restoreAvailability = true;

    result.message = 'Отмена без штрафа';
    result.status = 'cancelled_by_client';

    return result;
  }

  /* =========================
     PROVIDER CANCEL
  ========================= */
  if (cancelledBy === 'provider') {
    result.providerReasonRequired = true;

    if (!reason) {
      result.message =
        'Необходимо указать причину отмены';
      result.status = 'cancel_reason_required';
      return result;
    }

    result.allowed = true;
    result.refundPercent = 100;
    result.restoreAvailability = true;
    result.status = 'cancelled_by_provider';

    if (daysBefore >= 2) {
      result.penaltyPercent = 10;
      result.message =
        'Отмена поставщиком более чем за 48 часов';
      return result;
    }

    result.penaltyMaxPercent = 100;
    result.requiresAdminReview = true;

    result.message =
      'Отмена поставщиком менее чем за 48 часов — требуется рассмотрение';

    return result;
  }

  return result;
}
