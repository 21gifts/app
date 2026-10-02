import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HabitTrackerPage from '@/app/habit-tracker/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/navigation', () => ({
  useRouter: (): { replace: () => void; refresh: () => void } => ({
    replace: () => undefined,
    refresh: () => undefined,
  }),
  usePathname: (): string => '/habit-tracker',
  useSearchParams: (): URLSearchParams => new URLSearchParams(),
}));

const tracker = {
  week: { start: '2026-09-28', label: '2026-W40', nextAt: Date.now() + 600000 },
  currentWeek: '2026-09-28',
  firstWeek: '2026-09-21',
  habits: [
    {
      id: 'f1',
      accountId: 'f',
      role: 'founder',
      name: 'Founder',
      text: 'Read daily',
      firstWeek: '2026-09-21',
      lastWeek: null,
    },
  ],
  results: [],
  comments: [],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('HabitTrackerPage', () => {
  it('renders the public tracker inside the page chrome', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(tracker), { status: 200 })),
    );
    renderWithLocale(<HabitTrackerPage />);
    expect(await screen.findByRole('heading', { name: 'Habit-Tracker', level: 1 })).toBeTruthy();
    expect(await screen.findByText('Read daily')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in to comment' }).getAttribute('href')).toBe(
      '/login',
    );
  });
});
