import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemberHabits } from '@/components/MemberHabits';
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

function isGiftStats(input: RequestInfo | URL): boolean {
  let url = '';
  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.href;
  } else {
    url = input.url;
  }
  return url.includes('/gifts/stats');
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
  vi.spyOn(window, 'confirm').mockReturnValue(true);
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
    const signIn = screen.getAllByRole('link', { name: 'Sign in to comment' });
    expect(signIn).toHaveLength(3);
    expect(signIn[0]?.getAttribute('href')).toBe('/login');
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

    fireEvent.click(screen.getByRole('button', { name: 'Achieved' }));
    fireEvent.click(screen.getByRole('button', { name: 'Partially achieved' }));
    fireEvent.click(screen.getByRole('button', { name: 'Not achieved' }));
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

    vi.mocked(window.confirm).mockReturnValueOnce(false);
    fireEvent.click(screen.getAllByRole('button', { name: 'Archive' })[0] as HTMLButtonElement);
    expect(bodies).toHaveLength(6);
    vi.mocked(window.confirm).mockReturnValueOnce(false);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Delete comment' })[0] as HTMLButtonElement,
    );
    expect(bodies).toHaveLength(6);
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Delete comment' })[0] as HTMLButtonElement,
    );
    await waitFor(() => {
      expect(bodies[6]).toEqual({ action: 'deleteComment', id: 'c-own' });
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Archive' })[1] as HTMLButtonElement);
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

  it('keeps the list and shows an error when a later save fails', async () => {
    let posts = 0;
    let gets = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (isGiftStats(input)) {
          return json({ spendOverTime: [] });
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
    fireEvent.click(screen.getByRole('button', { name: 'Achieved' }));
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

  it('refuses to save when the session is missing or blank', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(freshJson(payload())));
    useAuthStore.setState({ session: null, account: owner });
    const first = renderWithLocale(<MemberHabits />);
    expect(await screen.findByRole('button', { name: 'Achieved' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Achieved' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send Bitcoin' })).toBeNull();
    first.unmount();

    useAuthStore.setState({ session: '', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByRole('button', { name: 'Achieved' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Achieved' }));
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
    expect(screen.getByRole('button', { name: 'Pay with Wallet of Satoshi' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Bitcoin payment QR code' })).toBeTruthy();
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
        return json({ spendOverTime: [] });
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
          return json({ spendOverTime: [] });
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
