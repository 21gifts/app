import { Loader2 } from 'lucide-react';
import type { ReactElement } from 'react';

/**
 * A centred status line with a spinner, in place of a step's action while it
 * runs (`role="status"`).
 *
 * @param props - `label`, the translated sentence.
 * @returns The status line.
 */
export function BusyLine({ label }: { label: string }): ReactElement {
  return (
    <p role="status" className="flex items-center justify-center gap-2 text-sm text-app-muted">
      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
      {label}
    </p>
  );
}
