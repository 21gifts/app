'use client';

import { useState, type ReactElement } from 'react';
import { AccountActivityChart } from '@/components/AccountActivityChart';
import {
  ForumBoard,
  type ForumFormError,
  type ForumPayError,
  type ForumPayInvoice,
} from '@/components/ForumBoard';
import { useTranslations } from '@/components/LocaleProvider';
import type { ForumMessage, GiftStats, MemberProfile } from '@/lib/api-types';
import type { MessageKey } from '@/lib/messages';

/** Roles that show a clickable tag beside the author name. */
type MemberTaggedRole = 'founder' | 'moderator' | 'verified';

const ROLE_TAG_KEYS: Record<MemberTaggedRole, { label: MessageKey; hint: MessageKey }> = {
  founder: { label: 'forum.role.founder', hint: 'forum.role.founderHint' },
  moderator: { label: 'forum.role.moderator', hint: 'forum.role.moderatorHint' },
  verified: { label: 'forum.role.verified', hint: 'forum.role.verifiedHint' },
};

const IDLE_BOARD = {
  error: false,
  loading: false,
  posting: false,
  draft: '',
  onDraftChange: (): void => undefined,
  onPost: (): void => undefined,
  onRetry: (): void => undefined,
  formError: null as ForumFormError,
  payMessageId: null as string | null,
  payDraft: '',
  payBusy: false,
  payError: null as ForumPayError,
  payInvoice: null as ForumPayInvoice | null,
  payWaiting: false,
  onPayOpen: (): void => undefined,
  onPayDraftChange: (): void => undefined,
  onPaySubmit: (): void => undefined,
  onPayCancel: (): void => undefined,
  mode: 'all' as const,
  onModeChange: (): void => undefined,
  lawsVisible: false,
  onDismissLaws: (): void => undefined,
  photoDraft: null,
  onPickPhoto: (): void => undefined,
  onClearPhoto: (): void => undefined,
  photoUrls: {},
  expandedId: null as string | null,
  onToggleExpand: (): void => undefined,
  replies: null as ForumMessage[] | null,
  repliesLoading: false,
  repliesError: false,
  onRetryReplies: (): void => undefined,
  replyDraft: '',
  onReplyDraftChange: (): void => undefined,
  onReplyPost: (): void => undefined,
  replyPosting: false,
  replyFormError: null as ForumFormError,
  ownName: null as string | null,
  ownAccountId: null as string | null,
  onPm: (): void => undefined,
  pmBusyId: null as string | null,
  composerHidden: true,
};

/**
 * Signed-in member identity card: chart, name, Lightning Address, role pill,
 * and optional single-note forum card when `profileMessage` is set.
 *
 * @param props - Member profile and receive series for the chart.
 * @returns The presentational member profile.
 */
export function MemberProfileScreen({
  profile,
  received,
}: {
  profile: MemberProfile;
  received: GiftStats['spendOverTime'];
}): ReactElement {
  const { t } = useTranslations();
  const address = profile.lightningAddress;
  const [roleHintOpen, setRoleHintOpen] = useState(false);
  const tagged =
    profile.role === 'founder' || profile.role === 'moderator' || profile.role === 'verified'
      ? profile.role
      : null;
  const roleKeys = tagged !== null ? ROLE_TAG_KEYS[tagged] : null;

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-6">
      <section className="flex w-full flex-col items-center gap-6 rounded-3xl border border-app-border bg-app-card p-8 shadow-sm">
        <h1 className="text-center text-2xl font-semibold tracking-tight">{t('profile.title')}</h1>
        <AccountActivityChart received={received} />
        <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
          <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
            {t('name.heading')}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <p className="min-w-0 truncate text-sm text-app-fg">
              {profile.name ?? t('view.unnamed')}
            </p>
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
          </div>
          {roleHintOpen && roleKeys !== null ? (
            <p role="status" className="text-center text-xs text-app-muted">
              {t(roleKeys.hint)}
            </p>
          ) : null}
        </div>
        <div className="flex w-full flex-col items-stretch gap-3 border-t border-app-border pt-6">
          <p className="text-center text-xs tracking-widest text-app-subtle uppercase">
            {t('la.heading')}
          </p>
          {address !== null && address.trim() !== '' ? (
            <p className="min-w-0 truncate font-mono text-sm text-app-fg">{address}</p>
          ) : (
            <p className="min-w-0 truncate text-sm text-app-fg">{t('view.noAddress')}</p>
          )}
        </div>
      </section>
      {profile.profileMessage !== null ? (
        <ForumBoard {...IDLE_BOARD} messages={[profile.profileMessage]} />
      ) : null}
    </div>
  );
}
