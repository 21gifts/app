import { describe, expect, it, vi } from 'vitest';
import FundingApplyPage from '@/app/profile/apply/page';

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock('next/navigation', () => ({
  redirect: (path: string): void => {
    redirect(path);
  },
}));

describe('FundingApplyPage redirect', () => {
  it('sends /profile/apply to /grants/apply', () => {
    FundingApplyPage();
    expect(redirect).toHaveBeenCalledWith('/grants/apply');
  });
});
