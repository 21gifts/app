'use client';

import { Loader2, Send } from 'lucide-react';
import Link from 'next/link';
import { useState, type FormEvent, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Card, IconButton } from '@/components/ui';
import { CONTACT_MESSAGE_MAX_LENGTH } from '@/lib/api-types';
import { entryTextProblem, shownEntryProblem } from '@/lib/entry-text';

/** Props for {@link ContactScreen}. */
export interface ContactScreenProps {
  /** True while a post is in flight. */
  posting: boolean;
  /** Composer draft text. */
  draft: string;
  /** Called when the composer value changes. */
  onDraftChange: (value: string) => void;
  /** Called when the composer form is submitted. */
  onPost: () => void;
  /** Client-side composer validation or request failure. */
  formError: 'empty' | 'tooLong' | 'request' | null;
}

/**
 * Presentational in-app contact: heading, lead, rules link, and a
 * messenger-style composer. A successful send is the official thread in
 * `/messages`, not a dead-end sentence.
 *
 * Uses semantic app tokens (`bg-app-*` / `text-app-*`) to follow the resolved
 * theme, matching {@link WelcomeScreen}.
 *
 * @param props - Composer and error state from {@link ContactLoader}.
 * @returns The contact card.
 */
export function ContactScreen({
  posting,
  draft,
  onDraftChange,
  onPost,
  formError,
}: ContactScreenProps): ReactElement {
  const { t } = useTranslations();
  const [touched, setTouched] = useState(false);
  const [seenPosting, setSeenPosting] = useState(posting);
  if (posting !== seenPosting) {
    setSeenPosting(posting);
    if (seenPosting && !posting && draft.trim() === '') {
      setTouched(false);
    }
  }
  const problem = entryTextProblem(draft, CONTACT_MESSAGE_MAX_LENGTH);
  const shown = shownEntryProblem(
    problem,
    touched || formError === 'empty' || formError === 'tooLong',
  );
  const clientError = shown === 'empty' || shown === 'tooLong';
  const message =
    shown === 'tooLong' || formError === 'tooLong'
      ? t('contact.errorTooLong')
      : shown === 'empty' || formError === 'empty'
        ? t('contact.errorEmpty')
        : formError === 'request'
          ? t('contact.errorRequest')
          : null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setTouched(true);
    onPost();
  };

  return (
    <Card maxWidth="xl" surface={false}>
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg sm:text-3xl">
        {t('contact.heading')}
      </h1>
      <p className="text-center text-sm text-app-fg">{t('contact.lead')}</p>
      <Link href="/rules" className="text-sm font-medium text-app-fg underline underline-offset-2">
        {t('contact.rulesLink')}
      </Link>

      <form onSubmit={handleSubmit} className="flex w-full items-end gap-2">
        <textarea
          aria-label={t('contact.composerLabel')}
          placeholder={t('contact.placeholder')}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onBlur={() => {
            setTouched(true);
          }}
          rows={2}
          disabled={posting}
          aria-invalid={clientError || undefined}
          aria-describedby={clientError ? 'contact-composer-error' : undefined}
          className="min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-app-border-strong px-4 py-2.5 text-base text-app-fg transition disabled:opacity-50"
        />
        <IconButton
          type="submit"
          variant="primary"
          size="lg"
          disabled={posting || clientError || formError === 'empty' || formError === 'tooLong'}
          aria-label={t('contact.send')}
        >
          {posting ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Send aria-hidden="true" className="h-4 w-4" />
          )}
        </IconButton>
      </form>

      {message === null ? null : (
        <p id="contact-composer-error" role="alert" className="text-center text-sm text-app-danger">
          {message}
        </p>
      )}
    </Card>
  );
}
