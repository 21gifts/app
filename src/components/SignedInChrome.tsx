'use client';

import { ArrowDownLeft, ArrowUpRight, Menu } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslations } from '@/components/LocaleProvider';
import { LogoutButton } from '@/components/LogoutButton';
import { useAccountTotals } from '@/hooks/useAccountTotals';

/**
 * Formats a sat count with the donate catalog keys (never hard-coded English).
 *
 * @param t - Bound translator from {@link useTranslations}.
 * @param sats - Whole-sat amount.
 * @returns Localized amount string.
 */
function formatSatsAmount(
  t: (key: 'forum.satsOne' | 'forum.sats', vars?: { n: string }) => string,
  sats: number,
): string {
  if (sats === 1) {
    return t('forum.satsOne');
  }
  return t('forum.sats', { n: String(sats) });
}

/**
 * Top-right signed-in page chrome: one Menu disclosure; open for Profile, language, and log out.
 *
 * @returns The signed-in Menu chrome.
 */
export function SignedInChrome(): ReactElement {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { donatedSats, receivedSats, loading } = useAccountTotals();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onMouseDown = (event: MouseEvent): void => {
      const root = rootRef.current;
      if (root !== null && !root.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [open]);

  const givenAmount = formatSatsAmount(t, donatedSats);
  const receivedAmount = formatSatsAmount(t, receivedSats);

  return (
    <div ref={rootRef} className="absolute top-4 right-5">
      <button
        ref={buttonRef}
        type="button"
        id="signed-in-menu-button"
        aria-expanded={open}
        aria-controls="signed-in-menu"
        aria-label={t('aria.menu')}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-900"
      >
        <Menu aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        {t('aria.menu')}
      </button>
      {open ? (
        <div
          id="signed-in-menu"
          className="absolute right-0 z-50 mt-2 min-w-[16rem] rounded-xl border border-neutral-200 bg-white p-2 shadow-lg"
        >
          <Link
            href="/profile"
            onClick={() => {
              setOpen(false);
            }}
            className="flex flex-col gap-0.5 rounded-lg px-3 py-2 text-sm text-neutral-900 no-underline transition hover:bg-neutral-50"
          >
            <span className="font-medium">{t('profile.title')}</span>
            <span className="flex items-center gap-2 text-neutral-500">
              {loading ? (
                t('forum.loading')
              ) : (
                <>
                  <span
                    className="inline-flex items-center gap-1"
                    aria-label={t('profile.given', { amount: givenAmount })}
                    title={t('profile.given', { amount: givenAmount })}
                  >
                    <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    {givenAmount}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span
                    className="inline-flex items-center gap-1"
                    aria-label={t('profile.received', { amount: receivedAmount })}
                    title={t('profile.received', { amount: receivedAmount })}
                  >
                    <ArrowDownLeft aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    {receivedAmount}
                  </span>
                </>
              )}
            </span>
          </Link>
          <div className="px-3 py-2">
            <LanguageSwitcher tone="light" embedded />
          </div>
          <div className="px-3 py-2">
            <LogoutButton />
          </div>
        </div>
      ) : null}
    </div>
  );
}
