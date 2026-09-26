'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { FileText, Plus, Calendar, Tag, Wand2, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { DocumentRow } from '@/types/database';

interface CommandPaletteProps {
  workspaceId: string;
}

/**
 * Global command palette, opened with Cmd+K / Ctrl+K from anywhere in the app.
 * Combines fuzzy document search (via Postgres full-text search) with static
 * quick actions (new doc, today's note, open file converter).
 */
export function CommandPalette({ workspaceId }: CommandPaletteProps) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Pick<DocumentRow, 'id' | 'title' | 'icon'>[]>([]);

  // Cmd+K / Ctrl+K toggles the palette from anywhere
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Debounced full-text document search against Postgres
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const { data } = await supabase
        .from('documents')
        .select('id, title, icon')
        .eq('workspace_id', workspaceId)
        .textSearch('title', query, { type: 'websearch' })
        .limit(8);
      setResults(data ?? []);
    }, 200);
    return () => clearTimeout(handle);
  }, [query, workspaceId, supabase]);

  const createDocument = useCallback(
    async (overrides: Partial<DocumentRow> = {}) => {
      const { data, error } = await supabase
        .from('documents')
        .insert({ workspace_id: workspaceId, title: 'Untitled', ...overrides })
        .select('id')
        .single();
      if (!error && data) {
        setOpen(false);
        router.push(`/document/${data.id}`);
      }
    },
    [workspaceId, supabase, router]
  );

  const createTodaysNote = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    // Reuse today's note if it already exists rather than creating a duplicate
    const { data: existing } = await supabase
      .from('documents')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('is_daily_note', true)
      .eq('daily_note_date', today)
      .maybeSingle();

    if (existing) {
      setOpen(false);
      router.push(`/document/${existing.id}`);
      return;
    }

    await createDocument({
      title: new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
      is_daily_note: true,
      daily_note_date: today,
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: "Today's focus" }] },
          { type: 'taskList', content: [] },
        ],
      },
    });
  }, [workspaceId, supabase, router, createDocument]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Global command palette"
      className="fixed left-1/2 top-24 z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
    >
      <div className="flex items-center gap-2 border-b border-slate-100 px-3">
        <Search size={16} className="text-slate-400" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Search documents or run a command…"
          className="w-full py-3 text-sm outline-none placeholder:text-slate-400"
        />
      </div>

      <Command.List className="max-h-80 overflow-y-auto p-2">
        <Command.Empty className="py-6 text-center text-sm text-slate-400">
          No results found.
        </Command.Empty>

        {results.length > 0 && (
          <Command.Group heading="Documents" className="px-2 pb-2 text-xs font-medium text-slate-400">
            {results.map((doc) => (
              <Command.Item
                key={doc.id}
                onSelect={() => {
                  setOpen(false);
                  router.push(`/document/${doc.id}`);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 aria-selected:bg-slate-100"
              >
                <FileText size={15} className="text-slate-400" />
                {doc.title}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading="Quick actions" className="px-2 pb-2 text-xs font-medium text-slate-400">
          <Command.Item
            onSelect={() => createDocument()}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 aria-selected:bg-slate-100"
          >
            <Plus size={15} className="text-slate-400" /> New blank document
          </Command.Item>
          <Command.Item
            onSelect={createTodaysNote}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 aria-selected:bg-slate-100"
          >
            <Calendar size={15} className="text-slate-400" /> Open today&apos;s note
          </Command.Item>
          <Command.Item
            onSelect={() => {
              setOpen(false);
              router.push('/dashboard?tags=1');
            }}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 aria-selected:bg-slate-100"
          >
            <Tag size={15} className="text-slate-400" /> Browse by tag
          </Command.Item>
          <Command.Item
            onSelect={() => {
              setOpen(false);
              window.dispatchEvent(new CustomEvent('open-file-tools'));
            }}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 aria-selected:bg-slate-100"
          >
            <Wand2 size={15} className="text-slate-400" /> Open File Tools (convert files)
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
