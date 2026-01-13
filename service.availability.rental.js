// service.availability.rental.js

export function createRentalAvailability({
  service,
  unavailability,
  dayBookings
}) {

  /* =========================
     HELPERS
  ========================= */

  function getBookedForDay(iso) {
    return dayBookings.find(d => d.date === iso)?.booked_units || 0;
  }

  function getUnavailabilityForDay(iso) {
    return unavailability.find(
      p => iso >= p.date_from && iso <= p.date_to
    ) || null;
  }

  function getBlockedUnitsForDay(iso) {
    const u = getUnavailabilityForDay(iso);

    // нет блокировки
    if (!u) return 0;

    // полная блокировка
    if (u.blocked_units === null) return service.total_units;

    // частичная блокировка
    return u.blocked_units || 0;
  }

  function isFullyBlocked(iso) {
    const u = getUnavailabilityForDay(iso);
    return !!u && u.blocked_units === null;
  }

  /* =========================
     RENTAL DAYS
  ========================= */

  function getRentalDays(dateFrom, dateTo) {
    if (!dateFrom || !dateTo) return 0;

    const from = new Date(dateFrom);
    const to = new Date(dateTo);

    from.setHours(0, 0, 0, 0);
    to.setHours(0, 0, 0, 0);

    const diff = (to - from) / (1000 * 60 * 60 * 24);
    if (diff < 0) return 0;

    const mode = service.rental_day_mode || 'calendar';
    return mode === 'nights' ? diff : diff + 1;
  }

  /* =========================
     AVAILABILITY
  ========================= */

  function isDateAvailable(iso) {
    if (isFullyBlocked(iso)) return false;

    const booked = getBookedForDay(iso);
    const blocked = getBlockedUnitsForDay(iso);

    return booked + blocked < service.total_units;
  }

  function getAvailableUnitsForDay(iso) {
    if (isFullyBlocked(iso)) return 0;

    const booked = getBookedForDay(iso);
    const blocked = getBlockedUnitsForDay(iso);

    return Math.max(
      0,
      service.total_units - booked - blocked
    );
  }

  function getMaxAvailableForRange(from, to) {
    const days = getRentalDays(from, to);
    if (days <= 0) return 0;

    let maxAvailable = service.total_units;

    for (let i = 0; i < days; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      const iso = d.toISOString().split('T')[0];

      const available = getAvailableUnitsForDay(iso);
      maxAvailable = Math.min(maxAvailable, available);

      if (maxAvailable <= 0) return 0;
    }

    return maxAvailable;
  }

  /* =========================
     EXPORT
  ========================= */

  return {
    // блокировки
    isFullyBlocked,
    getBlockedUnitsForDay,

    // брони
    getBookedForDay,

    // доступность
    isDateAvailable,
    getAvailableUnitsForDay,
    getMaxAvailableForRange,

    // дни
    getRentalDays
  };
}
