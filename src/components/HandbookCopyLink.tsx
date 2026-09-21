'use client';

import { Check, Link2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { IconButton, type IconButtonTone } from '@/components/ui';

const RESET_MS = 1200;

/**
 * Copy `text` via a hidden textarea and `document.execCommand('copy')`.
 *
 * @param text - Absolute URL to put on the clipboard.
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
 * Client copy-link control for a handbook heading or chapter. Copies the
 * absolute deep-link (`origin + pathname + #id`) and flashes a check icon.
 *
 * @param props - Target DOM id (without `#`), human label for the aria name,
 *   and optional `tone` (`'app'` | `'dark'`, default `'dark'`).
 * @returns A button next to the heading.
 */
export function HandbookCopyLink({
  targetId,
  label,
  tone = 'dark',
}: {
  /** DOM id of the target (without `#`). */
  targetId: string;
  /** Interpolated into `handbook.copyLink` for aria-label and title. */
  label: string;
  /** Icon shell. Default `'dark'` (marketing). Staff handbook passes `'app'`. */
  tone?: IconButtonTone;
}): ReactElement {
  const { t } = useTranslations();
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (resetTimer.current !== null) {
        clearTimeout(resetTimer.current);
      }
    };
  }, []);

  function flashCopied(): void {
    setCopied(true);
    if (resetTimer.current !== null) {
      clearTimeout(resetTimer.current);
    }
    resetTimer.current = setTimeout(() => {
      setCopied(false);
      resetTimer.current = null;
    }, RESET_MS);
    if (window.location.hash !== `#${targetId}`) {
      window.location.hash = targetId;
    }
  }

  async function copy(): Promise<void> {
    const url = `${window.location.origin}${window.location.pathname}#${targetId}`;
    try {
      await navigator.clipboard.writeText(url);
      if (!mounted.current) {
        return;
      }
      flashCopied();
      return;
    } catch {
      if (!mounted.current) {
        return;
      }
      if (fallbackCopy(url)) {
        flashCopied();
        return;
      }
      console.error('Copy link failed');
    }
  }

  function handleClick(): void {
    void copy();
  }

  const ariaName = t('handbook.copyLink', { label });

  return (
    <IconButton
      type="button"
      size="sm"
      variant="ghost"
      tone={tone}
      onClick={handleClick}
      aria-label={ariaName}
      title={ariaName}
      data-copied={copied ? 'true' : undefined}
    >
      {copied ? (
        <Check
          aria-hidden="true"
          className={`h-4 w-4 ${tone === 'app' ? 'text-app-accent' : 'text-accent'}`}
        />
      ) : (
        <Link2 aria-hidden="true" className="h-4 w-4" />
      )}
    </IconButton>
  );
}
