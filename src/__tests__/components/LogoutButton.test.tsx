import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LogoutButton } from '@/components/LogoutButton';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { logLogout } from '@/lib/interaction-log';
import { disablePush } from '@/lib/push';
import { clearSession } from '@/lib/session-storage';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const replace = vi.fn();
const cancel = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { replace: typeof replace } => ({ replace }),
}));
vi.mock('@/hooks/usePasskeyLogin', () => ({ usePasskeyLogin: vi.fn() }));
vi.mock('@/lib/session-storage', () => ({
  loadSession: vi.fn(),
  saveSession: vi.fn(),
  clearSession: vi.fn(),
}));
vi.mock('@/lib/push', () => ({
  disablePush: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(() => {
  replace.mockClear();
  cancel.mockClear();
  vi.mocked(clearSession).mockClear();
  vi.mocked(disablePush).mockReset();
  vi.mocked(disablePush).mockResolvedValue(undefined);
  vi.mocked(logLogout).mockReset().mockResolvedValue(undefined);
  vi.mocked(usePasskeyLogin).mockReturnValue({
    status: 'idle',
    login: vi.fn(),
    register: vi.fn(),
    submitName: vi.fn(),
    authenticate: vi.fn(),
    retry: vi.fn(),
    cancel,
    error: null,
    nameError: null,
  });
  useAuthStore.setState({
    session: 'tok',
    lockedSession: null,
    account: {
      id: 'acc_1',
      linkingKey: null,
      role: 'basis',
      name: 'Ada',
      location: null,
      lightningAddress: null,
      lightningAddressVerified: false,
      forumLawsDismissed: false,
      createdAt: 1,
      rulesAgreedAt: null,
      viewKey: 'a'.repeat(64),
      aboutMe: null,
      aboutMeHasPhoto: false,
      setup: null,
      missing: [],
    },
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LogoutButton', () => {
  it('clears the session and returns to login', async () => {
    renderWithLocale(<LogoutButton />);
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(cancel).toHaveBeenCalled();
    await waitFor(() => {
      expect(clearSession).toHaveBeenCalled();
    });
    expect(disablePush).toHaveBeenCalledWith('tok');
    const disableOrder = vi.mocked(disablePush).mock.invocationCallOrder[0];
    const clearOrder = vi.mocked(clearSession).mock.invocationCallOrder[0];
    expect(disableOrder).toBeTypeOf('number');
    expect(clearOrder).toBeTypeOf('number');
    expect(disableOrder as number).toBeLessThan(clearOrder as number);
    expect(useAuthStore.getState().account).toBeNull();
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('sends the logout event with the session before it is cleared', async () => {
    let sessionAtLogout: string | null = null;
    vi.mocked(logLogout).mockImplementation(async () => {
      sessionAtLogout = useAuthStore.getState().session;
    });
    renderWithLocale(<LogoutButton />);
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    await waitFor(() => {
      expect(clearSession).toHaveBeenCalled();
    });
    expect(logLogout).toHaveBeenCalledTimes(1);
    expect(sessionAtLogout).toBe('tok');
    const logoutOrder = vi.mocked(logLogout).mock.invocationCallOrder[0];
    const clearOrder = vi.mocked(clearSession).mock.invocationCallOrder[0];
    expect(logoutOrder as number).toBeLessThan(clearOrder as number);
  });

  it('ends the session once when log out is clicked again while it runs', async () => {
    let finish: () => void = () => undefined;
    vi.mocked(logLogout).mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    renderWithLocale(<LogoutButton />);
    const button = screen.getByRole('button', { name: /log out/i });
    fireEvent.click(button);
    fireEvent.click(button);
    finish();
    await waitFor(() => {
      expect(clearSession).toHaveBeenCalled();
    });
    expect(logLogout).toHaveBeenCalledTimes(1);
    expect(disablePush).toHaveBeenCalledTimes(1);
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it('ends the session after 5 s when the logout event cannot be sent', async () => {
    vi.useFakeTimers();
    vi.mocked(logLogout).mockReturnValue(new Promise(() => undefined));
    renderWithLocale(<LogoutButton />);
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    await vi.advanceTimersByTimeAsync(4_999);
    expect(clearSession).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(clearSession).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('still clears and replaces when disablePush rejects', async () => {
    vi.mocked(disablePush).mockRejectedValueOnce(new Error('offline'));
    renderWithLocale(<LogoutButton />);
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    expect(cancel).toHaveBeenCalled();
    await waitFor(() => {
      expect(clearSession).toHaveBeenCalled();
    });
    expect(disablePush).toHaveBeenCalledWith('tok');
    expect(useAuthStore.getState().account).toBeNull();
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('clears immediately when there is no active token', async () => {
    useAuthStore.setState({ session: null, account: null, lockedSession: null });
    renderWithLocale(<LogoutButton />);
    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    await waitFor(() => expect(clearSession).toHaveBeenCalled());
    expect(disablePush).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/login');
  });
});
