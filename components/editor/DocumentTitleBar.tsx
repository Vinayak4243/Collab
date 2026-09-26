'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface DocumentTitleBarProps {
  documentId: string;
  initialTitle: string;
  icon: string | null;
}

export function DocumentTitleBar({ documentId, initialTitle, icon }: DocumentTitleBarProps) {
  const [title, setTitle] = useState(initialTitle);
  const supabase = createClient();
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>();

  function handleChange(value: string) {
    setTitle(value);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      await supabase.from('documents').update({ title: value }).eq('id', documentId);
    }, 600);
  }

  return (
    <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-3">
      <span className="text-xl">{icon ?? '📄'}</span>
      <input
        value={title}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full text-lg font-semibold text-slate-900 outline-none"
        placeholder="Untitled"
      />
    </div>
  );
}
