import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { ConversionKind } from '@/types/database';

export const runtime = 'nodejs';
export const maxDuration = 60; // heavy conversions can take a while

/**
 * Template for heavy document conversions (DOCX -> PDF, and the reverse)
 * that genuinely need a real layout engine — these are NOT feasible with
 * pure browser JS. In production this proxies to a small containerized
 * conversion microservice (e.g. Gotenberg — a Dockerized LibreOffice/Chromium
 * HTTP API — or a serverless LibreOffice Lambda layer), configured via
 * DOCUMENT_CONVERSION_SERVICE_URL.
 *
 * Flow:
 *   1. Auth-check the requesting user via their Supabase session cookie.
 *   2. Stream the uploaded file to the conversion microservice.
 *   3. Store the result in Supabase Storage and log a `file_conversions` row.
 *   4. Return a signed download URL to the client.
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
  const workspaceId = formData.get('workspaceId') as string | null;
  const direction = ((formData.get('direction') as string | null) ?? 'docx_to_pdf') as ConversionKind;

  if (!file || !workspaceId) {
    return NextResponse.json({ error: 'file and workspaceId are required' }, { status: 400 });
  }

  // 1. Log a queued job row (RLS ensures the user can only insert into a
  //    workspace they're an editor/owner of).
  const { data: job, error: insertError } = await supabase
    .from('file_conversions')
    .insert({
      workspace_id: workspaceId,
      requested_by: user.id,
      kind: direction,
      status: 'processing',
      source_path: `uploads/${user.id}/${file.name}`,
    })
    .select('id')
    .single();

  if (insertError || !job) {
    return NextResponse.json({ error: 'Could not create conversion job' }, { status: 500 });
  }

  try {
    // 2. Forward to the conversion microservice (e.g. Gotenberg's
    //    /forms/libreoffice/convert endpoint).
    const upstreamForm = new FormData();
    upstreamForm.append('files', file, file.name);

    const conversionResponse = await fetch(
      `${process.env.DOCUMENT_CONVERSION_SERVICE_URL}/convert?direction=${direction}`,
      { method: 'POST', body: upstreamForm }
    );

    if (!conversionResponse.ok) {
      throw new Error(`Conversion service returned ${conversionResponse.status}`);
    }

    const resultBuffer = await conversionResponse.arrayBuffer();
    const outputExt = direction === 'docx_to_pdf' ? 'pdf' : 'docx';
    const resultPath = `results/${user.id}/${job.id}.${outputExt}`;

    // 3. Store the converted file in Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(process.env.NEXT_PUBLIC_STORAGE_BUCKET!)
      .upload(resultPath, resultBuffer, {
        contentType: outputExt === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

    if (uploadError) throw uploadError;

    // 4. Mark the job complete and return a signed URL
    await supabase
      .from('file_conversions')
      .update({ status: 'completed', result_path: resultPath, completed_at: new Date().toISOString() })
      .eq('id', job.id);

    const { data: signedUrl } = await supabase.storage
      .from(process.env.NEXT_PUBLIC_STORAGE_BUCKET!)
      .createSignedUrl(resultPath, 60 * 10); // 10 minute expiry

    return NextResponse.json({ jobId: job.id, downloadUrl: signedUrl?.signedUrl });
  } catch (err) {
    await supabase
      .from('file_conversions')
      .update({ status: 'failed', error_message: (err as Error).message })
      .eq('id', job.id);

    return NextResponse.json({ error: 'Conversion failed', jobId: job.id }, { status: 502 });
  }
}
