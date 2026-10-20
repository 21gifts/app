'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';
import { useWallet } from '@/hooks/useWallet';
import { markWalletIntroSeen } from '@/lib/api';
import { logInteraction } from '@/lib/interaction-log';
import type { MessageKey } from '@/lib/messages';
import { useAuthStore } from '@/stores/auth-store';

/** One tour step: what it points at and what it says. */
interface TourStep {
  /** What the step points at, as the `wallet_tour_step` event names it. */
  name: 'balance' | 'receive' | 'send' | 'menu';
  /** CSS selector of the element the step highlights. */
  target: string;
  /** Catalog key of the title. */
  title: MessageKey;
  /** Catalog key of the text. */
  body: MessageKey;
}

/** The four steps, in order. */
const STEPS: readonly TourStep[] = [
  {
    name: 'balance',
    target: '[data-wallet-tour="balance"]',
    title: 'walletTour.balanceTitle',
    body: 'walletTour.balanceBody',
  },
  {
    name: 'receive',
    target: '[data-wallet-tour="receive"]',
    title: 'walletTour.receiveTitle',
    body: 'walletTour.receiveBody',
  },
  {
    name: 'send',
    target: '[data-wallet-tour="send"]',
    title: 'walletTour.sendTitle',
    body: 'walletTour.sendBody',
  },
  {
    name: 'menu',
    target: '#signed-in-menu-button',
    title: 'walletTour.menuTitle',
    body: 'walletTour.menuBody',
  },
];

/** Space between a target and its white ring, in px. */
const RING_PAD = 8;

/** Space between the ring and the card, in px. */
const CARD_GAP = 12;

/** A dialog that is not the tour, the move-funds sheet, or the open Menu: the tour waits while one is up. */
const OTHER_MODAL =
  '[aria-modal="true"]:not([data-wallet-tour-card]), [data-move-funds], #signed-in-menu-button[aria-expanded="true"]';

/**
 * The element a step points at, when it is on screen.
 *
 * @param step - The step.
 * @returns The element, or `null` when it is missing, has no box, or lies
 *   wholly outside the window.
 */
function targetOf(step: TourStep): Element | null {
  const element = document.querySelector(step.target);
  if (element === null) {
    return null;
  }
  const box = element.getBoundingClientRect();
  const visible =
    box.width > 0 &&
    box.height > 0 &&
    box.right > 0 &&
    box.bottom > 0 &&
    box.left < window.innerWidth &&
    box.top < window.innerHeight;
  return visible ? element : null;
}

/** Props for {@link WalletTour}. */
export interface WalletTourProps {
  /**
   * True while the page shows something else over the forum (a wallet view or
   * the writer) or has folded **Receive** / **Send** away: the tour waits.
   */
  blocked: boolean;
}

/**
 * One-time tour on the forum home that explains that the app is now the
 * wallet. It highlights the real elements in place, without navigating: the
 * header balance, **Receive**, **Send**, and **Menu** (`walletTour.*`). A
 * dark layer covers the window with a cut-out and a white ring around the
 * target, and a card under the target (above it when the target sits in the
 * lower half) shows **N of M**, the title, the text, **Skip** (a text
 * button), and **Next**, on the last step **Got it**; Escape skips. The
 * position is measured again on resize, scroll, and any change of the page.
 *
 * Shown only while the signed-in account's `walletIntroSeen` is `false` (a
 * missing field, from an older api, counts as seen), once the wallet is no
 * longer connecting, and while no other dialog, the open Menu, a wallet view,
 * or the writer is up, and while the page has not folded **Receive** / **Send**
 * away (`blocked`), so a folded button is never highlighted. The steps are the ones whose target is on screen when
 * the tour starts; a target that is gone by its turn is skipped. **Skip** and
 * **Got it** set `walletIntroSeen` on the account at once, so the tour does
 * not come back in this session even when the request fails, and POST
 * `/me/wallet-intro-seen` so it does not come back on any device.
 *
 * Member events (`logInteraction`), each once: `wallet_tour_shown` (`steps`,
 * the number of steps found) when it starts, `wallet_tour_step` (`step`
 * 1-based, `target` `balance` | `receive` | `send` | `menu`) the first time
 * a step shows with its own target measured (a step skipped because its
 * target is gone is never reported), and `wallet_tour_done` (`outcome` `completed` | `skipped`,
 * `step` where it ended) when it ends.
 *
 * @param props - See {@link WalletTourProps}.
 * @returns The tour overlay, or `null` while it is not shown.
 */
export function WalletTour({ blocked }: WalletTourProps): ReactElement | null {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const unseen = useAuthStore((state) => state.account?.walletIntroSeen === false);
  const walletSettled = useWallet().status !== 'connecting';
  const [steps, setSteps] = useState<readonly TourStep[] | null>(null);
  const [index, setIndex] = useState(0);
  /** The measured target and the step it was measured for, so a box left over from the last step never counts. */
  const [box, setBox] = useState<{ index: number; rect: DOMRect } | null>(null);
  const [otherModal, setOtherModal] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);
  /** Steps already reported as shown, so a re-render or a resume reports none twice. */
  const shownSteps = useRef(new Set<number>());
  /** True once the tour started, so its start is reported once. */
  const started = useRef(false);
  /** True once the tour ended, so it is reported once. */
  const ended = useRef(false);
  const eligible = session !== null && unseen && walletSettled && !blocked;

  const finish = useCallback((outcome: 'completed' | 'skipped', step: number): void => {
    const { session: token, account, setAccount } = useAuthStore.getState();
    setSteps(null);
    if (!ended.current) {
      ended.current = true;
      logInteraction('wallet_tour_done', { outcome, step });
    }
    /* v8 ignore next 3 -- the tour renders only with a session and an account */
    if (token === null || account === null) {
      return;
    }
    setAccount({ ...account, walletIntroSeen: true });
    void markWalletIntroSeen(token).catch(() => undefined);
  }, []);

  // Watch the page while the tour may show: start it, follow its target, and wait behind dialogs.
  useLayoutEffect(() => {
    if (!eligible) {
      return;
    }
    const measure = (): void => {
      const modal = document.querySelector(OTHER_MODAL) !== null;
      setOtherModal(modal);
      if (modal) {
        return;
      }
      if (steps === null) {
        const present = STEPS.filter((step) => targetOf(step) !== null);
        if (present.length > 0) {
          setSteps(present);
          setIndex(0);
          if (!started.current) {
            started.current = true;
            logInteraction('wallet_tour_shown', { steps: present.length });
          }
        }
        return;
      }
      let at = index;
      while (at < steps.length && targetOf(steps[at] as TourStep) === null) {
        at += 1;
      }
      if (at >= steps.length) {
        finish('completed', index + 1);
        return;
      }
      if (at !== index) {
        setIndex(at);
        return;
      }
      const next = (targetOf(steps[at] as TourStep) as Element).getBoundingClientRect();
      setBox((previous) =>
        previous !== null &&
        previous.index === at &&
        previous.rect.top === next.top &&
        previous.rect.bottom === next.bottom &&
        previous.rect.left === next.left &&
        previous.rect.right === next.right
          ? previous
          : { index: at, rect: next },
      );
    };
    measure();
    const observer = new MutationObserver(measure);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true });
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [eligible, steps, index, finish]);

  const showing = eligible && !otherModal && steps !== null && box !== null;
  // The step's own target was measured: until then it may still be skipped, so it is not reported.
  const measured = showing && box.index === index;

  useEffect(() => {
    if (!showing) {
      return;
    }
    nextRef.current?.focus({ preventScroll: true });
    if (measured && !shownSteps.current.has(index)) {
      shownSteps.current.add(index);
      logInteraction('wallet_tour_step', {
        step: index + 1,
        target: (steps[index] as TourStep).name,
      });
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        finish('skipped', index + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [showing, measured, index, steps, finish]);

  if (!showing) {
    return null;
  }
  const step = steps[index] as TourStep;
  const last = index === steps.length - 1;
  const { rect } = box;
  const height = window.innerHeight;
  const below = rect.top + rect.height / 2 < height / 2;
  const ringTop = Math.max(rect.top - RING_PAD, 0);
  const ringBottom = Math.max(height - rect.bottom - RING_PAD, 0);
  const ringLeft = Math.max(rect.left - RING_PAD, 0);
  const ringRight = Math.min(rect.right + RING_PAD, window.innerWidth);

  return (
    <div className="fixed inset-0 z-[95]">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-2xl shadow-[0_0_0_9999px_rgb(0_0_0/0.62)] ring-2 ring-white transition-all duration-300 motion-reduce:transition-none"
        style={{
          top: ringTop,
          bottom: ringBottom,
          left: ringLeft,
          width: Math.max(0, ringRight - ringLeft),
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-tour-title"
        aria-describedby="wallet-tour-body"
        data-wallet-tour-card=""
        className="fixed inset-x-3 mx-auto max-w-sm rounded-2xl bg-app-card p-4 text-app-fg shadow-xl"
        style={
          below ? { top: height - ringBottom + CARD_GAP } : { bottom: height - ringTop + CARD_GAP }
        }
      >
        <p className="text-[11px] tracking-wide text-app-muted uppercase">
          {t('walletTour.progress', { step: String(index + 1), total: String(steps.length) })}
        </p>
        <h2 id="wallet-tour-title" className="mt-1 text-base font-semibold">
          {t(step.title)}
        </h2>
        <p id="wallet-tour-body" className="mt-1 text-sm text-app-muted">
          {t(step.body)}
        </p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              finish('skipped', index + 1);
            }}
            className="min-h-11 text-sm text-app-muted underline underline-offset-2 hover:text-app-fg"
          >
            {t('walletTour.skip')}
          </button>
          <Button
            ref={nextRef}
            type="button"
            size="sm"
            onClick={() => {
              if (last) {
                finish('completed', index + 1);
              } else {
                setIndex(index + 1);
              }
            }}
          >
            {last ? t('walletTour.done') : t('walletTour.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
