import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseScreenVariantDescriptions } from '@/lib/screen-variant-descriptions';
import { screenVariantDescription } from '@/lib/screen-variant-locale';
import descriptionsByLocale from '@/lib/screen-variant-descriptions-locale.json';

describe('screenVariantDescription', () => {
  it('keeps JSON keys aligned with screens.md and every locale string non-empty', () => {
    const screensPath = path.join(process.cwd(), 'docs', 'handbook', 'screens.md');
    const markdown = fs.readFileSync(screensPath, 'utf8');
    const descriptions = parseScreenVariantDescriptions(markdown);
    expect(Object.keys(descriptionsByLocale).sort()).toEqual([...descriptions.keys()].sort());
    for (const [id, copy] of Object.entries(descriptionsByLocale)) {
      expect(copy.de.trim().length, `${id}.de`).toBeGreaterThan(0);
      expect(copy.es.trim().length, `${id}.es`).toBeGreaterThan(0);
      expect(copy.fil.trim().length, `${id}.fil`).toBeGreaterThan(0);
    }
  });

  it('returns German, Spanish, and Filipino copy for repay-today', () => {
    const screensPath = path.join(process.cwd(), 'docs', 'handbook', 'screens.md');
    const markdown = fs.readFileSync(screensPath, 'utf8');
    const descriptions = parseScreenVariantDescriptions(markdown);
    const english = descriptions.get('/welcome:repay-today');
    if (english === undefined) {
      throw new Error('missing English description for /welcome:repay-today');
    }
    expect(screenVariantDescription('de', '/welcome:repay-today', english, 'label')).toContain(
      'Kredit zurückzahlen',
    );
    expect(screenVariantDescription('es', '/welcome:repay-today', english, 'label')).toContain(
      'Devolver tu préstamo',
    );
    expect(screenVariantDescription('fil', '/welcome:repay-today', english, 'label')).toContain(
      'Bayaran ang iyong utang',
    );
  });

  it('returns German copy for /messages/[id]/repayment-list:default', () => {
    const screensPath = path.join(process.cwd(), 'docs', 'handbook', 'screens.md');
    const markdown = fs.readFileSync(screensPath, 'utf8');
    const descriptions = parseScreenVariantDescriptions(markdown);
    const english = descriptions.get('/messages/[id]/repayment-list:default');
    if (english === undefined) {
      throw new Error('missing English description for /messages/[id]/repayment-list:default');
    }
    expect(
      screenVariantDescription('de', '/messages/[id]/repayment-list:default', english, 'label'),
    ).toContain('Rückzahlungsliste');
  });

  it('returns the English handbook paragraph unchanged', () => {
    const screensPath = path.join(process.cwd(), 'docs', 'handbook', 'screens.md');
    const markdown = fs.readFileSync(screensPath, 'utf8');
    const descriptions = parseScreenVariantDescriptions(markdown);
    const english = descriptions.get('/welcome:repay-today');
    if (english === undefined) {
      throw new Error('missing English description for /welcome:repay-today');
    }
    expect(screenVariantDescription('en', '/welcome:repay-today', english, 'label')).toBe(english);
  });

  it('returns the catalog label when English is missing or blank', () => {
    expect(screenVariantDescription('de', '/:nope', undefined, 'Fallback label')).toBe(
      'Fallback label',
    );
    expect(screenVariantDescription('fil', '/:nope', '   ', 'Fallback label')).toBe(
      'Fallback label',
    );
    expect(
      screenVariantDescription('en', '/welcome:repay-today', undefined, 'Fallback label'),
    ).toBe('Fallback label');
    expect(screenVariantDescription('en', '/welcome:repay-today', '   ', 'Fallback label')).toBe(
      'Fallback label',
    );
    expect(
      screenVariantDescription('de', '/welcome:repay-today', undefined, 'Fallback label'),
    ).toBe('Fallback label');
    expect(screenVariantDescription('de', '/welcome:repay-today', '   ', 'Fallback label')).toBe(
      'Fallback label',
    );
  });

  it('throws when a non-English locale has no catalog entry', () => {
    expect(() => screenVariantDescription('de', '/:missing', 'Has english', 'label')).toThrow(
      /^Missing de screen description for \/:missing$/,
    );
  });

  it('throws when a present entry has no copy or a blank translation', () => {
    const id = '/welcome:repay-today';
    const record = descriptionsByLocale as unknown as Record<
      string,
      { de: string; es: string; fil: string } | undefined
    >;
    const saved = record[id];
    if (saved === undefined) {
      throw new Error(`missing locale copy for ${id}`);
    }
    const missingCopy = /^Missing de screen description for \/welcome:repay-today$/;
    record[id] = undefined;
    try {
      expect(() => screenVariantDescription('de', id, 'Has english', 'label')).toThrow(missingCopy);
    } finally {
      record[id] = saved;
    }
    const savedDe = saved.de;
    saved.de = '   ';
    try {
      expect(() => screenVariantDescription('de', id, 'Has english', 'label')).toThrow(missingCopy);
    } finally {
      saved.de = savedDe;
    }
  });
});
