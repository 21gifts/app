import type { ReactElement, ReactNode } from 'react';

/**
 * Title, intro, and section nav chrome for `/handbook` (already-translated copy).
 *
 * @param props - Already-translated title, intro fragments, nav aria-label, and section-nav links as `children`.
 * @returns The heading, intro paragraph, and section nav.
 */
export function HandbookIntro(props: {
  title: string;
  introBefore: string;
  introAfter: string;
  navAria: string;
  children: ReactNode;
}): ReactElement {
  return (
    <>
      <h1 id="handbook" className="scroll-mt-24 text-3xl font-semibold">
        {props.title}
      </h1>
      <p className="mt-4 text-white/60">
        {props.introBefore}{' '}
        <a
          className="text-[#f7931a] underline underline-offset-2"
          href="https://github.com/21gifts/api/tree/develop/docs/handbook"
        >
          21gifts/api
        </a>
        {props.introAfter}
      </p>
      <nav aria-label={props.navAria} className="mt-8 flex flex-wrap gap-4 text-sm">
        {props.children}
      </nav>
    </>
  );
}
