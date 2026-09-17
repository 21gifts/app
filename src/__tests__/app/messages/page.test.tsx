import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MessagesPage from '@/app/messages/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const searchParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: (): URLSearchParams => searchParams,
}));

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

vi.mock('@/components/InboxLoader', () => ({
  InboxLoader: () => <div data-testid="inbox-loader" />,
}));

vi.mock('@/components/OnboardingGate', () => ({
  OnboardingGate: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <div data-testid="signed-in-chrome" />,
}));

beforeEach(() => {
  searchParams.delete('c');
});

afterEach(() => {
  searchParams.delete('c');
  cleanup();
});

describe('MessagesPage', () => {
  it('renders the inbox loader inside signed-in chrome', () => {
    renderWithLocale(<MessagesPage />);
    expect(screen.getByTestId('inbox-loader')).toBeTruthy();
    expect(screen.getByTestId('signed-in-chrome')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
  });

  it('renders All conversations chrome back when a thread is open', () => {
    searchParams.set('c', 'conv-1');
    renderWithLocale(<MessagesPage />);
    expect(screen.getByRole('link', { name: 'All conversations' }).getAttribute('href')).toBe(
      '/messages',
    );
    expect(screen.getAllByRole('link', { name: 'All conversations' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
    expect(screen.queryByRole('link', { name: 'Back to the forum' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'All conversations' })).toBeNull();
  });
});
