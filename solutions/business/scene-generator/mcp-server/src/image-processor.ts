import sharp from 'sharp';

const MAX_DIMENSION = 512;
const MAX_SIZE_BYTES = 50 * 1024; // 50KB

export interface ProcessedImage {
  data: Buffer;
  mimeType: string;
}

/**
 * Compress and resize image for Gemini API input.
 * - If already <=512px and <=50KB, returns as-is.
 * - Otherwise resizes to fit 512x512 and converts to JPEG quality 75.
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const metadata = await sharp(input).metadata();

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  const fitsSize = width <= MAX_DIMENSION && height <= MAX_DIMENSION;
  const fitsBytes = input.length <= MAX_SIZE_BYTES;

  if (fitsSize && fitsBytes) {
    // Determine mime type from metadata
    const mimeType = metadata.format ? `image/${metadata.format}` : 'image/jpeg';
    return { data: input, mimeType };
  }

  const compressed = await sharp(input)
    .resize(MAX_DIMENSION, MAX_DIMENSION, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 75 })
    .toBuffer();

  return { data: compressed, mimeType: 'image/jpeg' };
}
