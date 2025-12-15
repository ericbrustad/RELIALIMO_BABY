const roleParam = new URLSearchParams(window.location.search).get('role');
const userRole = roleParam || 'Admin';
const isAdmin = userRole === 'Admin';

const toggle = document.getElementById('magic-link-toggle');
const statusBadge = document.getElementById('magic-link-status');
const helperText = document.getElementById('magic-link-helper');
const roleChip = document.getElementById('role-chip');

function updateStatus(enabled) {
  statusBadge.textContent = enabled ? 'Magic links enabled' : 'Magic links disabled';
  statusBadge.classList.toggle('enabled', enabled);
  statusBadge.classList.toggle('disabled', !enabled);
  helperText.textContent = enabled
    ? 'Users with Admin access can continue to request Supabase magic link sign-in emails.'
    : 'Magic link sign-in is turned off. Only Admins can re-enable it when ready.';
}

function syncFromStorage() {
  const storedValue = localStorage.getItem('magicLinkEnabled');
  if (storedValue === null) return true;
  return storedValue === 'true';
}

function lockToggle() {
  toggle.disabled = true;
  helperText.textContent = 'Only Admins can change magic link access. Contact an administrator to request updates.';
  statusBadge.textContent = 'Restricted to Admins';
  statusBadge.classList.remove('enabled');
  statusBadge.classList.add('disabled');
}

document.addEventListener('DOMContentLoaded', () => {
  const initialEnabled = syncFromStorage();
  toggle.checked = initialEnabled;
  roleChip.textContent = `${userRole} view`;

  if (!isAdmin) {
    lockToggle();
    return;
  }

  updateStatus(initialEnabled);

  toggle.addEventListener('change', (event) => {
    const enabled = event.target.checked;
    localStorage.setItem('magicLinkEnabled', String(enabled));
    updateStatus(enabled);
  });
});
