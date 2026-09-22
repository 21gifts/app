'use client';

import { useId, useState, type ReactElement, type ReactNode } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';

/**
 * Closed disclosure for moderator and founder actions on a member-facing surface.
 *
 * @param props - Children that mount only while the disclosure is open.
 * @returns The closed trigger, and the children while open.
 */
export function StaffFunctions({ children }: { children: ReactNode }): ReactElement {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div
      data-testid="staff-functions"
      className="flex w-full flex-col items-stretch gap-3"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Button
        variant="secondary"
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((current) => !current);
        }}
      >
        {t('staff.functions')}
      </Button>
      {open ? (
        <div id={panelId} className="flex w-full flex-col items-stretch gap-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}
