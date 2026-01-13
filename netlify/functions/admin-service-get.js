import { supabaseAdmin } from './_supabaseAdmin.js';

export async function handler(event) {
  const serviceId = event.queryStringParameters?.id;

  if (!serviceId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Service ID missing' }),
    };
  }

  const { data, error } = await supabaseAdmin
    .from('services')
    .select(`
      *,
      provider:profiles (
        id,
        name,
        email,
        telegram_id,
        whatsapp_phone,
        notify_channel
      )
    `)
    .eq('id', serviceId)
    .single();

  if (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(data),
  };
}
