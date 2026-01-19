// Example Edge Function (Deno TypeScript) for creating an auth user and driver row using the service role key
// Deploy as a Supabase Edge Function and set SUPABASE_SERVICE_ROLE_KEY in env

export const handler = async (req: Request) => {
  try {
    const body = await req.json();
    const { email, password, first_name, last_name, phone, affiliate_id } = body;
    if (!email) return new Response(JSON.stringify({ error: 'email required' }), { status: 400 });

    const SRK = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const PROJECT_URL = Deno.env.get('SUPABASE_URL');
    if (!SRK || !PROJECT_URL) return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });

    // Create auth user via admin endpoint
    const resp = await fetch(`${PROJECT_URL.replace(/\/$/, '')}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SRK}`
      },
      body: JSON.stringify({ email, password })
    });
    const userJson = await resp.json();
    if (!resp.ok) return new Response(JSON.stringify(userJson), { status: resp.status });

    const userId = userJson.id;
    if (!userId) return new Response(JSON.stringify({ error: 'user id missing from admin create response' }), { status: 500 });

    // Insert driver row using service role key
    const insertResp = await fetch(`${PROJECT_URL.replace(/\/$/, '')}/rest/v1/drivers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SRK}`,
        'apikey': SRK
      },
      body: JSON.stringify([{
        id: userId,
        email,
        first_name: first_name || null,
        last_name: last_name || null,
        phone: phone || null,
        affiliate_id: affiliate_id || null,
        status: 'PENDING'
      }])
    });

    const driverJson = await insertResp.json();
    if (!insertResp.ok) return new Response(JSON.stringify({ user: userJson, driver_error: driverJson }), { status: 500 });

    return new Response(JSON.stringify({ user: userJson, driver: driverJson }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
};