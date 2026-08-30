import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingGate } from '@/components/OnboardingGate';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { fetchMe } from '@/lib/api';
import { loadSession } from '@/lib/session-storage';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { replace: typeof replace } => ({ replace }),
}));
vi.mock('@/hooks/usePasskeyLogin', () => ({ usePasskeyLogin: vi.fn() }));
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
  lightningAddress: null as string | null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1,
  rulesAgreedAt: null as number | null,
  viewKey: 'a'.repeat(64),
};

const complete = {
  ...account,
  name: 'Ada',
  lightningAddress: 'alice@walletofsatoshi.com',
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
};

beforeEach(() => {
  replace.mockClear();
  vi.mocked(loadSession).mockReturnValue(null);
  vi.mocked(usePasskeyLogin).mockReturnValue({
    status: 'idle',
    login: vi.fn(),
    register: vi.fn(),
    authenticate: vi.fn(),
    retry: vi.fn(),
    cancel: vi.fn(),
  });
  useAuthStore.setState({ session: null, account: null });
});

afterEach(() => {
  cleanup();
});

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

  it('sends a signed-in visitor from login to the name screen', () => {
    useAuthStore.setState({ session: 'tok', account });
    renderWithLocale(
      <OnboardingGate screen="login">
        <p>login-ui</p>
      </OnboardingGate>,
    );
    expect(replace).toHaveBeenCalledWith('/setup/name');
  });

  it('sends a logged-out visitor from welcome to login', () => {
    renderWithLocale(
      <OnboardingGate screen="welcome">
        <p>welcome-ui</p>
      </OnboardingGate>,
    );
    expect(replace).toHaveBeenCalledWith('/login');
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

  it('sends a named account from the name screen to the address screen', async () => {
    useAuthStore.setState({ session: 'tok', account: { ...account, name: 'Ada' } });
    renderWithLocale(
      <OnboardingGate screen="name">
        <p>name-ui</p>
      </OnboardingGate>,
    );
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/address');
    });
  });

  it('renders address children when the account has a name and no address', async () => {
    useAuthStore.setState({ session: 'tok', account: { ...account, name: 'Ada' } });
    renderWithLocale(
      <OnboardingGate screen="address">
        <p>address-ui</p>
      </OnboardingGate>,
    );
    expect(await screen.findByText('address-ui')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('sends name+address without agreement from the address screen to rules', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, name: 'Ada', lightningAddress: 'alice@walletofsatoshi.com' },
    });
    renderWithLocale(
      <OnboardingGate screen="address">
        <p>address-ui</p>
      </OnboardingGate>,
    );
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/rules');
    });
  });

  it('sends name+address without agreement from welcome to rules', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, name: 'Ada', lightningAddress: 'alice@walletofsatoshi.com' },
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

  it('sends name+address without agreement from profile to rules', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, name: 'Ada', lightningAddress: 'alice@walletofsatoshi.com' },
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

  it('renders rules children when name and address are saved but agreement is missing', async () => {
    useAuthStore.setState({
      session: 'tok',
      account: { ...account, name: 'Ada', lightningAddress: 'alice@walletofsatoshi.com' },
    });
    renderWithLocale(
      <OnboardingGate screen="rules">
        <p>rules-ui</p>
      </OnboardingGate>,
    );
    expect(await screen.findByText('rules-ui')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('renders welcome children when name, address, and agreement are saved', async () => {
    useAuthStore.setState({ session: 'tok', account: complete });
    renderWithLocale(
      <OnboardingGate screen="welcome">
        <p>welcome-ui</p>
      </OnboardingGate>,
    );
    expect(await screen.findByText('welcome-ui')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('renders profile children when name, address, and agreement are saved', async () => {
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

  it('sends a named account without an address from profile to the address screen', async () => {
    useAuthStore.setState({ session: 'tok', account: { ...account, name: 'Ada' } });
    renderWithLocale(
      <OnboardingGate screen="profile">
        <p>profile-ui</p>
      </OnboardingGate>,
    );
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/address');
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
