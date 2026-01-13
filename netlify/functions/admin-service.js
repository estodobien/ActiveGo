import { supabaseAdmin } from './_supabaseAdmin.js';

export async function handler() {
  const { data, error } = await supabaseAdmin
    .from('services')
    .select(`
      id,
      title,
      price,
      status,
      created_at,
      provider:profiles (
        id,
        name,
        email
      )
    `)
    .order('created_at', { ascending: false });

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
