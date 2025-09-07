'use client';

import { clsx } from 'clsx/lite';
import AppGrid from '../components/AppGrid';
import ThemeSwitcher from '@/app/ThemeSwitcher';
import Link from 'next/link';
import { SHOW_REPO_LINK } from '@/app/config';
import RepoLink from '../components/RepoLink';
import { usePathname } from 'next/navigation';
import { PATH_ADMIN_PHOTOS, isPathAdmin, isPathSignIn } from './path';
import AnimateItems from '@/components/AnimateItems';
import { useAppState } from '@/app/AppState';
import { useAppText } from '@/i18n/state/client';

export default function Footer() {
  const pathname = usePathname();

  const appText = useAppText();

  const showFooter = !isPathSignIn(pathname);

  const shouldAnimate = !isPathAdmin(pathname);

  return (
    <AppGrid
      contentMain={
        <AnimateItems
          animateOnFirstLoadOnly
          type={!shouldAnimate ? 'none' : 'bottom'}
          distanceOffset={10}
          items={showFooter
            ? [<div
              key="footer"
              className={clsx(
                'flex items-center gap-1',
                'text-dim min-h-10',
              )}>
              <div className="flex gap-x-3 xs:gap-x-4 grow flex-wrap">
              </div>
              <div className="flex items-center h-10">
                <ThemeSwitcher />
              </div>
            </div>]
            : []}
        />}
    />
  );
}
