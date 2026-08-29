'use client';

import { Check, Link2 } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';

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
 * Client copy control for the signed-in profile view-key link. Copies
 * `origin + /view/ + viewKey` and flashes a check icon (no hash update).
 *
 * @param props - The account `viewKey` (64 lowercase hex).
 * @returns A button next to the view-key URL.
 */
export function ViewKeyCopy({ viewKey }: { viewKey: string }): ReactElement {
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
  }

  async function copy(): Promise<void> {
    const url = `${window.location.origin}/view/${viewKey}`;
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

  const ariaName = t('profile.viewKeyCopy');

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaName}
      title={ariaName}
      data-copied={copied ? 'true' : undefined}
      className={`inline-flex items-center shrink-0 rounded px-1.5 py-0.5 text-xs leading-none transition ${
        copied ? 'text-neutral-900' : 'text-neutral-400 hover:text-neutral-900'
      }`}
    >
      {copied ? (
        <Check aria-hidden="true" className="h-4 w-4" />
      ) : (
        <Link2 aria-hidden="true" className="h-4 w-4" />
      )}
    </button>
  );
}
