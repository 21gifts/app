import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopsScreen } from '@/components/ShopsScreen';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const forumLoader = vi.hoisted(() => vi.fn());

vi.mock('@/components/ForumLoader', () => ({
  ForumLoader: ({ feed }: { feed: string }) => {
    forumLoader();
    return <div data-testid="forum-loader" data-feed={feed} />;
  },
}));

vi.mock('@/components/PlacesMapScreen', () => ({
  PlacesMapScreen: () => <div data-testid="places-map-screen" />,
}));

vi.mock('@/components/ShopTable', () => ({
  ShopTable: ({ onShowMap }: { onShowMap?: () => void }) => (
    <button type="button" data-testid="shop-table" onClick={onShowMap}>
      place
    </button>
  ),
}));

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', window.location.pathname);
  forumLoader.mockClear();
});

describe('ShopsScreen', () => {
  it('shows the heading, lead, and shops forum feed', () => {
    renderWithLocale(<ShopsScreen />);
    expect(screen.getByRole('heading', { name: 'Shops' })).toBeTruthy();
    expect(
      screen.getByText(
        'Add a shop with photos, a place, text, and an optional 21.gifts user. It appears here and in the forum with a #Shop tag.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Post', pressed: true })).toBeTruthy();
    expect(screen.getByTestId('forum-loader').getAttribute('data-feed')).toBe('shops');
  });

  it('switches to the map and the table', () => {
    renderWithLocale(<ShopsScreen />);
    window.history.replaceState({ idx: 1 }, '', window.location.pathname);
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(screen.getByTestId('places-map-screen')).toBeTruthy();
    expect(window.history.state).toEqual({ idx: 1 });
    expect(screen.queryByTestId('forum-loader')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    expect(screen.getByTestId('shop-table')).toBeTruthy();
    expect(screen.queryByTestId('places-map-screen')).toBeNull();
    expect(window.location.hash).toBe('#table');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(window.location.hash).toBe('');
  });

  it('opens the map from /shops#map and ignores an unknown hash', async () => {
    window.location.hash = '#map';
    renderWithLocale(<ShopsScreen />);
    expect(await screen.findByTestId('places-map-screen')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Map', pressed: true })).toBeTruthy();
    expect(forumLoader).not.toHaveBeenCalled();
    act(() => {
      window.history.replaceState(null, '', `${window.location.pathname}#nope`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(window.location.hash).toBe('#nope');
    expect(screen.getByRole('button', { name: 'Post', pressed: true })).toBeTruthy();
    expect(screen.getByTestId('forum-loader')).toBeTruthy();
  });

  it('opens the table from /shops#table', async () => {
    window.location.hash = '#TABLE';
    renderWithLocale(<ShopsScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Table', pressed: true })).toBeTruthy();
    });
    expect(screen.getByTestId('shop-table')).toBeTruthy();
  });

  it('shows the map when the table opens a place on this page', () => {
    window.location.hash = '#table';
    renderWithLocale(<ShopsScreen />);
    fireEvent.click(screen.getByTestId('shop-table'));
    expect(screen.getByTestId('places-map-screen')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Map', pressed: true })).toBeTruthy();
    expect(window.location.hash).toBe('#map');
  });
});
