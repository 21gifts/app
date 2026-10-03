'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useLayoutEffect, useState, type ReactElement, type ReactNode } from 'react';
import { useChromeBack } from '@/components/ViewHistoryRoot';
import { useTranslations } from '@/components/LocaleProvider';
import { Wordmark } from '@/components/ui';
import { goToPreviousView, previousViewPath } from '@/lib/view-history';

const BACK_CLASS = 'inline-flex h-11 w-11 items-center justify-center rounded-full transition';

/** Props for {@link ProfileChromeLeft}. */
export interface ProfileChromeLeftProps {
  /**
   * Unmodified primary click. The link does not follow its href. Modified
   * clicks still do. Wallet uses this for one in-page step: hide the words,
   * close a send step, or return from Send or Receive to the wallet home
   * before {@link goToPreviousView}.
   */
  onBackClick?: () => void;
  /** Wordmark destination. Default `/welcome`. Ignored when `wordmark` is set. */
  wordmarkHref?: string;
  /** Replaces the default wordmark. The wordmark is not the back control. */
  wordmark?: ReactNode;
  /** App shell or the ink marketing header. Default `app`. */
  tone?: 'app' | 'dark';
  /**
   * Omit the arrow when this tab has no earlier in-app view. `/welcome` uses
   * this because the fallback would be the current page. An ask or shop
   * wizard override still shows.
   */
  hideWithoutHistory?: boolean;
}

/**
 * Shared top-left chrome: one icon-only back plus wordmark.
 *
 * Back is a link to the previous in-app view, or `/welcome` when this tab has
 * none. The first client render matches SSR (`/welcome`, `profile.back`). An
 * ask or shop wizard override replaces the history link with a button. The wordmark is
 * not the back control. `hideWithoutHistory` omits the arrow only when there
 * is no earlier view and no wizard override.
 *
 * @param props - Optional plain-click handler, wordmark, tone, and history hide.
 * @returns The back control and wordmark.
 */
export function ProfileChromeLeft({
  onBackClick,
  wordmarkHref = '/welcome',
  wordmark,
  tone = 'app',
  hideWithoutHistory = false,
}: ProfileChromeLeftProps = {}): ReactElement {
  const { t } = useTranslations();
  const { override } = useChromeBack();
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
  const showHistoryArrow = !hideWithoutHistory || target.labelKey === 'nav.back';
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
      ) : showHistoryArrow ? (
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
            event.preventDefault();
            if (onBackClick !== undefined) {
              onBackClick();
              return;
            }
            goToPreviousView();
          }}
        >
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        </Link>
      ) : null}
      {mark}
    </>
  );
}
