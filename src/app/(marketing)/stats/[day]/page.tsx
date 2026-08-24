import type { ReactElement } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DayLoader } from '@/app/(marketing)/stats/[day]/day-loader';
import { isUtcDay } from '@/lib/utc-day';

/**
 * `/stats/[day]` — public list of outbound gifts on one UTC calendar day.
 *
 * @param props - Dynamic route params.
 * @returns The day screen, or a 404 when `day` is not a real UTC date.
 */
export default async function GiftDayPage({
  params,
}: {
  params: Promise<{ day: string }>;
}): Promise<ReactElement> {
  const { day } = await params;
  if (!isUtcDay(day)) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-[1100px] px-5 pt-16 pb-24">
      <p className="text-sm text-white/50">
        <Link href="/stats" className="text-[#f7931a] underline">
          All stats
        </Link>
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">{`Gifts on ${day}`}</h1>
      <p className="mt-3 max-w-2xl text-lg text-white/60">Each outbound gift that UTC day.</p>
      <DayLoader day={day} />
    </main>
  );
}
