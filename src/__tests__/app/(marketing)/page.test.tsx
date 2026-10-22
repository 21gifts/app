import { cleanup, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Home, { generateMetadata } from '@/app/(marketing)/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import { OG_IMAGE_ALT } from '@/lib/marketing-metadata';
import { getCatalog } from '@/lib/messages';
import { getRequestLocale } from '@/lib/request-locale';

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

afterEach(cleanup);

describe('Home', () => {
  it('renders the product headline', async () => {
    renderWithLocale(await Home());
    expect(screen.getByRole('heading', { name: /Help people.*with Bitcoin/i })).toBeTruthy();
  });

  it('explains the direct gift and shows an honest non-interactive preview', async () => {
    renderWithLocale(await Home());
    expect(screen.getByText(/Sign in and read their posts/i)).toBeTruthy();
    expect(screen.getByText('How it works')).toBeTruthy();
    expect(screen.getByText('Where the Bitcoin goes')).toBeTruthy();
    expect(screen.getByText('Your wallet')).toBeTruthy();
    expect(screen.getByText('Their wallet')).toBeTruthy();
    expect(screen.getByText('React and donate')).toBeTruthy();
    const bitcoinMarks = document.querySelectorAll('img[src="/bitcoin-symbol.svg"]');
    expect(bitcoinMarks).toHaveLength(5);
    for (const mark of bitcoinMarks) {
      expect(mark.getAttribute('aria-hidden')).toBe('true');
    }
    expect(screen.queryByRole('spinbutton')).toBeNull();
    expect(screen.queryByRole('button', { name: /pay with/i })).toBeNull();
  });

  it.each(['en', 'de', 'es', 'fil'] as const)(
    'shows the how-it-works numbers from the %s catalog',
    async (locale) => {
      vi.mocked(getRequestLocale).mockResolvedValueOnce(locale);
      renderWithLocale(await Home(), locale);
      const how = document.getElementById('how');
      expect(how).toBeTruthy();
      const messages = getCatalog(locale);
      const scope = within(how as HTMLElement);
      expect(scope.getByText(messages['home.give1Num'])).toBeTruthy();
      expect(scope.getByText(messages['home.give2Num'])).toBeTruthy();
      expect(scope.getByText(messages['home.give3Num'])).toBeTruthy();
    },
  );

  it.each(['en', 'de', 'es', 'fil'] as const)(
    'shows the why numbers from the %s catalog',
    async (locale) => {
      vi.mocked(getRequestLocale).mockResolvedValueOnce(locale);
      renderWithLocale(await Home(), locale);
      const why = document.getElementById('why');
      expect(why).toBeTruthy();
      const messages = getCatalog(locale);
      const scope = within(why as HTMLElement);
      expect(scope.getByText(messages['home.why1Num'])).toBeTruthy();
      expect(scope.getByText(messages['home.why2Num'])).toBeTruthy();
      expect(scope.getByText(messages['home.why3Num'])).toBeTruthy();
      expect(scope.getByText(messages['home.why4Num'])).toBeTruthy();
    },
  );

  it('publishes the same English preview on every language URL', async () => {
    const title = 'Help people with Bitcoin | 21.gifts';
    const description =
      "Read what people share, react to a post and donate Bitcoin directly to the person's wallet. 21.gifts does not hold your donation and keeps no share.";
    const preview = {
      title,
      description,
      openGraph: {
        title,
        description,
        images: [{ url: '/og.png', alt: OG_IMAGE_ALT }],
      },
      twitter: {
        title,
        description,
        images: [{ url: '/og.png', alt: OG_IMAGE_ALT }],
      },
    };
    expect(await generateMetadata()).toMatchObject({
      ...preview,
      alternates: { canonical: '/en' },
      openGraph: { ...preview.openGraph, url: '/en' },
    });
    vi.mocked(getRequestLocale).mockResolvedValueOnce('de');
    expect(await generateMetadata()).toMatchObject({
      ...preview,
      alternates: { canonical: '/de' },
      openGraph: { ...preview.openGraph, url: '/de' },
    });
    vi.mocked(getRequestLocale).mockResolvedValueOnce('es');
    expect(await generateMetadata()).toMatchObject({
      ...preview,
      alternates: { canonical: '/es' },
      openGraph: { ...preview.openGraph, url: '/es' },
    });
    vi.mocked(getRequestLocale).mockResolvedValueOnce('fil');
    expect(await generateMetadata()).toMatchObject({
      ...preview,
      alternates: { canonical: '/fil' },
      openGraph: { ...preview.openGraph, url: '/fil' },
    });
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
    const links = screen.getAllByRole('link', { name: 'Ask for help' });
    expect(links.length).toBeGreaterThanOrEqual(2);
    for (const link of links) expect(link.getAttribute('href')).toBe('/login');
  });

  it('links Send help to donate', async () => {
    renderWithLocale(await Home());
    const link = screen.getByRole('link', { name: 'Send help' });
    expect(link.getAttribute('href')).toBe('/en/donate');
  });

  it('renders a donate-to-project heading', async () => {
    renderWithLocale(await Home());
    expect(screen.getByRole('heading', { name: '21.gifts also needs support' })).toBeTruthy();
  });

  it('exposes the project Wallet of Satoshi address as a lightning link', async () => {
    renderWithLocale(await Home());
    const link = screen.getByRole('link', { name: '21gifts@walletofsatoshi.com' });
    expect(link.getAttribute('href')).toBe('lightning:21gifts@walletofsatoshi.com');
  });

  it('links the discovery cards to the corresponding sections', async () => {
    renderWithLocale(await Home());
    expect(screen.getByRole('link', { name: /Happyland · Tondo/ }).getAttribute('href')).toBe(
      '#happyland',
    );
    expect(screen.getByRole('link', { name: /Why Bitcoin/i }).getAttribute('href')).toBe('#why');
    expect(screen.getByRole('link', { name: /Who receives it/i }).getAttribute('href')).toBe(
      '#faq',
    );
  });

  it('hides the Happyland discovery graphic and keeps Bitcoin marks off accent fills', async () => {
    renderWithLocale(await Home());
    const link = document.querySelector('a[href="#happyland"]');
    expect(link).toBeTruthy();
    const graphic = link?.querySelector(':scope > div');
    expect(graphic?.tagName).toBe('DIV');
    expect(graphic?.getAttribute('aria-hidden')).toBe('true');
    const marks = document.querySelectorAll('img[src*="bitcoin-symbol"]');
    expect(marks).toHaveLength(5);
    for (const mark of marks) {
      expect(mark.closest('.bg-accent')).toBeNull();
    }
  });

  it('gives all eight FAQ disclosures the same name', async () => {
    renderWithLocale(await Home());
    const faq = document.getElementById('faq');
    expect(faq).toBeTruthy();
    const names = [...(faq as HTMLElement).querySelectorAll('details')].map((detail) =>
      detail.getAttribute('name'),
    );
    expect(names).toEqual(Array.from({ length: 8 }, () => 'home-faq'));
  });
});
