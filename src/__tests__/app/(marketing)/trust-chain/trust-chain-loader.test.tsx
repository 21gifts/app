import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrustChainLoader } from '@/app/(marketing)/trust-chain/trust-chain-loader';
import type { TrustChain } from '@/lib/api-types';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const EMPTY: TrustChain = { nodes: [], edges: [] };

const POPULATED: TrustChain = {
  nodes: [{ id: 'f', name: 'Cyrill', role: 'founder' }],
  edges: [],
};

vi.mock('@/lib/api', () => ({
  fetchTrustChain: vi.fn(),
}));

import { fetchTrustChain } from '@/lib/api';

const fetchMock = vi.mocked(fetchTrustChain);

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

describe('TrustChainLoader', () => {
  it('renders a populated chain', async () => {
    fetchMock.mockResolvedValue(POPULATED);
    renderWithLocale(<TrustChainLoader />);
    await waitFor(() => {
      expect(screen.getByTestId('trust-node-f')).toBeTruthy();
    });
  });

  it('renders loaded empty copy', async () => {
    fetchMock.mockResolvedValue(EMPTY);
    renderWithLocale(<TrustChainLoader />);
    await waitFor(() => {
      expect(screen.getByText('No one is on the Trust Chain yet.')).toBeTruthy();
    });
  });

  it('shows a fetch error and retries', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Could not load the Trust Chain. Please try again.'));
    fetchMock.mockResolvedValueOnce(EMPTY);
    renderWithLocale(<TrustChainLoader />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(screen.getByText('No one is on the Trust Chain yet.')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses the fallback error copy for a non-Error rejection', async () => {
    fetchMock.mockRejectedValueOnce('nope');
    renderWithLocale(<TrustChainLoader />);
    await waitFor(() => {
      expect(screen.getByText('Could not load the Trust Chain. Please try again.')).toBeTruthy();
    });
  });

  it('ignores a stale fetch after unmount', async () => {
    let resolveStale: ((value: TrustChain) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStale = resolve;
        }),
    );
    const view = renderWithLocale(<TrustChainLoader />);
    view.unmount();
    resolveStale?.(EMPTY);
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalled();
  });

  it('ignores a stale rejection after unmount', async () => {
    let rejectStale: ((reason: Error) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectStale = reject;
        }),
    );
    const view = renderWithLocale(<TrustChainLoader />);
    view.unmount();
    rejectStale?.(new Error('gone'));
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalled();
  });
});
