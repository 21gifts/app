'use client';

import { HandHeart } from 'lucide-react';
import { useState, type ReactElement, type ReactNode } from 'react';
import { ForumRoleHint, ForumRoleTag, forumTaggedRole } from '@/components/ForumRoleTag';
import { useTranslations } from '@/components/LocaleProvider';
import { IconButton } from '@/components/ui';
import type { MemberProfile } from '@/lib/api-types';
import { formatForumTimeFromMs } from '@/lib/forum-time';
import type { MessageKey } from '@/lib/messages';
import { effectiveRole } from '@/lib/roles';

function fundingParticipationLabel(
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
  locale: string,
  admittedAt: number,
  reviewerName: string | null | undefined,
): string {
  const name = (reviewerName ?? '').trim();
  const date = formatForumTimeFromMs(admittedAt, locale);
  if (name !== '') {
    return t('funding.participatesSinceBy', { date, name });
  }
  return t('funding.participatesSince', { date });
}

function FundingProgramMark({
  admittedAt,
  reviewerName = null,
  expanded,
  onToggle,
}: {
  admittedAt: number;
  reviewerName?: string | null;
  expanded: boolean;
  onToggle: () => void;
}): ReactElement {
  const { t, locale } = useTranslations();
  const label = fundingParticipationLabel(t, locale, admittedAt, reviewerName);
  return (
    <IconButton
      size="sm"
      variant="secondary"
      aria-label={label}
      aria-expanded={expanded}
      onClick={onToggle}
    >
      <HandHeart aria-hidden="true" className="h-3.5 w-3.5" />
    </IconButton>
  );
}

/**
 * Role pill and funding-program icon that sit beside a member's name, plus
 * the sentences those controls reveal.
 *
 * The same marks are what a visitor sees and what the account owner sees
 * on `/profile`. `children` places the marks and the hint paragraphs.
 *
 * @param props - Member profile and a render prop `(marks, hints)`.
 * @returns Whatever `children` returns.
 */
export function MemberIdentityPills({
  profile,
  children,
}: {
  profile: MemberProfile | null;
  children: (marks: ReactNode, hints: ReactNode) => ReactElement;
}): ReactElement {
  const { t, locale } = useTranslations();
  const [roleHintOpen, setRoleHintOpen] = useState(false);
  const [fundingHintOpen, setFundingHintOpen] = useState(false);
  if (profile === null) {
    return children(null, null);
  }
  const hasRoleTag = forumTaggedRole(effectiveRole(profile.role, profile.staffTag)) !== null;
  const roleTag = (
    <ForumRoleTag
      role={profile.role}
      staffTag={profile.staffTag}
      expanded={roleHintOpen}
      onToggle={() => {
        setRoleHintOpen((open) => !open);
      }}
    />
  );
  const fundingReviewedAt = profile.fundingReviewedAt;
  const showMarks = hasRoleTag || typeof fundingReviewedAt === 'number';
  const marks = showMarks ? (
    <>
      {roleTag}
      {typeof fundingReviewedAt === 'number' ? (
        <FundingProgramMark
          admittedAt={fundingReviewedAt}
          reviewerName={profile.fundingReviewedByName ?? null}
          expanded={fundingHintOpen}
          onToggle={() => setFundingHintOpen((open) => !open)}
        />
      ) : null}
    </>
  ) : null;
  const hints = (
    <>
      {roleHintOpen && hasRoleTag ? (
        <p role="status" className="text-center text-xs text-app-muted">
          <ForumRoleHint role={profile.role} staffTag={profile.staffTag} />
        </p>
      ) : null}
      {fundingHintOpen && typeof fundingReviewedAt === 'number' ? (
        <p role="status" className="text-center text-xs text-app-muted">
          {fundingParticipationLabel(t, locale, fundingReviewedAt, profile.fundingReviewedByName)}
        </p>
      ) : null}
    </>
  );
  return children(marks, hints);
}
