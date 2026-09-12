import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrustChainScreen } from '@/components/TrustChainScreen';
import type { TrustChain } from '@/lib/api-types';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

const EMPTY: TrustChain = { nodes: [], edges: [] };

const POPULATED: TrustChain = {
  nodes: [
    { id: 'f', name: 'Cyrill', role: 'founder' },
    { id: 'm', name: 'Severin', role: 'moderator' },
  ],
  edges: [{ from: 'f', to: 'm', kind: 'moderator_appoint' }],
};

const EXPLAIN_FOUNDER = 'A founder started 21.gifts and sits at the root of the chain.';

describe('TrustChainScreen', () => {
  it('shows loading copy and the role explanation', () => {
    const { container } = renderWithLocale(
      <TrustChainScreen chain={null} error={null} loading={true} onRetry={() => undefined} />,
    );
    expect(screen.getByRole('heading', { name: 'Trust Chain' })).toBeTruthy();
    expect(screen.getByText('Loading…')).toBeTruthy();
    expect(screen.getByText(EXPLAIN_FOUNDER)).toBeTruthy();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('shows an error string and retries', () => {
    const onRetry = vi.fn();
    renderWithLocale(
      <TrustChainScreen
        chain={null}
        error="Could not load the Trust Chain."
        loading={false}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByText('Could not load the Trust Chain.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText(EXPLAIN_FOUNDER)).toBeTruthy();
  });

  it('shows empty copy and no svg when the chain has no nodes', () => {
    const { container } = renderWithLocale(
      <TrustChainScreen chain={EMPTY} error={null} loading={false} onRetry={() => undefined} />,
    );
    expect(screen.getByText('No one is on the Trust Chain yet.')).toBeTruthy();
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByText(EXPLAIN_FOUNDER)).toBeTruthy();
  });

  it('shows empty copy when the chain is null and not loading', () => {
    const { container } = renderWithLocale(
      <TrustChainScreen chain={null} error={null} loading={false} onRetry={() => undefined} />,
    );
    expect(screen.getByText('No one is on the Trust Chain yet.')).toBeTruthy();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('mounts named nodes when the chain is populated', () => {
    renderWithLocale(
      <TrustChainScreen chain={POPULATED} error={null} loading={false} onRetry={() => undefined} />,
    );
    expect(screen.getByTestId('trust-node-f')).toBeTruthy();
    expect(screen.getByTestId('trust-node-m')).toBeTruthy();
    expect(screen.getByText(EXPLAIN_FOUNDER)).toBeTruthy();
    expect(screen.getByText(/Who met whom in real life/)).toBeTruthy();
  });
});
