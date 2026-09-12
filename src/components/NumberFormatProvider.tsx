'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { NUMBER_FORMAT_COOKIE, type NumberFormatStyle } from '@/lib/number-format';

/** Value exposed by {@link NumberFormatProvider} / {@link useNumberFormat}. */
export interface NumberFormatContextValue {
  /** Active grouping style (`ch` when the cookie is absent or invalid). */
  numberFormat: NumberFormatStyle;
  /**
   * Persist a new style. Writes `numberFormat=<id>` with Path=/, Max-Age=1y,
   * SameSite=Lax (`Secure` on https). Same-id is a no-op when the cookie is
   * already set to `next`; selecting `ch` while the cookie is absent still writes.
   *
   * @param next - Style the visitor chose.
   */
  setNumberFormat: (next: NumberFormatStyle) => void;
}

const NumberFormatContext = createContext<NumberFormatContextValue | null>(null);

/**
 * Reads the number-format cookie value from `document.cookie`.
 *
 * @returns Raw cookie value, or `undefined` when absent or malformed.
 */
function readNumberFormatCookie(): string | undefined {
  const match = document.cookie.match(/(?:^|; )numberFormat=([^;]*)/);
  if (match === null || match[1] === undefined) {
    return undefined;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return undefined;
  }
}

/**
 * Writes the number-format cookie.
 *
 * @param next - Style to persist.
 */
function writeNumberFormatCookie(next: NumberFormatStyle): void {
  const secure = globalThis.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${NUMBER_FORMAT_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

/**
 * Provides the visitor number-format style and a setter that writes the cookie.
 *
 * @param props - Server-negotiated `initial` style and children.
 * @returns Provider element wrapping `children`.
 */
export function NumberFormatProvider(props: {
  initial: NumberFormatStyle;
  children: ReactNode;
}): ReactElement {
  const { initial, children } = props;
  const [numberFormat, setNumberFormatState] = useState<NumberFormatStyle>(initial);

  const setNumberFormat = useCallback(
    (next: NumberFormatStyle): void => {
      if (next === numberFormat && readNumberFormatCookie() === next) {
        return;
      }
      setNumberFormatState(next);
      writeNumberFormatCookie(next);
    },
    [numberFormat],
  );

  const value = useMemo<NumberFormatContextValue>(
    () => ({
      numberFormat,
      setNumberFormat,
    }),
    [numberFormat, setNumberFormat],
  );

  return <NumberFormatContext.Provider value={value}>{children}</NumberFormatContext.Provider>;
}

/**
 * Reads number-format style and setter from the nearest {@link NumberFormatProvider}.
 *
 * @returns Number-format context value.
 * @throws If used outside {@link NumberFormatProvider}.
 */
export function useNumberFormat(): NumberFormatContextValue {
  const context = useContext(NumberFormatContext);
  if (context === null) {
    throw new Error('useNumberFormat must be used within NumberFormatProvider');
  }
  return context;
}
