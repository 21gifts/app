import { cleanup, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RulesPageChrome } from '@/components/RulesPageChrome';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const replace = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { replace: typeof replace; refresh: typeof refresh } => ({
    replace,
    refresh,
  }),
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

let hydrateReady = true;

vi.mock('@/hooks/useHydrateSession', () => ({
  useHydrateSession: (): { ready: boolean } => ({ ready: hydrateReady }),
}));

vi.mock('@/components/SignedInChrome', () => ({
  SignedInChrome: () => <button type="button">Menu</button>,
}));

beforeEach(() => {
  hydrateReady = true;
  useAuthStore.setState({ session: null, account: null });
});

afterEach(() => {
  cleanup();
});

describe('RulesPageChrome', () => {
  it('renders unsigned chrome when there is no session', () => {
    renderWithLocale(
      <RulesPageChrome>
        <div>rules body</div>
      </RulesPageChrome>,
    );
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/');
    expect(screen.queryByRole('link', { name: 'Back to the forum' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
    expect(screen.getByText('rules body')).toBeTruthy();
  });

  it('renders signed-in chrome when a session is hydrated', () => {
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_1',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        setup: null,
        missing: [],
      },
    });
    renderWithLocale(
      <RulesPageChrome>
        <div>rules body</div>
      </RulesPageChrome>,
    );
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
    expect(screen.getByRole('button', { name: 'Menu' })).toBeTruthy();
  });

  it('keeps unsigned chrome while hydration is not ready', () => {
    hydrateReady = false;
    useAuthStore.setState({
      session: 'tok',
      account: {
        id: 'acc_1',
        linkingKey: null,
        role: 'basis',
        name: 'Ada',
        lightningAddress: 'alice@walletofsatoshi.com',
        lightningAddressVerified: false,
        forumLawsDismissed: false,
        createdAt: 1,
        rulesAgreedAt: 1_700_000_001,
        viewKey: 'a'.repeat(64),
        setup: null,
        missing: [],
      },
    });
    renderWithLocale(
      <RulesPageChrome>
        <div>rules body</div>
      </RulesPageChrome>,
    );
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/');
    expect(screen.queryByRole('link', { name: 'Back to the forum' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Menu' })).toBeNull();
  });
});
