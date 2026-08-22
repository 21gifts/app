import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import MarketingLayout from '@/app/(marketing)/layout';

describe('MarketingLayout', () => {
  it('wraps children in a dark full-page shell', () => {
    const tree = MarketingLayout({ children: 'content' });
    const props = tree.props as { className: string; children: ReactNode[] };

    expect(tree.type).toBe('div');
    expect(props.className).toContain('bg-[#0a090c]');
  });

  it('renders three children: header, page, footer', () => {
    const tree = MarketingLayout({ children: 'content' });
    const props = tree.props as { children: unknown[] };
    expect(Array.isArray(props.children)).toBe(true);
    expect((props.children as unknown[]).length).toBe(3);
    expect((props.children as unknown[])[1]).toBe('content');
  });
});
