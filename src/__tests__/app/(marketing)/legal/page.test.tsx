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
    expect(screen.getByRole('heading', { name: 'Legal Notice', level: 1 })).toBeTruthy();
    const imprint = screen.getByRole('heading', { name: 'Imprint' });
    expect(imprint.className).toContain('text-xl');
    expect(imprint.className).toContain('font-semibold');
    expect(imprint.className).not.toContain('text-paper/70');
    expect(screen.getByRole('heading', { name: 'Privacy Policy', level: 2 })).toBeTruthy();
    const overview = screen.getByRole('heading', { name: 'Overview', level: 3 });
    expect(overview.className).toContain('text-xl font-semibold');
    expect(overview.className).not.toContain('text-paper/70');
  });

  it('does not describe the app as a separate domain', () => {
    render(<LegalPage />);
    expect(screen.queryByText(/separate domain/i)).toBeNull();
  });

  it('does not claim Cloudflare Pages hosting', () => {
    render(<LegalPage />);
    expect(screen.queryByText(/Cloudflare Pages/i)).toBeNull();
  });

  it('documents the optional locale, numberFormat, and theme cookies', () => {
    render(<LegalPage />);
    expect(
      screen.getByText(
        /sets no cookies unless you choose a language, a number format, or a light\/dark appearance/i,
      ),
    ).toBeTruthy();
    expect(screen.getAllByText('locale').length).toBeGreaterThan(0);
    expect(screen.getAllByText('numberFormat').length).toBeGreaterThan(0);
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

  it('credits the four Bible editions', () => {
    render(<LegalPage />);
    expect(screen.getByRole('heading', { name: 'Scripture quotations', level: 2 })).toBeTruthy();
    const notice = (text: string): HTMLElement =>
      screen.getByText((_, node) => {
        if (!node || node.tagName !== 'P') return false;
        const own = Array.from(node.childNodes)
          .filter((child) => child.nodeType === Node.TEXT_NODE)
          .map((child) => child.textContent ?? '')
          .join('')
          .replace(/\s+/g, ' ')
          .trim();
        return own === text;
      });
    expect(
      notice(
        'THE HOLY BIBLE, NEW INTERNATIONAL VERSION®, NIV® Copyright © 1973, 1978, 1984, 2011 by Biblica, Inc.® Used by permission. All rights reserved worldwide.',
      ),
    ).toBeTruthy();
    expect(
      notice(
        'Die Bibel nach Martin Luthers Übersetzung, revidiert 2017, © 2016 Deutsche Bibelgesellschaft, Stuttgart.',
      ),
    ).toBeTruthy();
    expect(
      notice(
        'Texto bíblico: Reina-Valera 1960® © Sociedades Bíblicas en América Latina, 1960. Renovado © Sociedades Bíblicas Unidas, 1988. Utilizado con permiso. Reina-Valera 1960® es una marca registrada de Sociedades Bíblicas Unidas, y se puede usar solamente bajo licencia.',
      ),
    ).toBeTruthy();
    expect(
      notice('Magandang Balita Biblia (Revised) © Philippine Bible Society 2005.'),
    ).toBeTruthy();
  });
});
