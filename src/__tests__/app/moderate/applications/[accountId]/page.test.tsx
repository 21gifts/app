import { describe, expect, it, vi } from 'vitest';
import FundingApplicationDetailPage from '@/app/moderate/applications/[accountId]/page';

const { redirect } = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock('next/navigation', () => ({
  redirect: (path: string): void => {
    redirect(path);
  },
}));

describe('FundingApplicationDetailPage redirect', () => {
  it('sends the account to the grants review', async () => {
    await FundingApplicationDetailPage({
      params: Promise.resolve({ accountId: 'acc_rose' }),
    });
    expect(redirect).toHaveBeenCalledWith('/grants/applications/acc_rose');
  });
});
