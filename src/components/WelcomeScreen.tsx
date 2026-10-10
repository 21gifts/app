'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { Plus } from 'lucide-react';
import { flushSync } from 'react-dom';
import { AppShellOverlay, useAppShellScroller } from '@/components/AppShell';
import type { ForumWriter } from '@/components/ForumBoard';
import { ForumLoader } from '@/components/ForumLoader';
import { LoansCard } from '@/components/LoansCard';
import { useTranslations } from '@/components/LocaleProvider';
import { useChromeBack } from '@/components/ViewHistoryRoot';
import { WalletFooterActions } from '@/components/WalletFooterActions';
import { WalletPanelView } from '@/components/WalletPanelView';
import { Card, IconButton } from '@/components/ui';
import { useWallet } from '@/hooks/useWallet';
import { useWalletPanel } from '@/hooks/useWalletPanel';
import { useWalletSend } from '@/hooks/useWalletSend';
import { FORUM_HOME_EVENT } from '@/lib/forum-feed';
import { useAuthStore } from '@/stores/auth-store';

/**
 * The welcome column: gift icon, welcome heading, the member's loan card when
 * applicable, and {@link ForumLoader} (forum list; its composer lives in the writer). Page column is `max-w-xl`
 * (`Card surface={false}`) so the AppShell frame is the only page-level
 * `rounded-3xl`. Forum heading is omitted on the board so this welcome title is
 * the only stack header.
 *
 * @param props - The forum home's writer.
 * @returns The welcome page column.
 */
function WelcomeColumn({ writer }: { writer: ForumWriter }): ReactElement {
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
      <LoansCard place="welcome" />
      <ForumLoader writer={writer} />
    </Card>
  );
}

/** Input types that take no typed text, so their focus does not move the controls aside. */
const NOT_TEXT_INPUTS = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/**
 * Whether `node` is a text field inside the page scrollport: a textarea (reaction, reply, or a
 * mention box) or a text-like input (an amount entry).
 *
 * @param port - The page scrollport.
 * @param node - The focused node, or the one the focus moves to.
 * @returns True for a text field in the page.
 */
function isPageTextField(port: HTMLElement, node: unknown): boolean {
  if (!(node instanceof HTMLElement) || !port.contains(node)) {
    return false;
  }
  return (
    node instanceof HTMLTextAreaElement ||
    (node instanceof HTMLInputElement && !NOT_TEXT_INPUTS.has(node.type))
  );
}

/**
 * Registers the top-left Back of an open wallet view or of the writer as the
 * chrome back override (the slot an ask-wizard step uses). A wallet view marks
 * it `over`, so it stays on top while a hidden ask step registers its own
 * again. The writer does not: the Ask wizard inside it registers its steps
 * later, so the arrow first steps back through them and then closes the
 * writer. It is a leaf of its own, so only it re-renders when the override
 * changes, not the forum column.
 *
 * @param props - The one Back step, and whether it is laid over the page's own steps.
 * @returns `null` (registration only).
 */
function PanelChromeBack({ onBack, over }: { onBack: () => void; over: boolean }): null {
  const { setOverride } = useChromeBack();
  const backRef = useRef(onBack);
  useLayoutEffect(() => {
    backRef.current = onBack;
  });
  useLayoutEffect(() => {
    setOverride({
      labelKey: 'nav.back',
      over,
      onClick: (): void => {
        backRef.current();
      },
    });
    return (): void => {
      setOverride(null);
    };
  }, [setOverride, over]);
  return null;
}

/**
 * The last post-login screen, the forum home: welcome after name, username,
 * and rules agreement, with the welcome column.
 *
 * A signed-in member with a configured wallet also gets the wallet's
 * **Receive** (left) and **Send** (right) in the shell footer
 * (`WalletFooterActions`, the same buttons as `/wallet`), outside the
 * scrollport, so they stay while the feed scrolls. Both are enabled also while
 * the wallet is still opening (only a step that needs the open wallet waits
 * for it). Either
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
 * A signed-in member writes in the writer, not on the page: a round **+**
 * (`forum.writerOpen`, 56 px, primary, with a shadow) floats at the bottom
 * right of the frame, 23 px above the Receive / Send buttons (and following
 * them as they slim down with the scroll), or near the frame's bottom edge
 * without them. Tapping it opens the writer under the header row (see
 * `ForumBoard`) and focuses its text field in the same tap. While the writer
 * is open the **+**, the feed and the footer are covered; the top-left arrow
 * (a chrome back override, after any Ask step inside) closes it, and so do a
 * successful post, the wordmark and the Menu's Home. Closing takes the focus
 * out of the writer first, so the keyboard closes as a focus change. The
 * arrow brings the feed back at the scroll position it had, a successful
 * post from the open writer shows the top of the feed with the new note (a
 * post whose fee completes after the writer closed changes neither the
 * scroll nor the focus), and Home leaves the scroll to the forum's own
 * scroll-to-top. Drafts stay for the next opening.
 * The **+** is hidden while a wallet view is open. An 80 px clearance
 * (`data-plus-clearance`) ends the signed-in page, so at the end of the feed
 * the last note's controls scroll clear of the **+** and of the space above
 * Receive / Send.
 *
 * While a form in the feed is open (an expanded post's reaction form, a gift
 * sheet, or a text reaction's pay slot on the page, as `ForumBoard` tells the
 * writer's `onFeedForm`), or while a text field in the page has the focus (a
 * reaction or reply text, an amount, a mention box), the **+** fades out
 * (250 ms; at once with reduced motion) and cannot be pressed, and Receive /
 * Send fold away (`WalletFooterActions` `folded`), so the form has the whole
 * height above the keyboard and the **+** never lies over its controls. Both
 * come back once the focus has left the field and no such form is open; a
 * focused field that disappears with its form counts as left.
 *
 * In a Playwright build only, a `?visual=send-…` pin opens the Send view.
 *
 * @returns The column or the open wallet view, and the footer actions.
 */
export function WelcomeScreen(): ReactElement {
  const { t } = useTranslations();
  const signedIn = useAuthStore((state) => state.session !== null && state.account !== null);
  const wallet = useWallet();
  const send = useWalletSend();
  const hasWallet = signedIn && wallet.status !== 'disabled';
  const panel = useWalletPanel({
    send: hasWallet ? send : undefined,
    openPinnedSend: hasWallet,
  });
  const shown = hasWallet ? panel.shown : 'none';
  const scroller = useAppShellScroller();
  /** True while a form in the feed is open (a reaction form, a gift sheet, a reaction's pay slot). */
  const [feedForm, setFeedForm] = useState(false);
  /** True while a text field in the page has the focus. */
  const [fieldFocused, setFieldFocused] = useState(false);
  useEffect(() => {
    if (scroller === null) {
      return;
    }
    const onFocusIn = (event: FocusEvent): void => {
      setFieldFocused(isPageTextField(scroller, event.target));
    };
    const onFocusOut = (event: FocusEvent): void => {
      setFieldFocused(isPageTextField(scroller, event.relatedTarget));
    };
    scroller.addEventListener('focusin', onFocusIn);
    scroller.addEventListener('focusout', onFocusOut);
    return () => {
      scroller.removeEventListener('focusin', onFocusIn);
      scroller.removeEventListener('focusout', onFocusOut);
    };
  }, [scroller]);
  // A focused field removed with its form or a wallet view leaves without a focusout: ask again.
  useEffect(() => {
    if (scroller !== null) {
      setFieldFocused(isPageTextField(scroller, document.activeElement));
    }
  }, [scroller, feedForm, shown]);
  const aside = feedForm || fieldFocused;
  const [writerOpen, setWriterOpen] = useState(false);
  /** Feed scroll position to show once the writer has closed, or null to leave the page as it is. */
  const feedScroll = useRef<number | null>(null);
  const openWriter = useCallback((): void => {
    feedScroll.current = scroller === null ? null : scroller.scrollTop;
    setWriterOpen(true);
  }, [scroller]);
  const closeWriter = useCallback((): void => {
    // A focus change, not a removed field, so the keyboard closes the way useAppHeight expects.
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
    setWriterOpen(false);
  }, []);
  const writerOpenRef = useRef(writerOpen);
  writerOpenRef.current = writerOpen;
  // After a successful post from the open writer the new note is at the top of the feed. A post
  // whose fee was paid after the writer closed leaves the page, and its focus, as they are.
  const closeAfterPost = useCallback((): void => {
    if (!writerOpenRef.current) {
      return;
    }
    if (feedScroll.current !== null) {
      feedScroll.current = 0;
    }
    closeWriter();
  }, [closeWriter]);
  useLayoutEffect(() => {
    const top = feedScroll.current;
    if (writerOpen || scroller === null || top === null) {
      return;
    }
    feedScroll.current = null;
    scroller.scrollTop = top;
  }, [writerOpen, scroller]);
  const writer = useMemo<ForumWriter>(
    () => ({
      open: writerOpen,
      onOpen: openWriter,
      onClose: closeAfterPost,
      onFeedForm: setFeedForm,
    }),
    [writerOpen, openWriter, closeAfterPost],
  );
  // One element per writer state, so opening or closing a wallet view does not re-render the forum.
  const column = useMemo(() => <WelcomeColumn writer={writer} />, [writer]);
  const closeRef = useRef(panel.close);
  useLayoutEffect(() => {
    closeRef.current = panel.close;
  });
  const closeWriterRef = useRef(closeWriter);
  closeWriterRef.current = closeWriter;

  useEffect(() => {
    const onForumHome = (): void => {
      // Home takes the feed to its top (ForumLoader); nothing to restore.
      feedScroll.current = null;
      closeWriterRef.current();
      closeRef.current();
    };
    window.addEventListener(FORUM_HOME_EVENT, onForumHome);
    return () => {
      window.removeEventListener(FORUM_HOME_EVENT, onForumHome);
    };
  }, []);

  return (
    <>
      {shown === 'none' ? null : <PanelChromeBack onBack={panel.stepBack} over />}
      {writerOpen ? <PanelChromeBack onBack={closeWriter} over={false} /> : null}
      {shown === 'none' ? null : (
        <WalletPanelView
          panel={shown}
          send={send}
          manualEntry={panel.manualEntry}
          onManualEntry={panel.setManualEntry}
        />
      )}
      <div className={shown === 'none' ? 'contents' : 'hidden'}>
        {column}
        {/* Room under the last note, so the feed scrolls every control out from under the +. */}
        {signedIn ? (
          <div aria-hidden="true" data-plus-clearance="" className="h-20 w-full shrink-0" />
        ) : null}
      </div>
      {hasWallet && shown === 'none' ? (
        <WalletFooterActions
          onReceive={panel.openReceive}
          onSend={panel.openSend}
          focus={panel.returnFocus}
          folded={aside}
        />
      ) : null}
      {signedIn && shown === 'none' && !writerOpen ? (
        <AppShellOverlay>
          <IconButton
            variant="primary"
            size="xl"
            aria-label={t('forum.writerOpen')}
            onClick={() => {
              // Synchronously, so the writer's field takes the focus inside this tap.
              flushSync(openWriter);
            }}
            className={`absolute right-[11px] bottom-6 z-30 shadow-lg transition-[opacity,visibility] duration-250 ease-glide motion-reduce:transition-none group-has-[[data-footer-actions]]/body:bottom-[calc(4.75rem+23px-1.75rem*var(--footer-collapse,0))] group-data-[footer-snap]/body:transition-[bottom,opacity,visibility] group-data-[footer-snap]/body:duration-320${aside ? ' pointer-events-none invisible opacity-0' : ''}`}
          >
            <Plus aria-hidden="true" className="h-6 w-6" />
          </IconButton>
        </AppShellOverlay>
      ) : null}
    </>
  );
}
