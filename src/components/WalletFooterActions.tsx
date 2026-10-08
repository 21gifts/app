'use client';

import { useContext, useEffect, useRef, type ReactElement } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { AppShellContext, AppShellFooter } from '@/components/AppShell';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';

/** Scroll distance that takes the buttons from full to slim (or back), in px. */
const COLLAPSE_RANGE = 80;

/** Within this distance of the top the buttons are always full size, in px. */
const FULL_NEAR_TOP = 24;

/** Quiet time after the last scroll before an in-between size settles, in ms. */
const SETTLE_MS = 140;

/** Props for {@link WalletFooterActions}. */
export interface WalletFooterActionsProps {
  /** Opens the Receive view. */
  onReceive: () => void;
  /** Opens the Send view. */
  onSend: () => void;
  /** The button to focus when the buttons come back after a view closed, or `null`. */
  focus?: 'receive' | 'send' | null;
}

/**
 * The wallet's two large **Receive** (left, `ArrowDownRight`) and **Send**
 * (right, `ArrowUpRight`) buttons, side by side in the shell footer outside
 * the scrollport, so they stay in place while the page scrolls. Above them an
 * 18px fade with a light blur lets the page end softly instead of at a hard
 * edge. Below 360px the icons drop and the side padding shrinks so long
 * labels fit at 320px. When they come back after a view closed, the button
 * that opened it takes the focus again. Both stay enabled while the wallet
 * opens: only a step inside a view that needs the open wallet waits for it.
 * Used by `/wallet` and `/welcome`.
 *
 * The buttons follow the page scroll. A progress from 0 (full: 56 px tall,
 * `text-base`, 20 px icons, footer padding `0.5rem` above and `1.25rem` below)
 * to 1 (slim: 36 px, a slightly smaller text, 16 px icons, `0.25rem` and
 * `0.75rem`) moves with the scroll distance itself: about 80 px down reach
 * slim, about 80 px up reach full again, with no transition while the page
 * moves. Within 24 px of the top they are always full. When the scroll stops
 * for 140 ms at an in-between value they glide (320 ms) to the nearer end;
 * with reduced motion they go there at once. The scroll position is clamped
 * to the page, so an iOS overscroll does not count. The progress is the
 * `--footer-collapse` custom property on the shell's frame body, so the
 * footer padding and a layer above the buttons (the forum home's **+**)
 * follow it too; `data-footer-snap` on that body marks the glide.
 *
 * @param props - Open handlers and the button to focus.
 * @returns The footer registration.
 */
export function WalletFooterActions({
  onReceive,
  onSend,
  focus = null,
}: WalletFooterActionsProps): ReactElement {
  const { t } = useTranslations();
  const receiveRef = useRef<HTMLButtonElement>(null);
  const sendRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focus === null) {
      return;
    }
    (focus === 'send' ? sendRef : receiveRef).current?.focus({ preventScroll: true });
  }, [focus]);
  const shell = useContext(AppShellContext);
  const body = shell === null ? null : shell.bodyEl;
  const scroller = shell === null ? null : shell.scrollerEl;
  useEffect(() => {
    if (body === null || scroller === null) {
      return;
    }
    const scrolled = (): number => {
      const max = Math.max(scroller.scrollHeight - scroller.clientHeight, 0);
      return Math.min(Math.max(scroller.scrollTop, 0), max);
    };
    let last = scrolled();
    let progress = 0;
    let settle: number | null = null;
    const write = (value: number): void => {
      progress = value;
      body.style.setProperty('--footer-collapse', String(value));
    };
    const onScroll = (): void => {
      const top = scrolled();
      const delta = top - last;
      last = top;
      delete body.dataset['footerSnap'];
      write(top < FULL_NEAR_TOP ? 0 : Math.min(1, Math.max(0, progress + delta / COLLAPSE_RANGE)));
      if (settle !== null) {
        window.clearTimeout(settle);
      }
      settle = window.setTimeout(() => {
        settle = null;
        if (progress === 0 || progress === 1) {
          return;
        }
        if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          body.dataset['footerSnap'] = '';
        }
        write(progress >= 0.5 ? 1 : 0);
      }, SETTLE_MS);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (settle !== null) {
        window.clearTimeout(settle);
      }
      body.style.removeProperty('--footer-collapse');
      delete body.dataset['footerSnap'];
    };
  }, [body, scroller]);
  // At rest (no progress set) every value equals the full size: min-h-14, py-3, text-base, h-5.
  const glide =
    'group-data-[footer-snap]/body:duration-320 group-data-[footer-snap]/body:ease-glide';
  const iconClass = `h-[calc(1.25rem-0.25rem*var(--footer-collapse,0))] w-[calc(1.25rem-0.25rem*var(--footer-collapse,0))] max-[359px]:hidden group-data-[footer-snap]/body:transition-[width,height] ${glide}`;
  const buttonClass = `!min-h-[calc(3.5rem-1.25rem*var(--footer-collapse,0))] !py-[calc(0.75rem-0.375rem*var(--footer-collapse,0))] text-base !text-[length:calc(1rem-0.125rem*var(--footer-collapse,0))] max-[359px]:px-2 group-data-[footer-snap]/body:transition-all ${glide}`;
  return (
    <AppShellFooter>
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-5 bottom-full h-[18px] bg-gradient-to-t from-app-card to-transparent backdrop-blur-[1.5px] [mask-image:linear-gradient(to_top,black,transparent)]"
        />
      </div>
      <div
        data-footer-actions=""
        className={`mx-auto grid w-full max-w-sm grid-cols-2 gap-3 pt-[calc(0.5rem-0.25rem*var(--footer-collapse,0))] group-data-[footer-snap]/body:transition-[padding] ${glide}`}
      >
        <Button
          ref={receiveRef}
          size="lg"
          className={buttonClass}
          icon={<ArrowDownRight aria-hidden="true" className={iconClass} />}
          onClick={onReceive}
        >
          {t('wallet.receive')}
        </Button>
        <Button
          ref={sendRef}
          size="lg"
          className={buttonClass}
          icon={<ArrowUpRight aria-hidden="true" className={iconClass} />}
          onClick={onSend}
        >
          {t('wallet.sendButton')}
        </Button>
      </div>
    </AppShellFooter>
  );
}
