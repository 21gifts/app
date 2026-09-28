import { cleanup, fireEvent, screen } from '@testing-library/react';
import { useLayoutEffect, type ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
import { ChromeBackProvider, useChromeBack } from '@/components/ViewHistoryRoot';
import { recordCurrentView, resetViewHistory } from '@/lib/view-history';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  resetViewHistory();
  vi.unstubAllGlobals();
  cleanup();
});

describe('ProfileChromeLeft', () => {
  it('renders the forum back link and wordmark to /welcome', () => {
    renderWithLocale(<ProfileChromeLeft />);
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
    expect(screen.queryByText('Back to the forum')).toBeNull();
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
    fireEvent.click(screen.getByRole('link', { name: 'Back to the forum' }));
    expect(assign).toHaveBeenCalledWith('/welcome');
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

  it('runs onBackClick for a plain click and still follows the href otherwise', () => {
    const onBackClick = vi.fn();
    renderWithLocale(<ProfileChromeLeft onBackClick={onBackClick} />);
    const back = screen.getByRole('link', { name: 'Back to the forum' });
    fireEvent.click(back);
    expect(onBackClick).toHaveBeenCalledTimes(1);
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

  it('omits the arrow when hideWithoutHistory has no earlier view', () => {
    renderWithLocale(<ProfileChromeLeft hideWithoutHistory />);
    expect(screen.queryByRole('link', { name: 'Back to the forum' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Back' })).toBeNull();
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
  });

  it('shows the previous view when hideWithoutHistory still has history', () => {
    recordCurrentView('/shops');
    Object.defineProperty(window.history, 'length', {
      configurable: true,
      value: window.history.length + 1,
    });
    recordCurrentView('/welcome');
    renderWithLocale(<ProfileChromeLeft hideWithoutHistory />);
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/shops');
    expect(screen.queryByRole('link', { name: 'Back to the forum' })).toBeNull();
  });

  it('keeps the ask-wizard button when hideWithoutHistory has no earlier view', () => {
    const onClick = vi.fn();
    function Arm(): ReactElement {
      const { setOverride } = useChromeBack();
      useLayoutEffect(() => {
        setOverride({ labelKey: 'forum.askBack', onClick });
      }, [setOverride]);
      return <ProfileChromeLeft hideWithoutHistory />;
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
