'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import { useEffect, useRef } from 'react';
import { useCollaborativeDoc, type CollaboratorPresence } from '@/lib/hooks/useCollaborativeDoc';
import { createClient } from '@/lib/supabase/client';
import { EditorToolbar } from './EditorToolbar';

const lowlight = createLowlight(common);

const CURSOR_COLORS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6'];

interface CollaborativeEditorProps {
  documentId: string;
  currentUser: { id: string; name: string };
  /** Debounce (ms) between local edits and persisting a snapshot to Postgres. */
  persistDebounceMs?: number;
}

/**
 * Real-time collaborative rich-text editor.
 *
 * - Yjs (via Liveblocks) is the live source of truth for concurrent edits and
 *   multi-cursor presence — every keystroke merges through CRDT, so there are
 *   no lock conflicts between simultaneous editors.
 * - Postgres (`documents.content` + `documents.yjs_state`) is the durable
 *   snapshot: we debounce-persist it so the document still loads instantly
 *   and survives if the real-time room is empty/torn down.
 */
export function CollaborativeEditor({
  documentId,
  currentUser,
  persistDebounceMs = 2000,
}: CollaborativeEditorProps) {
  const supabase = createClient();
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

  const presence: CollaboratorPresence = {
    name: currentUser.name,
    color: CURSOR_COLORS[hashToIndex(currentUser.id, CURSOR_COLORS.length)],
  };

  const { ydoc, provider, isSynced } = useCollaborativeDoc(documentId, presence);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          // Yjs owns undo/redo history when Collaboration is active
          history: false,
          codeBlock: false,
        }),
        CodeBlockLowlight.configure({ lowlight }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Image,
        Link.configure({ openOnClick: false }),
        Placeholder.configure({ placeholder: "Type '/' for commands…" }),
        Collaboration.configure({ document: ydoc }),
        CollaborationCursor.configure({
          provider,
          user: presence,
        }),
      ],
      editorProps: {
        attributes: {
          class:
            'prose prose-slate max-w-none focus:outline-none min-h-[70vh] px-4 py-6',
        },
      },
      // Debounced persistence to Postgres as a durable fallback snapshot
      onUpdate: ({ editor }) => {
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(async () => {
          await supabase
            .from('documents')
            .update({ content: editor.getJSON() })
            .eq('id', documentId);
        }, persistDebounceMs);
      },
    },
    [ydoc, provider]
  );

  useEffect(() => {
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, []);

  if (!editor) return null;

  return (
    <div className="flex h-full flex-col">
      <EditorToolbar editor={editor} />
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-1.5 text-xs text-slate-400">
        <span className={`h-1.5 w-1.5 rounded-full ${isSynced ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        {isSynced ? 'All changes synced' : 'Connecting…'}
      </div>
      <EditorContent editor={editor} className="flex-1 overflow-y-auto" />
    </div>
  );
}

/** Deterministic color assignment so a user's cursor color stays stable across sessions. */
function hashToIndex(input: string, mod: number): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % mod;
}
