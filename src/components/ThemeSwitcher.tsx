'use client';

import { type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { useTheme } from '@/components/ThemeProvider';
import { SegmentedControl } from '@/components/ui';

/**
 * Profile identity-card section: System / Light / Dark via SegmentedControl.
 *
 * Always visible on the signed-in Profile card. Not page chrome.
 *
 * @returns The theme settings section.
 */
export function ThemeSwitcher(): ReactElement {
  const { t } = useTranslations();
  const { preference, setPreference } = useTheme();

  return (
    <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
      <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
        {t('theme.label')}
      </p>
      <SegmentedControl
        tone="neutral"
        value={preference}
        options={[
          { value: 'system', label: t('theme.system') },
          { value: 'light', label: t('theme.light') },
          { value: 'dark', label: t('theme.dark') },
        ]}
        onChange={setPreference}
        ariaLabel={t('aria.theme')}
      />
    </div>
  );
}
