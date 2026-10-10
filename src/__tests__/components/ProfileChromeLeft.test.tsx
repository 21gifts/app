import { cleanup, fireEvent, screen } from '@testing-library/react';
import { useLayoutEffect, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { ChromeBackProvider, useChromeBack } from '@/components/ViewHistoryRoot';
import { clearSessionPhrase, peekSessionPhrase, rememberSessionPhrase } from '@/lib/tab-phrase';
import { previousViewPath, recordCurrentView, resetViewHistory } from '@/lib/view-history';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const routerPush = vi.hoisted(() => vi.fn());

// Like next/link: after the caller's onClick, an unprevented plain click is a
// client-side router push, not a document load.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
    [key: string]: unknown;
  }) => (
    <a
      href={href}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          event.preventDefault();
          routerPush(href);
        }
      }}
    >
      {children}
    </a>
  ),
}));

const BACK_KEY = '21gifts.viewHistoryBack';

afterEach(() => {
  routerPush.mockReset();
  clearSessionPhrase();
  sessionStorage.removeItem(BACK_KEY);
  resetViewHistory();
  vi.unstubAllGlobals();
  cleanup();
});

describe('ProfileChromeLeft', () => {
  it('renders the forum back link and wordmark to /welcome', () => {
    renderWithLocale(<ProfileChromeLeft />);
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
    expect(screen.queryByText('Back to the forum')).toBeNull();
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
    fireEvent.click(screen.getByRole('link', { name: 'Back to the forum' }));
    expect(routerPush).toHaveBeenCalledWith('/welcome');
    expect(sessionStorage.getItem(BACK_KEY)).toBe('/welcome');
  });

  it('steps back in the browser history when this document pushed the view, and keeps the wallet unlocked', () => {
    rememberSessionPhrase('abandon ability able');
    recordCurrentView('/wallet');
    recordCurrentView('/shops');
    const stepBack = vi.fn();
    const assign = vi.fn();
    const replace = vi.fn();
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign, replace, reload });
    renderWithLocale(
      <ChromeBackProvider stepBack={stepBack}>
        <ProfileChromeLeft />
      </ChromeBackProvider>,
    );
    const back = screen.getByRole('link', { name: 'Back' });
    expect(back.getAttribute('href')).toBe('/wallet');
    fireEvent.click(back);
    expect(stepBack).toHaveBeenCalledTimes(1);
    expect(routerPush).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(peekSessionPhrase()).toBe('abandon ability able');
  });

  it('leaves through the link after a document load and keeps the wallet unlocked', () => {
    rememberSessionPhrase('abandon ability able');
    recordCurrentView('/wallet');
    Object.defineProperty(window.history, 'length', {
      configurable: true,
      value: window.history.length + 1,
    });
    recordCurrentView('/shops');
    // A document load: the entry below this one is not known.
    delete (globalThis as { __giftsViewHistory?: unknown }).__giftsViewHistory;
    delete (globalThis as { __giftsViewDocument?: unknown }).__giftsViewDocument;
    recordCurrentView('/shops');
    const assign = vi.fn();
    const replace = vi.fn();
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign, replace, reload });
    renderWithLocale(<ProfileChromeLeft />);
    const back = screen.getByRole('link', { name: 'Back' });
    expect(back.getAttribute('href')).toBe('/wallet');
    fireEvent.click(back);
    expect(routerPush).toHaveBeenCalledWith('/wallet');
    expect(assign).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
    expect(peekSessionPhrase()).toBe('abandon ability able');
    recordCurrentView('/wallet');
    expect(previousViewPath()).toBeNull();
    expect(peekSessionPhrase()).toBe('abandon ability able');
  });

  it('ignores the second click of a double click, so the arrow steps back once', () => {
    recordCurrentView('/wallet');
    recordCurrentView('/shops');
    const stepBack = vi.fn();
    renderWithLocale(
      <ChromeBackProvider stepBack={stepBack}>
        <ProfileChromeLeft />
      </ChromeBackProvider>,
    );
    const back = screen.getByRole('link', { name: 'Back' });
    fireEvent.click(back, { detail: 1 });
    fireEvent.click(back, { detail: 2 });
    expect(stepBack).toHaveBeenCalledTimes(1);
    expect(routerPush).not.toHaveBeenCalled();
  });

  it('follows the link when no root provides a back step', () => {
    recordCurrentView('/wallet');
    recordCurrentView('/shops');
    renderWithLocale(<ProfileChromeLeft />);
    fireEvent.click(screen.getByRole('link', { name: 'Back' }));
    expect(routerPush).toHaveBeenCalledWith('/wallet');
  });

  it('points the back link at the previous in-app view', () => {
    recordCurrentView('/shops');
    Object.defineProperty(window.history, 'length', {
      configurable: true,
      value: window.history.length + 1,
    });
    recordCurrentView('/notifications');
    renderWithLocale(<ProfileChromeLeft />);
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/shops');
    expect(screen.queryByText('Back')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Back to the forum' })).toBeNull();
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
  });

  it('points the wordmark at / when wordmarkHref is /', () => {
    renderWithLocale(<ProfileChromeLeft wordmarkHref="/" />);
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
  });

  it('stays on the view when onBackClick took an in-page step', () => {
    const onBackClick = vi.fn(() => true);
    renderWithLocale(<ProfileChromeLeft onBackClick={onBackClick} />);
    fireEvent.click(screen.getByRole('link', { name: 'Back to the forum' }));
    expect(onBackClick).toHaveBeenCalledTimes(1);
    expect(routerPush).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(BACK_KEY)).toBeNull();
  });

  it('runs onBackClick for a plain click and still follows the href otherwise', () => {
    const onBackClick = vi.fn(() => false);
    renderWithLocale(<ProfileChromeLeft onBackClick={onBackClick} />);
    const back = screen.getByRole('link', { name: 'Back to the forum' });
    fireEvent.click(back);
    expect(onBackClick).toHaveBeenCalledTimes(1);
    expect(routerPush).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(BACK_KEY)).toBe('/welcome');
    fireEvent.click(back, { metaKey: true });
    fireEvent.click(back, { ctrlKey: true });
    fireEvent.click(back, { shiftKey: true });
    fireEvent.click(back, { altKey: true });
    fireEvent.click(back, { button: 1 });
    expect(onBackClick).toHaveBeenCalledTimes(1);
  });

  it('renders a custom wordmark and ignores wordmarkHref', () => {
    renderWithLocale(
      <ProfileChromeLeft wordmarkHref="/" wordmark={<span>Custom mark</span>} tone="dark" />,
    );
    const back = screen.getByRole('link', { name: 'Back to the forum' });
    expect(back.className).toContain('text-paper/70');
    expect(screen.getByText('Custom mark')).toBeTruthy();
    expect(screen.queryByRole('link', { name: '21.gifts' })).toBeNull();
  });

  it('paints the default wordmark in the dark tone', () => {
    renderWithLocale(<ProfileChromeLeft tone="dark" wordmarkHref="/" />);
    const mark = screen.getByRole('link', { name: '21.gifts' });
    expect(mark.className).toContain('text-paper');
    expect(mark.getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: 'Back to the forum' }).className).toContain(
      'text-paper/70',
    );
  });

  it('omits the arrow when hideHistoryArrow has no earlier view', () => {
    renderWithLocale(<ProfileChromeLeft hideHistoryArrow />);
    expect(screen.queryByRole('link', { name: 'Back to the forum' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Back' })).toBeNull();
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
  });

  it('omits the arrow when hideHistoryArrow has an earlier view', () => {
    recordCurrentView('/shops');
    Object.defineProperty(window.history, 'length', {
      configurable: true,
      value: window.history.length + 1,
    });
    recordCurrentView('/welcome');
    expect(previousViewPath()).toBe('/shops');
    renderWithLocale(<ProfileChromeLeft hideHistoryArrow />);
    expect(screen.queryByRole('link', { name: 'Back' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Back to the forum' })).toBeNull();
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
  });

  it('keeps the ask-wizard button when hideHistoryArrow is set', () => {
    const onClick = vi.fn();
    function Arm(): ReactElement {
      const { setOverride } = useChromeBack();
      useLayoutEffect(() => {
        setOverride({ labelKey: 'forum.askBack', onClick });
      }, [setOverride]);
      return <ProfileChromeLeft hideHistoryArrow />;
    }

    renderWithLocale(
      <ChromeBackProvider>
        <Arm />
      </ChromeBackProvider>,
    );
    expect(screen.queryByRole('link', { name: 'Back to the forum' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disables the ask-wizard back button while a post is in flight', () => {
    function Arm(): ReactElement {
      const { setOverride } = useChromeBack();
      useLayoutEffect(() => {
        setOverride({
          labelKey: 'forum.askBack',
          onClick: (): void => undefined,
          disabled: true,
        });
      }, [setOverride]);
      return <ProfileChromeLeft />;
    }

    renderWithLocale(
      <ChromeBackProvider>
        <Arm />
      </ChromeBackProvider>,
    );
    expect(screen.getByRole('button', { name: 'Back' }).hasAttribute('disabled')).toBe(true);
  });
});
