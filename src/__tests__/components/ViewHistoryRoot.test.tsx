import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useChromeBack, ViewHistoryRoot } from '@/components/ViewHistoryRoot';
import { previousViewPath, resetViewHistory } from '@/lib/view-history';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const navigation = vi.hoisted(() => ({
  pathname: null as string | null,
  query: '',
}));

vi.mock('next/navigation', () => ({
  usePathname: (): string | null => navigation.pathname,
  useSearchParams: (): { toString: () => string } => ({
    toString: (): string => navigation.query,
  }),
}));

afterEach(() => {
  resetViewHistory();
  navigation.pathname = null;
  navigation.query = '';
  cleanup();
});

describe('ViewHistoryRoot', () => {
  it('records a pathname, then a query path, and skips a missing pathname', () => {
    navigation.pathname = null;
    navigation.query = '';
    const view = renderWithLocale(
      <ViewHistoryRoot>
        <p>child</p>
      </ViewHistoryRoot>,
    );
    expect(screen.getByText('child')).toBeTruthy();
    expect(previousViewPath()).toBeNull();

    navigation.pathname = '';
    view.rerender(
      <ViewHistoryRoot>
        <p>child</p>
      </ViewHistoryRoot>,
    );
    expect(previousViewPath()).toBeNull();

    navigation.pathname = '/shops';
    view.rerender(
      <ViewHistoryRoot>
        <p>child</p>
      </ViewHistoryRoot>,
    );
    expect(previousViewPath()).toBeNull();

    window.history.pushState(null, '', '/shops');
    view.rerender(
      <ViewHistoryRoot>
        <p>child</p>
      </ViewHistoryRoot>,
    );
    expect(window.location.search).toBe('');
    expect(previousViewPath()).toBeNull();

    window.history.pushState(null, '', '/shops?');
    view.rerender(
      <ViewHistoryRoot>
        <p>child</p>
      </ViewHistoryRoot>,
    );
    expect(previousViewPath()).toBeNull();

    navigation.pathname = '/notifications';
    navigation.query = 'c=abc';
    window.history.pushState(null, '', '/notifications?c=abc');
    view.rerender(
      <ViewHistoryRoot>
        <p>child</p>
      </ViewHistoryRoot>,
    );
    expect(previousViewPath()).toBe('/shops');
  });

  it('records the pathname when a query is cleared', () => {
    navigation.pathname = '/shops';
    navigation.query = '';
    window.history.pushState(null, '', '/shops');
    const view = renderWithLocale(
      <ViewHistoryRoot>
        <p>child</p>
      </ViewHistoryRoot>,
    );
    expect(previousViewPath()).toBeNull();

    navigation.pathname = '/messages';
    navigation.query = 'c=thread';
    window.history.pushState(null, '', '/messages?c=thread');
    view.rerender(
      <ViewHistoryRoot>
        <p>child</p>
      </ViewHistoryRoot>,
    );
    expect(previousViewPath()).toBe('/shops');

    navigation.query = '';
    window.history.pushState(null, '', '/messages');
    view.rerender(
      <ViewHistoryRoot>
        <p>child</p>
      </ViewHistoryRoot>,
    );
    expect(previousViewPath()).toBe('/messages?c=thread');
  });

  it('does not record a bare pathname before the location catches a query', () => {
    navigation.pathname = '/shops';
    navigation.query = '';
    window.history.pushState(null, '', '/shops');
    const view = renderWithLocale(
      <ViewHistoryRoot>
        <p>child</p>
      </ViewHistoryRoot>,
    );
    expect(previousViewPath()).toBeNull();

    navigation.pathname = '/messages';
    navigation.query = 'c=thread';
    view.rerender(
      <ViewHistoryRoot>
        <p>child</p>
      </ViewHistoryRoot>,
    );
    expect(previousViewPath()).toBe('/shops');
  });

  it('ignores setOverride when no provider is mounted', () => {
    function Probe(): ReactElement {
      const { override, setOverride } = useChromeBack();
      return (
        <button
          type="button"
          onClick={() => {
            setOverride({ labelKey: 'forum.askBack', onClick: (): void => undefined });
          }}
        >
          {override === null ? 'none' : 'set'}
        </button>
      );
    }

    renderWithLocale(<Probe />);
    expect(screen.getByRole('button', { name: 'none' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'none' }));
    expect(screen.getByRole('button', { name: 'none' })).toBeTruthy();
  });
});
