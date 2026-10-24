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

vi.mock('@/components/ShopList', () => ({
  ShopList: () => <div data-testid="shop-list" />,
}));

vi.mock('@/components/ShopTable', () => ({
  ShopTable: () => <div data-testid="shop-table" />,
}));

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', window.location.pathname);
  forumLoader.mockClear();
});

describe('ShopsScreen', () => {
  it('shows the heading, lead, and shop list', () => {
    renderWithLocale(<ShopsScreen />);
    expect(screen.getByRole('heading', { name: 'Shops' })).toBeTruthy();
    expect(screen.getByText('Each row is a shop page, not a forum note.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'List', pressed: true })).toBeTruthy();
    expect(screen.getByTestId('shop-list')).toBeTruthy();
    expect(screen.queryByTestId('forum-loader')).toBeNull();
  });

  it('switches to the map, the table, post, and back to the list', () => {
    window.location.hash = '#post';
    window.history.replaceState({ idx: 1 }, '', `${window.location.pathname}#post`);
    renderWithLocale(<ShopsScreen />);
    expect(screen.getByRole('button', { name: 'Post', pressed: true })).toBeTruthy();
    expect(screen.getByTestId('forum-loader').getAttribute('data-feed')).toBe('shops');
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    expect(screen.getByTestId('places-map-screen')).toBeTruthy();
    expect(window.history.state).toEqual({ idx: 1 });
    expect(screen.queryByTestId('shop-list')).toBeNull();
    expect(screen.queryByTestId('forum-loader')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Table' }));
    expect(screen.getByTestId('shop-table')).toBeTruthy();
    expect(screen.queryByTestId('places-map-screen')).toBeNull();
    expect(window.location.hash).toBe('#table');
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));
    expect(window.location.hash).toBe('#post');
    expect(screen.getByTestId('forum-loader').getAttribute('data-feed')).toBe('shops');
    expect(screen.queryByTestId('shop-table')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'List' }));
    expect(window.location.hash).toBe('');
    expect(screen.getByTestId('shop-list')).toBeTruthy();
    expect(screen.queryByTestId('forum-loader')).toBeNull();
    expect(window.history.state).toEqual({ idx: 1 });
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
    expect(screen.getByRole('button', { name: 'List', pressed: true })).toBeTruthy();
    expect(screen.getByTestId('shop-list')).toBeTruthy();
    expect(screen.queryByTestId('forum-loader')).toBeNull();
  });

  it('opens the table from /shops#TABLE', async () => {
    window.location.hash = '#TABLE';
    renderWithLocale(<ShopsScreen />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Table', pressed: true })).toBeTruthy();
    });
    expect(screen.getByTestId('shop-table')).toBeTruthy();
  });
});
