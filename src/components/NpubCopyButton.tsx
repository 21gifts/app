'use client';

import { Check, Copy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { IconButton } from '@/components/ui';

/** Copied-icon flash duration, matching the forum copy controls. */
const COPY_RESET_MS = 1200;

/**
 * Copy `text` via a hidden textarea and `document.execCommand('copy')`.
 *
 * @param text - String to put on the clipboard.
 * @returns Whether the browser reported a successful copy.
 */
function fallbackCopy(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('aria-hidden', 'true');
  ta.className = 'fixed opacity-0';
  ta.readOnly = true;
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

/**
 * Icon-only npub copy control shared by public Nostr identity cards.
 *
 * @param props - The npub to copy.
 * @returns Copy icon, briefly replaced by a check after success.
 */
export function NpubCopyButton({ npub }: { npub: string }): ReactElement {
  const { t } = useTranslations();
  const [copied, setCopied] = useState(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  const flashCopied = useCallback((): void => {
    setCopied(true);
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      setCopied(false);
      timer.current = null;
    }, COPY_RESET_MS);
  }, []);

  const copyNpub = async (): Promise<void> => {
    const current = generation.current;
    try {
      await navigator.clipboard.writeText(npub);
      if (!mounted.current || generation.current !== current) {
        return;
      }
      flashCopied();
    } catch {
      if (!mounted.current || generation.current !== current) {
        return;
      }
      if (fallbackCopy(npub)) {
        flashCopied();
      }
    }
  };

  return (
    <IconButton
      type="button"
      variant="secondary"
      size="md"
      aria-label={copied ? t('forum.externalProfileCopied') : t('forum.externalProfileCopy')}
      title={copied ? t('forum.externalProfileCopied') : t('forum.externalProfileCopy')}
      onClick={() => {
        void copyNpub();
      }}
    >
      {copied ? (
        <Check aria-hidden="true" className="h-4 w-4" />
      ) : (
        <Copy aria-hidden="true" className="h-4 w-4" />
      )}
    </IconButton>
  );
}
