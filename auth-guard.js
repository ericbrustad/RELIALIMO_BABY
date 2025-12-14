import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.SUPABASE_URL) ||
  (typeof window !== 'undefined' && window.ENV?.SUPABASE_URL) ||
  '<YOUR_SUPABASE_URL>';

const SUPABASE_ANON_KEY =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) ||
  (typeof window !== 'undefined' && window.ENV?.SUPABASE_ANON_KEY) ||
  '<YOUR_SUPABASE_ANON_KEY>';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export class AuthGuard {
  static async checkAuth() {
    const { data } = await supabase.auth.getSession();
    return Boolean(data?.session);
  }

  static async protectPage() {
    const hasSession = await this.checkAuth();

    if (!hasSession) {
      window.location.href = '/auth.html';
      return false;
    }

    return true;
  }

  static async setupAuthListener(callback) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        window.location.href = '/auth.html';
      }
      if (typeof callback === 'function') {
        callback(_event, session);
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  AuthGuard.protectPage().catch((error) => console.error('Failed to enforce auth guard', error));
});

export default AuthGuard;
