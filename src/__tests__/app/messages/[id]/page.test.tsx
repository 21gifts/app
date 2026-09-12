import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PublicMessagePage from '@/app/messages/[id]/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/PublicMessageLoader', () => ({
  PublicMessageLoader: ({ id }: { id: string }) => (
    <div data-testid="public-message-loader">{id}</div>
  ),
}));

vi.mock('@/components/LanguageSwitcher', () => ({
  LanguageSwitcher: ({ tone }: { tone?: string }) => (
    <div data-testid="language-switcher">{tone}</div>
  ),
}));

afterEach(cleanup);

describe('PublicMessagePage', () => {
  it('renders the language switcher and passes id to the loader', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    renderWithLocale(await PublicMessagePage({ params: Promise.resolve({ id }) }));
    expect(screen.getByTestId('language-switcher').textContent).toBe('light');
    expect(screen.getByTestId('public-message-loader').textContent).toBe(id);
  });
});
