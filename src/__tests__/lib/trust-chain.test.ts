import { describe, expect, it } from 'vitest';
import type { TrustChain } from '@/lib/api-types';
import { layoutTrustChain } from '@/lib/trust-chain';

const FOUNDER = { id: 'f', name: 'Cyrill', role: 'founder' as const };
const MODERATOR = { id: 'm', name: 'Severin', role: 'moderator' as const };
const ADA = { id: 'ada', name: 'Ada', role: 'verified' as const };
const BOB = { id: 'bob', name: 'Bob', role: 'verified' as const };

describe('layoutTrustChain', () => {
  it('returns zero size for an empty graph and keeps the input edges array', () => {
    const edges: TrustChain['edges'] = [];
    const laid = layoutTrustChain({ nodes: [], edges });
    expect(laid).toEqual({ nodes: [], edges, width: 0, height: 0 });
    expect(laid.edges).toBe(edges);
  });

  it('places one founder with no edges at the padding origin', () => {
    expect(layoutTrustChain({ nodes: [FOUNDER], edges: [] })).toEqual({
      nodes: [{ ...FOUNDER, x: 16, y: 16 }],
      edges: [],
      width: 232,
      height: 104,
    });
  });

  it('places two roots on level 0 in nodes array order', () => {
    const a = { id: 'a', name: 'A', role: 'founder' as const };
    const b = { id: 'b', name: 'B', role: 'founder' as const };
    const laid = layoutTrustChain({ nodes: [a, b], edges: [] });
    expect(laid.nodes.map((node) => node.id)).toEqual(['a', 'b']);
    expect(laid.nodes[0]).toMatchObject({ x: 16, y: 16 });
    expect(laid.nodes[1]).toMatchObject({ x: 240, y: 16 });
    expect(laid.width).toBe(456);
    expect(laid.height).toBe(104);
  });

  it('centers a shorter top row above two verify children', () => {
    const edges: TrustChain['edges'] = [
      { from: 'f', to: 'm', kind: 'moderator_appoint' },
      { from: 'm', to: 'ada', kind: 'verify' },
      { from: 'm', to: 'bob', kind: 'verify' },
    ];
    const laid = layoutTrustChain({
      nodes: [FOUNDER, MODERATOR, ADA, BOB],
      edges,
    });
    expect(laid.edges).toBe(edges);
    expect(laid.nodes.find((node) => node.id === 'f')).toMatchObject({ x: 128, y: 16 });
    expect(laid.nodes.find((node) => node.id === 'm')).toMatchObject({ x: 128, y: 184 });
    expect(laid.nodes.find((node) => node.id === 'ada')).toMatchObject({ x: 16, y: 352 });
    expect(laid.nodes.find((node) => node.id === 'bob')).toMatchObject({ x: 240, y: 352 });
    expect(laid.width).toBe(456);
    expect(laid.height).toBe(440);
  });

  it('still places both nodes of a leftover cycle with no root', () => {
    const a = { id: 'a', name: 'A', role: 'verified' as const };
    const b = { id: 'b', name: 'B', role: 'verified' as const };
    const laid = layoutTrustChain({
      nodes: [a, b],
      edges: [
        { from: 'a', to: 'b', kind: 'verify' },
        { from: 'b', to: 'a', kind: 'verify' },
      ],
    });
    expect(laid.nodes).toHaveLength(2);
    expect(laid.nodes[0]).toMatchObject({ id: 'a', x: 16, y: 16 });
    expect(laid.nodes[1]).toMatchObject({ id: 'b', x: 240, y: 16 });
  });

  it('ignores an edge to an unknown id', () => {
    const edges: TrustChain['edges'] = [{ from: 'f', to: 'ghost', kind: 'verify' }];
    const laid = layoutTrustChain({ nodes: [FOUNDER], edges });
    expect(laid.nodes).toEqual([{ ...FOUNDER, x: 16, y: 16 }]);
    expect(laid.edges).toBe(edges);
    expect(laid.width).toBe(232);
    expect(laid.height).toBe(104);
  });

  it('ignores an edge from an unknown id', () => {
    const edges: TrustChain['edges'] = [{ from: 'ghost', to: 'f', kind: 'verify' }];
    const laid = layoutTrustChain({ nodes: [FOUNDER], edges });
    expect(laid.nodes).toEqual([{ ...FOUNDER, x: 16, y: 16 }]);
    expect(laid.edges).toBe(edges);
  });

  it('does not queue the same child twice when two edges share from and to', () => {
    const laid = layoutTrustChain({
      nodes: [FOUNDER, MODERATOR],
      edges: [
        { from: 'f', to: 'm', kind: 'moderator_appoint' },
        { from: 'f', to: 'm', kind: 'verify' },
      ],
    });
    expect(laid.nodes.find((node) => node.id === 'f')).toMatchObject({ x: 16, y: 16 });
    expect(laid.nodes.find((node) => node.id === 'm')).toMatchObject({ x: 16, y: 184 });
    expect(laid.width).toBe(232);
    expect(laid.height).toBe(272);
  });
});
