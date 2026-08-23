import fs from 'node:fs';
import path from 'node:path';

/** One markdown file from `docs/handbook/`, rendered as a `/handbook` section. */
export type HandbookDocument = {
  id: string;
  title: string;
  markdown: string;
};

const HANDBOOK_FILES: ReadonlyArray<{ id: string; title: string; file: string }> = [
  { id: 'readme', title: 'Overview', file: 'README.md' },
  { id: 'screens', title: 'Screens', file: 'screens.md' },
  { id: 'functions', title: 'Functions', file: 'functions.md' },
  { id: 'endpoints', title: 'Endpoints', file: 'endpoints.md' },
];

/**
 * Load the app handbook markdown files.
 *
 * @param rootDir - Absolute path to a docs/handbook directory. Defaults to
 *   `<cwd>/docs/handbook`.
 * @returns The four documents in order: readme, screens, functions, endpoints.
 * @throws Error when the directory or a required file is missing.
 */
export function loadHandbookDocuments(rootDir?: string): HandbookDocument[] {
  const dir = rootDir ?? path.join(process.cwd(), 'docs', 'handbook');
  if (!fs.existsSync(dir)) {
    throw new Error(`Handbook directory missing: ${dir}`);
  }
  return HANDBOOK_FILES.map(({ id, title, file }) => {
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Handbook file missing: ${filePath}`);
    }
    return { id, title, markdown: fs.readFileSync(filePath, 'utf8') };
  });
}
