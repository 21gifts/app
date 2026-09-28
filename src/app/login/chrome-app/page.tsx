import type { ReactElement } from 'react';
import { AppShell } from '@/components/AppShell';
import { ChromeAppPasskeyScreen } from '@/components/ChromeAppPasskeyScreen';
import { HomeWordmark } from '@/components/HomeWordmark';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

/**
 * `/login/chrome-app` — why the installed Mac Chrome app shows a QR code.
 *
 * @returns The explanation screen.
 */
export default function ChromeAppPasskeyPage(): ReactElement {
  return (
    <AppShell
      mode="fill"
      align="center"
      topLeft={<HomeWordmark />}
      topRight={<LanguageSwitcher tone="light" />}
    >
      <ChromeAppPasskeyScreen />
    </AppShell>
  );
}
