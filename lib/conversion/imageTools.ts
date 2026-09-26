/**
 * Client-side image format conversion. All conversions run in-browser via
 * <canvas> — nothing uploaded to a server for these lightweight formats.
 */
import heic2any from 'heic2any';

export type RasterFormat = 'png' | 'jpeg' | 'webp';

/** Converts an Apple HEIC/HEIF photo to a standard JPEG/PNG Blob. */
export async function heicToRaster(file: File, format: RasterFormat = 'jpeg'): Promise<Blob> {
  const result = await heic2any({
    blob: file,
    toType: `image/${format}`,
    quality: 0.9,
  });
  // heic2any can return an array for multi-image HEIC containers (e.g. Live Photos)
  return Array.isArray(result) ? result[0] : result;
}

/** Rasterizes an SVG file to PNG/JPEG/WEBP at a given output width. */
export async function svgToRaster(
  file: File,
  format: RasterFormat = 'png',
  width = 1024
): Promise<Blob> {
  const svgText = await file.text();
  const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await loadImage(url);
    const aspect = img.height / img.width || 1;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = Math.round(width * aspect);
    const ctx = canvas.getContext('2d')!;
    // Fill white behind transparent SVGs so JPEG export doesn't turn black
    if (format === 'jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), `image/${format}`, 0.95)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Wraps a rasterized SVG (or any image) into a single-page PDF — thin wrapper around pdfTools. */
export async function svgToPdf(file: File): Promise<Blob> {
  const { imagesToPdf } = await import('./pdfTools');
  const pngBlob = await svgToRaster(file, 'png', 1600);
  const pngFile = new File([pngBlob], 'rendered.png', { type: 'image/png' });
  return imagesToPdf([pngFile]);
}

/** Generic raster-to-raster re-encode (e.g. PNG -> WEBP, JPEG -> PNG) via canvas. */
export async function convertRasterFormat(file: File, format: RasterFormat): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), `image/${format}`, 0.92)
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
