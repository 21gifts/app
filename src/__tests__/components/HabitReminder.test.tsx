import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HabitReminder } from '@/components/HabitReminder';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { useAuthStore } from '@/stores/auth-store';

const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const owner = {
  id: 'owner',
  linkingKey: 'key',
  role: 'basis' as const,
  name: 'Ada',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: true,
  createdAt: 1,
  rulesAgreedAt: 1,
  viewKey: 'key',
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
};
function payload(accountId = 'owner', logged = false, archived = false) {
  return {
    reviewWeek: { start: '2026-10-19' },
    habits: [
      {
        id: 'h1',
        accountId,
        ownerName: 'Ada',
        role: 'basis',
        name: 'Walk',
        description: '',
        cadence: 'daily',
        timeZone: 'Asia/Manila',
        firstPeriod: '2026-10-20',
        lastPeriod: archived ? '2026-10-21' : null,
        periods: [
          {
            period: '2026-10-21',
            name: 'Walk',
            description: '',
            logged,
            status: logged ? 'achieved' : null,
          },
        ],
        comments: [],
      },
    ],
  };
}
function response(body = payload()): Response {
  return new Response(JSON.stringify(body));
}
function visibility(state: 'hidden' | 'visible'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  fireEvent(document, new Event('visibilitychange'));
}
beforeEach(() => {
  push.mockReset();
  useAuthStore.setState({ session: 'token', account: owner });
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
    this.querySelector('button')?.focus();
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('HabitReminder', () => {
  it('offers the requested German choices and navigates to catch-up', async () => {
    const fetch = vi.fn(async () => response());
    vi.stubGlobal('fetch', fetch);
    renderWithLocale(<HabitReminder />, 'de');
    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(
      screen.getByText(
        'In deinem Habit Tracker sind noch Bewertungen offen. Möchtest du sie jetzt nachtragen?',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Später' })).toBe(document.activeElement);
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt eintragen' }));
    expect(push).toHaveBeenCalledWith('/habit-tracker?review=1');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fetch).toHaveBeenCalledWith('/habits', { headers: { Authorization: 'Bearer token' } });
  });
  it('defers across rerenders and checks again after reopening, then stops when completed', async () => {
    let rated = false;
    const fetch = vi.fn(async () => response(payload('owner', rated)));
    vi.stubGlobal('fetch', fetch);
    const view = renderWithLocale(<HabitReminder />);
    fireEvent.click(await screen.findByRole('button', { name: 'Later' }));
    view.rerender(<HabitReminder />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
    visibility('visible');
    expect(fetch).toHaveBeenCalledTimes(1);
    visibility('hidden');
    visibility('visible');
    fireEvent.click(await screen.findByRole('button', { name: 'Later' }));
    rated = true;
    visibility('hidden');
    visibility('visible');
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it.each([
    ['other', false, false],
    ['owner', true, false],
    ['owner', false, true],
  ] as const)('ignores non-actionable ratings (%s, %s, %s)', async (id, logged, archived) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(payload(id, logged, archived))),
    );
    renderWithLocale(<HabitReminder />);
    await act(async () => {});
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('does not fetch for guests, blank sessions, or unfinished setup', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    useAuthStore.setState({ session: null, account: null });
    const view = renderWithLocale(<HabitReminder />);
    act(() => useAuthStore.setState({ session: '', account: owner }));
    act(() => useAuthStore.setState({ session: 'token', account: { ...owner, setup: 'name' } }));
    expect(fetch).not.toHaveBeenCalled();
    view.unmount();
  });
  it('waits for passkey renewal and ignores a response for an account changed in the same turn', async () => {
    const responses: Array<(value: Response) => void> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((done) => responses.push(done))),
    );
    useAuthStore.setState({
      account: { ...owner, walletRequired: false, passkeyRenewClosed: false },
    });
    renderWithLocale(<HabitReminder />);
    expect(responses).toHaveLength(0);
    act(() =>
      useAuthStore.setState({
        account: { ...owner, walletRequired: false, passkeyRenewClosed: true },
      }),
    );
    await act(async () => {
      useAuthStore.setState({ account: { ...owner, id: 'other' } });
      responses[0]?.(response());
      await Promise.resolve();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    await act(async () => {
      responses[1]?.(response(payload('other')));
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
  it.each(['token', 'new-token'])(
    'drops the response when the account disappears before effects flush (%s)',
    async (session) => {
      let resolve!: (value: Response) => void;
      vi.stubGlobal(
        'fetch',
        vi.fn(
          () =>
            new Promise<Response>((done) => {
              resolve = done;
            }),
        ),
      );
      renderWithLocale(<HabitReminder />);
      await act(async () => {
        useAuthStore.setState({ session, account: null });
        resolve(response());
        await Promise.resolve();
      });
      expect(screen.queryByRole('dialog')).toBeNull();
    },
  );
  it('checks after login and supports Escape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response()),
    );
    useAuthStore.setState({ session: null, account: null });
    renderWithLocale(<HabitReminder />);
    act(() => useAuthStore.setState({ session: 'token', account: owner }));
    fireEvent(await screen.findByRole('dialog'), new Event('cancel'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('ignores a request that finishes after logout or unmount', async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      ),
    );
    const view = renderWithLocale(<HabitReminder />);
    act(() => useAuthStore.setState({ session: null, account: null }));
    await act(async () => {
      resolve(response());
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => useAuthStore.setState({ session: 'token', account: owner }));
    view.unmount();
    await act(async () => {
      resolve(response());
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('rechecks restored pages and ignores stale background responses', async () => {
    const responses: Array<(value: Response) => void> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((done) => {
            responses.push(done);
          }),
      ),
    );
    renderWithLocale(<HabitReminder />);
    visibility('hidden');
    visibility('visible');
    await act(async () => {
      responses[0]?.(response());
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    await act(async () => {
      responses[1]?.(response(payload('owner', true)));
    });
    fireEvent(window, new PageTransitionEvent('pageshow', { persisted: true }));
    await act(async () => {
      responses[2]?.(response());
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
  it('does not interrupt the app on load failure and waits if initially hidden', async () => {
    visibility('hidden');
    const fetch = vi.fn(async () => {
      throw new Error('offline');
    });
    vi.stubGlobal('fetch', fetch);
    renderWithLocale(<HabitReminder />);
    expect(fetch).not.toHaveBeenCalled();
    visibility('visible');
    await act(async () => {});
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
