import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingGate } from '@/components/OnboardingGate';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { fetchMe } from '@/lib/api';
import { loadSession } from '@/lib/session-storage';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const walletOpen = vi.hoisted(() => ({ value: true }));
const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { replace: typeof replace } => ({ replace }),
}));
vi.mock('@/hooks/usePasskeyLogin', () => ({ usePasskeyLogin: vi.fn() }));
vi.mock('@/hooks/useWalletOpen', () => ({ useWalletOpen: () => walletOpen.value }));
vi.mock('@/components/WalletLoginCard', () => ({
  WalletLoginCard: () => <p>wallet-login-card</p>,
}));
vi.mock('@/lib/session-storage', () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
}));
vi.mock('@/lib/api', () => ({
  fetchMe: vi.fn(),
}));

const account = {
  id: 'acc_1',
  linkingKey: null as string | null,
  role: 'basis' as const,
  name: null as string | null,
  location: null as string | null,
  lightningAddress: null as string | null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: null as number | null,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: 'name' as const,
  missing: ['name', 'lightning-address', 'rules'] as (
    'wallet' | 'name' | 'username' | 'lightning-address' | 'rules'
  )[],
};

const named = {
  ...account,
  name: 'Ada',
  setup: 'lightning-address' as const,
  missing: ['lightning-address', 'rules'] as ('name' | 'lightning-address' | 'rules')[],
};

const namedUsername = {
  ...named,
  username: 'ada',
  setup: 'rules' as const,
  missing: ['rules'] as ('name' | 'lightning-address' | 'rules')[],
};

const complete = {
  ...namedUsername,
  rulesAgreedAt: 1_700_000_001,
  setup: null,
  missing: [] as ('name' | 'lightning-address' | 'rules')[],
};

beforeEach(() => {
  replace.mockClear();
  walletOpen.value = true;
  vi.mocked(loadSession).mockReturnValue(null);
  vi.mocked(usePasskeyLogin).mockReturnValue({
    status: 'idle',
    login: vi.fn(),
    register: vi.fn(),
    submitName: vi.fn(),
    authenticate: vi.fn(),
    authenticateHeld: vi.fn(),
    retry: vi.fn(),
    cancel: vi.fn(),
    error: null,
    recoveryPending: false,
    walletPasskeyMissed: false,
    clearNameError: vi.fn(),
    nameError: null,
  });
  useAuthStore.setState({ session: null, account: null, lockedSession: null });
});

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
});

const POST_PATH = '/messages/0190a6f2-5b7c-7d1e-9f00-1234567890ab';

describe('OnboardingGate', () => {
  it('renders login children while logged out', () => {
    renderWithLocale(
      <OnboardingGate screen="login">
        <p>login-ui</p>
      </OnboardingGate>,
    );
    expect(screen.getByText('login-ui')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows the wallet login on the login screen for a held-back session', () => {
    useAuthStore.setState({ lockedSession: 'stored' });
    renderWithLocale(
      <OnboardingGate screen="login">
        <p>login-ui</p>
      </OnboardingGate>,
    );
    expect(screen.getByText('wallet-login-card')).toBeTruthy();
    expect(screen.queryByText('login-ui')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('keeps a fresh login on the login screen until its wallet is open, then sends it on', () => {
    walletOpen.value = false;
    useAuthStore.setState({ session: 'tok', account });
    const view = renderWithLocale(
      <OnboardingGate screen="login">
        <p>login-ui</p>
      </OnboardingGate>,
    );
    expect(screen.getByText('wallet-login-card')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
    walletOpen.value = true;
    view.rerender(
      <OnboardingGate screen="login">
        <p>login-ui</p>
      </OnboardingGate>,
    );
    expect(replace).toHaveBeenCalledWith('/setup/name');
  });

  it('shows the wallet login on a signed-in screen for a held-back session without redirecting', () => {
    useAuthStore.setState({ lockedSession: 'stored' });
    renderWithLocale(
      <OnboardingGate screen="profile">
        <p>profile-ui</p>
      </OnboardingGate>,
    );
    expect(screen.getByText('wallet-login-card')).toBeTruthy();
    expect(screen.queryByText('profile-ui')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows the wallet login for an account whose phrase is not open, then shows children', () => {
    walletOpen.value = false;
    useAuthStore.setState({ session: 'tok', account: complete });
    const view = renderWithLocale(
      <OnboardingGate screen="profile">
        <p>profile-ui</p>
      </OnboardingGate>,
    );
    expect(screen.getByText('wallet-login-card')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();

    walletOpen.value = true;
    view.rerender(
      <OnboardingGate screen="profile">
        <p>profile-ui</p>
      </OnboardingGate>,
    );
    expect(screen.getByText('profile-ui')).toBeTruthy();
    expect(screen.queryByText('wallet-login-card')).toBeNull();
  });

  it('sends a signed-in visitor from login to the name screen', () => {
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(
      <OnboardingGate screen="login">
        <p>login-ui</p>
      </OnboardingGate>,
    );
    expect(replace).toHaveBeenCalledWith('/setup/name');
  });

  it('sends a signed-in visitor from login to the name screen when setup is wallet', () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, setup: 'wallet', missing: ['wallet', ...account.missing] },
    });
    renderWithLocale(
      <OnboardingGate screen="login">
        <p>login-ui</p>
      </OnboardingGate>,
    );
    expect(replace).toHaveBeenCalledWith('/setup/name');
  });

  it('sends a signed-in visitor from login to welcome when setup is wallet and the other fields are set', () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        ...complete,
        username: 'ada',
        setup: 'wallet',
        missing: ['wallet'],
      },
    });
    renderWithLocale(
      <OnboardingGate screen="login">
        <p>login-ui</p>
      </OnboardingGate>,
    );
    expect(replace).toHaveBeenCalledWith('/welcome');
  });

  it('sends a finished account from login back to the view named by next', () => {
    window.history.replaceState(null, '', `/login?next=${encodeURIComponent(POST_PATH)}`);
    useAuthStore.setState({ session: 'tok', account: complete });
    renderWithLocale(
      <OnboardingGate screen="login">
        <p>login-ui</p>
      </OnboardingGate>,
    );
    expect(replace).toHaveBeenCalledWith(POST_PATH);
    expect(replace).not.toHaveBeenCalledWith('/welcome');
  });

  it('keeps an unfinished account on its setup step even with a next path', () => {
    window.history.replaceState(null, '', `/login?next=${encodeURIComponent(POST_PATH)}`);
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(
      <OnboardingGate screen="login">
        <p>login-ui</p>
      </OnboardingGate>,
    );
    expect(replace).toHaveBeenCalledWith('/setup/name');
    expect(replace).not.toHaveBeenCalledWith(POST_PATH);
  });

  it.each([
    ['missing', '/login'],
    ['outside', `/login?next=${encodeURIComponent('//evil.com')}`],
    ['login itself', `/login?next=${encodeURIComponent('/login?next=/wallet')}`],
  ])('sends a finished account from login to welcome when next is %s', (_label, url) => {
    window.history.replaceState(null, '', url);
    useAuthStore.setState({ session: 'tok', account: complete });
    renderWithLocale(
      <OnboardingGate screen="login">
        <p>login-ui</p>
      </OnboardingGate>,
    );
    expect(replace).toHaveBeenCalledWith('/welcome');
  });

  it('sends a logged-out visitor on a gated screen to login carrying that screen', () => {
    window.history.replaceState(null, '', '/inbox?thread=abc');
    renderWithLocale(
      <OnboardingGate screen="welcome">
        <p>inbox-ui</p>
      </OnboardingGate>,
    );
    expect(replace).toHaveBeenCalledWith(`/login?next=${encodeURIComponent('/inbox?thread=abc')}`);
  });

  it('lets a complete account open wallet', async () => {
    useAuthStore.setState({ session: 'tok', account: complete });
    renderWithLocale(
      <OnboardingGate screen="wallet">
        <p>wallet-ui</p>
      </OnboardingGate>,
    );
    expect(await screen.findByText('wallet-ui')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('renders wallet children when setup is wallet', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, setup: 'wallet', missing: ['wallet', ...account.missing] },
    });
    renderWithLocale(
      <OnboardingGate screen="wallet">
        <p>wallet-ui</p>
      </OnboardingGate>,
    );
    expect(await screen.findByText('wallet-ui')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects a name-setup account away from wallet', async () => {
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(
      <OnboardingGate screen="wallet">
        <p>wallet-ui</p>
      </OnboardingGate>,
    );
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/name');
    });
  });

  it('renders name children when setup is wallet', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, setup: 'wallet', missing: ['wallet', ...account.missing] },
    });
    renderWithLocale(
      <OnboardingGate screen="name">
        <p>name-ui</p>
      </OnboardingGate>,
    );
    expect(await screen.findByText('name-ui')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends a visitor from welcome to the name screen when setup is wallet and name is missing', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, setup: 'wallet', missing: ['wallet', ...account.missing] },
    });
    renderWithLocale(
      <OnboardingGate screen="welcome">
        <p>welcome-ui</p>
      </OnboardingGate>,
    );
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/name');
    });
  });

  it('renders welcome children when setup is wallet and the other fields are set', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        ...complete,
        username: 'ada',
        setup: 'wallet',
        missing: ['wallet'],
      },
    });
    renderWithLocale(
      <OnboardingGate screen="welcome">
        <p>welcome-ui</p>
      </OnboardingGate>,
    );
    expect(await screen.findByText('welcome-ui')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('renders welcome children for a logged-out visitor', () => {
    renderWithLocale(
      <OnboardingGate screen="welcome" allowGuest>
        <p>welcome-ui</p>
      </OnboardingGate>,
    );
    expect(screen.getByText('welcome-ui')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('shows the wallet login, not the guest welcome view, when a stored session is held back', () => {
    useAuthStore.setState({ lockedSession: 'stored' });
    renderWithLocale(
      <OnboardingGate screen="welcome" allowGuest>
        <p>welcome-ui</p>
      </OnboardingGate>,
    );
    expect(screen.getByText('wallet-login-card')).toBeTruthy();
    expect(screen.queryByText('welcome-ui')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('still sends a logged-out visitor from a welcome-gated shop to login', () => {
    renderWithLocale(
      <OnboardingGate screen="welcome">
        <p>shop-ui</p>
      </OnboardingGate>,
    );
    expect(replace).toHaveBeenCalledWith('/login');
    expect(screen.queryByText('shop-ui')).toBeNull();
  });

  it('renders name children when the account still needs a name', async () => {
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(
      <OnboardingGate screen="name">
        <p>name-ui</p>
      </OnboardingGate>,
    );
    expect(await screen.findByText('name-ui')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends a named account from the name screen to the username screen', async () => {
    useAuthStore.setState({ session: 'tok', account: named });
    renderWithLocale(
      <OnboardingGate screen="name">
        <p>name-ui</p>
      </OnboardingGate>,
    );
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/username');
    });
  });

  it('renders username children when the account has a name and no username', async () => {
    useAuthStore.setState({ session: 'tok', account: named });
    renderWithLocale(
      <OnboardingGate screen="username">
        <p>username-ui</p>
      </OnboardingGate>,
    );
    expect(await screen.findByText('username-ui')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends a named account with a username from the username screen to rules, without an address step', async () => {
    useAuthStore.setState({ session: 'tok', account: { ...named, username: 'ada' } });
    renderWithLocale(
      <OnboardingGate screen="username">
        <p>username-ui</p>
      </OnboardingGate>,
    );
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/rules');
    });
    expect(replace).not.toHaveBeenCalledWith('/setup/address');
    expect(screen.queryByText('username-ui')).toBeNull();
  });

  it('sends name+username without agreement from welcome to rules', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: namedUsername,
    });
    renderWithLocale(
      <OnboardingGate screen="welcome">
        <p>welcome-ui</p>
      </OnboardingGate>,
    );
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/rules');
    });
  });

  it('sends name+username without agreement from profile to rules', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: namedUsername,
    });
    renderWithLocale(
      <OnboardingGate screen="profile">
        <p>profile-ui</p>
      </OnboardingGate>,
    );
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/rules');
    });
  });

  it('renders rules children when name and username are saved but agreement is missing', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: namedUsername,
    });
    renderWithLocale(
      <OnboardingGate screen="rules">
        <p>rules-ui</p>
      </OnboardingGate>,
    );
    expect(await screen.findByText('rules-ui')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('renders welcome children when name, username, and agreement are saved', async () => {
    useAuthStore.setState({ session: 'tok', account: complete });
    renderWithLocale(
      <OnboardingGate screen="welcome">
        <p>welcome-ui</p>
      </OnboardingGate>,
    );
    expect(await screen.findByText('welcome-ui')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('renders profile children when name, username, and agreement are saved', async () => {
    useAuthStore.setState({ session: 'tok', account: complete });
    renderWithLocale(
      <OnboardingGate screen="profile">
        <p>profile-ui</p>
      </OnboardingGate>,
    );
    expect(await screen.findByText('profile-ui')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends a logged-out visitor from profile to login', () => {
    renderWithLocale(
      <OnboardingGate screen="profile">
        <p>profile-ui</p>
      </OnboardingGate>,
    );
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('sends a named account without a username from profile to the username screen', async () => {
    useAuthStore.setState({ session: 'tok', account: named });
    renderWithLocale(
      <OnboardingGate screen="profile">
        <p>profile-ui</p>
      </OnboardingGate>,
    );
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/username');
    });
  });

  it('sends an unnamed account from profile to the name screen', async () => {
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(
      <OnboardingGate screen="profile">
        <p>profile-ui</p>
      </OnboardingGate>,
    );
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/name');
    });
  });

  it('does not bounce a name screen to login while a stored token is hydrating', () => {
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockReturnValue(new Promise(() => undefined));
    renderWithLocale(
      <OnboardingGate screen="name">
        <p>name-ui</p>
      </OnboardingGate>,
    );
    expect(replace).not.toHaveBeenCalled();
  });
});
