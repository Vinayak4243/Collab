# Collab Platform — Real-time Docs, Notes & File Tools

A real-time collaborative document/productivity platform: TipTap + Yjs/Liveblocks
for multiplayer editing, Supabase for auth/data/storage, and an in-app File Tools
module for document/image/audio/video/archive conversion.

## 1. Stack summary

| Layer | Choice |
|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind + Shadcn-style primitives |
| Editor | TipTap (ProseMirror) with StarterKit, TaskList, CodeBlock, Image, Link |
| Real-time sync | Yjs CRDT, transported via Liveblocks (swap for `y-webrtc` to self-host) |
| Backend/DB | Supabase Postgres, with Row Level Security on every table |
| Auth | Supabase Auth — email/password + Google OAuth |
| Storage | Supabase Storage (swap for S3 by changing `lib/supabase/server.ts` upload calls) |
| Conversion (light) | Browser-side: `pdf-lib`, `pdfjs-dist`, `heic2any`, `ffmpeg.wasm`, `mammoth`, `xlsx`, `jszip` |
| Conversion (heavy) | Serverless API routes proxying to a LibreOffice/Gotenberg service + Whisper API |

## 2. Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project (free tier is enough to start)
- A [Liveblocks](https://liveblocks.io) account (free tier) — or skip and use `y-webrtc` instead
- (Optional, for heavy conversions) a running [Gotenberg](https://gotenberg.dev) instance
  and an OpenAI (or other) API key for transcription

## 3. Project folder structure

```
collab-platform/
├── app/
│   ├── (auth)/sign-in/page.tsx        # Email + Google OAuth sign-in
│   ├── (auth)/sign-up/page.tsx        # Email sign-up
│   ├── auth/callback/route.ts         # OAuth/magic-link redirect handler
│   ├── dashboard/page.tsx             # Workspace list, pinned + recent docs
│   ├── document/[id]/page.tsx         # Real-time collaborative editor page
│   ├── api/convert/
│   │   ├── docx-to-pdf/route.ts       # Serverless: heavy DOCX<->PDF conversion
│   │   └── transcribe/route.ts        # Serverless: audio/video -> text
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── editor/
│   │   ├── CollaborativeEditor.tsx    # TipTap + Yjs + Liveblocks wiring
│   │   ├── EditorToolbar.tsx
│   │   └── DocumentTitleBar.tsx
│   ├── command-palette/CommandPalette.tsx   # Cmd+K global search & actions
│   ├── file-tools/FileConverterDrawer.tsx   # Slide-over "File Tools" panel
│   └── dashboard/WorkspaceSidebar.tsx
├── lib/
│   ├── supabase/{client,server}.ts    # Browser + server Supabase clients
│   ├── hooks/useCollaborativeDoc.ts   # Yjs doc + Liveblocks provider hook
│   └── conversion/
│       ├── pdfTools.ts                # pdf-lib / pdfjs-dist
│       ├── imageTools.ts              # HEIC / SVG / raster conversion
│       ├── audioVideoTools.ts         # ffmpeg.wasm + transcription client
│       └── archiveAndDocTools.ts      # zip, docx->html, xlsx<->csv/json, md<->html
├── supabase/schema.sql                 # Full Postgres schema + RLS policies
├── types/database.ts                   # Hand-typed Supabase row types
├── middleware.ts                       # Session refresh + route protection
├── .env.local.example
└── package.json
```

## 4. Setup steps

### 4.1 Install dependencies

```bash
npm install
```

### 4.2 Configure Supabase

1. Create a project at supabase.com.
2. In the SQL editor, run the entire contents of `supabase/schema.sql`.
3. In **Authentication → Providers**, enable **Google** and paste your Google OAuth
   client ID/secret (from Google Cloud Console → APIs & Services → Credentials).
4. In **Authentication → URL Configuration**, set the redirect URL to
   `http://localhost:3000/auth/callback` (and your production URL later).
5. In **Storage**, create a bucket named `documents` (matches `NEXT_PUBLIC_STORAGE_BUCKET`).
   Make it private — the app uses signed URLs for downloads.

### 4.3 Configure Liveblocks (real-time sync)

1. Create a project at liveblocks.io.
2. Copy your public + secret keys into `.env.local`.
3. (If self-hosting instead) delete the Liveblocks dependency and swap
   `lib/hooks/useCollaborativeDoc.ts` to use `y-webrtc`'s `WebrtcProvider`
   pointed at your own signaling server — the rest of the editor code (Yjs +
   TipTap Collaboration extension) is unchanged either way.

### 4.4 Environment variables

```bash
cp .env.local.example .env.local
# then fill in every value — see inline comments in that file
```

### 4.5 (Optional) Heavy conversion service

For true DOCX↔PDF conversion and audio/video transcription:

```bash
# Run Gotenberg locally via Docker for DOCX<->PDF
docker run --rm -p 3001:3000 gotenberg/gotenberg:8
# then set DOCUMENT_CONVERSION_SERVICE_URL=http://localhost:3001 in .env.local
```

Set `TRANSCRIPTION_API_KEY` to an OpenAI API key (or adapt
`app/api/convert/transcribe/route.ts` for Deepgram/AssemblyAI).

### 4.6 Run the dev server

```bash
npm run dev
```

Visit `http://localhost:3000/sign-up` to create your first account, then
create a workspace from the dashboard sidebar.

## 5. Key behaviors to know

- **Auto-save**: the editor persists a JSON snapshot to `documents.content`
  every 2s of inactivity (debounced) — Yjs/Liveblocks handles the *live*
  multiplayer sync, Postgres is the durable fallback.
- **Command palette**: `Cmd+K` / `Ctrl+K` anywhere in the app. Full-text
  search hits Postgres via `textSearch()`, scoped by RLS to the current
  workspace.
- **Today's Note**: the palette's "Open today's note" action is idempotent —
  it reuses the existing note for the current date instead of duplicating it.
- **File Tools**: opened via the palette or a toolbar trigger event
  (`window.dispatchEvent(new CustomEvent('open-file-tools'))`). Every
  conversion in the drawer runs in-browser except transcription, which calls
  a serverless route to keep the provider API key off the client.
- **RLS is the only authorization boundary** — there is no server-side
  permission check duplicated in application code; every Supabase call is
  automatically scoped to what the signed-in user's `workspace_members` role
  allows.

## 6. Production hardening checklist (not yet included, do before shipping)

- Rate-limit the `/api/convert/*` routes (e.g. Upstash Redis) — media
  transcoding and transcription are expensive per-request.
- Add virus/malware scanning on uploaded files before they hit Storage.
- Move ffmpeg.wasm conversions to a queued worker for files over ~2 minutes —
  browser tabs will hang the UI on large media without a Web Worker wrapper.
- Add optimistic UI + conflict banners for offline reconnect scenarios in the
  collaborative editor (Liveblocks handles most of this, but test thoroughly).
- Add virtualized rendering to the dashboard's recent/pinned lists once
  workspaces grow past a few hundred documents.
