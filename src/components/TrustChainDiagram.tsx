'use client';

import type { ReactElement } from 'react';
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
 * Scrollable SVG chain of who verified or appointed whom, left to right.
 *
 * A plain click loads the person's neighborhood (`onExpand`). Modifier-click
 * keeps the member-card link.
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
  const { nodes, edges, width, height } = layoutTrustChain(chain);
  const byId = new Map<string, LaidOutTrustNode>(nodes.map((node) => [node.id, node]));

  return (
    <div className="overflow-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
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
          const lift = hops >= 2 ? TRUST_CHAIN_ARC_LIFT + (hops - 2) * 16 : 0;
          const labelY = y1 - (lift === 0 ? 8 : lift / 2) - 6;
          return (
            <g key={`${edge.from}-${edge.to}-${edge.kind}`}>
              {hops >= 2 ? (
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
              onClick={(event) => {
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
