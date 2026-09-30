import { cleanup, render, screen, within } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MarketingLayout from '@/app/(marketing)/layout';
import { LocaleProvider } from '@/components/LocaleProvider';
import { getCatalog } from '@/lib/messages';
import { useAuthStore } from '@/stores/auth-store';

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('@/hooks/useHydrateSession', () => ({
  useHydrateSession: (): { ready: boolean } => ({ ready: true }),
}));

vi.mock('@/lib/request-locale', () => ({
  getRequestLocale: vi.fn(async () => 'en' as const),
}));

beforeEach(() => {
  useAuthStore.setState({ session: null, account: null });
});

afterEach(cleanup);

describe('MarketingLayout', () => {
  it('wraps children in a dark full-page shell', async () => {
    const tree = await MarketingLayout({ children: 'content' });
    expect(tree.type).toBe(LocaleProvider);
    const provider = tree.props as {
      locale: 'en';
      messages: ReturnType<typeof getCatalog>;
      children: ReactNode;
    };
    expect(provider.locale).toBe('en');
    expect(provider.messages).toEqual(getCatalog('en'));

    const shell = provider.children as ReactElement<{ className: string; children: ReactNode }>;
    const props = shell.props;

    expect(shell.type).toBe('div');
    expect(props.className).toContain('bg-ink');
    expect(props.className).toContain('[color-scheme:dark]');
  });

  it('puts header, page, and footer in one scrollport', async () => {
    const tree = await MarketingLayout({ children: 'content' });
    expect(tree.type).toBe(LocaleProvider);
    const provider = tree.props as {
      locale: 'en';
      messages: ReturnType<typeof getCatalog>;
      children: ReactNode;
    };
    expect(provider.locale).toBe('en');
    expect(provider.messages).toEqual(getCatalog('en'));

    const shell = provider.children as ReactElement<{
      className: string;
      children: { props: { children: unknown[] } };
    }>;
    const props = shell.props;
    expect(props.className).toContain('h-[var(--app-height)]');
    const inner = props.children.props.children;
    expect(Array.isArray(inner)).toBe(true);
    expect(inner).toHaveLength(3);
    expect(inner[1]).toBe('content');
  });

  it('renders MarketingHeader without an outer LocaleProvider', async () => {
    render(await MarketingLayout({ children: 'content' }));
    const header = within(screen.getByRole('banner'));
    expect(header.getByRole('link', { name: '21.gifts' })).toBeTruthy();
    expect(screen.getByText('content')).toBeTruthy();
  });
});
