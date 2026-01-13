// service.availability.tour.js

export function createTourAvailability({
  serviceDates
}) {
  function getAvailableForDate(date) {
    const d = serviceDates.find(x => x.date === date);
    if (!d) return 0;
    return Math.max(0, d.capacity - d.booked);
  }

  return {
    getAvailableForDate
  };
}
