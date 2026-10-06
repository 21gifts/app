'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, type ReactElement, type ReactNode } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import { useWalletSetup } from '@/hooks/useWalletSetup';
import { disablePush } from '@/lib/push';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Blocking one-time wallet setup, in the style of the passkey renew dialog.
 * Intro with **Set up wallet**, a progress line, an error with **Try again**,
 * or the message that this passkey cannot hold a wallet. No dismiss control;
 * **Log out** is the only way around it.
 *
 * Mount only when `needsWalletSetup` holds (or a screenshot pin is set).
 *
 * @returns The setup dialog.
 */
export function WalletSetupNotice(): ReactElement {
  const { t } = useTranslations();
  const router = useRouter();
  const { view, start, retry } = useWalletSetup();
  const leavingRef = useRef(false);

  const logOut = (): void => {
    if (leavingRef.current) {
      return;
    }
    leavingRef.current = true;
    void (async () => {
      const token = useAuthStore.getState().session;
      if (token !== null) {
        await Promise.race([
          disablePush(token).catch(() => undefined),
          new Promise<void>((resolve) => {
            window.setTimeout(resolve, 5000);
          }),
        ]);
      }
      useAuthStore.getState().clearAuth();
      router.replace('/login');
    })();
  };

  const titleId = `wallet-setup-${view}`;
  const title = view === 'noPrf' ? t('walletSetup.noPrfTitle') : t('walletSetup.title');
  let body: ReactNode;
  let action: ReactNode;
  if (view === 'progress') {
    body = (
      <p role="status" className="w-full text-sm text-app-muted">
        {t('walletSetup.progress')}
      </p>
    );
    action = (
      <div className="flex min-h-11 w-full items-center justify-center">
        <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-app-muted" />
      </div>
    );
  } else if (view === 'error') {
    body = (
      <p role="alert" className="w-full text-sm text-app-danger">
        {t('walletSetup.error')}
      </p>
    );
    action = (
      <Button type="button" size="lg" onClick={retry}>
        {t('login.retry')}
      </Button>
    );
  } else if (view === 'noPrf') {
    body = (
      <p role="alert" className="w-full text-sm text-app-muted">
        {t('wallet.prfUnsupported')}
      </p>
    );
    action = null;
  } else {
    body = <p className="w-full text-sm text-app-muted">{t('walletSetup.intro')}</p>;
    action = (
      <Button type="button" size="lg" variant="primary" onClick={start}>
        {t('walletSetup.start')}
      </Button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay p-4"
    >
      <Card maxWidth="sm">
        <h2 id={titleId} className="w-full text-lg font-semibold tracking-tight text-app-fg">
          {title}
        </h2>
        {body}
        {action}
        <Button type="button" variant="secondary" onClick={logOut}>
          {t('login.logOut')}
        </Button>
      </Card>
    </div>
  );
}
