import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home, { metadata as homeMetadata } from '@/app/(marketing)/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const headerGet = vi.fn<(name: string) => string | null>();

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => ({ get: headerGet })),
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/request-locale', () => ({
  getRequestLocale: vi.fn(async () => 'en' as const),
}));

vi.mock('@/lib/push', () => ({
  isIosSafari: vi.fn().mockReturnValue(false),
  isStandaloneDisplay: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/in-app-browser', () => ({
  isInAppBrowser: vi.fn().mockReturnValue(false),
}));

/**
 * Answers `headers().get` from a plain map; absent names read as `null`.
 *
 * @param values - Request headers by lowercase name.
 */
function setRequestHeaders(values: Record<string, string>): void {
  headerGet.mockImplementation((name) => values[name] ?? null);
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_PLATFORM_USERNAME', '21gifts');
  setRequestHeaders({ host: '21.gifts' });
});

afterEach(() => {
  cleanup();
  headerGet.mockReset();
  vi.unstubAllEnvs();
});

describe('Home', () => {
  it('renders the product headline', async () => {
    renderWithLocale(await Home());
    expect(screen.getByRole('heading', { name: /Direct human-to-human gifts/i })).toBeTruthy();
  });

  it('states what the product is', async () => {
    renderWithLocale(await Home());
    const lead = screen.getByText(/Ask for help or send help, with no organization in the middle/i);
    expect(lead).toBeTruthy();
    expect(lead.textContent).toContain('21.gifts');
  });

  it('exports a homepage canonical of /', () => {
    expect(homeMetadata.alternates?.canonical).toBe('/');
  });

  it('does not say the product is coming soon', async () => {
    renderWithLocale(await Home());
    expect(screen.queryByText('Coming soon')).toBeNull();
  });

  it('does not use Lightning or LNURL jargon', async () => {
    renderWithLocale(await Home());
    expect(document.body.textContent).not.toMatch(/Lightning/i);
    expect(document.body.textContent).not.toMatch(/LNURL/i);
  });

  it('does not use passkey jargon', async () => {
    renderWithLocale(await Home());
    expect(document.body.textContent).not.toMatch(/passkey/i);
  });

  it('links Ask for help to login', async () => {
    renderWithLocale(await Home());
    const link = screen.getByRole('link', { name: 'Ask for help' });
    expect(link.getAttribute('href')).toBe('/login');
  });

  it('links Send help to donate', async () => {
    renderWithLocale(await Home());
    const link = screen.getByRole('link', { name: 'Send help' });
    expect(link.getAttribute('href')).toBe('/donate');
  });

  it('renders a donate-to-project heading', async () => {
    renderWithLocale(await Home());
    expect(screen.getByRole('heading', { name: 'Donate to this project' })).toBeTruthy();
  });

  it('shows the in-app wallet address as the step 2 example', async () => {
    renderWithLocale(await Home());
    expect(screen.getByText('you@21.gifts').tagName).toBe('CODE');
  });

  it('exposes the project address on the request host as a lightning link', async () => {
    renderWithLocale(await Home());
    const link = screen.getByRole('link', { name: '21gifts@21.gifts' });
    expect(link.getAttribute('href')).toBe('lightning:21gifts@21.gifts');
    expect(link.className).toContain('text-accent');
    expect(link.className).toContain('underline-offset-2');
    const code = link.querySelector('code');
    expect(code?.textContent).toBe('21gifts@21.gifts');
    expect(code?.className).toContain('font-mono');
    expect(document.getElementById('project')).not.toBeNull();
  });

  it('prefers the first forwarded host without its port', async () => {
    setRequestHeaders({
      'x-forwarded-host': 'dev.21.gifts:8443, proxy.internal',
      host: 'localhost:3000',
    });
    renderWithLocale(await Home());
    const link = screen.getByRole('link', { name: '21gifts@dev.21.gifts' });
    expect(link.getAttribute('href')).toBe('lightning:21gifts@dev.21.gifts');
  });

  it('strips the port from the host header', async () => {
    setRequestHeaders({ host: 'dev.21.gifts:3000' });
    renderWithLocale(await Home());
    expect(screen.getByRole('link', { name: '21gifts@dev.21.gifts' })).toBeTruthy();
  });

  it('falls back to 21.gifts when the request names no host', async () => {
    setRequestHeaders({});
    renderWithLocale(await Home());
    const link = screen.getByRole('link', { name: '21gifts@21.gifts' });
    expect(link.getAttribute('href')).toBe('lightning:21gifts@21.gifts');
  });

  it('ignores a forged forwarded host and uses 21.gifts', async () => {
    setRequestHeaders({ 'x-forwarded-host': 'evil.com', host: 'dev.21.gifts' });
    renderWithLocale(await Home());
    const link = screen.getByRole('link', { name: '21gifts@21.gifts' });
    expect(link.getAttribute('href')).toBe('lightning:21gifts@21.gifts');
    expect(document.body.textContent).not.toContain('evil');
  });

  it.each(['21.gifts.evil.com', 'evil21.gifts', 'evil.com:443, dev.21.gifts'])(
    'falls back to 21.gifts for the foreign host %s',
    async (host) => {
      setRequestHeaders({ host });
      renderWithLocale(await Home());
      expect(screen.getByRole('link', { name: '21gifts@21.gifts' })).toBeTruthy();
      expect(document.body.textContent).not.toContain('evil');
    },
  );

  it('lower-cases an uppercase 21.gifts subdomain', async () => {
    setRequestHeaders({ 'x-forwarded-host': 'DEV.21.GIFTS:443' });
    renderWithLocale(await Home());
    const link = screen.getByRole('link', { name: '21gifts@dev.21.gifts' });
    expect(link.getAttribute('href')).toBe('lightning:21gifts@dev.21.gifts');
  });

  it('hides the project section when the platform username is unset', async () => {
    vi.stubEnv('NEXT_PUBLIC_PLATFORM_USERNAME', undefined);
    renderWithLocale(await Home());
    expect(document.getElementById('project')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Donate to this project' })).toBeNull();
    expect(document.querySelector('a[href^="lightning:"]')).toBeNull();
  });

  it('does not name any other wallet app', async () => {
    renderWithLocale(await Home());
    expect(document.body.textContent).not.toMatch(
      new RegExp(['wallet', 'of', 'satoshi'].join(' '), 'i'),
    );
  });
});
