import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/server';
import { CommandPalette } from '@/components/command-palette/CommandPalette';
import { WorkspaceSidebar } from '@/components/dashboard/WorkspaceSidebar';

// FileConverterDrawer imports heic2any which uses `window` at module scope —
// must be loaded client-side only to avoid SSR crashes.
const FileConverterDrawer = dynamic(
  () => import('@/components/file-tools/FileConverterDrawer').then((m) => m.FileConverterDrawer),
  { ssr: false }
);

/**
 * Server Component: fetches the user's workspaces, pinned docs, and recent
 * files directly from Postgres (RLS-scoped to the signed-in user) before
 * rendering — no client-side loading spinner for the initial view.
 */
interface DashboardPageProps {
  searchParams?: { workspace?: string };
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(id, name)')
    .eq('user_id', user.id);

  const workspaces = memberships?.map((m: any) => m.workspaces).filter(Boolean) ?? [];
  const requestedWorkspace = workspaces.find((w: any) => w.id === searchParams?.workspace);
  const activeWorkspaceId = requestedWorkspace?.id ?? workspaces[0]?.id;

  const { data: pinned } = activeWorkspaceId
    ? await supabase
        .from('documents')
        .select('id, title, icon, updated_at')
        .eq('workspace_id', activeWorkspaceId)
        .eq('is_pinned', true)
        .order('updated_at', { ascending: false })
    : { data: [] };

  const { data: recent } = activeWorkspaceId
    ? await supabase
        .from('documents')
        .select('id, title, icon, updated_at')
        .eq('workspace_id', activeWorkspaceId)
        .order('updated_at', { ascending: false })
        .limit(10)
    : { data: [] };

  return (
    <div className="flex h-screen">
      <WorkspaceSidebar workspaces={workspaces} activeWorkspaceId={activeWorkspaceId} />

      <main className="flex-1 overflow-y-auto bg-slate-50 p-8">
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-1 text-2xl font-semibold text-slate-900">
            Welcome back{user.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ''}
          </h1>
          <p className="mb-8 text-sm text-slate-500">
            Press <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5">⌘K</kbd> to
            search or run a command.
          </p>

          {pinned && pinned.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-medium text-slate-700">📌 Pinned</h2>
              <DocGrid docs={pinned} />
            </section>
          )}

          <section>
            <h2 className="mb-3 text-sm font-medium text-slate-700">Recent</h2>
            <DocGrid docs={recent ?? []} />
          </section>
        </div>
      </main>

      {activeWorkspaceId && <CommandPalette workspaceId={activeWorkspaceId} />}
      <FileConverterDrawer />
    </div>
  );
}

function DocGrid({ docs }: { docs: { id: string; title: string; icon: string | null }[] }) {
  if (docs.length === 0) {
    return <p className="text-sm text-slate-400">Nothing here yet.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {docs.map((doc) => (
        <a
          key={doc.id}
          href={`/document/${doc.id}`}
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 hover:border-slate-400"
        >
          <span className="mr-2">{doc.icon ?? '📄'}</span>
          {doc.title}
        </a>
      ))}
    </div>
  );
}
