import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import ChromeAppPasskeyPage from '@/app/login/chrome-app/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

afterEach(cleanup);

describe('ChromeAppPasskeyPage', () => {
  it('renders the explanation', () => {
    renderWithLocale(<ChromeAppPasskeyPage />);
    expect(screen.getByRole('heading', { name: 'Passkey in the Chrome app' })).toBeTruthy();
    expect(
      screen.getByText(/Touch ID on this Mac is not offered in the installed Chrome app/),
    ).toBeTruthy();
  });
});
