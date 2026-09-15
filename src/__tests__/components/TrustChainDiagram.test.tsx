import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrustChainDiagram } from '@/components/TrustChainDiagram';
import type { TrustChain } from '@/lib/api-types';
import { renderWithLocale } from '@/__tests__/render-with-locale';

if (typeof globalThis.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  globalThis.PointerEvent = PointerEventPolyfill as unknown as typeof PointerEvent;
}

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
    expect(screen.getByRole('group', { name: 'Trust Chain diagram' })).toBeTruthy();
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

  it('moves a node on pointer drag and does not expand after a drag', () => {
    const onExpand = vi.fn();
    renderWithLocale(<TrustChainDiagram chain={CHAIN} onExpand={onExpand} />);
    const node = screen.getByTestId('trust-node-f');
    const rect = node.querySelector('rect');
    expect(rect).toBeTruthy();
    const startX = Number(rect?.getAttribute('x'));
    fireEvent.pointerDown(node, { pointerId: 1, clientX: 40, clientY: 20 });
    fireEvent.pointerMove(node, { pointerId: 1, clientX: 80, clientY: 50 });
    fireEvent.pointerUp(node, { pointerId: 1, clientX: 80, clientY: 50 });
    fireEvent.click(node);
    expect(Number(node.querySelector('rect')?.getAttribute('x'))).toBe(startX + 40);
    expect(onExpand).not.toHaveBeenCalled();
  });

  it('clears a cancelled drag so a later click can still expand', () => {
    const onExpand = vi.fn();
    renderWithLocale(<TrustChainDiagram chain={CHAIN} onExpand={onExpand} />);
    const node = screen.getByTestId('trust-node-f');
    fireEvent.pointerDown(node, { pointerId: 1, clientX: 40, clientY: 20 });
    fireEvent.pointerMove(node, { pointerId: 1, clientX: 80, clientY: 50 });
    fireEvent.pointerCancel(node, { pointerId: 1, clientX: 80, clientY: 50 });
    fireEvent.click(node);
    expect(onExpand).toHaveBeenCalledWith('f');
  });

  it('still expands on a click that did not move past the drag threshold', () => {
    const onExpand = vi.fn();
    renderWithLocale(<TrustChainDiagram chain={CHAIN} onExpand={onExpand} />);
    const node = screen.getByTestId('trust-node-m');
    fireEvent.pointerDown(node, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(node, { pointerId: 1, clientX: 12, clientY: 11 });
    fireEvent.pointerUp(node, { pointerId: 1, clientX: 12, clientY: 11 });
    fireEvent.click(node);
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

  it('does not start a drag on a modifier pointer down', () => {
    renderWithLocale(<TrustChainDiagram chain={CHAIN} />);
    const node = screen.getByTestId('trust-node-f');
    const capture = vi.fn();
    node.setPointerCapture = capture;
    fireEvent.pointerDown(node, { pointerId: 1, clientX: 10, clientY: 10, metaKey: true });
    fireEvent.pointerDown(node, { pointerId: 1, clientX: 10, clientY: 10, ctrlKey: true });
    fireEvent.pointerDown(node, { pointerId: 1, clientX: 10, clientY: 10, shiftKey: true });
    expect(capture).not.toHaveBeenCalled();
  });

  it('captures the pointer when setPointerCapture exists', () => {
    renderWithLocale(<TrustChainDiagram chain={CHAIN} />);
    const node = screen.getByTestId('trust-node-f');
    const capture = vi.fn();
    node.setPointerCapture = capture;
    fireEvent.pointerDown(node, { pointerId: 3, clientX: 10, clientY: 10 });
    expect(capture).toHaveBeenCalledWith(3);
  });

  it('ignores pointer move from a different pointer than the drag', () => {
    renderWithLocale(<TrustChainDiagram chain={CHAIN} />);
    const node = screen.getByTestId('trust-node-f');
    const startX = Number(node.querySelector('rect')?.getAttribute('x'));
    fireEvent.pointerDown(node, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(node, { pointerId: 2, clientX: 80, clientY: 50 });
    expect(Number(node.querySelector('rect')?.getAttribute('x'))).toBe(startX);
  });

  it('ignores pointer up from a different pointer than the drag', () => {
    renderWithLocale(<TrustChainDiagram chain={CHAIN} />);
    const node = screen.getByTestId('trust-node-f');
    const release = vi.fn();
    node.hasPointerCapture = (): boolean => true;
    node.releasePointerCapture = release;
    fireEvent.pointerDown(node, { pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(node, { pointerId: 2, clientX: 10, clientY: 10 });
    expect(release).not.toHaveBeenCalled();
  });

  it('releases pointer capture on pointer up after a drag start', () => {
    renderWithLocale(<TrustChainDiagram chain={CHAIN} />);
    const node = screen.getByTestId('trust-node-f');
    const release = vi.fn();
    node.hasPointerCapture = (): boolean => true;
    node.releasePointerCapture = release;
    fireEvent.pointerDown(node, { pointerId: 7, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(node, { pointerId: 7, clientX: 10, clientY: 10 });
    expect(release).toHaveBeenCalledWith(7);
  });

  it('draws an arc when a same-row edge skips at least one person', () => {
    renderWithLocale(
      <TrustChainDiagram
        chain={{
          nodes: [
            { id: 'a', name: 'Ada', role: 'verified' },
            { id: 'mid', name: 'Mid', role: 'verified' },
            { id: 'c', name: 'Carol', role: 'verified' },
          ],
          edges: [
            { from: 'a', to: 'c', kind: 'verify' }, // hops = 2, skips mid
            { from: 'mid', to: 'a', kind: 'verify' }, // incoming on a
            { from: 'c', to: 'mid', kind: 'verify' }, // incoming on mid; a→c already incoming on c
          ],
        }}
      />,
    );
    expect(document.querySelector('svg path')).toBeTruthy();
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
    expect(screen.getByRole('group', { name: 'Trust Chain diagram' })).toBeTruthy();
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
      expect(screen.getByRole('group', { name: 'Trust Chain diagram' })).toBeTruthy();
    } finally {
      hypot.mockRestore();
    }
  });
});
