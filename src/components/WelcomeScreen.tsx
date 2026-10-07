'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, type ReactElement } from 'react';
import { ForumLoader } from '@/components/ForumLoader';
import { useTranslations } from '@/components/LocaleProvider';
import { useChromeBack } from '@/components/ViewHistoryRoot';
import { WalletFooterActions } from '@/components/WalletFooterActions';
import { WalletPanelView } from '@/components/WalletPanelView';
import { Card } from '@/components/ui';
import { useWallet } from '@/hooks/useWallet';
import { useWalletPanel } from '@/hooks/useWalletPanel';
import { useWalletSend } from '@/hooks/useWalletSend';
import { FORUM_HOME_EVENT } from '@/lib/forum-feed';
import { useAuthStore } from '@/stores/auth-store';

/**
 * The welcome column: gift icon, welcome heading, and {@link ForumLoader}
 * (forum list + composer). Page column is `max-w-xl` (`Card surface={false}`)
 * so the AppShell frame is the only page-level `rounded-3xl`. Forum heading is
 * omitted on the board so this welcome title is the only stack header.
 *
 * @returns The welcome page column.
 */
function WelcomeColumn(): ReactElement {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const storedName = useAuthStore((state) => state.account?.name);
  const name = storedName === null || storedName === undefined ? '' : storedName.trim();

  return (
    <Card maxWidth="xl" surface={false}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 64 64"
        aria-hidden="true"
        className="h-12 w-12 text-app-fg"
      >
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 32v24a2 2 0 0 0 2 2h36a2 2 0 0 0 2-2V32" />
          <rect x="8" y="23" width="48" height="9" rx="2" />
          <path d="M32 23C29 12 25 7 20 9c-8 3-4 14 12 14ZM32 23c3-11 7-16 12-14 8 3 4 14-12 14ZM32 23v9" />
          <g transform="translate(20 33)">
            <path d="M11.767 19.089c4.924.868 6.14-6.025 1.216-6.894m-1.216 6.894L5.86 18.047m5.908 1.042-.347 1.97m1.563-8.864c4.924.869 6.14-6.025 1.215-6.893m-1.215 6.893-3.94-.694m5.155-6.2L8.29 4.26m5.908 1.042.348-1.97M7.48 20.364l3.126-17.727" />
          </g>
        </g>
      </svg>
      <h1 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
        {session !== null && name !== ''
          ? t('login.welcomeHeading', { name })
          : t('login.welcomeSignedOut')}
      </h1>
      <ForumLoader />
    </Card>
  );
}

/**
 * Registers the top-left Back of an open wallet view as the chrome back
 * override (the slot an ask-wizard step uses). It is a leaf of its own, so
 * only it re-renders when the override changes, not the forum column.
 *
 * @param props - The view's one Back step.
 * @returns `null` (registration only).
 */
function PanelChromeBack({ onBack }: { onBack: () => void }): null {
  const { setOverride } = useChromeBack();
  const backRef = useRef(onBack);
  useLayoutEffect(() => {
    backRef.current = onBack;
  });
  useLayoutEffect(() => {
    setOverride({
      labelKey: 'nav.back',
      onClick: (): void => {
        backRef.current();
      },
    });
    return (): void => {
      setOverride(null);
    };
  }, [setOverride]);
  return null;
}

/**
 * The last post-login screen, the forum home: welcome after name, username,
 * and rules agreement, with the welcome column.
 *
 * A signed-in member with a configured wallet also gets the wallet's
 * **Receive** (left) and **Send** (right) in the shell footer
 * (`WalletFooterActions`, the same buttons as `/wallet`), outside the
 * scrollport, so they stay while the feed scrolls. Send is enabled while the
 * wallet is ready or locked (locked: the existing unlock runs first). Either
 * opens a full-screen view over `/welcome` (in-page state from
 * `useWalletPanel`, not a route): the column stays mounted but hidden, the
 * footer buttons hide, and the feed's scroll position comes back on close.
 * The open view registers the top-left Back as a chrome back override (the
 * slot an ask-wizard step uses): in Send it first closes the manual-entry
 * sheet or an open send step (or is held while a send is in flight), then
 * returns to the feed. The Send view stays while a send is in flight, its
 * Sent line shows, or a send alert is up, and Done returns to the feed. The
 * wordmark and the Menu's Home (the forum home event) close the view and
 * return to the top of the feed. Signed-out visitors and members without a
 * configured wallet see the column alone.
 *
 * In a Playwright build only, a `?visual=send-…` pin opens the Send view.
 *
 * @returns The column or the open wallet view, and the footer actions.
 */
export function WelcomeScreen(): ReactElement {
  const signedIn = useAuthStore((state) => state.session !== null && state.account !== null);
  const wallet = useWallet();
  const send = useWalletSend();
  const hasWallet = signedIn && wallet.status !== 'disabled';
  const panel = useWalletPanel({
    send: hasWallet ? send : undefined,
    wallet: hasWallet ? wallet : undefined,
    openPinnedSend: hasWallet,
  });
  const shown = hasWallet ? panel.shown : 'none';
  // One element for the column, so opening or closing a view does not re-render the forum.
  const column = useMemo(() => <WelcomeColumn />, []);
  const closeRef = useRef(panel.close);
  useLayoutEffect(() => {
    closeRef.current = panel.close;
  });

  useEffect(() => {
    const onForumHome = (): void => {
      closeRef.current();
    };
    window.addEventListener(FORUM_HOME_EVENT, onForumHome);
    return () => {
      window.removeEventListener(FORUM_HOME_EVENT, onForumHome);
    };
  }, []);

  return (
    <>
      {shown === 'none' ? null : <PanelChromeBack onBack={panel.stepBack} />}
      {shown === 'none' ? null : (
        <WalletPanelView
          panel={shown}
          send={send}
          walletReady={wallet.status === 'ready'}
          manualEntry={panel.manualEntry}
          onManualEntry={panel.setManualEntry}
        />
      )}
      <div className={shown === 'none' ? 'contents' : 'hidden'}>{column}</div>
      {hasWallet && shown === 'none' ? (
        <WalletFooterActions
          onReceive={panel.openReceive}
          onSend={panel.openSend}
          sendDisabled={panel.sendDisabled}
          focus={panel.returnFocus}
        />
      ) : null}
    </>
  );
}
