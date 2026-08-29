import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RulesPage from '@/app/rules/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/LanguageSwitcher', () => ({
  LanguageSwitcher: () => <div data-testid="language-switcher" />,
}));

vi.mock('@/lib/request-locale', () => ({
  getRequestLocale: vi.fn(async () => 'en' as const),
}));

afterEach(cleanup);

describe('RulesPage', () => {
  it('renders the page heading and the rules document', async () => {
    renderWithLocale(await RulesPage());
    expect(screen.getByRole('heading', { name: 'Living room rules', level: 1 })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '1. Only free donations' })).toBeTruthy();
  });

  it('renders the language switcher', async () => {
    renderWithLocale(await RulesPage());
    expect(screen.getByTestId('language-switcher')).toBeTruthy();
  });
});
