'use client';

import { ReactNode, useCallback } from 'react';
import { Photo, getNextPhoto, getPreviousPhoto } from '@/photo';
import { PhotoSetCategory } from '@/category';
import { pathForPhoto } from '@/app/path';
import { useAppState } from '@/app/AppState';
import { AnimationConfig } from '@/components/AnimateItems';
import { useRouter } from 'next/navigation';
import useSwipe from '@/utility/useSwipe';

const ANIMATION_LEFT: AnimationConfig = { type: 'left', duration: 0.3 };
const ANIMATION_RIGHT: AnimationConfig = { type: 'right', duration: 0.3 };

export default function PhotoSwipeNavigator({
  photo,
  photos,
  children,
  ...categories
}: {
  photo: Photo;
  photos: Photo[];
  children: ReactNode;
} & PhotoSetCategory) {
  const router = useRouter();
  const { setNextPhotoAnimation } = useAppState();

  const previousPhoto = getPreviousPhoto(photo, photos);
  const nextPhoto = getNextPhoto(photo, photos);

  const onSwipeLeft = useCallback(() => {
    if (nextPhoto) {
      setNextPhotoAnimation?.(ANIMATION_LEFT);
      router.push(pathForPhoto({ photo: nextPhoto, ...categories }));
    }
  }, [nextPhoto, setNextPhotoAnimation, router, categories]);

  const onSwipeRight = useCallback(() => {
    if (previousPhoto) {
      setNextPhotoAnimation?.(ANIMATION_RIGHT);
      router.push(pathForPhoto({ photo: previousPhoto, ...categories }));
    }
  }, [previousPhoto, setNextPhotoAnimation, router, categories]);

  const { onTouchStart, onTouchEnd } = useSwipe({
    onSwipeLeft,
    onSwipeRight,
  });

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </div>
  );
}
