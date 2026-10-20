import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { ShopNoteEditControl } from '@/components/ShopNoteEditControl';
import { ChromeBackProvider } from '@/components/ViewHistoryRoot';
import {
  fetchMessagePhoto,
  fetchShopNoteEdits,
  setMessagePlace,
  setMessageShopAccount,
  setMessageShopPhotos,
  setMessageShopText,
} from '@/lib/api';
import { prepareForumPhoto } from '@/lib/forum-photo';
import { searchMentionAccounts } from '@/lib/mention-search';
import type { Account, ForumMessage } from '@/lib/api-types';
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

/** Photo bytes only. The text step also asks for people, and that request is not a still. */
function keptStillReads(fetchMock: {
  mock: { calls: ReadonlyArray<ReadonlyArray<unknown>> };
}): number {
  return fetchMock.mock.calls.filter((call) => call[0] === 'blob:kept').length;
}

/** jsdom has no object URLs. Each call returns a new address the editor can own. */
function mockOwnedPhotoUrls(): { revoke: ReturnType<typeof vi.fn> } {
  let next = 0;
  const revoke = vi.fn();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => `blob:copy-${next++}`),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: revoke,
  });
  return { revoke };
}

function renderEdit(ui: ReactElement) {
  return renderWithLocale(
    <ChromeBackProvider>
      <ProfileChromeLeft />
      {ui}
    </ChromeBackProvider>,
  );
}

function stubShopMaps(): Map<string, (event?: unknown) => void> {
  const listeners = new Map<string, (event?: unknown) => void>();
  const map = {
    setCenter: vi.fn(),
    addListener: (event: string, handler: (event?: unknown) => void) => {
      listeners.set(event, handler);
    },
  };
  (window as { google?: unknown }).google = {
    maps: {
      Map: vi.fn(() => map),
      Marker: vi.fn(() => ({
        setPosition: () => undefined,
        getPosition: () => ({ lat: () => 14.6, lng: () => 120.98 }),
        addListener: () => undefined,
      })),
      event: { trigger: vi.fn() },
    },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ json: () => Promise.resolve({ key: 'k' }) } as Response),
  );
  vi.stubGlobal('navigator', { geolocation: undefined });
  return listeners;
}

function fillShopAddressFields(name = "Kiki's Bakery"): void {
  fireEvent.change(screen.getByLabelText('Shop name'), { target: { value: name } });
  fireEvent.change(screen.getByLabelText('Street'), { target: { value: 'Bahnhofstrasse' } });
  fireEvent.change(screen.getByLabelText('House number'), { target: { value: '12' } });
  fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '8001' } });
  fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Zürich' } });
  fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'CH' } });
}

vi.mock('@/lib/api', () => ({
  setMessageShopText: vi.fn(),
  setMessagePlace: vi.fn(),
  setMessageShopAccount: vi.fn(),
  setMessageShopPhotos: vi.fn(),
  fetchShopNoteEdits: vi.fn(),
  fetchMessagePhoto: vi.fn(),
}));

vi.mock('@/lib/forum-photo', () => ({
  prepareForumPhoto: vi.fn(),
}));

vi.mock('@/lib/mention-search', () => ({
  searchMentionAccounts: vi.fn(),
}));

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis',
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
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

const COMPLETE_PLACE = {
  lat: 47.3769,
  lng: 8.5417,
  label: "Kiki's Bakery",
  address: {
    street: 'Bahnhofstrasse',
    houseNumber: '12',
    postalCode: '8001',
    city: 'Zürich',
    country: 'CH',
  },
};

const SHOP_DESCRIPTION = 'Fresh bread every morning.';

const shopMessage: ForumMessage = {
  id: 'shop1',
  name: 'Ada',
  text: `Cafe Luna\n\n${SHOP_DESCRIPTION}\n\n#21GiftsShop`,
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 5,
  payable: true,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
  replyCount: 0,
  place: COMPLETE_PLACE,
};

beforeEach(() => {
  vi.mocked(searchMentionAccounts).mockImplementation(async (_session, query) => [
    { id: `acc-${query}`, username: query, name: query },
  ]);
});

afterEach(() => {
  cleanup();
  useAuthStore.getState().clearAuth();
  vi.clearAllMocks();
});

function signIn(role: Account['role'] = 'moderator'): void {
  useAuthStore.setState({ session: 'token', account: { ...account, role } });
}

describe('ShopNoteEditControl', () => {
  it('hides on a reply, a hidden note, a non-shop note, and below moderator', () => {
    signIn();
    const { rerender } = renderWithLocale(
      <ShopNoteEditControl message={{ ...shopMessage, parentId: 'm1' }} onUpdated={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: 'Edit shop note' })).toBeNull();
    rerender(
      <ShopNoteEditControl
        message={{ ...shopMessage, deletedAt: '2026-08-28T13:00:00.000Z' }}
        onUpdated={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Edit shop note' })).toBeNull();
    rerender(
      <ShopNoteEditControl
        message={{ ...shopMessage, text: 'Hello from Ada' }}
        onUpdated={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Edit shop note' })).toBeNull();
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'basis' } });
    rerender(<ShopNoteEditControl message={shopMessage} onUpdated={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Edit shop note' })).toBeNull();
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'verified' } });
    rerender(<ShopNoteEditControl message={shopMessage} onUpdated={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Edit shop note' })).toBeNull();
    useAuthStore.setState({ session: null, account: null });
    rerender(<ShopNoteEditControl message={shopMessage} onUpdated={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Edit shop note' })).toBeNull();
  });

  it('saves the visible text and shows text, place, and account history', async () => {
    signIn('initiator');
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([
      {
        id: 'e-text',
        createdAt: '2026-08-28T13:00:00.000Z',
        field: 'text',
        before: 'Cafe Luna\n\n#21GiftsShop',
        after: 4,
        actor: { id: 'acc', name: 'Ada', role: 'moderator' },
      },
      {
        id: 'e-place',
        createdAt: 'not-a-date',
        field: 'place',
        before: null,
        after: { lat: 14.5, lng: 120.9, label: '  ' },
        actor: { id: 'acc-2', name: '   ', role: null },
      },
      {
        id: 'e-label',
        createdAt: '2026-08-28T12:00:00.000Z',
        field: 'place',
        before: { lat: 'x' },
        after: { lat: 1, lng: 2, label: 'Stall' },
        actor: { id: 'acc', name: 'Ada', role: 'moderator' },
      },
      {
        id: 'e-account',
        createdAt: '2026-08-27T12:00:00.000Z',
        field: 'shopAccount',
        before: { username: 1 },
        after: { id: 's', username: 'luna', name: 'Luna' },
        actor: { id: 'acc', name: 'Ada', role: 'moderator' },
      },
      {
        id: 'e-array',
        createdAt: '2026-08-26T12:00:00.000Z',
        field: 'place',
        before: [],
        after: [],
        actor: { id: 'acc', name: 'Ada', role: 'moderator' },
      },
      {
        id: 'e-address',
        createdAt: '2026-08-25T12:00:00.000Z',
        field: 'place',
        before: {
          lat: 47.3769,
          lng: 8.5417,
          label: null,
          address: {
            street: 'Bahnhofstrasse',
            houseNumber: '12',
            postalCode: '8001',
            city: 'Zürich',
            country: 'CH',
          },
        },
        after: { lat: 1, lng: 2, address: { street: 1 } },
        actor: { id: 'acc', name: 'Ada', role: 'moderator' },
      },
      {
        id: 'e-address-null',
        createdAt: '2026-08-24T12:00:00.000Z',
        field: 'place',
        before: { lat: 1, lng: 2, label: 'Stall', address: null },
        after: {
          lat: 3,
          lng: 4,
          label: 'Norte',
          address: {
            street: 'Main',
            houseNumber: '1',
            postalCode: '8000',
            city: 'Zürich',
            country: 'CH',
          },
        },
        actor: { id: 'acc', name: 'Ada', role: 'moderator' },
      },
      {
        id: 'e-addr-fields',
        createdAt: '2026-08-23T12:00:00.000Z',
        field: 'place',
        before: {
          lat: 1,
          lng: 2,
          label: 'House',
          address: {
            street: 'S',
            houseNumber: 2,
            postalCode: '1',
            city: 'C',
            country: 'CH',
          },
        },
        after: {
          lat: 1,
          lng: 2,
          label: 'Postal',
          address: {
            street: 'S',
            houseNumber: '2',
            postalCode: 1,
            city: 'C',
            country: 'CH',
          },
        },
        actor: { id: 'acc', name: 'Ada', role: 'moderator' },
      },
      {
        id: 'e-addr-city',
        createdAt: '2026-08-22T12:00:00.000Z',
        field: 'place',
        before: {
          lat: 1,
          lng: 2,
          label: 'City',
          address: {
            street: 'S',
            houseNumber: '2',
            postalCode: '1',
            city: 1,
            country: 'CH',
          },
        },
        after: {
          lat: 1,
          lng: 2,
          label: 'Country',
          address: {
            street: 'S',
            houseNumber: '2',
            postalCode: '1',
            city: 'C',
            country: 1,
          },
        },
        actor: { id: 'acc', name: 'Ada', role: 'moderator' },
      },
    ]);
    vi.mocked(setMessageShopText).mockResolvedValue({
      ...shopMessage,
      text: 'Cafe Sol\n\n#21GiftsShop',
    });
    const onUpdated = vi.fn();
    renderWithLocale(<ShopNoteEditControl message={shopMessage} onUpdated={onUpdated} />);
    const pencil = screen.getByRole('button', { name: 'Edit shop note' });
    expect(screen.queryByText('Edit shop note')).toBeNull();
    fireEvent.keyDown(pencil, { key: 'Enter' });
    fireEvent.click(pencil);
    expect(screen.queryByText('Cancel')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByText('1 / 5 · Photos')).toBeNull();
    fireEvent.click(pencil);
    expect(await screen.findByRole('heading', { name: 'History' })).toBeTruthy();
    expect(screen.getAllByText(/Ada ·/).length).toBeGreaterThan(0);
    expect(screen.getByText('Cafe Luna → None')).toBeTruthy();
    expect(screen.getByText(/acc-2 · not-a-date · Place/)).toBeTruthy();
    expect(screen.getByText('None → 14.50000, 120.90000')).toBeTruthy();
    expect(screen.getByText('None → Stall')).toBeTruthy();
    expect(screen.getByText('None → @luna')).toBeTruthy();
    expect(screen.getByText('None → None')).toBeTruthy();
    expect(
      screen.getByText('Bahnhofstrasse 12, 8001 Zürich, Switzerland → 1.00000, 2.00000'),
    ).toBeTruthy();
    expect(screen.getByText('Stall → Norte · Main 1, 8000 Zürich, Switzerland')).toBeTruthy();
    expect(screen.getByText('House → Postal')).toBeTruthy();
    expect(screen.getByText('City → Country')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const box = screen.getByRole('textbox', { name: 'Shop text' });
    expect(box).toHaveProperty('value', `Cafe Luna\n\n${SHOP_DESCRIPTION}`);
    fireEvent.change(box, { target: { value: 'Cafe Sol is open every morning.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'shop1', text: 'Cafe Sol\n\n#21GiftsShop' }),
      );
    });
    expect(setMessageShopText).toHaveBeenCalledWith(
      'token',
      'shop1',
      'Cafe Sol is open every morning.',
    );
    expect(setMessagePlace).not.toHaveBeenCalled();
    expect(setMessageShopAccount).not.toHaveBeenCalled();
    expect(setMessageShopPhotos).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: 'Shop text' })).toBeNull();
  });

  it('keeps the panel open when the save fails and shows an empty or failed history', async () => {
    signIn('founder');
    vi.mocked(fetchShopNoteEdits).mockResolvedValueOnce([]);
    vi.mocked(setMessageShopText).mockRejectedValue(new Error('no'));
    renderWithLocale(<ShopNoteEditControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect(await screen.findByText('No edits yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: 'Cafe Sol is open every morning.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not save this shop note',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect(screen.queryByText('5 / 5 · Summary')).toBeNull();

    vi.mocked(fetchShopNoteEdits).mockRejectedValue(new Error('down'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect(await screen.findByText('Could not load the history')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect(screen.queryByText('Could not load the history')).toBeNull();
  });

  const mappedShopProblems: Array<[string, string, 2 | 3 | 4]> = [
    ['Shop name is required', 'Enter the shop name.', 2],
    [
      'Shop name must not contain the address',
      'The shop name must not contain the street or the postal code.',
      2,
    ],
    [
      'Shop address is required',
      'Enter the full address: street, house number, postal code, city and country.',
      2,
    ],
    [
      'Shop description must be 20 to 1000 characters and longer than the shop name',
      'The description must be 20 to 1000 characters and longer than the shop name.',
      3,
    ],
    [
      'Place address is invalid',
      'The address is invalid. The house number must start with a digit, the postal code must have 4 digits in Switzerland and Liechtenstein, the city must contain a letter, and the country must be chosen from the list.',
      2,
    ],
    [
      'Place label must be at most 80 characters',
      'The shop name must be at most 80 characters.',
      2,
    ],
    [
      'Username is not valid',
      'Use 1–32 lowercase letters, digits, dots, hyphens, or underscores, starting with a letter or digit.',
      4,
    ],
    [
      'No account with that username',
      'No account with that username. Check the spelling of the 21.gifts username.',
      4,
    ],
    [
      'Text contains invalid control characters',
      'The description must not contain control characters other than line breaks.',
      3,
    ],
  ];

  it.each(mappedShopProblems)(
    'maps shop 400 %s to localized copy',
    async (apiMessage, localized, expectedStep) => {
      signIn('founder');
      vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
      vi.mocked(setMessageShopText).mockRejectedValue(new Error(apiMessage));
      renderEdit(<ShopNoteEditControl message={shopMessage} onUpdated={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
        target: { value: 'Cafe Sol is open every morning.' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      expect(
        await screen.findByText(
          expectedStep === 2
            ? '2 / 5 · Place'
            : expectedStep === 3
              ? '3 / 5 · Text'
              : '4 / 5 · 21.gifts user',
        ),
      ).toBeTruthy();
      if (expectedStep === 2) {
        expect(within(await screen.findByRole('dialog')).getByText(localized)).toBeTruthy();
      } else {
        expect(screen.getByText(localized)).toBeTruthy();
      }
    },
  );

  it('shows the generic save copy when save rejects a non-Error value', async () => {
    signIn('founder');
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    vi.mocked(setMessageShopText).mockRejectedValue('offline');
    renderEdit(<ShopNoteEditControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: 'Cafe Sol is open every morning.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not save this shop note',
    );
  });

  it('clears a mapped save error when the shop text changes', async () => {
    signIn('founder');
    stubShopMaps();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    vi.mocked(setMessageShopText).mockRejectedValue(
      new Error('Shop description must be 20 to 1000 characters and longer than the shop name'),
    );
    renderEdit(<ShopNoteEditControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: 'Cafe Sol is open every morning.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('3 / 5 · Text')).toBeTruthy();
    expect(
      screen.getAllByText(
        'The description must be 20 to 1000 characters and longer than the shop name.',
      ).length,
    ).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: 'Cafe Sol is open every morning now.' },
    });
    expect(
      screen.queryAllByText(
        'The description must be 20 to 1000 characters and longer than the shop name.',
      ),
    ).toHaveLength(0);
  });

  it('clears a mapped save error when the place changes', async () => {
    signIn('founder');
    const listeners = stubShopMaps();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    vi.mocked(setMessageShopText).mockRejectedValue(new Error('Shop name is required'));
    renderEdit(<ShopNoteEditControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: 'Cafe Sol is open every morning.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('2 / 5 · Place')).toBeTruthy();
    expect(
      within(await screen.findByRole('dialog')).getAllByText('Enter the shop name.').length,
    ).toBeGreaterThan(0);
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    fillShopAddressFields("Kiki's Cafe");
    fireEvent.click(await screen.findByRole('button', { name: 'Use this place' }));
    expect(screen.queryByText('Enter the shop name.')).toBeNull();
  });

  it('clears a mapped save error when the account draft changes', async () => {
    signIn('founder');
    stubShopMaps();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    vi.mocked(setMessageShopText).mockRejectedValue(new Error('No account with that username'));
    renderEdit(<ShopNoteEditControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: 'Cafe Sol is open every morning.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('4 / 5 · 21.gifts user')).toBeTruthy();
    expect(
      screen.getAllByText(
        'No account with that username. Check the spelling of the 21.gifts username.',
      ).length,
    ).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('21.gifts username'), { target: { value: 'luna' } });
    expect(
      screen.queryAllByText(
        'No account with that username. Check the spelling of the 21.gifts username.',
      ),
    ).toHaveLength(0);
  });

  it('clears a mapped save error when the editor is reopened', async () => {
    signIn('founder');
    stubShopMaps();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    vi.mocked(setMessageShopText).mockRejectedValue(new Error('Shop name is required'));
    renderEdit(<ShopNoteEditControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: 'Cafe Sol is open every morning.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findAllByText('Enter the shop name.')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect(await screen.findByRole('button', { name: 'Next' })).toBeTruthy();
    expect(screen.queryByText('Enter the shop name.')).toBeNull();
  });

  it('saves a place, a user, and replaced stills, and ignores a bad file', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    vi.mocked(setMessageShopText).mockResolvedValue({
      ...shopMessage,
      text: 'Cafe Sol\n\n#21GiftsShop',
    });
    vi.mocked(setMessagePlace).mockResolvedValue({
      ...shopMessage,
      text: 'Cafe Sol\n\n#21GiftsShop',
      place: { lat: 1, lng: 2, label: null },
    });
    vi.mocked(setMessageShopAccount).mockResolvedValue({
      ...shopMessage,
      text: 'Cafe Sol\n\n#21GiftsShop',
      place: { lat: 1, lng: 2, label: null },
      shopAccount: { id: 'shop-acc', username: 'luna', name: 'Luna' },
    });
    vi.mocked(setMessageShopPhotos).mockResolvedValue({
      ...shopMessage,
      hasPhoto: true,
      photoCount: 1,
    });
    vi.mocked(prepareForumPhoto)
      .mockResolvedValueOnce({ ok: false, error: 'unsupported' })
      .mockResolvedValueOnce({
        ok: true,
        photo: {
          contentType: 'image/jpeg',
          data: 'abc',
          previewUrl: 'data:image/jpeg;base64,abc',
          takenAt: '2020-01-01T00:00:00+00:00',
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        photo: {
          contentType: 'image/jpeg',
          data: 'def',
          previewUrl: 'data:image/jpeg;base64,def',
          takenAt: null,
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        photo: {
          contentType: 'image/jpeg',
          data: 'ghi',
          previewUrl: 'data:image/jpeg;base64,ghi',
          takenAt: '',
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        photo: {
          contentType: 'image/jpeg',
          data: 'jkl',
          previewUrl: 'data:image/jpeg;base64,jkl',
          takenAt: '1999-01-01T00:00:00+00:00',
        },
      });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const type = String(input).includes('jpeg') ? 'image/jpeg' : 'image/png';
        return {
          ok: true,
          blob: () =>
            Promise.resolve({
              type,
              arrayBuffer: () => Promise.resolve(Uint8Array.of(9).buffer),
            }),
        };
      }),
    );
    const onUpdated = vi.fn();
    mockOwnedPhotoUrls();
    renderWithLocale(
      <ShopNoteEditControl
        message={{
          ...shopMessage,
          place: COMPLETE_PLACE,
          shopAccount: { id: 'old', username: 'old', name: 'Old' },
        }}
        existingPhotos={['blob:png', 'blob:jpeg']}
        existingVideoUrl="blob:video"
        onUpdated={onUpdated}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect(await screen.findByText('1 / 5 · Photos')).toBeTruthy();
    const stills = [...document.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(stills).toEqual(['blob:copy-0', 'blob:copy-1']);
    expect(document.querySelector('video')?.getAttribute('src')).toBe('blob:video');
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['a'], 'a.jpg', { type: 'image/jpeg' })] },
    });
    expect(await screen.findByText('Use a JPEG, PNG, or WebP photo')).toBeTruthy();
    fireEvent.change(input, {
      target: { files: [new File(['b'], 'b.jpg', { type: 'image/jpeg' })] },
    });
    fireEvent.change(input, {
      target: { files: [new File(['c'], 'c.jpg', { type: 'image/jpeg' })] },
    });
    fireEvent.change(input, {
      target: { files: [new File(['d'], 'd.jpg', { type: 'image/jpeg' })] },
    });
    fireEvent.change(input, {
      target: { files: [new File(['e'], 'e.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Remove photo' })).toHaveLength(6);
    });
    const removeButtons = screen.getAllByRole('button', { name: 'Remove photo' });
    fireEvent.click(removeButtons[removeButtons.length - 1]!);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: 'Cafe Sol is open every morning.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('21.gifts username'), { target: { value: '@luna' } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalled();
    });
    expect(setMessagePlace).not.toHaveBeenCalled();
    expect(setMessageShopAccount).toHaveBeenCalledWith('token', 'shop1', 'luna');
    const photos = vi.mocked(setMessageShopPhotos).mock.calls[0]?.[2] ?? [];
    expect(photos.map((photo) => photo.contentType)).toEqual([
      'image/png',
      'image/jpeg',
      'image/jpeg',
      'image/jpeg',
      'image/jpeg',
    ]);
    expect(photos.map((photo) => photo.takenAt ?? null)).toEqual([
      null,
      null,
      '2020-01-01T00:00:00+00:00',
      null,
      null,
    ]);
    vi.unstubAllGlobals();
  });

  it('shows a too-large photo reason under the staff picker', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    vi.mocked(prepareForumPhoto).mockResolvedValue({ ok: false, error: 'tooLarge' });
    renderEdit(<ShopNoteEditControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect(await screen.findByText('1 / 5 · Photos')).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['large'], 'large.jpg', { type: 'image/jpeg' })] },
    });
    expect(await screen.findByText('Keep photos under 1 MB and videos under 32 MB')).toBeTruthy();
  });

  it('shows a fallback photo reason when preparation throws', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    vi.mocked(prepareForumPhoto).mockRejectedValue(new Error('decode failed'));
    renderEdit(<ShopNoteEditControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect(await screen.findByText('1 / 5 · Photos')).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['bad'], 'bad.jpg', { type: 'image/jpeg' })] },
    });
    expect(await screen.findByText('Use a JPEG, PNG, or WebP photo')).toBeTruthy();
  });

  it('keeps only ten selected photos and shows the concrete limit', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    vi.mocked(prepareForumPhoto).mockResolvedValue({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'abc',
        previewUrl: 'data:image/jpeg;base64,abc',
      },
    });
    renderEdit(<ShopNoteEditControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect(await screen.findByText('1 / 5 · Photos')).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: Array.from(
          { length: 11 },
          (_, index) => new File([String(index)], `${String(index)}.jpg`, { type: 'image/jpeg' }),
        ),
      },
    });
    expect(await screen.findByText('You can add up to 10 photos')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Remove photo' })).toHaveLength(10);
    fireEvent.change(input, {
      target: { files: [new File(['extra'], 'extra.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(prepareForumPhoto).toHaveBeenCalledTimes(12);
    });
    expect(screen.getAllByRole('button', { name: 'Remove photo' })).toHaveLength(10);
  });

  it('keeps overlapping photo picks within the ten-photo limit', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    vi.mocked(prepareForumPhoto).mockImplementation(async (file) => {
      await Promise.resolve();
      return {
        ok: true,
        photo: {
          contentType: 'image/jpeg',
          data: file.name,
          previewUrl: `data:image/jpeg;base64,${file.name}`,
        },
      };
    });
    renderEdit(<ShopNoteEditControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect(await screen.findByText('1 / 5 · Photos')).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const pick = (prefix: string): File[] =>
      Array.from(
        { length: 6 },
        (_, index) => new File([prefix], `${prefix}-${String(index)}.jpg`, { type: 'image/jpeg' }),
      );
    fireEvent.change(input, { target: { files: pick('first') } });
    fireEvent.change(input, { target: { files: pick('second') } });
    await waitFor(() => {
      expect(prepareForumPhoto).toHaveBeenCalledTimes(12);
      expect(screen.getAllByRole('button', { name: 'Remove photo' })).toHaveLength(10);
    });
    expect(screen.getByText('You can add up to 10 photos')).toBeTruthy();
  });

  it('opens on a photo read failure without the feed stills', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    const { revoke } = mockOwnedPhotoUrls();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        blob: () => Promise.resolve(new Blob()),
      }),
    );
    renderWithLocale(
      <ShopNoteEditControl
        message={{
          ...shopMessage,
          hasPhoto: true,
          photoCount: 2,
          shopAccount: { id: 'old', username: 'old', name: 'Old' },
        }}
        existingPhotos={['blob:kept', 'blob:other']}
        onUpdated={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not save this shop note',
    );
    expect(screen.queryByRole('button', { name: 'Remove photo' })).toBeNull();
    expect(setMessageShopAccount).not.toHaveBeenCalled();
    expect(revoke).not.toHaveBeenCalledWith('blob:kept');
    expect(revoke).not.toHaveBeenCalledWith('blob:other');
    vi.unstubAllGlobals();
  });

  it('drops a partial still copy when a later feed still cannot be read', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    const { revoke } = mockOwnedPhotoUrls();
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          return {
            ok: true,
            blob: () =>
              Promise.resolve({
                type: 'image/png',
                arrayBuffer: () => Promise.resolve(Uint8Array.of(1).buffer),
              }),
          };
        }
        return { ok: false, blob: () => Promise.resolve(new Blob()) };
      }),
    );
    renderWithLocale(
      <ShopNoteEditControl
        message={{ ...shopMessage, hasPhoto: true, photoCount: 2 }}
        existingPhotos={['blob:kept', 'blob:other']}
        onUpdated={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not save this shop note',
    );
    expect(revoke).toHaveBeenCalledWith('blob:copy-0');
    expect(revoke).not.toHaveBeenCalledWith('blob:kept');
    expect(revoke).not.toHaveBeenCalledWith('blob:other');
    expect(screen.queryByRole('img')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('loads stills that are not already shown and drops them on failure', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    const revoke = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:loaded'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revoke,
    });
    vi.mocked(fetchMessagePhoto)
      .mockResolvedValueOnce(new Blob([Uint8Array.of(1)]))
      .mockRejectedValueOnce(new Error('nope'));
    const view = renderWithLocale(
      <ShopNoteEditControl
        message={{ ...shopMessage, hasPhoto: true, photoCount: 1 }}
        onUpdated={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect((await screen.findByRole('img')).getAttribute('src')).toBe('blob:loaded');
    view.unmount();
    expect(revoke).toHaveBeenCalledWith('blob:loaded');

    vi.mocked(fetchMessagePhoto).mockReset();
    vi.mocked(fetchMessagePhoto)
      .mockResolvedValueOnce(new Blob([Uint8Array.of(1)]))
      .mockRejectedValueOnce(new Error('second'));
    renderWithLocale(
      <ShopNoteEditControl
        message={{ ...shopMessage, hasPhoto: true, photoCount: 2, hasVideo: true }}
        onUpdated={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not save this shop note',
    );
    expect(document.querySelector('video')).toBeNull();
  });

  it('shows a save error when a loaded still cannot be read back', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:loaded'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    vi.mocked(fetchMessagePhoto).mockResolvedValue(new Blob([Uint8Array.of(1)]));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === 'blob:loaded') {
          return { ok: false };
        }
        return { ok: true, json: async () => ({ accounts: [] }) };
      }),
    );
    renderWithLocale(
      <ShopNoteEditControl
        message={{ ...shopMessage, hasPhoto: true, photoCount: 1 }}
        onUpdated={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect((await screen.findByRole('img')).getAttribute('src')).toBe('blob:loaded');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not save this shop note',
    );
    expect(setMessageShopText).not.toHaveBeenCalled();
    expect(setMessageShopPhotos).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('ignores a second pencil click while the stills are still loading', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    let release: (blob: Blob) => void = () => {};
    vi.mocked(fetchMessagePhoto).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    renderWithLocale(
      <ShopNoteEditControl
        message={{ ...shopMessage, hasPhoto: true, photoCount: 1 }}
        onUpdated={vi.fn()}
      />,
    );
    const pencil = screen.getByRole('button', { name: 'Edit shop note' });
    fireEvent.click(pencil);
    fireEvent.click(pencil);
    expect(fetchMessagePhoto).toHaveBeenCalledTimes(1);
    release(new Blob([Uint8Array.of(1)]));
    expect(await screen.findByText('1 / 5 · Photos')).toBeTruthy();
  });

  it('saves a text change after a failed reopen instead of reading revoked stills', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    vi.mocked(setMessageShopText).mockResolvedValue({
      ...shopMessage,
      text: 'Cafe Sol\n\n#21GiftsShop',
    });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:loaded'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    vi.mocked(fetchMessagePhoto).mockResolvedValueOnce(new Blob([Uint8Array.of(1)]));
    renderWithLocale(
      <ShopNoteEditControl
        message={{ ...shopMessage, hasPhoto: true, photoCount: 1 }}
        onUpdated={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect((await screen.findByRole('img')).getAttribute('src')).toBe('blob:loaded');
    expect(screen.queryByText('Cancel')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    vi.mocked(fetchMessagePhoto).mockRejectedValueOnce(new Error('nope'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not save this shop note',
    );
    expect(screen.queryByRole('img')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: 'Cafe Sol is open every morning.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(setMessageShopText).toHaveBeenCalledWith(
        'token',
        'shop1',
        'Cafe Sol is open every morning.',
      );
    });
  });

  it('does not open on mount for a reply', () => {
    signIn();
    renderWithLocale(
      <ShopNoteEditControl
        message={{ ...shopMessage, parentId: 'm1' }}
        startOpen
        onUpdated={vi.fn()}
      />,
    );
    expect(screen.queryByText('1 / 5 · Photos')).toBeNull();
  });

  it('opens on mount when asked and shows a stored video', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    renderWithLocale(
      <ShopNoteEditControl
        message={{ ...shopMessage, hasVideo: true, videoContentType: 'video/webm' }}
        startOpen
        onUpdated={vi.fn()}
      />,
    );
    expect(await screen.findByText('1 / 5 · Photos')).toBeTruthy();
    expect(document.querySelector('video')?.getAttribute('src')).toBe('/messages/shop1/video.webm');
  });

  it('refuses an empty note and a photo save before the stills load', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    vi.mocked(fetchMessagePhoto).mockRejectedValue(new Error('nope'));
    const onUpdated = vi.fn();
    renderEdit(
      <ShopNoteEditControl
        message={{ ...shopMessage, hasPhoto: true, photoCount: 1 }}
        onUpdated={onUpdated}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not save this shop note',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: '   ' },
    });
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    expect(setMessageShopText).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    vi.mocked(prepareForumPhoto).mockResolvedValue({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'abc',
        previewUrl: 'data:image/jpeg;base64,abc',
        takenAt: '',
      },
    });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['a'], 'a.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Remove photo' }).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: 'Cafe Sol is open every morning.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(setMessageShopPhotos).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('refuses a note that is longer than the limit', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    renderWithLocale(<ShopNoteEditControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: 'x'.repeat(8000) },
    });
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    expect(screen.getByText('The description is too long (max. 1000 characters).')).toBeTruthy();
    expect(setMessageShopText).not.toHaveBeenCalled();
  });

  it('clears a shop user without sending stills', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    vi.mocked(setMessageShopAccount).mockResolvedValue({ ...shopMessage });
    renderWithLocale(
      <ShopNoteEditControl
        message={{
          ...shopMessage,
          shopAccount: { id: 'old', username: 'old', name: 'Old' },
        }}
        onUpdated={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('21.gifts username'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(setMessageShopAccount).toHaveBeenCalledWith('token', 'shop1', null);
    });
    expect(setMessageShopPhotos).not.toHaveBeenCalled();
  });

  it('reads kept stills before a text save can drop their addresses', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: () =>
        Promise.resolve({
          type: 'image/png',
          arrayBuffer: () => Promise.resolve(Uint8Array.of(4).buffer),
        }),
      json: async () => ({ accounts: [] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(setMessageShopText)
      .mockRejectedValueOnce(new Error('no'))
      .mockImplementation(async () => {
        expect(keptStillReads(fetchMock)).toBe(1);
        return { ...shopMessage, text: 'Cafe Sol\n\n#21GiftsShop' };
      });
    vi.mocked(setMessageShopPhotos).mockResolvedValue({
      ...shopMessage,
      hasPhoto: false,
      photoCount: 0,
    });
    mockOwnedPhotoUrls();
    renderEdit(
      <ShopNoteEditControl
        message={{
          ...shopMessage,
          hasPhoto: true,
          photoCount: 1,
          place: COMPLETE_PLACE,
        }}
        existingPhotos={['blob:kept']}
        onUpdated={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect(await screen.findByText('1 / 5 · Photos')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: 'Cafe Sol is open every morning.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not save this shop note',
    );
    expect(setMessageShopPhotos).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(setMessageShopPhotos).toHaveBeenCalledTimes(1);
    });
    expect(keptStillReads(fetchMock)).toBe(1);
    vi.unstubAllGlobals();
  });

  it('reads a kept still once when a later photo save fails', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    vi.mocked(setMessageShopPhotos)
      .mockRejectedValueOnce(new Error('no'))
      .mockResolvedValueOnce({ ...shopMessage, hasPhoto: true, photoCount: 1 });
    vi.mocked(prepareForumPhoto).mockResolvedValue({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'abc',
        previewUrl: 'data:image/jpeg;base64,abc',
        takenAt: '',
      },
    });
    const fetchMock = vi.fn(async () => ({
      ok: true,
      blob: () =>
        Promise.resolve({
          type: 'image/png',
          arrayBuffer: () => Promise.resolve(Uint8Array.of(9).buffer),
        }),
      json: async () => ({ accounts: [] }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    mockOwnedPhotoUrls();
    renderWithLocale(
      <ShopNoteEditControl
        message={{ ...shopMessage, hasPhoto: true, photoCount: 1 }}
        existingPhotos={['blob:kept']}
        onUpdated={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect(await screen.findByText('1 / 5 · Photos')).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['a'], 'a.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Remove photo' })).toHaveLength(2);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not save this shop note',
    );
    expect(keptStillReads(fetchMock)).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(setMessageShopPhotos).toHaveBeenCalledTimes(2);
    });
    expect(keptStillReads(fetchMock)).toBe(1);
    vi.unstubAllGlobals();
  });

  it('keeps the eleventh new still off the note', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    vi.mocked(prepareForumPhoto).mockResolvedValue({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'abc',
        previewUrl: 'data:image/jpeg;base64,abc',
        takenAt: '',
      },
    });
    renderWithLocale(<ShopNoteEditControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const files = Array.from(
      { length: 10 },
      (_, index) => new File(['a'], `${index}.jpg`, { type: 'image/jpeg' }),
    );
    fireEvent.change(input, { target: { files } });
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Remove photo' })).toHaveLength(10);
    });
    fireEvent.change(input, {
      target: { files: [new File(['b'], 'extra.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => {
      expect(prepareForumPhoto).toHaveBeenCalledTimes(11);
    });
    expect(screen.getAllByRole('button', { name: 'Remove photo' })).toHaveLength(10);
    expect(screen.getByText('You can add up to 10 photos')).toBeTruthy();
  });

  it('replaces the previous still copies when the editor opens again', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    const { revoke } = mockOwnedPhotoUrls();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        blob: () =>
          Promise.resolve({
            type: 'image/jpeg',
            arrayBuffer: () => Promise.resolve(Uint8Array.of(3).buffer),
          }),
      })),
    );
    renderWithLocale(
      <ShopNoteEditControl
        message={{ ...shopMessage, hasPhoto: true, photoCount: 1 }}
        existingPhotos={['blob:kept']}
        onUpdated={vi.fn()}
      />,
    );
    const pencil = screen.getByRole('button', { name: 'Edit shop note' });
    fireEvent.click(pencil);
    expect((await screen.findByRole('img')).getAttribute('src')).toBe('blob:copy-0');
    fireEvent.click(pencil);
    expect(screen.queryByText('1 / 5 · Photos')).toBeNull();
    fireEvent.click(pencil);
    expect((await screen.findByRole('img')).getAttribute('src')).toBe('blob:copy-1');
    expect(revoke).toHaveBeenCalledWith('blob:copy-0');
    expect(revoke).not.toHaveBeenCalledWith('blob:kept');
    vi.unstubAllGlobals();
  });

  it('opens without a pin and saves a complete Happyland place', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    const pin = {
      lat: 14.6,
      lng: 120.98,
      label: 'Happyland',
      address: {
        street: 'Bahnhofstrasse',
        houseNumber: '12',
        postalCode: '8001',
        city: 'Zürich',
        country: 'CH',
      },
    };
    vi.mocked(setMessagePlace).mockResolvedValue({ ...shopMessage, place: pin });
    const onUpdated = vi.fn();
    const listeners = stubShopMaps();
    const withoutPlace: ForumMessage = { ...shopMessage };
    delete withoutPlace.place;
    renderEdit(<ShopNoteEditControl message={withoutPlace} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 14.6, lng: () => 120.98 } });
    fillShopAddressFields('Happyland');
    fireEvent.click(await screen.findByRole('button', { name: 'Use this place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(setMessagePlace).toHaveBeenCalledWith('token', 'shop1', pin);
    });
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ place: pin }));
    delete (window as { google?: unknown }).google;
    vi.unstubAllGlobals();
  });

  it('saves a pin that differs only by a pipe split in street and house number', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    const stored = {
      lat: 47.3769,
      lng: 8.5417,
      label: 'Happyland',
      address: {
        street: 'A',
        houseNumber: '1|8000',
        postalCode: '8000',
        city: 'Zürich',
        country: 'CH',
      },
    };
    const pin = {
      lat: 47.3769,
      lng: 8.5417,
      label: 'Happyland',
      address: {
        street: 'A|1',
        houseNumber: '8000',
        postalCode: '8000',
        city: 'Zürich',
        country: 'CH',
      },
    };
    vi.mocked(setMessagePlace).mockResolvedValue({ ...shopMessage, place: pin });
    const onUpdated = vi.fn();
    stubShopMaps();
    renderEdit(
      <ShopNoteEditControl message={{ ...shopMessage, place: stored }} onUpdated={onUpdated} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await screen.findByLabelText('Shop name');
    fireEvent.change(screen.getByLabelText('Shop name'), { target: { value: 'Happyland' } });
    fireEvent.change(screen.getByLabelText('Street'), { target: { value: 'A|1' } });
    fireEvent.change(screen.getByLabelText('House number'), { target: { value: '8000' } });
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '8000' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Zürich' } });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'CH' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Use this place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(setMessagePlace).toHaveBeenCalledWith('token', 'shop1', pin);
    });
    delete (window as { google?: unknown }).google;
    vi.unstubAllGlobals();
  });

  it('saves a pin when the stored place has no name or address', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    const pin = {
      lat: 47.3769,
      lng: 8.5417,
      label: 'Happyland',
      address: {
        street: 'Bahnhofstrasse',
        houseNumber: '12',
        postalCode: '8001',
        city: 'Zürich',
        country: 'CH',
      },
    };
    vi.mocked(setMessagePlace).mockResolvedValue({ ...shopMessage, place: pin });
    const onUpdated = vi.fn();
    stubShopMaps();
    renderEdit(
      <ShopNoteEditControl
        message={{
          ...shopMessage,
          place: { lat: 47.3769, lng: 8.5417, label: null, address: null },
        }}
        onUpdated={onUpdated}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await screen.findByLabelText('Shop name');
    fillShopAddressFields('Happyland');
    fireEvent.click(await screen.findByRole('button', { name: 'Use this place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(setMessagePlace).toHaveBeenCalledWith('token', 'shop1', pin);
    });
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ place: pin }));
    delete (window as { google?: unknown }).google;
    vi.unstubAllGlobals();
  });

  it('keeps the panel open when the place step fails after a text save', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    const textResult = { ...shopMessage, text: 'Cafe Sol\n\n#21GiftsShop' };
    vi.mocked(setMessageShopText).mockResolvedValue(textResult);
    vi.mocked(setMessagePlace).mockRejectedValue(new Error('no'));
    const onUpdated = vi.fn();
    const listeners = stubShopMaps();
    renderEdit(<ShopNoteEditControl message={shopMessage} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 14.6, lng: () => 120.98 } });
    fillShopAddressFields('Happyland');
    fireEvent.click(await screen.findByRole('button', { name: 'Use this place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: 'Cafe Sol is open every morning.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not save this shop note',
    );
    expect(onUpdated).toHaveBeenCalledTimes(1);
    expect(onUpdated).toHaveBeenCalledWith(textResult);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
    delete (window as { google?: unknown }).google;
    vi.unstubAllGlobals();
  });

  it('keeps the panel open when the account step fails after a text save', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    const textResult = { ...shopMessage, text: 'Cafe Sol\n\n#21GiftsShop' };
    vi.mocked(setMessageShopText).mockResolvedValue(textResult);
    vi.mocked(setMessageShopAccount).mockRejectedValue(new Error('no'));
    const onUpdated = vi.fn();
    renderEdit(<ShopNoteEditControl message={shopMessage} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: 'Cafe Sol is open every morning.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('21.gifts username'), { target: { value: 'luna' } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Next' })).toHaveProperty('disabled', false);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not save this shop note',
    );
    expect(onUpdated).toHaveBeenCalledTimes(1);
    expect(onUpdated).toHaveBeenCalledWith(textResult);
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeTruthy();
  });

  it('writes the place first when only the final name and text are valid together', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    const oldName = 'N'.repeat(30);
    const oldText = 'T'.repeat(40);
    const newName = 'Abcde';
    const newText = 'D'.repeat(22);
    const oldPlace = { ...COMPLETE_PLACE, label: oldName };
    const newPlace = { ...COMPLETE_PLACE, label: newName };
    const stored: ForumMessage = {
      ...shopMessage,
      text: `${oldText}\n\n#21GiftsShop`,
      place: oldPlace,
    };
    vi.mocked(setMessagePlace).mockResolvedValue({ ...stored, place: newPlace });
    vi.mocked(setMessageShopText).mockResolvedValue({
      ...stored,
      place: newPlace,
      text: `${newText}\n\n#21GiftsShop`,
    });
    stubShopMaps();
    renderEdit(<ShopNoteEditControl message={stored} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    expect(await screen.findByLabelText('Shop name')).toHaveProperty('value', oldName);
    fireEvent.change(screen.getByLabelText('Shop name'), { target: { value: newName } });
    fireEvent.click(await screen.findByRole('button', { name: 'Use this place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: newText },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(setMessagePlace).toHaveBeenCalled();
      expect(setMessageShopText).toHaveBeenCalled();
    });
    const placeOrder = vi.mocked(setMessagePlace).mock.invocationCallOrder[0];
    const textOrder = vi.mocked(setMessageShopText).mock.invocationCallOrder[0];
    expect(typeof placeOrder).toBe('number');
    expect(typeof textOrder).toBe('number');
    expect(Number(placeOrder)).toBeLessThan(Number(textOrder));
    expect(setMessagePlace).toHaveBeenCalledWith('token', 'shop1', newPlace);
    expect(setMessageShopText).toHaveBeenCalledWith('token', 'shop1', newText);
    delete (window as { google?: unknown }).google;
    vi.unstubAllGlobals();
  });

  it('writes text before place when the new text is valid against the stored name', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    const newName = 'Luna';
    const newText = 'D'.repeat(22);
    const newPlace = { ...COMPLETE_PLACE, label: newName };
    vi.mocked(setMessageShopText).mockResolvedValue({
      ...shopMessage,
      text: `${newText}\n\n#21GiftsShop`,
    });
    vi.mocked(setMessagePlace).mockResolvedValue({
      ...shopMessage,
      text: `${newText}\n\n#21GiftsShop`,
      place: newPlace,
    });
    stubShopMaps();
    renderEdit(<ShopNoteEditControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    expect(await screen.findByLabelText('Shop name')).toHaveProperty('value', "Kiki's Bakery");
    fireEvent.change(screen.getByLabelText('Shop name'), { target: { value: newName } });
    fireEvent.click(await screen.findByRole('button', { name: 'Use this place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: newText },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(setMessagePlace).toHaveBeenCalled();
      expect(setMessageShopText).toHaveBeenCalled();
    });
    const placeOrder = vi.mocked(setMessagePlace).mock.invocationCallOrder[0];
    const textOrder = vi.mocked(setMessageShopText).mock.invocationCallOrder[0];
    expect(typeof placeOrder).toBe('number');
    expect(typeof textOrder).toBe('number');
    expect(Number(textOrder)).toBeLessThan(Number(placeOrder));
    delete (window as { google?: unknown }).google;
    vi.unstubAllGlobals();
  });

  it('writes the text before the place when the note had no place yet', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    const newText = 'Cafe Sol is open every morning.';
    const pin = {
      lat: 47.3769,
      lng: 8.5417,
      label: 'Happyland',
      address: {
        street: 'Bahnhofstrasse',
        houseNumber: '12',
        postalCode: '8001',
        city: 'Zürich',
        country: 'CH',
      },
    };
    const stored: ForumMessage = { ...shopMessage, place: undefined };
    vi.mocked(setMessageShopText).mockResolvedValue({
      ...stored,
      text: `${newText}\n\n#21GiftsShop`,
    });
    vi.mocked(setMessagePlace).mockResolvedValue({ ...stored, place: pin });
    const listeners = stubShopMaps();
    renderEdit(<ShopNoteEditControl message={stored} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await screen.findByLabelText('Shop name');
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 14.6, lng: () => 120.98 } });
    fillShopAddressFields('Happyland');
    fireEvent.click(await screen.findByRole('button', { name: 'Use this place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: newText },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(setMessagePlace).toHaveBeenCalled();
      expect(setMessageShopText).toHaveBeenCalled();
    });
    const placeOrder = vi.mocked(setMessagePlace).mock.invocationCallOrder[0];
    const textOrder = vi.mocked(setMessageShopText).mock.invocationCallOrder[0];
    expect(Number(textOrder)).toBeLessThan(Number(placeOrder));
    delete (window as { google?: unknown }).google;
    vi.unstubAllGlobals();
  });

  it('writes the text before the place when the stored place has no address', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    const newText = 'Cafe Sol is open every morning.';
    const pin = {
      lat: 47.3769,
      lng: 8.5417,
      label: 'Happyland',
      address: {
        street: 'Bahnhofstrasse',
        houseNumber: '12',
        postalCode: '8001',
        city: 'Zürich',
        country: 'CH',
      },
    };
    const stored: ForumMessage = {
      ...shopMessage,
      place: { lat: 47.3769, lng: 8.5417, label: 'Cafe Luna' },
    };
    vi.mocked(setMessageShopText).mockResolvedValue({
      ...stored,
      text: `${newText}\n\n#21GiftsShop`,
    });
    vi.mocked(setMessagePlace).mockResolvedValue({ ...stored, place: pin });
    stubShopMaps();
    renderEdit(<ShopNoteEditControl message={stored} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    expect(await screen.findByLabelText('Shop name')).toHaveProperty('value', 'Cafe Luna');
    fillShopAddressFields('Happyland');
    fireEvent.click(await screen.findByRole('button', { name: 'Use this place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: newText },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(setMessagePlace).toHaveBeenCalled();
      expect(setMessageShopText).toHaveBeenCalled();
    });
    const placeOrder = vi.mocked(setMessagePlace).mock.invocationCallOrder[0];
    const textOrder = vi.mocked(setMessageShopText).mock.invocationCallOrder[0];
    expect(typeof placeOrder).toBe('number');
    expect(typeof textOrder).toBe('number');
    expect(Number(textOrder)).toBeLessThan(Number(placeOrder));
    delete (window as { google?: unknown }).google;
    vi.unstubAllGlobals();
  });
});
