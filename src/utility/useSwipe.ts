'use client';

import { useCallback, useRef } from 'react';

const SWIPE_THRESHOLD = 50; // 最小滑动距离（px）
const SWIPE_MAX_VERTICAL = 100; // 垂直方向最大偏移，超过则不算水平滑动
const SWIPE_MAX_TIME = 500; // 最长滑动时间（ms）

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export default function useSwipe({ onSwipeLeft, onSwipeRight }: SwipeHandlers) {
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchStartTime = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    touchStartTime.current = Date.now();
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;
    const elapsed = Date.now() - touchStartTime.current;

    // 超时不处理
    if (elapsed > SWIPE_MAX_TIME) return;
    // 垂直偏移太大，属于纵向滚动
    if (Math.abs(deltaY) > SWIPE_MAX_VERTICAL) return;
    // 水平距离不够
    if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;

    if (deltaX < 0) {
      // 向左滑 → 下一张
      onSwipeLeft?.();
    } else {
      // 向右滑 → 上一张
      onSwipeRight?.();
    }
  }, [onSwipeLeft, onSwipeRight]);

  return { onTouchStart, onTouchEnd };
}
