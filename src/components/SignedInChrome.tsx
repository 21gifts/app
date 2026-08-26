import type { ReactElement } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LogoutButton } from '@/components/LogoutButton';

/**
 * Top-right signed-in page chrome: language and log out as matching icon+text actions.
 *
 * @returns The language and log-out chrome.
 */
export function SignedInChrome(): ReactElement {
  return (
    <div className="absolute top-4 right-5 flex items-center gap-5">
      <LanguageSwitcher tone="light" embedded />
      <LogoutButton />
    </div>
  );
}
