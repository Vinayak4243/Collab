'use client';

import { useEffect, useState } from 'react';
import { X, Upload, Download, Loader2 } from 'lucide-react';
import * as pdfTools from '@/lib/conversion/pdfTools';
import * as imageTools from '@/lib/conversion/imageTools';
import * as audioVideoTools from '@/lib/conversion/audioVideoTools';
import * as docTools from '@/lib/conversion/archiveAndDocTools';

type ConversionOption = {
  id: string;
  label: string;
  accept: string;
  run: (files: File[]) => Promise<{ blob: Blob; filename: string }>;
};

const CONVERSIONS: Record<string, ConversionOption[]> = {
  Documents: [
    {
      id: 'pdf-merge',
      label: 'Merge PDFs into one',
      accept: 'application/pdf',
      run: async (files) => ({ blob: await pdfTools.mergePdfs(files), filename: 'merged.pdf' }),
    },
    {
      id: 'txt-to-pdf',
      label: 'Text/Markdown → PDF',
      accept: '.txt,.md',
      run: async ([file]) => {
        const text = await file.text();
        return { blob: await pdfTools.textToPdf(text), filename: 'document.pdf' };
      },
    },
    {
      id: 'md-to-html',
      label: 'Markdown → HTML',
      accept: '.md',
      run: async ([file]) => {
        const html = docTools.markdownToHtml(await file.text());
        return { blob: new Blob([html], { type: 'text/html' }), filename: 'document.html' };
      },
    },
    {
      id: 'docx-to-html',
      label: 'DOCX → HTML (read content)',
      accept: '.docx',
      run: async ([file]) => {
        const html = await docTools.docxToHtml(file);
        return { blob: new Blob([html], { type: 'text/html' }), filename: 'document.html' };
      },
    },
    {
      id: 'xlsx-to-csv',
      label: 'XLSX → CSV',
      accept: '.xlsx',
      run: async ([file]) => {
        const csv = await docTools.xlsxToCsv(file);
        return { blob: new Blob([csv], { type: 'text/csv' }), filename: 'sheet.csv' };
      },
    },
    {
      id: 'xlsx-to-json',
      label: 'XLSX → JSON',
      accept: '.xlsx',
      run: async ([file]) => {
        const json = await docTools.xlsxToJson(file);
        return {
          blob: new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }),
          filename: 'sheet.json',
        };
      },
    },
    {
      id: 'csv-to-xlsx',
      label: 'CSV → XLSX',
      accept: '.csv',
      run: async ([file]) => ({
        blob: docTools.csvToXlsx(await file.text()),
        filename: 'sheet.xlsx',
      }),
    },
  ],
  Images: [
    {
      id: 'pdf-to-png',
      label: 'PDF pages → PNG (one file per page, zipped)',
      accept: 'application/pdf',
      run: async ([file]) => {
        const images = await pdfTools.pdfPagesToImages(file, 'png');
        const zip = await docTools.compressToZip(
          images.map((blob, i) => ({ name: `page-${i + 1}.png`, blob }))
        );
        return { blob: zip, filename: 'pages.zip' };
      },
    },
    {
      id: 'images-to-pdf',
      label: 'Images → single PDF',
      accept: 'image/png,image/jpeg',
      run: async (files) => ({ blob: await pdfTools.imagesToPdf(files), filename: 'images.pdf' }),
    },
    {
      id: 'heic-to-jpg',
      label: 'HEIC (Apple) → JPG',
      accept: '.heic,.heif',
      run: async ([file]) => ({
        blob: await imageTools.heicToRaster(file, 'jpeg'),
        filename: 'photo.jpg',
      }),
    },
    {
      id: 'svg-to-png',
      label: 'SVG → PNG',
      accept: '.svg',
      run: async ([file]) => ({
        blob: await imageTools.svgToRaster(file, 'png'),
        filename: 'image.png',
      }),
    },
    {
      id: 'svg-to-pdf',
      label: 'SVG → PDF',
      accept: '.svg',
      run: async ([file]) => ({ blob: await imageTools.svgToPdf(file), filename: 'image.pdf' }),
    },
  ],
  'Audio & Video': [
    {
      id: 'audio-to-mp3',
      label: 'Audio → MP3',
      accept: 'audio/*',
      run: async ([file]) => ({
        blob: await audioVideoTools.convertAudio(file, 'mp3'),
        filename: 'audio.mp3',
      }),
    },
    {
      id: 'audio-to-wav',
      label: 'Audio → WAV',
      accept: 'audio/*',
      run: async ([file]) => ({
        blob: await audioVideoTools.convertAudio(file, 'wav'),
        filename: 'audio.wav',
      }),
    },
    {
      id: 'video-to-mp3',
      label: 'Video → MP3 (extract audio)',
      accept: 'video/*',
      run: async ([file]) => ({
        blob: await audioVideoTools.extractAudioFromVideo(file),
        filename: 'audio.mp3',
      }),
    },
    {
      id: 'video-to-gif',
      label: 'Video → GIF',
      accept: 'video/*',
      run: async ([file]) => ({
        blob: await audioVideoTools.videoToGif(file),
        filename: 'clip.gif',
      }),
    },
    {
      id: 'transcribe',
      label: 'Audio/Video → Transcript (text)',
      accept: 'audio/*,video/*',
      run: async ([file]) => {
        const { text } = await audioVideoTools.transcribeMedia(file);
        return { blob: new Blob([text], { type: 'text/plain' }), filename: 'transcript.txt' };
      },
    },
  ],
  Archives: [
    {
      id: 'zip-extract',
      label: 'Unzip archive (download extracted files as a folder .zip)',
      accept: '.zip',
      run: async ([file]) => {
        const entries = await docTools.unzipArchive(file);
        // Re-zip so the user gets one clean download regardless of source structure
        const rezipped = await docTools.compressToZip(
          entries.map((e) => ({ name: e.path, blob: e.blob }))
        );
        return { blob: rezipped, filename: 'extracted.zip' };
      },
    },
  ],
};

/**
 * Slide-over "File Tools" drawer. Opened via the command palette
 * (`open-file-tools` custom event) or a toolbar button. Every conversion in
 * `CONVERSIONS` runs client-side except transcription, which calls the
 * serverless API route.
 */
export function FileConverterDrawer() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ConversionOption | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const openHandler = () => setOpen(true);
    window.addEventListener('open-file-tools', openHandler);
    return () => window.removeEventListener('open-file-tools', openHandler);
  }, []);

  function reset() {
    setSelected(null);
    setFiles([]);
    setStatus('idle');
    setResultUrl(null);
    setErrorMsg(null);
  }

  async function handleConvert() {
    if (!selected || files.length === 0) return;
    setStatus('working');
    setErrorMsg(null);
    try {
      const { blob, filename } = await selected.run(files);
      setResultUrl(URL.createObjectURL(blob));
      setResultName(filename);
      setStatus('done');
    } catch (err) {
      setErrorMsg((err as Error).message ?? 'Conversion failed');
      setStatus('error');
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/20" onClick={() => setOpen(false)}>
      <div
        className="flex h-full w-full max-w-md flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">File Tools</h2>
          <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {!selected ? (
            <div className="space-y-5">
              {Object.entries(CONVERSIONS).map(([category, options]) => (
                <div key={category}>
                  <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                    {category}
                  </h3>
                  <div className="space-y-1">
                    {options.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => setSelected(opt)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <button onClick={reset} className="text-xs text-slate-400 hover:text-slate-600">
                ← Choose a different conversion
              </button>
              <p className="text-sm font-medium text-slate-900">{selected.label}</p>

              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-slate-200 px-4 py-8 text-center hover:border-slate-400">
                <Upload size={20} className="text-slate-400" />
                <span className="text-sm text-slate-500">
                  {files.length > 0 ? `${files.length} file(s) selected` : 'Click to choose file(s)'}
                </span>
                <input
                  type="file"
                  multiple
                  accept={selected.accept}
                  className="hidden"
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                />
              </label>

              <button
                onClick={handleConvert}
                disabled={files.length === 0 || status === 'working'}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {status === 'working' && <Loader2 size={15} className="animate-spin" />}
                {status === 'working' ? 'Converting…' : 'Convert'}
              </button>

              {status === 'error' && <p className="text-sm text-red-600">{errorMsg}</p>}

              {status === 'done' && resultUrl && (
                <a
                  href={resultUrl}
                  download={resultName}
                  className="flex items-center justify-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 py-2 text-sm font-medium text-emerald-700"
                >
                  <Download size={15} /> Download {resultName}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
