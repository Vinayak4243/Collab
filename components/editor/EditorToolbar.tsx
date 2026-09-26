'use client';

import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  CheckSquare,
  Heading1,
  Heading2,
  Quote,
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor;
}

/**
 * Minimal formatting toolbar. Note that most of these are also reachable via
 * native markdown shortcuts baked into StarterKit (e.g. "## " -> Heading2,
 * "- [ ] " -> task item, "```" -> code block), so the toolbar is a discovery
 * aid rather than the only path to formatting.
 */
export function EditorToolbar({ editor }: EditorToolbarProps) {
  const buttons = [
    {
      icon: Heading1,
      label: 'Heading 1',
      isActive: editor.isActive('heading', { level: 1 }),
      onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      icon: Heading2,
      label: 'Heading 2',
      isActive: editor.isActive('heading', { level: 2 }),
      onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      icon: Bold,
      label: 'Bold',
      isActive: editor.isActive('bold'),
      onClick: () => editor.chain().focus().toggleBold().run(),
    },
    {
      icon: Italic,
      label: 'Italic',
      isActive: editor.isActive('italic'),
      onClick: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      icon: Strikethrough,
      label: 'Strikethrough',
      isActive: editor.isActive('strike'),
      onClick: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      icon: Code,
      label: 'Code block',
      isActive: editor.isActive('codeBlock'),
      onClick: () => editor.chain().focus().toggleCodeBlock().run(),
    },
    {
      icon: List,
      label: 'Bullet list',
      isActive: editor.isActive('bulletList'),
      onClick: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      icon: ListOrdered,
      label: 'Numbered list',
      isActive: editor.isActive('orderedList'),
      onClick: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      icon: CheckSquare,
      label: 'Task list',
      isActive: editor.isActive('taskList'),
      onClick: () => editor.chain().focus().toggleTaskList().run(),
    },
    {
      icon: Quote,
      label: 'Quote',
      isActive: editor.isActive('blockquote'),
      onClick: () => editor.chain().focus().toggleBlockquote().run(),
    },
  ];

  return (
    <div className="flex items-center gap-0.5 border-b border-slate-100 px-2 py-1.5">
      {buttons.map(({ icon: Icon, label, isActive, onClick }) => (
        <button
          key={label}
          type="button"
          title={label}
          onClick={onClick}
          className={`rounded p-1.5 hover:bg-slate-100 ${
            isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500'
          }`}
        >
          <Icon size={16} />
        </button>
      ))}
    </div>
  );
}
