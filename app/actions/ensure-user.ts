'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server action — runs with the service_role key so it bypasses RLS.
 * Upserts the signed-in user into public.users (needed when the user
 * signed up before the handle_new_user trigger was created).
 */
export async function ensureUserProfile(): Promise<{ error: string | null }> {
  const cookieStore = cookies();

  // Anon client — just to read the session
  const anonClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
  } = await anonClient.auth.getUser();

  if (!user) return { error: 'Not signed in' };

  // Admin client — bypasses ALL RLS policies
  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  const { error } = await adminClient.from('users').upsert(
    {
      id: user.id,
      email: user.email ?? '',
      full_name: (user.user_metadata?.full_name as string) ?? null,
      avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
    },
    { onConflict: 'id' }
  );

  if (error) {
    console.error('[ensureUserProfile]', error);
    return { error: error.message };
  }

  return { error: null };
}
