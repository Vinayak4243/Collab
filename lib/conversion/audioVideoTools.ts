/**
 * Audio/video conversion using ffmpeg.wasm — runs fully client-side for
 * short clips. ffmpeg.wasm is a real, single-threaded FFmpeg build compiled
 * to WebAssembly, loaded lazily so it never bloats the initial bundle.
 *
 * For long-form audio/video (multi-minute files) or GPU-accelerated
 * transcoding, route through the serverless API instead — see
 * app/api/convert/transcribe/route.ts for the pattern.
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpeg(onProgress?: (ratio: number) => void): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;

  const ffmpeg = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';

  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => onProgress(progress));
  }

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

/** Converts an audio file between common formats (mp3, wav, ogg, m4a). */
export async function convertAudio(
  file: File,
  targetFormat: 'mp3' | 'wav' | 'ogg',
  onProgress?: (ratio: number) => void
): Promise<Blob> {
  const ffmpeg = await getFFmpeg(onProgress);
  const inputName = `input.${file.name.split('.').pop()}`;
  const outputName = `output.${targetFormat}`;

  await ffmpeg.writeFile(inputName, await fetchFile(file));
  await ffmpeg.exec(['-i', inputName, outputName]);
  const data = await ffmpeg.readFile(outputName);

  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  return new Blob([data], { type: `audio/${targetFormat}` });
}

/** Extracts the audio track from a video file as MP3. */
export async function extractAudioFromVideo(
  file: File,
  onProgress?: (ratio: number) => void
): Promise<Blob> {
  const ffmpeg = await getFFmpeg(onProgress);
  const inputName = `input.${file.name.split('.').pop()}`;

  await ffmpeg.writeFile(inputName, await fetchFile(file));
  await ffmpeg.exec(['-i', inputName, '-vn', '-acodec', 'libmp3lame', 'output.mp3']);
  const data = await ffmpeg.readFile('output.mp3');

  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile('output.mp3');

  return new Blob([data], { type: 'audio/mp3' });
}

/** Converts a short MP4 clip to an animated GIF. */
export async function videoToGif(
  file: File,
  options: { fps?: number; widthPx?: number } = {},
  onProgress?: (ratio: number) => void
): Promise<Blob> {
  const { fps = 10, widthPx = 480 } = options;
  const ffmpeg = await getFFmpeg(onProgress);
  const inputName = `input.${file.name.split('.').pop()}`;

  await ffmpeg.writeFile(inputName, await fetchFile(file));
  await ffmpeg.exec([
    '-i',
    inputName,
    '-vf',
    `fps=${fps},scale=${widthPx}:-1:flags=lanczos`,
    '-loop',
    '0',
    'output.gif',
  ]);
  const data = await ffmpeg.readFile('output.gif');

  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile('output.gif');

  return new Blob([data], { type: 'image/gif' });
}

/**
 * Sends an audio/video file to the serverless transcription endpoint.
 * Speech-to-text itself is not feasible in-browser at usable accuracy, so
 * this is the one conversion type in this module that leaves the client —
 * see app/api/convert/transcribe/route.ts.
 */
export async function transcribeMedia(file: File): Promise<{ text: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/convert/transcribe', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Transcription failed: ${response.statusText}`);
  }
  return response.json();
}
