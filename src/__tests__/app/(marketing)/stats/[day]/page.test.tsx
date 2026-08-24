import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import GiftDayPage from '@/app/(marketing)/stats/[day]/page';

const notFound = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});

vi.mock('next/navigation', () => ({
  notFound: () => notFound(),
}));

vi.mock('@/app/(marketing)/stats/[day]/day-loader', () => ({
  DayLoader: ({ day }: { day: string }) => <div>{`loader-${day}`}</div>,
}));

afterEach(() => {
  cleanup();
  notFound.mockClear();
});

describe('GiftDayPage', () => {
  it('renders the heading for a valid day', async () => {
    render(await GiftDayPage({ params: Promise.resolve({ day: '2026-06-01' }) }));
    expect(screen.getByRole('heading', { name: 'Gifts on 2026-06-01' })).toBeTruthy();
    expect(screen.getByText('loader-2026-06-01')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'All stats' }).getAttribute('href')).toBe('/stats');
  });

  it('calls notFound for an invalid day', async () => {
    await expect(GiftDayPage({ params: Promise.resolve({ day: '2026-02-31' }) })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });
});
