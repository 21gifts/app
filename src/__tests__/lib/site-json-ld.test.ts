import { describe, expect, it } from 'vitest';
import { SITE_DESCRIPTION, SITE_JSON_LD } from '@/lib/site-json-ld';

describe('site json-ld', () => {
  it('carries the public description inside the structured data', () => {
    expect(SITE_DESCRIPTION.length).toBeGreaterThan(0);
    expect(SITE_JSON_LD['@context']).toBe('https://schema.org');
    expect(JSON.stringify(SITE_JSON_LD)).toContain(SITE_DESCRIPTION);
  });
});
