import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/font/google', () => ({
  Outfit: (): { variable: string } => ({ variable: '__outfit_variable' }),
}));

import RootLayout, { metadata } from '@/app/layout';
import { AppHeightSync } from '@/components/AppHeightSync';
import { LocaleProvider } from '@/components/LocaleProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { APP_HEIGHT_BOOTSTRAP_SCRIPT } from '@/lib/app-height';
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
      'Direct human-to-human giving in Bitcoin. People helping people — no middleman, no cut.',
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
    expect((props as { className?: string }).className).toContain('__outfit_variable');
  });

  it('injects APP_HEIGHT then THEME bootstrap scripts as raw head scripts', async () => {
    const tree = await RootLayout({ children: 'content' });
    const htmlProps = tree.props as {
      children: ReactElement[];
    };
    const children = Array.isArray(htmlProps.children) ? htmlProps.children : [htmlProps.children];
    const head = children.find((child) => child.type === 'head') as ReactElement<{
      children: ReactElement<{ dangerouslySetInnerHTML: { __html: string } }>[];
    }>;
    const scripts = Array.isArray(head.props.children)
      ? head.props.children
      : [head.props.children];
    expect(scripts).toHaveLength(2);
    expect(scripts[0]?.type).toBe('script');
    expect(scripts[0]?.props.dangerouslySetInnerHTML.__html).toBe(APP_HEIGHT_BOOTSTRAP_SCRIPT);
    expect(scripts[1]?.type).toBe('script');
    expect(scripts[1]?.props.dangerouslySetInnerHTML.__html).toBe(THEME_BOOTSTRAP_SCRIPT);
  });

  it('wraps children LocaleProvider → ThemeProvider with AppHeightSync first on body', async () => {
    const tree = await RootLayout({ children: 'content' });
    const htmlProps = tree.props as {
      children: ReactElement[];
    };
    const children = Array.isArray(htmlProps.children) ? htmlProps.children : [htmlProps.children];
    const body = children.find((child) => child.type === 'body') as ReactElement<{
      className: string;
      children: ReactElement[];
    }>;

    expect(body.type).toBe('body');
    expect(body.props.className).toContain('bg-app-bg');
    expect(body.props.className).toContain('font-sans');
    expect(body.props.className).not.toContain('bg-white');
    const bodyChildren = Array.isArray(body.props.children)
      ? body.props.children
      : [body.props.children];
    expect(bodyChildren[0]?.type).toBe(AppHeightSync);
    const localeProvider = bodyChildren[1] as ReactElement<{
      children: ReactElement<{ children: ReactNode }>;
    }>;
    expect(localeProvider.type).toBe(LocaleProvider);
    const themeProvider = localeProvider.props.children;
    expect(themeProvider.type).toBe(ThemeProvider);
    expect(themeProvider.props.children).toBe('content');
  });
});
