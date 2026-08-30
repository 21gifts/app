'use client';

import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
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
  /** True after a successful send — form is hidden. */
  success: boolean;
}

/**
 * Presentational in-app contact: heading, lead, rules link, and either a
 * messenger-style composer or the success copy.
 *
 * Light neutral palette to match {@link WelcomeScreen}. No message inbox.
 *
 * @param props - Composer and success/error state from {@link ContactLoader}.
 * @returns The contact card.
 */
export function ContactScreen({
  posting,
  draft,
  onDraftChange,
  onPost,
  formError,
  success,
}: ContactScreenProps): ReactElement {
  const { t } = useTranslations();

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    onPost();
  };

  return (
    <section className="flex w-full max-w-xl flex-col items-center gap-6 rounded-3xl border border-app-border bg-app-card p-8 shadow-sm">
      <h1 className="text-center text-2xl font-semibold tracking-tight text-app-fg">
        {t('contact.heading')}
      </h1>
      <p className="text-center text-sm text-app-fg">{t('contact.lead')}</p>
      <Link href="/rules" className="text-sm font-medium text-app-fg underline underline-offset-2">
        {t('contact.rulesLink')}
      </Link>

      {success ? (
        <p role="status" className="text-center text-sm text-app-fg">
          {t('contact.success')}
        </p>
      ) : (
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
          <button
            type="submit"
            disabled={posting}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-app-btn px-5 text-sm font-medium text-app-btn-fg transition hover:bg-app-btn-hover disabled:opacity-50"
          >
            {posting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
            {t('contact.send')}
          </button>
        </form>
      )}

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
    </section>
  );
}
