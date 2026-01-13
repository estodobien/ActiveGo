import { supabase } from './supabaseClient.js';

const cartItemsContainer = document.getElementById('cartItems');
const cartSummary = document.getElementById('cartSummary');
const payBtn = document.getElementById('payBtn');

let cartItems = [];

/* =========================
   LOAD CART
========================= */
async function loadCart() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const { data, error } = await supabase
    .from('cart_items')
    .select(`
      id,
      service_id,
      service_title,
      booking_date,
      quantity,
      unit_price,
      total_price,
      services (
        unit_label
      )
    `)
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error(error);
    cartItemsContainer.innerHTML = '<p>Ошибка загрузки корзины</p>';
    return;
  }

  cartItems = data || [];
  renderCart();
}

/* =========================
   RENDER CART
========================= */
function renderCart() {
  if (cartItems.length === 0) {
    cartItemsContainer.innerHTML = '<p>Корзина пуста</p>';
    cartSummary.innerHTML = '';
    payBtn.style.display = 'none';
    return;
  }

  let total = 0;

  cartItemsContainer.innerHTML = cartItems.map(item => {
    total += Number(item.total_price);

    const unitLabel =
      item.services?.unit_label || 'ед.';

    return `
      <div class="cart-item" style="border-bottom:1px solid #ddd; padding:10px 0;">
        <div><strong>${item.service_title}</strong></div>
        <div>Дата: ${item.booking_date}</div>
        <div>Количество: ${item.quantity} ${unitLabel}</div>
        <div>Цена за ${unitLabel}: ${item.unit_price} €</div>
        <div><strong>Итого: ${item.total_price} €</strong></div>
        <button class="btn btn-small" onclick="removeItem('${item.id}')">
          Удалить
        </button>
      </div>
    `;
  }).join('');

  cartSummary.innerHTML = `
    <h3>Итого: ${total} €</h3>
  `;

  payBtn.style.display = 'block';
}

/* =========================
   REMOVE ITEM
========================= */
window.removeItem = async function(id) {
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error(error);
    alert('Ошибка удаления');
    return;
  }

  cartItems = cartItems.filter(item => item.id !== id);
  renderCart();
};

/* =========================
   PAY (STRIPE)
========================= */
payBtn.addEventListener('click', async () => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  payBtn.disabled = true;
  payBtn.textContent = 'Переходим к оплате...';

  try {
    const res = await fetch(
      'https://mzkrwlbwrwyempyrhsrt.supabase.co/functions/v1/create-checkout-session',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          user_id: session.user.id
        })
      }
    );

    const data = await res.json();

    if (!data.url) {
      throw new Error('Stripe URL not returned');
    }

    window.location.href = data.url;

  } catch (err) {
    console.error(err);
    alert('Ошибка при переходе к оплате');
    payBtn.disabled = false;
    payBtn.textContent = 'Оплатить';
  }
});

loadCart();
