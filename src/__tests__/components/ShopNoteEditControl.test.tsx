import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis',
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

const shopMessage: ForumMessage = {
  id: 'shop1',
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
};

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
    ]);
    vi.mocked(setMessageShopText).mockResolvedValue({
      ...shopMessage,
      text: 'Cafe Sol\n\n#21GiftsShop',
    });
    const onUpdated = vi.fn();
    renderWithLocale(
      <ShopNoteEditControl
        message={{ ...shopMessage, place: { lat: 1, lng: 2, label: null } }}
        onUpdated={onUpdated}
      />,
    );
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
    expect(screen.getByText('None → 14.5, 120.9')).toBeTruthy();
    expect(screen.getByText('None → Stall')).toBeTruthy();
    expect(screen.getByText('None → @luna')).toBeTruthy();
    expect(screen.getByText('None → None')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const box = screen.getByRole('textbox', { name: 'Shop text' });
    expect(box).toHaveProperty('value', 'Cafe Luna');
    fireEvent.change(box, { target: { value: 'Cafe Sol' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'shop1', text: 'Cafe Sol\n\n#21GiftsShop' }),
      );
    });
    expect(setMessageShopText).toHaveBeenCalledWith('token', 'shop1', 'Cafe Sol');
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
      target: { value: 'Cafe Sol' },
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
          place: { lat: 9, lng: 8, label: 'Old' },
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
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: 'Cafe Sol' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('21.gifts username'), { target: { value: '@luna' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalled();
    });
    expect(setMessagePlace).toHaveBeenCalledWith('token', 'shop1', null);
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
      target: { value: 'Cafe Sol' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(setMessageShopText).toHaveBeenCalledWith('token', 'shop1', 'Cafe Sol');
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
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(setMessageShopText).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
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
      target: { value: 'Cafe Sol' },
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
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(setMessageShopText).not.toHaveBeenCalled();
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not save this shop note',
    );
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

  it('reports a whole save once, and not when a later part of the save fails', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    vi.mocked(setMessageShopText).mockResolvedValue({
      ...shopMessage,
      text: 'Cafe Sol\n\n#21GiftsShop',
    });
    vi.mocked(setMessageShopAccount).mockRejectedValueOnce(new Error('no'));
    const onUpdated = vi.fn();
    const onSaved = vi.fn();
    renderWithLocale(
      <ShopNoteEditControl
        message={{
          ...shopMessage,
          shopAccount: { id: 'old', username: 'old', name: 'Old' },
        }}
        onUpdated={onUpdated}
        onSaved={onSaved}
      />,
    );
    const save = async (): Promise<void> => {
      fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
        target: { value: 'Cafe Sol' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.change(screen.getByLabelText('21.gifts username'), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    };
    await save();
    // The text is saved, the user is not: the row takes the text, the whole save is not reported.
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not save this shop note',
    );
    expect(onUpdated).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
    vi.mocked(setMessageShopAccount).mockResolvedValue({ ...shopMessage });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('button', { name: 'Save changes' })).toBeNull();
  });

  it('reports a partly written save when the editor is closed', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    vi.mocked(setMessageShopText).mockResolvedValue({
      ...shopMessage,
      text: 'Cafe Sol\n\n#21GiftsShop',
    });
    vi.mocked(setMessageShopAccount).mockRejectedValueOnce(new Error('no'));
    const onSaved = vi.fn();
    const view = renderWithLocale(
      <ShopNoteEditControl
        message={{
          ...shopMessage,
          shopAccount: { id: 'old', username: 'old', name: 'Old' },
        }}
        onUpdated={vi.fn()}
        onSaved={onSaved}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: 'Cafe Sol' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('21.gifts username'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not save this shop note',
    );
    expect(onSaved).not.toHaveBeenCalled();
    // Closing with the text already written reports it once.
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect(onSaved).toHaveBeenCalledTimes(1);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit shop note' }));
    await screen.findByText('1 / 5 · Photos');
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect(onSaved).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('reports a partly written save when the editor unmounts while open', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    vi.mocked(setMessageShopText).mockResolvedValue({
      ...shopMessage,
      text: 'Cafe Sol\n\n#21GiftsShop',
    });
    vi.mocked(setMessageShopAccount).mockRejectedValueOnce(new Error('no'));
    const onSaved = vi.fn();
    const view = renderWithLocale(
      <ShopNoteEditControl
        message={{
          ...shopMessage,
          shopAccount: { id: 'old', username: 'old', name: 'Old' },
        }}
        onUpdated={vi.fn()}
        onSaved={onSaved}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: 'Cafe Sol' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('21.gifts username'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByRole('alert');
    expect(onSaved).not.toHaveBeenCalled();
    view.unmount();
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('reports once when the editor unmounts while a save is still running', async () => {
    signIn();
    vi.mocked(fetchShopNoteEdits).mockResolvedValue([]);
    const deferred = <T,>(): {
      promise: Promise<T>;
      resolve: (v: T) => void;
      reject: (e: unknown) => void;
    } => {
      let resolve: (v: T) => void = () => undefined;
      let reject: (e: unknown) => void = () => undefined;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
    const run = async (finish: 'fail' | 'succeed', unmountAfterText: boolean): Promise<number> => {
      const text = deferred<ForumMessage>();
      const user = deferred<ForumMessage>();
      vi.mocked(setMessageShopText).mockReturnValueOnce(text.promise);
      vi.mocked(setMessageShopAccount).mockReturnValueOnce(user.promise);
      const onSaved = vi.fn();
      const view = renderWithLocale(
        <ShopNoteEditControl
          message={{
            ...shopMessage,
            shopAccount: { id: 'old', username: 'old', name: 'Old' },
          }}
          onUpdated={vi.fn()}
          onSaved={onSaved}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
        target: { value: 'Cafe Sol' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.change(screen.getByLabelText('21.gifts username'), { target: { value: '' } });
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
      await waitFor(() => {
        expect(setMessageShopText).toHaveBeenCalled();
      });
      if (!unmountAfterText) {
        view.unmount();
      }
      text.resolve({ ...shopMessage, text: 'Cafe Sol\n\n#21GiftsShop' });
      await waitFor(() => {
        expect(setMessageShopAccount).toHaveBeenCalled();
      });
      if (unmountAfterText) {
        view.unmount();
      }
      // Nothing is reported while the save is still running.
      expect(onSaved).not.toHaveBeenCalled();
      if (finish === 'fail') {
        user.reject(new Error('no'));
      } else {
        user.resolve({ ...shopMessage });
      }
      await Promise.resolve();
      await Promise.resolve();
      await waitFor(() => {
        expect(onSaved).toHaveBeenCalled();
      });
      vi.mocked(setMessageShopText).mockClear();
      vi.mocked(setMessageShopAccount).mockClear();
      return onSaved.mock.calls.length;
    };
    expect(await run('fail', false)).toBe(1);
    expect(await run('succeed', true)).toBe(1);
    expect(await run('fail', true)).toBe(1);
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
    vi.mocked(setMessageShopText).mockImplementation(async () => {
      expect(keptStillReads(fetchMock)).toBe(1);
      return { ...shopMessage, text: 'Cafe Sol\n\n#21GiftsShop' };
    });
    vi.mocked(setMessagePlace).mockRejectedValueOnce(new Error('no'));
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
          place: { lat: 1, lng: 2, label: 'Old' },
        }}
        existingPhotos={['blob:kept']}
        onUpdated={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect(await screen.findByText('1 / 5 · Photos')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Shop text' }), {
      target: { value: 'Cafe Sol' },
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
});
