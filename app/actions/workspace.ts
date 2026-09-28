'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function makeAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

function makeAnonClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );
}

/**
 * Creates a workspace + owner membership using the service-role client.
 * The live Supabase DB may not have all RLS INSERT policies applied yet,
 * so we bypass RLS server-side rather than relying on the anon client.
 */
export async function createWorkspaceAction(
  name = 'My Workspace'
): Promise<{ workspaceId: string | null; error: string | null }> {
  const anonClient = makeAnonClient();
  const {
    data: { user },
  } = await anonClient.auth.getUser();

  if (!user) return { workspaceId: null, error: 'Not signed in' };

  const adminClient = makeAdminClient();

  // 1. Upsert the user profile (in case trigger never ran)
  await adminClient.from('users').upsert(
    {
      id: user.id,
      email: user.email ?? '',
      full_name: (user.user_metadata?.full_name as string) ?? null,
      avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
    },
    { onConflict: 'id' }
  );

  // 2. Create workspace
  const { data: workspace, error: wsError } = await adminClient
    .from('workspaces')
    .insert({ name, owner_id: user.id })
    .select('id')
    .single();

  if (wsError || !workspace) {
    return { workspaceId: null, error: wsError?.message ?? 'Failed to create workspace' };
  }

  // 3. Add owner as member
  const { error: memberError } = await adminClient.from('workspace_members').insert({
    workspace_id: workspace.id,
    user_id: user.id,
    role: 'owner',
  });

  if (memberError) {
    return { workspaceId: null, error: memberError.message };
  }

  return { workspaceId: workspace.id, error: null };
}
