import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RootLayout, { metadata } from '@/app/layout';
import { LocaleProvider } from '@/components/LocaleProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { THEME_BOOTSTRAP_SCRIPT } from '@/lib/theme';

vi.mock('@/lib/request-locale', () => ({
  getRequestLocale: vi.fn(async () => 'en' as const),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('metadata', () => {
  it('exposes the product title', () => {
    expect(metadata.title).toBe('21.gifts');
  });

  it('describes the product without charity-speak', () => {
    expect(metadata.description).toBe(
      'Direct human-to-human giving over Bitcoin. People helping people — no middleman, no cut.',
    );
  });

  it('pins metadataBase to the production origin', () => {
    expect(metadata.metadataBase).toBeInstanceOf(URL);
    expect(metadata.metadataBase?.href).toBe('https://21.gifts/');
  });

  it('declares favicon and apple-touch icons', () => {
    const icons = metadata.icons as NonNullable<Metadata['icons']> & {
      icon: Array<{ url: string }>;
      apple: Array<{ url: string }>;
    };

    expect(icons.icon.map((entry) => entry.url)).toEqual(
      expect.arrayContaining(['/favicon.ico', '/favicon.svg']),
    );
    expect(icons.apple.map((entry) => entry.url)).toContain('/apple-touch-icon.png');
  });

  it('declares the web app manifest and apple web app metadata', () => {
    expect(metadata.manifest).toBe('/manifest.webmanifest');
    expect(metadata.appleWebApp).toEqual({
      capable: true,
      title: '21.gifts',
      statusBarStyle: 'default',
    });
  });

  it('exposes Open Graph website preview metadata', () => {
    const openGraph = metadata.openGraph as NonNullable<Metadata['openGraph']> & {
      type: string;
      url: string;
      images: Array<{ url: string; width: number; height: number; alt: string }>;
    };

    expect(openGraph.type).toBe('website');
    expect(openGraph.url).toBe('https://21.gifts');
    expect(openGraph.images[0]?.url).toBe('/og.png');
    expect(openGraph.images[0]?.width).toBe(1200);
    expect(openGraph.images[0]?.height).toBe(630);
    expect(openGraph.images[0]?.alt).toBe('21.gifts — peer-to-peer Bitcoin gifts');
  });

  it('exposes Twitter summary_large_image preview metadata', () => {
    const twitter = metadata.twitter as NonNullable<Metadata['twitter']> & {
      card: string;
      images: Array<{ url: string; alt: string }>;
    };

    expect(twitter.card).toBe('summary_large_image');
    expect(twitter.images[0]?.url).toBe('/og.png');
  });
});

describe('RootLayout', () => {
  // Rendering a nested <html> element inside the jsdom document triggers DOM
  // nesting warnings, so the layout is asserted on its returned element tree.
  it('renders an English <html> document with suppressHydrationWarning', async () => {
    const tree = await RootLayout({ children: 'content' });
    const props = tree.props as {
      lang: string;
      suppressHydrationWarning?: boolean;
      children: ReactNode;
    };

    expect(tree.type).toBe('html');
    expect(props.lang).toBe('en');
    expect(props.suppressHydrationWarning).toBe(true);
  });

  it('injects THEME_BOOTSTRAP_SCRIPT as a raw head script', async () => {
    const tree = await RootLayout({ children: 'content' });
    const htmlProps = tree.props as {
      children: ReactElement[];
    };
    const children = Array.isArray(htmlProps.children) ? htmlProps.children : [htmlProps.children];
    const head = children.find((child) => child.type === 'head') as ReactElement<{
      children: ReactElement<{ dangerouslySetInnerHTML: { __html: string } }>;
    }>;
    const script = head.props.children;
    expect(script.type).toBe('script');
    expect(script.props.dangerouslySetInnerHTML.__html).toBe(THEME_BOOTSTRAP_SCRIPT);
  });

  it('wraps children LocaleProvider → ThemeProvider and uses bg-app-bg on body', async () => {
    const tree = await RootLayout({ children: 'content' });
    const htmlProps = tree.props as {
      children: ReactElement[];
    };
    const children = Array.isArray(htmlProps.children) ? htmlProps.children : [htmlProps.children];
    const body = children.find((child) => child.type === 'body') as ReactElement<{
      className: string;
      children: ReactElement<{ children: ReactElement<{ children: ReactNode }> }>;
    }>;

    expect(body.type).toBe('body');
    expect(body.props.className).toContain('bg-app-bg');
    expect(body.props.className).not.toContain('bg-white');
    const localeProvider = body.props.children;
    expect(localeProvider.type).toBe(LocaleProvider);
    const themeProvider = localeProvider.props.children;
    expect(themeProvider.type).toBe(ThemeProvider);
    expect(themeProvider.props.children).toBe('content');
  });
});
