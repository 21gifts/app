import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import LoginPage from '@/app/login/page';

vi.mock('@/components/LoginCard', () => ({
  LoginCard: () => <div data-testid="login-card" />,
}));

afterEach(cleanup);

describe('LoginPage', () => {
  it('renders the page heading', () => {
    render(<LoginPage />);
    expect(screen.getByRole('heading', { name: 'Log in to 21.gifts' })).toBeTruthy();
  });

  it('renders the login card', () => {
    render(<LoginPage />);
    expect(screen.getByTestId('login-card')).toBeTruthy();
  });
});
