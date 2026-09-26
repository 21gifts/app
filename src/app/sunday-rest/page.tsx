import { redirect } from 'next/navigation';
import { isSundayRest } from '@/lib/sunday-rest';

/**
 * Empty destination rendered inside the root Sunday rest gate.
 * @returns No application content during rest; redirects home on weekdays.
 */
export default function SundayRestPage(): null {
  if (!isSundayRest(Date.now())) redirect('/');
  return null;
}
