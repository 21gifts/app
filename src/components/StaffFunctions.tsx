'use client';

import { useState, type ReactElement, type ReactNode } from 'react';
import { useTranslations } from '@/components/LocaleProvider';

/**
 * Closed disclosure for moderator and founder actions on a member card.
 * Same `details` / `summary` as wallet Advanced functions.
 *
 * @param props - Children that mount only while the disclosure is open.
 * @returns The closed summary, and the children while open.
 */
export function StaffFunctions({ children }: { children: ReactNode }): ReactElement {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);

  return (
    <details
      data-testid="staff-functions"
      open={open}
      className="w-full rounded-lg border border-app-border bg-app-card px-3 py-2"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <summary
        className="cursor-pointer text-sm text-app-muted"
        onClick={(event) => {
          event.preventDefault();
          setOpen((current) => !current);
        }}
      >
        {t('staff.functions')}
      </summary>
      {open ? (
        <div className="mt-3 flex w-full flex-col items-stretch gap-3">{children}</div>
      ) : null}
    </details>
  );
}
