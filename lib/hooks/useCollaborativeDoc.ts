'use client';

import { useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';
import { createClient as createLiveblocksClient } from '@liveblocks/client';
import { LiveblocksYjsProvider } from '@liveblocks/yjs';

export interface CollaboratorPresence {
  name: string;
  color: string;
}

/**
 * Sets up one Yjs document per Claude document `id`, synced in real time via
 * Liveblocks' Yjs provider (WebSocket transport + presence/cursor awareness
 * handled for you). Swap `LiveblocksYjsProvider` for `y-webrtc`'s
 * WebrtcProvider if self-hosting instead of using Liveblocks — the rest of
 * this hook and the TipTap Collaboration extension stay identical either way.
 *
 * @param documentId  the `documents.id` row this editor session is attached to
 * @param user        current user's identity, shown as a colored cursor to others
 */
export function useCollaborativeDoc(documentId: string, user: CollaboratorPresence) {
  const [isSynced, setIsSynced] = useState(false);

  const { ydoc, provider } = useMemo(() => {
    const ydoc = new Y.Doc();

    const client = createLiveblocksClient({
      publicApiKey: process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY!,
    });

    // Each document gets its own Liveblocks "room" so edits never leak
    // between unrelated documents.
    const { room } = client.enterRoom(`document-${documentId}`, {
      initialPresence: { name: user.name, color: user.color },
    });

    const provider = new LiveblocksYjsProvider(room, ydoc);

    return { ydoc, provider };
  }, [documentId, user.name, user.color]);

  useEffect(() => {
    const handleSync = (synced: boolean) => setIsSynced(synced);
    provider.on('sync', handleSync);

    return () => {
      provider.off('sync', handleSync);
      provider.destroy();
      ydoc.destroy();
    };
  }, [provider, ydoc]);

  return { ydoc, provider, isSynced };
}
