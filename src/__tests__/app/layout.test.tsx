import type { Metadata } from 'next';
import type { ReactElement, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RootLayout, { metadata } from '@/app/layout';
import { LocaleProvider } from '@/components/LocaleProvider';

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
      'Direct human-to-human giving over Bitcoin Lightning. People helping people — no middleman, no cut.',
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
    expect(openGraph.images[0]?.alt).toBe('21.gifts — peer-to-peer Bitcoin Lightning gifts');
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
  it('renders an English <html> document', async () => {
    const tree = await RootLayout({ children: 'content' });
    const props = tree.props as { lang: string; children: ReactNode };

    expect(tree.type).toBe('html');
    expect(props.lang).toBe('en');
  });

  it('wraps the children in LocaleProvider inside the <body>', async () => {
    const tree = await RootLayout({ children: 'content' });
    const htmlProps = tree.props as {
      children: {
        type: string;
        props: { children: ReactElement };
      };
    };
    const body = htmlProps.children;
    const provider = body.props.children as ReactElement<{ children: ReactNode }>;

    expect(body.type).toBe('body');
    expect(provider.type).toBe(LocaleProvider);
    expect(provider.props.children).toBe('content');
  });
});
