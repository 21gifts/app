import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WalletPanelView } from '@/components/WalletPanelView';
import type { UseWalletSendResult } from '@/hooks/useWalletSend';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/WalletReceive', () => ({
  WalletReceive: () => <p>Receive stub</p>,
}));

vi.mock('@/components/WalletSend', () => ({
  WalletSend: ({ manualEntry }: { manualEntry: boolean }) => (
    <p>{manualEntry ? 'Send stub manual' : 'Send stub'}</p>
  ),
}));

afterEach(cleanup);

const SEND = {} as UseWalletSendResult;

describe('WalletPanelView', () => {
  it('renders Receive under a screen-reader Wallet heading', () => {
    renderWithLocale(
      <WalletPanelView
        panel="receive"
        send={undefined}
        manualEntry={false}
        onManualEntry={vi.fn()}
      />,
    );
    expect(screen.getByText('Receive stub')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Wallet' }).className).toContain('sr-only');
  });

  it('renders Send with the manual-entry state, or nothing without a send flow', () => {
    const view = renderWithLocale(
      <WalletPanelView panel="send" send={SEND} manualEntry onManualEntry={vi.fn()} />,
    );
    expect(screen.getByText('Send stub manual')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Wallet' })).toBeTruthy();
    view.rerender(
      <WalletPanelView panel="send" send={undefined} manualEntry={false} onManualEntry={vi.fn()} />,
    );
    expect(screen.queryByText('Send stub')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Wallet' })).toBeNull();
  });

  it('moves the focus to the view heading when it opens', () => {
    renderWithLocale(
      <WalletPanelView
        panel="receive"
        send={undefined}
        manualEntry={false}
        onManualEntry={vi.fn()}
      />,
    );
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Wallet' }));
  });
});
