import type { TrustChain, TrustChainNode } from '@/lib/api-types';

/** Laid-out node width in CSS pixels. */
export const TRUST_NODE_WIDTH = 200;

/** Laid-out node height in CSS pixels. */
export const TRUST_NODE_HEIGHT = 72;

/** Vertical gap between BFS levels in CSS pixels. */
export const TRUST_LEVEL_GAP = 96;

/** Horizontal gap between nodes on the same level in CSS pixels. */
export const TRUST_NODE_GAP = 24;

/** Outer padding around the graph in CSS pixels. */
const PAD = 16;

/**
 * A Trust Chain node with BFS layout coordinates.
 */
export type LaidOutTrustNode = TrustChainNode & { x: number; y: number };

/**
 * Row width for `n` nodes (0 when the row is empty).
 *
 * @param n - Node count on the level.
 * @returns Pixel width of that row.
 */
function rowWidth(n: number): number {
  if (n === 0) {
    return 0;
  }
  return n * TRUST_NODE_WIDTH + (n - 1) * TRUST_NODE_GAP;
}

/**
 * Positions Trust Chain nodes in a forest BFS layout (no DOM).
 *
 * Roots (no incoming edge) share level 0 in `chain.nodes` order. Children follow
 * first appearance in `chain.edges`. Unvisited nodes (cycles with no root) sit
 * on an extra level in `chain.nodes` order so none are dropped.
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
  const levels: string[][] = [];
  let current = roots;
  while (current.length > 0) {
    levels.push(current);
    for (const id of current) {
      visited.add(id);
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

  const leftover = chain.nodes.filter((node) => !visited.has(node.id)).map((node) => node.id);
  if (leftover.length > 0) {
    levels.push(leftover);
  }

  const widths = levels.map((level) => rowWidth(level.length));
  const maxRowWidth = widths.reduce((max, width) => (width > max ? width : max), 0);
  const maxLevel = levels.length - 1;
  const byId = new Map(chain.nodes.map((node) => [node.id, node]));
  const positioned = new Map<string, LaidOutTrustNode>();

  for (let level = 0; level < levels.length; level += 1) {
    const ids = levels[level] ?? [];
    const startX = PAD + (maxRowWidth - (widths[level] ?? 0)) / 2;
    const y = PAD + level * (TRUST_NODE_HEIGHT + TRUST_LEVEL_GAP);
    ids.forEach((id, index) => {
      const node = byId.get(id);
      /* v8 ignore next -- levels are built from chain.nodes ids */
      if (node === undefined) {
        return;
      }
      positioned.set(id, {
        ...node,
        x: startX + index * (TRUST_NODE_WIDTH + TRUST_NODE_GAP),
        y,
      });
    });
  }

  const nodes: LaidOutTrustNode[] = [];
  for (const node of chain.nodes) {
    const laid = positioned.get(node.id);
    /* v8 ignore next -- leftover level places every unvisited node */
    if (laid === undefined) {
      continue;
    }
    nodes.push(laid);
  }

  return {
    nodes,
    edges: chain.edges,
    width: maxRowWidth === 0 ? 0 : maxRowWidth + PAD * 2,
    height: PAD * 2 + (maxLevel + 1) * TRUST_NODE_HEIGHT + maxLevel * TRUST_LEVEL_GAP,
  };
}
