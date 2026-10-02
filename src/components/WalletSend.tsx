'use client';

import { Loader2, X } from 'lucide-react';
import { useState, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { AmountEntry } from '@/components/AmountEntry';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { useNumberFormat } from '@/components/NumberFormatProvider';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { Button, Field, IconButton } from '@/components/ui';
import {
  walletSendBounds,
  type UseWalletSendResult,
  type WalletSendError,
} from '@/hooks/useWalletSend';
import { useLatestRateDay } from '@/hooks/useLatestRateDay';
import type { MessageKey } from '@/lib/messages';
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
   * is ready again.
   * Default `true`.
   */
  walletReady?: boolean;
}

const ERROR_KEYS: Record<WalletSendError, MessageKey> = {
  invalid: 'wallet.sendInvalid',
  unreachable: 'wallet.sendUnreachable',
  onchain: 'wallet.sendOnchain',
  unsupported: 'wallet.sendUnsupported',
  insufficient: 'wallet.payInsufficient',
  failed: 'wallet.sendFailed',
};

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
    <div className="relative flex w-full flex-col items-stretch gap-3 rounded-xl border border-app-border bg-app-card p-3 pt-10">
      <div className="absolute left-2 top-2">
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
 * Send block on `/wallet` under the balance: paste a Bitcoin payment request
 * or address, enter an amount when the receiver asks for one, confirm amount,
 * fee, and recipient, then send. While the wallet is not ready, an input step
 * with an alert shows only that alert.
 *
 * @param props - Send flow and whether the wallet is ready.
 * @returns The send region.
 */
export function WalletSend({ send, walletReady = true }: WalletSendProps): ReactElement {
  const { t } = useTranslations();
  const { numberFormat } = useNumberFormat();
  const { fiat } = useFiatPreference();
  const rateDay = useLatestRateDay();
  const accountUnit = useAuthStore((state) => state.account?.amountUnit ?? 'btc');
  const [amountDraft, setAmountDraft] = useState('');
  const [amountUnit, setAmountUnit] = useState<AmountUnit>(accountUnit);
  const { state, busy } = send;
  const spinner = busy ? (
    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
  ) : undefined;
  const close = (): void => {
    send.cancel();
  };

  const fiatOf = (sats: number): ReactElement | null =>
    preferredFiatSuffix(sats, rateDay, fiat, numberFormat);
  const boundText = (sats: number): string => {
    const live = satsToFiatAmount(sats, rateDay, fiat);
    const bitcoin = formatBitcoin(sats, numberFormat);
    return live === null ? bitcoin : `${bitcoin} · ${formatFiatDisplay(live, fiat, numberFormat)}`;
  };

  let body: ReactElement;
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
    body = (
      <form onSubmit={onSubmit} className="flex w-full flex-col items-stretch gap-3">
        <Field
          label={t('wallet.sendLabel')}
          placeholder={t('wallet.sendPlaceholder')}
          value={send.text}
          disabled={busy}
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
    );
  } else if (state.step === 'amount') {
    const target = state.target;
    const { min, max } = walletSendBounds(target);
    const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      const parsed = parseAmountDraft(amountUnit, amountDraft, rateDay, fiat);
      send.submitAmount(parsed.kind === 'sats' ? parsed.sats : null);
    };
    const commentMax = target.type === 'lnurl' ? target.commentMaxLength : 0;
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
          {target.type === 'lnurl' ? (
            <p className="text-center text-xs tabular-nums lining-nums text-app-muted">
              {t('wallet.sendAmountRange', {
                min: boundText(min),
                max: boundText(max),
              })}
            </p>
          ) : null}
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
          {state.amountError ? (
            <p role="alert" className="text-center text-sm text-app-danger">
              {target.type === 'lnurl'
                ? t('wallet.sendAmountInvalid', { min: boundText(min), max: boundText(max) })
                : t('wallet.sendAmountMin', { min: boundText(min) })}
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
  } else if (state.step === 'confirm') {
    body = (
      <StepBox onClose={close}>
        <p className="min-w-0 truncate text-center text-sm text-app-fg">
          {t('wallet.sendTo', { recipient: state.recipient })}
        </p>
        <p className="text-center text-base font-semibold tabular-nums lining-nums text-app-fg">
          {t('wallet.sendConfirm', { amount: formatBitcoin(state.amountSats, numberFormat) })}
          {fiatOf(state.amountSats)}
        </p>
        <p className="text-center text-xs tabular-nums lining-nums text-app-muted">
          {t('wallet.payFee', { amount: formatBitcoin(state.feeSats, numberFormat) })}
          {fiatOf(state.feeSats)}
        </p>
        <div className="flex justify-center">
          <Button
            type="button"
            variant="primary"
            disabled={busy}
            icon={spinner}
            onClick={send.confirm}
          >
            {t('wallet.sendButton')}
          </Button>
        </div>
      </StepBox>
    );
  } else {
    body = (
      <div className="flex flex-col items-center gap-3">
        <p role="status" className="text-center text-sm tabular-nums lining-nums text-app-fg">
          {t('wallet.sendSent', { amount: formatBitcoin(state.amountSats, numberFormat) })}
          {fiatOf(state.amountSats)}
        </p>
        <Button type="button" onClick={close}>
          {t('wallet.sendDone')}
        </Button>
      </div>
    );
  }

  return (
    <section
      aria-label={t('wallet.sendHeading')}
      className="flex w-full flex-col items-stretch gap-3"
    >
      <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
        {t('wallet.sendHeading')}
      </p>
      {body}
    </section>
  );
}
