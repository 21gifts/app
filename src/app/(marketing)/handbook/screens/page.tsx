import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import { HandbookCopyLink } from '@/components/HandbookCopyLink';
import { HandbookImageViewer } from '@/components/HandbookImageViewer';
import { HandbookIntro } from '@/components/HandbookIntro';
import { HANDBOOK_COMBOS, type HandbookComboId, type HandbookTopic } from '@/lib/handbook-topics';
import screenVariantCatalog from '@/lib/screen-variant-catalog.json';
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
  const topics = loadScreenTopics();
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
        <a href="/handbook" className="text-accent underline underline-offset-2">
          {translate(messages, 'handbook.title')}
        </a>
        <a href="/handbook/functions" className="text-accent underline underline-offset-2">
          {translate(messages, 'handbook.functionsTitle')}
        </a>
        <a href="/handbook/endpoints" className="text-accent underline underline-offset-2">
          {translate(messages, 'handbook.endpointsTitle')}
        </a>
      </HandbookIntro>
      <HandbookImageViewer topics={topics} />
    </main>
  );
}

/**
 * Screen-variant topics from the catalog written by `sync-handbook-images.mjs`.
 *
 * @returns Topics with existing combo ids.
 */
function loadScreenTopics(): HandbookTopic[] {
  const allowed = new Set<string>(HANDBOOK_COMBOS);
  return screenVariantCatalog
    .map((row) => ({
      id: row.id,
      label: row.label,
      visual: row.visual,
      combos: row.combos.filter((combo): combo is HandbookComboId => allowed.has(combo)),
    }))
    .filter((topic) => topic.combos.length > 0);
}
