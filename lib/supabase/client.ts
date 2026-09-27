'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

const getSupabaseUrl = () =>
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';

const getSupabaseAnonKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

/**
 * Browser-side Supabase client. Safe to import in any 'use client' component.
 * Reuses the anon key — RLS policies enforce per-row access, never the key itself.
 */
export function createClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.warn(
      'Missing Supabase environment variables. Using placeholder values so the client app can render locally.'
    );
  }

  return createBrowserClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
}
