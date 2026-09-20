import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required for the Supabase client.'
  );
}

export const supabase = createClient<Database>(
  supabaseUrl || 'https://invalid.local',
  supabasePublishableKey || 'missing-publishable-key',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  },
);
