import type { ReactElement } from 'react';
import { LoginCard } from '@/components/LoginCard';

/**
 * `/login` — the LNURL-auth sign-in page.
 */
export default function LoginPage(): ReactElement {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-10 px-6">
      <h1 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
        Log in to 21.gifts
      </h1>
      <LoginCard />
    </main>
  );
}
