import { afterEach, it, expect, vi } from 'vitest';
import SundayRestPage from '@/app/sunday-rest/page';
vi.mock('next/navigation', () => ({
  redirect: () => {
    throw new Error('redirect');
  },
}));
afterEach(() => vi.useRealTimers());
it('renders no underlying application on Sunday', () => {
  vi.useFakeTimers().setSystemTime(new Date('2026-09-27T00:00:00Z'));
  expect(SundayRestPage()).toBeNull();
});
it('redirects a direct visit home on Monday', () => {
  vi.useFakeTimers().setSystemTime(new Date('2026-09-27T16:00:00Z'));
  expect(() => SundayRestPage()).toThrow('redirect');
});
