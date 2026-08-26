'use client';

import type { ReactElement } from 'react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { LogoutButton } from '@/components/LogoutButton';

/**
 * Top-right signed-in page chrome: language select and log out as one control
 * with a shared border and divider.
 *
 * @returns The combined language and log-out control.
 */
export function SignedInChrome(): ReactElement {
  return (
    <div className="absolute top-4 right-5 flex items-stretch overflow-hidden rounded-md border border-neutral-300">
      <LanguageSwitcher tone="light" embedded />
      <span aria-hidden="true" className="w-px self-stretch bg-neutral-300" />
      <LogoutButton />
    </div>
  );
}
