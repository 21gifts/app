'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card, Field } from '@/components/ui';
import { searchTeamMembers } from '@/lib/api';
import type { TeamMember } from '@/lib/api-types';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/** Wait after the last keystroke before the search request, in ms. */
const SEARCH_DELAY_MS = 300;

/** Result of the search for one typed text. */
type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; members: TeamMember[] }
  | { status: 'forbidden' }
  | { status: 'error' };

/**
 * Signed-in staff search of the member-data area (`/moderate/members`).
 *
 * Moderators (and every higher role) type a name or username; after a short
 * pause the screen asks {@link searchTeamMembers} and lists the matches, each
 * linking to `/moderate/members/{id}`. An empty field shows the hint and
 * sends nothing. Other signed-in visitors, and staff the api refuses (403),
 * see the forbidden sentence and no field. Renders nothing without a
 * session. The page chrome owns the back; this screen renders none.
 *
 * @returns The search card, forbidden copy, or `null` without a session.
 */
export function TeamMemberSearchScreen(): ReactElement | null {
  const { t } = useTranslations();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const staff = roleAtLeast(account?.role, 'moderator');
  const [text, setText] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState<SearchState>({ status: 'idle' });
  const query = text.trim();

  useEffect(() => {
    if (session === null || !staff) {
      return;
    }
    if (query === '') {
      setSearch({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setSearch({ status: 'loading' });
    const timer = setTimeout(() => {
      void searchTeamMembers(session, query)
        .then((members) => {
          if (!cancelled) {
            setSearch(members === null ? { status: 'forbidden' } : { status: 'ready', members });
          }
        })
        .catch(() => {
          if (!cancelled) {
            setSearch({ status: 'error' });
          }
        });
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [session, staff, query, attempt]);

  if (session === null) {
    return null;
  }

  const heading = (
    <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
      {t('team.search.heading')}
    </h1>
  );

  if (!staff || search.status === 'forbidden') {
    return (
      <Card maxWidth="xl" surface={false}>
        {heading}
        <p className="text-center text-sm text-app-muted">{t('moderate.forbidden')}</p>
      </Card>
    );
  }

  let body: ReactElement;
  if (search.status === 'idle') {
    body = <p className="text-center text-sm text-app-muted">{t('team.search.hint')}</p>;
  } else if (search.status === 'loading') {
    body = <p className="text-center text-sm text-app-muted">{t('moderate.loading')}</p>;
  } else if (search.status === 'error') {
    body = (
      <>
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('team.search.error')}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setAttempt((n) => n + 1);
          }}
        >
          {t('moderate.retry')}
        </Button>
      </>
    );
  } else if (search.members.length === 0) {
    body = <p className="text-center text-sm text-app-muted">{t('team.search.empty')}</p>;
  } else {
    const unnamed = t('moderate.unnamed');
    body = (
      <ul aria-label={t('team.search.resultsLabel')} className="flex w-full flex-col gap-2">
        {search.members.map((member) => (
          <li key={member.id}>
            <Link
              href={`/moderate/members/${encodeURIComponent(member.id)}`}
              className="flex w-full min-h-11 flex-col justify-center rounded-2xl border border-app-border bg-app-card-muted px-4 py-3 text-left hover:bg-app-hover"
            >
              <span className="truncate text-sm font-medium text-app-fg">
                {member.name !== null && member.name !== '' ? member.name : unnamed}
              </span>
              {member.username === null || member.username === undefined ? null : (
                <span className="truncate text-xs text-app-subtle">@{member.username}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card maxWidth="xl" surface={false}>
      {heading}
      <p className="text-sm text-app-muted">{t('team.search.lead')}</p>
      <Field
        label={t('team.search.label')}
        id="team-member-search"
        type="search"
        autoComplete="off"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
      {body}
    </Card>
  );
}
