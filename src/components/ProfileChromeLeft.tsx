'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useLayoutEffect, useState, type ReactElement } from 'react';
import { useChromeBack } from '@/components/ViewHistoryRoot';
import { useTranslations } from '@/components/LocaleProvider';
import { Wordmark } from '@/components/ui';
import { goToPreviousView, previousViewPath } from '@/lib/view-history';

const BACK_CLASS =
  'inline-flex h-11 w-11 items-center justify-center rounded-full text-app-muted transition hover:bg-app-hover hover:text-app-fg';

/** Props for {@link ProfileChromeLeft}. */
export interface ProfileChromeLeftProps {
  /**
   * Unmodified primary click. The link does not follow its href. Modified
   * clicks still do. Wallet uses this for one in-page step: hide the words or
   * close Advanced functions before {@link goToPreviousView}.
   */
  onBackClick?: () => void;
  /** Wordmark destination. Default `/welcome`. */
  wordmarkHref?: string;
}

/**
 * Shared signed-in top-left chrome: one icon-only back plus wordmark.
 *
 * Back is a link to the previous in-app view, or `/welcome` when this tab has
 * none. The first client render matches SSR (`/welcome`, `profile.back`). An
 * ask-wizard override replaces the history link with a button. The wordmark is
 * not the back control.
 *
 * @param props - Optional plain-click handler and wordmark href.
 * @returns The back control and wordmark.
 */
export function ProfileChromeLeft({
  onBackClick,
  wordmarkHref = '/welcome',
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
  return (
    <>
      {override !== null ? (
        <button
          type="button"
          className={BACK_CLASS}
          aria-label={t(override.labelKey)}
          onClick={override.onClick}
        >
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        </button>
      ) : (
        <Link
          href={target.href}
          aria-label={t(target.labelKey)}
          className={BACK_CLASS}
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
      )}
      <Wordmark href={wordmarkHref} />
    </>
  );
}
