import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopNoteEditControl } from '@/components/ShopNoteEditControl';
import { fetchShopNoteEdits, setMessageShopText } from '@/lib/api';
import type { Account, ForumMessage } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  setMessageShopText: vi.fn(),
  fetchShopNoteEdits: vi.fn(),
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
    renderWithLocale(<ShopNoteEditControl message={shopMessage} onUpdated={onUpdated} />);
    const pencil = screen.getByRole('button', { name: 'Edit shop note' });
    fireEvent.keyDown(pencil, { key: 'Enter' });
    fireEvent.click(pencil);
    expect(await screen.findByRole('heading', { name: 'History' })).toBeTruthy();
    expect(screen.getAllByText(/Ada ·/).length).toBeGreaterThan(0);
    expect(screen.getByText('Cafe Luna → None')).toBeTruthy();
    expect(screen.getByText(/acc-2 · not-a-date · Place/)).toBeTruthy();
    expect(screen.getByText('None → 14.5, 120.9')).toBeTruthy();
    expect(screen.getByText('None → Stall')).toBeTruthy();
    expect(screen.getByText('None → @luna')).toBeTruthy();
    expect(screen.getByText('None → None')).toBeTruthy();
    const box = screen.getByRole('textbox', { name: 'Edit shop note' });
    expect(box).toHaveProperty('value', 'Cafe Luna');
    fireEvent.change(box, { target: { value: 'Cafe Sol' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith('shop1', 'Cafe Sol\n\n#21GiftsShop');
    });
    expect(setMessageShopText).toHaveBeenCalledWith('token', 'shop1', 'Cafe Sol');
    expect(screen.queryByRole('textbox', { name: 'Edit shop note' })).toBeNull();
  });

  it('keeps the panel open when the save fails and shows an empty or failed history', async () => {
    signIn('founder');
    vi.mocked(fetchShopNoteEdits).mockResolvedValueOnce([]);
    vi.mocked(setMessageShopText).mockRejectedValue(new Error('no'));
    renderWithLocale(<ShopNoteEditControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect(await screen.findByText('No edits yet')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Could not save this shop note',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('textbox')).toBeNull();

    vi.mocked(fetchShopNoteEdits).mockRejectedValue(new Error('down'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect(await screen.findByText('Could not load the history')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit shop note' }));
    expect(screen.queryByText('Could not load the history')).toBeNull();
  });
});
