// api-service.js

const API_BASE =
  window.ENV?.SUPABASE_URL
    ? `${window.ENV.SUPABASE_URL}/rest/v1`
    : "/rest/v1";

const API_KEY =
  window.ENV?.SUPABASE_ANON_KEY || "";

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      apikey: API_KEY,
      Authorization: `Bearer ${API_KEY}`,
      ...options.headers
    },
    ...options
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || JSON.stringify(data));
  return data;
}

export async function createDriver(payload) {
  const rows = await request("/drivers", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return rows[0];
}

export async function getAffiliates() {
  return await request("/affiliates?order=company_name.asc");
}

export async function createAffiliate(payload) {
  const rows = await request("/affiliates", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return rows[0];
}

export async function getVehicleTypes() {
  return await request("/vehicle_types?order=name.asc");
}

export async function createFleetVehicle(payload) {
  const rows = await request("/fleet_vehicles", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return rows[0];
}
