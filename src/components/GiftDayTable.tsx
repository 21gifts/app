import type { ReactElement } from 'react';
import type { GiftDay } from '@/lib/api-types';
import { formatBitcoin } from '@/lib/stats-money';

/** Props for {@link GiftDayTable}. */
export interface GiftDayTableProps {
  /** Per-day payload from `GET /gifts`. */
  day: GiftDay;
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
            <th className="py-2 pr-4 font-medium">₿</th>
            <th className="py-2 font-medium">USD</th>
          </tr>
        </thead>
        <tbody>
          {day.gifts.map((gift, index) => (
            <tr
              key={`${gift.paidAt}-${gift.recipient}-${gift.amountSats}-${index}`}
              className="border-b border-white/10"
            >
              <td className="py-2 pr-4 whitespace-nowrap text-white/80">
                <time dateTime={gift.paidAt}>{formatUtcTime(gift.paidAt)}</time>
              </td>
              <td className="py-2 pr-4 font-medium">{gift.recipient}</td>
              <td className="py-2 pr-4 tabular-nums">{formatBitcoin(gift.amountSats)}</td>
              <td className="py-2 tabular-nums text-white/80">{gift.amountUsd}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
