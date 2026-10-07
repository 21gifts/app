import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessAuditScreen } from '@/components/AccessAuditScreen';
import type { Account } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('@/lib/api', () => ({ fetchTeamAudit: vi.fn() }));

import { fetchTeamAudit } from '@/lib/api';

const auditMock = vi.mocked(fetchTeamAudit);
const AT = Date.parse('2026-10-01T12:00:00.000Z');

const account: Account = {
  id: 'acc_founder',
  linkingKey: null,
  role: 'founder',
  name: 'Fia',
  location: null,
  lightningAddress: null,
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
};

let observers: IntersectionObserverCallback[] = [];

class FakeObserver {
  public constructor(callback: IntersectionObserverCallback) {
    observers.push(callback);
  }
  public observe(): void {}
  public disconnect(): void {}
}

beforeEach(() => {
  vi.clearAllMocks();
  observers = [];
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('AccessAuditScreen', () => {
  it('lists who opened whose data, what, and when', async () => {
    auditMock.mockResolvedValue({
      entries: [
        {
          viewerAccountId: 'acc_mod',
          viewerName: 'Mo',
          memberAccountId: 'acc/ada',
          memberName: 'Ada',
          what: 'wallet',
          at: AT,
        },
        {
          viewerAccountId: 'acc_mod',
          viewerName: '',
          memberAccountId: 'acc_bob',
          memberName: null,
          what: 'events',
          at: AT - 1,
        },
        { viewerAccountId: 'acc_x', memberAccountId: 'acc_y', what: 'events', at: AT - 2 },
      ],
      nextCursor: null,
    });
    renderWithLocale(<AccessAuditScreen />);
    expect(screen.getByText('Loading…')).toBeTruthy();
    const list = await screen.findByRole('list', { name: 'Access log entries' });
    expect(auditMock).toHaveBeenCalledWith('sess', null);
    expect(list.textContent).toContain('Wallet data');
    expect(screen.getAllByText('Activity')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Ada' }).getAttribute('href')).toBe(
      '/members/acc%2Fada',
    );
    expect(screen.getByRole('link', { name: 'Mo' }).getAttribute('href')).toBe('/members/acc_mod');
    expect(screen.getAllByRole('link', { name: 'Unnamed' })).toHaveLength(4);
  });

  it('says when nobody opened member data yet', async () => {
    auditMock.mockResolvedValue({ entries: [], nextCursor: null });
    renderWithLocale(<AccessAuditScreen />);
    await screen.findByText('Nobody has opened member data yet.');
  });

  it('shows the error and tries again', async () => {
    auditMock
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ entries: [], nextCursor: null });
    renderWithLocale(<AccessAuditScreen />);
    await screen.findByText('Could not load the access log. Please try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByText('Nobody has opened member data yet.');
  });

  it('keeps the list when the next page fails', async () => {
    vi.stubGlobal('IntersectionObserver', FakeObserver);
    auditMock
      .mockResolvedValueOnce({
        entries: [
          {
            viewerAccountId: 'acc_mod',
            viewerName: 'Mo',
            memberAccountId: 'acc_ada',
            memberName: 'Ada',
            what: 'wallet',
            at: AT,
          },
        ],
        nextCursor: 'c1',
      })
      .mockRejectedValueOnce(new Error('down'));
    renderWithLocale(<AccessAuditScreen />);
    await screen.findByRole('link', { name: 'Ada' });
    act(() => {
      observers[observers.length - 1]?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });
    await screen.findByText('Could not load the access log. Please try again.');
    expect(screen.getByRole('link', { name: 'Ada' })).toBeTruthy();
    expect(auditMock).toHaveBeenLastCalledWith('sess', 'c1');
  });

  it('says the page is for founders and initiators when the api refuses (a moderator)', async () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'moderator' } });
    auditMock.mockResolvedValue(null);
    renderWithLocale(<AccessAuditScreen />);
    await screen.findByText('This page is for founders and initiators.');
  });

  it('says the same to a lower role and fetches nothing', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'verified' } });
    renderWithLocale(<AccessAuditScreen />);
    expect(screen.getByText('This page is for founders and initiators.')).toBeTruthy();
    expect(auditMock).not.toHaveBeenCalled();
  });

  it('renders nothing without a session', () => {
    useAuthStore.setState({ session: null, account: null });
    const { container } = renderWithLocale(<AccessAuditScreen />);
    expect(container.innerHTML).toBe('');
    expect(auditMock).not.toHaveBeenCalled();
  });
});
