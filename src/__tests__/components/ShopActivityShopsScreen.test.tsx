import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShopActivityShopsScreen } from '@/components/ShopActivityShopsScreen';
import type { Account, ShopActivityShops } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
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

vi.mock('@/lib/api', () => ({
  fetchShopActivityShops: vi.fn(),
}));

import { fetchShopActivityShops } from '@/lib/api';

const listMock = vi.mocked(fetchShopActivityShops);

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'moderator',
  name: 'Ada',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
};

const TABLE: ShopActivityShops = {
  windowDays: 30,
  today: '2026-11-14',
  shops: [
    {
      noteId: 'note_never',
      name: 'Bakery',
      npub: null,
      accountId: 'acc_bake',
      username: null,
      activeDays: 0,
      lastChargeDay: null,
    },
    {
      noteId: 'note_old',
      name: '  ',
      npub: 'npub1old',
      accountId: 'acc_old',
      username: 'oldtill',
      activeDays: 0,
      lastChargeDay: '2026-08-02',
    },
    {
      noteId: 'note_cafe',
      name: 'Corner Café',
      npub: 'npub1corner',
      accountId: 'acc_till',
      username: 'cornertill',
      activeDays: 12,
      lastChargeDay: '2026-11-13',
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  listMock.mockResolvedValue({ windowDays: 30, today: '2026-11-14', shops: [] });
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(cleanup);

describe('ShopActivityShopsScreen', () => {
  it('renders nothing when there is no session', () => {
    useAuthStore.setState({ session: null, account });
    const { container } = renderWithLocale(<ShopActivityShopsScreen />);
    expect(container.firstChild).toBeNull();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy below moderator and does not fetch', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'verified' } });
    renderWithLocale(<ShopActivityShopsScreen />);
    expect(screen.getByRole('heading', { name: 'Activity per shop' })).toBeTruthy();
    expect(screen.getByText('This page is for moderators.')).toBeTruthy();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy when the account is missing', () => {
    useAuthStore.setState({ session: 'sess', account: null });
    renderWithLocale(<ShopActivityShopsScreen />);
    expect(screen.getByText('This page is for moderators.')).toBeTruthy();
    expect(listMock).not.toHaveBeenCalled();
  });

  it('shows forbidden copy when the api answers 403', async () => {
    listMock.mockRejectedValueOnce(new Error('moderate.forbidden'));
    renderWithLocale(<ShopActivityShopsScreen />);
    expect(await screen.findByText('This page is for moderators.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('shows loading copy', () => {
    listMock.mockImplementation(() => new Promise(() => undefined));
    renderWithLocale(<ShopActivityShopsScreen />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.queryByText('No shops yet.')).toBeNull();
  });

  it('shows empty copy', async () => {
    renderWithLocale(<ShopActivityShopsScreen />);
    expect(await screen.findByText('No shops yet.')).toBeTruthy();
    expect(listMock).toHaveBeenCalledWith('sess');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('keeps the api order and marks shops without an active day', async () => {
    listMock.mockResolvedValue(TABLE);
    renderWithLocale(<ShopActivityShopsScreen />);
    const table = await screen.findByRole('table', { name: 'Activity per shop' });
    expect(
      screen.getByText(
        'POS charges by the till account of each shop in the last 30 UTC days. Shops without a charge in that window are marked inactive.',
      ),
    ).toBeTruthy();
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);
    expect(headers).toEqual(['Shop', 'Till account', 'Active days', 'Last charge']);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual([
      'Bakery',
      'Unnamed',
      'Corner Café',
    ]);

    const [never, old, cafe] = rows as [HTMLElement, HTMLElement, HTMLElement];
    expect(within(never).queryByRole('link')).toBeNull();
    expect(within(never).getByText('acc_bake')).toBeTruthy();
    expect(within(never).getByText('0 / 30')).toBeTruthy();
    expect(within(never).getByText('Inactive')).toBeTruthy();
    expect(within(never).getByText('Never')).toBeTruthy();

    expect(within(old).getByRole('link', { name: 'Unnamed' }).getAttribute('href')).toBe(
      '/npub1old',
    );
    expect(within(old).getByText('@oldtill')).toBeTruthy();
    expect(within(old).getByText('Inactive')).toBeTruthy();
    expect(within(old).getByText('Aug 2, 2026')).toBeTruthy();

    expect(within(cafe).getByRole('link', { name: 'Corner Café' }).getAttribute('href')).toBe(
      '/npub1corner',
    );
    expect(within(cafe).getByText('12 / 30')).toBeTruthy();
    expect(within(cafe).queryByText('Inactive')).toBeNull();
    expect(within(cafe).getByText('Nov 13, 2026')).toBeTruthy();
  });

  it('shows the error and retries', async () => {
    listMock.mockRejectedValueOnce(new Error('down'));
    renderWithLocale(<ShopActivityShopsScreen />);
    expect(await screen.findByText('Could not load shop activity. Please try again.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No shops yet.')).toBeTruthy();
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it('treats a non-Error rejection as a load error', async () => {
    listMock.mockRejectedValueOnce('down');
    renderWithLocale(<ShopActivityShopsScreen />);
    expect(await screen.findByText('Could not load shop activity. Please try again.')).toBeTruthy();
  });

  it('ignores a stale resolve after unmount', async () => {
    let resolveList: ((value: ShopActivityShops) => void) | undefined;
    listMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    const view = renderWithLocale(<ShopActivityShopsScreen />);
    view.unmount();
    await act(async () => {
      resolveList?.(TABLE);
      await Promise.resolve();
    });
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('ignores a stale reject after unmount', async () => {
    let rejectList: ((reason: Error) => void) | undefined;
    listMock.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectList = reject;
        }),
    );
    const view = renderWithLocale(<ShopActivityShopsScreen />);
    view.unmount();
    await act(async () => {
      rejectList?.(new Error('boom'));
      await Promise.resolve();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
