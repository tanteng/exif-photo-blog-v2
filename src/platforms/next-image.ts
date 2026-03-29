import {
  BASE_URL,
  IMAGE_QUALITY,
  VERCEL_BYPASS_KEY,
  VERCEL_BYPASS_SECRET,
} from '@/app/config';

const COS_CUSTOM_DOMAIN =
  process.env.NEXT_PUBLIC_TENCENT_COS_CUSTOM_DOMAIN || '';

// Explicity defined next.config.js `imageSizes`
type NextCustomSize = 200;

type NextImageDeviceSize = 640 | 750 | 828 | 1080 | 1200 | 1920 | 2048 | 3840;

export type NextImageSize = NextCustomSize | NextImageDeviceSize;

export const MAX_IMAGE_SIZE: NextImageSize = 3840;

export const getNextImageUrlForRequest = ({
  imageUrl,
  size,
  quality = IMAGE_QUALITY,
  baseUrl = BASE_URL,
  addBypassSecret,
}: {
  imageUrl: string
  size: NextImageSize
  quality?: number
  baseUrl?: string
  addBypassSecret?: boolean
}) => {
  // For COS images, use Tencent CI for image processing
  // This avoids hitting /_next/image and consuming server CPU
  if (COS_CUSTOM_DOMAIN && imageUrl.includes(COS_CUSTOM_DOMAIN)) {
    return `${imageUrl}?imageMogr2/thumbnail/${size}x/format/webp/quality/${quality}/interlace/1`;
  }

  // Fall back to Next.js image optimization for non-COS images
  const url = new URL(`${baseUrl}/_next/image`);

  url.searchParams.append('url', imageUrl);
  url.searchParams.append('w', size.toString());
  url.searchParams.append('q', quality.toString());

  if (addBypassSecret && VERCEL_BYPASS_SECRET) {
    url.searchParams.append(VERCEL_BYPASS_KEY, VERCEL_BYPASS_SECRET);
  }

  return url.toString();
};
