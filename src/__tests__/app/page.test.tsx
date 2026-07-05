import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Home from '@/app/page';

afterEach(cleanup);

describe('Home', () => {
  it('renders the wordmark as the page heading', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { name: '21.gifts' })).toBeTruthy();
  });

  it('states what the product is', () => {
    render(<Home />);
    expect(screen.getByText('Direct human-to-human giving over Bitcoin Lightning.')).toBeTruthy();
  });

  it('notes that the product is coming soon', () => {
    render(<Home />);
    expect(screen.getByText('Coming soon')).toBeTruthy();
  });
});
