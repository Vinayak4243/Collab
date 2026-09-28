'use client';

import { useState } from 'react';
import { Plus, LayoutGrid, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface WorkspaceSidebarProps {
  workspaces: { id: string; name: string }[];
  activeWorkspaceId?: string;
}

export function WorkspaceSidebar({ workspaces, activeWorkspaceId }: WorkspaceSidebarProps) {
  const router = useRouter();
  const supabase = createClient();
  const [creating, setCreating] = useState(false);
  const [creatingDoc, setCreatingDoc] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Ensures the signed-in auth user has a matching row in public.users.
   *  Needed when the user signed up before the DB trigger existed. */
  async function ensurePublicUser(user: { id: string; email: string | undefined; user_metadata: Record<string, string> }) {
    const { error } = await supabase.from('users').upsert(
      {
        id: user.id,
        email: user.email ?? '',
        full_name: user.user_metadata?.full_name ?? null,
        avatar_url: user.user_metadata?.avatar_url ?? null,
      },
      { onConflict: 'id' }
    );
    return error;
  }

  async function createDocument() {
    if (!activeWorkspaceId) {
      setError('Create a workspace first before adding documents.');
      return;
    }
    setCreatingDoc(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError('Not signed in.');
      setCreatingDoc(false);
      return;
    }

    // Make sure the user row exists before inserting (FK constraint)
    await ensurePublicUser(user as any);

    const { data, error: insertError } = await supabase
      .from('documents')
      .insert({
        workspace_id: activeWorkspaceId,
        title: 'Untitled',
        created_by: user.id,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('createDocument error:', insertError);
      setError(insertError.message);
    } else if (data) {
      router.push(`/document/${data.id}`);
    }
    setCreatingDoc(false);
  }

  async function createWorkspace() {
    setCreating(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError('Not signed in.');
      setCreating(false);
      return;
    }

    // Make sure the user row exists before inserting (FK constraint on owner_id)
    const userErr = await ensurePublicUser(user as any);
    if (userErr) {
      console.error('ensurePublicUser error:', userErr);
      setError(userErr.message);
      setCreating(false);
      return;
    }

    const { data: workspace, error: wsError } = await supabase
      .from('workspaces')
      .insert({ name: 'My Workspace', owner_id: user.id })
      .select('id')
      .single();

    if (wsError) {
      console.error('createWorkspace error:', wsError);
      setError(wsError.message);
      setCreating(false);
      return;
    }

    if (workspace) {
      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert({ workspace_id: workspace.id, user_id: user.id, role: 'owner' });

      if (memberError) {
        console.error('workspace_members insert error:', memberError);
        setError(memberError.message);
      } else {
        router.refresh();
      }
    }

    setCreating(false);
  }

  return (
    <aside className="flex w-60 flex-col border-r border-slate-100 bg-white p-3">
      <div className="mb-4 flex items-center gap-2 px-1 text-sm font-semibold text-slate-900">
        <LayoutGrid size={16} /> Workspaces
      </div>

      {error && (
        <div className="mb-3 flex items-start gap-1.5 rounded-lg bg-red-50 px-2 py-2 text-xs text-red-700">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mb-4 space-y-0.5">
        {workspaces.map((ws) => (
          <a
            key={ws.id}
            href={`/dashboard?workspace=${ws.id}`}
            className={`block rounded-lg px-2 py-1.5 text-sm ${
              ws.id === activeWorkspaceId
                ? 'bg-slate-100 font-medium text-slate-900'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            {ws.name}
          </a>
        ))}
        <button
          onClick={createWorkspace}
          disabled={creating}
          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:bg-slate-50 disabled:opacity-50"
        >
          <Plus size={14} /> {creating ? 'Creating…' : 'New workspace'}
        </button>
      </div>

      <button
        onClick={createDocument}
        disabled={creatingDoc}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        <Plus size={14} /> {creatingDoc ? 'Creating…' : 'New document'}
      </button>
    </aside>
  );
}
