'use client';

import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { isSundayRest } from '@/lib/sunday-rest';

/**
 * Replaces the entire application on Manila Sundays, including open PWA windows.
 * @param props - Server clock snapshot, translated message, and application tree.
 * @returns Rest message or the application's children.
 */
export function SundayRestGate({
  children,
  serverNow,
  title,
  message,
  schedule,
}: {
  children: ReactNode;
  serverNow: number;
  title: string;
  message: string;
  schedule: string;
}): ReactElement {
  const [paused, setPaused] = useState(isSundayRest(serverNow));
  useEffect(() => {
    // Advance the server's clock monotonically, ignoring device timezone/clock changes.
    const baseline = performance.now();
    const check = (): void => {
      const resting = isSundayRest(serverNow + performance.now() - baseline);
      if (!resting && isSundayRest(serverNow)) {
        window.location.reload();
        return;
      }
      setPaused(resting);
    };
    check();
    const timer = setInterval(check, 250);
    window.addEventListener('focus', check);
    window.addEventListener('pageshow', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', check);
      window.removeEventListener('pageshow', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [serverNow]);
  if (!paused) return <>{children}</>;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-app-bg px-6 py-16 text-app-fg">
      <section className="mx-auto max-w-xl text-center" aria-labelledby="sunday-title">
        <p className="mb-8 text-lg font-semibold">21.gifts</p>
        <h1 id="sunday-title" className="text-3xl font-semibold">
          {title}
        </h1>
        <p className="mt-6 text-lg leading-relaxed">{message}</p>
        <p className="mt-8 text-sm text-app-muted">{schedule}</p>
      </section>
    </main>
  );
}
