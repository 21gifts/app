import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopTable } from '@/components/ShopTable';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import type { ForumMessage } from '@/lib/api-types';
import { MissingRequirementsError } from '@/lib/missing-requirements';
import { useAuthStore } from '@/stores/auth-store';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof replace; replace: typeof replace } => ({
    push: replace,
    replace,
  }),
}));

const linkPush = vi.hoisted(() => vi.fn());

// Like next/link: after the caller's onClick, an unprevented plain click is a
// client-side router push, not a document load.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
    [key: string]: unknown;
  }) => (
    <a
      href={href}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        event.preventDefault();
        linkPush(href);
      }}
    >
      {children}
    </a>
  ),
}));

vi.mock('@/lib/api', () => ({
  fetchMessages: vi.fn(),
  fetchShopNoteEdits: vi.fn(),
  fetchMessagePhoto: vi.fn(),
  setMessagePlace: vi.fn(),
  setMessageShopAccount: vi.fn(),
  setMessageShopPhotos: vi.fn(),
  setMessageShopText: vi.fn(),
}));

import { fetchMessages, fetchShopNoteEdits, setMessageShopText } from '@/lib/api';
import type { Account } from '@/lib/api-types';

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
  replace.mockClear();
  linkPush.mockReset();
  fetchMessagesMock.mockReset();
  useAuthStore.setState({ session: null, account: null });
});

describe('ShopTable', () => {
  it('opens setup when the account is not allowed to load the table', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchMessagesMock.mockRejectedValueOnce(new MissingRequirementsError(['rules']));
    renderWithLocale(<ShopTable />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/rules');
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('opens a place and an operator with client-side links', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchMessagesMock.mockResolvedValue({ messages: [SHOP], nextCursor: null });
    renderWithLocale(<ShopTable />);
    fireEvent.click(await screen.findByRole('link', { name: 'Happyland' }));
    expect(linkPush).toHaveBeenLastCalledWith('/shops?pin=m-shop#map');
    fireEvent.click(screen.getByRole('link', { name: '@luna' }));
    expect(linkPush).toHaveBeenLastCalledWith('/members/acc-luna');
  });

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
      '/shops?pin=m-shop#map',
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
    expect(screen.getByText('Cafe Luna')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(fetchMessagesMock).toHaveBeenLastCalledWith(
        'tok',
        expect.objectContaining({ cursor: 'c2', hashtag: '21GiftsShop' }),
      );
    });
    expect(await screen.findByText('Other stall')).toBeTruthy();
    expect(screen.getByText('Cafe Luna')).toBeTruthy();
  });

  it('keeps show more when an empty page still has a cursor', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchMessagesMock
      .mockResolvedValueOnce({ messages: [], nextCursor: 'c2' })
      .mockResolvedValueOnce({
        messages: [SHOP],
        nextCursor: null,
      });
    renderWithLocale(<ShopTable />);
    expect(await screen.findByRole('button', { name: 'Show more' })).toBeTruthy();
    expect(screen.queryByText('No shops yet — add the first one.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(await screen.findByText('Cafe Luna')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
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

  it('lets a moderator edit a row and leaves the other shop', async () => {
    const moderator = {
      id: 'acc',
      linkingKey: '02',
      role: 'moderator',
      name: 'Ada',
      location: null,
      lightningAddress: null,
      lightningAddressVerified: false,
      forumLawsDismissed: true,
      createdAt: 1,
      rulesAgreedAt: 1,
      viewKey: 'a'.repeat(64),
      aboutMe: null,
      aboutMeHasPhoto: false,
      setup: null,
      missing: [],
    } as Account;
    useAuthStore.setState({ session: 'tok', account: moderator });
    fetchMessagesMock.mockResolvedValue({
      messages: [SHOP, { ...SHOP, id: 'm-2', text: 'Other stall\n\n#21GiftsShop' }],
      nextCursor: null,
    });
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    vi.mocked(setMessageShopText).mockResolvedValue({
      ...SHOP,
      text: 'Cafe Sol\n\n#21GiftsShop',
    });
    renderWithLocale(<ShopTable />);
    const pencils = await screen.findAllByRole('button', { name: 'Edit shop note' });
    expect(pencils).toHaveLength(2);
    fireEvent.click(pencils[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: 'Cafe Sol' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Cafe Sol')).toBeTruthy();
    expect(screen.getByText('Other stall')).toBeTruthy();
  });
});
