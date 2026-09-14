'use client';

import { useEffect, useRef, useState, type PointerEvent, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import type { TrustChain, TrustChainEdge, TrustChainNode } from '@/lib/api-types';
import type { MessageKey } from '@/lib/messages';
import {
  layoutTrustChain,
  TRUST_CHAIN_ARC_LIFT,
  TRUST_NODE_GAP,
  TRUST_NODE_HEIGHT,
  TRUST_NODE_WIDTH,
  type LaidOutTrustNode,
} from '@/lib/trust-chain';

/** Pointer travel in CSS pixels before a press counts as a drag, not a click. */
const DRAG_THRESHOLD = 6;

type NodePos = { x: number; y: number };

/**
 * Catalog key for a Trust Chain node role pill.
 *
 * @param role - Node role from `GET /trust-chain`.
 * @returns The matching `forum.role.*` message key.
 */
function roleMessageKey(role: TrustChainNode['role']): MessageKey {
  if (role === 'founder') {
    return 'forum.role.founder';
  }
  if (role === 'moderator') {
    return 'forum.role.moderator';
  }
  return 'forum.role.verified';
}

/**
 * Catalog key for an edge midpoint label.
 *
 * @param kind - Directed edge kind.
 * @returns The matching `trustChain.edge.*` message key.
 */
function edgeMessageKey(kind: TrustChainEdge['kind']): MessageKey {
  if (kind === 'verify') {
    return 'trustChain.edge.verify';
  }
  if (kind === 'moderator_confirm') {
    return 'trustChain.edge.confirm';
  }
  return 'trustChain.edge.appoint';
}

/**
 * SVG polygon points for an arrowhead at `(x2, y2)` aiming from `(x1, y1)`.
 *
 * @param x1 - Actor (tail) x.
 * @param y1 - Actor (tail) y.
 * @param x2 - Subject (tip) x.
 * @param y2 - Subject (tip) y.
 * @returns Space-separated `x,y` triples.
 */
function arrowHeadPoints(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const size = 8;
  const baseX = x2 - ux * size;
  const baseY = y2 - uy * size;
  const half = size * 0.5;
  return `${x2},${y2} ${baseX + px * half},${baseY + py * half} ${baseX - px * half},${baseY - py * half}`;
}

/**
 * How many chain slots sit between two laid-out nodes (0 = same block).
 *
 * @param fromX - Actor block left.
 * @param toX - Subject block left.
 * @returns Non-negative hop count.
 */
function edgeHops(fromX: number, toX: number): number {
  const step = TRUST_NODE_WIDTH + TRUST_NODE_GAP;
  return Math.round(Math.abs(toX - fromX) / step);
}

/**
 * Scrollable SVG chain of who verified or appointed whom.
 *
 * A single next person sits to the right. Several people hanging off one
 * person stack top to bottom. Drag a person to move them. A plain click
 * loads the person's neighborhood (`onExpand`). Modifier-click keeps the
 * member-card link.
 *
 * @param props - Public Trust Chain payload and optional expand handler.
 * @returns The diagram.
 */
export function TrustChainDiagram({
  chain,
  expandingId = null,
  onExpand,
}: {
  chain: TrustChain;
  expandingId?: string | null;
  onExpand?: (accountId: string) => void;
}): ReactElement {
  const { t } = useTranslations();
  const laid = layoutTrustChain(chain);
  const [placed, setPlaced] = useState<Record<string, NodePos>>({});
  const drag = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    const nextLaid = layoutTrustChain(chain);
    setPlaced((prev) => {
      const next: Record<string, NodePos> = {};
      for (const node of nextLaid.nodes) {
        next[node.id] = prev[node.id] ?? { x: node.x, y: node.y };
      }
      return next;
    });
  }, [chain]);

  const byId = new Map<string, LaidOutTrustNode>(
    laid.nodes.map((node) => {
      const pos = placed[node.id] ?? { x: node.x, y: node.y };
      return [node.id, { ...node, x: pos.x, y: pos.y }];
    }),
  );
  const nodes = [...byId.values()];
  const edges = laid.edges;

  let minX = 0;
  let minY = 0;
  let maxX = laid.width;
  let maxY = laid.height;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x + TRUST_NODE_WIDTH);
    maxY = Math.max(maxY, node.y + TRUST_NODE_HEIGHT);
  }
  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);

  function onNodePointerDown(event: PointerEvent<HTMLAnchorElement>, id: string): void {
    if (event.metaKey || event.ctrlKey || event.shiftKey) {
      return;
    }
    const pos = byId.get(id);
    /* v8 ignore next 3 -- onNodePointerDown is only called with ids from laid-out nodes */
    if (pos === undefined) {
      return;
    }
    if (typeof event.currentTarget.setPointerCapture === 'function') {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    drag.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      origX: pos.x,
      origY: pos.y,
      moved: false,
    };
  }

  function onNodePointerMove(event: PointerEvent<HTMLAnchorElement>): void {
    const current = drag.current;
    if (current === null || current.pointerId !== event.pointerId) {
      return;
    }
    /* v8 ignore next 3 -- PointerEvent constructors reject non-finite clientX/clientY */
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
      return;
    }
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    if (!current.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
      return;
    }
    current.moved = true;
    setPlaced((prev) => ({
      ...prev,
      [current.id]: { x: current.origX + dx, y: current.origY + dy },
    }));
  }

  function onNodePointerUp(event: PointerEvent<HTMLAnchorElement>): void {
    const current = drag.current;
    if (current === null || current.pointerId !== event.pointerId) {
      return;
    }
    if (
      typeof event.currentTarget.hasPointerCapture === 'function' &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div className="overflow-auto">
      <svg
        width={width}
        height={height}
        viewBox={`${minX} ${minY} ${width} ${height}`}
        role="group"
        aria-label={t('aria.trustChain')}
      >
        {edges.map((edge) => {
          const from = byId.get(edge.from);
          const to = byId.get(edge.to);
          if (from === undefined || to === undefined) {
            return null;
          }
          const hops = edgeHops(from.x, to.x);
          const y1 = from.y + TRUST_NODE_HEIGHT / 2;
          const y2 = to.y + TRUST_NODE_HEIGHT / 2;
          const x1 = to.x >= from.x ? from.x + TRUST_NODE_WIDTH : from.x;
          const x2 = to.x >= from.x ? to.x : to.x + TRUST_NODE_WIDTH;
          const midX = (x1 + x2) / 2;
          const sameRow = Math.abs(from.y - to.y) < 1;
          const lift = sameRow && hops >= 2 ? TRUST_CHAIN_ARC_LIFT + (hops - 2) * 16 : 0;
          const labelY = sameRow ? y1 - (lift === 0 ? 8 : lift / 2) - 6 : (y1 + y2) / 2 - 6;
          return (
            <g key={`${edge.from}-${edge.to}-${edge.kind}`}>
              {lift > 0 ? (
                <path
                  d={`M ${x1} ${y1} Q ${midX} ${y1 - lift} ${x2} ${y2}`}
                  className="stroke-paper/40"
                  fill="none"
                />
              ) : (
                <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-paper/40" />
              )}
              <polygon points={arrowHeadPoints(x1, y1, x2, y2)} className="fill-paper/40" />
              <text
                x={midX}
                y={labelY}
                textAnchor="middle"
                className="fill-paper"
                fontSize="12"
                pointerEvents="none"
              >
                {t(edgeMessageKey(edge.kind))}
              </text>
            </g>
          );
        })}
        {nodes.map((node) => {
          const label =
            node.name === null || node.name === '' ? t('trustChain.unnamed') : node.name;
          const busy = expandingId === node.id;
          return (
            <a
              key={node.id}
              href={`/members/${node.id}`}
              data-testid={`trust-node-${node.id}`}
              aria-busy={busy ? 'true' : undefined}
              className="touch-none cursor-grab"
              onPointerDown={(event) => {
                onNodePointerDown(event, node.id);
              }}
              onPointerMove={onNodePointerMove}
              onPointerUp={onNodePointerUp}
              onPointerCancel={onNodePointerUp}
              onClick={(event) => {
                if (drag.current?.id === node.id && drag.current.moved) {
                  event.preventDefault();
                  drag.current = null;
                  return;
                }
                drag.current = null;
                if (onExpand === undefined || event.metaKey || event.ctrlKey || event.shiftKey) {
                  return;
                }
                event.preventDefault();
                if (!busy) {
                  onExpand(node.id);
                }
              }}
            >
              <rect
                x={node.x}
                y={node.y}
                width={TRUST_NODE_WIDTH}
                height={TRUST_NODE_HEIGHT}
                rx={12}
                className="fill-ink stroke-paper/20"
              />
              <text
                x={node.x + TRUST_NODE_WIDTH / 2}
                y={node.y + 30}
                textAnchor="middle"
                className="fill-paper"
                fontSize="14"
              >
                {label}
              </text>
              <text
                x={node.x + TRUST_NODE_WIDTH / 2}
                y={node.y + 50}
                textAnchor="middle"
                className="fill-paper"
                fontSize="12"
              >
                {busy ? t('trustChain.loading') : t(roleMessageKey(node.role))}
              </text>
            </a>
          );
        })}
      </svg>
    </div>
  );
}
