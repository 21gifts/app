import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HabitTracker } from '@/components/HabitTracker';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { useAuthStore } from '@/stores/auth-store';
import type { Account } from '@/lib/api-types';
import type { HabitTrackerData } from '@/lib/habit-tracker';

const base: HabitTrackerData = {
  week: { start: '2026-09-28', label: '2026-W40', nextAt: Date.now() + 600000 },
  currentWeek: '2026-09-28',
  firstWeek: '2026-09-21',
  habits: [
    {
      id: 'f1',
      accountId: 'f',
      name: 'Founder',
      role: 'founder',
      text: 'Read daily',
      firstWeek: '2026-09-21',
      lastWeek: null,
    },
    {
      id: 'i1',
      accountId: 'i',
      name: 'Initiator',
      role: 'initiator',
      text: 'Walk daily',
      firstWeek: '2026-09-21',
      lastWeek: null,
    },
  ],
  results: [],
  comments: [],
};
let payload: HabitTrackerData;
let fetcher: ReturnType<typeof vi.fn>;
beforeEach(() => {
  payload = structuredClone(base);
  useAuthStore.setState({ session: null, account: null });
  fetcher = vi.fn(
    async (_url: string, options?: RequestInit) =>
      new Response(JSON.stringify(options?.method === 'POST' ? { ok: true } : payload)),
  );
  vi.stubGlobal('fetch', fetcher);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function signIn(role = 'founder', id = 'f') {
  useAuthStore.setState({ session: 'token', account: { id, role } as Account });
}
async function loaded() {
  await screen.findByText('Read daily');
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Previous' }).hasAttribute('disabled')).toBe(false),
  );
}

describe('HabitTracker', () => {
  it('shows founder before initiator and lets anonymous visitors only read', async () => {
    renderWithLocale(<HabitTracker />);
    await loaded();
    const headings = screen.getAllByRole('heading').map((element) => element.textContent);
    expect(headings.indexOf('Founder’s resolutions')).toBeLessThan(
      headings.indexOf('Initiator’s resolutions'),
    );
    expect(screen.getByRole('link', { name: 'Sign in to comment' })).toBeTruthy();
    expect(screen.queryByLabelText('New resolution')).toBeNull();
    expect(screen.getAllByRole('group').every((element) => element.hasAttribute('disabled'))).toBe(
      true,
    );
  });
  it('allows an owner to add, rate and archive only their own resolution', async () => {
    signIn();
    renderWithLocale(<HabitTracker />);
    await loaded();
    fireEvent.change(screen.getByLabelText('New resolution'), { target: { value: 'Pray daily' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add resolution' }));
    await waitFor(() =>
      expect(screen.getByLabelText('New resolution')).toHaveProperty('value', ''),
    );
    const posted = () =>
      fetcher.mock.calls
        .filter((call) => call[1]?.method === 'POST')
        .map((call) => JSON.parse(String(call[1]?.body)));
    expect(posted()[0]).toEqual({ action: 'add', text: 'Pray daily' });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Delete resolution' }).hasAttribute('disabled'),
      ).toBe(false),
    );
    fireEvent.click(screen.getAllByRole('radio', { name: 'Achieved', exact: true })[0]!);
    await waitFor(() =>
      expect(posted()[1]).toEqual({
        action: 'rate',
        id: 'f1',
        week: '2026-09-28',
        status: 'achieved',
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Previous' }).hasAttribute('disabled')).toBe(false),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Delete resolution' }));
    expect(posted()).toHaveLength(2);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete resolution' }));
    await waitFor(() => expect(posted()[2]).toEqual({ action: 'retire', id: 'f1' }));
    expect(screen.getAllByRole('group')[1]?.hasAttribute('disabled')).toBe(true);
  });
  it('lets moderators post comments, with drafts retained on a failed save', async () => {
    signIn('moderator', 'm');
    renderWithLocale(<HabitTracker />);
    await loaded();
    expect(screen.queryByLabelText('New resolution')).toBeNull();
    fireEvent.change(screen.getByLabelText('Write a comment'), {
      target: { value: 'Keep going!' },
    });
    fetcher.mockResolvedValueOnce(new Response('{}', { status: 500 }));
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Write a comment')).toHaveProperty('value', 'Keep going!');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Write a comment')).toHaveProperty('value', ''),
    );
    expect(fetcher).toHaveBeenCalledWith(
      '/habits/data',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
        body: JSON.stringify({ action: 'comment', week: '2026-09-28', text: 'Keep going!' }),
      }),
    );
  });
  it('browses old weeks and returns to the current week', async () => {
    renderWithLocale(<HabitTracker />);
    await loaded();
    payload.week = { ...payload.week, start: '2026-09-21', label: '2026-W39' };
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await screen.findByText('Week 2026-W39');
    expect(fetcher).toHaveBeenCalledWith('/habits/data?week=2026-09-21', expect.anything());
    payload = structuredClone(base);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Week 2026-W40');
    payload.week = { ...payload.week, start: '2026-09-21', label: '2026-W39' };
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await screen.findByText('Week 2026-W39');
    payload = structuredClone(base);
    fireEvent.click(screen.getByRole('button', { name: 'Current week' }));
    await screen.findByText('Week 2026-W40');
  });
  it('renders empty/error states and retries failed reads', async () => {
    fetcher.mockRejectedValueOnce(new Error('Offline'));
    renderWithLocale(<HabitTracker />);
    await screen.findByRole('alert');
    payload.habits = [];
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findAllByText('No resolutions for this week.')).toHaveLength(2);
  });
  it('renders archived outcomes and escaped comments in German', async () => {
    payload.habits[0]!.lastWeek = payload.week.start;
    payload.results = [{ habitId: 'f1', week: payload.week.start, status: 'partial' }];
    payload.comments = [
      {
        id: 'c',
        accountId: 'm',
        name: '',
        text: '<script>hello</script>',
        week: payload.week.start,
        createdAt: 1790899200000,
      },
    ];
    renderWithLocale(<HabitTracker />, 'de');
    await screen.findByText('Founder · Archiviert');
    expect(screen.getAllByRole('radio', { name: 'Teilweise erreicht' })[0]).toHaveProperty(
      'checked',
      true,
    );
    expect(screen.getByText('<script>hello</script>')).toBeTruthy();
    expect(screen.getByText('Mitglied')).toBeTruthy();
  });
});

it('refreshes the current block at its Monday boundary', async () => {
  vi.useFakeTimers();
  try {
    payload.week.nextAt = Date.now() + 5000;
    renderWithLocale(<HabitTracker />);
    const { act } = await import('@testing-library/react');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText('Week 2026-W40')).toBeTruthy();
    payload = {
      ...payload,
      week: { start: '2026-10-05', label: '2026-W41', nextAt: Date.now() + 604800000 },
      currentWeek: '2026-10-05',
    };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(screen.getByText('Week 2026-W41')).toBeTruthy();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(3);
  } finally {
    cleanup();
    vi.useRealTimers();
  }
});

it('rejects a failed HTTP read and enables only the initiator’s own group', async () => {
  fetcher.mockResolvedValueOnce(new Response('{}', { status: 500 }));
  signIn('initiator', 'i');
  renderWithLocale(<HabitTracker />);
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await loaded();
  expect(screen.getAllByRole('group')[0]?.hasAttribute('disabled')).toBe(true);
  expect(screen.getAllByRole('group')[1]?.hasAttribute('disabled')).toBe(false);
});

it('keeps old ownership read-only when an account loses its privileged role', async () => {
  signIn('moderator', 'f');
  renderWithLocale(<HabitTracker />);
  await loaded();
  expect(screen.getAllByRole('group')[0]?.hasAttribute('disabled')).toBe(true);
});

it('moves forward within older history without jumping to today', async () => {
  payload.week = { ...payload.week, start: '2026-09-14', label: '2026-W38' };
  payload.firstWeek = '2026-09-07';
  renderWithLocale(<HabitTracker />);
  await loaded();
  payload.week = { ...payload.week, start: '2026-09-21', label: '2026-W39' };
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText('Week 2026-W39');
  expect(fetcher).toHaveBeenCalledWith('/habits/data?week=2026-09-21', expect.anything());
});

it('suppresses duplicate form submissions while the first request is pending', async () => {
  signIn();
  renderWithLocale(<HabitTracker />);
  await loaded();
  let resolve!: (response: Response) => void;
  fetcher.mockImplementationOnce(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  const field = screen.getByLabelText('New resolution');
  fireEvent.change(field, { target: { value: 'Read' } });
  const form = field.closest('form')!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(fetcher.mock.calls.filter((call) => call[1]?.method === 'POST')).toHaveLength(1);
  resolve(new Response('{}'));
  await waitFor(() => expect(field).toHaveProperty('value', ''));
});
