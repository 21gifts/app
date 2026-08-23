import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadHandbookDocuments } from '@/lib/handbook';

describe('loadHandbookDocuments', () => {
  it('loads the four app handbook files from docs/handbook', () => {
    const docs = loadHandbookDocuments();
    expect(docs.map((d) => d.id)).toEqual(['readme', 'screens', 'functions', 'endpoints']);
    expect(docs.map((d) => d.title)).toEqual(['Overview', 'Screens', 'Functions', 'Endpoints']);
    for (const doc of docs) {
      expect(doc.markdown.length).toBeGreaterThan(0);
    }
  });

  it('throws when the directory is missing', () => {
    const dir = path.join(os.tmpdir(), `handbook-missing-${Date.now()}-${Math.random()}`);
    expect(() => loadHandbookDocuments(dir)).toThrow(new RegExp(dir.replace(/\\/g, '\\\\')));
  });

  it('throws when README.md is missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'handbook-partial-'));
    try {
      fs.writeFileSync(path.join(dir, 'screens.md'), '# Screens\n');
      expect(() => loadHandbookDocuments(dir)).toThrow(/README\.md/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
