'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactElement, type ReactNode } from 'react';
import { WalletLoginCard } from '@/components/WalletLoginCard';
import { useHydrateSession } from '@/hooks/useHydrateSession';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { useWalletOpen } from '@/hooks/useWalletOpen';
import { nextOnboardingPath } from '@/lib/onboarding';
import { returnToView } from '@/lib/view-history';
import { useAuthStore } from '@/stores/auth-store';

/** Which post-login screen this gate is wrapping. */
export type OnboardingScreen =
  'login' | 'wallet' | 'name' | 'username' | 'rules' | 'welcome' | 'profile';

const PATH: Record<
  Exclude<OnboardingScreen, 'login' | 'profile' | 'wallet'>,
  '/setup/name' | '/setup/username' | '/setup/rules' | '/welcome'
> = {
  name: '/setup/name',
  username: '/setup/username',
  rules: '/setup/rules',
  welcome: '/welcome',
};

/** Props for {@link OnboardingGate}. */
interface OnboardingGateProps {
  /** The screen this tree is rendering. */
  screen: OnboardingScreen;
  /** Visible UI when this is the correct screen. */
  children: ReactNode;
  /**
   * Signed-out exception for the living room, `/statistics`, and
   * `/habit-tracker`; it does not cover a held-back session.
   * Other `screen="welcome"` routes (shops, inbox, notifications, trust,
   * contact, moderation) still send a signed-out visitor to `/login`.
   */
  allowGuest?: boolean;
}

/**
 * Hydrates the session and sends the visitor to the matching onboarding screen.
 * The recovery phrase is not a setup step: {@link nextOnboardingPath} never
 * returns `/wallet`.
 *
 * Signed in means the wallet is open in this tab ({@link useWalletOpen}). Every
 * screen but `login` shows {@link WalletLoginCard} in place of its children,
 * on the same path and without a redirect, while a stored session is held
 * back (`lockedSession`) or a fresh login is still opening its wallet; the
 * screen shows once the wallet is open. That includes the screens open to
 * guests (`allowGuest`): a held-back session is a member, so they show the
 * card instead of the guest view; only a visitor without any stored session
 * sees the guest view. `/login`
 * itself sends a fresh login on only once its wallet is open, and shows
 * {@link WalletLoginCard} meanwhile and while a session is held back, so a
 * wallet that could not be opened keeps its alert there.
 *
 * @param props - See {@link OnboardingGateProps}.
 * @returns Children, or a spinner while redirecting.
 */
export function OnboardingGate({
  screen,
  children,
  allowGuest = false,
}: OnboardingGateProps): ReactElement {
  const { ready } = useHydrateSession();
  const router = useRouter();
  const { cancel } = usePasskeyLogin();
  const account = useAuthStore((state) => state.account);
  const lockedSession = useAuthStore((state) => state.lockedSession);
  const walletOpen = useWalletOpen();
  // A held-back session is a member, not a guest: screens open to guests show
  // the login card for it too.
  const locked = screen !== 'login' && (account !== null ? !walletOpen : lockedSession !== null);
  // `/login` leaves only once the wallet is open; until then, and while a
  // session is held back, it shows the same card, so its alert outlives a
  // wallet that could not be opened.
  const loginOpening =
    screen === 'login' && (account !== null ? !walletOpen : lockedSession !== null);

  useEffect(() => {
    if (!ready || locked) {
      return;
    }
    if (screen === 'login') {
      if (account !== null && walletOpen) {
        cancel();
        returnToView(nextOnboardingPath(account), router);
      }
      return;
    }
    if (account === null) {
      if (screen === 'welcome' && allowGuest) {
        return;
      }
      returnToView('/login', router);
      return;
    }
    if (screen === 'profile') {
      const next = nextOnboardingPath(account);
      if (next !== '/welcome') {
        returnToView(next, router);
      }
      return;
    }
    if (screen === 'wallet') {
      const next = nextOnboardingPath(account);
      if (next !== '/welcome' && account.setup !== 'wallet') {
        returnToView(next, router);
      }
      return;
    }
    const target = nextOnboardingPath(account);
    if (target !== PATH[screen]) {
      returnToView(target, router);
    }
  }, [account, allowGuest, cancel, locked, ready, router, screen, walletOpen]);

  if (!ready) {
    return <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-app-subtle" />;
  }
  if (screen === 'login') {
    return loginOpening ? <WalletLoginCard /> : <>{children}</>;
  }
  if (locked) {
    return <WalletLoginCard />;
  }
  if (screen === 'profile') {
    if (account !== null && nextOnboardingPath(account) === '/welcome') {
      return <>{children}</>;
    }
    return <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-app-subtle" />;
  }
  if (screen === 'wallet') {
    if (account !== null) {
      const next = nextOnboardingPath(account);
      if (next === '/welcome' || account.setup === 'wallet') {
        return <>{children}</>;
      }
    }
    return <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-app-subtle" />;
  }
  if (screen === 'welcome' && allowGuest && account === null) {
    return <>{children}</>;
  }
  if (account !== null && nextOnboardingPath(account) === PATH[screen]) {
    return <>{children}</>;
  }
  return <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-app-subtle" />;
}
