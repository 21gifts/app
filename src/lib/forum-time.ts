/**
 * Formats a forum message timestamp for display.
 *
 * Always uses UTC so Playwright screenshots do not depend on the host timezone.
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
    timeZone: 'UTC',
  }).format(instant);
}
