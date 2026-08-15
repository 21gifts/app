import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DonatePage from '@/app/donate/page';

vi.mock('@/components/DonateForm', () => ({
  DonateForm: () => <div>donate-form</div>,
}));

afterEach(cleanup);

describe('DonatePage', () => {
  it('renders the page heading and the donate form', () => {
    render(<DonatePage />);
    expect(screen.getByRole('heading', { name: 'Send a gift' })).toBeTruthy();
    expect(screen.getByText('donate-form')).toBeTruthy();
  });
});
