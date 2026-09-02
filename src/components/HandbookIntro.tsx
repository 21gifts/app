import type { ReactElement, ReactNode } from 'react';

/**
 * Title, intro, and section nav chrome for `/handbook` (already-translated copy).
 *
 * @param props - Already-translated title, intro fragments, nav aria-label,
 *   optional heading action (e.g. copy-link) beside the h1, and section-nav
 *   links as `children`.
 * @returns The heading, intro paragraph, and section nav.
 */
export function HandbookIntro(props: {
  title: string;
  introBefore: string;
  introAfter: string;
  navAria: string;
  headingAction: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <>
      <div className="flex flex-wrap items-baseline gap-2">
        <h1 id="handbook" className="scroll-mt-24 text-3xl font-semibold">
          {props.title}
        </h1>
        {props.headingAction}
      </div>
      <p className="mt-4 text-paper/60">
        {props.introBefore}
        {props.introAfter !== '' ? (
          <>
            {' '}
            <a
              className="text-accent underline underline-offset-2"
              href="https://github.com/21gifts/api/tree/develop/docs/handbook"
            >
              21gifts/api
            </a>
            {props.introAfter}
          </>
        ) : null}
      </p>
      <nav aria-label={props.navAria} className="mt-8 flex flex-wrap gap-4 text-sm">
        {props.children}
      </nav>
    </>
  );
}
