import { NextResponse } from 'next/server';
import { getCountsForCategoriesCached } from '@/category/cache';

/**
 * GET /api/categories
 * Returns category counts (tags, cameras, lenses, years, etc.) used
 * by the navigation sidebar. This data changes only when photos are
 * added/removed, so it's highly cacheable.
 *
 * CDN caching: EdgeOne Rule #7 can be extended or a new rule added.
 * Recommended TTL: same as /api/photos (8640000s).
 */
export async function GET() {
  try {
    // unstable_cache wraps the DB queries, so repeated GETs are cheap.
    const data = await getCountsForCategoriesCached();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=31536000',
      },
    });
  } catch (error) {
    console.error('[api/categories] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
