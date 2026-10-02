import { cleanup, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import HabitTrackerPage from '@/app/habit-tracker/page';
import { GET, POST } from '@/app/habits/data/route';
import { proxyApiRequest } from '@/lib/api-proxy';
vi.mock('@/lib/api-proxy', () => ({ proxyApiRequest: vi.fn(async () => new Response('{}')) }));
vi.mock('@/components/RulesPageChrome', () => ({
  RulesPageChrome: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}));
vi.mock('@/components/HabitTracker', () => ({ HabitTracker: () => <h1>Habit-Tracker</h1> }));
afterEach(cleanup);
it('mounts the public tracker inside its chrome', () => {
  renderWithLocale(<HabitTrackerPage />);
  expect(screen.getByRole('heading').textContent).toBe('Habit-Tracker');
});
it('forwards read and mutation requests to the correct API route', async () => {
  const read = new Request('https://21.gifts/habits/data?week=2026-09-28');
  await GET(read);
  expect(proxyApiRequest).toHaveBeenLastCalledWith(read, '/habit-tracker');
  const write = new Request('https://21.gifts/habits/data', { method: 'POST', body: '{}' });
  await POST(write);
  expect(proxyApiRequest).toHaveBeenLastCalledWith(write, '/habit-tracker');
});
