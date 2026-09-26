import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopTable } from '@/components/ShopTable';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import type { ForumMessage } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';

vi.mock('@/lib/api', () => ({
  fetchMessages: vi.fn(),
}));

import { fetchMessages } from '@/lib/api';

const fetchMessagesMock = vi.mocked(fetchMessages);

const SHOP: ForumMessage = {
  id: 'm-shop',
  name: 'Ada',
  text: 'Cafe Luna\n\n#21GiftsShop',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 5,
  payable: true,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
  replyCount: 0,
  place: { lat: 14.6, lng: 120.98, label: 'Happyland' },
  shopAccount: { id: 'acc-luna', username: 'luna', name: 'Luna' },
};

afterEach(() => {
  cleanup();
  useAuthStore.setState({ session: null, account: null });
});

describe('ShopTable', () => {
  it('returns nothing without a session', () => {
    const { container } = renderWithLocale(<ShopTable />);
    expect(container.textContent).toBe('');
    expect(fetchMessagesMock).not.toHaveBeenCalled();
  });

  it('lists name, place, and operator, and an em dash when they are missing', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchMessagesMock.mockResolvedValue({
      messages: [
        SHOP,
        { ...SHOP, id: 'm-plain', text: '#21GiftsShop', place: undefined, shopAccount: undefined },
        { ...SHOP, id: 'm-coord', place: { lat: 1, lng: 2, label: null } },
        { ...SHOP, id: 'm-room', text: 'Hello' },
      ],
      nextCursor: 'c2',
    });
    renderWithLocale(<ShopTable />);
    expect(await screen.findByRole('link', { name: 'Happyland' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Happyland' }).getAttribute('href')).toBe(
      '/map?pin=m-shop',
    );
    expect(screen.getAllByRole('link', { name: '@luna' })[0]?.getAttribute('href')).toBe(
      '/members/acc-luna',
    );
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getByRole('link', { name: '1.00000, 2.00000' })).toBeTruthy();
    expect(screen.queryByText('Hello')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() => {
      expect(fetchMessagesMock).toHaveBeenCalledWith(
        'tok',
        expect.objectContaining({ cursor: 'c2', hashtag: '21GiftsShop' }),
      );
    });
  });

  it('retries a failed show more', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchMessagesMock
      .mockResolvedValueOnce({ messages: [SHOP], nextCursor: 'c2' })
      .mockRejectedValueOnce(new Error('nope'))
      .mockResolvedValueOnce({
        messages: [{ ...SHOP, id: 'm-2', text: 'Other stall\n\n#21GiftsShop' }],
        nextCursor: null,
      });
    renderWithLocale(<ShopTable />);
    expect(await screen.findByText('Cafe Luna')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Other stall')).toBeTruthy();
  });

  it('hides show more when the page is the last one', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchMessagesMock.mockResolvedValue({ messages: [SHOP], nextCursor: null });
    renderWithLocale(<ShopTable />);
    expect(await screen.findByText('Cafe Luna')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('ignores a response that arrives after unmount', async () => {
    useAuthStore.setState({ session: 'tok' });
    let resolvePage: (page: { messages: ForumMessage[]; nextCursor: null }) => void = () => {};
    fetchMessagesMock.mockReturnValue(
      new Promise((resolve) => {
        resolvePage = resolve;
      }),
    );
    const view = renderWithLocale(<ShopTable />);
    view.unmount();
    resolvePage({ messages: [SHOP], nextCursor: null });
    await Promise.resolve();
    expect(screen.queryByText('Cafe Luna')).toBeNull();
  });

  it('ignores an error that arrives after unmount', async () => {
    useAuthStore.setState({ session: 'tok' });
    let rejectPage: (error: Error) => void = () => {};
    fetchMessagesMock.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectPage = reject;
      }),
    );
    const view = renderWithLocale(<ShopTable />);
    view.unmount();
    rejectPage(new Error('late'));
    await Promise.resolve();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the empty copy and retries after an error', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchMessagesMock.mockRejectedValueOnce(new Error('nope'));
    renderWithLocale(<ShopTable />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    fetchMessagesMock.mockResolvedValueOnce({ messages: [], nextCursor: null });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No shops yet — add the first one.')).toBeTruthy();
  });
});
