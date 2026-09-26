'use client';

import { useState } from 'react';
import { Plus, LayoutGrid } from 'lucide-react';
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

  async function createDocument() {
    if (!activeWorkspaceId) return;
    const { data } = await supabase
      .from('documents')
      .insert({ workspace_id: activeWorkspaceId, title: 'Untitled' })
      .select('id')
      .single();
    if (data) router.push(`/document/${data.id}`);
  }

  async function createWorkspace() {
    setCreating(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: workspace } = await supabase
      .from('workspaces')
      .insert({ name: 'New Workspace', owner_id: user.id })
      .select('id')
      .single();

    if (workspace) {
      await supabase
        .from('workspace_members')
        .insert({ workspace_id: workspace.id, user_id: user.id, role: 'owner' });
      router.refresh();
    }
    setCreating(false);
  }

  return (
    <aside className="flex w-60 flex-col border-r border-slate-100 bg-white p-3">
      <div className="mb-4 flex items-center gap-2 px-1 text-sm font-semibold text-slate-900">
        <LayoutGrid size={16} /> Workspaces
      </div>

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
          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-400 hover:bg-slate-50"
        >
          <Plus size={14} /> {creating ? 'Creating…' : 'New workspace'}
        </button>
      </div>

      <button
        onClick={createDocument}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        <Plus size={14} /> New document
      </button>
    </aside>
  );
}
