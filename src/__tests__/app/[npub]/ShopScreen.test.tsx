import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { ShopScreen } from '@/app/[npub]/ShopScreen';
import type { Shop } from '@/lib/api-types';
import { profileQrLogo } from '@/lib/profile-qr-logo';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { refresh: typeof refresh } => ({ refresh }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/components/QrCode', () => ({
  QrCode: ({ label, logo }: { label: string; logo?: string }) => (
    <div role="img" aria-label={label} data-logo={logo ?? ''} />
  ),
}));

vi.mock('@/components/GoogleMapCanvas', () => ({
  GoogleMapCanvas: ({ testId }: { testId: string }) => <div data-testid={testId} />,
}));

const NPUB = `npub1${'2'.repeat(58)}`;
const SHOP: Shop = {
  npub: NPUB,
  messageId: '11111111-1111-4111-8111-111111111111',
  name: 'Cafe Luna',
  description: 'Coffee, gifts, and moonlight.',
  place: {
    lat: 47.37,
    lng: 8.54,
    label: 'Old Town',
    address: {
      street: 'Moon Street',
      houseNumber: '21',
      postalCode: '8000',
      city: 'Zurich',
      country: 'CH',
    },
  },
  photos: [{ url: 'https://api.21.gifts/messages/111/photo.jpg', width: 1280, height: 960 }],
  payUsername: 'luna',
  nip05: 'luna@21.gifts',
  createdAt: '2026-08-28T12:00:00.000Z',
};

function jsonResponse(body: unknown): Response {
  return { json: () => Promise.resolve(body) } as Response;
}

afterEach(() => {
  cleanup();
  refresh.mockClear();
  vi.unstubAllGlobals();
});

describe('ShopScreen', () => {
  it('shows the public shop content and keeps the map hidden without a key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: null })));
    renderWithLocale(<ShopScreen state="ready" shop={SHOP} />);
    expect(screen.getByRole('heading', { name: 'Cafe Luna' })).toBeTruthy();
    expect(screen.getByText('Coffee, gifts, and moonlight.')).toBeTruthy();
    expect(screen.getByAltText('Photo from Cafe Luna')).toBeTruthy();
    expect(screen.getByText('Old Town')).toBeTruthy();
    expect(screen.getByText('Moon Street 21')).toBeTruthy();
    expect(screen.getByText('8000 Zurich')).toBeTruthy();
    expect(screen.getByText('CH')).toBeTruthy();
    expect(screen.queryByTestId('shop-map')).toBeNull();
    expect(screen.getByRole('link', { name: 'View forum note' }).getAttribute('href')).toBe(
      `/messages/${SHOP.messageId}`,
    );
    expect(screen.getByText('luna@21.gifts', { selector: 'p.break-all' })).toBeTruthy();
    expect(screen.getByText(NPUB)).toBeTruthy();
    expect(await screen.findByRole('img', { name: 'Open CryptoPay QR code' })).toBeTruthy();
  });

  it('shows the payment address under the heading and the profile QR logo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: null })));
    renderWithLocale(<ShopScreen state="ready" shop={SHOP} />);
    const heading = screen.getByRole('heading', { name: '21.gifts address' });
    const address = screen.getByText('luna@21.gifts', { selector: 'p.font-mono' });
    expect(heading.nextElementSibling).toBe(address);
    const qr = await screen.findByRole('img', { name: 'Open CryptoPay QR code' });
    expect(qr.getAttribute('data-logo')).toBe(profileQrLogo);
  });

  it('draws the one-shop map only after a non-empty maps key loads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: ' browser-key ' })));
    renderWithLocale(<ShopScreen state="ready" shop={SHOP} />);
    expect(await screen.findByTestId('shop-map')).toBeTruthy();
  });

  it('treats every missing or blank maps key shape as no map', async () => {
    for (const body of [21, null, {}, { key: null }, { key: '   ' }]) {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body));
      vi.stubGlobal('fetch', fetchMock);
      const view = renderWithLocale(<ShopScreen state="ready" shop={SHOP} />);
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/maps/key');
      });
      expect(screen.queryByTestId('shop-map')).toBeNull();
      view.unmount();
    }
  });

  it('ignores a maps key that settles after the shop screen unmounts', async () => {
    let resolveFetch: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const view = renderWithLocale(<ShopScreen state="ready" shop={SHOP} />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/maps/key');
    });
    view.unmount();
    resolveFetch(jsonResponse({ key: 'late-key' }));
    await Promise.resolve();
    await Promise.resolve();
    expect(screen.queryByTestId('shop-map')).toBeNull();
  });

  it('keeps address content and hides optional identity and payment fields', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no key')));
    renderWithLocale(
      <ShopScreen
        state="ready"
        shop={{
          ...SHOP,
          place: {
            ...SHOP.place,
            label: '',
            address: {
              street: '',
              houseNumber: '',
              postalCode: '',
              city: 'Zurich',
              country: 'CH',
            },
          },
          photos: [],
          nip05: null,
          payUsername: null,
        }}
      />,
    );
    expect(screen.getByText('Zurich')).toBeTruthy();
    expect(screen.queryByText('Verified Nostr address')).toBeNull();
    expect(screen.queryByRole('img', { name: 'Open CryptoPay QR code' })).toBeNull();
    expect(screen.queryByRole('heading', { name: '21.gifts address' })).toBeNull();
    expect(screen.queryByTestId('shop-map')).toBeNull();
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/maps/key');
    });
  });

  it('renders only absolute http(s) photos and numbers them in order', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ key: null })));
    renderWithLocale(
      <ShopScreen
        state="ready"
        shop={{
          ...SHOP,
          photos: [
            { url: '/messages/111/photo.jpg', width: null, height: null },
            { url: 'javascript:alert(1)', width: null, height: null },
            { url: 'http://api.21.gifts/one.jpg', width: null, height: null },
            { url: 'https://api.21.gifts/two.jpg', width: null, height: null },
          ],
        }}
      />,
    );
    const stills = screen.getAllByAltText('Photo from Cafe Luna');
    expect(stills.map((node) => node.getAttribute('src'))).toEqual([
      'http://api.21.gifts/one.jpg',
      'https://api.21.gifts/two.jpg',
    ]);
    expect(stills.map((node) => node.getAttribute('data-photo-index'))).toEqual(['0', '1']);
    expect(await screen.findByRole('img', { name: 'Open CryptoPay QR code' })).toBeTruthy();
  });

  it('shows the anonymous unlisted notice without a shop name', () => {
    vi.stubGlobal('fetch', vi.fn());
    renderWithLocale(<ShopScreen state="gone" />);
    expect(screen.getByRole('heading', { name: 'This shop is no longer listed.' })).toBeTruthy();
    expect(screen.queryByText('Cafe Luna')).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the shared error and refreshes on retry', () => {
    vi.stubGlobal('fetch', vi.fn());
    renderWithLocale(<ShopScreen state="unavailable" />);
    expect(screen.getByRole('alert').textContent).toBe(
      'Could not load messages. Please try again.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refresh).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
  });
});
