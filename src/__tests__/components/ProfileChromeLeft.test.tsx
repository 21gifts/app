import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProfileChromeLeft } from '@/components/ProfileChromeLeft';
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
  });
});
