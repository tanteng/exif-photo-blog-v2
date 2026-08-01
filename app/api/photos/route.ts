import { NextResponse } from 'next/server';
import { auth } from '@/auth/server';
import { getPhotos } from '@/photo/query';
import { getPhotosCached } from '@/photo/cache';
import { PhotoQueryOptions, areOptionsSensitive } from '@/db';

/**
 * JSON API fallback for browsers that lack ReadableStream support
 * (e.g. iOS QQ Browser). Returns photos as plain JSON instead of
 * the RSC streaming format used by Server Actions.
 *
 * POST /api/photos
 * Body: JSON-serialized PhotoQueryOptions
 * Returns: Photo[] as JSON
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Convert date strings back to Date objects
    const options: PhotoQueryOptions = {
      ...body,
      takenBefore: body.takenBefore ? new Date(body.takenBefore) : undefined,
      takenAfterInclusive: body.takenAfterInclusive
        ? new Date(body.takenAfterInclusive) : undefined,
      updatedBefore: body.updatedBefore
        ? new Date(body.updatedBefore) : undefined,
    };

    if (areOptionsSensitive(options)) {
      const session = await auth();
      if (!session?.user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 },
        );
      }
    }

    // Use the cached version for public queries to benefit from
    // Next.js unstable_cache and avoid redundant DB queries.
    const photos = areOptionsSensitive(options)
      ? await getPhotos(options)
      : await getPhotosCached(options);

    return NextResponse.json(photos);
  } catch (error) {
    console.error('[api/photos] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
