'use client';

import type { ReactElement } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { AppShellFooter } from '@/components/AppShell';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';

/** Props for {@link WalletFooterActions}. */
export interface WalletFooterActionsProps {
  /** Opens the Receive view. */
  onReceive: () => void;
  /** Opens the Send view. */
  onSend: () => void;
  /** Whether Send is disabled. */
  sendDisabled: boolean;
}

/**
 * The wallet's two large **Receive** (left, `ArrowDownRight`) and **Send**
 * (right, `ArrowUpRight`) buttons, side by side in the shell footer outside
 * the scrollport, so they stay in place while the page scrolls. Above them an
 * 18px fade with a light blur lets the page end softly instead of at a hard
 * edge. Below 360px the icons drop and the side padding shrinks so long
 * labels fit at 320px. Used by `/wallet` and `/welcome`.
 *
 * @param props - Open handlers and whether Send is disabled.
 * @returns The footer registration.
 */
export function WalletFooterActions({
  onReceive,
  onSend,
  sendDisabled,
}: WalletFooterActionsProps): ReactElement {
  const { t } = useTranslations();
  const iconClass = 'h-5 w-5 max-[359px]:hidden';
  const buttonClass = 'min-h-14 text-base max-[359px]:px-2';
  return (
    <AppShellFooter>
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-5 bottom-full h-[18px] bg-gradient-to-t from-app-card to-transparent backdrop-blur-[1.5px] [mask-image:linear-gradient(to_top,black,transparent)]"
        />
      </div>
      <div className="mx-auto grid w-full max-w-sm grid-cols-2 gap-3 pt-2">
        <Button
          size="lg"
          className={buttonClass}
          icon={<ArrowDownRight aria-hidden="true" className={iconClass} />}
          onClick={onReceive}
        >
          {t('wallet.receive')}
        </Button>
        <Button
          size="lg"
          className={buttonClass}
          icon={<ArrowUpRight aria-hidden="true" className={iconClass} />}
          disabled={sendDisabled}
          onClick={onSend}
        >
          {t('wallet.sendButton')}
        </Button>
      </div>
    </AppShellFooter>
  );
}
