'use client';

import {
  ArrowDownLeft,
  ArrowUpRight,
  Inbox,
  Menu,
  MessageCircle,
  ScrollText,
  User,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslations } from '@/components/LocaleProvider';
import { LogoutButton } from '@/components/LogoutButton';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { useAccountTotals } from '@/hooks/useAccountTotals';
import { formatBitcoin } from '@/lib/stats-money';

/**
 * Top-right signed-in page chrome: one Menu disclosure; open for icon+label
 * rows (Profile with same-line given/received totals, living-room rules,
 * messages, contact, language, theme, and log out).
 *
 * @returns The signed-in Menu chrome.
 */
export function SignedInChrome(): ReactElement {
  const { t, locale } = useTranslations();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { donatedSats, receivedSats, loading } = useAccountTotals();

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return;
      }
      const expandedLanguage = rootRef.current?.querySelector(
        '[aria-expanded="true"][aria-haspopup="listbox"]',
      );
      if (expandedLanguage) {
        return;
      }
      setOpen(false);
      buttonRef.current?.focus();
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

  const givenAmount = formatBitcoin(donatedSats, locale);
  const receivedAmount = formatBitcoin(receivedSats, locale);

  return (
    <div ref={rootRef} className="relative">
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
        className="inline-flex items-center gap-1.5 text-sm text-app-muted transition hover:text-app-fg"
      >
        <Menu aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        {t('aria.menu')}
      </button>
      {open ? (
        <div
          id="signed-in-menu"
          className="absolute right-0 z-50 mt-2 min-w-[18rem] rounded-xl border border-app-border bg-app-card p-2 shadow-lg"
        >
          <Link
            href="/profile"
            onClick={() => {
              setOpen(false);
            }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-app-fg no-underline transition hover:bg-app-hover"
          >
            <User aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium">{t('profile.title')}</span>
            <span className="ml-auto flex items-center gap-2 text-app-muted">
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
          <Link
            href="/rules"
            onClick={() => {
              setOpen(false);
            }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
          >
            <ScrollText aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            {t('nav.rules')}
          </Link>
          <Link
            href="/messages"
            onClick={() => {
              setOpen(false);
            }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
          >
            <Inbox aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            {t('nav.inbox')}
          </Link>
          <Link
            href="/contact"
            onClick={() => {
              setOpen(false);
            }}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-app-fg no-underline transition hover:bg-app-hover"
          >
            <MessageCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
            {t('nav.contact')}
          </Link>
          <LanguageSwitcher tone="light" embedded />
          <ThemeSwitcher embedded />
          <LogoutButton />
        </div>
      ) : null}
    </div>
  );
}
