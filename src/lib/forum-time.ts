/**
 * Formats a forum message timestamp for display.
 *
 * Uses the runtime local timezone (the visitor's system timezone), not UTC.
 *
 * @param iso - ISO-8601 timestamp from the api.
 * @param locale - Active UI locale (BCP 47).
 * @returns Medium date + short time, or the original `iso` when the instant is invalid.
 */
export function formatForumTime(iso: string, locale: string): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(instant);
}
