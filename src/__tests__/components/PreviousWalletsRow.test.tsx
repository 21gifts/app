import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreviousWalletsRow } from '@/components/PreviousWalletsRow';
import { usePreviousWallets, type UsePreviousWalletsResult } from '@/hooks/usePreviousWallets';
import { useSpotRate } from '@/hooks/useSpotRate';
import type { PreviousWallet } from '@/lib/api-types';
import { spotRateDay } from '@/lib/stats-money';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@/hooks/usePreviousWallets', () => ({ usePreviousWallets: vi.fn() }));
vi.mock('@/hooks/useSpotRate', () => ({ useSpotRate: vi.fn() }));

const KEY_FULL = `02${'a'.repeat(64)}`;
const KEY_EMPTY = `03${'b'.repeat(64)}`;
const KEY_UNKNOWN = `02${'c'.repeat(64)}`;

/** Three previous wallets: a balance, an empty one, and one the explorer could not read. */
const WALLETS: PreviousWallet[] = [
  {
    sparkPubkey: KEY_FULL,
    sparkAddress: 'spark1a',
    replacedAt: 1_767_268_800_000,
    balanceSats: 21_000,
  },
  {
    sparkPubkey: KEY_EMPTY,
    sparkAddress: 'spark1b',
    replacedAt: 1_764_590_400_000,
    balanceSats: 0,
  },
  {
    sparkPubkey: KEY_UNKNOWN,
    sparkAddress: 'spark1c',
    replacedAt: 1_761_998_400_000,
    balanceSats: null,
  },
];

const retry = vi.fn();
const scrollIntoView = vi.fn();
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

/**
 * Sets what the hook answers.
 *
 * @param status - Load status.
 * @param wallets - The wallets.
 */
function answer(status: UsePreviousWalletsResult['status'], wallets: PreviousWallet[] = []): void {
  vi.mocked(usePreviousWallets).mockReturnValue({ status, wallets, retry });
}

beforeEach(() => {
  retry.mockReset();
  scrollIntoView.mockReset();
  HTMLElement.prototype.scrollIntoView = scrollIntoView;
  vi.mocked(useSpotRate).mockReturnValue(spotRateDay({ USD: '100000.00' }));
});

afterEach(() => {
  cleanup();
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  window.history.replaceState(null, '', '/');
});

describe('PreviousWalletsRow', () => {
  it.each([
    ['while loading', 'loading' as const],
    ['for an empty list', 'ready' as const],
  ])('renders nothing %s', (_label, status) => {
    answer(status);
    const { container } = renderWithLocale(<PreviousWalletsRow />);
    expect(container.innerHTML).toBe('');
    expect(useSpotRate).toHaveBeenLastCalledWith(false);
  });

  it('shows the load error with Try again', () => {
    answer('error');
    renderWithLocale(<PreviousWalletsRow />);
    const row = document.getElementById('previous-wallets') as HTMLElement;
    expect(row.className).toContain('border-t');
    expect(within(row).getByText('Previous wallets')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Previous wallets could not be loaded.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('lists each wallet with its day, its explorer balance, and one transfer link', () => {
    answer('ready', WALLETS);
    renderWithLocale(<PreviousWalletsRow />);
    expect(useSpotRate).toHaveBeenLastCalledWith(true);
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]?.textContent).toContain('Replaced on Jan 1, 2026');
    expect(items[0]?.textContent).toContain("₿21'000 · $21.00");
    expect(items[1]?.textContent).toContain('Replaced on Dec 1, 2025');
    expect(within(items[1] as HTMLElement).getByText('Empty')).toBeTruthy();
    expect(within(items[2] as HTMLElement).getByText('Balance unknown')).toBeTruthy();
    const links = screen.getAllByRole('link', { name: 'Transfer remaining balance' });
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `/settings/previous-wallets/${KEY_FULL}`,
      `/settings/previous-wallets/${KEY_EMPTY}`,
      `/settings/previous-wallets/${KEY_UNKNOWN}`,
    ]);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/Remove/)).toBeNull();
    expect(document.body.textContent).not.toContain('spark1');
    expect(document.body.textContent).not.toContain(KEY_FULL);
  });

  it('shows bitcoin alone while the spot rate is not loaded', () => {
    vi.mocked(useSpotRate).mockReturnValue(null);
    answer('ready', [WALLETS[0] as PreviousWallet]);
    renderWithLocale(<PreviousWalletsRow />);
    const item = screen.getByRole('listitem');
    expect(item.textContent).toContain("₿21'000");
    expect(item.textContent).not.toContain('$');
  });

  it('formats the day in the UI language', () => {
    answer('ready', [WALLETS[2] as PreviousWallet]);
    renderWithLocale(<PreviousWalletsRow />, 'de');
    expect(screen.getByText('Ersetzt am 01.11.2025')).toBeTruthy();
    expect(screen.getByText('Guthaben unbekannt')).toBeTruthy();
  });

  it('scrolls itself into view once loaded when the hash names it', () => {
    window.history.replaceState(null, '', '/settings#previous-wallets');
    answer('loading');
    const view = renderWithLocale(<PreviousWalletsRow />);
    expect(scrollIntoView).not.toHaveBeenCalled();
    answer('ready', WALLETS);
    view.rerender(<PreviousWalletsRow />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('previous-wallets'));
    answer('error');
    view.rerender(<PreviousWalletsRow />);
    answer('ready', WALLETS);
    view.rerender(<PreviousWalletsRow />);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it.each(['', '#recovery'])('does not scroll with the hash %j', (hash) => {
    window.history.replaceState(null, '', `/settings${hash}`);
    answer('ready', WALLETS);
    renderWithLocale(<PreviousWalletsRow />);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
