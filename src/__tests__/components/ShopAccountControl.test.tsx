import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopAccountControl } from '@/components/ShopAccountControl';
import { setMessageShopAccount } from '@/lib/api';
import type { Account, ForumMessage } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({ setMessageShopAccount: vi.fn() }));

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

const lunaAccount = { id: 'acc-luna', username: 'luna', name: 'Luna' };

afterEach(() => {
  cleanup();
  useAuthStore.getState().clearAuth();
  vi.clearAllMocks();
});

describe('ShopAccountControl', () => {
  it('hides on a reply', () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    renderWithLocale(
      <ShopAccountControl message={{ ...shopMessage, parentId: 'm1' }} onUpdated={vi.fn()} />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('hides on a hidden note', () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    renderWithLocale(
      <ShopAccountControl
        message={{ ...shopMessage, deletedAt: '2026-08-28T13:00:00.000Z' }}
        onUpdated={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('hides on a non-shop note', () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    renderWithLocale(
      <ShopAccountControl
        message={{ ...shopMessage, text: 'Hello from Ada' }}
        onUpdated={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each(['basis', 'verified'] as const)('hides for %s', (role) => {
    useAuthStore.setState({ session: 'token', account: { ...account, role } });
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('hides without a session', () => {
    useAuthStore.setState({ session: null, account: { ...account, role: 'moderator' } });
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows Add an account for a moderator', () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Add an account' });
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(button).toBeTruthy();
  });

  it('saves a username and calls onUpdated with the returned account', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    vi.mocked(setMessageShopAccount).mockResolvedValue({
      ...shopMessage,
      shopAccount: lunaAccount,
    });
    const onUpdated = vi.fn();
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'luna' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save account' }));
    await waitFor(() => {
      expect(setMessageShopAccount).toHaveBeenCalledWith('token', 'shop1', 'luna');
    });
    expect(onUpdated).toHaveBeenCalledWith('shop1', lunaAccount);
  });

  it('shows the missing-username alert and keeps the panel open', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    vi.mocked(setMessageShopAccount).mockRejectedValue(new Error('No account with that username'));
    const onUpdated = vi.fn();
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'luna' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save account' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('No account with that username.');
    expect(screen.getByRole('button', { name: 'Save account' })).toBeTruthy();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('does not call onUpdated and shows the alert when save fails', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    vi.mocked(setMessageShopAccount).mockRejectedValue(new Error('Could not save account'));
    const onUpdated = vi.fn();
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'luna' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save account' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain(
      'The account could not be saved. Please try again.',
    );
    expect(screen.getByRole('button', { name: 'Save account' })).toBeTruthy();
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('removes the account with a null username', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    vi.mocked(setMessageShopAccount).mockResolvedValue(shopMessage);
    const onUpdated = vi.fn();
    renderWithLocale(
      <ShopAccountControl
        message={{ ...shopMessage, shopAccount: lunaAccount }}
        onUpdated={onUpdated}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit account' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove account' }));
    await waitFor(() => {
      expect(setMessageShopAccount).toHaveBeenCalledWith('token', 'shop1', null);
    });
    expect(onUpdated).toHaveBeenCalledWith('shop1', null);
  });

  it('strips one leading @ before save', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    vi.mocked(setMessageShopAccount).mockResolvedValue({
      ...shopMessage,
      shopAccount: lunaAccount,
    });
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: '  @luna' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save account' }));
    await waitFor(() => {
      expect(setMessageShopAccount).toHaveBeenCalledWith('token', 'shop1', 'luna');
    });
  });

  it('shows the missing alert for an empty username without calling the API', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: '   @' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save account' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('No account with that username.');
    expect(setMessageShopAccount).not.toHaveBeenCalled();
  });

  it('shows the save-failed alert when remove throws', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    vi.mocked(setMessageShopAccount).mockRejectedValue(new Error('Could not save account'));
    const onUpdated = vi.fn();
    renderWithLocale(
      <ShopAccountControl
        message={{ ...shopMessage, shopAccount: lunaAccount }}
        onUpdated={onUpdated}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit account' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove account' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain(
      'The account could not be saved. Please try again.',
    );
    expect(onUpdated).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Remove account' })).toBeTruthy();
  });

  it('passes null when the saved message omits shopAccount', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    vi.mocked(setMessageShopAccount).mockResolvedValue(shopMessage);
    const onUpdated = vi.fn();
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'luna' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save account' }));
    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith('shop1', null);
    });
  });

  it('shows the save-failed alert when save rejects a non-Error', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    vi.mocked(setMessageShopAccount).mockRejectedValue('nope');
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'luna' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save account' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain(
      'The account could not be saved. Please try again.',
    );
  });
});
