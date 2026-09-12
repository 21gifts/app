import type { ReactElement } from 'react';
import type { GiftDay, GiftDayGift } from '@/lib/api-types';
import { formatBitcoin, formatFiatDisplay, type FiatCode } from '@/lib/stats-money';

/** Props for {@link GiftDayTable}. */
export interface GiftDayTableProps {
  /** Per-day payload from `GET /gifts`. */
  day: GiftDay;
  /** Selected fiat for the fourth column. */
  fiat: FiatCode;
}

/**
 * `HH:MM:SS UTC` from an ISO-8601 instant.
 *
 * @param iso - Paid-at timestamp.
 * @returns Clock time in UTC.
 */
function formatUtcTime(iso: string): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) {
    return iso;
  }
  const hours = String(instant.getUTCHours()).padStart(2, '0');
  const minutes = String(instant.getUTCMinutes()).padStart(2, '0');
  const seconds = String(instant.getUTCSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds} UTC`;
}

/**
 * Selected fiat amount on one gift row.
 *
 * @param gift - Day gift.
 * @param fiat - Selected code.
 * @returns Two-decimal string, or `null` when unsummed.
 */
function giftFiat(gift: GiftDayGift, fiat: FiatCode): string | null {
  switch (fiat) {
    case 'USD':
      return gift.amountUsd;
    case 'CHF':
      return gift.amountChf;
    case 'EUR':
      return gift.amountEur;
    case 'PHP':
      return gift.amountPhp;
  }
}

/**
 * Table of individual outbound gifts on one UTC day.
 *
 * @param props - Day payload and selected fiat.
 * @returns A table, or the empty-day copy.
 */
export function GiftDayTable({ day, fiat }: GiftDayTableProps): ReactElement {
  if (day.gifts.length === 0) {
    return <p className="text-paper/60">No gifts recorded on this day.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{`Gifts on ${day.day}`}</caption>
        <thead>
          <tr className="border-b border-paper/15 text-paper/50">
            <th className="py-2 pr-4 font-medium">Time</th>
            <th className="py-2 pr-4 font-medium">Recipient</th>
            <th className="py-2 pr-4 font-medium">₿</th>
            <th className="py-2 font-medium">{fiat}</th>
          </tr>
        </thead>
        <tbody>
          {day.gifts.map((gift, index) => (
            <tr
              key={`${gift.paidAt}-${gift.recipient}-${gift.amountSats}-${index}`}
              className="border-b border-paper/10"
            >
              <td className="py-2 pr-4 whitespace-nowrap text-paper/80">
                <time dateTime={gift.paidAt}>{formatUtcTime(gift.paidAt)}</time>
              </td>
              <td className="py-2 pr-4 font-medium">{gift.recipient}</td>
              <td className="py-2 pr-4 tabular-nums">{formatBitcoin(gift.amountSats)}</td>
              <td className="py-2 tabular-nums text-paper/80">
                {formatFiatDisplay(giftFiat(gift, fiat), fiat)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
