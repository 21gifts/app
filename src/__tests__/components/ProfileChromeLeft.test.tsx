import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
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
});
