import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/app/globals.css', 'utf8');

function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? '';
}

describe('page scroll', () => {
  it('lets the active scrollport move vertically only', () => {
    const body = ruleBody('[data-scrollport][data-scroll-active]');
    expect(body).toContain('overflow-x: clip');
    expect(body).toContain('overflow-y: auto');
    expect(body).not.toContain('overflow: auto');
  });

  it('keeps the page column inside the port', () => {
    const body = ruleBody('[data-scroll-page]');
    expect(body).toContain('min-width: 0');
    expect(body).toContain('max-width: 100%');
    expect(body).toContain('overflow-x: clip');
  });

  it('scrolls a photo row sideways inside its own box', () => {
    const body = ruleBody('[data-scroll-x]');
    expect(body).toContain('width: 100%');
    expect(body).toContain('min-width: 0');
    expect(body).toContain('max-width: 100%');
    expect(body).toContain('overflow-x: auto');
    expect(body).toContain('overflow-y: clip');
  });
});
