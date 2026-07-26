'use client';

import { Photo } from '.';
import {
  getNextImageUrlForRequest,
  NextImageSize,
} from '@/platforms/next-image';

// Match next/image srcset sizes (imageSizes + deviceSizes).
// next.config.ts defines imageSizes: [200]; default deviceSizes
// are [640, 750, 828, 1080, 1200, 1920, 2048, 3840].
const PRELOAD_SIZES: NextImageSize[] = [
  200, 640, 750, 828, 1080, 1200, 1920, 2048, 3840,
];

// Typical grid layout: 4 cols @ >=1280px (25vw), 3 cols @ >=1024px
// (33vw), 2 cols @ >=640px (50vw), 1 col otherwise.
const PRELOAD_IMAGESIZES =
  '(min-width: 1280px) 25vw,' +
  ' (min-width: 1024px) 33vw,' +
  ' (min-width: 640px) 50vw,' +
  ' 100vw';

const PHOTO_PRELOAD_LIMIT = 4;

const buildPhotoSrcSet = (photoUrl: string) =>
  PRELOAD_SIZES
    .map(size =>
      `${getNextImageUrlForRequest({ imageUrl: photoUrl, size })} ${size}w`,
    )
    .join(', ');

export default function PhotoPreloadLinks({ photos }: { photos: Photo[] }) {
  const topPhotos = photos.slice(0, PHOTO_PRELOAD_LIMIT);
  return (
    <>
      {topPhotos.map(photo => {
        const srcset = buildPhotoSrcSet(photo.url);
        return (
          <link
            key={photo.id}
            rel="preload"
            as="image"
            imageSrcSet={srcset}
            imageSizes={PRELOAD_IMAGESIZES}
            fetchPriority="high"
          />
        );
      })}
    </>
  );
}