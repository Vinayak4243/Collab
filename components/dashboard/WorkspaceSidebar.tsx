'use client';

import { useState } from 'react';
import { Plus, LayoutGrid, AlertCircle, LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { createWorkspaceAction } from '@/app/actions/workspace';

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

    const { error: wsError } = await createWorkspaceAction();
    if (wsError) {
      setError(wsError);
    } else {
      router.refresh();
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
            className={`block rounded-lg px-2 py-1.5 text-sm ${ws.id === activeWorkspaceId
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

      <div className="mt-auto pt-4 border-t border-slate-100">
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.push('/sign-in');
            router.refresh();
          }}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </aside>
  );
}
