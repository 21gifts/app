'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactElement } from 'react';
import { AboutMeSection } from '@/components/AboutMeSection';
import { LocationForm } from '@/components/LocationForm';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, ButtonLink, Card } from '@/components/ui';
import { fetchMemberPosts, postFundingApply, putAboutMe } from '@/lib/api';
import type { Account, ForumMessage } from '@/lib/api-types';
import { formatForumTime } from '@/lib/forum-time';
import { MissingRequirementsError } from '@/lib/missing-requirements';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

type ReviewStep = 1 | 2 | 3 | 4;
type FillStep = 'about' | 'photo' | 'location';

/**
 * True when About me is a real bio, not empty or the display-name auto note.
 *
 * @param aboutMe - Stored About me text.
 * @param name - Display name.
 * @returns Whether the bio counts as filled.
 */
export function aboutMeFilled(aboutMe: string | null, name: string | null): boolean {
  const trimmedAbout = typeof aboutMe === 'string' ? aboutMe.trim() : '';
  const trimmedName = (name ?? '').trim();
  return (
    trimmedAbout !== '' &&
    (trimmedName === '' || trimmedAbout.toLowerCase() !== trimmedName.toLowerCase())
  );
}

/**
 * True when location is a non-empty trimmed string.
 *
 * @param location - Account location.
 * @returns Whether location is set.
 */
export function locationFilled(location: string | null | undefined): boolean {
  return location !== null && location !== undefined && location.trim() !== '';
}

/**
 * Next profile gap on the apply walk, or null when About me, photo, and
 * location are all present.
 *
 * @param account - Signed-in owner account.
 * @returns The first missing fill step.
 */
export function nextFillStep(account: Account): FillStep | null {
  if (!aboutMeFilled(account.aboutMe, account.name)) {
    return 'about';
  }
  if (account.aboutMeHasPhoto !== true) {
    return 'photo';
  }
  if (!locationFilled(account.location)) {
    return 'location';
  }
  return null;
}

/**
 * Signed-in grant apply walk: fill About me, photo, and location, then the
 * same four principle/truth questions staff use. Missing fields are next
 * steps, not errors. Yes on the last step posts apply. Unmet or No does not
 * apply. Renders nothing without a session.
 *
 * @returns The apply card, or `null` without a session.
 */
export function FundingApplyScreen(): ReactElement | null {
  const { t, locale } = useTranslations();
  const router = useRouter();
  const session = useAuthStore((state) => state.session);
  const account = useAuthStore((state) => state.account);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [reviewStep, setReviewStep] = useState<ReviewStep>(1);
  const [unmet, setUnmet] = useState(false);
  const [posts, setPosts] = useState<ForumMessage[] | null>(null);
  const [postsError, setPostsError] = useState(false);
  const [postsAttempt, setPostsAttempt] = useState(0);
  const [applying, setApplying] = useState(false);
  const [applyFailed, setApplyFailed] = useState(false);

  useEffect(() => {
    if (session === null || account === null || !roleAtLeast(account.role, 'verified')) {
      return;
    }
    const funding = account.funding?.status ?? 'none';
    if (funding !== 'none' && funding !== 'rejected') {
      return;
    }
    if (nextFillStep(account) !== null) {
      return;
    }
    let cancelled = false;
    setPostsError(false);
    void (async () => {
      try {
        const rows = await fetchMemberPosts(session, account.id);
        /* v8 ignore next 3 — unmount while posts fetch is in flight */
        if (cancelled) {
          return;
        }
        setPosts(rows);
      } catch {
        /* v8 ignore next 3 — unmount while posts fetch is in flight */
        if (cancelled) {
          return;
        }
        setPosts(null);
        setPostsError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session, account, postsAttempt]);

  if (session === null || account === null) {
    return null;
  }

  const heading = (
    <>
      <div className="flex w-full justify-start">
        <Link
          href="/profile"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-app-muted transition hover:bg-app-hover hover:text-app-fg"
          aria-label={t('funding.apply.back')}
        >
          <ArrowLeft aria-hidden="true" className="h-5 w-5" />
        </Link>
      </div>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('funding.apply.heading')}
      </h1>
    </>
  );

  if (!roleAtLeast(account.role, 'verified')) {
    return (
      <Card maxWidth="xl" surface={false}>
        {heading}
        <p className="text-center text-sm text-app-muted">{t('funding.notVerified')}</p>
        <p className="text-center text-sm text-app-muted">{t('funding.verifyHow')}</p>
      </Card>
    );
  }

  const funding = account.funding ?? {
    status: 'none' as const,
    trialUtcDate: null,
    admittedAt: null,
    reviewedByName: null,
  };

  if (funding.status === 'pending') {
    return (
      <Card maxWidth="xl" surface={false}>
        {heading}
        <p className="text-center text-sm text-app-muted">{t('funding.pending')}</p>
      </Card>
    );
  }
  if (funding.status === 'trial') {
    return (
      <Card maxWidth="xl" surface={false}>
        {heading}
        <p className="text-center text-sm text-app-muted">{t('funding.trial')}</p>
      </Card>
    );
  }
  if (funding.status === 'admitted') {
    return (
      <Card maxWidth="xl" surface={false}>
        {heading}
        <p className="text-center text-sm text-app-muted">{t('funding.admitted')}</p>
      </Card>
    );
  }

  const saveAbout = async (
    text: string,
    photo?: { contentType: string; data: string } | null,
  ): Promise<boolean | void> => {
    try {
      const updated = await putAboutMe(session, text, photo);
      /* v8 ignore next 8 — session or account gone during save */
      if (useAuthStore.getState().session !== session) {
        return false;
      }
      const current = useAuthStore.getState().account;
      if (current === null) {
        return false;
      }
      setAccount({
        ...current,
        aboutMe: updated.aboutMe,
        aboutMeHasPhoto: updated.aboutMeHasPhoto,
      });
    } catch (err) {
      /* v8 ignore next 3 — session gone during save */
      if (useAuthStore.getState().session !== session) {
        return false;
      }
      if (err instanceof MissingRequirementsError && err.missing.includes('rules')) {
        router.replace('/setup/rules');
        return;
      }
      throw err;
    }
  };

  const fill = nextFillStep(account);
  if (fill !== null) {
    return (
      <Card maxWidth="xl" surface={false}>
        {heading}
        <p className="text-center text-sm text-app-muted">
          {fill === 'about'
            ? t('funding.apply.about')
            : fill === 'photo'
              ? t('funding.apply.photo')
              : t('funding.apply.location')}
        </p>
        {fill === 'location' ? (
          <LocationForm startEditing />
        ) : (
          <AboutMeSection
            mode="owner"
            aboutMe={account.aboutMe}
            name={account.name}
            hasPhoto={account.aboutMeHasPhoto === true}
            startEditing
            onSave={saveAbout}
          />
        )}
      </Card>
    );
  }

  if (unmet) {
    return (
      <Card maxWidth="xl" surface={false}>
        {heading}
        <p className="text-center text-sm text-app-muted">{t('funding.apply.unmet')}</p>
        <ButtonLink href="/profile" variant="secondary" size="lg">
          {t('funding.apply.back')}
        </ButtonLink>
      </Card>
    );
  }

  const onMet = (): void => {
    if (reviewStep < 4) {
      setReviewStep((current) => (current + 1) as ReviewStep);
      return;
    }
    /* v8 ignore next 3 — Yes is disabled while busy */
    if (applying) {
      return;
    }
    setApplying(true);
    setApplyFailed(false);
    void (async () => {
      try {
        const next = await postFundingApply(session);
        const current = useAuthStore.getState();
        /* v8 ignore next 3 — session or account gone during apply */
        if (current.session !== session || current.account === null) {
          return;
        }
        setAccount({ ...current.account, funding: next });
        router.push('/profile');
      } catch {
        /* v8 ignore next 3 — session gone during apply */
        if (useAuthStore.getState().session !== session) {
          return;
        }
        setApplyFailed(true);
      } finally {
        setApplying(false);
      }
    })();
  };

  let body: ReactElement;
  if (postsError) {
    body = (
      <>
        <p className="text-center text-sm text-app-muted">{t('funding.detail.error')}</p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setPostsAttempt((current) => current + 1);
          }}
        >
          {t('moderate.retry')}
        </Button>
      </>
    );
  } else if (posts === null) {
    body = <p className="text-center text-sm text-app-muted">{t('moderate.loading')}</p>;
  } else {
    const principle = reviewStep === 4 ? null : reviewStep;
    body = (
      <>
        {principle === 1 ? (
          <>
            <p className="text-center text-sm text-app-muted">{t('funding.review.check1')}</p>
            <p className="text-center text-sm font-medium text-app-fg">{t('about.conv1Title')}</p>
            <p className="text-center text-sm text-app-muted">{t('about.conv1Body')}</p>
          </>
        ) : principle === 2 ? (
          <>
            <p className="text-center text-sm text-app-muted">{t('funding.review.check2')}</p>
            <p className="text-center text-sm font-medium text-app-fg">{t('about.conv2Title')}</p>
            <p className="text-center text-sm text-app-muted">{t('about.conv2Body')}</p>
          </>
        ) : principle === 3 ? (
          <>
            <p className="text-center text-sm text-app-muted">{t('funding.review.check3')}</p>
            <p className="text-center text-sm font-medium text-app-fg">{t('about.conv3Title')}</p>
            <p className="text-center text-sm text-app-muted">{t('about.conv3Body')}</p>
          </>
        ) : (
          <p className="text-center text-sm text-app-muted">{t('funding.review.truth')}</p>
        )}
        {posts.length === 0 ? (
          <p className="text-center text-sm text-app-muted">{t('funding.detail.emptyPosts')}</p>
        ) : (
          <ul aria-label={t('funding.detail.postsLabel')} className="flex w-full flex-col gap-3">
            {posts.map((row) => (
              <li key={row.id}>
                <div className="flex w-full flex-col items-start gap-1 rounded-2xl border border-app-border bg-app-card-muted px-4 py-3">
                  <span className="flex w-full items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-app-fg">{row.name}</span>
                    <time dateTime={row.createdAt} className="text-xs text-app-subtle">
                      {formatForumTime(row.createdAt, locale)}
                    </time>
                  </span>
                  {row.text !== '' ? (
                    <span className="text-sm text-app-muted">{row.text}</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {applyFailed ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('funding.applyError')}
          </p>
        ) : null}
        <div className="flex w-full flex-col items-stretch gap-3">
          <Button
            type="button"
            disabled={applying}
            icon={
              applying ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : undefined
            }
            onClick={onMet}
          >
            {reviewStep === 4 ? t('funding.review.yes') : t('funding.review.met')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={applying}
            onClick={() => {
              setUnmet(true);
            }}
          >
            {reviewStep === 4 ? t('funding.review.no') : t('funding.review.unmet')}
          </Button>
        </div>
      </>
    );
  }

  return (
    <Card maxWidth="xl" surface={false}>
      {heading}
      {body}
    </Card>
  );
}
