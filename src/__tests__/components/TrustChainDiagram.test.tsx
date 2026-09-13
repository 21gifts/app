import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrustChainDiagram } from '@/components/TrustChainDiagram';
import type { TrustChain } from '@/lib/api-types';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

const CHAIN: TrustChain = {
  nodes: [
    { id: 'f', name: 'Cyrill', role: 'founder' },
    { id: 'm', name: 'Severin', role: 'moderator' },
    { id: 'ada', name: 'Ada', role: 'verified' },
    { id: 'bob', name: null, role: 'verified' },
    { id: 'empty', name: '', role: 'verified' },
  ],
  edges: [
    { from: 'f', to: 'm', kind: 'moderator_appoint' },
    { from: 'm', to: 'ada', kind: 'verify' },
    { from: 'm', to: 'bob', kind: 'moderator_confirm' },
    { from: 'm', to: 'ghost', kind: 'verify' },
  ],
};

describe('TrustChainDiagram', () => {
  it('renders named nodes, unnamed fallback, test ids, member links, and edge labels', () => {
    renderWithLocale(<TrustChainDiagram chain={CHAIN} />);
    expect(screen.getByRole('img', { name: 'Trust Chain diagram' })).toBeTruthy();
    expect(screen.getByTestId('trust-node-f').getAttribute('href')).toBe('/members/f');
    expect(screen.getByTestId('trust-node-m').getAttribute('href')).toBe('/members/m');
    expect(screen.getByTestId('trust-node-ada').getAttribute('href')).toBe('/members/ada');
    expect(screen.getByTestId('trust-node-bob').getAttribute('href')).toBe('/members/bob');
    expect(screen.getByTestId('trust-node-empty').getAttribute('href')).toBe('/members/empty');
    expect(screen.getByRole('link', { name: /Cyrill/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Severin/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Ada/ })).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Unnamed/ })).toHaveLength(2);
    expect(screen.getByText('verified')).toBeTruthy();
    expect(screen.getByText('confirmed')).toBeTruthy();
    expect(screen.getByText('appointed')).toBeTruthy();
    expect(screen.queryByTestId('trust-node-ghost')).toBeNull();
  });

  it('calls onExpand on a plain click and skips it while that node is expanding', () => {
    const onExpand = vi.fn();
    renderWithLocale(<TrustChainDiagram chain={CHAIN} onExpand={onExpand} expandingId="f" />);
    fireEvent.click(screen.getByTestId('trust-node-f'));
    expect(onExpand).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('trust-node-m'));
    expect(onExpand).toHaveBeenCalledTimes(1);
    expect(onExpand).toHaveBeenCalledWith('m');
  });

  it('keeps the member link on a modifier click', () => {
    const onExpand = vi.fn();
    renderWithLocale(<TrustChainDiagram chain={CHAIN} onExpand={onExpand} />);
    fireEvent.click(screen.getByTestId('trust-node-f'), { metaKey: true });
    fireEvent.click(screen.getByTestId('trust-node-m'), { ctrlKey: true });
    fireEvent.click(screen.getByTestId('trust-node-ada'), { shiftKey: true });
    expect(onExpand).not.toHaveBeenCalled();
    expect(screen.getByTestId('trust-node-f').getAttribute('href')).toBe('/members/f');
  });

  it('draws a back-edge from a later block to an earlier one', () => {
    renderWithLocale(
      <TrustChainDiagram
        chain={{
          nodes: [
            { id: 'a', name: 'Ada', role: 'verified' },
            { id: 'b', name: 'Bob', role: 'verified' },
          ],
          edges: [
            { from: 'a', to: 'b', kind: 'verify' },
            { from: 'b', to: 'a', kind: 'verify' },
          ],
        }}
      />,
    );
    expect(screen.getByTestId('trust-node-a')).toBeTruthy();
    expect(screen.getByTestId('trust-node-b')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Trust Chain diagram' })).toBeTruthy();
  });

  it('renders a zero-length self-edge without throwing', () => {
    const hypot = vi.spyOn(Math, 'hypot').mockReturnValue(0);
    try {
      renderWithLocale(
        <TrustChainDiagram
          chain={{
            nodes: [{ id: 'loop', name: 'Loop', role: 'founder' }],
            edges: [{ from: 'loop', to: 'loop', kind: 'verify' }],
          }}
        />,
      );
      expect(screen.getByRole('img', { name: 'Trust Chain diagram' })).toBeTruthy();
    } finally {
      hypot.mockRestore();
    }
  });
});
