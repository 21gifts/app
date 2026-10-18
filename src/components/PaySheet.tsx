'use client';

import { CircleCheck, X } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { AppShellOverlay } from '@/components/AppShell';
import { usePresent } from '@/components/Collapse';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { Swap } from '@/components/Swap';
import { IconButton } from '@/components/ui';
import type { WalletPaySent } from '@/hooks/useWalletPay';
import { MOTION_FOLD_MS } from '@/lib/motion';
import {
  formatBitcoin,
  formatFiatDisplay,
  satsToFiatAmount,
  type FiatRateDay,
} from '@/lib/stats-money';

/**
 * How long the success step shows before the sheet slides away, in ms, counted from the moment the
 * payment went out (the pay step's fade out included).
 */
export const PAY_SHEET_SUCCESS_MS = 1400;

/**
 * How long a host's `Collapse` keeps a closed pay sheet mounted (`holdMs`), in ms: the success
 * step, then the slide away (`duration-280`, settled at the latest after `MOTION_FOLD_MS`). A sheet
 * the member closed slides away at once and is only kept, inert and hidden, for the rest.
 */
export const PAY_SHEET_HOLD_MS = PAY_SHEET_SUCCESS_MS + MOTION_FOLD_MS;

/** What the Tab key can reach inside the sheet. */
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Keeps Tab and Shift+Tab inside the open sheet, so the keyboard never reaches the page behind the
 * scrim. Focus outside the panel moves to its first control; with no control, the panel keeps it.
 *
 * @param event - The Tab keydown.
 * @param panel - The sheet's dialog panel.
 */
function keepTabInside(event: KeyboardEvent, panel: HTMLElement): void {
  const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (item) => !item.hasAttribute('disabled') && item.closest('[inert]') === null,
  );
  const active = document.activeElement;
  const first = items[0];
  const last = items[items.length - 1];
  if (first === undefined || last === undefined) {
    event.preventDefault();
    panel.focus({ preventScroll: true });
    return;
  }
  if (!(active instanceof Node) || !panel.contains(active)) {
    event.preventDefault();
    first.focus({ preventScroll: true });
    return;
  }
  if (event.shiftKey && (active === first || active === panel)) {
    event.preventDefault();
    last.focus({ preventScroll: true });
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus({ preventScroll: true });
  }
}

const PaySheetCloseContext = createContext<(() => void) | null>(null);

/**
 * The close of the pay sheet around the caller, for a control inside it that leaves the payment
 * (the pay slot's **Add Bitcoin**). A close through it is the member's own, so no success step follows.
 *
 * @returns The sheet's close, or `null` outside a pay sheet.
 */
export function usePaySheetClose(): (() => void) | null {
  return useContext(PaySheetCloseContext);
}

const PaySheetSentContext = createContext<((sent: WalletPaySent) => void) | null>(null);

/**
 * Lets the pay slot tell the pay sheet around it where its send stands: `pending` while the wallet
 * has not answered, `paid` once the payment went out, `null` otherwise. Only a `paid` send makes a
 * close by the host show the success step. A host that closes during a `pending` send keeps the pay
 * step until the send settles: `paid` then shows the success step, anything else slides the sheet
 * away. A host that closes with no send (a failed check, another thread) slides it away like a
 * cancel.
 *
 * @returns The sheet's report, or `null` outside a pay sheet.
 */
export function usePaySheetSent(): ((sent: WalletPaySent) => void) | null {
  return useContext(PaySheetSentContext);
}

const PaySheetFailedContext = createContext(false);

/**
 * Tells the pay sheets inside that the host closed the payment because what it paid for failed after
 * the payment went out (the post behind a paid posting fee could not be sent). Such a close shows no
 * success step: the sheet slides away like a cancel and the page shows the error. It sits outside the
 * host's `Collapse`, so it still reaches a sheet the fold holds.
 *
 * @param props - `failed`, and the content with the hosts.
 * @returns The content with the flag in context.
 */
export function PaySheetFailed({
  failed,
  children,
}: {
  /** True from the failed close until the host opens the next payment. */
  failed: boolean;
  children: ReactNode;
}): ReactElement {
  return <PaySheetFailedContext.Provider value={failed}>{children}</PaySheetFailedContext.Provider>;
}

/** What {@link usePaySheetHold} gives a host. */
export interface PaySheetHold {
  /** Key of the payment whose success step still shows, or `null`. */
  held: string | null;
  /** Call before the host cancels a payment the member closed: no success step, nothing to hold. */
  closedByMember: () => void;
  /**
   * The sheet's `onSentChange`, with the key of the payment that sheet shows: only a payment out or
   * on its way is held, and freed if it then does not go out. A report counts only for its own
   * payment, so a sheet still held for one payment never frees or holds the next one.
   */
  sentChange: (key: string, sent: boolean) => void;
}

/**
 * Keeps the page controls behind a pay sheet disabled through its success step. A host whose form
 * sits beside the held sheet (not inside its `Collapse`) passes the key of the open payment, or
 * `null`; once that payment closes with a payment out or on its way (the sheet's `onSentChange`)
 * and without the member closing it, `held` names it for {@link PAY_SHEET_SUCCESS_MS}, then turns
 * `null`. A close by the member, one with no payment out (a failed check), and a pending send that
 * then does not go out free the controls at once. Each sheet reports under its own payment's key,
 * so a late report from a sheet that is still held cannot free or hold another payment.
 *
 * @param openKey - Key of the payment whose sheet is open, or `null`.
 * @returns The held key, the member-close marker, and the sent report for the sheet.
 */
export function usePaySheetHold(openKey: string | null): PaySheetHold {
  const [shownKey, setShownKey] = useState(openKey);
  const [held, setHeld] = useState<string | null>(null);
  const [memberClosed, setMemberClosed] = useState(false);
  // Whether each payment's sheet has a payment out or on its way, by payment key.
  const [sent, setSent] = useState<Readonly<Record<string, boolean>>>({});
  if (openKey !== shownKey) {
    setShownKey(openKey);
    const hold =
      openKey === null && shownKey !== null && sent[shownKey] === true && !memberClosed
        ? shownKey
        : null;
    setHeld(hold);
    setMemberClosed(false);
    setSent(hold === null ? {} : { [hold]: true });
  }
  useEffect(() => {
    if (held === null) {
      return;
    }
    const timer = window.setTimeout(() => setHeld(null), PAY_SHEET_SUCCESS_MS);
    return () => window.clearTimeout(timer);
  }, [held]);
  const closedByMember = useCallback((): void => setMemberClosed(true), []);
  const sentChange = useCallback((key: string, next: boolean): void => {
    setSent((current) => (current[key] === next ? current : { ...current, [key]: next }));
  }, []);
  // A send still pending at the close that then did not go out frees the controls at once.
  return { held: held !== null && sent[held] === false ? null : held, closedByMember, sentChange };
}

/** Props for {@link PaySheet}. */
export interface PaySheetProps {
  /** What is paid to whom, e.g. **Send to Ana**, **Lend to Ana**, **Pay to post**, or **Send**. */
  title: string;
  /** The amount being paid, in whole sats; shown large with its fiat under it. */
  amountSats: number;
  /** Current spot rate for the fiat line, or `null` while there is none. */
  rateDay: FiatRateDay | null;
  /** Heading of the success step, e.g. **Sent to Ana**, **Lent to Ana**, **Paid and posted**, or **Sent**. */
  successTitle: string;
  /**
   * Called when the member closes the sheet (Close, a tap on the dimmed page, Escape, Add Bitcoin)
   * while the host still shows the payment. Once the host has closed it (the success step, or a
   * send still pending), those only let the sheet go and this is not called.
   */
  onClose: () => void;
  /**
   * Told whether the pay slot has a payment out or on its way (a `pending` or `paid` send, see
   * {@link usePaySheetSent}), e.g. {@link usePaySheetHold}'s `sentChange`.
   */
  onSentChange?: ((sent: boolean) => void) | undefined;
  /** The pay slot. */
  children: ReactNode;
}

/**
 * Bottom sheet that holds the last tap of every payment from the in-app wallet in the forum and the
 * inbox. It slides up from the bottom of the frame body over a dimmed page (centred on a wide frame)
 * with the title, the amount with its fiat, a Close, and the pay slot. Close, a tap on the dimmed
 * page, and Escape close it at once. The host renders it inside a `Collapse` with `holdMs`
 * {@link PAY_SHEET_HOLD_MS}: when that closes without the member closing the sheet ({@link usePresent}
 * turns false) while the pay slot reports a send that went out ({@link usePaySheetSent} `paid`), the
 * pay step fades into a short success step with the amount ({@link Swap}), then the sheet slides
 * away. A send still `pending` at that close keeps the pay step until the wallet answers: once it
 * went out the success step follows, otherwise the sheet slides away. Either way it is gone
 * {@link PAY_SHEET_SUCCESS_MS} after the close. With no send out (or under {@link PaySheetFailed})
 * it slides away at once. Tab and Shift+Tab stay inside the open sheet. With reduced motion it
 * appears and leaves without a slide or a fade.
 *
 * @param props - Title, amount, rate, success heading, close handler, and the pay slot.
 * @returns The sheet in the frame's overlay layer.
 */
export function PaySheet({
  title,
  amountSats,
  rateDay,
  successTitle,
  onClose,
  onSentChange,
  children,
}: PaySheetProps): ReactElement {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const present = usePresent();
  const failed = useContext(PaySheetFailedContext);
  const [entered, setEntered] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [sent, setSent] = useState<WalletPaySent>(null);
  const [wasPresent, setWasPresent] = useState(present);
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  // A new payment while the host still held the last one (`holdMs`) reuses this sheet: start over
  // as a fresh sheet that slides up again, instead of staying gone.
  if (present !== wasPresent) {
    setWasPresent(present);
    if (present) {
      setEntered(false);
      setSucceeded(false);
      setLeaving(false);
      setSent(null);
    }
  }

  // The member's close. Once the host has closed the payment (success step, or a send still
  // pending) it only lets the sheet go: the payment is no longer the member's to cancel.
  const close = useCallback((): void => {
    if (leaving) {
      return;
    }
    setLeaving(true);
    if (present) {
      onClose();
    }
  }, [leaving, present, onClose]);

  // The host closed the payment while the member did not. A send that went out (`paid`) shows the
  // success step. A send still `pending` keeps the pay step until the wallet answers, then this runs
  // again. No send, one that did not go out, or a paid post that failed leaves like a cancel.
  // Adjusted during render, so no frame shows the pay slot of a closed payment as if it were still
  // open.
  if (!present && !leaving && !succeeded) {
    if (sent === 'paid' && !failed) {
      setSucceeded(true);
    } else if (sent !== 'pending' || failed) {
      setLeaving(true);
    }
  }

  // Counted from the host's close: the success step (or a send still pending) ends then, so the
  // sheet has slid away before the host's hold ends.
  useEffect(() => {
    if (present || leaving) {
      return;
    }
    const timer = window.setTimeout(() => setLeaving(true), PAY_SHEET_SUCCESS_MS);
    return () => window.clearTimeout(timer);
  }, [present, leaving]);

  useEffect(() => {
    if (entered) {
      return;
    }
    const frame = requestAnimationFrame(() => setEntered(true));
    // Remember what had focus, to give it back when the sheet leaves.
    if (document.activeElement instanceof HTMLElement && document.activeElement !== panel.current) {
      opener.current = document.activeElement;
    }
    panel.current?.focus({ preventScroll: true });
    return () => cancelAnimationFrame(frame);
  }, [entered]);

  useEffect(() => {
    onSentChange?.(sent !== null);
  }, [onSentChange, sent]);

  // A leaving sheet is out of reach (`inert` below) while its host still holds it: focus goes back
  // to what had it before the sheet opened, when that is still on the page.
  // On the next frame, so a host that frees its controls when the sheet leaves (`usePaySheetHold`)
  // has done so and the focus can land.
  useEffect(() => {
    if (!leaving) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      if (opener.current?.isConnected === true) {
        opener.current.focus({ preventScroll: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [leaving]);

  // Escape closes the open payment, or, once the host closed it, lets the sheet go at once. Tab and
  // Shift+Tab stay inside the sheet while it is shown.
  useEffect(() => {
    if (leaving) {
      return;
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Tab') {
        keepTabInside(event, panel.current as HTMLDivElement);
        return;
      }
      if (event.key !== 'Escape') {
        return;
      }
      close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [leaving, close]);

  const shown = entered && !leaving;
  const fiatAmount = satsToFiatAmount(amountSats, rateDay, fiat);
  const amount = (
    <div className="flex flex-col items-center gap-0.5">
      <p className="text-4xl font-semibold tracking-tight tabular-nums lining-nums text-app-fg">
        {formatBitcoin(amountSats, numberFormat)}
      </p>
      {fiatAmount === null ? null : (
        <p className="text-sm tabular-nums lining-nums text-app-muted">
          {formatFiatDisplay(fiatAmount, fiat, numberFormat)}
        </p>
      )}
    </div>
  );

  return (
    <AppShellOverlay>
      <PaySheetCloseContext.Provider value={close}>
        <PaySheetSentContext.Provider value={setSent}>
          <div
            data-pay-sheet-layer={shown ? 'open' : 'closed'}
            inert={leaving}
            className={`absolute inset-0 z-[95] flex items-end justify-center sm:items-center sm:p-4${
              shown ? '' : ' pointer-events-none'
            }`}
          >
            <button
              type="button"
              tabIndex={-1}
              aria-label={t('forum.payClose')}
              onClick={close}
              className={`absolute inset-0 cursor-default bg-app-overlay transition-opacity duration-280 ease-glide motion-reduce:transition-none ${
                shown ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              tabIndex={-1}
              data-pay-sheet={succeeded ? 'success' : 'pay'}
              className={`relative flex w-full max-w-md flex-col gap-4 rounded-t-3xl border-t border-app-border bg-app-card px-5 pt-2 pb-6 shadow-xl outline-none transition-[translate,opacity] duration-280 ease-glide motion-reduce:transition-none sm:rounded-3xl sm:border ${
                shown ? 'translate-y-0' : 'translate-y-full sm:translate-y-8 sm:opacity-0'
              }`}
            >
              <div
                aria-hidden="true"
                className="mx-auto h-1 w-10 shrink-0 rounded-full bg-app-border"
              />
              <Swap viewKey={succeeded ? 'success' : 'pay'} className="flex flex-col gap-4">
                {succeeded ? (
                  <div role="status" className="flex flex-col items-center gap-3 py-6">
                    <CircleCheck
                      aria-hidden="true"
                      className="h-14 w-14 text-app-success"
                      strokeWidth={1.75}
                    />
                    <p className="text-lg font-semibold text-app-fg">{successTitle}</p>
                    {amount}
                  </div>
                ) : (
                  <>
                    <div className="relative flex min-h-9 items-center justify-center">
                      <h2 className="px-10 text-center text-base font-semibold text-app-fg">
                        {title}
                      </h2>
                      <div className="absolute right-0 top-1/2 -translate-y-1/2">
                        <IconButton
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={t('forum.payClose')}
                          onClick={close}
                        >
                          <X aria-hidden="true" className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </div>
                    {amount}
                    <div className="flex flex-col items-stretch gap-3">{children}</div>
                  </>
                )}
              </Swap>
            </div>
          </div>
        </PaySheetSentContext.Provider>
      </PaySheetCloseContext.Provider>
    </AppShellOverlay>
  );
}
