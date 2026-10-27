import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopList } from '@/components/ShopList';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import type { ShopListItem } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', () => ({
  fetchListedShops: vi.fn(),
}));

import { fetchListedShops } from '@/lib/api';

const fetchListedShopsMock = vi.mocked(fetchListedShops);

const NPUB = `npub1${'2'.repeat(58)}`;
const NPUB_2 = `npub1${'3'.repeat(58)}`;

const ADDRESS = {
  street: 'Bahnhofstrasse',
  houseNumber: '12',
  postalCode: '8001',
  city: 'Zürich',
  country: 'CH',
};

const SHOP: ShopListItem = {
  npub: NPUB,
  name: '  Cafe Luna  ',
  place: { lat: 14.6, lng: 120.98, label: 'Cafe Luna', address: ADDRESS },
};

const SHOP_2: ShopListItem = {
  npub: NPUB_2,
  name: 'North Stall',
  place: { lat: 14.61, lng: 120.99, label: 'North Stall', address: ADDRESS },
};

const PLACE_LINE = 'Cafe Luna · Bahnhofstrasse 12, 8001 Zürich, Switzerland';

afterEach(() => {
  cleanup();
  fetchListedShopsMock.mockReset();
  useAuthStore.setState({ session: null, account: null });
});

describe('ShopList', () => {
  it('links a shop by its trimmed name and shows the place line as text', async () => {
    fetchListedShopsMock.mockResolvedValue({ shops: [SHOP], nextCursor: null });
    renderWithLocale(<ShopList />);
    const link = await screen.findByRole('link', { name: 'Cafe Luna' });
    expect(link.getAttribute('href')).toBe(`/${NPUB}`);
    expect(link.className).toContain('underline');
    const place = screen.getByText(PLACE_LINE, { selector: 'p' });
    expect(place.closest('a')).toBeNull();
    expect(screen.queryByRole('link', { name: PLACE_LINE })).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(1);
    for (const item of screen.getAllByRole('link')) {
      const href = item.getAttribute('href') ?? '';
      expect(href.startsWith('/map')).toBe(false);
      expect(href.includes('/members/')).toBe(false);
    }
  });

  it('omits the place line when the shop has no pin', async () => {
    fetchListedShopsMock.mockResolvedValue({
      shops: [{ ...SHOP, place: null }],
      nextCursor: null,
    });
    renderWithLocale(<ShopList />);
    expect(await screen.findByRole('link', { name: 'Cafe Luna' })).toBeTruthy();
    expect(screen.queryByText(PLACE_LINE)).toBeNull();
  });

  it('fetches and renders a shop when no account is signed in', async () => {
    expect(useAuthStore.getState().session).toBeNull();
    fetchListedShopsMock.mockResolvedValue({ shops: [SHOP], nextCursor: null });
    renderWithLocale(<ShopList />);
    expect(await screen.findByRole('link', { name: 'Cafe Luna' })).toBeTruthy();
    expect(fetchListedShopsMock).toHaveBeenCalledTimes(1);
    expect(fetchListedShopsMock).toHaveBeenCalledWith();
  });

  it('shows the loading line until the first page arrives', async () => {
    let resolvePage: (page: { shops: ShopListItem[]; nextCursor: null }) => void = () => {};
    fetchListedShopsMock.mockReturnValue(
      new Promise((resolve) => {
        resolvePage = resolve;
      }),
    );
    renderWithLocale(<ShopList />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    resolvePage({ shops: [SHOP], nextCursor: null });
    expect(await screen.findByRole('link', { name: 'Cafe Luna' })).toBeTruthy();
  });

  it('shows the empty copy when the page is empty and has no next page', async () => {
    fetchListedShopsMock.mockResolvedValue({ shops: [], nextCursor: null });
    renderWithLocale(<ShopList />);
    expect(await screen.findByText('No shops yet — add the first one.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('keeps show more when an empty page still has a cursor', async () => {
    fetchListedShopsMock.mockResolvedValue({ shops: [], nextCursor: 'c2' });
    renderWithLocale(<ShopList />);
    expect(await screen.findByRole('button', { name: 'Show more' })).toBeTruthy();
    expect(screen.queryByText('No shops yet — add the first one.')).toBeNull();
  });

  it('shows the load error and retries the first page', async () => {
    fetchListedShopsMock.mockRejectedValueOnce(new Error('nope'));
    renderWithLocale(<ShopList />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Could not load shops. Please try again.')).toBeTruthy();
    fetchListedShopsMock.mockResolvedValueOnce({ shops: [SHOP], nextCursor: null });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Cafe Luna' })).toBeTruthy();
    expect(fetchListedShopsMock).toHaveBeenCalledTimes(2);
    expect(fetchListedShopsMock).toHaveBeenNthCalledWith(1);
    expect(fetchListedShopsMock).toHaveBeenNthCalledWith(2);
  });

  it('keeps the first shop and retries the same cursor after a later page fails', async () => {
    fetchListedShopsMock
      .mockResolvedValueOnce({ shops: [SHOP], nextCursor: 'c2' })
      .mockRejectedValueOnce(new Error('nope'))
      .mockResolvedValueOnce({ shops: [SHOP_2], nextCursor: null });
    renderWithLocale(<ShopList />);
    expect(await screen.findByRole('link', { name: 'Cafe Luna' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Could not load shops. Please try again.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cafe Luna' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(fetchListedShopsMock).toHaveBeenLastCalledWith('c2');
    });
    expect(await screen.findByRole('link', { name: 'North Stall' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Cafe Luna' })).toHaveLength(1);
    expect(fetchListedShopsMock).toHaveBeenNthCalledWith(2, 'c2');
    expect(fetchListedShopsMock).toHaveBeenNthCalledWith(3, 'c2');
  });

  it('appends the next page and does not duplicate the first shop', async () => {
    fetchListedShopsMock
      .mockResolvedValueOnce({ shops: [SHOP], nextCursor: 'c2' })
      .mockResolvedValueOnce({ shops: [SHOP_2], nextCursor: null });
    renderWithLocale(<ShopList />);
    expect(await screen.findByRole('link', { name: 'Cafe Luna' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(await screen.findByRole('link', { name: 'North Stall' })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: 'Cafe Luna' })).toHaveLength(1);
    expect(fetchListedShopsMock).toHaveBeenNthCalledWith(1);
    expect(fetchListedShopsMock).toHaveBeenNthCalledWith(2, 'c2');
  });

  it('ignores a response that arrives after unmount', async () => {
    let resolvePage: (page: { shops: ShopListItem[]; nextCursor: null }) => void = () => {};
    fetchListedShopsMock.mockReturnValue(
      new Promise((resolve) => {
        resolvePage = resolve;
      }),
    );
    const view = renderWithLocale(<ShopList />);
    view.unmount();
    resolvePage({ shops: [SHOP], nextCursor: null });
    await Promise.resolve();
    expect(screen.queryByRole('link', { name: 'Cafe Luna' })).toBeNull();
  });

  it('ignores an error that arrives after unmount', async () => {
    let rejectPage: (error: Error) => void = () => {};
    fetchListedShopsMock.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectPage = reject;
      }),
    );
    const view = renderWithLocale(<ShopList />);
    view.unmount();
    rejectPage(new Error('late'));
    await Promise.resolve();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
