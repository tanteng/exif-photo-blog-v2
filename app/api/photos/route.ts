import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth/server';
import { getPhotos } from '@/photo/query';
import { getPhotosCached } from '@/photo/cache';
import { PhotoQueryOptions, areOptionsSensitive } from '@/db';

/**
 * JSON API for photo fetching. Supports two methods:
 *
 * GET  /api/photos?q=<URL-encoded JSON PhotoQueryOptions>
 *      Cacheable by CDN (EdgeOne). URL is the cache key.
 *
 * POST /api/photos
 *      Body: JSON-serialized PhotoQueryOptions
 *      Fallback for browsers that need JSON body (legacy).
 *
 * Returns: Photo[] as JSON
 */

function parseOptions(raw: Record<string, unknown>): PhotoQueryOptions {
  return {
    ...raw,
    takenBefore: raw.takenBefore ? new Date(raw.takenBefore as string) : undefined,
    takenAfterInclusive: raw.takenAfterInclusive
      ? new Date(raw.takenAfterInclusive as string) : undefined,
    updatedBefore: raw.updatedBefore
      ? new Date(raw.updatedBefore as string) : undefined,
  } as PhotoQueryOptions;
}

async function handleRequest(options: PhotoQueryOptions) {
  if (areOptionsSensitive(options)) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }
  }

  const photos = areOptionsSensitive(options)
    ? await getPhotos(options)
    : await getPhotosCached(options);

  // Public responses get a Cache-Control header so EdgeOne can cache them.
  // Sensitive responses (admin-only) must not be cached.
  if (!areOptionsSensitive(options)) {
    return NextResponse.json(photos, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
      },
    });
  }

  return NextResponse.json(photos);
}

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get('q');
    if (!q) {
      return NextResponse.json(
        { error: 'Missing "q" query parameter' },
        { status: 400 },
      );
    }
    const raw = JSON.parse(q);
    return handleRequest(parseOptions(raw));
  } catch (error) {
    console.error('[api/photos GET] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return handleRequest(parseOptions(body));
  } catch (error) {
    console.error('[api/photos POST] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
