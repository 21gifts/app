'use client';

import { useEffect, useRef, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';

/** Vibration pattern on a phone when the payment arrives: two firm pulses. */
export const POS_PAID_VIBRATION: readonly number[] = [180, 90, 180];

/** Bitcoin and the currency figure use this size, so neither reads as the lesser amount. */
const PAID_FIGURE_CLASS = 'text-6xl font-bold tabular-nums lining-nums sm:text-8xl';

/** Props for {@link PosPaidOverlay}. */
export interface PosPaidOverlayProps {
  /** The paid amount in bitcoin, already formatted (e.g. `₿98`). */
  amount: string;
  /** The currency figure stored with the charge, or without one the current spot, formatted; `null` while there is neither. */
  fiat: string | null;
  /** Closes the confirmation. **Done** calls this and leaves the till already on screen. */
  onClose: () => void;
}

/**
 * Full-screen confirmation that a till charge was paid: the whole window
 * turns green, a check draws itself inside pulsing rings, and **Paid** with
 * the amount in bitcoin and, at the same size, the charge's stored currency
 * figure (or the current spot without one), fills the middle, so nobody at
 * the counter can miss it. A phone vibrates once on open. **Done** is the
 * only action: it closes the confirmation and leaves the till already under
 * it (`/pos`). Focus moves to **Done** on open.
 * With reduced motion the screen stays the same without the movement.
 *
 * @param props - See {@link PosPaidOverlayProps}.
 * @returns The confirmation dialog.
 */
export function PosPaidOverlay({ amount, fiat, onClose }: PosPaidOverlayProps): ReactElement {
  const { t } = useTranslations();
  const first = useRef<HTMLDivElement>(null);

  useEffect(() => {
    first.current?.querySelector('button')?.focus();
    // Not every browser has it (desktop, iOS Safari); it is a bonus, never the signal.
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(POS_PAID_VIBRATION);
    }
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="pos-paid-title"
      aria-describedby="pos-paid-amount"
      className="fixed inset-0 z-[100] flex animate-paid-in flex-col items-center justify-center gap-6 bg-app-success p-6 text-center text-app-bg"
    >
      <div className="relative flex h-32 w-32 items-center justify-center sm:h-40 sm:w-40">
        <span
          aria-hidden="true"
          className="pos-paid-ring absolute inset-0 rounded-full border-4 border-app-bg"
        />
        <span
          aria-hidden="true"
          className="pos-paid-ring pos-paid-ring-late absolute inset-0 rounded-full border-4 border-app-bg"
        />
        <span className="relative flex h-full w-full items-center justify-center rounded-full bg-app-bg">
          <svg
            aria-hidden="true"
            viewBox="0 0 52 52"
            className="h-2/3 w-2/3 text-app-success"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M14 27 L23 36 L39 18"
              pathLength={1}
              strokeDasharray="1"
              className="animate-paid-check"
            />
          </svg>
        </span>
      </div>
      <h2 id="pos-paid-title" className="text-5xl font-bold tracking-tight sm:text-7xl">
        {t('pos.paidTitle')}
      </h2>
      <div id="pos-paid-amount" className="flex flex-col items-center gap-1">
        <p className={PAID_FIGURE_CLASS}>{amount}</p>
        {fiat === null ? null : <p className={PAID_FIGURE_CLASS}>{fiat}</p>}
        <p className="mt-2 max-w-xs text-base font-medium">{t('pos.paidArrived')}</p>
      </div>
      <div ref={first} className="flex w-full max-w-xs flex-col gap-3">
        <Button type="button" size="lg" onClick={onClose}>
          {t('pos.paidDone')}
        </Button>
      </div>
    </div>
  );
}
