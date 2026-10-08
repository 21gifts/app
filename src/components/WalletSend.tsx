'use client';

import { CircleCheck, ClipboardPaste, Keyboard, Loader2, X } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { AmountEntry } from '@/components/AmountEntry';
import { AppShellFooter } from '@/components/AppShell';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { QrScanner } from '@/components/QrScanner';
import { Button, Field, IconButton } from '@/components/ui';
import {
  walletSendBounds,
  type UseWalletSendResult,
  type WalletSendError,
} from '@/hooks/useWalletSend';
import { useSpotRate } from '@/hooks/useSpotRate';
import type { MessageKey } from '@/lib/messages';
import type { OnchainSpeed } from '@/lib/wallet/wallet-sdk';
import {
  formatBitcoin,
  formatFiatDisplay,
  parseAmountDraft,
  satsToFiatAmount,
} from '@/lib/stats-money';
import type { AmountUnit } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

/** Props for {@link WalletSend}. */
export interface WalletSendProps {
  /** Send flow state and actions from `useWalletSend`. */
  send: UseWalletSendResult;
  /**
   * Whether the wallet is ready. When it is not, an input step with an alert
   * shows only that alert, so nothing can be pasted or sent until the wallet
   * is ready again. Default `true`.
   */
  walletReady?: boolean;
  /** Whether the input step shows its manual-entry sheet over the camera. */
  manualEntry: boolean;
  /** Opens or closes the manual-entry sheet. */
  onManualEntry: (open: boolean) => void;
}

/** Floating camera control: an `overlay` pill of at least 48px with a 20px icon. */
const FLOAT_CLASS = 'min-h-12 text-base';

/** How long a clipboard alert stays over the camera. */
const CLIPBOARD_ALERT_MS = 4000;

const LARGE_AMOUNT_CLASS =
  'text-center text-5xl font-semibold tracking-tight tabular-nums lining-nums text-app-fg sm:text-6xl';

const ERROR_KEYS: Record<WalletSendError, MessageKey> = {
  invalid: 'wallet.sendInvalid',
  unreachable: 'wallet.sendUnreachable',
  notPayable: 'wallet.sendNotPayable',
  notFound: 'wallet.sendNotFound',
  relayUnreachable: 'wallet.sendRelayUnreachable',
  unsupported: 'wallet.sendUnsupported',
  insufficient: 'wallet.payInsufficient',
  failed: 'wallet.sendFailed',
  notReady: 'wallet.sendNotReady',
  unreadable: 'wallet.sendUnreadable',
};

/** Speeds of a payment to a base-chain address, fastest first, with their labels. */
const SPEEDS: readonly { speed: OnchainSpeed; key: MessageKey }[] = [
  { speed: 'fast', key: 'wallet.sendSpeedFast' },
  { speed: 'medium', key: 'wallet.sendSpeedMedium' },
  { speed: 'slow', key: 'wallet.sendSpeedSlow' },
];

/**
 * Bordered step box with the Cancel close (`X`) in the top-left corner. The
 * close stays on this view; it is not a back control.
 *
 * @param props - Close handler and step content.
 * @returns The step box.
 */
function StepBox({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}): ReactElement {
  const { t } = useTranslations();
  return (
    <div className="relative flex w-full flex-col items-stretch gap-3 rounded-xl border border-app-border bg-app-card p-3 pt-12">
      <div className="absolute left-3 top-3">
        <IconButton
          type="button"
          size="sm"
          variant="ghost"
          aria-label={t('wallet.sendCancel')}
          onClick={onClose}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </IconButton>
      </div>
      {children}
    </div>
  );
}

/**
 * Send view on `/wallet` and over `/welcome`, opened with Send: scan, paste,
 * or type a Bitcoin payment request or address, enter an amount when the receiver asks
 * for one, confirm amount, fee, and recipient, then send. A base-chain Bitcoin
 * address (or a `bitcoin:` URI that offers only one) asks for an amount, then
 * confirms with the chosen fee and the total in emphasized text right under the
 * recipient, then one row per speed (each with its fee in ₿ and fiat), and a
 * line that this network fee is much higher than the fee of other payments; a
 * speed the balance does not cover is disabled. While an expired quote is
 * renewed, Cancel stays usable; it is disabled only while a payment is sent.
 * The input step is a full-size camera: the region itself becomes a layer
 * marked `data-port-fill` that fills the visible page port edge to edge (the AppShell scrollport becomes
 * its containing block, see `globals.css`), with the hint over the top of the
 * picture. **Paste** and **Enter manually** float as `overlay` pills over its
 * lower part. A decoded QR text, or the text Paste reads from the clipboard,
 * goes into the field as if typed and is submitted once; a clipboard that is
 * refused or empty shows a short alert over the camera, which keeps running.
 * Enter manually opens a bottom sheet over the camera with the field and
 * Continue; its Close (`X`) or Back returns to the camera, and Enter manually
 * takes the focus again. A text that cannot
 * be read always ends in one alert: over the camera with **Try again**, which
 * clears it and starts the camera again, or in the open sheet under the field.
 * The camera runs only while the input step is idle, shows no alert, and the
 * sheet is closed, so a code that was just refused is not read again at once.
 * After a scan or paste the camera stays off until the submit moves on (busy,
 * another step, or an alert) or the text changes, so the same code is never
 * submitted twice. While the wallet is not ready, an input step with an alert
 * shows only that alert.
 *
 * @param props - Send flow, whether the wallet is ready, and the manual-entry sheet.
 * @returns The send region.
 */
export function WalletSend({
  send,
  walletReady = true,
  manualEntry,
  onManualEntry,
}: WalletSendProps): ReactElement {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const rateDay = useSpotRate();
  const accountUnit = useAuthStore((state) => state.account?.amountUnit ?? 'btc');
  const [amountDraft, setAmountDraft] = useState('');
  const [amountUnit, setAmountUnit] = useState<AmountUnit>(accountUnit);
  const [scanned, setScanned] = useState<string | null>(null);
  const scanSubmitted = useRef(false);
  const [clipboardError, setClipboardError] = useState<'denied' | 'empty' | null>(null);
  /** Enter manually, which takes the focus back when the sheet closes. */
  const manualButton = useRef<HTMLButtonElement>(null);
  const sheetWasOpen = useRef(manualEntry);
  useEffect(() => {
    if (sheetWasOpen.current && !manualEntry) {
      manualButton.current?.focus({ preventScroll: true });
    }
    sheetWasOpen.current = manualEntry;
  }, [manualEntry]);
  /** Bumped whenever a pending clipboard read must no longer take effect. */
  const pasteRun = useRef(0);
  useEffect(
    () => () => {
      pasteRun.current += 1;
    },
    [],
  );
  /** The input alert, or `'step'` once the flow has left the input step. */
  const inputError = send.state.step === 'input' ? send.state.error : 'step';
  const { state, busy, text, submitInput } = send;
  useEffect(() => {
    if (manualEntry || inputError !== null) {
      pasteRun.current += 1;
    }
  }, [manualEntry, inputError]);
  const spinner = busy ? (
    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
  ) : undefined;
  const close = (): void => {
    send.cancel();
  };

  useEffect(() => {
    if (scanned === null) {
      return;
    }
    const moved = busy || inputError !== null;
    if (moved || (scanSubmitted.current && text !== scanned)) {
      setScanned(null);
      return;
    }
    if (!scanSubmitted.current && text === scanned) {
      scanSubmitted.current = true;
      setAmountDraft('');
      submitInput();
    }
  }, [scanned, text, busy, inputError, submitInput]);

  useEffect(() => {
    if (clipboardError === null) {
      return;
    }
    const timer = window.setTimeout(() => {
      setClipboardError(null);
    }, CLIPBOARD_ALERT_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [clipboardError]);

  /**
   * Puts a scanned or pasted text into the field and submits it once. A
   * clipboard read still pending, or its alert, is dropped, so a scan wins
   * over it and only the read's own alert can follow.
   */
  const takeText = (value: string): void => {
    pasteRun.current += 1;
    setClipboardError(null);
    scanSubmitted.current = false;
    send.setText(value);
    setScanned(value);
  };
  const paste = async (): Promise<void> => {
    setClipboardError(null);
    pasteRun.current += 1;
    const run = pasteRun.current;
    let value: string;
    try {
      value = await navigator.clipboard.readText();
    } catch {
      if (run === pasteRun.current) {
        setClipboardError('denied');
      }
      return;
    }
    // A read that settles after the sheet opened, the step moved on, or the view closed is dropped.
    if (run !== pasteRun.current) {
      return;
    }
    if (value.trim() === '') {
      setClipboardError('empty');
      return;
    }
    takeText(value);
  };

  const fiatOf = (sats: number): ReactElement | null =>
    preferredFiatSuffix(sats, rateDay, fiat, numberFormat);
  const fiatText = (sats: number): string | null => {
    const live = satsToFiatAmount(sats, rateDay, fiat);
    return live === null ? null : formatFiatDisplay(live, fiat, numberFormat);
  };
  const boundText = (sats: number): string => {
    const live = fiatText(sats);
    const bitcoin = formatBitcoin(sats, numberFormat);
    return live === null ? bitcoin : `${bitcoin} · ${live}`;
  };
  const largeAmount = (sats: number, amount: string): ReactElement => {
    const live = fiatText(sats);
    return (
      <div className="flex flex-col items-center gap-2">
        <p className={LARGE_AMOUNT_CLASS}>{amount}</p>
        {live === null ? null : (
          <p className="text-center text-base tabular-nums lining-nums text-app-muted">{live}</p>
        )}
      </div>
    );
  };
  const footerAction = (children: ReactNode): ReactElement => (
    <AppShellFooter>
      <div className="mx-auto flex w-full max-w-sm flex-col items-stretch gap-3">{children}</div>
    </AppShellFooter>
  );

  const confirmFooter = footerAction(
    <>
      <Button
        size="lg"
        className="min-h-14 text-base"
        disabled={busy}
        icon={spinner}
        onClick={send.confirm}
      >
        {t('wallet.sendButton')}
      </Button>
      <button
        type="button"
        disabled={send.sending}
        onClick={close}
        className="self-center px-4 py-2 text-sm text-app-muted underline hover:text-app-fg disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t('wallet.sendCancel')}
      </button>
    </>,
  );

  let body: ReactElement;
  const camera = state.step === 'input' && (walletReady || state.error === null);
  if (state.step === 'input' && !walletReady && state.error !== null) {
    body = (
      <p role="alert" className="text-center text-sm text-app-danger">
        {t(ERROR_KEYS[state.error])}
      </p>
    );
  } else if (state.step === 'input') {
    const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      setAmountDraft('');
      send.submitInput();
    };
    const cameraOn = !manualEntry && !busy && scanned === null && state.error === null;
    body = (
      <>
        {cameraOn ? <QrScanner onResult={takeText} /> : null}
        {busy && !manualEntry ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 aria-hidden="true" className="h-10 w-10 animate-spin text-white" />
          </div>
        ) : null}
        {manualEntry ? (
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-app-card p-4 pt-12 text-app-fg shadow-lg">
            <div className="absolute left-3 top-3">
              <IconButton
                type="button"
                size="sm"
                variant="ghost"
                aria-label={t('wallet.sendCancel')}
                onClick={() => {
                  onManualEntry(false);
                }}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </IconButton>
            </div>
            <form onSubmit={onSubmit} className="flex w-full flex-col items-stretch gap-3">
              <Field
                label={t('wallet.sendLabel')}
                placeholder={t('wallet.sendPlaceholder')}
                value={send.text}
                disabled={busy}
                autoFocus
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                onChange={(event) => {
                  send.setText(event.target.value);
                }}
              />
              {state.error === null ? null : (
                <p role="alert" className="text-center text-sm text-app-danger">
                  {t(ERROR_KEYS[state.error])}
                </p>
              )}
              <div className="flex justify-center">
                <Button type="submit" disabled={busy || send.text.trim() === ''} icon={spinner}>
                  {t('wallet.sendContinue')}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <>
            {state.error === null ? null : (
              <div className="absolute inset-x-0 top-1/3 flex -translate-y-1/2 flex-col items-center gap-4 px-8">
                <p role="alert" className="text-center text-lg font-medium text-white">
                  {t(ERROR_KEYS[state.error])}
                </p>
                <Button
                  variant="overlay"
                  className={FLOAT_CLASS}
                  onClick={() => {
                    send.setText('');
                  }}
                >
                  {t('login.retry')}
                </Button>
              </div>
            )}
            <div className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-3 px-4">
              {clipboardError === null ? null : (
                <p
                  role="alert"
                  className="rounded-2xl bg-black/55 px-4 py-2 text-center text-sm text-white backdrop-blur-md"
                >
                  {t(clipboardError === 'denied' ? 'wallet.pasteDenied' : 'wallet.pasteEmpty')}
                </p>
              )}
              <div className="flex flex-wrap justify-center gap-3">
                <Button
                  variant="overlay"
                  className={FLOAT_CLASS}
                  disabled={busy}
                  icon={<ClipboardPaste aria-hidden="true" className="h-5 w-5" />}
                  onClick={() => {
                    void paste();
                  }}
                >
                  {t('wallet.sendPaste')}
                </Button>
                <Button
                  ref={manualButton}
                  variant="overlay"
                  className={FLOAT_CLASS}
                  disabled={busy}
                  icon={<Keyboard aria-hidden="true" className="h-5 w-5" />}
                  onClick={() => {
                    setClipboardError(null);
                    onManualEntry(true);
                  }}
                >
                  {t('wallet.sendEnterManually')}
                </Button>
              </div>
            </div>
          </>
        )}
      </>
    );
  } else if (state.step === 'amount') {
    const target = state.target;
    const { min, max } = walletSendBounds(target);
    const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      const parsed = parseAmountDraft(amountUnit, amountDraft, rateDay, fiat);
      send.submitAmount(parsed.kind === 'sats' ? parsed.sats : null);
    };
    const anyAmount = target.type === 'request' || target.type === 'onchain';
    const commentMax = anyAmount ? 0 : target.commentMaxLength;
    body = (
      <StepBox onClose={close}>
        <form onSubmit={onSubmit} className="flex flex-col items-stretch gap-3">
          <p className="min-w-0 truncate text-center text-sm text-app-fg">
            {t('wallet.sendTo', { recipient: target.recipient })}
          </p>
          <AmountEntry
            label={t('wallet.sendAmountLabel')}
            value={amountDraft}
            disabled={busy}
            rateDay={rateDay}
            valueUnit={amountUnit}
            onValueChange={setAmountDraft}
            onUnitChange={setAmountUnit}
          />
          {anyAmount ? null : (
            <p className="text-center text-xs tabular-nums lining-nums text-app-muted">
              {t('wallet.sendAmountRange', {
                min: boundText(min),
                max: boundText(max),
              })}
            </p>
          )}
          {commentMax > 0 ? (
            <Field
              label={t('wallet.sendComment')}
              value={send.comment}
              maxLength={commentMax}
              disabled={busy}
              onChange={(event) => {
                send.setComment(event.target.value);
              }}
            />
          ) : null}
          {state.commentError === true ? (
            <p role="alert" className="text-center text-sm text-app-danger">
              {t('wallet.sendCommentLong')}
            </p>
          ) : null}
          {state.amountError ? (
            <p role="alert" className="text-center text-sm text-app-danger">
              {anyAmount
                ? t('wallet.sendAmountMin', { min: boundText(min) })
                : t('wallet.sendAmountInvalid', { min: boundText(min), max: boundText(max) })}
            </p>
          ) : null}
          <div className="flex justify-center">
            <Button type="submit" disabled={busy} icon={spinner}>
              {t('wallet.sendContinue')}
            </Button>
          </div>
        </form>
      </StepBox>
    );
  } else if (state.step === 'confirm' && state.onchain !== undefined) {
    const onchain = state.onchain;
    const totalSats = state.amountSats + state.feeSats;
    body = (
      <div className="flex w-full flex-col items-center gap-3 py-2">
        {largeAmount(state.amountSats, formatBitcoin(state.amountSats, numberFormat))}
        <p className="w-full min-w-0 truncate text-center text-sm text-app-muted">
          {t('wallet.sendTo', { recipient: state.recipient })}
        </p>
        {onchain.renewed === true ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('wallet.sendQuoteRenewed')}
          </p>
        ) : null}
        <div className="flex flex-col items-center gap-1 text-center text-base font-semibold tabular-nums lining-nums text-app-fg">
          <p>
            {t('wallet.payFee', { amount: formatBitcoin(state.feeSats, numberFormat) })}
            {fiatOf(state.feeSats)}
          </p>
          <p>
            {t('wallet.sendTotal', { amount: formatBitcoin(totalSats, numberFormat) })}
            {fiatOf(totalSats)}
          </p>
        </div>
        <div
          role="group"
          aria-label={t('wallet.sendSpeedLabel')}
          className="flex w-full max-w-sm flex-col gap-2"
        >
          <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
            {t('wallet.sendSpeedLabel')}
          </p>
          {SPEEDS.map(({ speed, key }) => {
            const fee = onchain.fees[speed];
            const covered = fee <= onchain.spendableFeeSats;
            const selected = onchain.speed === speed;
            return (
              <button
                key={speed}
                type="button"
                aria-pressed={selected}
                disabled={busy || !covered}
                onClick={() => {
                  send.setSpeed(speed);
                }}
                className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-4 py-2 text-left text-sm text-app-fg disabled:cursor-not-allowed disabled:opacity-50 ${
                  selected
                    ? 'border-app-accent bg-app-card-muted font-semibold'
                    : 'border-app-border'
                }`}
              >
                <span>{t(key)}</span>
                <span className="flex flex-col items-end tabular-nums lining-nums">
                  <span>
                    {formatBitcoin(fee, numberFormat)}
                    {fiatOf(fee)}
                  </span>
                  {covered ? null : (
                    <span className="text-xs font-normal text-app-danger">
                      {t('wallet.sendSpeedUncovered')}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <p className="max-w-sm text-center text-xs text-app-muted">
          {t('wallet.sendOnchainFeeHint')}
        </p>
        {confirmFooter}
      </div>
    );
  } else if (state.step === 'confirm') {
    body = (
      <div className="flex w-full flex-col items-center gap-4 py-6">
        {largeAmount(state.amountSats, formatBitcoin(state.amountSats, numberFormat))}
        <p className="w-full min-w-0 truncate text-center text-sm text-app-muted">
          {t('wallet.sendTo', { recipient: state.recipient })}
        </p>
        <p className="text-center text-xs tabular-nums lining-nums text-app-muted">
          {t('wallet.payFee', { amount: formatBitcoin(state.feeSats, numberFormat) })}
          {state.feeSats > 0 ? fiatOf(state.feeSats) : null}
        </p>
        {confirmFooter}
      </div>
    );
  } else {
    body = (
      <div className="flex w-full flex-col items-center gap-4 py-6">
        <CircleCheck aria-hidden="true" className="h-16 w-16 text-app-success" />
        <div role="status" className="flex flex-col items-center gap-2">
          {largeAmount(
            state.amountSats,
            t('wallet.sendSent', { amount: formatBitcoin(state.amountSats, numberFormat) }),
          )}
        </div>
        <p className="w-full min-w-0 truncate text-center text-sm text-app-muted">
          {t('wallet.sendTo', { recipient: state.recipient })}
        </p>
        {footerAction(
          <Button size="lg" className="min-h-14 text-base" onClick={close}>
            {t('wallet.sendDone')}
          </Button>,
        )}
      </div>
    );
  }

  return (
    <section
      aria-label={t('wallet.sendHeading')}
      {...(camera ? { 'data-port-fill': '' } : {})}
      className={
        camera
          ? 'absolute inset-0 overflow-hidden rounded-b-[calc(1.5rem-1px)] bg-black text-white'
          : 'flex w-full flex-col items-stretch gap-3'
      }
    >
      {camera ? null : (
        <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
          {t('wallet.sendHeading')}
        </p>
      )}
      {body}
    </section>
  );
}
