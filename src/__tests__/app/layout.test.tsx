import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import RootLayout, { metadata } from '@/app/layout';

describe('metadata', () => {
  it('exposes the product title', () => {
    expect(metadata.title).toBe('21.gifts');
  });

  it('describes the product without charity-speak', () => {
    expect(metadata.description).toBe(
      'Direct human-to-human giving over Bitcoin Lightning. People helping people — no middleman, no cut.',
    );
  });
});

describe('RootLayout', () => {
  // Rendering a nested <html> element inside the jsdom document triggers DOM
  // nesting warnings, so the layout is asserted on its returned element tree.
  it('renders an English <html> document', () => {
    const tree = RootLayout({ children: 'content' });
    const props = tree.props as { lang: string; children: ReactNode };

    expect(tree.type).toBe('html');
    expect(props.lang).toBe('en');
  });

  it('wraps the children in the <body>', () => {
    const tree = RootLayout({ children: 'content' });
    const htmlProps = tree.props as { children: { type: string; props: { children: ReactNode } } };
    const body = htmlProps.children;

    expect(body.type).toBe('body');
    expect(body.props.children).toBe('content');
  });
});
