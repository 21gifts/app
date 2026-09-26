import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import MarketingLayout from '@/app/(marketing)/layout';

vi.mock('@/lib/request-locale', () => ({
  getRequestLocale: vi.fn(async () => 'en' as const),
}));

describe('MarketingLayout', () => {
  it('wraps children in a dark full-page shell', async () => {
    const tree = await MarketingLayout({ children: 'content' });
    const props = tree.props as { className: string; children: ReactNode[] };

    expect(tree.type).toBe('div');
    expect(props.className).toContain('bg-ink');
    expect(props.className).toContain('[color-scheme:dark]');
  });

  it('puts header, page, and footer in one scrollport', async () => {
    const tree = await MarketingLayout({ children: 'content' });
    const props = tree.props as { className: string; children: { props: { children: unknown[] } } };
    expect(props.className).toContain('h-[var(--app-height)]');
    const inner = props.children.props.children;
    expect(Array.isArray(inner)).toBe(true);
    expect(inner).toHaveLength(3);
    expect(inner[1]).toBe('content');
  });
});
