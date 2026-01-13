export function initRentalLogic({
  service,
  cartData,
  rentalCalendar
}) {
  const dateRangeInput = document.getElementById('dateRange');
  let qty = document.getElementById('quantity');
  const summary = document.getElementById('bookingSummary');
  const availabilityInfo = document.getElementById('availabilityInfo');

  if (!dateRangeInput || !qty) return;

  const isMobile = window.innerWidth <= 768;

  /* =========================
     HELPERS
  ========================= */

  function toLocalDate(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getDay(iso) {
    return rentalCalendar.find(d => d.date === iso);
  }

  function getMinAvailable(from, to) {
    const days = rentalCalendar.filter(
      d => d.date >= from && d.date <= to
    );
    if (!days.length) return 0;
    return Math.min(...days.map(d => d.available_units));
  }

  /* =========================
     MOBILE SELECT (QUANTITY)
  ========================= */

  function replaceQtyWithSelect(maxAvailable) {
    if (!isMobile) return;

    if (qty.tagName === 'SELECT') {
      updateSelectOptions(qty, maxAvailable);
      return;
    }

    const select = document.createElement('select');
    select.id = 'quantity';

    updateSelectOptions(select, maxAvailable);

    qty.replaceWith(select);
    qty = select;

    qty.addEventListener('change', recalc);
  }

  function updateSelectOptions(select, maxAvailable) {
    select.innerHTML = '';

    for (let i = 1; i <= maxAvailable; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i;
      select.appendChild(opt);
    }

    select.value = cartData.quantity || 1;
  }

  /* =========================
     FLATPICKR
  ========================= */

  flatpickr(dateRangeInput, {
    mode: 'range',
    dateFormat: 'Y-m-d',
    minDate: 'today',

    /* === disable fully unavailable days === */
    disable: [
      date => {
        const iso = toLocalDate(date);
        const day = getDay(iso);
        return !day || day.available_units <= 0;
      }
    ],

    /* === COLORING DAYS (RESTORED) === */
    onDayCreate(_, __, ___, dayElem) {
      const iso = toLocalDate(dayElem.dateObj);
      const day = getDay(iso);

      if (!day) return;

      if (day.available_units <= 0) {
        dayElem.classList.add('day-full');
        dayElem.title = 'Нет доступных единиц';
      } else if (day.available_units < service.total_units) {
        dayElem.classList.add('day-partial');
        dayElem.title =
          `Доступно: ${day.available_units} из ${service.total_units}`;
      } else {
        dayElem.classList.add('day-free');
        dayElem.title =
          `Доступно: ${service.total_units}`;
      }
    },

    /* === RANGE SELECT === */
    onChange(selectedDates) {
      if (selectedDates.length !== 2) {
        summary.innerHTML = '';
        availabilityInfo.innerHTML = '';
        return;
      }

      cartData.booking_date_from = toLocalDate(selectedDates[0]);
      cartData.booking_date_to   = toLocalDate(selectedDates[1]);

      recalc();
    }
  });

  /* =========================
     RECALC (FINAL FIX)
  ========================= */

  function recalc() {
    if (!cartData.booking_date_from || !cartData.booking_date_to) return;

    const minAvailable = getMinAvailable(
      cartData.booking_date_from,
      cartData.booking_date_to
    );

    if (minAvailable <= 0) {
      availabilityInfo.innerHTML =
        `<span style="color:red">Нет доступных единиц</span>`;
      summary.innerHTML = '';
      return;
    }

    // читаем текущее значение (НЕ затираем)
    let currentQty = Number(qty.value) || 1;

    // ограничиваем ТОЛЬКО если превышает доступное
    if (currentQty > minAvailable) {
      currentQty = minAvailable;
      qty.value = minAvailable;
    }

    // mobile → select
    replaceQtyWithSelect(minAvailable);

    // desktop → input
    if (!isMobile) {
      qty.max = minAvailable;
    }

    cartData.quantity = currentQty;

    availabilityInfo.innerHTML =
      `Осталось <strong>${minAvailable}</strong> из ${service.total_units}`;

    const from = new Date(cartData.booking_date_from);
    const to = new Date(cartData.booking_date_to);
    const days =
      Math.round((to - from) / (1000 * 60 * 60 * 24)) + 1;

    cartData.total_price =
      days * cartData.quantity * cartData.unit_price;

    summary.innerHTML =
      `${days} дней × ${cartData.quantity} × ${cartData.unit_price} € =
       <strong>${cartData.total_price} €</strong>`;
  }

  /* =========================
     EVENTS
  ========================= */

  qty.addEventListener('input', recalc);
  qty.addEventListener('change', recalc);
}
