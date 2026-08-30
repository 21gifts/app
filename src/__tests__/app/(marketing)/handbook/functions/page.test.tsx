import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HandbookFunctionsPage from '@/app/(marketing)/handbook/functions/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(cleanup);

describe('HandbookFunctionsPage', () => {
  it('renders the Functions heading and function markdown', async () => {
    renderWithLocale(await HandbookFunctionsPage());
    expect(screen.getByRole('heading', { name: 'Functions' })).toBeTruthy();
    expect(document.getElementById('functions')).not.toBeNull();
    expect(screen.getByLabelText('Topic')).toBeTruthy();
  });
});
