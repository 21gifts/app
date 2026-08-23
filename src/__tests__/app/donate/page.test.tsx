import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DonatePage from '@/app/donate/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/DonateForm', () => ({
  DonateForm: () => <div>donate-form</div>,
}));

vi.mock('@/components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

vi.mock('@/lib/request-locale', () => ({
  getRequestLocale: vi.fn(async () => 'en' as const),
}));

afterEach(cleanup);

describe('DonatePage', () => {
  it('renders the page heading and the donate form', async () => {
    renderWithLocale(await DonatePage());
    expect(screen.getByRole('heading', { name: 'Send a gift' })).toBeTruthy();
    expect(screen.getByText('donate-form')).toBeTruthy();
  });

  it('renders the language switcher', async () => {
    renderWithLocale(await DonatePage());
    expect(screen.getByTestId('language-switcher')).toBeTruthy();
  });
});
