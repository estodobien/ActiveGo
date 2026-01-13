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
`.trim();
}

function wrapHtml(content: string) {
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
</head>
<body style="font-family:Arial;background:#f5f7fa;padding:24px;">
  <div style="max-width:600px;margin:auto;background:#fff;border-radius:12px;padding:24px;">
    <h2 style="margin-top:0;">ActiveGo</h2>

    ${content}

    <hr style="margin:24px 0;"/>
    <p style="font-size:12px;color:#666;">
      Если у вас есть вопросы — просто ответьте на это письмо.<br/>
      © ActiveGo ${new Date().getFullYear()}
    </p>
  </div>
</body>
</html>`;
}

/* =========================
   SERVER
========================= */
serve(async (req) => {

  /* ===== CORS ===== */
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  /* ===== PARSE BODY ===== */
  let payload: any;
  try {
    payload = await req.json();
  } catch {
    console.error("❌ INVALID JSON BODY");
    return new Response("Invalid JSON body", { status: 400 });
  }

  const { event, order_ids } = payload;

  console.log("📨 notify-booking-cancelled payload:", payload);

  if (
    !["cancelled_by_client", "cancelled_by_provider"].includes(event) ||
    !Array.isArray(order_ids) ||
    !order_ids.length
  ) {
    return new Response("Invalid payload", { status: 400 });
  }

  const cancelLabel =
    event === "cancelled_by_client"
      ? "❌ Отменено клиентом"
      : "❌ Отменено поставщиком";

  try {
    /* ===== LOAD ORDERS ===== */
    const { data: orders } = await supabase
      .from("orders")
      .select(`
        id,
        user_id,
        provider_id,
        service_id,
        quantity,
        booking_date,
        booking_date_from,
        booking_date_to
      `)
      .in("id", order_ids);

    if (!orders?.length) {
      return new Response("Orders not found", { status: 404 });
    }

    /* ===== LOAD PROFILES ===== */
    const profileIds = [
      ...new Set(orders.flatMap(o => [o.user_id, o.provider_id])),
    ];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,email,whatsapp_phone,telegram_username")
      .in("id", profileIds);

    const profileMap = Object.fromEntries(
      (profiles ?? []).map(p => [p.id, p])
    );

    /* ===== LOAD SERVICES ===== */
    const serviceIds = [...new Set(orders.map(o => o.service_id))];

    const { data: services } = await supabase
      .from("services")
      .select("id,title")
      .in("id", serviceIds);

    const serviceMap = Object.fromEntries(
      (services ?? []).map(s => [s.id, s])
    );

    /* ===== BUILD EMAILS ===== */
    const emails: any[] = [];

    for (const order of orders) {
      const client = profileMap[order.user_id];
      const provider = profileMap[order.provider_id];
      const service = serviceMap[order.service_id];
      const dates = formatDates(order);

      if (!client?.email || !provider?.email) continue;

      /* ===== CLIENT CANCEL ===== */
      if (event === "cancelled_by_client") {
        emails.push({
          to: client.email,
          subject: "Заказ отменён ❌",
          text: "Вы отменили заказ. Средства будут возвращены.",
          html: wrapHtml(`
            <p><strong>Вы отменили заказ.</strong></p>
            <p>Оплата будет возвращена в полном объёме.</p>
          `),
        });

        emails.push({
          to: provider.email,
          subject: "Клиент отменил заказ ❌",
          text: `${service.title} — ${dates}`,
          html: wrapHtml(`
            <p><strong>Клиент отменил заказ.</strong></p>
            <p>${service.title}</p>
            <p>${dates}</p>
          `),
        });
      }

      /* ===== PROVIDER CANCEL ===== */
      if (event === "cancelled_by_provider") {
        emails.push({
          to: client.email,
          subject: "Заказ отменён поставщиком ❌",
          text: "Поставщик отменил заказ. Вы можете выбрать другую услугу.",
          html: wrapHtml(`
            <p><strong>Поставщик отменил ваш заказ.</strong></p>
            <p>Вы можете выбрать другую услугу на платформе.</p>
          `),
        });

        emails.push({
          to: provider.email,
          subject: "Вы отменили заказ ⚠️",
          text: "Частые отмены могут повлиять на рейтинг.",
          html: wrapHtml(`
            <p><strong>Вы отменили заказ клиента.</strong></p>
            <p>Частые отмены могут негативно повлиять на ваш рейтинг.</p>
          `),
        });
      }

      /* ===== ADMIN ===== */
      emails.push({
        to: ADMIN_EMAIL,
        subject: `[ADMIN] ${cancelLabel} — заказ #${order.id}`,
        text: `
${cancelLabel}
Заказ #${order.id}

${service.title}
${dates}

Клиент:
${formatContactsText(client)}

Поставщик:
${formatContactsText(provider)}
        `,
        html: wrapHtml(`
          <h3>${cancelLabel}</h3>
          <p><strong>Заказ #${order.id}</strong></p>
          <p>${service.title}</p>
          <p>${dates}</p>

          <h4>Клиент</h4>
          <pre>${formatContactsText(client)}</pre>

          <h4>Поставщик</h4>
          <pre>${formatContactsText(provider)}</pre>
        `),
      });
    }

    await sendEmailsBatch(emails);
    return new Response("Cancel emails sent", { status: 200 });

  } catch (err) {
    console.error("❌ CANCEL EMAIL ERROR", err);
    return new Response("Internal error", { status: 500 });
  }
});

/* =========================
   RESEND
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

  if (!res.ok) {
    const body = await res.text();
    throw new Error(body);
  }
}
