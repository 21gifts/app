import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TeamMemberDataScreen } from '@/components/TeamMemberDataScreen';
import type { Account, MemberProfile } from '@/lib/api-types';
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

vi.mock('@/lib/api', () => ({ fetchMember: vi.fn() }));
vi.mock('@/components/TeamMemberWallet', () => ({
  TeamMemberWallet: (props: { session: string; accountId: string }) => (
    <div data-testid="wallet">{`${props.session}:${props.accountId}`}</div>
  ),
}));
vi.mock('@/components/TeamMemberEvents', () => ({
  TeamMemberEvents: (props: { session: string; accountId: string }) => (
    <div data-testid="events">{`${props.session}:${props.accountId}`}</div>
  ),
}));

import { fetchMember } from '@/lib/api';

const memberMock = vi.mocked(fetchMember);

const account: Account = {
  id: 'acc_mod',
  linkingKey: null,
  role: 'founder',
  name: 'Mo',
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

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ session: 'sess', account });
});

afterEach(cleanup);

describe('TeamMemberDataScreen', () => {
  it('names the member, opens on Wallet, and switches to Activity', async () => {
    memberMock.mockResolvedValue({ name: 'Ada' } as MemberProfile);
    renderWithLocale(<TeamMemberDataScreen accountId="acc/1" />);
    expect(screen.getByRole('heading', { name: 'Member data' })).toBeTruthy();
    expect(screen.getByTestId('wallet').textContent).toBe('sess:acc/1');
    const link = await screen.findByRole('link', { name: 'Ada, Open profile' });
    expect(link.getAttribute('href')).toBe('/members/acc%2F1');
    expect(memberMock).toHaveBeenCalledWith('sess', 'acc/1');
    fireEvent.click(screen.getByRole('button', { name: 'Activity' }));
    expect(screen.getByTestId('events').textContent).toBe('sess:acc/1');
    expect(screen.queryByTestId('wallet')).toBeNull();
  });

  it('says Unnamed for a member without a name', async () => {
    memberMock.mockResolvedValue({ name: null } as MemberProfile);
    renderWithLocale(<TeamMemberDataScreen accountId="acc_1" />);
    await screen.findByRole('link', { name: 'Unnamed, Open profile' });
  });

  it('leaves the name out when the profile is missing or fails', async () => {
    memberMock.mockResolvedValueOnce(null);
    const first = renderWithLocale(<TeamMemberDataScreen accountId="acc_1" />);
    await Promise.resolve();
    expect(screen.queryByRole('link')).toBeNull();
    first.unmount();
    memberMock.mockRejectedValueOnce(new Error('down'));
    renderWithLocale(<TeamMemberDataScreen accountId="acc_1" />);
    await Promise.resolve();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('drops a profile that arrives after unmount', async () => {
    let done: (member: MemberProfile) => void = () => undefined;
    memberMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          done = resolve;
        }),
    );
    const view = renderWithLocale(<TeamMemberDataScreen accountId="acc_1" />);
    view.unmount();
    done({ name: 'Late' } as MemberProfile);
    await Promise.resolve();
    expect(screen.queryByText('Late')).toBeNull();
  });

  it('shows the forbidden sentence to a lower role and fetches nothing', () => {
    useAuthStore.setState({ session: 'sess', account: { ...account, role: 'verified' } });
    renderWithLocale(<TeamMemberDataScreen accountId="acc_1" />);
    expect(screen.getByText('This page is for moderators.')).toBeTruthy();
    expect(memberMock).not.toHaveBeenCalled();
    expect(screen.queryByTestId('wallet')).toBeNull();
  });

  it('renders nothing without a session', () => {
    useAuthStore.setState({ session: null, account: null });
    const { container } = renderWithLocale(<TeamMemberDataScreen accountId="acc_1" />);
    expect(container.innerHTML).toBe('');
  });
});
