'use client';

import { useState } from 'react';
import { Plus, LayoutGrid, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { ensureUserProfile } from '@/app/actions/ensure-user';

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

    // Step 1: upsert the user into public.users via service-role server action
    // (handles the case where the user signed up before the DB trigger existed)
    const { error: profileErr } = await ensureUserProfile();
    if (profileErr) {
      setError(`Profile sync failed: ${profileErr}`);
      setCreating(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError('Not signed in.');
      setCreating(false);
      return;
    }

    // Step 2: create the workspace
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

    // Step 3: add self as owner member
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
