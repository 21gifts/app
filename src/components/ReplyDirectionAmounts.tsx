'use client';

import type { ReactElement } from 'react';
import { preferredFiatSuffix } from '@/components/PreferredFiatSuffix';
import { useTranslations } from '@/components/LocaleProvider';
import type { NumberFormatStyle } from '@/lib/number-format';
import { formatBitcoin, type FiatCode, type FiatRateDay } from '@/lib/stats-money';

/** Fiat stored for one direction of a reply. */
type StoredFiat = {
  amountUsd?: string | null | undefined;
  amountChf?: string | null | undefined;
  amountEur?: string | null | undefined;
  amountPhp?: string | null | undefined;
};

export type ReplyDirectionAmountsProps = {
  /** Reply body. Empty text with sats is a gift-only row. */
  text: string;
  /** Sats the author sent with this reply. */
  sats: number;
  /** Sats later receipts added on this reply. Missing means none. */
  receivedSats?: number | undefined;
  rateDay: FiatRateDay | null;
  fiat: FiatCode;
  numberFormat: NumberFormatStyle;
  /** Fiat stored for `sats`. */
  sent?: StoredFiat | undefined;
  /** Fiat stored for `receivedSats`. */
  received?: StoredFiat | undefined;
};

/**
 * Money on a reply. What the author sent and what later arrived stay two
 * lines and are never added.
 *
 * A gift-only reply (`text === ''` and `sats > 0`) is `forum.giftReply`.
 * A reply with text and sats, and no later receipt, is the bare formatted
 * amount under the body. When `receivedSats` is greater than zero, that
 * receipt is `forum.receivedOnReply` on its own line. A text reply that
 * also sent sats labels that line `forum.sentOnReply`, and the two lines
 * share a left rule. Zero or a missing receipt draws no received line.
 * Nothing to show returns null.
 *
 * @param props - Reply text, both sat amounts, and the fiat for each.
 * @returns The amount lines, or null when both amounts are absent.
 */
export function ReplyDirectionAmounts(props: ReplyDirectionAmountsProps): ReactElement | null {
  const { t } = useTranslations();
  const received = props.receivedSats ?? 0;
  const sentFiat = preferredFiatSuffix(
    props.sats,
    props.rateDay,
    props.fiat,
    props.numberFormat,
    props.sent,
  );
  const receivedFiat = preferredFiatSuffix(
    received,
    props.rateDay,
    props.fiat,
    props.numberFormat,
    props.received,
  );
  const giftOnly = props.text === '' && props.sats > 0;
  const textGift = props.text !== '' && props.sats > 0;
  const showReceived = received > 0;

  if (!giftOnly && !textGift && !showReceived) {
    return null;
  }

  if (textGift && showReceived) {
    return (
      <div className="mt-2 border-l-2 border-app-border pl-3">
        <p className="text-sm tabular-nums lining-nums text-app-fg">
          {t('forum.sentOnReply', { amount: formatBitcoin(props.sats, props.numberFormat) })}
          {sentFiat}
        </p>
        <p className="mt-0.5 text-sm tabular-nums lining-nums text-app-subtle">
          {t('forum.receivedOnReply', { amount: formatBitcoin(received, props.numberFormat) })}
          {receivedFiat}
        </p>
      </div>
    );
  }

  return (
    <>
      {giftOnly ? (
        <p className="mt-1 text-sm tabular-nums lining-nums text-app-fg">
          {t('forum.giftReply', { amount: formatBitcoin(props.sats, props.numberFormat) })}
          {sentFiat}
        </p>
      ) : null}
      {textGift ? (
        <p className="mt-1 text-sm tabular-nums lining-nums text-app-muted">
          {formatBitcoin(props.sats, props.numberFormat)}
          {sentFiat}
        </p>
      ) : null}
      {showReceived ? (
        <p className="mt-0.5 text-sm tabular-nums lining-nums text-app-subtle">
          {t('forum.receivedOnReply', { amount: formatBitcoin(received, props.numberFormat) })}
          {receivedFiat}
        </p>
      ) : null}
    </>
  );
}
