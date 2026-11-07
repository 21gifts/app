'use client';

import { useLayoutEffect, useRef } from 'react';
import { useChromeBack } from '@/components/ViewHistoryRoot';

/** Props for {@link MoveFundsBack}. */
export interface MoveFundsBackProps {
  /** The flow's one step back (closes the flow on its first and last step). */
  onBack: () => void;
}

/**
 * Registers the top-left arrow as the move-funds flow's one step back while
 * it is open, laid over the page's own steps (`useChromeBack`, `nav.back`,
 * `over`). The latest `onBack` is used on each press, and the registration is
 * removed on unmount.
 *
 * @param props - See {@link MoveFundsBackProps}.
 * @returns `null` (registration only).
 */
export function MoveFundsBack({ onBack }: MoveFundsBackProps): null {
  const { setOverride } = useChromeBack();
  const backRef = useRef(onBack);
  useLayoutEffect(() => {
    backRef.current = onBack;
  });
  useLayoutEffect(() => {
    setOverride({
      labelKey: 'nav.back',
      over: true,
      onClick: () => {
        backRef.current();
      },
    });
    return () => {
      setOverride(null);
    };
  }, [setOverride]);
  return null;
}
