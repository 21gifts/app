import type { ReactElement } from 'react';
import type { GiftDay } from '@/lib/api-types';

/** Props for {@link GiftDayTable}. */
export interface GiftDayTableProps {
  /** Per-day payload from `GET /gifts`. */
  day: GiftDay;
}

/**
 * Formats a sat count with grouping separators.
 *
 * @param sats - Whole satoshis.
 * @returns Grouped decimal string.
 */
function formatSats(sats: number): string {
  return new Intl.NumberFormat('en-US').format(sats);
}

/**
 * `HH:MM:SS UTC` from an ISO-8601 instant.
 *
 * @param iso - Paid-at timestamp.
 * @returns Clock time in UTC.
 */
function formatUtcTime(iso: string): string {
  const time = iso.slice(11, 19);
  return time.length === 8 ? `${time} UTC` : iso;
}

/**
 * Table of individual outbound gifts on one UTC day.
 *
 * @param props - Day payload.
 * @returns A table, or the empty-day copy.
 */
export function GiftDayTable({ day }: GiftDayTableProps): ReactElement {
  if (day.gifts.length === 0) {
    return <p className="text-white/60">No gifts recorded on this day.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <caption className="sr-only">{`Gifts on ${day.day}`}</caption>
        <thead>
          <tr className="border-b border-white/15 text-white/50">
            <th className="py-2 pr-4 font-medium">Time</th>
            <th className="py-2 pr-4 font-medium">Recipient</th>
            <th className="py-2 pr-4 font-medium">Sats</th>
            <th className="py-2 pr-4 font-medium">BTC</th>
            <th className="py-2 font-medium">USD</th>
          </tr>
        </thead>
        <tbody>
          {day.gifts.map((gift) => (
            <tr key={`${gift.paidAt}-${gift.recipient}`} className="border-b border-white/10">
              <td className="py-2 pr-4 whitespace-nowrap text-white/80">
                <time dateTime={gift.paidAt}>{formatUtcTime(gift.paidAt)}</time>
              </td>
              <td className="py-2 pr-4 font-medium">{gift.recipient}</td>
              <td className="py-2 pr-4 tabular-nums">{formatSats(gift.amountSats)}</td>
              <td className="py-2 pr-4 tabular-nums text-white/80">{gift.amountBtc}</td>
              <td className="py-2 tabular-nums text-white/80">{gift.amountUsd}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
