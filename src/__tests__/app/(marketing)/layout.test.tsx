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

  it('renders three children: header, page, footer', async () => {
    const tree = await MarketingLayout({ children: 'content' });
    const props = tree.props as { children: unknown[] };
    expect(Array.isArray(props.children)).toBe(true);
    expect((props.children as unknown[]).length).toBe(3);
    expect((props.children as unknown[])[1]).toBe('content');
  });
});
