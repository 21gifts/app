'use client';

import { HandHeart } from 'lucide-react';
import { useState, type ReactElement, type ReactNode } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { IconButton } from '@/components/ui';
import type { MemberProfile } from '@/lib/api-types';
import { formatForumTimeFromMs } from '@/lib/forum-time';
import type { MessageKey } from '@/lib/messages';
import { verifiedChipHiddenByStaffTag } from '@/lib/roles';

/** Roles that show a clickable tag beside the author name. */
type MemberTaggedRole = 'founder' | 'moderator' | 'initiator' | 'verified';

const ROLE_TAG_KEYS: Record<MemberTaggedRole, { label: MessageKey; hint: MessageKey }> = {
  founder: { label: 'forum.role.founder', hint: 'forum.role.founderHint' },
  moderator: { label: 'forum.role.moderator', hint: 'forum.role.moderatorHint' },
  initiator: { label: 'forum.role.initiator', hint: 'forum.role.initiatorHint' },
  verified: { label: 'forum.role.verified', hint: 'forum.role.verifiedHint' },
};

function isMemberTaggedRole(role: string): role is MemberTaggedRole {
  return role in ROLE_TAG_KEYS;
}

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
 * Role pill, Software Developer label, and funding-program icon that sit
 * beside a member's name, plus the sentences those controls reveal.
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
  const tagged = isMemberTaggedRole(profile.role) ? profile.role : null;
  const roleKeys =
    tagged !== null && !verifiedChipHiddenByStaffTag(profile.role, profile.staffTag)
      ? ROLE_TAG_KEYS[tagged]
      : null;
  const fundingReviewedAt = profile.fundingReviewedAt;
  const showMarks =
    roleKeys !== null ||
    typeof fundingReviewedAt === 'number' ||
    profile.staffTag === 'software_developer';
  const marks = showMarks ? (
    <>
      {roleKeys !== null ? (
        <button
          type="button"
          aria-expanded={roleHintOpen}
          onClick={() => {
            setRoleHintOpen((open) => !open);
          }}
          className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted"
        >
          {t(roleKeys.label)}
        </button>
      ) : null}
      {profile.staffTag === 'software_developer' ? (
        <span className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted">
          {t('forum.staff.softwareDeveloper')}
        </span>
      ) : null}
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
      {roleHintOpen && roleKeys !== null ? (
        <p role="status" className="text-center text-xs text-app-muted">
          {t(roleKeys.hint)}
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
