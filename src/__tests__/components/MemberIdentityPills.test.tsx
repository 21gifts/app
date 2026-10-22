import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemberIdentityPills } from '@/components/MemberIdentityPills';
import type { MemberProfile } from '@/lib/api-types';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const profile: MemberProfile = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Carol',
  username: 'carol',
  location: null,
  role: 'verified',
  lightningAddress: 'carol@21.gifts',
  createdAt: '2026-01-15T12:00:00.000Z',
  aboutMe: null,
  aboutMeHasPhoto: false,
  profileMessage: null,
  postCount: 0,
  replyCount: 0,
  trust: {
    verifiedBy: null,
    proposedBy: null,
    confirmedBy: null,
    appointedBy: null,
  },
};

function renderPills(next: MemberProfile | null): void {
  renderWithLocale(
    <MemberIdentityPills profile={next}>
      {(marks, hints) => (
        <div>
          <span>Carol</span>
          {marks}
          {hints}
        </div>
      )}
    </MemberIdentityPills>,
  );
}

afterEach(() => {
  cleanup();
});

describe('MemberIdentityPills', () => {
  it('renders no marks while the profile is still loading', () => {
    renderPills(null);
    expect(screen.getByText('Carol')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Verified' })).toBeNull();
  });

  it('renders no marks for a basis member', () => {
    renderPills({ ...profile, role: 'basis' });
    expect(screen.queryByRole('button', { name: 'Verified' })).toBeNull();
    expect(screen.queryByText('Software Developer')).toBeNull();
  });

  it('reveals the role sentence', () => {
    renderPills(profile);
    fireEvent.click(screen.getByRole('button', { name: 'Verified' }));
    expect(screen.getByRole('status').textContent).toMatch(/confirmed they are real/i);
  });

  it('hides the verified pill when the software developer label is shown', () => {
    renderPills({ ...profile, staffTag: 'software_developer' });
    expect(screen.getByText('Software Developer')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Verified' })).toBeNull();
  });

  it('reveals who admitted the member', () => {
    renderPills({
      ...profile,
      role: 'basis',
      fundingReviewedAt: Date.UTC(2026, 0, 2),
      fundingReviewedByName: 'Ada',
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Takes part in the 21.gifts funding program/ }),
    );
    expect(screen.getByRole('status').textContent).toMatch(/Ada/);
  });

  it('reveals the admission date when the reviewer is unnamed', () => {
    renderPills({
      ...profile,
      role: 'basis',
      fundingReviewedAt: Date.UTC(2026, 0, 2),
      fundingReviewedByName: ' ',
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Takes part in the 21.gifts funding program/ }),
    );
    expect(screen.getByRole('status').textContent).toMatch(/since/i);
    expect(screen.getByRole('status').textContent).not.toMatch(/Ada/);
  });
});
