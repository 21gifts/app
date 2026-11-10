'use client';

import type { MouseEvent, ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import type { MessageKey } from '@/lib/messages';
import { effectiveRole, type Role } from '@/lib/roles';

/** Roles that show a clickable tag beside a forum member's name. */
export type ForumTaggedRole =
  | 'founder'
  | 'moderator'
  | 'software_developer'
  | 'initiator'
  | 'verified';

/** Catalog keys for a tagged forum role's label and explanation. */
export const FORUM_ROLE_TAG_KEYS: Record<ForumTaggedRole, { label: MessageKey; hint: MessageKey }> =
  {
    founder: { label: 'forum.role.founder', hint: 'forum.role.founderHint' },
    moderator: { label: 'forum.role.moderator', hint: 'forum.role.moderatorHint' },
    software_developer: {
      label: 'forum.role.softwareDeveloper',
      hint: 'forum.role.softwareDeveloperHint',
    },
    initiator: { label: 'forum.role.initiator', hint: 'forum.role.initiatorHint' },
    verified: { label: 'forum.role.verified', hint: 'forum.role.verifiedHint' },
  };

/**
 * Role that shows a forum tag, or `null` for basis / missing.
 *
 * @param role - Live account role from the api, if present.
 * @returns Tagged role or `null`.
 */
export function forumTaggedRole(role: string): ForumTaggedRole | null {
  return role in FORUM_ROLE_TAG_KEYS ? (role as ForumTaggedRole) : null;
}

/**
 * Clickable role pill shared by a member's identity card, forum notes and
 * replies, and the paid-heart sender list.
 *
 * The shown role comes from {@link effectiveRole}, so an older api body with a
 * lower role plus the `software_developer` staff tag still shows the Software
 * Developer pill. The pill is absent for an untagged role. The caller owns the
 * open state so each list can show one hint at a time.
 *
 * @param props - Live role, optional staff tag, open state, and toggle.
 * @returns The pill, or `null` when this role has no tag.
 */
export function ForumRoleTag({
  role,
  staffTag,
  expanded,
  onToggle,
}: {
  role: Role;
  staffTag?: string | undefined;
  expanded: boolean;
  onToggle: (event: MouseEvent<HTMLButtonElement>) => void;
}): ReactElement | null {
  const { t } = useTranslations();
  const tagged = forumTaggedRole(effectiveRole(role, staffTag));
  if (tagged === null) {
    return null;
  }
  return (
    <button
      type="button"
      aria-expanded={expanded}
      onClick={onToggle}
      className="rounded-full border border-app-border-strong px-2 py-0.5 text-xs font-medium text-app-muted"
    >
      {t(FORUM_ROLE_TAG_KEYS[tagged].label)}
    </button>
  );
}

/**
 * Sentence revealed under a {@link ForumRoleTag}.
 *
 * Resolves the shown role through {@link effectiveRole}, like the pill itself.
 *
 * @param props - Live role and optional staff tag.
 * @returns The status sentence, or `null` when this role has no tag.
 */
export function ForumRoleHint({
  role,
  staffTag,
}: {
  role: Role;
  staffTag?: string | undefined;
}): ReactElement | null {
  const { t } = useTranslations();
  const tagged = forumTaggedRole(effectiveRole(role, staffTag));
  if (tagged === null) {
    return null;
  }
  return <>{t(FORUM_ROLE_TAG_KEYS[tagged].hint)}</>;
}
