'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && !url.includes('placeholder-project') && !key.includes('placeholder'));
}

const getSupabaseUrl = () =>
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co';

const getSupabaseAnonKey = () =>
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

/**
 * Browser-side Supabase client. Safe to import in any 'use client' component.
 * Reuses the anon key — RLS policies enforce per-row access, never the key itself.
 */
export function createClient() {
  if (!isSupabaseConfigured()) {
    console.warn(
      'Missing or placeholder Supabase environment variables. Please configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.'
    );
  }

  return createBrowserClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
}

