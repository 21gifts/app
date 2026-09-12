import { cookies } from 'next/headers';
import {
  NUMBER_FORMAT_COOKIE,
  parseNumberFormat,
  type NumberFormatStyle,
} from '@/lib/number-format';

/**
 * Cookie `numberFormat` if it is a supported style; otherwise Swiss `ch`.
 * Never writes a cookie.
 *
 * Lives in its own module so client components can import
 * {@link NUMBER_FORMATS} from `@/lib/number-format` without pulling
 * `next/headers` into the browser bundle.
 *
 * @returns The number-format style for this request.
 */
export async function getRequestNumberFormat(): Promise<NumberFormatStyle> {
  const cookieStore = await cookies();
  return parseNumberFormat(cookieStore.get(NUMBER_FORMAT_COOKIE)?.value);
}
