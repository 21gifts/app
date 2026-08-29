'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactElement, type ReactNode } from 'react';
import { useHydrateSession } from '@/hooks/useHydrateSession';
import { usePasskeyLogin } from '@/hooks/usePasskeyLogin';
import { nextOnboardingPath } from '@/lib/onboarding';
import { useAuthStore } from '@/stores/auth-store';

/** Which post-login screen this gate is wrapping. */
export type OnboardingScreen = 'login' | 'name' | 'address' | 'rules' | 'welcome' | 'profile';

const PATH: Record<
  Exclude<OnboardingScreen, 'login' | 'profile'>,
  '/setup/name' | '/setup/address' | '/setup/rules' | '/welcome'
> = {
  name: '/setup/name',
  address: '/setup/address',
  rules: '/setup/rules',
  welcome: '/welcome',
};

/** Props for {@link OnboardingGate}. */
interface OnboardingGateProps {
  /** The screen this tree is rendering. */
  screen: OnboardingScreen;
  /** Visible UI when this is the correct screen. */
  children: ReactNode;
}

/**
 * Hydrates the session and sends the visitor to the matching onboarding screen.
 *
 * @param props - See {@link OnboardingGateProps}.
 * @returns Children, or a spinner while redirecting.
 */
export function OnboardingGate({ screen, children }: OnboardingGateProps): ReactElement {
  const { ready } = useHydrateSession();
  const router = useRouter();
  const { cancel } = usePasskeyLogin();
  const account = useAuthStore((state) => state.account);

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (screen === 'login') {
      if (account !== null) {
        cancel();
        router.replace(nextOnboardingPath(account));
      }
      return;
    }
    if (account === null) {
      router.replace('/login');
      return;
    }
    if (screen === 'profile') {
      const next = nextOnboardingPath(account);
      if (next !== '/welcome') {
        router.replace(next);
      }
      return;
    }
    const target = nextOnboardingPath(account);
    if (target !== PATH[screen]) {
      router.replace(target);
    }
  }, [account, cancel, ready, router, screen]);

  if (!ready) {
    return <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-neutral-400" />;
  }
  if (screen === 'login') {
    return <>{children}</>;
  }
  if (screen === 'profile') {
    if (account !== null && nextOnboardingPath(account) === '/welcome') {
      return <>{children}</>;
    }
    return <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-neutral-400" />;
  }
  if (account === null || nextOnboardingPath(account) !== PATH[screen]) {
    return <Loader2 aria-hidden="true" className="h-8 w-8 animate-spin text-neutral-400" />;
  }
  return <>{children}</>;
}
