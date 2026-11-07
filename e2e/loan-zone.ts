/** Zones spread across the date line, east first. */
const LOAN_ZONES = [
  'Pacific/Kiritimati',
  'Pacific/Auckland',
  'Asia/Tokyo',
  'Asia/Manila',
  'Europe/Berlin',
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Pacific/Honolulu',
  'Pacific/Pago_Pago',
  'Etc/GMT+12',
];

/**
 * Sunday rest refuses the loan writes when the browser zone is Sunday.
 * Pick the candidate with the most time left before its local Sunday.
 *
 * @param now - Instant to measure from, in epoch milliseconds.
 * @returns An IANA zone that is not Sunday, or `UTC` when every candidate is.
 */
export function loanTimeZone(now = Date.now()): string {
  let best = 'UTC';
  let bestHours = -1;
  for (const zone of LOAN_ZONES) {
    let hours = 168;
    try {
      for (let hour = 0; hour < 168; hour += 1) {
        const day = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short' }).format(
          now + hour * 60 * 60 * 1000,
        );
        if (day === 'Sun') {
          hours = hour;
          break;
        }
      }
    } catch {
      continue;
    }
    if (hours > bestHours) {
      best = zone;
      bestHours = hours;
    }
  }
  return best;
}
