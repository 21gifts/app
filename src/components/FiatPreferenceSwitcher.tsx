'use client';

import { type ReactElement } from 'react';
import { FiatPicker } from '@/components/FiatPicker';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';
import { setAccountFiat } from '@/lib/api';
import { bumpFiatGeneration, fiatGeneration } from '@/lib/preference-generation';
import { loadSession } from '@/lib/session-storage';
import type { FiatCode } from '@/lib/stats-money';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Persists an explicit fiat choice to the account before writing its cookie.
 *
 * @param next - Fiat code the visitor chose.
 * @param current - Fiat code currently active in the tree.
 * @param setFiat - Context setter that writes the cookie.
 */
async function persistFiat(
  next: FiatCode,
  current: FiatCode,
  setFiat: (next: FiatCode) => void,
): Promise<void> {
  if (next === current) {
    return;
  }
  const session = loadSession();
  if (session !== null) {
    const generation = bumpFiatGeneration();
    try {
      const updated = await setAccountFiat(session, next, false);
      if (fiatGeneration() !== generation) {
        return;
      }
      const current = useAuthStore.getState().account;
      if (current !== null && current.id !== updated.id) {
        return;
      }
      if (current !== null) {
        useAuthStore.getState().setAccount({ ...current, fiat: updated.fiat });
      }
    } catch {
      return;
    }
  }
  setFiat(next);
}

/**
 * Profile identity-card section: preferred fiat via {@link FiatPicker}.
 *
 * Always visible on the signed-in Profile card. Not page chrome. The only
 * signed-in control that writes the `fiat` cookie. Unsigned chart, stats, and
 * day FiatPickers still write that cookie. Forum and the pay sheet only display
 * that code.
 *
 * @returns The fiat settings section.
 */
export function FiatPreferenceSwitcher(): ReactElement {
  const { t } = useTranslations();
  const { fiat, setFiat } = useFiatPreference();

  return (
    <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
      <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
        {t('profile.fiatCurrency')}
      </p>
      <FiatPicker
        value={fiat}
        onChange={(next) => {
          void persistFiat(next, fiat, setFiat);
        }}
        shell="app"
        tone="neutral"
        ariaLabel={t('profile.fiatCurrency')}
      />
    </div>
  );
}
