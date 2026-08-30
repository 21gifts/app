import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LogoutButton } from '@/components/LogoutButton';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
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
  vi.mocked(usePasskeyLogin).mockReturnValue({
    status: 'idle',
    login: vi.fn(),
    register: vi.fn(),
    authenticate: vi.fn(),
    retry: vi.fn(),
    cancel,
    error: null,
  });
  useAuthStore.setState({
    session: 'tok',
    account: {
      id: 'acc_1',
      linkingKey: null,
      role: 'basis',
      name: 'Ada',
      lightningAddress: null,
      lightningAddressVerified: false,
      forumLawsDismissed: false,
      createdAt: 1,
      rulesAgreedAt: null,
      viewKey: 'a'.repeat(64),
    },
  });
});

afterEach(() => {
  cleanup();
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
});
