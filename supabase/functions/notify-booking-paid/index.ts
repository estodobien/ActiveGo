import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* =========================
   INIT
========================= */
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "ActiveGo <send@mail.activego.eu>";
const REPLY_TO = "activegoplatform@gmail.com";
const ADMIN_EMAIL = "activegoplatform@gmail.com";

/* =========================
   HELPERS
========================= */
function formatDates(order: any) {
  return order.booking_date
    ? order.booking_date
    : `${order.booking_date_from} → ${order.booking_date_to}`;
}

function formatContactsText(profile: any) {
  return `
Email: ${profile.email ?? "—"}
WhatsApp: ${profile.whatsapp_phone ?? "—"}
Telegram: ${profile.telegram_username ?? "—"}

Предпочтительный канал: ${profile.notify_channel ?? "email"}
`.trim();
}

function wrapHtml(content: string) {
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
</head>
<body style="margin:0;padding:0;background:#f5f7fa;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:24px;">
        <table width="600" style="background:#ffffff;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background:#0f172a;color:#ffffff;padding:20px;">
              <h2 style="margin:0;">ActiveGo</h2>
              <p style="margin:4px 0 0;color:#cbd5e1;font-size:13px;">
                Активный отдых и туры
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6;">
              ${content}
            </td>
          </tr>

          <tr>
            <td style="padding:16px 24px;background:#f1f5f9;font-size:12px;color:#64748b;">
              Если у вас есть вопросы — просто ответьте на это письмо.<br/>
              © ActiveGo ${new Date().getFullYear()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

function contactButtons(profile: any) {
  let buttons = "";

  if (profile.whatsapp_phone) {
    buttons += `
<a href="https://wa.me/${profile.whatsapp_phone.replace("+", "")}"
   style="display:inline-block;margin-right:8px;padding:10px 14px;
   background:#25D366;color:#fff;border-radius:6px;text-decoration:none;">
WhatsApp
</a>`;
  }

  if (profile.telegram_username) {
    buttons += `
<a href="https://t.me/${profile.telegram_username.replace("@", "")}"
   style="display:inline-block;padding:10px 14px;
   background:#229ED9;color:#fff;border-radius:6px;text-decoration:none;">
Telegram
</a>`;
  }

  return buttons;
}

/* =========================
   SERVER
========================= */
serve(async (req) => {
  try {
    const { event, order_ids } = await req.json();
    console.log("📨 notify-bookin-paid called", { event, order_ids });

    if (!event || !Array.isArray(order_ids) || order_ids.length === 0) {
      return new Response("Invalid payload", { status: 400 });
    }

    /* =========================
       LOAD ORDERS
    ========================= */
    const { data: orders } = await supabase
      .from("orders")
      .select(`
        id,
        user_id,
        provider_id,
        service_id,
        quantity,
        total_price,
        booking_date,
        booking_date_from,
        booking_date_to
      `)
      .in("id", order_ids);

    if (!orders?.length) {
      return new Response("Orders not found", { status: 404 });
    }

    /* =========================
       LOAD PROFILES
    ========================= */
    const profileIds = [
      ...new Set(orders.flatMap(o => [o.user_id, o.provider_id])),
    ];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,email,whatsapp_phone,telegram_username,notify_channel")
      .in("id", profileIds);

    const profileMap = Object.fromEntries(
      (profiles ?? []).map(p => [p.id, p])
    );
    /* =========================
       LOAD SERVICES
    ========================= */
    const serviceIds = [...new Set(orders.map(o => o.service_id))];

    const { data: services } = await supabase
      .from("services")
      .select(`
        id,
        title,
        meeting_address,
        meeting_map_link,
        event_day_instructions
      `)
      .in("id", serviceIds);

    const serviceMap = Object.fromEntries(
      (services ?? []).map(s => [s.id, s])
    );
    /* =========================
       EMAIL QUEUE
    ========================= */
    const emails: any[] = [];

    for (const order of orders) {
      const client = profileMap[order.user_id];
      const provider = profileMap[order.provider_id];
      const service = serviceMap[order.service_id];

      if (!client?.email || !provider?.email) continue;

      const dates = formatDates(order);

      /* ---------- CLIENT ---------- */
      emails.push({
        to: client.email,
        subject: "Ваш заказ подтверждён ✅",
        text: `
Услуга: ${service.title}
Дата: ${dates}
Сумма: ${order.total_price} €

Инструкции:
${service.event_day_instructions ?? "Будут сообщены поставщиком"}

Контакты поставщика:
${formatContactsText(provider)}
        `,
        html: wrapHtml(`
<p>Здравствуйте!</p>

<p><strong>Ваш заказ подтверждён и оплачен.</strong></p>

<ul>
  <li><strong>Услуга:</strong> ${service.title}</li>
  <li><strong>Количество:</strong> ${order.quantity}</li>
  <li><strong>Дата:</strong> ${dates}</li>
  <li><strong>Сумма:</strong> ${order.total_price} €</li>
</ul>

<h3>📍 Информация о встрече</h3>
<p>${service.event_day_instructions ?? "Будет сообщена поставщиком"}</p>

${service.meeting_address ? `<p><strong>Адрес:</strong> ${service.meeting_address}</p>` : ""}
${service.meeting_map_link ? `<p><a href="${service.meeting_map_link}">Открыть карту</a></p>` : ""}

<h3>📞 Контакты поставщика</h3>
${contactButtons(provider)}
        `),
      });
      /* ---------- PROVIDER ---------- */
      emails.push({
        to: provider.email,
        subject: "Новый заказ оплачен 🚀",
        text: `
Услуга: ${service.title}
Количество: ${order.quantity}
Дата: ${dates}

Контакты клиента:
${formatContactsText(client)}
        `,
        html: wrapHtml(`
<p><strong>Новый заказ оплачен и подтверждён.</strong></p>

<ul>
  <li><strong>Услуга:</strong> ${service.title}</li>
  <li><strong>Количество:</strong> ${order.quantity}</li>
  <li><strong>Дата:</strong> ${dates}</li>
  <li><strong>Сумма:</strong> ${order.total_price} €</li>
</ul>

<h3>👤 Контакты клиента</h3>
${contactButtons(client)}
        `),
      });


      /* ---------- ADMIN ---------- */
emails.push({
  to: ADMIN_EMAIL,
  subject: `[ADMIN] Заказ #${order.id}`,
  text: `
Заказ #${order.id}
Услуга: ${service.title}
Дата: ${dates}
Сумма: ${order.total_price} €

--- Клиент ---
${formatContactsText(client)}

--- Поставщик ---
${formatContactsText(provider)}
  `,
  html: wrapHtml(`
<h3>🆔 Заказ #${order.id}</h3>

<p><strong>Услуга:</strong> ${service.title}</p>
<p><strong>Дата:</strong> ${dates}</p>
<p><strong>Сумма:</strong> ${order.total_price} €</p>

<hr/>

<h4>👤 Клиент</h4>
<pre style="background:#f8fafc;padding:12px;border-radius:6px;">
${formatContactsText(client)}
</pre>

<h4>🧑‍💼 Поставщик</h4>
<pre style="background:#f8fafc;padding:12px;border-radius:6px;">
${formatContactsText(provider)}
</pre>
  `),
});
    }

    await sendEmailsBatch(emails);
    return new Response("Emails sent", { status: 200 });

  } catch (err) {
    console.error("❌ EMAIL FUNCTION ERROR", err);
    return new Response("Internal error", { status: 500 });
  }
});

/* =========================
   RESEND BATCH
========================= */
async function sendEmailsBatch(emails: any[]) {
  if (!emails.length) return;

  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      emails.map(e => ({
        from: FROM_EMAIL,
        reply_to: REPLY_TO,
        to: [e.to],
        subject: e.subject,
        text: e.text,
        html: e.html,
      }))
    ),
  });

  const body = await res.text();
  console.log("📤 Resend:", res.status, body);

  if (!res.ok) throw new Error(body);
}
