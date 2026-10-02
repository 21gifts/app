import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ExternalAuthorPage from '@/app/messages/[id]/author/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/ExternalAuthorProfile', () => ({
  ExternalAuthorProfile: ({
    messageId,
    fallbackName,
  }: {
    messageId: string;
    fallbackName: string;
  }) => (
    <div data-testid="external-author-profile">
      {messageId}:{fallbackName}
    </div>
  ),
}));

vi.mock('@/components/LanguageSwitcher', () => ({
  LanguageSwitcher: ({ tone }: { tone?: string }) => (
    <div data-testid="language-switcher">{tone}</div>
  ),
}));

const MESSAGE_ID = '11111111-1111-4111-8111-111111111111';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ExternalAuthorPage', () => {
  it('passes a string name as the fallback and shows the language switcher', async () => {
    renderWithLocale(
      await ExternalAuthorPage({
        params: Promise.resolve({ id: MESSAGE_ID }),
        searchParams: Promise.resolve({ name: 'Robin' }),
      }),
    );
    expect(screen.getByTestId('language-switcher').textContent).toBe('light');
    expect(screen.getByTestId('external-author-profile').textContent).toBe(`${MESSAGE_ID}:Robin`);
  });

  it('passes the first array name entry as the fallback', async () => {
    renderWithLocale(
      await ExternalAuthorPage({
        params: Promise.resolve({ id: MESSAGE_ID }),
        searchParams: Promise.resolve({ name: ['Ada', 'Bob'] }),
      }),
    );
    expect(screen.getByTestId('external-author-profile').textContent).toBe(`${MESSAGE_ID}:Ada`);
  });

  it('passes an empty fallback when name is omitted', async () => {
    renderWithLocale(
      await ExternalAuthorPage({
        params: Promise.resolve({ id: MESSAGE_ID }),
        searchParams: Promise.resolve({}),
      }),
    );
    expect(screen.getByTestId('external-author-profile').textContent).toBe(`${MESSAGE_ID}:`);
  });

  it('trims a whitespace-only name to an empty fallback', async () => {
    renderWithLocale(
      await ExternalAuthorPage({
        params: Promise.resolve({ id: MESSAGE_ID }),
        searchParams: Promise.resolve({ name: '   ' }),
      }),
    );
    expect(screen.getByTestId('external-author-profile').textContent).toBe(`${MESSAGE_ID}:`);
  });

  it('passes an empty fallback when the name array is empty', async () => {
    renderWithLocale(
      await ExternalAuthorPage({
        params: Promise.resolve({ id: MESSAGE_ID }),
        searchParams: Promise.resolve({ name: [] }),
      }),
    );
    expect(screen.getByTestId('external-author-profile').textContent).toBe(`${MESSAGE_ID}:`);
  });
});
