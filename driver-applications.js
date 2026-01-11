import { getSupabaseClient, apiFetch } from './api-service.js';

const tbody = document.querySelector('#apps-table tbody');
const client = getSupabaseClient();

async function loadApps() {
  tbody.innerHTML = '<tr><td colspan="7">Loading...</td></tr>';
  try {
    const res = await apiFetch('/rest/v1/driver_applications?select=*,affiliates(company_name)&order=created_at.desc');
    if (!res.ok) throw new Error('fetch failed ' + res.status);
    const rows = await res.json();
    renderRows(rows);
  } catch (err) {
    console.error('Failed to load applications', err);
    tbody.innerHTML = '<tr><td colspan="7">Failed to load applications</td></tr>';
  }
}

function renderRows(rows) {
  if (!rows || !rows.length) {
    tbody.innerHTML = '<tr><td colspan="7">No applications</td></tr>';
    return;
  }
  tbody.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${new Date(r.created_at).toLocaleString()}</td>
      <td>${r.email}</td>
      <td>${(r.first_name||'') + ' ' + (r.last_name||'')}</td>
      <td>${r.phone || ''}</td>
      <td>${r.affiliates?.company_name || ''}</td>
      <td>${r.status}</td>
      <td>
        ${r.status === 'submitted' ? `<button data-id="${r.id}" class="approve">Approve</button><button data-id="${r.id}" class="reject">Reject</button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function approveApplication(appId, row) {
  try {
    // Generate a temp password server-side by the Edge Function; pass admin id
    const adminId = (await client.auth.getUser()).data?.user?.id;
    if (!adminId) throw new Error('Not authenticated');

    const res = await apiFetch('/functions/v1/create-driver', { method: 'POST', body: JSON.stringify({ application_id: appId, admin_user_id: adminId }) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(JSON.stringify(err));
    }
    alert('Application approved and account created.');
    loadApps();
  } catch (err) {
    console.error('Approve failed', err);
    alert('Approve failed: ' + String(err));
  }
}

async function rejectApplication(appId) {
  try {
    const res = await apiFetch(`/rest/v1/driver_applications?id=eq.${appId}`, { method: 'PATCH', body: JSON.stringify({ status: 'rejected' }) });
    if (!res.ok) throw new Error('reject failed ' + res.status);
    alert('Application rejected');
    loadApps();
  } catch (err) {
    console.error('Reject failed', err);
    alert('Reject failed: ' + String(err));
  }
}

document.addEventListener('click', (e) => {
  if (e.target.matches('button.approve')) {
    approveApplication(e.target.dataset.id);
  } else if (e.target.matches('button.reject')) {
    rejectApplication(e.target.dataset.id);
  }
});

loadApps();
