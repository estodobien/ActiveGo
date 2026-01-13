import { initBookingBase } from './booking.base.js';
import { initClientBooking } from './booking.client.js';
import { initProviderBooking } from './booking.provider.js';

/* =========================
   BOOKING ENTRY POINT
========================= */

const {
  booking,
  service,
  role,
  session
} = await initBookingBase();

if (role === 'client') {
  initClientBooking({
    booking,
    service,
    session
  });
}

if (role === 'provider') {
  initProviderBooking({
    booking,
    service,
    session
  });
}
