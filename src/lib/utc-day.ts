/**
 * Whether `day` is a real UTC calendar date as `YYYY-MM-DD`.
 *
 * @param day - Candidate day string.
 * @returns `true` only for a valid calendar day.
 */
export function isUtcDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return false;
  }
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const date = Number(day.slice(8, 10));
  const instant = new Date(Date.UTC(year, month - 1, date));
  return (
    instant.getUTCFullYear() === year &&
    instant.getUTCMonth() === month - 1 &&
    instant.getUTCDate() === date
  );
}
