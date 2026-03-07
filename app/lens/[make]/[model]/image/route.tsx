import { getPhotosCached } from '@/photo/cache';
import {
  IMAGE_OG_DIMENSION_SMALL,
  MAX_PHOTOS_TO_SHOW_PER_CATEGORY,
} from '@/image-response';
import { getIBMPlexMono } from '@/app/font';
import { ImageResponse } from 'next/og';
import { getImageResponseCacheControlHeaders } from '@/image-response/cache';
import { getUniqueLenses } from '@/photo/query';
import {
  getLensFromParams,
  LensProps,
  safelyGenerateLensStaticParams,
} from '@/lens';
import LensImageResponse from '@/lens/LensImageResponse';
import { staticallyGenerateCategoryIfConfigured } from '@/app/static';

export const generateStaticParams = staticallyGenerateCategoryIfConfigured(
  'lenses',
  'image',
  getUniqueLenses,
  safelyGenerateLensStaticParams,
);

export const dynamic = 'force-dynamic';

export async function GET(
  _: Request,
  context: LensProps,
) {
  try {
    const lens = await getLensFromParams(context.params);

    const [
      photos,
      { fontFamily, fonts },
      headers,
    ] = await Promise.all([
      getPhotosCached({
        limit: MAX_PHOTOS_TO_SHOW_PER_CATEGORY,
        lens: lens,
      })
        .catch(() => []),
      getIBMPlexMono(),
      getImageResponseCacheControlHeaders(),
    ]);

    const { width, height } = IMAGE_OG_DIMENSION_SMALL;

    // If no photos, return empty response
    if (!photos || photos.length === 0) {
      return new Response('No photos', { status: 404 });
    }

    return new ImageResponse(
      <LensImageResponse {...{
        lens,
        photos,
        width,
        height,
        fontFamily,
      }}/>,
      { width, height, fonts, headers },
    );
  } catch (error) {
    console.error('Error generating lens image:', error);
    return new Response('Image generation failed', { status: 500 });
  }
}
