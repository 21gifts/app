'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card } from '@/components/ui';
import { CONTACT_MESSAGE_MAX_LENGTH } from '@/lib/api-types';

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

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onPost();
  };

  return (
    <Card maxWidth="xl">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg">
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
          maxLength={CONTACT_MESSAGE_MAX_LENGTH}
          rows={2}
          disabled={posting}
          className="min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-app-border-strong px-4 py-2.5 text-sm text-app-fg outline-none transition focus:border-app-border-strong disabled:opacity-50"
        />
        <Button type="submit" disabled={posting}>
          {posting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
          {t('contact.send')}
        </Button>
      </form>

      {formError === 'empty' ? (
        <p role="alert" className="text-center text-sm text-red-600">
          {t('contact.errorEmpty')}
        </p>
      ) : null}
      {formError === 'tooLong' ? (
        <p role="alert" className="text-center text-sm text-red-600">
          {t('contact.errorTooLong')}
        </p>
      ) : null}
      {formError === 'request' ? (
        <p role="alert" className="text-center text-sm text-red-600">
          {t('contact.errorRequest')}
        </p>
      ) : null}
    </Card>
  );
}
