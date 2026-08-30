import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LegalPage from '@/app/(marketing)/legal/page';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(cleanup);

describe('LegalPage', () => {
  it('shows the legal notice heading', () => {
    render(<LegalPage />);
    expect(screen.getByRole('heading', { name: 'Legal Notice' })).toBeTruthy();
  });

  it('does not describe the app as a separate domain', () => {
    render(<LegalPage />);
    expect(screen.queryByText(/separate domain/i)).toBeNull();
  });

  it('does not claim Cloudflare Pages hosting', () => {
    render(<LegalPage />);
    expect(screen.queryByText(/Cloudflare Pages/i)).toBeNull();
  });

  it('documents the optional locale and theme cookies', () => {
    render(<LegalPage />);
    expect(
      screen.getByText(/sets no cookies unless you choose a language or a light\/dark appearance/i),
    ).toBeTruthy();
    expect(screen.getAllByText('locale').length).toBeGreaterThan(0);
    expect(screen.getAllByText('theme').length).toBeGreaterThan(0);
  });

  it('has no published email and points contact to the in-app form', () => {
    const { container } = render(<LegalPage />);
    expect(container.textContent).not.toMatch(/info@21\.gifts/);
    expect(container.innerHTML).not.toMatch(/mailto:/);
    expect(
      screen.getAllByText(/Contact us in the 21\.gifts app after you log in/i).length,
    ).toBeGreaterThan(0);
    const appLinks = screen.getAllByRole('link', { name: 'Open the app' });
    expect(appLinks.length).toBeGreaterThan(0);
    for (const link of appLinks) {
      expect(link.getAttribute('href')).toBe('/contact');
    }
  });
});
