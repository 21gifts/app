import { cleanup, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HandbookEndpointsPage from '@/app/(marketing)/handbook/endpoints/page';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(cleanup);

describe('HandbookEndpointsPage', () => {
  it('renders the Endpoints heading and markdown, without image switches', async () => {
    renderWithLocale(await HandbookEndpointsPage());
    expect(screen.getByRole('heading', { name: 'Endpoints' })).toBeTruthy();
    expect(document.getElementById('endpoints')).not.toBeNull();
    expect(screen.queryByLabelText('Topic')).toBeNull();
  });
});
