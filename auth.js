import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getSupabaseCredentials } from './supabase-config.js';

const msg = document.getElementById('msg');
const roleParam = new URLSearchParams(window.location.search).get('role');
const userRole = roleParam || 'Admin';
const isAdmin = userRole === 'Admin';

const magicForm = document.getElementById('magic-form');
const magicLinkDescription = document.getElementById('magic-link-description');
const magicLinkBadge = document.getElementById('magic-link-badge');
const magicLinkRole = document.getElementById('magic-link-role');

function setMessage(text, variant = '') {
  if (!msg) return;
  msg.textContent = text;
  msg.classList.toggle('error', variant === 'error');
  msg.classList.toggle('success', variant === 'success');
}

function magicLinkEnabledInSettings() {
  const storedValue = localStorage.getItem('magicLinkEnabled');
  if (storedValue === null) return true;
  return storedValue === 'true';
}

function updateMagicLinkAvailability() {
  const enabled = magicLinkEnabledInSettings();
  const showMagicLink = enabled && isAdmin;

  if (magicForm) {
    magicForm.hidden = !showMagicLink;
    magicForm.classList.toggle('is-hidden', !showMagicLink);
    magicForm.querySelectorAll('input, button').forEach((el) => {
      el.disabled = !showMagicLink;
    });
  }

  if (magicLinkRole) {
    magicLinkRole.textContent = `Viewing as ${userRole}`;
  }

  if (!magicLinkBadge || !magicLinkDescription) return;

  if (!enabled) {
    magicLinkBadge.textContent = 'Magic link disabled';
    magicLinkBadge.className = 'status-chip disabled';
    magicLinkDescription.textContent =
      'Magic link sign-in is turned off in System Settings. Contact an Admin to enable it again.';
    return;
  }

  if (!isAdmin) {
    magicLinkBadge.textContent = 'Restricted';
    magicLinkBadge.className = 'status-chip restricted';
    magicLinkDescription.textContent =
      'Magic link sign-in is available only to Admins. Please sign in with your password or ask an admin for help.';
    return;
  }

  magicLinkBadge.textContent = 'Magic link available';
  magicLinkBadge.className = 'status-chip enabled';
  magicLinkDescription.textContent =
    'Magic link sign-in is enabled for Admins. Use your Supabase email to request a link.';
}

let supabase;

try {
  const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } = getSupabaseCredentials();
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (error) {
  console.error('Supabase configuration error', error);
  setMessage('Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.', 'error');
  throw error;
}

async function redirectIfSignedIn() {
  const { data } = await supabase.auth.getSession();
  if (data?.session) {
    window.location.replace('/index.html');
  }
}

async function handlePasswordSignIn(event) {
  event.preventDefault();
  setMessage('Signing in…');

  const form = event.target;
  const email = form.email.value.trim();
  const password = form.password.value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    setMessage(error.message, 'error');
    return;
  }

  setMessage('Signed in — redirecting…', 'success');
  window.location.href = '/index.html';
}

async function handleMagicLink(event) {
  event.preventDefault();
  setMessage('Sending magic link…');

  const form = event.target;
  const email = form.email.value.trim();
  const redirectTo = `${window.location.origin}/auth/callback.html`;

  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });

  if (error) {
    setMessage(error.message, 'error');
    return;
  }

  setMessage('Check your email for the sign-in link.', 'success');
}

document.addEventListener('DOMContentLoaded', () => {
  redirectIfSignedIn();

  const loginForm = document.getElementById('login-form');
  updateMagicLinkAvailability();

  if (loginForm) {
    loginForm.addEventListener('submit', handlePasswordSignIn);
  }

  if (magicForm) {
    magicForm.addEventListener('submit', handleMagicLink);
  }
});

export { supabase };
