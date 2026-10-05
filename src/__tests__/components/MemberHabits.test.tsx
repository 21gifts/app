import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
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
    expect(screen.queryByRole('button', { name: 'Donate Bitcoin' })).toBeNull();
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
    expect(await screen.findByText(/Internal notes: secret/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Delete comment' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Donate Bitcoin' })).toHaveLength(1);
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

    const name = screen.getAllByLabelText('Name')[0];
    const description = screen.getAllByLabelText('Description')[0];
    const notes = screen.getAllByLabelText('Internal notes')[0];
    if (name === undefined || description === undefined || notes === undefined) {
      throw new Error('missing edit fields');
    }
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

    const addName = screen.getAllByLabelText('Name')[2];
    const addDescription = screen.getAllByLabelText('Description')[2];
    const addNotes = screen.getAllByLabelText('Internal notes')[2];
    if (addName === undefined || addDescription === undefined || addNotes === undefined) {
      throw new Error('missing add fields');
    }
    fireEvent.change(addName, { target: { value: 'Vorsatz' } });
    fireEvent.change(addDescription, { target: { value: 'public' } });
    fireEvent.change(addNotes, { target: { value: 'private' } });
    fireEvent.click(screen.getByRole('radio', { name: 'Weekly' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Daily' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Weekly' }));
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
      vi.fn(async (_url: string, init?: RequestInit) => {
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
    first.unmount();

    useAuthStore.setState({ session: '', account: owner });
    renderWithLocale(<MemberHabits />);
    expect(await screen.findByRole('button', { name: 'Achieved' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Achieved' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Sign in to comment' })).toBeNull();
  });

  it('opens a donation, rejects a bad amount, and shows an invoice', async () => {
    const posts: unknown[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'POST') {
          const body = JSON.parse(String(init.body)) as { amountSats?: number };
          posts.push(body);
          if (body.amountSats === 21) {
            return json({ error: 'No wallet' }, 409);
          }
          if (body.amountSats === 22) {
            return json({});
          }
          if (body.amountSats === 23) {
            return json({ pr: 'lnbc1' });
          }
          return json({ ok: true });
        }
        return json(payload());
      }),
    );
    useAuthStore.setState({ session: 'tok', account: viewer });
    renderWithLocale(<MemberHabits />);
    const donate = (await screen.findAllByRole('button', { name: 'Donate Bitcoin' }))[0];
    if (donate === undefined) {
      throw new Error('missing donate button');
    }
    expect(screen.queryByLabelText('Amount')).toBeNull();
    fireEvent.click(donate);
    const amount = screen.getByLabelText('Amount');
    fireEvent.click(screen.getByRole('button', { name: 'Bitcoin invoice' }));
    expect(
      await screen.findByText('Could not save the habit tracker. Please try again.'),
    ).toBeTruthy();
    fireEvent.change(amount, { target: { value: '99999999999999999999' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bitcoin invoice' }));
    fireEvent.change(amount, { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bitcoin invoice' }));
    expect(await screen.findByText('No Bitcoin wallet available for donations.')).toBeTruthy();
    fireEvent.change(amount, { target: { value: '22' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bitcoin invoice' }));
    expect(
      await screen.findByText('Could not save the habit tracker. Please try again.'),
    ).toBeTruthy();
    fireEvent.change(amount, { target: { value: '23' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bitcoin invoice' }));
    expect(await screen.findByDisplayValue('lnbc1')).toBeTruthy();
    expect(posts.map((row) => (row as { amountSats?: number }).amountSats)).toEqual([21, 22, 23]);
    fireEvent.click(donate);
    expect(screen.queryByLabelText('Amount')).toBeNull();
  });

  it('shows a save error when a donation is requested without a session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(freshJson(payload())));
    useAuthStore.setState({ session: null, account: viewer });
    const first = renderWithLocale(<MemberHabits />);
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Donate Bitcoin' }))[0] as HTMLButtonElement,
    );
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bitcoin invoice' }));
    expect(
      await screen.findByText('Could not save the habit tracker. Please try again.'),
    ).toBeTruthy();
    first.unmount();

    useAuthStore.setState({ session: '', account: viewer });
    renderWithLocale(<MemberHabits />);
    fireEvent.click(
      (await screen.findAllByRole('button', { name: 'Donate Bitcoin' }))[0] as HTMLButtonElement,
    );
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '21' } });
    fireEvent.click(screen.getByRole('button', { name: 'Bitcoin invoice' }));
    expect(
      await screen.findByText('Could not save the habit tracker. Please try again.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Delete comment' })).toBeNull();
  });
});
