'use client';

import { clsx } from 'clsx/lite';
import AppGrid from '../components/AppGrid';
import ThemeSwitcher from '@/app/ThemeSwitcher';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PATH_ADMIN_PHOTOS, isPathSignIn } from './path';
import SubmitButtonWithStatus from '@/components/SubmitButtonWithStatus';
import { signOutAction } from '@/auth/actions';
import AnimateItems from '@/components/AnimateItems';
import { useAppState } from '@/app/AppState';
import Spinner from '@/components/Spinner';
import { useAppText } from '@/i18n/state/client';

export default function Footer() {
  const pathname = usePathname();

  const {
    userEmail,
    userEmailEager,
    isCheckingAuth,
    clearAuthStateAndRedirectIfNecessary,
  } = useAppState();

  const appText = useAppText();

  const showFooter = !isPathSignIn(pathname);

  return (
    <AppGrid
      contentMain={
        <AnimateItems
          type="none"
          items={showFooter
            ? [<div
              key="footer"
              className={clsx(
                'flex items-center gap-1',
                'text-dim min-h-10',
              )}>
              <div className={clsx(
                'flex gap-x-3 xs:gap-x-4 grow flex-wrap',
                'w-full min-w-0',
              )}>
                {userEmail || userEmailEager
                  ? <>
                    <Link
                      href={PATH_ADMIN_PHOTOS}
                      className="truncate max-w-full max-sm:hidden"
                      prefetch={false}
                    >
                      {userEmail || userEmailEager}
                    </Link>
                    <form action={() => signOutAction()
                      .then(clearAuthStateAndRedirectIfNecessary)}>
                      <SubmitButtonWithStatus styleAs="link">
                        {appText.auth.signOut}
                      </SubmitButtonWithStatus>
                    </form>
                  </>
                  : isCheckingAuth
                  ? <Spinner size={16} className="translate-y-[2px]" />
                  : null}
                </div>
              <div className="flex items-center h-10 shrink-0">
                <ThemeSwitcher />
              </div>
            </div>]
            : []}
        />}
    />
  );
}
