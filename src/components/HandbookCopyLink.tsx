'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';

const IDLE_LABEL = 'Copy link';
const COPIED_LABEL = 'Copied';
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
 * absolute deep-link (`origin + pathname + #id`) and flashes **Copied**.
 *
 * @param props - Target DOM id (without `#`) and human label for the aria name.
 * @returns A button next to the heading.
 */
export function HandbookCopyLink({
  targetId,
  label,
}: {
  /** DOM id of the target (without `#`). */
  targetId: string;
  /** Used in aria-label: `Copy link to ${label}`. */
  label: string;
}): ReactElement {
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

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={`Copy link to ${label}`}
      data-copied={copied ? 'true' : undefined}
      className={`shrink-0 rounded px-1.5 py-0.5 text-xs leading-none transition ${
        copied ? 'text-[#f7931a]' : 'text-white/40 hover:text-[#f7931a]'
      }`}
    >
      {copied ? COPIED_LABEL : IDLE_LABEL}
    </button>
  );
}
