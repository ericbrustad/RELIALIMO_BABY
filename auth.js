import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getSupabaseCredentials } from './supabase-config.js';

const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY } = getSupabaseCredentials();
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const msg = document.getElementById('msg');

function setMessage(text, variant = '') {
  if (!msg) return;
  msg.textContent = text;
  msg.classList.toggle('error', variant === 'error');
  msg.classList.toggle('success', variant === 'success');
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
  const magicForm = document.getElementById('magic-form');

  if (loginForm) {
    loginForm.addEventListener('submit', handlePasswordSignIn);
  }

  if (magicForm) {
    magicForm.addEventListener('submit', handleMagicLink);
  }
});

export { supabase };
