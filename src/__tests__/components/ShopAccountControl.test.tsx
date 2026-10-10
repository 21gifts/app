import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopAccountControl } from '@/components/ShopAccountControl';
import { setMessageShopAccount } from '@/lib/api';
import type { Account, ForumMessage } from '@/lib/api-types';
import { searchMentionAccounts } from '@/lib/mention-search';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({ setMessageShopAccount: vi.fn() }));
vi.mock('@/lib/mention-search', () => ({
  searchMentionAccounts: vi.fn(async () => []),
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

const lunaAccount = { id: 'acc-luna', username: 'luna', name: 'Luna' };

afterEach(() => {
  cleanup();
  useAuthStore.getState().clearAuth();
  vi.clearAllMocks();
  vi.mocked(searchMentionAccounts).mockReset();
  vi.mocked(searchMentionAccounts).mockResolvedValue([]);
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
    expect((screen.getByLabelText('Username') as HTMLInputElement).value).toBe('@luna');
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

  it('opens with @ and fills the chosen person', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    vi.mocked(searchMentionAccounts).mockResolvedValue([
      { id: 'acc-luna', username: 'luna', name: 'Luna' },
    ]);
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
    expect((screen.getByLabelText('Username') as HTMLInputElement).value).toBe('@');
    expect(await screen.findByRole('option', { name: '@luna' })).toBeTruthy();
    expect(screen.getByText('Luna')).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole('option', { name: '@luna' }));
    expect((screen.getByLabelText('Username') as HTMLInputElement).value).toBe('@luna');
    expect(searchMentionAccounts).toHaveBeenCalledWith('token', '');
  });

  it('selects a person from the keyboard click', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    vi.mocked(searchMentionAccounts).mockResolvedValue([
      { id: 'acc-luna', username: 'luna', name: 'Luna' },
    ]);
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
    fireEvent.click(await screen.findByRole('option', { name: '@luna' }));
    expect((screen.getByLabelText('Username') as HTMLInputElement).value).toBe('@luna');
  });

  it('hides suggestions when the field is no longer a username', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    vi.mocked(searchMentionAccounts).mockResolvedValue([
      { id: 'acc-luna', username: 'luna', name: 'Luna' },
    ]);
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
    expect(await screen.findByRole('listbox', { name: 'People' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: '@luna shop' } });
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  it('closes the list when the field is @ followed by a space', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    vi.mocked(searchMentionAccounts).mockResolvedValue([
      { id: 'acc-luna', username: 'luna', name: 'Luna' },
    ]);
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
    expect(await screen.findByRole('listbox', { name: 'People' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: '@ ' } });
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  it('closes the list when a username has a trailing space', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    vi.mocked(searchMentionAccounts).mockResolvedValue([
      { id: 'acc-luna', username: 'luna', name: 'Luna' },
    ]);
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
    expect(await screen.findByRole('option', { name: '@luna' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: '@luna ' } });
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: '@luna' })).toBeNull();
    });
  });

  it('closes the list when the field does not start with @', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    vi.mocked(searchMentionAccounts).mockResolvedValue([
      { id: 'acc-luna', username: 'luna', name: 'Luna' },
    ]);
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
    expect(await screen.findByRole('listbox', { name: 'People' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'luna' } });
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  it('closes the list when the prefix is not a username', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    vi.mocked(searchMentionAccounts).mockResolvedValue([
      { id: 'acc-ada', username: 'ada', name: 'Ada' },
    ]);
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
    expect(await screen.findByRole('listbox', { name: 'People' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: '@.ada' } });
    await waitFor(() => {
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  it('hides the list when the first page fails', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    vi.mocked(searchMentionAccounts).mockRejectedValue(new Error('offline'));
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
    await waitFor(() => {
      expect(searchMentionAccounts).toHaveBeenCalledWith('token', '');
    });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('drops the filtered rows when a prefix search fails', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    vi.mocked(searchMentionAccounts).mockImplementation(async (_token, query) => {
      if (query === '') {
        return [{ id: 'acc-ada', username: 'ada', name: 'Ada' }];
      }
      throw new Error('offline');
    });
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: '@a' } });
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: '@ada' })).toBeNull();
    });
  });

  it('shows the current prefix again while the same search is retried', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    let prefixCalls = 0;
    vi.mocked(searchMentionAccounts).mockImplementation((_token, query) => {
      if (query === '') {
        return Promise.resolve([{ id: 'acc-ada', username: 'ada', name: 'Ada' }]);
      }
      prefixCalls += 1;
      if (prefixCalls === 1) {
        return Promise.reject(new Error('offline'));
      }
      return new Promise(() => undefined);
    });
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: '@a' } });
    await waitFor(() => {
      expect(screen.queryByRole('option', { name: '@ada' })).toBeNull();
    });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: '@' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: '@a' } });
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
  });

  it('keeps the current prefix when an older prefix search fails', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    let rejectFirstPrefix: ((error: Error) => void) | undefined;
    vi.mocked(searchMentionAccounts).mockImplementation((_token, query) => {
      if (query === '') {
        return Promise.resolve([{ id: 'acc-ada', username: 'ada', name: 'Ada' }]);
      }
      if (query === 'a' && rejectFirstPrefix === undefined) {
        return new Promise((_resolve, reject) => {
          rejectFirstPrefix = reject;
        });
      }
      return new Promise(() => undefined);
    });
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
    expect(await screen.findByRole('option', { name: '@ada' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: '@a' } });
    await waitFor(() => {
      expect(rejectFirstPrefix).toBeTypeOf('function');
    });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: '@ab' } });
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: '@a' } });
    expect(screen.getByRole('option', { name: '@ada' })).toBeTruthy();
    await act(async () => {
      rejectFirstPrefix?.(new Error('late'));
    });
    expect(screen.getByRole('option', { name: '@ada' })).toBeTruthy();
  });

  it('drops usernames that do not start with the typed prefix', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    vi.mocked(searchMentionAccounts).mockImplementation(async (_token, query) => {
      if (query === '') {
        return [
          { id: 'acc-ada', username: 'ada', name: 'Ada Lovelace' },
          { id: 'acc-luna', username: 'luna', name: 'Luna' },
        ];
      }
      return new Promise(() => undefined);
    });
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
    expect(await screen.findByRole('option', { name: '@luna' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: '@a' } });
    expect(screen.queryByRole('option', { name: '@luna' })).toBeNull();
    expect(screen.getByRole('option', { name: '@ada' })).toBeTruthy();
  });

  it('shows at most eight people', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    vi.mocked(searchMentionAccounts).mockResolvedValue(
      Array.from({ length: 9 }, (_, index) => ({
        id: `acc-${index}`,
        username: `user${index}`,
        name: `User ${index}`,
      })),
    );
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
    expect(await screen.findByRole('option', { name: '@user0' })).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(8);
    expect(screen.queryByRole('option', { name: '@user8' })).toBeNull();
  });

  it('omits the display name when it matches the username', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    vi.mocked(searchMentionAccounts).mockResolvedValue([
      { id: 'acc-ada', username: 'ada', name: 'ada' },
    ]);
    renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
    const option = await screen.findByRole('option', { name: '@ada' });
    expect(option.querySelectorAll('span')).toHaveLength(1);
  });

  it('opens the panel upward when the button is low on the screen', async () => {
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    const originalHeight = window.innerHeight;
    const originalWidth = window.innerWidth;
    window.innerHeight = 768;
    window.innerWidth = 390;
    HTMLElement.prototype.getBoundingClientRect = () =>
      ({
        top: 700,
        bottom: 744,
        left: 16,
        right: 56,
        width: 40,
        height: 44,
        x: 16,
        y: 700,
        toJSON() {
          return {};
        },
      }) as DOMRect;
    try {
      useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
      vi.mocked(searchMentionAccounts).mockResolvedValue([
        { id: 'acc-luna', username: 'luna', name: 'Luna' },
      ]);
      renderWithLocale(<ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
      const field = await screen.findByLabelText('Username');
      const panel = field.parentElement;
      expect(panel).not.toBeNull();
      expect(panel?.className).toContain('fixed');
      expect((panel as HTMLElement).style.bottom).toBe('76px');
      expect((panel as HTMLElement).style.top).toBe('');
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalRect;
      window.innerHeight = originalHeight;
      window.innerWidth = originalWidth;
    }
  });

  it('drops rows until the panel fits under the chrome', async () => {
    const originalRect = HTMLElement.prototype.getBoundingClientRect;
    const originalViewport = window.visualViewport;
    const listeners: Record<string, EventListener> = {};
    let panelTop = 0;
    let panelHeight = 100;
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: {
        offsetTop: 0,
        height: 400,
        addEventListener(type: string, listener: EventListener) {
          listeners[type] = listener;
        },
        removeEventListener(type: string) {
          delete listeners[type];
        },
      },
    });
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      const element = this as HTMLElement;
      if (element.hasAttribute('data-app-chrome')) {
        return {
          top: 0,
          bottom: 64,
          left: 0,
          right: 390,
          width: 390,
          height: 64,
          x: 0,
          y: 0,
          toJSON() {
            return {};
          },
        } as DOMRect;
      }
      if (element.className.includes('fixed')) {
        const top = panelTop;
        return {
          top,
          bottom: top + panelHeight,
          left: 8,
          right: 296,
          width: 288,
          height: panelHeight,
          x: 8,
          y: top,
          toJSON() {
            return {};
          },
        } as DOMRect;
      }
      return {
        top: 300,
        bottom: 344,
        left: 16,
        right: 56,
        width: 40,
        height: 44,
        x: 16,
        y: 300,
        toJSON() {
          return {};
        },
      } as DOMRect;
    };
    try {
      useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
      vi.mocked(searchMentionAccounts).mockResolvedValue(
        Array.from({ length: 8 }, (_, index) => ({
          id: `acc-${index}`,
          username: `user${index}`,
          name: `User ${index}`,
        })),
      );
      renderWithLocale(
        <div data-app-frame>
          <div data-app-chrome />
          <ShopAccountControl message={shopMessage} onUpdated={vi.fn()} />
        </div>,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Add an account' }));
      const field = await screen.findByLabelText('Username');
      await waitFor(() => {
        expect(screen.queryAllByRole('option')).toHaveLength(0);
        expect((field.parentElement as HTMLElement).style.top).toBe('64px');
      });
      panelTop = 64;
      panelHeight = 900;
      listeners['resize']?.(new Event('resize'));
      expect(screen.queryAllByRole('option')).toHaveLength(0);
      expect((field.parentElement as HTMLElement).style.top).toBe('64px');
    } finally {
      HTMLElement.prototype.getBoundingClientRect = originalRect;
      Object.defineProperty(window, 'visualViewport', {
        configurable: true,
        value: originalViewport,
      });
    }
  });
});
