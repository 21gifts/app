import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StatsPage, { metadata } from '@/app/(marketing)/stats/page';

vi.mock('@/app/(marketing)/stats/stats-loader', () => ({
  StatsLoader: () => <div>stats-loader</div>,
}));

afterEach(cleanup);

describe('StatsPage', () => {
  it('publishes the English stats preview', () => {
    expect(metadata).toMatchObject({
      title: 'Bitcoin donations over time | 21.gifts',
      description: 'See how much Bitcoin people have donated through 21.gifts over time.',
      alternates: { canonical: '/stats' },
      openGraph: { images: [{ url: '/og.png' }] },
    });
  });

  it('renders the page heading and the stats loader', () => {
    render(<StatsPage />);
    const heading = screen.getByRole('heading', { name: 'Donations' });
    expect(heading.className).toContain('leading-tight');
    expect(heading.className).toContain('sm:text-6xl');
    expect(screen.getByText('stats-loader')).toBeTruthy();
  });
});
