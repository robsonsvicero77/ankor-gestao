import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL?.trim();
const supabasePublishableKey = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY must be configured.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
