'use client';

import { useEffect, useMemo, useState } from 'react';
import * as Y from 'yjs';

export interface CollaboratorPresence {
  name: string;
  color: string;
}

/**
 * Sets up one Yjs document per document `id`, synced in real time via
 * Liveblocks' Yjs provider when NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY is set.
 * Falls back to a local-only Yjs doc when the key is missing so the editor
 * still works (just without multi-user sync).
 *
 * To enable real-time collaboration:
 *  1. Create a free account at https://liveblocks.io
 *  2. Copy your Public API key (starts with pk_)
 *  3. Add it to .env.local: NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY=pk_...
 *  4. Also add your Secret key: LIVEBLOCKS_SECRET_KEY=sk_...
 *  5. Restart the dev server
 */
export function useCollaborativeDoc(documentId: string, user: CollaboratorPresence) {
  const [isSynced, setIsSynced] = useState(false);

  const liveblocksKey = process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY;
  const isLiveblocksEnabled = Boolean(liveblocksKey);

  const { ydoc, provider } = useMemo(() => {
    const ydoc = new Y.Doc();

    if (!isLiveblocksEnabled) {
      // No key — return a stub provider so the rest of the hook stays identical
      return { ydoc, provider: null };
    }

    // Dynamically import to avoid crashing when key is absent
    const setupLiveblocks = async () => {
      const { createClient: createLiveblocksClient } = await import('@liveblocks/client');
      const { LiveblocksYjsProvider } = await import('@liveblocks/yjs');

      const client = createLiveblocksClient({ publicApiKey: liveblocksKey! });
      const { room } = client.enterRoom(`document-${documentId}`, {
        initialPresence: { name: user.name, color: user.color },
      });
      const provider = new LiveblocksYjsProvider(room, ydoc);
      setIsSynced(false);
      provider.on('sync', (synced: boolean) => setIsSynced(synced));
    };

    setupLiveblocks();
    return { ydoc, provider: null }; // provider set up async
  }, [documentId, isLiveblocksEnabled, liveblocksKey, user.name, user.color]);

  // When no Liveblocks, mark as "synced" immediately (local mode)
  useEffect(() => {
    if (!isLiveblocksEnabled) setIsSynced(true);
  }, [isLiveblocksEnabled]);

  useEffect(() => {
    return () => {
      ydoc.destroy();
    };
  }, [ydoc]);

  return { ydoc, provider, isSynced };
}
