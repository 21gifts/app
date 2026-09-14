import type { TrustChain, TrustChainEdge, TrustChainNode } from '@/lib/api-types';

/** Laid-out node width in CSS pixels. */
export const TRUST_NODE_WIDTH = 176;

/** Laid-out node height in CSS pixels. */
export const TRUST_NODE_HEIGHT = 72;

/** Horizontal gap between consecutive chain blocks in CSS pixels. */
export const TRUST_NODE_GAP = 88;

/** Vertical gap when several people hang off one person (stacked, not a row). */
export const TRUST_NODE_VGAP = 24;

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
 * Merge two Trust Chain payloads without duplicating nodes or edges.
 *
 * Used when a click loads one hop around a person into the already visible
 * chain.
 *
 * @param current - Already displayed graph.
 * @param incoming - Neighborhood from `GET /trust-chain?around=`.
 * @returns Combined graph; `current.nodes` order is kept, then new nodes.
 */
export function mergeTrustChain(current: TrustChain, incoming: TrustChain): TrustChain {
  const nodes = [...current.nodes];
  const nodeIds = new Set(nodes.map((node) => node.id));
  for (const node of incoming.nodes) {
    if (!nodeIds.has(node.id)) {
      nodes.push(node);
      nodeIds.add(node.id);
    }
  }
  const edges = [...current.edges];
  const edgeKeys = new Set(edges.map(edgeKey));
  for (const edge of incoming.edges) {
    const key = edgeKey(edge);
    if (!edgeKeys.has(key)) {
      edges.push(edge);
      edgeKeys.add(key);
    }
  }
  return { nodes, edges };
}

/**
 * Stable identity of a directed public edge.
 *
 * @param edge - Public graph edge.
 * @returns `from:to:kind`.
 */
function edgeKey(edge: TrustChainEdge): string {
  return `${edge.from}:${edge.to}:${edge.kind}`;
}

/**
 * Positions Trust Chain nodes (no DOM).
 *
 * Roots sit in one row. A person with a single next person sits to their
 * right. Several people hanging off one person (typical: everyone Severin
 * verified) stack top to bottom, not side by side.
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
  const byId = new Map(chain.nodes.map((node) => [node.id, node]));
  const positioned = new Map<string, LaidOutTrustNode>();

  function place(id: string, x: number, y: number): void {
    const node = byId.get(id);
    /* v8 ignore next 3 -- callers only pass ids from chain.nodes */
    if (node === undefined || positioned.has(id)) {
      return;
    }
    positioned.set(id, { ...node, x, y });
  }

  function subtreeBottom(id: string): number {
    const node = positioned.get(id);
    /* v8 ignore next 3 -- called after place */
    if (node === undefined) {
      return PAD;
    }
    let bottom = node.y + TRUST_NODE_HEIGHT;
    for (const kid of children.get(id) ?? []) {
      if (positioned.has(kid)) {
        bottom = Math.max(bottom, subtreeBottom(kid));
      }
    }
    return bottom;
  }

  function layoutChildren(id: string): void {
    const parent = positioned.get(id);
    /* v8 ignore next 3 -- layoutChildren runs after place */
    if (parent === undefined) {
      return;
    }
    const kids = (children.get(id) ?? []).filter((child) => !positioned.has(child));
    if (kids.length === 0) {
      return;
    }
    const childX = parent.x + TRUST_NODE_WIDTH + TRUST_NODE_GAP;
    const only = kids[0];
    if (kids.length === 1 && only !== undefined) {
      place(only, childX, parent.y);
      layoutChildren(only);
      return;
    }
    let childY = parent.y;
    for (const kid of kids) {
      place(kid, childX, childY);
      layoutChildren(kid);
      childY = subtreeBottom(kid) + TRUST_NODE_VGAP;
    }
  }

  let rootX = PAD;
  for (const id of roots) {
    /* v8 ignore next 3 -- a root has no incoming edge, so an earlier root cannot have placed it */
    if (positioned.has(id)) {
      continue;
    }
    place(id, rootX, PAD);
    layoutChildren(id);
    const subtree = [...positioned.values()];
    const maxX = Math.max(...subtree.map((node) => node.x + TRUST_NODE_WIDTH));
    rootX = maxX + TRUST_NODE_GAP;
  }

  for (const node of chain.nodes) {
    if (!positioned.has(node.id)) {
      place(node.id, rootX, PAD);
      rootX += TRUST_NODE_WIDTH + TRUST_NODE_GAP;
    }
  }

  const nodes: LaidOutTrustNode[] = [];
  let maxX = 0;
  let maxY = 0;
  for (const node of chain.nodes) {
    const laid = positioned.get(node.id);
    /* v8 ignore next 3 -- leftover append places every remaining node */
    if (laid === undefined) {
      continue;
    }
    nodes.push(laid);
    maxX = Math.max(maxX, laid.x + TRUST_NODE_WIDTH);
    maxY = Math.max(maxY, laid.y + TRUST_NODE_HEIGHT);
  }

  return {
    nodes,
    edges: chain.edges,
    width: maxX + PAD,
    height: maxY + PAD,
  };
}
