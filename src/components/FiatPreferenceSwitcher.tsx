'use client';

import { type ReactElement } from 'react';
import { FiatPicker } from '@/components/FiatPicker';
import { useFiatPreference } from '@/components/FiatPreferenceProvider';
import { useTranslations } from '@/components/LocaleProvider';

/**
 * Profile identity-card section: preferred fiat via {@link FiatPicker}.
 *
 * Always visible on the signed-in Profile card. Not page chrome. The only
 * place the visitor can change CHF | EUR | USD | PHP; other screens read
 * {@link useFiatPreference}.
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
        onChange={setFiat}
        shell="app"
        ariaLabel={t('profile.fiatCurrency')}
      />
    </div>
  );
}
