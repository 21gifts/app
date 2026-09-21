import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopsScreen } from '@/components/ShopsScreen';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/ForumLoader', () => ({
  ForumLoader: ({ feed }: { feed: string }) => <div data-testid="forum-loader" data-feed={feed} />,
}));

afterEach(cleanup);

describe('ShopsScreen', () => {
  it('shows the heading, lead, and shops forum feed', () => {
    renderWithLocale(<ShopsScreen />);
    expect(screen.getByRole('heading', { name: 'Shops' })).toBeTruthy();
    expect(
      screen.getByText(
        'Add a shop the same way you write a living-room post. It appears here and in the forum with a #Shop tag.',
      ),
    ).toBeTruthy();
    expect(screen.getByTestId('forum-loader').getAttribute('data-feed')).toBe('shops');
  });
});
