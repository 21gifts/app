import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import RepaymentListPage from '@/app/messages/[id]/repayment-list/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/CreditLedger', () => ({
  CreditLedger: ({ messageId, list }: { messageId: string; list?: string }) => (
    <div data-testid="credit-ledger">
      {messageId}:{list}
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

describe('RepaymentListPage', () => {
  it('shows the day list for that note inside the public chrome', async () => {
    renderWithLocale(
      await RepaymentListPage({
        params: Promise.resolve({ id: MESSAGE_ID }),
      }),
    );
    expect(screen.getByTestId('credit-ledger').textContent).toBe(`${MESSAGE_ID}:page`);
    expect(screen.getByTestId('language-switcher').textContent).toBe('light');
    expect(screen.getAllByRole('link', { name: 'Back to the forum' })).toHaveLength(1);
  });
});
