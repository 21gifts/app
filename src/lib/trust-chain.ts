import type { TrustChain, TrustChainNode } from '@/lib/api-types';

/** Laid-out node width in CSS pixels. */
export const TRUST_NODE_WIDTH = 176;

/** Laid-out node height in CSS pixels. */
export const TRUST_NODE_HEIGHT = 72;

/** Horizontal gap between consecutive chain blocks in CSS pixels. */
export const TRUST_NODE_GAP = 88;

/**
 * Extra lift in CSS pixels for an edge that skips one block; each further
 * skipped block adds 16px.
 */
export const TRUST_CHAIN_ARC_LIFT = 56;

/** Outer padding around the graph in CSS pixels. */
const PAD = 16;

/**
 * A Trust Chain node with chain-layout coordinates.
 */
export type LaidOutTrustNode = TrustChainNode & { x: number; y: number };

/**
 * Row width for `n` blocks (0 when the chain is empty).
 *
 * @param n - Node count.
 * @returns Pixel width of that row.
 */
function chainWidth(n: number): number {
  /* v8 ignore next 3 — empty graph returns before chainWidth; order always has nodes */
  if (n === 0) {
    return 0;
  }
  return n * TRUST_NODE_WIDTH + (n - 1) * TRUST_NODE_GAP;
}

/**
 * Positions Trust Chain nodes in one horizontal row (no DOM).
 *
 * Visit order is BFS from roots (no incoming edge) in `chain.nodes` order,
 * then leftover unvisited nodes (cycles with no root). Every node shares the
 * same `y`; `x` increases left to right. Never stacked as a pyramid of levels.
 *
 * @param chain - Nodes and directed edges from `GET /trust-chain`.
 * @returns Laid-out nodes, the input edges unchanged, and bounding width/height.
 */
export function layoutTrustChain(chain: TrustChain): {
  nodes: LaidOutTrustNode[];
  edges: TrustChain['edges'];
  width: number;
  height: number;
} {
  if (chain.nodes.length === 0) {
    return { nodes: [], edges: chain.edges, width: 0, height: 0 };
  }

  const known = new Set(chain.nodes.map((node) => node.id));
  const children = new Map<string, string[]>();
  const incoming = new Set<string>();
  for (const edge of chain.edges) {
    if (!known.has(edge.from) || !known.has(edge.to)) {
      continue;
    }
    const list = children.get(edge.from) ?? [];
    if (!list.includes(edge.to)) {
      list.push(edge.to);
      children.set(edge.from, list);
    }
    incoming.add(edge.to);
  }

  const roots = chain.nodes.filter((node) => !incoming.has(node.id)).map((node) => node.id);
  const visited = new Set<string>();
  const order: string[] = [];
  let current = roots;
  while (current.length > 0) {
    for (const id of current) {
      visited.add(id);
      order.push(id);
    }
    const next: string[] = [];
    const queued = new Set<string>();
    for (const id of current) {
      for (const child of children.get(id) ?? []) {
        if (!visited.has(child) && !queued.has(child)) {
          queued.add(child);
          next.push(child);
        }
      }
    }
    current = next;
  }

  for (const node of chain.nodes) {
    if (!visited.has(node.id)) {
      order.push(node.id);
    }
  }

  const indexOf = new Map(order.map((id, index) => [id, index]));
  let maxHops = 1;
  for (const edge of chain.edges) {
    const fromIndex = indexOf.get(edge.from);
    const toIndex = indexOf.get(edge.to);
    if (fromIndex === undefined || toIndex === undefined) {
      continue;
    }
    const hops = Math.abs(toIndex - fromIndex);
    if (hops > maxHops) {
      maxHops = hops;
    }
  }
  const extraTop = maxHops > 1 ? TRUST_CHAIN_ARC_LIFT + (maxHops - 2) * 16 : 0;
  const y = PAD + extraTop;
  const byId = new Map(chain.nodes.map((node) => [node.id, node]));
  const positioned = new Map<string, LaidOutTrustNode>();

  order.forEach((id, index) => {
    const node = byId.get(id);
    /* v8 ignore next 3 -- order is built from chain.nodes ids */
    if (node === undefined) {
      return;
    }
    positioned.set(id, {
      ...node,
      x: PAD + index * (TRUST_NODE_WIDTH + TRUST_NODE_GAP),
      y,
    });
  });

  const nodes: LaidOutTrustNode[] = [];
  for (const node of chain.nodes) {
    const laid = positioned.get(node.id);
    /* v8 ignore next 3 -- leftover append places every unvisited node */
    if (laid === undefined) {
      continue;
    }
    nodes.push(laid);
  }

  return {
    nodes,
    edges: chain.edges,
    width: chainWidth(order.length) + PAD * 2,
    height: extraTop + TRUST_NODE_HEIGHT + PAD * 2,
  };
}
