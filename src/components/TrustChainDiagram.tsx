'use client';

import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import type { TrustChain, TrustChainEdge, TrustChainNode } from '@/lib/api-types';
import type { MessageKey } from '@/lib/messages';
import {
  layoutTrustChain,
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
 * Scrollable SVG forest of who verified or appointed whom.
 *
 * @param props - Public Trust Chain payload.
 * @returns The diagram.
 */
export function TrustChainDiagram({ chain }: { chain: TrustChain }): ReactElement {
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
          const x1 = from.x + TRUST_NODE_WIDTH / 2;
          const y1 = from.y + TRUST_NODE_HEIGHT;
          const x2 = to.x + TRUST_NODE_WIDTH / 2;
          const y2 = to.y;
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          return (
            <g key={`${edge.from}-${edge.to}-${edge.kind}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-paper/40" />
              <polygon points={arrowHeadPoints(x1, y1, x2, y2)} className="fill-paper/40" />
              <text
                x={midX}
                y={midY - 6}
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
          return (
            <a key={node.id} href={`/members/${node.id}`} data-testid={`trust-node-${node.id}`}>
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
                {t(roleMessageKey(node.role))}
              </text>
            </a>
          );
        })}
      </svg>
    </div>
  );
}
