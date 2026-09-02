'use client';

import { ArrowLeft, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, IconButton, Wordmark } from '@/components/ui';
import { agreeToRules } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Third post-login screen: one living-room rules chapter at a time.
 *
 * Intermediate **Continue** clicks only advance the chapter index. The last
 * chapter’s **I agree to these rules** POSTs `agreeToRules` and merges
 * `rulesAgreedAt`, `setup`, and `missing` into the auth-store account
 * so concurrent name or address writes are not overwritten. Renders nothing
 * without a session token or when `chapters` is empty.
 *
 * @param props - Server-rendered {@link RulesDocument} chapters in order.
 * @returns The rules setup screen, or `null` when logged out.
 */
export function RulesSetup({ chapters }: { chapters: ReactElement[] }): ReactElement | null {
  const { t } = useTranslations();
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const setAccount = useAuthStore((state) => state.setAccount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [index, setIndex] = useState(0);
  const stepLock = useRef(false);

  useEffect(() => {
    stepLock.current = false;
  }, [index]);

  if (account === null || session === null) {
    return null;
  }

  const current = chapters[index];
  if (current === undefined) {
    return null;
  }

  const lastIndex = chapters.length - 1;
  const lastChapter = index >= lastIndex;

  const handleAgree = (event: MouseEvent<HTMLButtonElement>): void => {
    if (event.detail > 1 || busy || stepLock.current) {
      return;
    }
    if (index < lastIndex) {
      stepLock.current = true;
      setIndex((currentIndex) => Math.min(currentIndex + 1, lastIndex));
      return;
    }
    stepLock.current = true;
    setBusy(true);
    setError(false);
    void (async () => {
      try {
        const updated = await agreeToRules(session);
        if (useAuthStore.getState().session !== session) {
          return;
        }
        const currentAccount = useAuthStore.getState().account;
        if (currentAccount === null) {
          return;
        }
        setAccount({
          ...currentAccount,
          rulesAgreedAt: updated.rulesAgreedAt,
          setup: updated.setup,
          missing: updated.missing,
        });
      } catch {
        setError(true);
      } finally {
        stepLock.current = false;
        setBusy(false);
      }
    })();
  };

  return (
    <>
      <div className="absolute top-4 left-5 z-40 flex items-center gap-2">
        {index > 0 ? (
          <IconButton
            type="button"
            variant="ghost"
            size="md"
            aria-label={t('setup.rulesBack')}
            disabled={busy}
            onClick={(event) => {
              if (event.detail > 1 || busy || stepLock.current) {
                return;
              }
              stepLock.current = true;
              setIndex((currentIndex) => Math.max(0, currentIndex - 1));
            }}
          >
            <ArrowLeft aria-hidden="true" className="h-5 w-5" />
          </IconButton>
        ) : null}
        <Wordmark />
      </div>
      <section className="flex w-full max-w-3xl flex-1 flex-col gap-6 pb-8 pt-24">
        <h1 className="text-center text-2xl font-semibold tracking-tight">
          {t('setup.rulesTitle')}
        </h1>
        <p className="text-center text-sm text-app-muted">
          {t(lastChapter ? 'setup.rulesPromptLast' : 'setup.rulesPrompt')}
        </p>
        <p className="text-center text-sm text-app-muted" aria-live="polite">
          {t('setup.rulesProgress', { current: index + 1, total: chapters.length })}
        </p>
        {current}
        {error ? (
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('setup.rulesErrorRequest')}
          </p>
        ) : null}
        <Button
          type="button"
          size="lg"
          onClick={handleAgree}
          disabled={busy}
          className="mt-auto"
          icon={busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : undefined}
        >
          {t(lastChapter ? 'setup.agree' : 'setup.continue')}
        </Button>
      </section>
    </>
  );
}
