import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getSupabaseCredentials, getSupabaseAuthUrl } from './supabase-config.js';

let supabase = null;

function safeText(value) {
  return (value ?? '').toString();
}

function getInitials(email) {
  const s = safeText(email).trim();
  if (!s) return '?';
  return s[0].toUpperCase();
}

function getRole(user) {
  return (
    user?.role ||
    user?.user_metadata?.role ||
    user?.app_metadata?.role ||
    ''
  );
}

function ensureStyles() {
  const id = 'user-menu-styles';
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = 'user-menu.css';
  document.head?.appendChild(link);
}

function ensureContainer() {
  let container = document.getElementById('userMenuContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'userMenuContainer';
  } else if (container.parentElement && container.parentElement !== document.body) {
    container.parentElement.removeChild(container);
  }

  // Single, fixed overlay in the top-left
  container.classList.add('user-menu-overlay');
  container.classList.remove('user-menu-floating');
  document.body.appendChild(container);

  return container;
}

function renderSkeleton(container) {
  container.innerHTML = `
    <div class="user-menu-wrapper">
      <button type="button" class="user-menu-toggle" aria-expanded="false" id="userMenuToggle">
        <span class="user-avatar" id="userMenuAvatar">?</span>
        <span class="user-email" id="userMenuEmail">...</span>
        <span class="menu-icon" aria-hidden="true">▼</span>
      </button>

      <div class="user-menu-dropdown" id="userMenuDropdown" style="display:none;">
        <div class="menu-header">
          <div class="menu-user-info">
            <div class="menu-avatar" id="userMenuAvatarBig">?</div>
            <div>
              <div class="menu-email" id="userMenuEmailBig">...</div>
              <div class="menu-role" id="userMenuRole">&nbsp;</div>
            </div>
          </div>
        </div>

        <div class="menu-divider"></div>

        <button type="button" class="menu-item" id="userMenuSignIn" style="display:none;">
          <span class="menu-icon">🔑</span>
          <span>Sign in</span>
        </button>

        <button type="button" class="menu-item menu-item-danger" id="userMenuLogout">
          <span class="menu-icon">⏻</span>
          <span>Log out</span>
        </button>
      </div>
    </div>
  `;
}

function setMenuState({ email, role, signedIn }) {
  const emailText = signedIn ? email : 'Not signed in';

  const avatar = document.getElementById('userMenuAvatar');
  const avatarBig = document.getElementById('userMenuAvatarBig');
  const emailEl = document.getElementById('userMenuEmail');
  const emailBig = document.getElementById('userMenuEmailBig');
  const roleEl = document.getElementById('userMenuRole');

  if (avatar) avatar.textContent = getInitials(email);
  if (avatarBig) avatarBig.textContent = getInitials(email);
  if (emailEl) emailEl.textContent = emailText;
  if (emailBig) emailBig.textContent = signedIn ? email : 'Not signed in';
  if (roleEl) roleEl.textContent = role ? `Role: ${role}` : (signedIn ? '' : '');

  const signInBtn = document.getElementById('userMenuSignIn');
  const logoutBtn = document.getElementById('userMenuLogout');
  if (signInBtn) signInBtn.style.display = signedIn ? 'none' : 'flex';
  if (logoutBtn) logoutBtn.style.display = signedIn ? 'flex' : 'none';
}

function wireInteractions() {
  const toggleBtn = document.getElementById('userMenuToggle');
  const dropdown = document.getElementById('userMenuDropdown');
  if (!toggleBtn || !dropdown) return;

  const close = () => {
    dropdown.style.display = 'none';
    toggleBtn.classList.remove('active');
    toggleBtn.setAttribute('aria-expanded', 'false');
  };

  const open = () => {
    dropdown.style.display = 'block';
    toggleBtn.classList.add('active');
    toggleBtn.setAttribute('aria-expanded', 'true');
  };

  toggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isOpen = dropdown.style.display !== 'none';
    if (isOpen) close(); else open();
  });

  document.addEventListener('click', (e) => {
    if (e.target?.closest?.('.user-menu-wrapper')) return;
    close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  const signInBtn = document.getElementById('userMenuSignIn');
  if (signInBtn) {
    signInBtn.addEventListener('click', () => {
      window.location.href = 'auth.html';
    });
  }

  const logoutBtn = document.getElementById('userMenuLogout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        // Sign out SDK session (used by auth-guard)
        if (supabase?.auth?.signOut) {
          await supabase.auth.signOut();
        }
      } catch {
        // ignore
      }

      try {
        // Also clear REST-client session keys if used elsewhere
        const mod = await import('./supabase-client.js');
        if (mod?.signOut) {
          await mod.signOut();
        }
      } catch {
        // ignore
      }

      window.location.href = 'auth.html';
    });
  }
}

async function refreshUser() {
  try {
    if (!supabase) return;
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      setMenuState({ email: '', role: '', signedIn: false });
      return;
    }

    const user = data?.user;
    if (!user) {
      setMenuState({ email: '', role: '', signedIn: false });
      return;
    }

    setMenuState({
      email: safeText(user.email),
      role: safeText(getRole(user)),
      signedIn: true
    });
  } catch {
    setMenuState({ email: '', role: '', signedIn: false });
  }
}

async function init() {
  // Avoid duplicate pills when running inside an iframe that already has one at the top window
  try {
    if (window.self !== window.top) {
      const parentHasMenu = !!window.top?.document?.getElementById('userMenuContainer');
      if (parentHasMenu) return;
    }
  } catch {
    // Cross-origin or other access issue; continue locally
  }

  ensureStyles();
  const container = ensureContainer();
  if (!container) return;

  renderSkeleton(container);

  try {
    const { anonKey } = getSupabaseCredentials();
    const url = getSupabaseAuthUrl(); // use direct Supabase URL for auth client
    supabase = createClient(url, anonKey);
  } catch {
    supabase = null;
  }

  wireInteractions();
  await refreshUser();

  // Live updates when session changes
  try {
    supabase?.auth?.onAuthStateChange?.(() => {
      refreshUser();
    });
  } catch {
    // ignore
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init();
});
