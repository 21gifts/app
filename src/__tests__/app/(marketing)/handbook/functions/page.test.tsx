import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HandbookFunctionsPage from '@/app/(marketing)/handbook/functions/page';
import { loadHandbookDocuments } from '@/lib/handbook';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/request-locale', () => ({
  getRequestLocale: vi.fn(async () => 'en' as const),
}));

vi.mock('@/lib/handbook', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/handbook')>();
  return {
    ...actual,
    loadHandbookDocuments: vi.fn(actual.loadHandbookDocuments),
  };
});

afterEach(cleanup);

describe('HandbookFunctionsPage', () => {
  it('renders the Functions heading and function markdown', async () => {
    renderWithLocale(await HandbookFunctionsPage());
    expect(screen.getByRole('heading', { level: 1, name: 'Functions' })).toBeTruthy();
    expect(document.getElementById('functions')).not.toBeNull();
    expect(screen.queryByLabelText('Topic')).toBeNull();
  });

  it('omits the functions section when the handbook doc is missing', async () => {
    vi.mocked(loadHandbookDocuments).mockReturnValueOnce([]);
    renderWithLocale(await HandbookFunctionsPage());
    expect(screen.getByRole('heading', { level: 1, name: 'Functions' })).toBeTruthy();
    expect(document.getElementById('functions')).toBeNull();
  });
});
