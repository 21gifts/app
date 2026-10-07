import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChromeBackProvider, useChromeBack, ViewHistoryRoot } from '@/components/ViewHistoryRoot';
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
    expect(previousViewPath()).toBeNull();

    window.history.pushState(null, '', '/messages?c=thread');
    view.rerender(
      <ViewHistoryRoot>
        <p>child</p>
      </ViewHistoryRoot>,
    );
    expect(previousViewPath()).toBe('/shops');
  });

  it('records one path when the location keeps an encoded space', () => {
    navigation.pathname = '/about';
    navigation.query = 'ref=a+b';
    window.history.pushState(null, '', '/about?ref=a%20b');
    renderWithLocale(
      <ViewHistoryRoot>
        <p>child</p>
      </ViewHistoryRoot>,
    );
    expect(previousViewPath()).toBeNull();
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

  it('keeps a slot per caller; clear and unmount restore the previous override', () => {
    function Caller({
      name,
      labelKey,
    }: {
      name: string;
      labelKey: 'forum.askBack' | 'shops.back';
    }): ReactElement {
      const { override, setOverride } = useChromeBack();
      const visible = override === null ? 'none' : override.labelKey;
      return (
        <div>
          <p>{`${name}:${visible}`}</p>
          <button
            type="button"
            onClick={() => {
              setOverride({ labelKey, onClick: (): void => undefined });
            }}
          >
            {`${name} set`}
          </button>
          <button
            type="button"
            onClick={() => {
              setOverride(null);
            }}
          >
            {`${name} clear`}
          </button>
        </div>
      );
    }

    function Probe({ showSecond }: { showSecond: boolean }): ReactElement {
      return (
        <ChromeBackProvider>
          <Caller name="first" labelKey="forum.askBack" />
          {showSecond ? <Caller name="second" labelKey="shops.back" /> : null}
        </ChromeBackProvider>
      );
    }

    const view = renderWithLocale(<Probe showSecond />);
    expect(screen.getByText('first:none')).toBeTruthy();
    expect(screen.getByText('second:none')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'first clear' }));
    expect(screen.getByText('first:none')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'first set' }));
    expect(screen.getByText('first:forum.askBack')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'first set' }));
    expect(screen.getByText('first:forum.askBack')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'second set' }));
    expect(screen.getByText('first:shops.back')).toBeTruthy();
    expect(screen.getByText('second:shops.back')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'first set' }));
    expect(screen.getByText('first:forum.askBack')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'second set' }));
    expect(screen.getByText('second:shops.back')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'second clear' }));
    expect(screen.getByText('first:forum.askBack')).toBeTruthy();
    expect(screen.getByText('second:forum.askBack')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'second set' }));
    expect(screen.getByText('second:shops.back')).toBeTruthy();
    view.rerender(<Probe showSecond={false} />);
    expect(screen.getByText('first:forum.askBack')).toBeTruthy();
    expect(screen.queryByText('second:shops.back')).toBeNull();
  });

  it('keeps a view laid over the page on top while a page step registers again', () => {
    function Caller({
      name,
      labelKey,
      over,
    }: {
      name: string;
      labelKey: 'forum.askBack' | 'nav.back';
      over?: boolean;
    }): ReactElement {
      const { override, setOverride } = useChromeBack();
      return (
        <div>
          <p>{`${name}:${override === null ? 'none' : override.labelKey}`}</p>
          <button
            type="button"
            onClick={() => {
              setOverride({ labelKey, onClick: (): void => undefined, over: over === true });
            }}
          >
            {`${name} set`}
          </button>
        </div>
      );
    }
    renderWithLocale(
      <ChromeBackProvider>
        <Caller name="page" labelKey="forum.askBack" />
        <Caller name="view" labelKey="nav.back" over />
      </ChromeBackProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'page set' }));
    fireEvent.click(screen.getByRole('button', { name: 'view set' }));
    expect(screen.getByText('page:nav.back')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'page set' }));
    expect(screen.getByText('page:nav.back')).toBeTruthy();
  });
});
