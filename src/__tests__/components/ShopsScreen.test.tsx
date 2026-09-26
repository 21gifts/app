import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopsScreen } from '@/components/ShopsScreen';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/components/ForumLoader', () => ({
  ForumLoader: ({ feed }: { feed: string }) => <div data-testid="forum-loader" data-feed={feed} />,
}));

vi.mock('@/components/PlacesMapScreen', () => ({
  PlacesMapScreen: () => <div data-testid="places-map-screen" />,
}));

vi.mock('@/components/ShopTable', () => ({
  ShopTable: () => <div data-testid="shop-table" />,
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
    expect(screen.getByRole('tab', { name: 'Post', selected: true })).toBeTruthy();
    expect(screen.getByTestId('forum-loader').getAttribute('data-feed')).toBe('shops');
  });

  it('switches to the map and the table', () => {
    renderWithLocale(<ShopsScreen />);
    fireEvent.click(screen.getByRole('tab', { name: 'Map' }));
    expect(screen.getByTestId('places-map-screen')).toBeTruthy();
    expect(screen.queryByTestId('forum-loader')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Table' }));
    expect(screen.getByTestId('shop-table')).toBeTruthy();
    expect(screen.queryByTestId('places-map-screen')).toBeNull();
  });
});
