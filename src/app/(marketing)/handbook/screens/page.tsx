import { pathToFileURL } from 'node:url';
import path from 'node:path';
import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { HandbookCopyLink } from '@/components/HandbookCopyLink';
import { HandbookImageViewer } from '@/components/HandbookImageViewer';
import { HandbookIntro } from '@/components/HandbookIntro';
import { HANDBOOK_COMBOS, type HandbookComboId, type HandbookTopic } from '@/lib/handbook-topics';
import { getCatalog } from '@/lib/messages';
import { getRequestLocale } from '@/lib/request-locale';
import { translate } from '@/lib/translate';

/**
 * Title and description for `/handbook/screens`.
 */
export const metadata: Metadata = {
  title: 'Screens — Handbook — 21.gifts',
  description: 'Screen variants for the 21.gifts app, with baseline switches.',
};

/**
 * Async screens handbook page: one topic viewer with Desktop/Mobile and
 * Light/Dark switches for existing combos only.
 *
 * @returns The screens handbook screen.
 */
export default async function HandbookScreensPage(): Promise<ReactElement> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);
  const topics = await loadScreenTopics();
  const title = translate(messages, 'handbook.screensTitle');
  return (
    <main className="mx-auto max-w-[1100px] px-5 py-24">
      <HandbookIntro
        title={title}
        introBefore={translate(messages, 'handbook.screensLead')}
        introAfter=""
        navAria={translate(messages, 'aria.handbookSections')}
        headingAction={<HandbookCopyLink targetId="handbook" label={title} />}
      >
        <a href="/handbook" className="text-[#f7931a] underline underline-offset-2">
          {translate(messages, 'handbook.title')}
        </a>
        <a href="/handbook/functions" className="text-[#f7931a] underline underline-offset-2">
          {translate(messages, 'handbook.functionsTitle')}
        </a>
        <a href="/handbook/endpoints" className="text-[#f7931a] underline underline-offset-2">
          {translate(messages, 'handbook.endpointsTitle')}
        </a>
      </HandbookIntro>
      <HandbookImageViewer topics={topics} />
    </main>
  );
}

/**
 * Load screen-variant topics from `scripts/screen-variants.mjs`.
 *
 * @returns Topics with existing combo ids.
 */
async function loadScreenTopics(): Promise<HandbookTopic[]> {
  const href = pathToFileURL(path.join(process.cwd(), 'scripts', 'screen-variants.mjs')).href;
  const mod = (await import(href)) as {
    SCREEN_VARIANTS: Array<{
      route: string;
      id: string;
      visual: string;
      combos?: string[];
    }>;
    variantComboIds: (variant: { combos?: string[] }) => string[];
  };
  const allowed = new Set<string>(HANDBOOK_COMBOS);
  return mod.SCREEN_VARIANTS.map((variant) => ({
    id: `${variant.route}:${variant.id}`,
    label: `${variant.route} ${variant.id}`,
    visual: variant.visual,
    combos: mod
      .variantComboIds(variant)
      .filter((combo): combo is HandbookComboId => allowed.has(combo)),
  })).filter((topic) => topic.combos.length > 0);
}
