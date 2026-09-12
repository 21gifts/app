import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TrustChainPage from '@/app/(marketing)/trust-chain/page';

vi.mock('@/app/(marketing)/trust-chain/trust-chain-loader', () => ({
  TrustChainLoader: () => <div>trust-chain-loader</div>,
}));

afterEach(cleanup);

describe('TrustChainPage', () => {
  it('renders the mocked loader', () => {
    render(<TrustChainPage />);
    expect(screen.getByText('trust-chain-loader')).toBeTruthy();
  });
});
