import { describe, expect, it } from 'vitest';
import type { TrustChain } from '@/lib/api-types';
import { layoutTrustChain, mergeTrustChain } from '@/lib/trust-chain';

const FOUNDER = { id: 'f', name: 'Cyrill', role: 'founder' as const };
const FOUNDER_SIBLING = { id: 'f2', name: 'Fran', role: 'founder' as const };
const MODERATOR = { id: 'm', name: 'Severin', role: 'moderator' as const };
const FOND = { id: 'fond', name: 'Fiona', role: 'fond' as const };
const SOFTWARE_DEVELOPER = { id: 's', name: 'Sam', role: 'software_developer' as const };
const INITIATOR = { id: 'i', name: 'Ivy', role: 'initiator' as const };
const ADA = { id: 'ada', name: 'Ada', role: 'verified' as const };
const BOB = { id: 'bob', name: 'Bob', role: 'verified' as const };

describe('mergeTrustChain', () => {
  it('appends new nodes and edges and skips duplicates', () => {
    const current: TrustChain = {
      nodes: [FOUNDER],
      edges: [],
    };
    const hop: TrustChain = {
      nodes: [FOUNDER, MODERATOR, ADA],
      edges: [
        { from: 'f', to: 'm', kind: 'moderator_appoint' },
        { from: 'f', to: 'm', kind: 'moderator_appoint' },
      ],
    };
    const merged = mergeTrustChain(current, hop);
    expect(merged.nodes.map((node) => node.id)).toEqual(['f', 'm', 'ada']);
    expect(merged.edges).toEqual([{ from: 'f', to: 'm', kind: 'moderator_appoint' }]);
  });
});

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
      width: 208,
      height: 104,
    });
  });

  it('places two roots in one row in nodes array order', () => {
    const a = { id: 'a', name: 'A', role: 'founder' as const };
    const b = { id: 'b', name: 'B', role: 'founder' as const };
    const laid = layoutTrustChain({ nodes: [a, b], edges: [] });
    expect(laid.nodes.map((node) => node.id)).toEqual(['a', 'b']);
    expect(laid.nodes[0]).toMatchObject({ x: 16, y: 16 });
    expect(laid.nodes[1]).toMatchObject({ x: 280, y: 16 });
    expect(laid.width).toBe(472);
    expect(laid.height).toBe(104);
  });

  it('stacks several people hanging off one person top to bottom', () => {
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
    expect(laid.nodes.find((node) => node.id === 'f')).toMatchObject({ x: 16, y: 16 });
    expect(laid.nodes.find((node) => node.id === 'm')).toMatchObject({ x: 280, y: 16 });
    expect(laid.nodes.find((node) => node.id === 'ada')).toMatchObject({ x: 544, y: 16 });
    expect(laid.nodes.find((node) => node.id === 'bob')).toMatchObject({ x: 544, y: 112 });
    expect(laid.width).toBe(736);
    expect(laid.height).toBe(200);
  });

  it('stacks a later moderator above an earlier verified sibling of the founder', () => {
    const edges: TrustChain['edges'] = [
      { from: 'f', to: 'ada', kind: 'verify' },
      { from: 'f', to: 'm', kind: 'verify' },
    ];
    const laid = layoutTrustChain({
      nodes: [FOUNDER, MODERATOR, ADA],
      edges,
    });
    expect(laid.edges).toBe(edges);
    expect(laid.nodes.find((node) => node.id === 'm')).toMatchObject({ x: 280, y: 16 });
    expect(laid.nodes.find((node) => node.id === 'ada')).toMatchObject({ x: 280, y: 112 });
  });

  it('does not throw on role initiator', () => {
    expect(() => layoutTrustChain({ nodes: [INITIATOR], edges: [] })).not.toThrow();
  });

  it('stacks a later initiator above an earlier verified sibling of the founder', () => {
    const edges: TrustChain['edges'] = [
      { from: 'f', to: 'ada', kind: 'verify' },
      { from: 'f', to: 'i', kind: 'verify' },
    ];
    const laid = layoutTrustChain({
      nodes: [FOUNDER, INITIATOR, ADA],
      edges,
    });
    expect(laid.edges).toBe(edges);
    expect(laid.nodes.find((node) => node.id === 'i')).toMatchObject({ x: 280, y: 16 });
    expect(laid.nodes.find((node) => node.id === 'ada')).toMatchObject({ x: 280, y: 112 });
  });

  it('stacks a software developer between initiator and moderator by role rank', () => {
    const founderSibling = { id: 'f2', name: 'Fabian', role: 'founder' as const };
    const edges: TrustChain['edges'] = [
      { from: 'f', to: 'ada', kind: 'verify' },
      { from: 'f', to: 'i', kind: 'moderator_appoint' },
      { from: 'f', to: 's', kind: 'moderator_appoint' },
      { from: 'f', to: 'm', kind: 'moderator_appoint' },
      { from: 'f', to: 'f2', kind: 'moderator_appoint' },
    ];
    const laid = layoutTrustChain({
      nodes: [FOUNDER, SOFTWARE_DEVELOPER, MODERATOR, INITIATOR, ADA, founderSibling],
      edges,
    });
    expect(laid.edges).toBe(edges);
    expect(laid.nodes.find((node) => node.id === 'f2')).toMatchObject({ x: 280, y: 16 });
    expect(laid.nodes.find((node) => node.id === 'i')).toMatchObject({ x: 280, y: 112 });
    expect(laid.nodes.find((node) => node.id === 's')).toMatchObject({ x: 280, y: 208 });
    expect(laid.nodes.find((node) => node.id === 'm')).toMatchObject({ x: 280, y: 304 });
    expect(laid.nodes.find((node) => node.id === 'ada')).toMatchObject({ x: 280, y: 400 });
  });

  it('stacks founder, initiator, fond, moderator, then verified by display rank', () => {
    const laid = layoutTrustChain({
      nodes: [FOUNDER, ADA, MODERATOR, FOND, INITIATOR],
      edges: [
        { from: 'f', to: 'ada', kind: 'verify' },
        { from: 'f', to: 'm', kind: 'moderator_appoint' },
        { from: 'f', to: 'fond', kind: 'moderator_appoint' },
        { from: 'f', to: 'i', kind: 'moderator_appoint' },
      ],
    });
    expect(laid.nodes.find((node) => node.id === 'i')).toMatchObject({ x: 280, y: 16 });
    expect(laid.nodes.find((node) => node.id === 'fond')).toMatchObject({ x: 280, y: 112 });
    expect(laid.nodes.find((node) => node.id === 'm')).toMatchObject({ x: 280, y: 208 });
    expect(laid.nodes.find((node) => node.id === 'ada')).toMatchObject({ x: 280, y: 304 });
  });

  it('stacks software developer above fond', () => {
    const laid = layoutTrustChain({
      nodes: [FOUNDER, ADA, MODERATOR, FOND, SOFTWARE_DEVELOPER, INITIATOR],
      edges: [
        { from: 'f', to: 'ada', kind: 'verify' },
        { from: 'f', to: 'm', kind: 'moderator_appoint' },
        { from: 'f', to: 'fond', kind: 'moderator_appoint' },
        { from: 'f', to: 's', kind: 'moderator_appoint' },
        { from: 'f', to: 'i', kind: 'moderator_appoint' },
      ],
    });
    expect(laid.nodes.find((node) => node.id === 'i')).toMatchObject({ x: 280, y: 16 });
    expect(laid.nodes.find((node) => node.id === 's')).toMatchObject({ x: 280, y: 112 });
    expect(laid.nodes.find((node) => node.id === 'fond')).toMatchObject({ x: 280, y: 208 });
    expect(laid.nodes.find((node) => node.id === 'm')).toMatchObject({ x: 280, y: 304 });
    expect(laid.nodes.find((node) => node.id === 'ada')).toMatchObject({ x: 280, y: 400 });
  });

  it('stacks an initiator above a moderator regardless of edge order', () => {
    const modFirst = layoutTrustChain({
      nodes: [FOUNDER, MODERATOR, INITIATOR],
      edges: [
        { from: 'f', to: 'm', kind: 'moderator_appoint' },
        { from: 'f', to: 'i', kind: 'moderator_appoint' },
      ],
    });
    expect(modFirst.nodes.find((node) => node.id === 'i')).toMatchObject({ x: 280, y: 16 });
    expect(modFirst.nodes.find((node) => node.id === 'm')).toMatchObject({ x: 280, y: 112 });

    const initFirst = layoutTrustChain({
      nodes: [FOUNDER, INITIATOR, MODERATOR],
      edges: [
        { from: 'f', to: 'i', kind: 'moderator_appoint' },
        { from: 'f', to: 'm', kind: 'moderator_appoint' },
      ],
    });
    expect(initFirst.nodes.find((node) => node.id === 'i')).toMatchObject({ x: 280, y: 16 });
    expect(initFirst.nodes.find((node) => node.id === 'm')).toMatchObject({ x: 280, y: 112 });
  });

  it('stacks siblings of every role by descending role rank regardless of edge order', () => {
    const nodes = [FOUNDER, ADA, MODERATOR, FOND, SOFTWARE_DEVELOPER, INITIATOR, FOUNDER_SIBLING];
    const expected = [FOUNDER_SIBLING, INITIATOR, SOFTWARE_DEVELOPER, FOND, MODERATOR, ADA];
    const edgeOrders = [
      [ADA, MODERATOR, FOND, SOFTWARE_DEVELOPER, INITIATOR, FOUNDER_SIBLING],
      [FOUNDER_SIBLING, INITIATOR, SOFTWARE_DEVELOPER, FOND, MODERATOR, ADA],
    ];
    for (const siblings of edgeOrders) {
      const laid = layoutTrustChain({
        nodes,
        edges: siblings.map((node) => ({ from: 'f', to: node.id, kind: 'verify' as const })),
      });
      expect(expected.map((node) => laid.nodes.find((row) => row.id === node.id)?.y)).toEqual([
        16, 112, 208, 304, 400, 496,
      ]);
    }
  });

  it('places a nested stack below the first child subtree, not in the same cell', () => {
    const carol = { id: 'carol', name: 'Carol', role: 'verified' as const };
    const dave = { id: 'dave', name: 'Dave', role: 'verified' as const };
    const laid = layoutTrustChain({
      nodes: [FOUNDER, ADA, BOB, carol, dave],
      edges: [
        { from: 'f', to: 'ada', kind: 'verify' },
        { from: 'f', to: 'bob', kind: 'verify' },
        { from: 'ada', to: 'carol', kind: 'verify' },
        { from: 'ada', to: 'dave', kind: 'verify' },
      ],
    });
    expect(laid.nodes.find((node) => node.id === 'ada')).toMatchObject({ x: 280, y: 16 });
    expect(laid.nodes.find((node) => node.id === 'carol')).toMatchObject({ x: 544, y: 16 });
    expect(laid.nodes.find((node) => node.id === 'dave')).toMatchObject({ x: 544, y: 112 });
    expect(laid.nodes.find((node) => node.id === 'bob')?.y).toBeGreaterThan(112);
  });

  it('does not recurse forever when stacked children verify each other', () => {
    const laid = layoutTrustChain({
      nodes: [FOUNDER, ADA, BOB],
      edges: [
        { from: 'f', to: 'ada', kind: 'verify' },
        { from: 'f', to: 'bob', kind: 'verify' },
        { from: 'ada', to: 'bob', kind: 'verify' },
        { from: 'bob', to: 'ada', kind: 'verify' },
      ],
    });
    expect(laid.nodes).toHaveLength(3);
    expect(laid.nodes.find((node) => node.id === 'ada')).toMatchObject({ x: 280, y: 16 });
    expect(laid.nodes.find((node) => node.id === 'bob')).toMatchObject({ x: 280, y: 112 });
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
    expect(laid.nodes[1]).toMatchObject({ id: 'b', x: 280, y: 16 });
  });

  it('ignores an edge to an unknown id', () => {
    const edges: TrustChain['edges'] = [{ from: 'f', to: 'ghost', kind: 'verify' }];
    const laid = layoutTrustChain({ nodes: [FOUNDER], edges });
    expect(laid.nodes).toEqual([{ ...FOUNDER, x: 16, y: 16 }]);
    expect(laid.edges).toBe(edges);
    expect(laid.width).toBe(208);
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
    expect(laid.nodes.find((node) => node.id === 'm')).toMatchObject({ x: 280, y: 16 });
    expect(laid.width).toBe(472);
    expect(laid.height).toBe(104);
  });
});
