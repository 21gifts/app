import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import LegalPage from '@/app/(marketing)/legal/page';

afterEach(cleanup);

describe('LegalPage', () => {
  it('shows the legal notice heading', () => {
    render(<LegalPage />);
    expect(screen.getByRole('heading', { name: 'Legal Notice' })).toBeTruthy();
  });

  it('does not describe the app as a separate domain', () => {
    render(<LegalPage />);
    expect(screen.queryByText(/separate domain/i)).toBeNull();
  });

  it('does not claim Cloudflare Pages hosting', () => {
    render(<LegalPage />);
    expect(screen.queryByText(/Cloudflare Pages/i)).toBeNull();
  });
});
