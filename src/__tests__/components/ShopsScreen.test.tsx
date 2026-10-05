import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopsScreen } from '@/components/ShopsScreen';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const forumLoader = vi.hoisted(() => vi.fn());

vi.mock('@/components/ForumLoader', () => ({
  ForumLoader: ({ feed }: { feed: string }) => {
    forumLoader();
    return (
      <div data-testid="forum-loader" data-feed={feed}>
        <a href="/shops?pin=p2#map">feed place</a>
      </div>
    );
  },
}));

/**
 * Click like next/link: the capture listener runs, then the default is
 * prevented and a plain click pushes the href unless it is the current URL.
 */
function clickLink(element: Element, init: MouseEventInit = {}): void {
  element.addEventListener(
    'click',
    (event) => {
      event.preventDefault();
      const anchor = element.closest('a');
      const plain = init.button === undefined && !init.metaKey && !init.ctrlKey;
      if (anchor !== null && plain && !init.shiftKey && !init.altKey) {
        const next = new URL(anchor.href);
        if (next.href !== window.location.href) {
          window.history.pushState(null, '', `${next.pathname}${next.search}${next.hash}`);
        }
      }
    },
    { once: true },
  );
  vi.useFakeTimers();
  fireEvent.click(element, init);
  act(() => {
    vi.runOnlyPendingTimers();
  });
  vi.useRealTimers();
}

/** Browser back or forward to `path`. */
function popTo(path: string): void {
  act(() => {
    window.history.replaceState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
}

vi.mock('@/components/PlacesMapScreen', () => ({
  PlacesMapScreen: () => <div data-testid="places-map-screen" />,
}));

vi.mock('@/components/ShopTable', () => ({
  ShopTable: () => (
    <div data-testid="shop-table">
      <a href="/shops?pin=p1#map">
        <span>place</span>
      </a>
      <a href="/shops#nope">unknown</a>
      <a href="/shops">no hash</a>
      <a href="/elsewhere#map">other path</a>
      <a href="/shops#map">same entry</a>
      <a href="/shops?pin=p1#map" target="_blank">
        new tab
      </a>
      <a href="/shops?pin=p1#map" download>
        download
      </a>
      <a href="https://example.com/shops#map">elsewhere</a>
    </div>
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

  it('shows the map when a post opens a place, and Back returns to the posts', () => {
    window.history.replaceState(null, '', '/shops');
    renderWithLocale(<ShopsScreen />);
    clickLink(screen.getByText('feed place'));
    expect(screen.getByTestId('places-map-screen')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Map', pressed: true })).toBeTruthy();
    expect(`${window.location.pathname}${window.location.search}${window.location.hash}`).toBe(
      '/shops?pin=p2#map',
    );
    popTo('/shops');
    expect(screen.getByRole('button', { name: 'Post', pressed: true })).toBeTruthy();
  });

  it('shows the map when the table opens a place, and ignores other clicks', () => {
    window.history.replaceState(null, '', '/shops#table');
    renderWithLocale(<ShopsScreen />);
    const table = screen.getByTestId('shop-table');
    for (const name of ['other path', 'elsewhere', 'new tab', 'download']) {
      clickLink(screen.getByText(name));
      window.history.replaceState(null, '', '/shops#table');
    }
    clickLink(screen.getByText('place'), { metaKey: true });
    clickLink(screen.getByText('place'), { ctrlKey: true });
    clickLink(screen.getByText('place'), { shiftKey: true });
    clickLink(screen.getByText('place'), { altKey: true });
    clickLink(screen.getByText('place'), { button: 1 });
    fireEvent.click(table);
    const prevented = new MouseEvent('click', { bubbles: true, cancelable: true });
    prevented.preventDefault();
    screen.getByText('place').dispatchEvent(prevented);
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(screen.getByRole('button', { name: 'Table', pressed: true })).toBeTruthy();
    clickLink(screen.getByText('place'));
    expect(screen.getByTestId('places-map-screen')).toBeTruthy();
    expect(window.location.search).toBe('?pin=p1');
    popTo('/shops#table');
    expect(screen.getByRole('button', { name: 'Table', pressed: true })).toBeTruthy();
  });

  it('rewrites this entry for a link that differs only in the hash', () => {
    window.history.replaceState(null, '', '/shops#table');
    renderWithLocale(<ShopsScreen />);
    const before = window.history.length;
    clickLink(screen.getByText('same entry'));
    expect(screen.getByRole('button', { name: 'Map', pressed: true })).toBeTruthy();
    expect(window.location.hash).toBe('#map');
    expect(window.history.length).toBe(before);
  });

  it('shows the posts for a link to this page without a known hash', () => {
    window.history.replaceState(null, '', '/shops?pin=p1#map');
    renderWithLocale(<ShopsScreen />);
    act(() => {
      window.history.replaceState(null, '', '/shops?pin=p1#table');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    clickLink(screen.getByText('no hash'));
    expect(screen.getByRole('button', { name: 'Post', pressed: true })).toBeTruthy();
    expect(`${window.location.pathname}${window.location.search}`).toBe('/shops');
    clickLink(screen.getByRole('button', { name: 'Table' }));
    clickLink(screen.getByText('unknown'));
    expect(screen.getByRole('button', { name: 'Post', pressed: true })).toBeTruthy();
  });
});
