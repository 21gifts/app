'use client';

import { Check, Copy, Loader2, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { AppShellOverlay } from '@/components/AppShell';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { MoveFundsBack } from '@/components/MoveFundsBack';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { QrCode } from '@/components/QrCode';
import { Button, IconButton } from '@/components/ui';
import { useCopied } from '@/hooks/useCopied';
import { useSpotRate } from '@/hooks/useSpotRate';
import { useWallet } from '@/hooks/useWallet';
import { giftsLightningAddress, openCryptoPayQrValue } from '@/lib/gifts-address';
import { MOVE_FUNDS_EVENT, takeMoveFundsRequest } from '@/lib/move-funds';
import { LOGOUT_EVENT, logInteraction } from '@/lib/interaction-log';
import { nextOnboardingPath } from '@/lib/onboarding';
import { isSmartphoneUserAgent } from '@/lib/payment-link';
import { profileQrLogo } from '@/lib/profile-qr-logo';
import { formatBitcoin, formatFiatDisplay, satsToFiatAmount } from '@/lib/stats-money';
import { visualPin } from '@/lib/visual-pin';
import { onIncomingPayment } from '@/lib/wallet/wallet-service';
import { useAuthStore } from '@/stores/auth-store';

/** The four steps, in order. */
const STEPS = ['intro', 'go', 'waiting', 'done'] as const;

/** One step of the flow. */
type MoveStep = (typeof STEPS)[number];

/** Screenshot pin that opens the flow on its last step (Playwright builds only). */
const ARRIVED_VISUAL_PIN = 'move-arrived';

/** The amount the `?visual=move-arrived` pin shows as arrived. */
const ARRIVED_VISUAL_SATS = 500;

/** Where the open flow stands: its step and, once it arrived, the amount. */
type MoveState = { step: MoveStep; arrivedSats: number } | null;

/**
 * The previous step, or `null` from the first and the last step (the arrow closes there).
 *
 * @param step - The current step.
 * @returns The step one back, or `null`.
 */
function previousStep(step: MoveStep): MoveStep | null {
  if (step === 'go') {
    return 'intro';
  }
  return step === 'waiting' ? 'go' : null;
}

/** Props for {@link MoveFundsSheet}. */
export interface MoveFundsSheetProps {
  /** Told whether the sheet is open, so the chrome can take the Menu out of reach behind it. */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Guided move of the member's Bitcoin from another wallet into the in-app
 * wallet, as a sheet over the page body (from the bottom on a phone, centred
 * on a wide frame) under the header, so the header's top-left arrow stays the
 * one step back. It opens on a move-funds request (`requestMoveFunds`: a
 * `?move=1` link, also one followed before signing in, or the Receive view's
 * **Move Bitcoin from another wallet**) and then removes `move` from the
 * address with `history.replaceState`. It takes a request only while a
 * member is signed in (session and account) and done with onboarding (the
 * next onboarding screen is `/welcome`) with a username, so the address
 * exists: a link opened signed out or during onboarding waits until then.
 * Signing out drops a request that is still waiting, so it never opens for
 * the next member who signs in in this tab; a link a visitor opened before
 * signing in still waits. Four dots show the progress; the
 * icon-only `X` (`moveFunds.close`) and Escape close it.
 *
 * 1. **Bring your Bitcoin here**, a short text, three numbered lines, **Start**.
 * 2. **Send to your 21.gifts address**: the member's own address (the same
 *    helper as Receive) and **Copy my address** (**Copied** for two seconds);
 *    on a desktop (not `isSmartphoneUserAgent`) also the same address QR as
 *    Receive with **Open your other wallet on your phone, tap Send and scan
 *    this code**; then **I sent it**.
 * 3. A spinner, **Waiting for your Bitcoin…**, and **Finish sending in your
 *    other wallet. This screen updates by itself.**
 * 4. A check, **₿X arrived** with its fiat, and **Your wallet now holds ₿Y ·
 *    fiat. …**, then **Done**.
 *
 * Steps 2 and 3 move to step 4 by themselves when a received payment completes
 * (`onIncomingPayment`, the detection of the received-money banner). The
 * top-left arrow goes from 3 to 2 and from 2 to 1, and closes the flow on 1
 * and 4. No other wallet app is named or opened: copy and QR only. Under the
 * Playwright-only `?visual=move-arrived` pin it opens on step 4 with ₿500.
 *
 * Member events (`logInteraction`), once per occurrence: `wallet_move_opened`
 * (`source` `receive` | `link`), `wallet_move_step` (`step` `go` | `waiting`
 * | `done`) each time one of those steps is entered, `wallet_move_copied`
 * (`step` `go`) after a successful copy, `wallet_move_closed` (`step` `intro`
 * | `go` | `waiting`) when it is closed before step 4 (also by **Log out**,
 * recorded under the ending session through `LOGOUT_EVENT`), and
 * `wallet_move_done` (`amountSats`) when the payment arrived while it was open.
 *
 * @param props - See {@link MoveFundsSheetProps}.
 * @returns The sheet, or `null` while the flow is closed.
 */
export function MoveFundsSheet({ onOpenChange }: MoveFundsSheetProps = {}): ReactElement | null {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const username = useAuthStore((state) => state.account?.username ?? null);
  const signedIn = useAuthStore((state) => state.session !== null && state.account !== null);
  const onboarded = useAuthStore(
    (state) =>
      state.account !== null &&
      giftsLightningAddress(state.account.username) !== null &&
      nextOnboardingPath(state.account) === '/welcome',
  );
  const wallet = useWallet();
  const [state, setState] = useState<MoveState>(null);
  const [smartphone, setSmartphone] = useState(true);
  const { copied, copy } = useCopied();
  const rateDay = useSpotRate(state !== null);
  /** True while this sheet saw a member signed in, so only a sign-out drops a waiting request. */
  const wasSignedIn = useRef(false);
  const openChangeRef = useRef(onOpenChange);
  useEffect(() => {
    openChangeRef.current = onOpenChange;
  });

  useEffect(() => {
    // A request waits until a member is signed in (the chrome also shows for a visitor), and
    // signing out ends an open flow, so it never comes back for the next sign-in.
    if (!signedIn) {
      if (wasSignedIn.current) {
        // A request still waiting (one followed during onboarding) belongs to the member who left.
        takeMoveFundsRequest();
      }
      wasSignedIn.current = false;
      setState(null);
      return;
    }
    wasSignedIn.current = true;
    // During onboarding the request stays stored: there is no address to move to yet.
    if (!onboarded) {
      return;
    }
    setSmartphone(isSmartphoneUserAgent(navigator.userAgent));
    const open = (): void => {
      const source = takeMoveFundsRequest();
      if (source === null) {
        return;
      }
      logInteraction('wallet_move_opened', { source });
      setState({ step: 'intro', arrivedSats: 0 });
      const url = new URL(window.location.href);
      if (url.searchParams.has('move')) {
        url.searchParams.delete('move');
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      }
    };
    if (visualPin() === ARRIVED_VISUAL_PIN) {
      setState({ step: 'done', arrivedSats: ARRIVED_VISUAL_SATS });
    } else {
      open();
    }
    window.addEventListener(MOVE_FUNDS_EVENT, open);
    return () => {
      window.removeEventListener(MOVE_FUNDS_EVENT, open);
    };
  }, [signedIn, onboarded]);

  const step = state?.step ?? null;
  const listening = signedIn && (step === 'go' || step === 'waiting');
  const shown = signedIn && step !== null;

  useEffect(() => {
    openChangeRef.current?.(shown);
  }, [shown]);

  useEffect(
    () => () => {
      openChangeRef.current?.(false);
    },
    [],
  );

  useEffect(() => {
    if (step === null || step === 'done') {
      return;
    }
    // Log out sends this while the ending session is still current, so the close is recorded under it.
    const onLogout = (): void => {
      logInteraction('wallet_move_closed', { step });
      setState(null);
    };
    window.addEventListener(LOGOUT_EVENT, onLogout);
    return () => {
      window.removeEventListener(LOGOUT_EVENT, onLogout);
    };
  }, [step]);

  useEffect(() => {
    if (!listening) {
      return;
    }
    return onIncomingPayment((payment) => {
      setState({ step: 'done', arrivedSats: payment.amountSats });
      logInteraction('wallet_move_step', { step: 'done' });
      logInteraction('wallet_move_done', { amountSats: payment.amountSats });
    });
  }, [listening]);

  useEffect(() => {
    if (step === null) {
      return;
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        if (step !== 'done') {
          logInteraction('wallet_move_closed', { step });
        }
        setState(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [step]);

  if (state === null || !signedIn) {
    return null;
  }
  const close = (): void => {
    if (state.step !== 'done') {
      logInteraction('wallet_move_closed', { step: state.step });
    }
    setState(null);
  };
  const goTo = (next: MoveStep): void => {
    setState({ ...state, step: next });
    if (next !== 'intro') {
      logInteraction('wallet_move_step', { step: next });
    }
  };
  const back = (): void => {
    const previous = previousStep(state.step);
    if (previous === null) {
      close();
    } else {
      goTo(previous);
    }
  };
  /* v8 ignore next -- this client sheet always runs in a browser */
  const host = typeof window === 'undefined' ? '21.gifts' : window.location.hostname;
  const address = giftsLightningAddress(username, host);
  const qr = openCryptoPayQrValue(username, host);
  const index = STEPS.indexOf(state.step);
  const fiatOf = (sats: number): string | null => {
    const amount = satsToFiatAmount(sats, rateDay, fiat);
    return amount === null ? null : formatFiatDisplay(amount, fiat, numberFormat);
  };
  const bitcoinWithFiat = (sats: number): string => {
    const fiatText = fiatOf(sats);
    const bitcoin = formatBitcoin(sats, numberFormat);
    return fiatText === null ? bitcoin : `${bitcoin} · ${fiatText}`;
  };

  let body: ReactElement;
  if (state.step === 'intro') {
    body = (
      <>
        <h2 id="move-funds-title" className="text-xl font-semibold tracking-tight">
          {t('moveFunds.introTitle')}
        </h2>
        <p className="text-sm text-app-muted">{t('moveFunds.introBody')}</p>
        <ol className="flex flex-col gap-2 text-sm text-app-fg">
          <li>{t('moveFunds.introStep1')}</li>
          <li>{t('moveFunds.introStep2')}</li>
          <li>{t('moveFunds.introStep3')}</li>
        </ol>
        <Button type="button" size="lg" onClick={() => goTo('go')}>
          {t('moveFunds.start')}
        </Button>
      </>
    );
  } else if (state.step === 'go') {
    body = (
      <>
        <h2 id="move-funds-title" className="text-xl font-semibold tracking-tight">
          {t('moveFunds.addressTitle')}
        </h2>
        {address === null ? null : (
          <>
            <p className="w-full min-w-0 truncate text-center font-mono text-sm text-app-fg">
              {address}
            </p>
            {smartphone || qr === null ? null : (
              <>
                <p className="text-center text-sm text-app-muted">{t('moveFunds.scanHint')}</p>
                <div className="flex justify-center">
                  <QrCode value={qr} label={t('profile.giftsQr')} logo={profileQrLogo} />
                </div>
              </>
            )}
            <div className="flex justify-center">
              <Button
                type="button"
                variant="secondary"
                icon={
                  copied ? (
                    <Check aria-hidden="true" className="h-4 w-4" />
                  ) : (
                    <Copy aria-hidden="true" className="h-4 w-4" />
                  )
                }
                onClick={() => {
                  void copy(address).then((done) => {
                    if (done) {
                      logInteraction('wallet_move_copied', { step: 'go' });
                    }
                  });
                }}
              >
                {copied ? t('wallet.copied') : t('moveFunds.copy')}
              </Button>
            </div>
          </>
        )}
        <Button type="button" size="lg" onClick={() => goTo('waiting')}>
          {t('moveFunds.sent')}
        </Button>
      </>
    );
  } else if (state.step === 'waiting') {
    body = (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-app-subtle" />
        <h2 id="move-funds-title" role="status" className="text-xl font-semibold tracking-tight">
          {t('moveFunds.waitingTitle')}
        </h2>
        <p className="text-sm text-app-muted">{t('moveFunds.waitingBody')}</p>
      </div>
    );
  } else {
    const balanceSats = wallet.status === 'ready' ? wallet.balanceSats : null;
    body = (
      <>
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-app-success/15 text-app-success">
            <Check aria-hidden="true" className="h-7 w-7" />
          </span>
          <h2
            id="move-funds-title"
            role="status"
            className="text-xl font-semibold tracking-tight tabular-nums lining-nums"
          >
            {t('moveFunds.arrivedTitle', {
              amount: formatBitcoin(state.arrivedSats, numberFormat),
            })}
          </h2>
          {fiatOf(state.arrivedSats) === null ? null : (
            <p className="text-sm tabular-nums lining-nums text-app-muted">
              {fiatOf(state.arrivedSats)}
            </p>
          )}
          <p className="text-sm text-app-muted">
            {balanceSats === null
              ? t('moveFunds.arrivedAgain')
              : `${t('moveFunds.arrivedBalance', { balance: bitcoinWithFiat(balanceSats) })} ${t('moveFunds.arrivedAgain')}`}
          </p>
        </div>
        <Button type="button" size="lg" onClick={close}>
          {t('moveFunds.done')}
        </Button>
      </>
    );
  }

  return (
    <AppShellOverlay>
      <MoveFundsBack onBack={back} />
      <div className="absolute inset-0 z-[95] flex items-end justify-center bg-app-overlay sm:items-center sm:p-4">
        <div
          role="dialog"
          aria-labelledby="move-funds-title"
          data-move-funds=""
          className="flex w-full max-w-md flex-col gap-4 rounded-t-3xl bg-app-card p-5 shadow-xl sm:rounded-3xl"
        >
          <div className="flex items-center justify-between">
            <div className="flex gap-1.5">
              <span className="sr-only">
                {t('moveFunds.progress', { step: index + 1, total: STEPS.length })}
              </span>
              {STEPS.map((name, at) => (
                <span
                  key={name}
                  aria-hidden="true"
                  className={`h-1.5 w-6 rounded-full ${at <= index ? 'bg-app-fg' : 'bg-app-border'}`}
                />
              ))}
            </div>
            <IconButton
              type="button"
              variant="ghost"
              aria-label={t('moveFunds.close')}
              onClick={close}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          </div>
          {body}
        </div>
      </div>
    </AppShellOverlay>
  );
}
