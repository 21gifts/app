import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberHabits } from '@/app/habit-tracker/MemberHabits';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const owner = {
  id: 'acc-owner',
  linkingKey: `02${'ab'.repeat(31)}`,
  role: 'initiator' as const,
  name: 'Ada',
  location: null,
  lightningAddress: 'ada@wallet.example',
  lightningAddressVerified: true,
  forumLawsDismissed: true,
  createdAt: 1,
  rulesAgreedAt: 1,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
};

const viewer = { ...owner, id: 'acc-viewer', role: 'basis' as const, name: 'Bea' };
const nextInitiator = { ...owner, id: 'acc-next', name: 'Cara' };

function period(day: string, status: 'achieved' | 'partial' | 'missed' | null) {
  return {
    period: day,
    name: 'Walk',
    description: 'Outside',
    logged: status !== null,
    status,
  };
}

function payload() {
  return {
    reviewWeek: { start: '2026-09-28' },
    habits: [
      {
        id: 'h-owner',
        accountId: 'acc-owner',
        ownerName: 'Ada',
        role: 'initiator',
        name: 'Walk',
        description: 'Outside',
        cadence: 'daily',
        timeZone: 'Asia/Manila',
        firstPeriod: '2026-10-01',
        lastPeriod: null,
        notes: 'secret',
        periods: [
          period('2026-10-01', null),
          period('2026-10-02', 'achieved'),
          period('2026-10-03', 'partial'),
          period('2026-10-04', 'missed'),
        ],
        comments: [
          {
            id: 'c-own',
            habitId: 'h-owner',
            accountId: 'acc-owner',
            name: 'Ada',
            text: 'mine',
            week: '2026-09-28',
            createdAt: 1,
          },
          {
            id: 'c-other',
            habitId: 'h-owner',
            accountId: 'acc-other',
            name: 'Bea',
            text: 'hello',
            week: '2026-09-28',
            createdAt: 2,
          },
        ],
      },
      {
        id: 'h-blank',
        accountId: 'acc-owner',
        ownerName: 'Ada',
        role: 'initiator',
        name: 'Quiet',
        description: '',
        cadence: 'daily',
        timeZone: 'Asia/Manila',
        firstPeriod: '2026-10-08',
        lastPeriod: null,
        periods: [],
        comments: [],
      },
      {
        id: 'h-week',
        accountId: 'acc-other',
        ownerName: 'Bea',
        role: 'basis',
        name: 'Read',
        description: 'Books',
        cadence: 'weekly',
        timeZone: 'Europe/Zurich',
        firstPeriod: '2026-09-28',
        lastPeriod: '2026-09-28',
        periods: [period('2026-09-28', null)],
        comments: [],
      },
    ],
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function freshJson(body: unknown): () => Response {
  return () => json(body);
}

function periodControl(day: string, name: string): HTMLElement {
  const time = screen.getByText(day);
  const row = time.closest('li');
  if (!(row instanceof HTMLElement)) {
    throw new Error(`missing period ${day}`);
  }
  return within(row).getByRole('button', { name });
}

function isRateRequest(input: RequestInfo | URL): boolean {
  let url = '';
  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.href;
  } else {
    url = input.url;
  }
  return url.includes('/fx/spot');
}

function formsNamed(buttonName: string): HTMLFormElement[] {
  return screen.getAllByRole('button', { name: buttonName }).map((button) => {
    const form = button.closest('form');
    if (!(form instanceof HTMLFormElement)) {
      throw new Error(`missing form for ${buttonName}`);
    }
    return form;
  });
}

beforeEach(() => {
  useAuthStore.setState({ session: null, account: null, wrongAccount: false });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MemberHabits', () => {
  it('shows the public list to a signed-out visitor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(freshJson(payload())));
    renderWithLocale(<MemberHabits />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Ada' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Bea' })).toBeTruthy();
    expect(screen.getByText('Outside')).toBeTruthy();
    expect(screen.getByText('Books')).toBeTruthy();
    expect(screen.getByText('Weekly')).toBeTruthy();
    expect(screen.getByText('Archived')).toBeTruthy();
    expect(screen.getAllByText(/Not rated yet/)).toHaveLength(2);
    expect(screen.getByText(/Partially achieved/)).toBeTruthy();
    expect(screen.getByText(/Not achieved/)).toBeTruthy();
    expect(screen.queryByText(/secret/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Achieved' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Sign in to comment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add habit' })).toBeNull();
    expect(screen.queryByLabelText('Write a comment')).toBeNull();
    expect(screen.queryByText(/Monday at 16:00/)).toBeNull();
  });

  it('shows an empty tracker and a load error that retry can clear', async () => {
    let calls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          return json({ reviewWeek: { start: '2026-09-28' }, habits: [] });
        }
        if (calls === 2) {
          return json({ error: 'down' }, 500);
        }
        return json(payload());
      }),
    );
    const first = renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('No habits yet.')).toBeTruthy();
    expect(screen.getByText(/A week can be rated from Monday 08:00/)).toBeTruthy();
    expect(screen.queryByText(/Monday at 16:00/)).toBeNull();
    first.unmount();

    renderWithLocale(<MemberHabits />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Ada' })).toBeTruthy();
    expect(screen.queryByLabelText('Write a comment')).toBeNull();
  });

  it('ignores a response that arrives after the page is gone', async () => {
    let resolveFetch: (value: Response) => void = () => undefined;
    let rejectFetch: (reason: unknown) => void = () => undefined;
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve, reject) => {
            call += 1;
            if (call === 1) {
              resolveFetch = resolve;
            } else {
              rejectFetch = reject;
            }
          }),
      ),
    );
    const first = renderWithLocale(<MemberHabits />);
    first.unmount();
    resolveFetch(json(payload()));
    const second = renderWithLocale(<MemberHabits />);
    second.unmount();
    rejectFetch(new Error('gone'));
    await Promise.resolve();
  });

  it('ignores a failed reload after the page is gone', async () => {
    let gets = 0;
    let rejectRefresh: (reason: unknown) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return Promise.resolve(json({ asOf: null, source: null, rates: {} }));
        }
        if (init?.method === 'POST') {
          return Promise.resolve(json({ ok: true }));
        }
        gets += 1;
        if (gets === 1) {
          return Promise.resolve(json(payload()));
        }
        return new Promise<Response>((_resolve, reject) => {
          rejectRefresh = reject;
        });
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    const view = renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();
    fireEvent.click(periodControl('2026-10-04', 'Achieved'));
    await waitFor(() => {
      expect(gets).toBe(2);
    });
    view.unmount();
    rejectRefresh(new Error('gone'));
    await act(async () => {
      await Promise.resolve();
    });
  });

  it('lets the owner rate, edit, comment, archive, and add', async () => {
    const bodies: unknown[] = [];
    let gets = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          bodies.push(JSON.parse(String(init.body)));
          return json({ ok: true });
        }
        gets += 1;
        return json(payload());
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText(/Internal notes:/)).toBeTruthy();
    expect(screen.getByText('secret')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Delete comment' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Send Bitcoin' })).toHaveLength(1);
    expect(screen.queryByText('Delete comment')).toBeNull();
    expect(screen.queryByText('Send Bitcoin')).toBeNull();
    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.queryByText('Post')).toBeNull();
    expect(screen.queryByText('Archive')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Sign in to comment' })).toBeNull();

    fireEvent.click(periodControl('2026-10-04', 'Achieved'));
    fireEvent.click(periodControl('2026-10-04', 'Partially achieved'));
    fireEvent.click(periodControl('2026-10-04', 'Not achieved'));
    await waitFor(() => {
      expect(bodies).toEqual([
        { action: 'log', id: 'h-owner', period: '2026-10-04', status: 'achieved' },
        { action: 'log', id: 'h-owner', period: '2026-10-04', status: 'partial' },
        { action: 'log', id: 'h-owner', period: '2026-10-04', status: 'missed' },
      ]);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0] as HTMLButtonElement);
    const opened = screen.getAllByLabelText('Name')[0];
    if (!(opened instanceof HTMLInputElement)) {
      throw new Error('missing edit fields');
    }
    fireEvent.change(opened, { target: { value: 'Nope' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0] as HTMLButtonElement);
    const name = screen.getAllByLabelText('Name')[0];
    const description = screen.getAllByLabelText('Description')[0];
    const notes = screen.getAllByLabelText('Internal notes')[0];
    if (
      !(name instanceof HTMLInputElement) ||
      !(description instanceof HTMLInputElement) ||
      !(notes instanceof HTMLInputElement)
    ) {
      throw new Error('missing edit fields');
    }
    expect(name.value).toBe('Walk');
    expect(screen.queryByText('Save')).toBeNull();
    fireEvent.change(name, { target: { value: 'Run' } });
    fireEvent.change(description, { target: { value: 'Far' } });
    fireEvent.change(notes, { target: { value: 'shh' } });
    const saveForm = formsNamed('Save')[0];
    if (saveForm === undefined) {
      throw new Error('missing save form');
    }
    fireEvent.submit(saveForm);
    await waitFor(() => {
      expect(bodies[3]).toEqual({
        action: 'edit',
        id: 'h-owner',
        name: 'Run',
        description: 'Far',
        notes: 'shh',
      });
    });

    const comment = screen.getAllByLabelText('Write a comment')[0];
    if (comment === undefined) {
      throw new Error('missing comment field');
    }
    fireEvent.click(screen.getAllByRole('button', { name: 'Post' })[0] as HTMLButtonElement);
    await waitFor(() => {
      expect(bodies[4]).toEqual({ action: 'comment', habitId: 'h-owner', text: '' });
    });
    fireEvent.change(comment, { target: { value: 'nice' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Post' })[0] as HTMLButtonElement);
    await waitFor(() => {
      expect(bodies[5]).toEqual({ action: 'comment', habitId: 'h-owner', text: 'nice' });
    });
    await waitFor(() => {
      expect((comment as HTMLTextAreaElement).value).toBe('');
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Archive' })[0] as HTMLButtonElement);
    expect(bodies).toHaveLength(6);
    expect(screen.getByText('Archive this habit? Its history stays visible.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel archive' }));
    expect(screen.queryByText('Archive this habit? Its history stays visible.')).toBeNull();
    expect(bodies).toHaveLength(6);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Delete comment' })[0] as HTMLButtonElement,
    );
    expect(bodies).toHaveLength(6);
    expect(screen.getByText('Delete this comment from the Habit-Tracker?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel deletion' }));
    expect(screen.queryByText('Delete this comment from the Habit-Tracker?')).toBeNull();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Delete comment' })[0] as HTMLButtonElement,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
    await waitFor(() => {
      expect(bodies[6]).toEqual({ action: 'deleteComment', id: 'c-own' });
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Archive' })[1] as HTMLButtonElement);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm archive' }));
    await waitFor(() => {
      expect(bodies[7]).toEqual({ action: 'archive', id: 'h-blank' });
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[1] as HTMLButtonElement);
    const quietNotes = screen.getAllByLabelText('Internal notes')[0];
    if (!(quietNotes instanceof HTMLInputElement)) {
      throw new Error('missing blank notes');
    }
    expect(quietNotes.value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    const addName = screen.getByLabelText('Name');
    const addDescription = screen.getByLabelText('Description');
    const addNotes = screen.getByLabelText('Internal notes');
    fireEvent.change(addName, { target: { value: 'Vorsatz' } });
    fireEvent.change(addDescription, { target: { value: 'public' } });
    fireEvent.change(addNotes, { target: { value: 'private' } });
    fireEvent.click(screen.getByRole('button', { name: 'Weekly' }));
    fireEvent.click(screen.getByRole('button', { name: 'Daily' }));
    fireEvent.click(screen.getByRole('button', { name: 'Weekly' }));
    const addForm = formsNamed('Add habit')[0];
    if (addForm === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.submit(addForm);
    await waitFor(() => {
      expect(bodies[8]).toMatchObject({
        action: 'add',
        name: 'Vorsatz',
        description: 'public',
        notes: 'private',
        cadence: 'weekly',
      });
    });
    await waitFor(() => {
      expect((addName as HTMLInputElement).value).toBe('');
    });
    expect(gets).toBeGreaterThan(1);
  });

  it('keeps an open edit and does not post the same action twice while the reload fails', async () => {
    let posts = 0;
    let gets = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return json({ asOf: null, source: null, rates: {} });
        }
        if (init?.method === 'POST') {
          posts += 1;
          return json({ ok: true });
        }
        gets += 1;
        if (gets === 2 || gets === 3) {
          throw new Error('refresh');
        }
        return json(payload());
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0] as HTMLButtonElement);
    const editName = screen.getAllByLabelText('Name')[0];
    if (!(editName instanceof HTMLInputElement)) {
      throw new Error('missing edit name');
    }
    fireEvent.change(editName, { target: { value: 'Kept' } });
    fireEvent.click(periodControl('2026-10-04', 'Achieved'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    await waitFor(() => {
      expect(posts).toBe(1);
      expect(gets).toBe(2);
    });
    expect(editName.value).toBe('Kept');
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();

    const addName = screen.getAllByLabelText('Name').at(-1);
    if (!(addName instanceof HTMLInputElement)) {
      throw new Error('missing add name');
    }
    fireEvent.change(addName, { target: { value: 'Twice' } });
    const addForm = formsNamed('Add habit')[0];
    if (addForm === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.submit(addForm);
    await waitFor(() => {
      expect(posts).toBe(2);
      expect(gets).toBe(3);
    });
    expect(addName.value).toBe('Twice');
    expect(editName.value).toBe('Kept');

    fireEvent.submit(addForm);
    await waitFor(() => {
      expect(gets).toBe(4);
      expect(addName.value).toBe('');
    });
    expect(posts).toBe(2);
    expect(editName.value).toBe('Kept');
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not resend an add when Try again reloads the list', async () => {
    let posts = 0;
    let gets = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return json({ asOf: null, source: null, rates: {} });
        }
        if (init?.method === 'POST') {
          posts += 1;
          return json({ ok: true });
        }
        gets += 1;
        if (gets === 2) {
          throw new Error('refresh');
        }
        return json(payload());
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    const addName = screen.getByLabelText('Name');
    if (!(addName instanceof HTMLInputElement)) {
      throw new Error('missing add name');
    }
    fireEvent.change(addName, { target: { value: 'Held' } });
    const addForm = formsNamed('Add habit')[0];
    if (addForm === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.submit(addForm);
    expect(await screen.findByRole('alert')).toBeTruthy();
    await waitFor(() => {
      expect(posts).toBe(1);
      expect(gets).toBe(2);
    });
    expect(addName.value).toBe('Held');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
      expect(gets).toBe(3);
    });
    expect(addName.value).toBe('Held');
    expect(posts).toBe(1);

    const settledForm = formsNamed('Add habit')[0];
    if (settledForm === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.submit(settledForm);
    await waitFor(() => {
      expect(gets).toBe(4);
      expect(addName.value).toBe('');
    });
    expect(posts).toBe(2);
  });

  it('does not replace the list load that started while a save was still posting', async () => {
    let posts = 0;
    let gets = 0;
    let releasePost: (value: Response) => void = () => undefined;
    const pendingGets: Array<(value: Response) => void> = [];
    const postAuth: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return Promise.resolve(json({ asOf: null, source: null, rates: {} }));
        }
        if (init?.method === 'POST') {
          posts += 1;
          postAuth.push(new Headers(init.headers).get('Authorization') ?? '');
          if (posts === 1) {
            return new Promise<Response>((resolve) => {
              releasePost = resolve;
            });
          }
          return Promise.resolve(json({ ok: true }));
        }
        gets += 1;
        if (gets === 1) {
          return Promise.resolve(json(payload()));
        }
        if (gets === 2) {
          return new Promise<Response>((resolve) => {
            pendingGets.push(resolve);
          });
        }
        return Promise.resolve(json(payload()));
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    const addName = screen.getByLabelText('Name');
    if (!(addName instanceof HTMLInputElement)) {
      throw new Error('missing add name');
    }
    fireEvent.change(addName, { target: { value: 'Held' } });
    const addForm = formsNamed('Add habit')[0];
    if (addForm === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.submit(addForm);
    await waitFor(() => {
      expect(posts).toBe(1);
    });

    useAuthStore.setState({ session: 'other', account: viewer });
    await waitFor(() => {
      expect(gets).toBe(2);
    });
    await act(async () => {
      releasePost(json({ ok: true }));
    });
    await waitFor(() => {
      expect(posts).toBe(1);
      expect(gets).toBe(2);
    });
    expect(addName.value).toBe('');

    const reload = pendingGets[0];
    if (reload === undefined) {
      throw new Error('missing reload');
    }
    await act(async () => {
      reload(json(payload()));
    });
    expect(await screen.findByText('Walk')).toBeTruthy();

    const settledName = screen.getByLabelText('Name');
    if (!(settledName instanceof HTMLInputElement)) {
      throw new Error('missing add name');
    }
    const settledForm = formsNamed('Add habit')[0];
    if (settledForm === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.submit(settledForm);
    await waitFor(() => {
      expect(posts).toBe(2);
      expect(gets).toBe(3);
      expect(settledName.value).toBe('');
    });
    expect(postAuth).toEqual(['Bearer tok', 'Bearer other']);

    fireEvent.change(settledName, { target: { value: 'Next' } });
    fireEvent.submit(settledForm);
    await waitFor(() => {
      expect(posts).toBe(3);
      expect(postAuth).toEqual(['Bearer tok', 'Bearer other', 'Bearer other']);
    });
  });

  it('does not post the same action again while the first request is still waiting', async () => {
    let posts = 0;
    let releasePost: (value: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return Promise.resolve(json({ asOf: null, source: null, rates: {} }));
        }
        if (init?.method === 'POST') {
          posts += 1;
          return new Promise<Response>((resolve) => {
            releasePost = resolve;
          });
        }
        return Promise.resolve(json(payload()));
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    const addName = screen.getByLabelText('Name');
    if (!(addName instanceof HTMLInputElement)) {
      throw new Error('missing add name');
    }
    fireEvent.change(addName, { target: { value: 'Held' } });
    const addForm = formsNamed('Add habit')[0];
    if (addForm === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.submit(addForm);
    await waitFor(() => {
      expect(posts).toBe(1);
    });
    fireEvent.submit(addForm);
    expect(posts).toBe(1);
    expect(addName.value).toBe('Held');
    expect(screen.queryByRole('alert')).toBeNull();

    await act(async () => {
      releasePost(json({ ok: true }));
    });
    await waitFor(() => {
      expect(addName.value).toBe('');
    });
    expect(posts).toBe(1);
  });

  it('does not post again after another session settles while the first request is still waiting', async () => {
    let posts = 0;
    let gets = 0;
    let releasePost: (value: Response) => void = () => undefined;
    const pendingGets: Array<(value: Response) => void> = [];
    const callAuth: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return Promise.resolve(json({ asOf: null, source: null, rates: {} }));
        }
        const auth = `${init?.method === 'POST' ? 'POST' : 'GET'} ${new Headers(init?.headers).get('Authorization') ?? ''}`;
        if (init?.method === 'POST') {
          posts += 1;
          callAuth.push(auth);
          if (posts === 1) {
            return new Promise<Response>((resolve) => {
              releasePost = resolve;
            });
          }
          return Promise.resolve(json({ ok: true }));
        }
        gets += 1;
        callAuth.push(auth);
        if (gets === 1) {
          return Promise.resolve(json(payload()));
        }
        if (gets === 2) {
          return new Promise<Response>((resolve) => {
            pendingGets.push(resolve);
          });
        }
        return Promise.resolve(json(payload()));
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    const addName = screen.getByLabelText('Name');
    if (!(addName instanceof HTMLInputElement)) {
      throw new Error('missing add name');
    }
    fireEvent.change(addName, { target: { value: 'Held' } });
    const addForm = formsNamed('Add habit')[0];
    if (addForm === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.submit(addForm);
    await waitFor(() => {
      expect(posts).toBe(1);
    });

    useAuthStore.setState({ session: 'other', account: viewer });
    await waitFor(() => {
      expect(gets).toBe(2);
    });
    const reload = pendingGets[0];
    if (reload === undefined) {
      throw new Error('missing reload');
    }
    await act(async () => {
      reload(json(payload()));
    });
    expect(await screen.findByText('Walk')).toBeTruthy();

    const settledName = screen.getByLabelText('Name');
    if (!(settledName instanceof HTMLInputElement)) {
      throw new Error('missing add name');
    }
    expect(settledName.value).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();

    await act(async () => {
      releasePost(json({ ok: true }));
    });
    expect(gets).toBe(2);
    expect(posts).toBe(1);
    expect(settledName.value).toBe('');
    expect(callAuth).toEqual(['GET Bearer tok', 'POST Bearer tok', 'GET Bearer other']);

    const settledForm = formsNamed('Add habit')[0];
    if (settledForm === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.change(settledName, { target: { value: 'Next' } });
    fireEvent.submit(settledForm);
    await waitFor(() => {
      expect(posts).toBe(2);
      expect(gets).toBe(3);
      expect(settledName.value).toBe('');
    });
    expect(callAuth).toEqual([
      'GET Bearer tok',
      'POST Bearer tok',
      'GET Bearer other',
      'POST Bearer other',
      'GET Bearer other',
    ]);
  });

  it('does not start another reload when Try again already owns the list', async () => {
    let posts = 0;
    let gets = 0;
    let releasePost: (value: Response) => void = () => undefined;
    let releaseRetry: (value: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return Promise.resolve(json({ asOf: null, source: null, rates: {} }));
        }
        if (init?.method === 'POST') {
          posts += 1;
          if (posts === 1) {
            return Promise.resolve(json({ error: 'Invalid name' }, 400));
          }
          return new Promise<Response>((resolve) => {
            releasePost = resolve;
          });
        }
        gets += 1;
        if (gets === 1) {
          return Promise.resolve(json(payload()));
        }
        return new Promise<Response>((resolve) => {
          releaseRetry = resolve;
        });
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();
    fireEvent.click(periodControl('2026-10-04', 'Achieved'));
    expect(await screen.findByRole('alert')).toBeTruthy();

    const addName = screen.getByLabelText('Name');
    if (!(addName instanceof HTMLInputElement)) {
      throw new Error('missing add name');
    }
    fireEvent.change(addName, { target: { value: 'Held' } });
    const addForm = formsNamed('Add habit')[0];
    if (addForm === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.submit(addForm);
    await waitFor(() => {
      expect(posts).toBe(2);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(gets).toBe(2);
    });
    expect(screen.queryByRole('alert')).toBeNull();

    await act(async () => {
      releasePost(json({ ok: true }));
    });
    expect(gets).toBe(2);
    expect(posts).toBe(2);
    expect(addName.value).toBe('Held');
    expect(screen.queryByRole('alert')).toBeNull();

    await act(async () => {
      releaseRetry(json(payload()));
    });
    expect(await screen.findByText('Walk')).toBeTruthy();
    expect(addName.value).toBe('Held');
    expect(gets).toBe(2);
  });

  it('does not show a failed reload on the session that replaced it', async () => {
    let posts = 0;
    let gets = 0;
    let releaseRefresh: (value: Response) => void = () => undefined;
    const callAuth: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return Promise.resolve(json({ asOf: null, source: null, rates: {} }));
        }
        callAuth.push(
          `${init?.method === 'POST' ? 'POST' : 'GET'} ${new Headers(init?.headers).get('Authorization') ?? ''}`,
        );
        if (init?.method === 'POST') {
          posts += 1;
          return Promise.resolve(json({ ok: true }));
        }
        gets += 1;
        if (gets === 1) {
          return Promise.resolve(json(payload()));
        }
        if (gets === 2) {
          return new Promise<Response>((resolve) => {
            releaseRefresh = resolve;
          });
        }
        return Promise.resolve(json(payload()));
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    const addName = screen.getByLabelText('Name');
    if (!(addName instanceof HTMLInputElement)) {
      throw new Error('missing add name');
    }
    fireEvent.change(addName, { target: { value: 'Held' } });
    const addForm = formsNamed('Add habit')[0];
    if (addForm === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.submit(addForm);
    await waitFor(() => {
      expect(posts).toBe(1);
      expect(gets).toBe(2);
    });

    await act(async () => {
      useAuthStore.setState({ session: 'other', account: viewer });
      releaseRefresh(json({ error: 'down' }, 500));
    });
    expect(addName.value).toBe('');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(await screen.findByText('Walk')).toBeTruthy();
    expect(callAuth).toEqual([
      'GET Bearer tok',
      'POST Bearer tok',
      'GET Bearer tok',
      'GET Bearer other',
    ]);
  });

  it('does not show a failed save on the session that arrived while it was posting', async () => {
    let posts = 0;
    let gets = 0;
    let releasePost: (value: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return Promise.resolve(json({ asOf: null, source: null, rates: {} }));
        }
        if (init?.method === 'POST') {
          posts += 1;
          return new Promise<Response>((resolve) => {
            releasePost = resolve;
          });
        }
        gets += 1;
        return Promise.resolve(json(payload()));
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    const addName = screen.getByLabelText('Name');
    if (!(addName instanceof HTMLInputElement)) {
      throw new Error('missing add name');
    }
    fireEvent.change(addName, { target: { value: 'Held' } });
    const addForm = formsNamed('Add habit')[0];
    if (addForm === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.submit(addForm);
    await waitFor(() => {
      expect(posts).toBe(1);
    });

    useAuthStore.setState({ session: 'other', account: viewer });
    await waitFor(() => {
      expect(gets).toBe(2);
    });
    expect(await screen.findByText('Walk')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();

    await act(async () => {
      releasePost(json({ error: 'Invalid name' }, 400));
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(posts).toBe(1);
    expect(gets).toBe(2);
    const settledName = screen.getByLabelText('Name');
    if (!(settledName instanceof HTMLInputElement)) {
      throw new Error('missing add name');
    }
    expect(settledName.value).toBe('');
  });

  it('does not show a failed save after the same account comes back', async () => {
    let posts = 0;
    let gets = 0;
    let releasePost: (value: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return Promise.resolve(json({ asOf: null, source: null, rates: {} }));
        }
        if (init?.method === 'POST') {
          posts += 1;
          if (posts === 1) {
            return new Promise<Response>((resolve) => {
              releasePost = resolve;
            });
          }
          return Promise.resolve(json({ ok: true }));
        }
        gets += 1;
        return Promise.resolve(json(payload()));
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    const addName = screen.getByLabelText('Name');
    if (!(addName instanceof HTMLInputElement)) {
      throw new Error('missing add name');
    }
    fireEvent.change(addName, { target: { value: 'Held' } });
    const addForm = formsNamed('Add habit')[0];
    if (addForm === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.submit(addForm);
    await waitFor(() => {
      expect(posts).toBe(1);
    });

    useAuthStore.setState({ session: 'other', account: viewer });
    await waitFor(() => {
      expect(gets).toBe(2);
    });
    expect(await screen.findByText('Walk')).toBeTruthy();

    useAuthStore.setState({ session: 'tok', account: owner });
    await waitFor(() => {
      expect(gets).toBe(3);
    });
    expect(await screen.findByText('Walk')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();

    await act(async () => {
      releasePost(json({ error: 'Invalid name' }, 400));
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(posts).toBe(1);

    const returnedName = screen.getByLabelText('Name');
    if (!(returnedName instanceof HTMLInputElement)) {
      throw new Error('missing add name');
    }
    const returnedForm = formsNamed('Add habit')[0];
    if (returnedForm === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.change(returnedName, { target: { value: 'Held' } });
    fireEvent.submit(returnedForm);
    await waitFor(() => {
      expect(posts).toBe(2);
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('posts a changed rating again after another save confirms the list', async () => {
    let posts = 0;
    let gets = 0;
    const bodies: Array<{ action?: string; status?: string; name?: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return json({ asOf: null, source: null, rates: {} });
        }
        if (init?.method === 'POST') {
          posts += 1;
          bodies.push(
            JSON.parse(String(init.body)) as { action?: string; status?: string; name?: string },
          );
          return json({ ok: true });
        }
        gets += 1;
        if (gets === 2 || gets === 3 || gets === 4) {
          throw new Error('refresh');
        }
        return json(payload());
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    fireEvent.click(periodControl('2026-10-04', 'Achieved'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    await waitFor(() => {
      expect(posts).toBe(1);
      expect(gets).toBe(2);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0] as HTMLButtonElement);
    const editName = screen.getAllByLabelText('Name')[0];
    if (!(editName instanceof HTMLInputElement)) {
      throw new Error('missing edit name');
    }
    fireEvent.change(editName, { target: { value: 'Run' } });
    const saveForm = formsNamed('Save')[0];
    if (saveForm === undefined) {
      throw new Error('missing save form');
    }
    fireEvent.submit(saveForm);
    await waitFor(() => {
      expect(posts).toBe(2);
      expect(gets).toBe(3);
    });

    const addName = screen.getAllByLabelText('Name').at(-1);
    if (!(addName instanceof HTMLInputElement)) {
      throw new Error('missing add name');
    }
    fireEvent.change(addName, { target: { value: 'Held' } });
    const addForm = formsNamed('Add habit')[0];
    if (addForm === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.submit(addForm);
    await waitFor(() => {
      expect(posts).toBe(3);
      expect(gets).toBe(4);
    });
    expect(addName.value).toBe('Held');

    fireEvent.click(periodControl('2026-10-04', 'Partially achieved'));
    await waitFor(() => {
      expect(posts).toBe(4);
      expect(gets).toBe(5);
      expect(screen.queryByRole('alert')).toBeNull();
    });

    fireEvent.click(periodControl('2026-10-04', 'Achieved'));
    await waitFor(() => {
      expect(posts).toBe(5);
    });
    expect(bodies[4]).toMatchObject({ action: 'log', status: 'achieved' });

    const openSave = formsNamed('Save')[0];
    if (openSave === undefined) {
      throw new Error('missing save form');
    }
    fireEvent.submit(openSave);
    await waitFor(() => {
      expect(posts).toBe(6);
    });
    expect(bodies[5]).toMatchObject({ action: 'edit', name: 'Run' });

    const heldForm = formsNamed('Add habit')[0];
    if (heldForm === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.submit(heldForm);
    await waitFor(() => {
      expect(gets).toBe(8);
      expect(addName.value).toBe('');
    });
    expect(posts).toBe(7);
    expect(bodies.filter((body) => body.action === 'add')).toHaveLength(2);
  });

  it('adds the same habit again after its reload settles', async () => {
    let posts = 0;
    let gets = 0;
    const bodies: Array<{ action?: string; name?: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return json({ asOf: null, source: null, rates: {} });
        }
        if (init?.method === 'POST') {
          posts += 1;
          bodies.push(JSON.parse(String(init.body)) as { action?: string; name?: string });
          return json({ ok: true });
        }
        gets += 1;
        return json(payload());
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    const addName = screen.getByLabelText('Name');
    if (!(addName instanceof HTMLInputElement)) {
      throw new Error('missing add name');
    }
    fireEvent.change(addName, { target: { value: 'Held' } });
    const addForm = formsNamed('Add habit')[0];
    if (addForm === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.submit(addForm);
    await waitFor(() => {
      expect(posts).toBe(1);
      expect(gets).toBe(2);
      expect(addName.value).toBe('');
    });

    fireEvent.change(addName, { target: { value: 'Held' } });
    fireEvent.submit(addForm);
    await waitFor(() => {
      expect(posts).toBe(2);
      expect(gets).toBe(3);
      expect(addName.value).toBe('');
    });
    expect(bodies.filter((body) => body.action === 'add')).toHaveLength(2);
  });

  it('posts a rating again after Try again confirms the list', async () => {
    let posts = 0;
    let gets = 0;
    const bodies: Array<{ action?: string; status?: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return json({ asOf: null, source: null, rates: {} });
        }
        if (init?.method === 'POST') {
          posts += 1;
          bodies.push(JSON.parse(String(init.body)) as { action?: string; status?: string });
          return json({ ok: true });
        }
        gets += 1;
        if (gets === 2) {
          throw new Error('refresh');
        }
        return json(payload());
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    fireEvent.click(periodControl('2026-10-04', 'Achieved'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    await waitFor(() => {
      expect(posts).toBe(1);
      expect(gets).toBe(2);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
      expect(gets).toBe(3);
    });

    fireEvent.click(periodControl('2026-10-04', 'Achieved'));
    await waitFor(() => {
      expect(posts).toBe(2);
      expect(gets).toBe(4);
    });
    expect(bodies[1]).toMatchObject({ action: 'log', status: 'achieved' });
  });

  it('closes a saved edit after Try again confirms the list', async () => {
    let posts = 0;
    let gets = 0;
    const bodies: Array<{ action?: string; name?: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return json({ asOf: null, source: null, rates: {} });
        }
        if (init?.method === 'POST') {
          posts += 1;
          bodies.push(JSON.parse(String(init.body)) as { action?: string; name?: string });
          return json({ ok: true });
        }
        gets += 1;
        if (gets === 2) {
          throw new Error('refresh');
        }
        return json(payload());
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0] as HTMLButtonElement);
    const editName = screen.getAllByLabelText('Name')[0];
    if (!(editName instanceof HTMLInputElement)) {
      throw new Error('missing edit name');
    }
    fireEvent.change(editName, { target: { value: 'Run' } });
    const saveForm = formsNamed('Save')[0];
    if (saveForm === undefined) {
      throw new Error('missing save form');
    }
    fireEvent.submit(saveForm);
    expect(await screen.findByRole('alert')).toBeTruthy();
    await waitFor(() => {
      expect(posts).toBe(1);
      expect(gets).toBe(2);
    });
    expect(editName.value).toBe('Run');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
      expect(gets).toBe(3);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0] as HTMLButtonElement);
    const again = screen.getAllByLabelText('Name')[0];
    if (!(again instanceof HTMLInputElement)) {
      throw new Error('missing edit name');
    }
    expect(again.value).toBe('Walk');
    fireEvent.change(again, { target: { value: 'Run' } });
    const againForm = formsNamed('Save')[0];
    if (againForm === undefined) {
      throw new Error('missing save form');
    }
    fireEvent.submit(againForm);
    await waitFor(() => {
      expect(posts).toBe(2);
      expect(gets).toBe(4);
    });
    expect(bodies[1]).toMatchObject({ action: 'edit', name: 'Run' });
  });

  it('keeps an open edit when Try again starts before that save reaches the server', async () => {
    let posts = 0;
    let gets = 0;
    let releasePost: (value: Response) => void = () => undefined;
    let releaseRetry: (value: Response) => void = () => undefined;
    let releaseRefresh: (value: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return Promise.resolve(json({ asOf: null, source: null, rates: {} }));
        }
        if (init?.method === 'POST') {
          const parsed = JSON.parse(String(init.body)) as { action?: string };
          if (parsed.action !== 'edit') {
            return Promise.resolve(json({ error: 'Invalid name' }, 400));
          }
          posts += 1;
          if (posts === 1) {
            return new Promise<Response>((resolve) => {
              releasePost = resolve;
            });
          }
          return Promise.resolve(json({ ok: true }));
        }
        gets += 1;
        if (gets === 1) {
          return Promise.resolve(json(payload()));
        }
        if (gets === 2) {
          return new Promise<Response>((resolve) => {
            releaseRetry = resolve;
          });
        }
        if (gets === 3) {
          return new Promise<Response>((resolve) => {
            releaseRefresh = resolve;
          });
        }
        return Promise.resolve(json(payload()));
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0] as HTMLButtonElement);
    const editName = screen.getAllByLabelText('Name')[0];
    if (!(editName instanceof HTMLInputElement)) {
      throw new Error('missing edit name');
    }
    fireEvent.change(editName, { target: { value: 'Kept' } });
    fireEvent.click(periodControl('2026-10-04', 'Achieved'));
    expect(await screen.findByRole('alert')).toBeTruthy();

    const saveForm = formsNamed('Save')[0];
    if (saveForm === undefined) {
      throw new Error('missing save form');
    }
    fireEvent.submit(saveForm);
    await waitFor(() => {
      expect(posts).toBe(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(gets).toBe(2);
    });

    await act(async () => {
      releasePost(json({ ok: true }));
    });
    expect(posts).toBe(1);
    expect(editName.value).toBe('Kept');
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();

    await act(async () => {
      releaseRetry(json(payload()));
    });
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    const still = screen.getAllByLabelText('Name')[0];
    if (!(still instanceof HTMLInputElement)) {
      throw new Error('missing edit name');
    }
    expect(still.value).toBe('Kept');
    expect(posts).toBe(1);

    const saveAgain = formsNamed('Save')[0];
    if (saveAgain === undefined) {
      throw new Error('missing save form');
    }
    fireEvent.submit(saveAgain);
    await waitFor(() => {
      expect(gets).toBe(3);
    });
    expect(posts).toBe(1);

    await act(async () => {
      releaseRefresh(json(payload()));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0] as HTMLButtonElement);
    const again = screen.getAllByLabelText('Name')[0];
    if (!(again instanceof HTMLInputElement)) {
      throw new Error('missing edit name');
    }
    fireEvent.change(again, { target: { value: 'Kept' } });
    const againForm = formsNamed('Save')[0];
    if (againForm === undefined) {
      throw new Error('missing save form');
    }
    fireEvent.submit(againForm);
    await waitFor(() => {
      expect(posts).toBe(2);
    });
  });

  it('keeps the archive confirmation until a reload confirms that save', async () => {
    let posts = 0;
    let gets = 0;
    let releasePost: (value: Response) => void = () => undefined;
    let releaseRefresh: (value: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return Promise.resolve(json({ asOf: null, source: null, rates: {} }));
        }
        if (init?.method === 'POST') {
          posts += 1;
          return new Promise<Response>((resolve) => {
            releasePost = resolve;
          });
        }
        gets += 1;
        if (gets === 1) {
          return Promise.resolve(json(payload()));
        }
        return new Promise<Response>((resolve) => {
          releaseRefresh = resolve;
        });
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Archive' })[0] as HTMLButtonElement);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm archive' }));
    await waitFor(() => {
      expect(posts).toBe(1);
    });
    expect(screen.getByRole('button', { name: 'Confirm archive' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel archive' }));
    expect(screen.getByRole('button', { name: 'Confirm archive' })).toBeTruthy();

    await act(async () => {
      releasePost(json({ ok: true }));
    });
    await waitFor(() => {
      expect(gets).toBe(2);
    });
    expect(screen.getByRole('button', { name: 'Confirm archive' })).toBeTruthy();
    expect(posts).toBe(1);

    await act(async () => {
      releaseRefresh(json(payload()));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Confirm archive' })).toBeNull();
    });
  });

  it('keeps the archive confirmation when Try again starts before that save reaches the server', async () => {
    let posts = 0;
    let gets = 0;
    let releasePost: (value: Response) => void = () => undefined;
    let releaseRetry: (value: Response) => void = () => undefined;
    let releaseRefresh: (value: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return Promise.resolve(json({ asOf: null, source: null, rates: {} }));
        }
        if (init?.method === 'POST') {
          const parsed = JSON.parse(String(init.body)) as { action?: string };
          if (parsed.action !== 'archive') {
            return Promise.resolve(json({ error: 'down' }, 500));
          }
          posts += 1;
          return new Promise<Response>((resolve) => {
            releasePost = resolve;
          });
        }
        gets += 1;
        if (gets === 1) {
          return Promise.resolve(json(payload()));
        }
        if (gets === 2) {
          return new Promise<Response>((resolve) => {
            releaseRetry = resolve;
          });
        }
        return new Promise<Response>((resolve) => {
          releaseRefresh = resolve;
        });
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();
    fireEvent.click(periodControl('2026-10-04', 'Achieved'));
    expect(await screen.findByRole('alert')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Archive' })[0] as HTMLButtonElement);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm archive' }));
    await waitFor(() => {
      expect(posts).toBe(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(gets).toBe(2);
    });

    await act(async () => {
      releasePost(json({ ok: true }));
    });
    expect(posts).toBe(1);
    expect(screen.getByRole('button', { name: 'Confirm archive' })).toBeTruthy();

    await act(async () => {
      releaseRetry(json(payload()));
    });
    expect(screen.getByRole('button', { name: 'Confirm archive' })).toBeTruthy();
    expect(posts).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm archive' }));
    await waitFor(() => {
      expect(gets).toBe(3);
    });
    expect(posts).toBe(1);
    expect(screen.getByRole('button', { name: 'Confirm archive' })).toBeTruthy();

    await act(async () => {
      releaseRefresh(json(payload()));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Confirm archive' })).toBeNull();
    });
    expect(posts).toBe(1);
  });

  it('closes a saved archive after Try again confirms the list', async () => {
    let posts = 0;
    let gets = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return json({ asOf: null, source: null, rates: {} });
        }
        if (init?.method === 'POST') {
          posts += 1;
          return json({ ok: true });
        }
        gets += 1;
        if (gets === 2) {
          throw new Error('refresh');
        }
        return json(payload());
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Archive' })[0] as HTMLButtonElement);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm archive' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    await waitFor(() => {
      expect(posts).toBe(1);
      expect(gets).toBe(2);
    });
    expect(screen.getByRole('button', { name: 'Confirm archive' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel archive' }));
    expect(screen.getByRole('button', { name: 'Confirm archive' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Confirm archive' })).toBeNull();
      expect(gets).toBe(3);
    });
    expect(posts).toBe(1);
  });

  it('keeps another habit confirming when Try again releases a different archive', async () => {
    let posts = 0;
    let gets = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return json({ asOf: null, source: null, rates: {} });
        }
        if (init?.method === 'POST') {
          const parsed = JSON.parse(String(init.body)) as { action?: string; id?: string };
          if (parsed.action === 'archive' && parsed.id === 'h-owner') {
            posts += 1;
            return json({ ok: true });
          }
          return json({ error: 'down' }, 500);
        }
        gets += 1;
        if (gets === 2) {
          throw new Error('refresh');
        }
        return json(payload());
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Archive' })[0] as HTMLButtonElement);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm archive' }));
    await waitFor(() => {
      expect(posts).toBe(1);
      expect(gets).toBe(2);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Archive' }));
    expect(screen.getByRole('button', { name: 'Confirm archive' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(gets).toBe(3);
      expect(screen.queryByRole('alert')).toBeNull();
    });
    expect(screen.getByRole('button', { name: 'Confirm archive' })).toBeTruthy();
    expect(posts).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel archive' }));
    expect(screen.queryByRole('button', { name: 'Confirm archive' })).toBeNull();
  });

  it('keeps the archive confirmation when the save fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return json({ asOf: null, source: null, rates: {} });
        }
        if (init?.method === 'POST') {
          return json({ error: 'down' }, 500);
        }
        return json(payload());
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Archive' })[0] as HTMLButtonElement);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm archive' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirm archive' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel archive' }));
    expect(screen.queryByRole('button', { name: 'Confirm archive' })).toBeNull();
  });

  it('keeps another habit open while one archive confirms', async () => {
    let posts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return json({ asOf: null, source: null, rates: {} });
        }
        if (init?.method === 'POST') {
          posts += 1;
          return json({ ok: true });
        }
        return json(payload());
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0] as HTMLButtonElement);
    const editName = screen.getAllByLabelText('Name')[0];
    if (!(editName instanceof HTMLInputElement)) {
      throw new Error('missing edit name');
    }
    fireEvent.change(editName, { target: { value: 'Kept' } });

    fireEvent.click(screen.getAllByRole('button', { name: 'Archive' })[1] as HTMLButtonElement);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm archive' }));
    await waitFor(() => {
      expect(posts).toBe(1);
    });
    expect(editName.value).toBe('Kept');
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });

  it('does not replace a reload that a save already started', async () => {
    let posts = 0;
    let gets = 0;
    let releaseRefresh: (value: Response) => void = () => undefined;
    const bodies: Array<{ action?: string; status?: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return Promise.resolve(json({ asOf: null, source: null, rates: {} }));
        }
        if (init?.method === 'POST') {
          posts += 1;
          bodies.push(JSON.parse(String(init.body)) as { action?: string; status?: string });
          return Promise.resolve(json({ ok: true }));
        }
        gets += 1;
        if (gets === 1) {
          return Promise.resolve(json(payload()));
        }
        if (gets === 2) {
          return new Promise<Response>((resolve) => {
            releaseRefresh = resolve;
          });
        }
        return Promise.resolve(json(payload()));
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    const addName = screen.getByLabelText('Name');
    if (!(addName instanceof HTMLInputElement)) {
      throw new Error('missing add name');
    }
    fireEvent.change(addName, { target: { value: 'Held' } });
    const addForm = formsNamed('Add habit')[0];
    if (addForm === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.submit(addForm);
    await waitFor(() => {
      expect(posts).toBe(1);
      expect(gets).toBe(2);
    });

    fireEvent.click(periodControl('2026-10-04', 'Achieved'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(posts).toBe(1);
    expect(gets).toBe(2);

    await act(async () => {
      releaseRefresh(json(payload()));
    });
    await waitFor(() => {
      expect(addName.value).toBe('');
    });

    fireEvent.click(periodControl('2026-10-04', 'Achieved'));
    await waitFor(() => {
      expect(posts).toBe(2);
      expect(gets).toBe(3);
    });
    expect(bodies[1]).toMatchObject({ action: 'log', status: 'achieved' });
  });

  it('drops a reload that settles after the session changed', async () => {
    let posts = 0;
    let gets = 0;
    let releaseRefresh: (value: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return Promise.resolve(json({ asOf: null, source: null, rates: {} }));
        }
        if (init?.method === 'POST') {
          posts += 1;
          return Promise.resolve(json({ ok: true }));
        }
        gets += 1;
        if (gets === 1) {
          return Promise.resolve(json(payload()));
        }
        if (gets === 2) {
          return new Promise<Response>((resolve) => {
            releaseRefresh = resolve;
          });
        }
        const nextList = payload();
        const first = nextList.habits[0];
        if (first === undefined) {
          throw new Error('missing habit');
        }
        return Promise.resolve(json({ ...nextList, habits: [{ ...first, name: 'Next' }] }));
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    const addName = screen.getByLabelText('Name');
    if (!(addName instanceof HTMLInputElement)) {
      throw new Error('missing add name');
    }
    fireEvent.change(addName, { target: { value: 'Held' } });
    const addForm = formsNamed('Add habit')[0];
    if (addForm === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.submit(addForm);
    await waitFor(() => {
      expect(posts).toBe(1);
      expect(gets).toBe(2);
    });

    useAuthStore.setState({ session: 'other', account: viewer });
    expect(await screen.findByText('Next')).toBeTruthy();
    expect(screen.queryByText('Walk')).toBeNull();

    await act(async () => {
      releaseRefresh(json(payload()));
    });
    expect(screen.getByText('Next')).toBeTruthy();
    expect(screen.queryByText('Walk')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(gets).toBe(3);
  });

  it('sends the same action again after the request fails', async () => {
    let posts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return json({ asOf: null, source: null, rates: {} });
        }
        if (init?.method === 'POST') {
          posts += 1;
          return json({ error: 'Invalid name' }, 400);
        }
        return json(payload());
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    const addName = screen.getByLabelText('Name');
    if (!(addName instanceof HTMLInputElement)) {
      throw new Error('missing add name');
    }
    fireEvent.change(addName, { target: { value: 'Retry' } });
    const addForm = formsNamed('Add habit')[0];
    if (addForm === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.submit(addForm);
    expect(await screen.findByRole('alert')).toBeTruthy();
    await waitFor(() => {
      expect(posts).toBe(1);
    });
    expect(addName.value).toBe('Retry');

    fireEvent.submit(addForm);
    await waitFor(() => {
      expect(posts).toBe(2);
    });
    expect(addName.value).toBe('Retry');
  });

  it('keeps the list and shows an error when a later save fails', async () => {
    let posts = 0;
    let gets = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return json({ asOf: null, source: null, rates: {} });
        }
        if (init?.method === 'POST') {
          posts += 1;
          if (posts === 1) {
            return json({ ok: true });
          }
          return json({ error: 'Invalid name' }, 400);
        }
        gets += 1;
        if (gets === 2) {
          throw new Error('refresh');
        }
        return json(payload());
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();
    fireEvent.click(periodControl('2026-10-04', 'Achieved'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Walk')).toBeTruthy();

    const comment = screen.getAllByLabelText('Write a comment')[0];
    if (comment === undefined) {
      throw new Error('missing comment field');
    }
    fireEvent.change(comment, { target: { value: 'stay' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Post' })[0] as HTMLButtonElement);
    await waitFor(() => {
      expect((comment as HTMLTextAreaElement).value).toBe('stay');
    });

    const addName = screen.getAllByLabelText('Name').at(-1) as HTMLInputElement;
    fireEvent.change(addName, { target: { value: 'Stay' } });
    const failedAdd = formsNamed('Add habit')[0];
    if (failedAdd === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.submit(failedAdd);
    await waitFor(() => {
      expect(addName.value).toBe('Stay');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  it('keeps the loaded list when Try again and a session change also fail to load', async () => {
    let gets = 0;
    let releaseRetry: (value: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return Promise.resolve(json({ asOf: null, source: null, rates: {} }));
        }
        if (init?.method === 'POST') {
          return Promise.resolve(json({ error: 'Invalid name' }, 400));
        }
        gets += 1;
        if (gets === 1) {
          return Promise.resolve(json(payload()));
        }
        return new Promise<Response>((resolve) => {
          releaseRetry = resolve;
        });
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();
    fireEvent.click(periodControl('2026-10-04', 'Achieved'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Walk')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(gets).toBe(2);
    });
    expect(screen.getByText('Walk')).toBeTruthy();
    expect(screen.getByText('hello')).toBeTruthy();
    expect(screen.queryByText('Loading…')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    await act(async () => {
      releaseRetry(json({ error: 'down' }, 500));
    });
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Walk')).toBeTruthy();
    expect(screen.getByText('hello')).toBeTruthy();

    useAuthStore.setState({ session: 'other', account: viewer });
    await waitFor(() => {
      expect(gets).toBe(3);
    });
    expect(screen.getByText('Walk')).toBeTruthy();
    await act(async () => {
      releaseRetry(json({ error: 'down' }, 500));
    });
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Walk')).toBeTruthy();
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('sends Time-Zone on add, comment, delete, and invoice only', async () => {
    const posts: Array<{ body: { action?: string }; zone: string | null }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return json({ asOf: null, source: null, rates: {} });
        }
        if (init?.method === 'POST') {
          const headers = new Headers(init.headers);
          const body = JSON.parse(String(init.body)) as { action?: string };
          posts.push({ body, zone: headers.get('Time-Zone') });
          if (body.action === 'invoice') {
            return json({ pr: 'lnbc1', amountSats: 21 });
          }
          return json({ ok: true });
        }
        return json(payload());
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    fireEvent.click(periodControl('2026-10-04', 'Achieved'));
    await waitFor(() => {
      expect(posts.some((row) => row.body.action === 'log')).toBe(true);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0] as HTMLButtonElement);
    const saveForm = formsNamed('Save')[0];
    if (saveForm === undefined) {
      throw new Error('missing save form');
    }
    fireEvent.submit(saveForm);
    await waitFor(() => {
      expect(posts.some((row) => row.body.action === 'edit')).toBe(true);
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    });

    const comment = screen.getAllByLabelText('Write a comment')[0];
    if (comment === undefined) {
      throw new Error('missing comment field');
    }
    fireEvent.change(comment, { target: { value: 'note' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Post' })[0] as HTMLButtonElement);
    await waitFor(() => {
      expect(posts.some((row) => row.body.action === 'comment')).toBe(true);
    });

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Delete comment' })[0] as HTMLButtonElement,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm deletion' }));
    await waitFor(() => {
      expect(posts.some((row) => row.body.action === 'deleteComment')).toBe(true);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Archive' })[0] as HTMLButtonElement);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm archive' }));
    await waitFor(() => {
      expect(posts.some((row) => row.body.action === 'archive')).toBe(true);
    });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Next' } });
    const addForm = formsNamed('Add habit')[0];
    if (addForm === undefined) {
      throw new Error('missing add form');
    }
    fireEvent.submit(addForm);
    await waitFor(() => {
      expect(posts.some((row) => row.body.action === 'add')).toBe(true);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Send Bitcoin' }));
    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(posts.some((row) => row.body.action === 'invoice')).toBe(true);
    });

    const zoneOf = (action: string): string | null | undefined =>
      posts.find((row) => row.body.action === action)?.zone;
    expect(zoneOf('log')).toBeNull();
    expect(zoneOf('edit')).toBeNull();
    expect(zoneOf('archive')).toBeNull();
    expect(zoneOf('add')?.length).toBeGreaterThan(0);
    expect(zoneOf('comment')?.length).toBeGreaterThan(0);
    expect(zoneOf('deleteComment')?.length).toBeGreaterThan(0);
    expect(zoneOf('invoice')?.length).toBeGreaterThan(0);
  });

  it('refuses to save when the session is missing or blank', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(freshJson(payload())));
    useAuthStore.setState({ session: null, account: owner });
    const first = renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();
    fireEvent.click(periodControl('2026-10-04', 'Achieved'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
    first.unmount();

    useAuthStore.setState({ session: '', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();
    fireEvent.click(periodControl('2026-10-04', 'Achieved'));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Sign in to comment' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
  });

  it('uses the forum pay sheet for another members comment', async () => {
    const posts: Array<{ amountSats?: number; zone: string }> = [];
    let releaseStale: (value: Response) => void = () => undefined;
    let rejectStale: (reason: unknown) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as { amountSats?: number };
          const headers = new Headers(init.headers);
          const zone = headers.get('Time-Zone') ?? '';
          if (body.amountSats === undefined) {
            posts.push({ zone });
          } else {
            posts.push({ amountSats: body.amountSats, zone });
          }
          if (body.amountSats === 21) {
            return json({ error: "The author's wallet cannot receive this Bitcoin payment" }, 409);
          }
          if (body.amountSats === 22) {
            return json({ error: 'Too many payments' }, 429);
          }
          if (body.amountSats === 99) {
            return json({});
          }
          if (body.amountSats === 23) {
            return json({ pr: 'lnbc23', amountSats: 23 });
          }
          if (body.amountSats === 24) {
            return json({ pr: 'lnbc24', amountSats: 99 });
          }
          if (body.amountSats === 25) {
            return json({ pr: 'lnbc25' });
          }
          if (body.amountSats === 26) {
            return json({ error: 'Expected a JSON body with an integer "amountSats"' }, 400);
          }
          if (body.amountSats === 50) {
            return new Promise<Response>((resolve) => {
              releaseStale = resolve;
            });
          }
          if (body.amountSats === 51) {
            return new Promise<Response>((_resolve, reject) => {
              rejectStale = reject;
            });
          }
          return json({ ok: true });
        }
        return json(payload());
      }),
    );
    useAuthStore.setState({ session: 'tok', account: viewer });
    renderWithLocale(<MemberHabits />);
    const gifts = await screen.findAllByRole('button', { name: 'Send Bitcoin' });
    expect(gifts).toHaveLength(2);
    const gift = gifts[0];
    if (gift === undefined) {
      throw new Error('missing gift button');
    }
    expect(screen.queryByLabelText('Amount')).toBeNull();
    fireEvent.click(gift);
    const amount = screen.getByLabelText('Amount');
    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText("The author's wallet cannot receive this Bitcoin payment"),
    ).toBeTruthy();
    expect(posts[0]?.amountSats).toBe(21);
    expect(posts[0]?.zone.length).toBeGreaterThan(0);

    fireEvent.change(amount, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText('Expected a JSON body with an integer "amountSats"'),
    ).toBeTruthy();
    expect(posts).toHaveLength(1);

    fireEvent.change(amount, { target: { value: '10000001' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText('Expected a JSON body with an integer "amountSats"'),
    ).toBeTruthy();
    expect(posts).toHaveLength(1);

    fireEvent.change(amount, { target: { value: '22' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText('Too many payments. Please wait a moment and try again.'),
    ).toBeTruthy();

    fireEvent.change(amount, { target: { value: '99' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Could not start the Bitcoin payment')).toBeTruthy();

    fireEvent.change(amount, { target: { value: '24' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Could not start the Bitcoin payment')).toBeTruthy();

    fireEvent.change(amount, { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Could not start the Bitcoin payment')).toBeTruthy();

    fireEvent.change(amount, { target: { value: '26' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(
      await screen.findByText('Expected a JSON body with an integer "amountSats"'),
    ).toBeTruthy();

    fireEvent.change(amount, { target: { value: '23' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Pay ₿23')).toBeTruthy();
    expect(
      screen.getByText('Your 21.gifts wallet is not available here, so this cannot be paid.'),
    ).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Bitcoin payment QR code' })).toBeNull();
    expect(screen.queryByText('lnbc23')).toBeNull();
    expect(screen.queryByDisplayValue('lnbc23')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByLabelText('Amount')).toBeNull();
    expect(screen.queryByText('Pay ₿23')).toBeNull();

    fireEvent.click(
      screen.getAllByRole('button', { name: 'Send Bitcoin' })[0] as HTMLButtonElement,
    );
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(posts.some((row) => row.amountSats === 50)).toBe(true);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Send Bitcoin' })[1] as HTMLButtonElement,
    );
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '51' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(posts.some((row) => row.amountSats === 51)).toBe(true);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Send Bitcoin' })[0] as HTMLButtonElement,
    );
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '23' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Pay ₿23')).toBeTruthy();
    await act(async () => {
      releaseStale(json({ pr: 'lnbc-stale', amountSats: 50 }));
      rejectStale(new Error('late'));
    });
    expect(screen.queryByText('Pay ₿50')).toBeNull();
    expect(screen.queryByText('Could not start the Bitcoin payment')).toBeNull();
    expect(screen.queryByText('lnbc-stale')).toBeNull();
  });

  it('does not show a gift result after the session changed', async () => {
    let releasePay: (value: Response) => void = () => undefined;
    let rejectPay: (reason: unknown) => void = () => undefined;
    let posts = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return Promise.resolve(json({ asOf: null, source: null, rates: {} }));
        }
        if (init?.method === 'POST') {
          posts += 1;
          if (posts === 1) {
            return new Promise<Response>((resolve) => {
              releasePay = resolve;
            });
          }
          return new Promise<Response>((_resolve, reject) => {
            rejectPay = reject;
          });
        }
        return Promise.resolve(json(payload()));
      }),
    );
    useAuthStore.setState({ session: 'tok', account: viewer });
    renderWithLocale(<MemberHabits />);
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Send Bitcoin' }))[0] as HTMLButtonElement,
    );
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(posts).toBe(1);
    });

    useAuthStore.setState({ session: 'other', account: owner });
    await waitFor(() => {
      expect(screen.queryByLabelText('Amount')).toBeNull();
    });
    await act(async () => {
      releasePay(json({ pr: 'lnbc-stale', amountSats: 21 }));
    });
    expect(screen.queryByText('Pay ₿21')).toBeNull();
    expect(screen.queryByLabelText('Amount')).toBeNull();

    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Send Bitcoin' }))[0] as HTMLButtonElement,
    );
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '22' } });
    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(posts).toBe(2);
    });
    useAuthStore.setState({ session: 'tok', account: viewer });
    await waitFor(() => {
      expect(screen.queryByLabelText('Amount')).toBeNull();
    });
    await act(async () => {
      rejectPay(new Error('Too many payments'));
    });
    expect(screen.queryByText('Too many payments')).toBeNull();
    expect(screen.queryByLabelText('Amount')).toBeNull();
  });

  it('hides an open edit and archive confirm after the session changed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (isRateRequest(input)) {
          return json({ asOf: null, source: null, rates: {} });
        }
        return json(payload());
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();
    expect(screen.getByText(/Internal notes:/)).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0] as HTMLButtonElement);
    const notes = screen.getAllByLabelText('Internal notes')[0];
    if (!(notes instanceof HTMLInputElement)) {
      throw new Error('missing notes');
    }
    fireEvent.change(notes, { target: { value: 'draft-secret' } });
    expect(screen.getByDisplayValue('draft-secret')).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Archive' })[1] as HTMLButtonElement);
    expect(screen.getByRole('button', { name: 'Confirm archive' })).toBeTruthy();

    useAuthStore.setState({ session: 'other', account: viewer });
    await waitFor(() => {
      expect(screen.queryByDisplayValue('draft-secret')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Confirm archive' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    });
    expect(screen.queryByText('draft-secret')).toBeNull();
    expect(screen.queryByText(/Internal notes:/)).toBeNull();
  });

  it('closes an open comment deletion when the session changes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (isRateRequest(input)) {
          return json({ asOf: null, source: null, rates: {} });
        }
        return json(payload());
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Delete comment' })[0] as HTMLButtonElement,
    );
    expect(screen.getByRole('button', { name: 'Confirm deletion' })).toBeTruthy();

    useAuthStore.setState({ session: 'next', account: nextInitiator });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Confirm deletion' })).toBeNull();
    });
    expect(screen.getAllByRole('button', { name: 'Delete comment' }).length).toBeGreaterThan(0);

    useAuthStore.setState({ session: 'tok', account: owner });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Confirm deletion' })).toBeNull();
    });
    expect(screen.getAllByRole('button', { name: 'Delete comment' }).length).toBeGreaterThan(0);
  });

  it('clears the new-habit draft and unsent comments when the session changes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        if (isRateRequest(input)) {
          return json({ asOf: null, source: null, rates: {} });
        }
        return json(payload());
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('Walk')).toBeTruthy();

    const addName = screen.getByLabelText('Name');
    if (!(addName instanceof HTMLInputElement)) {
      throw new Error('missing add name');
    }
    fireEvent.change(addName, { target: { value: 'Held' } });
    const addNotes = screen.getByLabelText('Internal notes');
    if (!(addNotes instanceof HTMLInputElement)) {
      throw new Error('missing add notes');
    }
    fireEvent.change(addNotes, { target: { value: 'draft-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Weekly' }));
    const comment = screen.getAllByLabelText('Write a comment')[0];
    if (!(comment instanceof HTMLTextAreaElement)) {
      throw new Error('missing comment');
    }
    fireEvent.change(comment, { target: { value: 'unsent' } });

    useAuthStore.setState({ session: 'other', account: viewer });
    await waitFor(() => {
      expect(screen.queryByDisplayValue('Held')).toBeNull();
      expect(screen.queryByDisplayValue('draft-secret')).toBeNull();
      expect(screen.queryByDisplayValue('unsent')).toBeNull();
    });
    expect(
      (screen.getByRole('button', { name: 'Weekly' }) as HTMLButtonElement).getAttribute(
        'aria-pressed',
      ),
    ).toBe('false');
    expect(
      (screen.getByRole('button', { name: 'Daily' }) as HTMLButtonElement).getAttribute(
        'aria-pressed',
      ),
    ).toBe('true');
  });

  it('does not post the same gift again while that request is still waiting', async () => {
    let posts = 0;
    let releasePay: (value: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (isRateRequest(input)) {
          return Promise.resolve(json({ asOf: null, source: null, rates: {} }));
        }
        if (init?.method === 'POST') {
          posts += 1;
          const body = JSON.parse(String(init.body)) as { amountSats?: number };
          if (posts === 1) {
            return new Promise<Response>((resolve) => {
              releasePay = resolve;
            });
          }
          return Promise.resolve(json({ pr: 'lnbc-next', amountSats: body.amountSats }));
        }
        return Promise.resolve(json(payload()));
      }),
    );
    useAuthStore.setState({ session: 'tok', account: viewer });
    renderWithLocale(<MemberHabits />);
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Send Bitcoin' }))[0] as HTMLButtonElement,
    );
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(posts).toBe(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Send Bitcoin' }))[0] as HTMLButtonElement,
    );
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(posts).toBe(1);

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '22' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Pay ₿22')).toBeTruthy();
    expect(posts).toBe(2);

    await act(async () => {
      releasePay(json({ pr: 'lnbc-stale', amountSats: 21 }));
    });
    expect(screen.queryByText('Pay ₿21')).toBeNull();
    expect(screen.getByText('Pay ₿22')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Send Bitcoin' }))[0] as HTMLButtonElement,
    );
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(posts).toBe(3);
    });
  });

  it('does not invoice until the spot rate read has settled', async () => {
    let releaseStats!: (value: Response) => void;
    const posts: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/fx/spot')) {
          return new Promise<Response>((resolve) => {
            releaseStats = resolve;
          });
        }
        if (init?.method === 'POST') {
          posts.push(String(init.body));
          return json({ pr: 'lnbc1', amountSats: 21 });
        }
        return json(payload());
      }),
    );
    useAuthStore.setState({ session: 'tok', account: viewer });
    renderWithLocale(<MemberHabits />);
    const gifts = await screen.findAllByRole('button', { name: 'Send Bitcoin' });
    const gift = gifts[0];
    if (gift === undefined) {
      throw new Error('missing gift button');
    }
    fireEvent.click(gift);
    const cont = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(cont.disabled).toBe(true);
    fireEvent.click(cont);
    fireEvent.submit(cont.closest('form') as HTMLFormElement);
    expect(posts).toEqual([]);

    await act(async () => {
      releaseStats(json({ asOf: null, source: null, rates: {} }));
    });
    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => {
      expect(posts.some((body) => body.includes('"amountSats":21'))).toBe(true);
    });
  });

  it('rates an earlier returned period and leaves an archived habit read-only', async () => {
    const bodies: unknown[] = [];
    const list = payload();
    const habits: unknown[] = [
      ...list.habits,
      {
        id: 'h-archived',
        accountId: 'acc-owner',
        ownerName: 'Ada',
        role: 'initiator',
        name: 'Old walk',
        description: 'Outside',
        cadence: 'daily',
        timeZone: 'Asia/Manila',
        firstPeriod: '2026-10-03',
        lastPeriod: '2026-10-04',
        periods: [period('2026-10-03', 'achieved'), period('2026-10-04', null)],
        comments: [
          {
            id: 'c-archived',
            habitId: 'h-archived',
            accountId: 'acc-other',
            name: 'Bea',
            text: 'kept',
            week: '2026-09-28',
            createdAt: 3,
          },
        ],
      },
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          bodies.push(JSON.parse(String(init.body)));
          return json({ ok: true });
        }
        return json({ reviewWeek: list.reviewWeek, habits });
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    const title = await screen.findByRole('heading', { name: 'Old walk' });
    const card = title.closest('article');
    if (!(card instanceof HTMLElement)) {
      throw new Error('missing archived card');
    }
    const archived = within(card);
    expect(archived.getByText('Archived')).toBeTruthy();
    expect(archived.getByText('2026-10-03')).toBeTruthy();
    expect(archived.getByText('Achieved')).toBeTruthy();
    expect(archived.getByText('kept')).toBeTruthy();
    expect(archived.getByText('Not rated yet')).toBeTruthy();
    expect(archived.getByRole('button', { name: 'Send Bitcoin' })).toBeTruthy();
    expect(archived.queryByRole('button', { name: 'Achieved' })).toBeNull();
    expect(archived.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(archived.queryByRole('button', { name: 'Archive' })).toBeNull();

    fireEvent.click(periodControl('2026-10-01', 'Not achieved'));
    await waitFor(() => {
      expect(bodies).toEqual([
        { action: 'log', id: 'h-owner', period: '2026-10-01', status: 'missed' },
      ]);
    });
  });

  it('leaves the rating pill unpressed when the open period is not logged', async () => {
    const list = payload();
    const habit = list.habits[0];
    if (habit === undefined) {
      throw new Error('missing habit');
    }
    habit.periods = [period('2026-10-04', null)];
    vi.stubGlobal('fetch', vi.fn().mockImplementation(freshJson(list)));
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    const achieved = await screen.findByRole('button', { name: 'Achieved' });
    expect(achieved.getAttribute('aria-pressed')).toBe('false');
  });

  it('hides Send Bitcoin when the session is missing or blank', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(freshJson(payload())));
    useAuthStore.setState({ session: null, account: viewer });
    const first = renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('hello')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
    first.unmount();

    useAuthStore.setState({ session: '', account: viewer });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByText('hello')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete comment' })).toBeNull();
  });

  it('does not post while the first list is still in flight', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (url.includes('/habits')) {
          return new Promise<Response>(() => undefined);
        }
        return json({ asOf: null, source: null, rates: {} });
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    fireEvent.change(await screen.findByLabelText('Name'), { target: { value: 'Walk' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add habit' }));
    await act(async () => {
      await Promise.resolve();
    });
    const posted = vi.mocked(fetch).mock.calls.some((call) => {
      const init = call[1] as RequestInit | undefined;
      return init?.method === 'POST';
    });
    expect(posted).toBe(false);
  });

  it('ignores a habit list that arrives after a newer load', async () => {
    const pending: Array<(value: Response) => void> = [];
    const newer = payload();
    const older = payload();
    const newerHabit = newer.habits[0];
    const olderHabit = older.habits[0];
    if (newerHabit === undefined || olderHabit === undefined) {
      throw new Error('missing habit');
    }
    newerHabit.name = 'Newer';
    olderHabit.name = 'Older';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url =
          typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        if (!url.includes('/habits')) {
          return json({ asOf: null, source: null, rates: {} });
        }
        return new Promise<Response>((resolve) => {
          pending.push(resolve);
        });
      }),
    );
    useAuthStore.setState({ session: 'tok', account: owner });
    renderWithLocale(<MemberHabits />);
    await waitFor(() => {
      expect(pending.length).toBeGreaterThan(0);
    });
    const beforeSwitch = pending.length;
    useAuthStore.setState({ session: 'tok-2', account: owner });
    await waitFor(() => {
      expect(pending.length).toBeGreaterThan(beforeSwitch);
    });
    const latest = pending.length - 1;
    await act(async () => {
      pending[latest]?.(json(newer));
    });
    expect(await screen.findByText('Newer')).toBeTruthy();
    await act(async () => {
      for (let index = 0; index < latest; index += 1) {
        pending[index]?.(json(older));
      }
    });
    expect(screen.queryByText('Older')).toBeNull();
    expect(screen.getByText('Newer')).toBeTruthy();
  });
});
