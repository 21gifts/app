import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import PayLinkPage from '@/app/pl/page';

function lightningOf(element: ReactElement): string {
  return (element.props as { lightning: string }).lightning;
}

describe('PayLinkPage', () => {
  it('passes a string lightning query through', async () => {
    const element = await PayLinkPage({
      searchParams: Promise.resolve({ lightning: 'LNURL1' }),
    });
    expect(lightningOf(element)).toBe('LNURL1');
  });

  it('uses the first value when the query is repeated', async () => {
    const element = await PayLinkPage({
      searchParams: Promise.resolve({ lightning: ['first', 'second'] }),
    });
    expect(lightningOf(element)).toBe('first');
  });

  it('uses an empty string when the query is missing or blank', async () => {
    const missing = await PayLinkPage({ searchParams: Promise.resolve({}) });
    expect(lightningOf(missing)).toBe('');
    const blank = await PayLinkPage({
      searchParams: Promise.resolve({ lightning: [] }),
    });
    expect(lightningOf(blank)).toBe('');
  });
});
