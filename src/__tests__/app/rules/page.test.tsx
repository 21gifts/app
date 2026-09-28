import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RulesPage, { generateMetadata } from '@/app/rules/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

vi.mock('@/lib/request-locale', () => ({
  getRequestLocale: vi.fn(async () => 'en' as const),
}));

afterEach(cleanup);

describe('RulesPage', () => {
  it('publishes the canonical URL for the localized rules', async () => {
    expect(await generateMetadata()).toMatchObject({
      title: 'Living room rules | 21.gifts',
      alternates: { canonical: '/en/rules', languages: { de: '/de/rules' } },
    });
  });

  it('renders the page heading and the rules document', async () => {
    renderWithLocale(await RulesPage());
    expect(screen.getByRole('heading', { name: 'Living room rules', level: 1 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Only free donations' })).toBeTruthy();
  });

  it('renders the language switcher', async () => {
    renderWithLocale(await RulesPage());
    expect(screen.getByTestId('language-switcher')).toBeTruthy();
  });
});
