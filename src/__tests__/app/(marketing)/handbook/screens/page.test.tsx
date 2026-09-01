import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HandbookScreensPage from '@/app/(marketing)/handbook/screens/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/request-locale', () => ({
  getRequestLocale: vi.fn(async () => 'en' as const),
}));

afterEach(cleanup);

describe('HandbookScreensPage', () => {
  it('renders the Screens heading and a topic picker', async () => {
    renderWithLocale(await HandbookScreensPage());
    expect(screen.getByRole('heading', { name: 'Screens' })).toBeTruthy();
    expect(screen.getByLabelText('Topic')).toBeTruthy();
  });
});
