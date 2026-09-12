import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AboutPage from '@/app/(marketing)/about/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/request-locale', () => ({
  getRequestLocale: vi.fn(async () => 'en' as const),
}));

afterEach(cleanup);

describe('AboutPage', () => {
  it('renders the hospitality heading', async () => {
    renderWithLocale(await AboutPage());
    expect(screen.getByRole('heading', { name: 'A house of hospitality' })).toBeTruthy();
  });

  it('quotes Matthew 10:8', async () => {
    renderWithLocale(await AboutPage());
    expect(screen.getByText('Freely you have received; freely give.')).toBeTruthy();
  });

  it('states the house is rooted, not restricted', async () => {
    renderWithLocale(await AboutPage());
    expect(screen.getByRole('heading', { name: 'Rooted, not restricted' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Where this house comes from' })).toBeNull();
  });

  it('links Open the living room to /welcome', async () => {
    renderWithLocale(await AboutPage());
    const link = screen.getByRole('link', { name: 'Open the living room' });
    expect(link.getAttribute('href')).toBe('/welcome');
  });

  it('does not use Lightning, LNURL, passkey, ministry, Gospel, or Jesus', async () => {
    renderWithLocale(await AboutPage());
    expect(document.body.textContent).not.toMatch(/Lightning/i);
    expect(document.body.textContent).not.toMatch(/LNURL/i);
    expect(document.body.textContent).not.toMatch(/passkey/i);
    expect(document.body.textContent).not.toMatch(/ministry/i);
    expect(document.body.textContent).not.toMatch(/Gospel/i);
    expect(document.body.textContent).not.toMatch(/\bJesus\b/i);
  });
});
