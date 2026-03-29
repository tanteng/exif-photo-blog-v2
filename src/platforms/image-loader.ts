// Custom image loader for Next.js
// When the image is from Tencent COS (assets.tanteng.space),
// use CI (Cloud Infinite / 数据万象) URL parameters for image processing.
// This offloads image optimization from the server CPU to Tencent Cloud.

const COS_CUSTOM_DOMAIN =
  process.env.NEXT_PUBLIC_TENCENT_COS_CUSTOM_DOMAIN || '';

interface ImageLoaderParams {
  src: string
  width: number
  quality?: number
}

export default function imageLoader({
  src,
  width,
  quality,
}: ImageLoaderParams): string {
  const q = quality || 75;

  // If the image is from our COS domain, use CI for image processing
  if (COS_CUSTOM_DOMAIN && src.includes(COS_CUSTOM_DOMAIN)) {
    // Tencent CI imageMogr2 API:
    // - thumbnail/<width>x : scale to width, auto height
    // - format/webp : convert to webp
    // - quality/<q> : set quality
    // - interlace/1 : progressive loading
    return `${src}?imageMogr2/thumbnail/${width}x/format/webp/quality/${q}/interlace/1`;
  }

  // For non-COS images (e.g. QR codes), fall back to the default
  // Next.js image optimization endpoint
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${q}`;
}
