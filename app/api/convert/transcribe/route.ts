import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

/**
 * Speech-to-text transcription for uploaded audio/video. Proxies to a
 * hosted transcription API (this template targets OpenAI's Whisper API
 * shape — swap the fetch below for Deepgram/AssemblyAI/etc. as needed).
 * Kept server-side so the provider API key never reaches the browser.
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;

  if (!file) {
    return NextResponse.json({ error: 'file is required' }, { status: 400 });
  }

  const upstreamForm = new FormData();
  upstreamForm.append('file', file, file.name);
  upstreamForm.append('model', 'whisper-1');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.TRANSCRIPTION_API_KEY}`,
    },
    body: upstreamForm,
  });

  if (!response.ok) {
    const errorText = await response.text();
    return NextResponse.json({ error: `Transcription provider error: ${errorText}` }, { status: 502 });
  }

  const { text } = await response.json();
  return NextResponse.json({ text });
}
