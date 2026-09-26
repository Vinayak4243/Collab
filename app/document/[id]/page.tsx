import { redirect, notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { CollaborativeEditor } from '@/components/editor/CollaborativeEditor';
import { CommandPalette } from '@/components/command-palette/CommandPalette';
import { FileConverterDrawer } from '@/components/file-tools/FileConverterDrawer';
import { DocumentTitleBar } from '@/components/editor/DocumentTitleBar';

interface PageProps {
  params: { id: string };
}

export default async function DocumentPage({ params }: PageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  const { data: document, error } = await supabase
    .from('documents')
    .select('id, title, workspace_id, icon')
    .eq('id', params.id)
    .single();

  if (error || !document) notFound();

  return (
    <div className="flex h-screen flex-col">
      <DocumentTitleBar documentId={document.id} initialTitle={document.title} icon={document.icon} />
      <div className="flex-1 overflow-hidden">
        <CollaborativeEditor
          documentId={document.id}
          currentUser={{
            id: user.id,
            name: user.user_metadata?.full_name ?? user.email ?? 'Anonymous',
          }}
        />
      </div>
      <CommandPalette workspaceId={document.workspace_id} />
      <FileConverterDrawer />
    </div>
  );
}
