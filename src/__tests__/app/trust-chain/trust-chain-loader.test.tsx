import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrustChainLoader } from '@/app/trust-chain/trust-chain-loader';
import type { TrustChain } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const EMPTY: TrustChain = { nodes: [], edges: [] };

const POPULATED: TrustChain = {
  nodes: [{ id: 'f', name: 'Cyrill', role: 'founder' }],
  edges: [],
};

const HOP: TrustChain = {
  nodes: [
    { id: 'f', name: 'Cyrill', role: 'founder' },
    { id: 'm', name: 'Severin', role: 'moderator' },
  ],
  edges: [{ from: 'f', to: 'm', kind: 'moderator_appoint' }],
};

vi.mock('@/lib/api', () => ({
  fetchTrustChain: vi.fn(),
}));

import { fetchTrustChain } from '@/lib/api';

const fetchMock = vi.mocked(fetchTrustChain);

beforeEach(() => {
  useAuthStore.setState({ session: 'tok', account: null });
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
  useAuthStore.setState({ session: null, account: null });
});

describe('TrustChainLoader', () => {
  it('renders nothing without a session', () => {
    useAuthStore.setState({ session: null, account: null });
    const { container } = renderWithLocale(<TrustChainLoader />);
    expect(container.firstChild).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders a populated chain', async () => {
    fetchMock.mockResolvedValue(POPULATED);
    renderWithLocale(<TrustChainLoader />);
    await waitFor(() => {
      expect(screen.getByTestId('trust-node-f')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledWith('tok');
  });

  it('renders loaded empty copy', async () => {
    fetchMock.mockResolvedValue(EMPTY);
    renderWithLocale(<TrustChainLoader />);
    await waitFor(() => {
      expect(screen.getByText('No one is on the Trust Chain yet.')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenCalledWith('tok');
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
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'tok');
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'tok');
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
    expect(fetchMock).toHaveBeenCalledWith('tok');
  });

  it('loads one hop when a node is clicked', async () => {
    fetchMock.mockResolvedValueOnce(POPULATED);
    fetchMock.mockResolvedValueOnce(HOP);
    renderWithLocale(<TrustChainLoader />);
    await waitFor(() => {
      expect(screen.getByTestId('trust-node-f')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('trust-node-f'));
    await waitFor(() => {
      expect(screen.getByTestId('trust-node-m')).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenLastCalledWith('tok', 'f');
  });

  it('shows the load error when a hop fails', async () => {
    fetchMock.mockResolvedValueOnce(POPULATED);
    fetchMock.mockRejectedValueOnce(new Error('Could not load the Trust Chain. Please try again.'));
    renderWithLocale(<TrustChainLoader />);
    await waitFor(() => {
      expect(screen.getByTestId('trust-node-f')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('trust-node-f'));
    await waitFor(() => {
      expect(screen.getByText('Could not load the Trust Chain. Please try again.')).toBeTruthy();
    });
    expect(screen.getByTestId('trust-node-f')).toBeTruthy();
    fetchMock.mockResolvedValueOnce(HOP);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith('tok', 'f');
    });
    expect(screen.queryByText('Could not load the Trust Chain. Please try again.')).toBeNull();
    expect(screen.getByTestId('trust-node-f')).toBeTruthy();
  });

  it('keeps Try again when a hop retry also fails', async () => {
    fetchMock.mockResolvedValueOnce(POPULATED);
    fetchMock.mockRejectedValueOnce(new Error('Could not load the Trust Chain. Please try again.'));
    fetchMock.mockRejectedValueOnce(new Error('Could not load the Trust Chain. Please try again.'));
    renderWithLocale(<TrustChainLoader />);
    await waitFor(() => {
      expect(screen.getByTestId('trust-node-f')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('trust-node-f'));
    await waitFor(() => {
      expect(screen.getByText('Could not load the Trust Chain. Please try again.')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
    expect(screen.getByText('Could not load the Trust Chain. Please try again.')).toBeTruthy();
  });

  it('disables Try again while a hop is already in flight', async () => {
    fetchMock.mockResolvedValueOnce(POPULATED);
    fetchMock.mockRejectedValueOnce(new Error('Could not load the Trust Chain. Please try again.'));
    fetchMock.mockImplementationOnce(() => new Promise(() => undefined));
    renderWithLocale(<TrustChainLoader />);
    await waitFor(() => {
      expect(screen.getByTestId('trust-node-f')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('trust-node-f'));
    await waitFor(() => {
      expect(screen.getByText('Could not load the Trust Chain. Please try again.')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('trust-node-f'));
    await waitFor(() => {
      expect(
        (screen.getByRole('button', { name: 'Try again' }) as HTMLButtonElement).disabled,
      ).toBe(true);
    });
  });

  it('clears the hop error after a later hop succeeds', async () => {
    fetchMock.mockResolvedValueOnce(POPULATED);
    fetchMock.mockRejectedValueOnce(new Error('Could not load the Trust Chain. Please try again.'));
    fetchMock.mockResolvedValueOnce(HOP);
    renderWithLocale(<TrustChainLoader />);
    await waitFor(() => {
      expect(screen.getByTestId('trust-node-f')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('trust-node-f'));
    await waitFor(() => {
      expect(screen.getByText('Could not load the Trust Chain. Please try again.')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('trust-node-f'));
    await waitFor(() => {
      expect(screen.getByTestId('trust-node-m')).toBeTruthy();
    });
    expect(screen.queryByText('Could not load the Trust Chain. Please try again.')).toBeNull();
  });

  it('ignores a second click while a hop is in flight', async () => {
    fetchMock.mockResolvedValueOnce(POPULATED);
    let resolveHop: ((value: TrustChain) => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveHop = resolve;
        }),
    );
    renderWithLocale(<TrustChainLoader />);
    await waitFor(() => {
      expect(screen.getByTestId('trust-node-f')).toBeTruthy();
    });
    fireEvent.click(screen.getByTestId('trust-node-f'));
    await waitFor(() => {
      expect(screen.getByTestId('trust-node-f').getAttribute('aria-busy')).toBe('true');
    });
    fireEvent.click(screen.getByTestId('trust-node-f'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    resolveHop?.(HOP);
    await waitFor(() => {
      expect(screen.getByTestId('trust-node-m')).toBeTruthy();
    });
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
    expect(fetchMock).toHaveBeenCalledWith('tok');
  });
});
