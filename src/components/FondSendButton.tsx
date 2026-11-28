'use client';

import type { ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { ButtonLink } from '@/components/ui';
import { useActiveSession } from '@/hooks/useActiveSession';
import { SEND_LINK_PARAM } from '@/hooks/useSendLink';
import { useWallet } from '@/hooks/useWallet';
import { useAuthStore } from '@/stores/auth-store';

/** Props for {@link FondSendButton}. */
export interface FondSendButtonProps {
  /** Fond handle from the summary; its `<username>@<host>` address is paid. */
  username: string;
}

/**
 * **Send from your wallet** on the public Fond page: a full-width primary pill
 * link that opens the existing Send flow of `/wallet` with the Fond's own
 * address already read (`/wallet?send=<username>`, see `useSendLink`), through
 * the client-side router. The member then types the amount in `AmountEntry`,
 * confirms, and sees **Sent** or the alert of a payment that did not go out,
 * like every other payment to an address from the in-app wallet.
 *
 * Shown only to a signed-in member whose wallet is open in this tab
 * (`useActiveSession`) and ready (`useWallet`), and never to the Fond account
 * itself, which would pay itself. A signed-out visitor, a login whose wallet
 * is still opening, and a wallet that is connecting, failed, or not available
 * get nothing here; the page keeps the address and QR above.
 *
 * @param props - The Fond handle.
 * @returns The link, or `null` when it does not apply.
 */
export function FondSendButton({ username }: FondSendButtonProps): ReactElement | null {
  const { t } = useTranslations();
  const session = useActiveSession();
  const ownUsername = useAuthStore((state) => state.account?.username ?? null);
  const wallet = useWallet();
  const fond = username.trim().toLowerCase();
  if (
    session === null ||
    wallet.status !== 'ready' ||
    fond === '' ||
    ownUsername?.trim().toLowerCase() === fond
  ) {
    return null;
  }
  return (
    <ButtonLink
      href={`/wallet?${SEND_LINK_PARAM}=${encodeURIComponent(fond)}`}
      size="lg"
      className="max-w-[266px]"
    >
      {t('fond.depositSend')}
    </ButtonLink>
  );
}
