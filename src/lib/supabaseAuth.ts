import type { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export async function signUpWithSupabase(
  email: string,
  password: string,
  displayName: string,
) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name: displayName },
      emailRedirectTo: window.location.origin,
    },
  });
}

export async function signInWithSupabase(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signInWithGoogleWithSupabase() {
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
    },
  });
}

export async function signOutFromSupabase() {
  return supabase.auth.signOut();
}

export async function getSupabaseSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onSupabaseAuthStateChange(
  callback: (event: string, session: Session | null) => void,
) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}

export function isSupabaseEmailVerified(user: User | null): boolean {
  return Boolean(user?.email_confirmed_at);
}
