// service.tour.js

export function initTourLogic({
  service,
  cartData,
  serviceDates
}) {
  const select = document.getElementById('bookingDate');
  let qty = document.getElementById('quantity'); // ⬅️ let, т.к. можем заменить
  const priceEl = document.getElementById('priceValue');
  const summaryEl = document.getElementById('bookingSummary');

  if (!select || !qty) return;

  const isMobile = window.innerWidth <= 768;

  /* =========================
     HELPERS (QUANTITY)
  ========================= */

  function replaceQtyWithSelect(maxAvailable) {
    if (!isMobile) return;

    // если уже select — просто обновим options
    if (qty.tagName === 'SELECT') {
      updateSelectOptions(qty, maxAvailable);
      return;
    }

    const selectEl = document.createElement('select');
    selectEl.id = 'quantity';

    updateSelectOptions(selectEl, maxAvailable);

    qty.replaceWith(selectEl);
    qty = selectEl;

    qty.addEventListener('change', recalc);
  }

  function updateSelectOptions(selectEl, maxAvailable) {
    selectEl.innerHTML = '';

    for (let i = 1; i <= maxAvailable; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i;
      selectEl.appendChild(opt);
    }

    if (cartData.quantity > maxAvailable) {
      cartData.quantity = maxAvailable;
    }

    selectEl.value = cartData.quantity || 1;
  }

  /* =========================
     DATE OPTIONS
  ========================= */

  serviceDates.forEach(d => {
    const available = d.capacity - d.booked;
    if (available <= 0) return;

    select.innerHTML += `
      <option value="${d.id}"
        data-date="${d.date}"
        data-price="${d.price_override ?? service.price}"
        data-max="${available}">
        ${d.date} — ${available} мест
      </option>
    `;
  });

  /* =========================
     DATE CHANGE
  ========================= */

  select.addEventListener('change', () => {
    const opt = select.selectedOptions[0];
    if (!opt) return;

    const price = Number(opt.dataset.price);
    const maxAvailable = Number(opt.dataset.max);

    priceEl.textContent = price;

    cartData.service_date_id = opt.value;
    cartData.booking_date = opt.dataset.date;
    cartData.unit_price = price;
    cartData.quantity = 1;
    cartData.total_price = price;

    // 📱 MOBILE → select
    replaceQtyWithSelect(maxAvailable);

    // 🖥 DESKTOP → input (как раньше)
    if (!isMobile) {
      qty.max = maxAvailable;
      qty.value = 1;
    }

    updateSummary();
  });

  /* =========================
     QTY CHANGE
  ========================= */

  function recalc() {
    cartData.quantity = Math.max(1, Number(qty.value) || 1);
    cartData.total_price = cartData.quantity * cartData.unit_price;
    updateSummary();
  }

  qty.addEventListener('input', recalc);

  /* =========================
     SUMMARY
  ========================= */

  function updateSummary() {
    if (!summaryEl) return;

    summaryEl.innerHTML = `
      ${cartData.quantity} × ${cartData.unit_price} € =
      <strong>${cartData.total_price} €</strong>
    `;
  }
}
