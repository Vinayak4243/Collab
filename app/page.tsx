import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Root route ("/"). Signed-in users are sent straight to their dashboard;
 * everyone else sees a minimal marketing/landing page.
 */
export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect('/dashboard');

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-lg font-semibold text-slate-900">Collab</span>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/sign-in" className="text-slate-600 hover:text-slate-900">
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800"
          >
            Get started
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
          Real-time docs, notes, and file tools — all in one workspace
        </h1>
        <p className="mt-4 max-w-xl text-base text-slate-500">
          Write together with live multi-cursor editing, capture daily notes, organize
          with tags and folders, and convert files — PDF, DOCX, images, audio,
          video — without leaving the page.
        </p>
        <div className="mt-8 flex gap-3">
          <Link
            href="/sign-up"
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            Create your workspace
          </Link>
          <Link
            href="/sign-in"
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Sign in
          </Link>
        </div>

        <dl className="mt-16 grid max-w-3xl grid-cols-1 gap-8 text-left sm:grid-cols-3">
          <Feature
            title="Real-time collaboration"
            body="Multiple people edit the same document simultaneously with live cursors and presence."
          />
          <Feature
            title="Daily notes & tasks"
            body="One click to capture today's note, with clickable checklists and markdown shortcuts."
          />
          <Feature
            title="Built-in file conversion"
            body="PDF ↔ DOCX, images, audio, video, and archives — converted right inside the editor."
          />
        </dl>
      </main>

      <footer className="px-6 py-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Collab. All rights reserved.
      </footer>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-slate-900">{title}</dt>
      <dd className="mt-1 text-sm text-slate-500">{body}</dd>
    </div>
  );
}
