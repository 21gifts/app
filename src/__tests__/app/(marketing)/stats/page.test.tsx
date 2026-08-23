import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StatsPage from '@/app/(marketing)/stats/page';

vi.mock('@/app/(marketing)/stats/stats-loader', () => ({
  StatsLoader: () => <div>stats-loader</div>,
}));

afterEach(cleanup);

describe('StatsPage', () => {
  it('renders the page heading and the stats loader', () => {
    render(<StatsPage />);
    expect(screen.getByRole('heading', { name: 'Gifts' })).toBeTruthy();
    expect(screen.getByText('stats-loader')).toBeTruthy();
  });
});
