import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemberProfileScreen } from '@/components/MemberProfileScreen';
import type { MemberProfile } from '@/lib/api-types';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/navigation', () => ({
  useRouter: (): { push: () => void; replace: () => void } => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

const profile: MemberProfile = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Carol',
  role: 'verified',
  lightningAddress: 'carol@walletofsatoshi.com',
  createdAt: '2026-01-15T12:00:00.000Z',
  profileMessage: null,
};

afterEach(cleanup);

describe('MemberProfileScreen', () => {
  it('shows name, address, chart empty state, and role pill', () => {
    renderWithLocale(<MemberProfileScreen profile={profile} received={[]} />);
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
    expect(screen.getByText('Carol')).toBeTruthy();
    expect(screen.getByText('carol@walletofsatoshi.com')).toBeTruthy();
    expect(screen.getByText('No gifts yet.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Verified' })).toBeTruthy();
  });

  it('toggles the role hint', () => {
    renderWithLocale(<MemberProfileScreen profile={profile} received={[]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Verified' }));
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('renders a profile note when present', () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{
          ...profile,
          profileMessage: {
            id: '33333333-3333-4333-8333-333333333333',
            accountId: profile.id,
            name: 'Carol',
            text: 'Hello from my profile note.',
            createdAt: '2026-08-01T10:00:00.000Z',
            sats: 21,
            payable: true,
            hasPhoto: false,
            hasVideo: false,
            videoContentType: null,
            role: 'verified',
            replyCount: 0,
          },
        }}
        received={[]}
      />,
    );
    expect(screen.getByText('Hello from my profile note.')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Your message' })).toBeNull();
  });

  it('shows unnamed and no-address copy when fields are null', () => {
    renderWithLocale(
      <MemberProfileScreen
        profile={{ ...profile, name: null, lightningAddress: null, role: 'basis' }}
        received={[]}
      />,
    );
    expect(screen.getByText('Unnamed')).toBeTruthy();
    expect(screen.getByText('No Wallet of Satoshi address')).toBeTruthy();
  });
});
