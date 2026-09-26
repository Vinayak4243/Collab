/**
 * Archive handling (zip) and lightweight document format conversions that
 * are feasible entirely client-side: DOCX -> HTML (read-only extraction via
 * mammoth), Markdown <-> HTML, and XLSX <-> CSV/JSON.
 *
 * DOCX/PDF *generation* from rich content, and true DOCX <-> PDF round trips,
 * require a real layout engine (Word/LibreOffice) and are routed to the
 * serverless API — see app/api/convert/docx-to-pdf/route.ts.
 */
import JSZip from 'jszip';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { marked } from 'marked';
import TurndownService from 'turndown';

// ---------------------------------------------------------------------------
// Archives
// ---------------------------------------------------------------------------

/** Extracts a .zip archive's files as { path, blob } entries (e.g. to import as notes/attachments). */
export async function unzipArchive(file: File): Promise<{ path: string; blob: Blob }[]> {
  const zip = await JSZip.loadAsync(file);
  const entries: { path: string; blob: Blob }[] = [];

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const blob = await entry.async('blob');
    entries.push({ path, blob });
  }
  return entries;
}

/** Compresses a set of named files/notes into a single downloadable .zip Blob. */
export async function compressToZip(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const zip = new JSZip();
  for (const { name, blob } of files) {
    zip.file(name, blob);
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

// ---------------------------------------------------------------------------
// Documents: DOCX -> HTML (read), Markdown <-> HTML
// ---------------------------------------------------------------------------

/** Extracts a .docx file's content as HTML (styles/images preserved where possible). */
export async function docxToHtml(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buffer });
  return html;
}

/** Converts Markdown text to HTML, e.g. for pasting a note into the rich-text editor. */
export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false }) as string;
}

/** Converts editor HTML back to Markdown, e.g. for exporting a note as a .md file. */
export function htmlToMarkdown(html: string): string {
  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  return turndown.turndown(html);
}

// ---------------------------------------------------------------------------
// Spreadsheets: XLSX <-> CSV / JSON
// ---------------------------------------------------------------------------

/** Converts the first sheet of an XLSX file to CSV text. */
export async function xlsxToCsv(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_csv(firstSheet);
}

/** Converts the first sheet of an XLSX file to an array of row objects (JSON). */
export async function xlsxToJson(file: File): Promise<Record<string, unknown>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(firstSheet);
}

/** Builds a downloadable .xlsx Blob from CSV text. */
export function csvToXlsx(csvText: string): Blob {
  const workbook = XLSX.read(csvText, { type: 'string' });
  const out = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
