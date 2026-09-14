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
import { FIAT_COOKIE, type FiatCode } from '@/lib/stats-money';

/** Value exposed by {@link FiatPreferenceProvider} / {@link useFiatPreference}. */
export interface FiatPreferenceContextValue {
  /** Active fiat (cookie when set, otherwise locale default). */
  fiat: FiatCode;
  /**
   * Persist a new code. Writes `fiat=<code>` with Path=/, Max-Age=1y,
   * SameSite=Lax (`Secure` on https). Same-code is a no-op when the cookie is
   * already set to `next`.
   *
   * @param next - Code the visitor chose on Profile.
   */
  setFiat: (next: FiatCode) => void;
}

const FiatPreferenceContext = createContext<FiatPreferenceContextValue | null>(null);

/**
 * Reads the fiat cookie value from `document.cookie`.
 *
 * @returns Raw cookie value, or `undefined` when absent or malformed.
 */
function readFiatCookie(): string | undefined {
  const match = document.cookie.match(/(?:^|; )fiat=([^;]*)/);
  if (match === null) {
    return undefined;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return undefined;
  }
}

/**
 * Writes the fiat cookie.
 *
 * @param next - Code to persist.
 */
function writeFiatCookie(next: FiatCode): void {
  const secure = globalThis.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${FIAT_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

/**
 * Provides the visitor fiat preference and a setter that writes the cookie.
 *
 * @param props - Server-negotiated `initial` code and children.
 * @returns Provider element wrapping `children`.
 */
export function FiatPreferenceProvider(props: {
  initial: FiatCode;
  children: ReactNode;
}): ReactElement {
  const { initial, children } = props;
  const [fiat, setFiatState] = useState<FiatCode>(initial);

  const setFiat = useCallback(
    (next: FiatCode): void => {
      if (next === fiat && readFiatCookie() === next) {
        return;
      }
      setFiatState(next);
      writeFiatCookie(next);
    },
    [fiat],
  );

  const value = useMemo<FiatPreferenceContextValue>(
    () => ({
      fiat,
      setFiat,
    }),
    [fiat, setFiat],
  );

  return <FiatPreferenceContext.Provider value={value}>{children}</FiatPreferenceContext.Provider>;
}

/**
 * Reads fiat preference and setter from the nearest {@link FiatPreferenceProvider}.
 *
 * @returns Fiat preference context value.
 * @throws If used outside {@link FiatPreferenceProvider}.
 */
export function useFiatPreference(): FiatPreferenceContextValue {
  const context = useContext(FiatPreferenceContext);
  if (context === null) {
    throw new Error('useFiatPreference must be used within FiatPreferenceProvider');
  }
  return context;
}
