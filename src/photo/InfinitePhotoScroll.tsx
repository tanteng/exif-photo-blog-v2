'use client';

import useSwrInfinite from 'swr/infinite';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppGrid from '@/components/AppGrid';
import Spinner from '@/components/Spinner';
import { Photo } from '.';
import { PhotoSetCategory } from '../category';
import { clsx } from 'clsx/lite';
import { useAppState } from '@/app/AppState';
import useVisibility from '@/utility/useVisibility';
import { SortBy } from './sort';
import { SWR_KEYS } from '@/swr';
import { useAppText } from '@/i18n/state/client';

const SIZE_KEY_SEPARATOR = '__';
const getSizeFromKey = (key: string) =>
  parseInt(key.split(SIZE_KEY_SEPARATOR)[1]);

// If a page is loading for longer than this, surface a clickable
// button instead of an endless spinner so the user can manually retry.
const STALL_TIMEOUT_MS = 8_000;

export type RevalidatePhoto = (
  photoId: string,
  revalidateRemainingPhotos?: boolean,
) => Promise<any>;

export default function InfinitePhotoScroll({
  cacheKey,
  initialOffset,
  itemsPerPage,
  sortBy,
  sortWithPriority,
  excludeFromFeeds,
  recent,
  year,
  camera,
  lens,
  tag,
  recipe,
  film,
  focal,
  moreButtonClassName = 'mt-4',
  wrapMoreButtonInGrid,
  useCachedPhotos = true,
  includeHiddenPhotos,
  children,
}: {
  initialOffset: number
  itemsPerPage: number
  sortBy?: SortBy
  sortWithPriority?: boolean
  excludeFromFeeds?: boolean
  cacheKey: string
  moreButtonClassName?: string
  wrapMoreButtonInGrid?: boolean
  useCachedPhotos?: boolean
  includeHiddenPhotos?: boolean
  children: (props: {
    key: string
    photos: Photo[]
    onLastPhotoVisible?: () => void
    revalidatePhoto?: RevalidatePhoto
  }) => ReactNode
} & PhotoSetCategory) {
  const { isUserSignedIn } = useAppState();
  
  const { utility } = useAppText();

  useEffect(() => {
    console.log('[SA] mount', {
      cacheKey,
      initialOffset,
      ua: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Always use the JSON API (GET /api/photos) for pagination.
  // GET requests use the URL as cache key, enabling EdgeOne CDN caching.
  // (Previously Server Actions (POST RSC) were used, but their responses
  // cannot be cached by CDNs since POST bodies aren't part of the cache key.)

  const keyGenerator = useCallback(
    (size: number, prev: Photo[]) => prev && prev.length === 0
      ? null
      // eslint-disable-next-line max-len
      : `${SWR_KEYS.INFINITE_PHOTO_SCROLL}-${cacheKey}${SIZE_KEY_SEPARATOR}${size}`
    , [cacheKey]);

  // Fetch paginated photos via the JSON API (GET /api/photos?q=...).
  // GET requests are cacheable by EdgeOne CDN, reducing origin load.
  const jsonFetcher = useCallback(async (
    keyWithSize: string,
    warmOnly?: boolean,
  ) => {
    if (warmOnly) return [];

    const options = {
      offset: initialOffset + getSizeFromKey(keyWithSize) * itemsPerPage,
      sortBy,
      sortWithPriority,
      excludeFromFeeds,
      limit: itemsPerPage,
      hidden: includeHiddenPhotos ? 'include' : 'exclude',
      recent,
      year,
      camera,
      lens,
      tag,
      recipe,
      film,
      focal,
    };

    console.log('[JSON] fetcher called', {
      keyWithSize,
      cacheKey,
      offset: options.offset,
    });

    // Use GET with query param so CDN (EdgeOne) can cache the response.
    // The JSON payload is URL-encoded and passed as ?q=, which makes
    // every unique request a unique URL = unique cache key.
    const q = encodeURIComponent(JSON.stringify(options));
    const res = await fetch(`/api/photos?q=${q}`);

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[JSON] fetcher FAILED', {
        keyWithSize,
        status: res.status,
        errorText,
      });
      throw new Error(errorText || `HTTP ${res.status}`);
    }

    const data = await res.json();
    console.log('[JSON] fetcher OK', {
      keyWithSize,
      count: data?.length,
    });
    return data;
  }, [
    sortBy,
    sortWithPriority,
    excludeFromFeeds,
    initialOffset,
    itemsPerPage,
    includeHiddenPhotos,
    recent,
    year,
    camera,
    lens,
    tag,
    recipe,
    film,
    focal,
  ]);

  const fetcher = jsonFetcher;

  const { data, isLoading, isValidating, error, mutate, setSize } =
    useSwrInfinite<Photo[]>(
      keyGenerator,
      fetcher,
      {
        initialSize: 1,
        revalidateFirstPage: false,
        revalidateOnFocus: Boolean(isUserSignedIn),
        revalidateOnReconnect: Boolean(isUserSignedIn),
      },
    );

  const [stallFallback, setStallFallback] = useState(false);

  const buttonContainerRef = useRef<HTMLDivElement>(null);

  const isLoadingOrValidating = isLoading || isValidating;

  const isFinished = useMemo(() =>
    data && data[data.length - 1]?.length < itemsPerPage
  , [data, itemsPerPage]);

  // If loading persists beyond STALL_TIMEOUT_MS, switch the spinner to a
  // clickable button so users can manually retry instead of an endless
  // spinner (e.g. when a fetch is silently hanging on iOS QQ Browser).
  useEffect(() => {
    if (!isLoadingOrValidating) {
      setStallFallback(false);
      return;
    }
    const timer = setTimeout(() => {
      console.warn('[SA] stall detected', {
        cacheKey,
        isLoading,
        isValidating,
        dataLen: data?.length ?? 0,
      });
      setStallFallback(true);
    }, STALL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [cacheKey, isLoadingOrValidating, isLoading, isValidating, data]);

  if (typeof window !== 'undefined') {
    console.log('[SA] render', {
      cacheKey,
      isFinished,
      isLoadingOrValidating,
      hasError: Boolean(error),
      stallFallback,
      dataLen: data?.length ?? 0,
    });
  }

  const advance = useCallback(() => {
    // On error, do NOT auto-advance (e.g. from useVisibility). Otherwise a
    // failed page fetch — such as a stale CDN server-action id returning 404 —
    // keeps calling setSize, triggering another failing POST, looping forever.
    // The user must explicitly click "try again" to retry.
    if (error) return;
    if (!isFinished && !isLoadingOrValidating) {
      setSize((data?.length ?? 0) + 1);
    }
  }, [error, isFinished, isLoadingOrValidating, setSize, data]);

  const revalidatePhoto: RevalidatePhoto = useCallback((
    photoId: string,
    revalidateRemainingPhotos?: boolean,
  ) => mutate(data, {
    revalidate: (_data: Photo[], [_, size]:[string, number]) => {
      const i = (data ?? []).findIndex(photos =>
        photos.some(photo => photo.id === photoId));
      return revalidateRemainingPhotos ? size >= i : size === i;
    },
  } as any), [data, mutate]);

  useVisibility({ ref: buttonContainerRef, onVisible: advance });

  const renderMoreButton =
    <div ref={buttonContainerRef}>
      <button
        type="button"
        onClick={() => (error || stallFallback) ? mutate() : advance()}
        disabled={isLoadingOrValidating && !stallFallback}
        className={clsx(
          'w-full flex justify-center',
          isLoadingOrValidating && !stallFallback && 'subtle',
        )}
      >
        {error
          ? utility.tryAgain
          : stallFallback
            ? utility.loadMore
            : isLoadingOrValidating
              ? <Spinner size={20} />
              : utility.loadMore}
      </button>
    </div>;

  return (
    <>
      {data?.map((photos, index) => (
        children({
          key: `${cacheKey}-${index}`,
          photos, 
          onLastPhotoVisible: index === data.length - 1
            ? advance
            : undefined,
          revalidatePhoto,
        })
      ))}
      {!isFinished && <div className={moreButtonClassName}>
        {wrapMoreButtonInGrid
          ? <AppGrid contentMain={renderMoreButton} />
          : renderMoreButton}
      </div>}
    </>
  );
}
