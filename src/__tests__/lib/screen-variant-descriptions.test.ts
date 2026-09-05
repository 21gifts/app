import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseScreenVariantDescriptions } from '@/lib/screen-variant-descriptions';
import catalog from '@/lib/screen-variant-catalog.json';

describe('parseScreenVariantDescriptions', () => {
  it('returns an empty map for blank markdown', () => {
    expect(parseScreenVariantDescriptions('').size).toBe(0);
    expect(parseScreenVariantDescriptions('\n\n').size).toBe(0);
  });

  it('parses path:variant keys, skips images, unwraps markup, and joins paragraphs', () => {
    const markdown = `# Screens

## Screen: /

### Variant: default

First **bold** with \`code\`.

![shot](images/root.png)

Second paragraph.

### Variant: empty-body

![only](images/x.png)

## Screen: /welcome

### Variant: pay-qr

Payable note with a QR.

![qr](images/welcome-pay-qr.png)
`;
    const map = parseScreenVariantDescriptions(markdown);
    expect(map.get('/:default')).toBe('First bold with code.\n\nSecond paragraph.');
    expect(map.has('/:empty-body')).toBe(false);
    expect(map.get('/welcome:pay-qr')).toBe('Payable note with a QR.');
  });

  it('ignores body before the first variant and clears on unrelated headings', () => {
    const markdown = `## Screen: /legal

- **URL:** ignored

### Variant: default

Imprint only.

#### Extra

Not collected.

## Other chapter

### Variant: stray

Should not appear without a screen path.
`;
    const map = parseScreenVariantDescriptions(markdown);
    expect(map.get('/legal:default')).toBe('Imprint only.');
    expect(map.has('/:stray')).toBe(false);
    expect(map.has('stray')).toBe(false);
  });

  it('covers every ### Variant: in screens.md and every catalog id', () => {
    const screensPath = path.join(process.cwd(), 'docs', 'handbook', 'screens.md');
    const markdown = fs.readFileSync(screensPath, 'utf8');
    const variantCount = (markdown.match(/^### Variant:/gm) ?? []).length;
    const map = parseScreenVariantDescriptions(markdown);
    expect(map.size).toBe(variantCount);

    for (const row of catalog) {
      const description = map.get(row.id);
      expect(description, `missing description for ${row.id}`).toBeTruthy();
      expect((description ?? '').trim().length).toBeGreaterThan(0);
    }

    expect(map.get('/welcome:pay-qr')).toMatch(/Bitcoin payment QR/);
    expect(map.get('/:mobile-nav')).toMatch(/hamburger|Menu button/i);
  });
});
