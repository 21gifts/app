import { act, cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';
import { useHydrateSession } from '@/hooks/useHydrateSession';
import { fetchMe } from '@/lib/api';
import { clearSession, loadSession } from '@/lib/session-storage';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

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
  linkingKey: `02${'a'.repeat(60)}`,
  role: 'basis' as const,
  name: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  createdAt: 1_700_000_000,
};

/** Mounts the hydration hook. */
function Probe(): ReactElement {
  const { ready } = useHydrateSession();
  return <p>{ready ? 'ready' : 'pending'}</p>;
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ session: null, account: null });
  vi.mocked(loadSession).mockReturnValue(null);
});

afterEach(() => {
  cleanup();
});

describe('useHydrateSession', () => {
  it('is ready immediately when no token is stored', () => {
    vi.mocked(loadSession).mockReturnValue(null);
    renderWithLocale(<Probe />);
    expect(screen.getByText('ready')).toBeTruthy();
  });

  it('stays pending until fetchMe settles when a token is stored', async () => {
    let resolve!: (value: typeof account | null) => void;
    const pending = new Promise<typeof account | null>((r) => {
      resolve = r;
    });
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockReturnValue(pending);

    renderWithLocale(<Probe />);
    expect(screen.getByText('pending')).toBeTruthy();

    await act(async () => {
      resolve(account);
    });
    expect(screen.getByText('ready')).toBeTruthy();
  });

  it('does not clobber a profile already stored for the same token', async () => {
    let resolve!: (value: typeof account | null) => void;
    const pending = new Promise<typeof account | null>((r) => {
      resolve = r;
    });
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockReturnValue(pending);

    renderWithLocale(<Probe />);
    act(() => {
      useAuthStore.getState().setAuth('tok', { ...account, name: 'Ada' });
    });

    await act(async () => {
      resolve(account);
    });

    expect(useAuthStore.getState().account?.name).toBe('Ada');
  });

  it('does not clear a newer session when stale hydration returns 401', async () => {
    let resolve!: (value: typeof account | null) => void;
    const pending = new Promise<typeof account | null>((r) => {
      resolve = r;
    });
    vi.mocked(loadSession).mockReturnValueOnce('old').mockReturnValue('new');
    vi.mocked(fetchMe).mockReturnValue(pending);

    renderWithLocale(<Probe />);
    act(() => {
      useAuthStore.getState().setAuth('new', { ...account, name: 'Ada' });
    });

    await act(async () => {
      resolve(null);
    });

    expect(clearSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBe('new');
  });

  it('ignores stale hydration when the store already holds a different session', async () => {
    let resolve!: (value: typeof account | null) => void;
    const pending = new Promise<typeof account | null>((r) => {
      resolve = r;
    });
    vi.mocked(loadSession).mockReturnValue('old');
    vi.mocked(fetchMe).mockReturnValue(pending);

    renderWithLocale(<Probe />);
    act(() => {
      useAuthStore.getState().setAuth('new', { ...account, name: 'Ada' });
    });

    await act(async () => {
      resolve(account);
    });

    expect(useAuthStore.getState().session).toBe('new');
    expect(useAuthStore.getState().account?.name).toBe('Ada');
  });

  it('clears store and storage when 401 matches the store token', async () => {
    let resolve!: (value: typeof account | null) => void;
    const pending = new Promise<typeof account | null>((r) => {
      resolve = r;
    });
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockReturnValue(pending);

    renderWithLocale(<Probe />);
    act(() => {
      useAuthStore.getState().setAuth('tok', account);
    });

    await act(async () => {
      resolve(null);
    });

    expect(clearSession).toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('does not clobber a newer session when stale hydration succeeds', async () => {
    let resolve!: (value: typeof account | null) => void;
    const pending = new Promise<typeof account | null>((r) => {
      resolve = r;
    });
    vi.mocked(loadSession).mockReturnValueOnce('old').mockReturnValue('new');
    vi.mocked(fetchMe).mockReturnValue(pending);

    renderWithLocale(<Probe />);
    act(() => {
      useAuthStore.getState().setAuth('new', { ...account, name: 'Ada' });
    });

    await act(async () => {
      resolve(account);
    });

    expect(useAuthStore.getState().session).toBe('new');
    expect(useAuthStore.getState().account?.name).toBe('Ada');
  });

  it('does not apply hydration when the persisted token has changed', async () => {
    let resolve!: (value: typeof account | null) => void;
    const pending = new Promise<typeof account | null>((r) => {
      resolve = r;
    });
    vi.mocked(loadSession).mockReturnValue('old-tok');
    vi.mocked(fetchMe).mockReturnValue(pending);

    renderWithLocale(<Probe />);
    vi.mocked(loadSession).mockReturnValue('new-tok');

    await act(async () => {
      resolve(account);
    });

    expect(useAuthStore.getState().session).toBeNull();
  });

  it('does not apply hydration after unmount', async () => {
    let resolve!: (value: typeof account | null) => void;
    const pending = new Promise<typeof account | null>((r) => {
      resolve = r;
    });
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockReturnValue(pending);

    const { unmount } = renderWithLocale(<Probe />);
    unmount();

    await act(async () => {
      resolve(account);
    });

    expect(useAuthStore.getState().session).toBeNull();
  });

  it('does not let an unmounted hydration 401 wipe a remounted session', async () => {
    let resolveFirst!: (value: typeof account | null) => void;
    const first = new Promise<typeof account | null>((r) => {
      resolveFirst = r;
    });
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockReturnValueOnce(first).mockResolvedValueOnce(account);

    const { unmount } = renderWithLocale(<Probe />);
    unmount();
    renderWithLocale(<Probe />);

    await waitFor(() => {
      expect(useAuthStore.getState().session).toBe('tok');
    });

    await act(async () => {
      resolveFirst(null);
    });

    expect(useAuthStore.getState().session).toBe('tok');
    expect(useAuthStore.getState().account).toEqual(account);
  });

  it('hydrates a valid persisted token', async () => {
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockResolvedValue(account);

    renderWithLocale(<Probe />);

    await waitFor(() => {
      expect(useAuthStore.getState().session).toBe('tok');
    });
  });

  it('clears a stale persisted token', async () => {
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockResolvedValue(null);

    renderWithLocale(<Probe />);

    await waitFor(() => {
      expect(clearSession).toHaveBeenCalledTimes(1);
    });
    expect(useAuthStore.getState().account).toBeNull();
  });

  it('clears an in-memory session when hydration 401s the same token', async () => {
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockResolvedValue(null);
    useAuthStore.setState({ session: 'tok', account });

    renderWithLocale(<Probe />);

    await waitFor(() => {
      expect(useAuthStore.getState().session).toBeNull();
    });
    expect(useAuthStore.getState().account).toBeNull();
  });

  it('logs but keeps the token when hydration fails', async () => {
    vi.mocked(loadSession).mockReturnValue('tok');
    vi.mocked(fetchMe).mockRejectedValue(new Error('500'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    renderWithLocale(<Probe />);

    await waitFor(() => {
      expect(errorSpy).toHaveBeenCalled();
    });
    expect(clearSession).not.toHaveBeenCalled();
    expect(useAuthStore.getState().account).toBeNull();
    errorSpy.mockRestore();
  });
});
