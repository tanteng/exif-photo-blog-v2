import { getFileNamePartsFromStorageUrl } from '@/platforms/storage';

export const removeBase64Prefix = (base64: string) => {
  return base64.match(/^data:image\/[a-z]{3,4};base64,(.+)$/)?.[1] ?? base64;
};

export const fetchBase64ImageFromUrl = async (
  url: string,
  fetchOptions?: RequestInit,
) => {
  const { fileExtension } = getFileNamePartsFromStorageUrl(url);
  const contentType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';
  return fetch(url, fetchOptions)
    .then(async response => {
      if (response.ok) {
        const blob = await response.arrayBuffer();
        // eslint-disable-next-line max-len
        return `data:${contentType};base64,${Buffer.from(blob).toString('base64')}`;
      } else {
        return undefined;
      }
    })
    .catch(() => undefined);
};

// Server-only: download an image and re-encode it through sharp into a
// clean, baseline JPEG that satori / @vercel/og can always decode.
//
// Why: OG image generation (next/og) uses its own JPEG decoder which
// chokes on some variants (progressive, CMYK, unusual EXIF, or the
// HTML/error payloads sometimes returned by the build-time
// `/_next/image` self-request) → "TypeError: Invalid JPEG", which
// ABORTS the whole prerender/build. Normalizing with sharp removes that
// entire class of failures. Returns undefined on any error so callers
// can skip a single bad image instead of crashing.
export const fetchNormalizedBase64ImageFromUrl = async (
  url: string,
  width = 640,
  fetchOptions?: RequestInit,
): Promise<string | undefined> => {
  try {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) { return undefined; }
    const input = Buffer.from(await response.arrayBuffer());
    // Dynamic import keeps sharp (Node-only) out of any client bundle
    const { default: sharp } = await import('sharp');
    const output = await sharp(input)
      .rotate() // respect EXIF orientation
      .resize(width, undefined, { withoutEnlargement: true })
      .jpeg({ quality: 80, progressive: false, mozjpeg: false })
      .toBuffer();
    return `data:image/jpeg;base64,${output.toString('base64')}`;
  } catch {
    return undefined;
  }
};
