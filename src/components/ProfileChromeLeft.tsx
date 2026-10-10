'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useLayoutEffect, useState, type ReactElement, type ReactNode } from 'react';
import { useChromeBack } from '@/components/ViewHistoryRoot';
import { useTranslations } from '@/components/LocaleProvider';
import { Wordmark } from '@/components/ui';
import { takeStepBack, markBackNavigation, previousViewPath } from '@/lib/view-history';

const BACK_CLASS = 'inline-flex h-11 w-11 items-center justify-center rounded-full transition';

/** Props for {@link ProfileChromeLeft}. */
export interface ProfileChromeLeftProps {
  /**
   * Unmodified primary click, before the link leaves. Return `true` when it
   * took an in-page step: the link then does not follow its href. Return
   * `false` to let the arrow leave for the previous view. Modified clicks
   * always follow the href. Wallet uses this for one in-page step: hide the
   * words, close a send step, or return from Send or Receive to the wallet
   * home.
   */
  onBackClick?: () => boolean;
  /** Wordmark destination. Default `/welcome`. Ignored when `wordmark` is set. */
  wordmarkHref?: string;
  /** Replaces the default wordmark. The wordmark is not the back control. */
  wordmark?: ReactNode;
  /** App shell or the ink marketing header. Default `app`. */
  tone?: 'app' | 'dark';
  /**
   * Omit the history arrow whatever this tab's view stack holds. `/welcome`
   * uses this: the forum home has no back arrow. An ask or shop wizard
   * override still shows.
   */
  hideHistoryArrow?: boolean;
}

/**
 * Shared top-left chrome: one icon-only back plus wordmark.
 *
 * Back is a link to the previous in-app view, or `/welcome` when this tab has
 * none. When this document pushed the current entry on top of that view
 * ({@link takeStepBack}), a plain click takes the root's `stepBack` (`router.back()`), the
 * same step as the browser's own back. Otherwise it marks that path with
 * {@link markBackNavigation} and the link opens it client-side. Either way the
 * document and the open wallet in tab memory stay. The first client render matches SSR (`/welcome`, `profile.back`). An
 * ask or shop wizard override replaces the history link with a button. The wordmark is
 * not the back control. `hideHistoryArrow` omits the history arrow; a wizard
 * override still shows.
 *
 * @param props - Optional plain-click handler, wordmark, tone, and history hide.
 * @returns The back control and wordmark.
 */
export function ProfileChromeLeft({
  onBackClick,
  wordmarkHref = '/welcome',
  wordmark,
  tone = 'app',
  hideHistoryArrow = false,
}: ProfileChromeLeftProps = {}): ReactElement {
  const { t } = useTranslations();
  const { override, stepBack } = useChromeBack();
  const [target, setTarget] = useState<{
    href: string;
    labelKey: 'nav.back' | 'profile.back';
  }>({ href: '/welcome', labelKey: 'profile.back' });
  useLayoutEffect(() => {
    const prev = previousViewPath();
    const href = prev ?? '/welcome';
    const labelKey = prev === null ? 'profile.back' : 'nav.back';
    setTarget((current) =>
      current.href === href && current.labelKey === labelKey ? current : { href, labelKey },
    );
  });
  const arrowClass =
    tone === 'dark'
      ? `${BACK_CLASS} text-paper/70 hover:bg-paper/10 hover:text-paper`
      : `${BACK_CLASS} text-app-muted hover:bg-app-hover hover:text-app-fg`;
  const mark =
    wordmark !== undefined ? (
      wordmark
    ) : (
      <Wordmark href={wordmarkHref} tone={tone === 'dark' ? 'dark' : 'app'} />
    );
  return (
    <>
      {override !== null ? (
        <button
          type="button"
          className={arrowClass}
          aria-label={t(override.labelKey)}
          disabled={override.disabled === true}
          onClick={override.onClick}
        >
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        </button>
      ) : !hideHistoryArrow ? (
        <Link
          href={target.href}
          aria-label={t(target.labelKey)}
          className={arrowClass}
          onClick={(event) => {
            if (
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey ||
              event.button !== 0
            ) {
              return;
            }
            if (onBackClick !== undefined && onBackClick()) {
              event.preventDefault();
              return;
            }
            if (event.detail > 1) {
              // A double click: the first click already left or stepped back.
              event.preventDefault();
              return;
            }
            if (stepBack !== null && takeStepBack(target.href)) {
              event.preventDefault();
              stepBack();
              return;
            }
            markBackNavigation(target.href);
          }}
        >
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        </Link>
      ) : null}
      {mark}
    </>
  );
}
