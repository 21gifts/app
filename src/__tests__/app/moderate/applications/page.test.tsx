import { describe, expect, it, vi } from 'vitest';
import FundingApplicationsPage from '@/app/moderate/applications/page';

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock('next/navigation', () => ({
  redirect: (path: string): void => {
    redirect(path);
  },
}));

describe('FundingApplicationsPage redirect', () => {
  it('sends /moderate/applications to /grants/applications', () => {
    FundingApplicationsPage();
    expect(redirect).toHaveBeenCalledWith('/grants/applications');
  });
});
