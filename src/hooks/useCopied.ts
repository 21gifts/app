'use client';

import { useCallback, useEffect, useState } from 'react';

/** State returned by {@link useCopied}. */
export interface CopiedState {
  /** True for two seconds after the last successful copy. */
  copied: boolean;
  /**
   * Writes `text` to the clipboard and resolves `true`; a refused or missing
   * clipboard changes nothing and resolves `false`.
   */
  copy: (text: string) => Promise<boolean>;
}

/**
 * Copy to the clipboard with a two-second **Copied** state. Each successful
 * copy starts the two seconds again. Without a clipboard (an insecure page, or
 * a refused write) nothing changes, and the copied text stays readable on the
 * page.
 *
 * @returns Whether a copy just happened, and the copy action.
 */
export function useCopied(): CopiedState {
  /** Successful copies so far; each one restarts the two-second Copied label. */
  const [copies, setCopies] = useState(0);
  useEffect(() => {
    if (copies === 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      setCopies(0);
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [copies]);
  const copy = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopies((count) => count + 1);
      return true;
    } catch {
      // No clipboard here: the text stays readable.
      return false;
    }
  }, []);
  return { copied: copies > 0, copy };
}
