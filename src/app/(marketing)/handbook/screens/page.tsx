import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';
import type { Locale } from '@/lib/locale';
import { HandbookCopyLink } from '@/components/HandbookCopyLink';
import { HandbookImageViewer } from '@/components/HandbookImageViewer';
import { HandbookIntro } from '@/components/HandbookIntro';
import { loadHandbookDocuments } from '@/lib/handbook';
import { HANDBOOK_COMBOS, type HandbookComboId, type HandbookTopic } from '@/lib/handbook-topics';
import { parseScreenVariantDescriptions } from '@/lib/screen-variant-descriptions';
import { screenVariantDescription } from '@/lib/screen-variant-locale';
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
 * Async screens handbook page: compact screen-variant cards under global
 * Desktop/Mobile and Light/Dark switches for existing combos only.
 *
 * @returns The screens handbook screen.
 */
export default async function HandbookScreensPage(): Promise<ReactElement> {
  const locale = await getRequestLocale();
  const messages = getCatalog(locale);
  const topics = loadScreenTopics(locale);
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
        <Link href="/handbook" className="text-accent underline underline-offset-2">
          {translate(messages, 'handbook.title')}
        </Link>
        <Link href="/handbook/functions" className="text-accent underline underline-offset-2">
          {translate(messages, 'handbook.functionsTitle')}
        </Link>
        <Link href="/handbook/endpoints" className="text-accent underline underline-offset-2">
          {translate(messages, 'handbook.endpointsTitle')}
        </Link>
      </HandbookIntro>
      <HandbookImageViewer topics={topics} />
    </main>
  );
}

/**
 * Screen-variant topics from the catalog written by `sync-handbook-images.mjs`.
 * English card text comes from `docs/handbook/screens.md`; other locales use the
 * screen-card locale file. Missing English shows the catalog label.
 *
 * @param locale - Request UI locale for the card description.
 * @returns Topics with existing combo ids and a description or catalog label.
 */
function loadScreenTopics(locale: Locale): HandbookTopic[] {
  const allowed = new Set<string>(HANDBOOK_COMBOS);
  const screensDoc = loadHandbookDocuments().find((doc) => doc.id === 'screens');
  if (screensDoc === undefined) {
    throw new Error('Handbook screens document missing');
  }
  const descriptions = parseScreenVariantDescriptions(screensDoc.markdown);
  return screenVariantCatalog
    .map((row) => ({
      id: row.id,
      label: row.label,
      visual: row.visual,
      description: screenVariantDescription(locale, row.id, descriptions.get(row.id), row.label),
      combos: row.combos.filter((combo): combo is HandbookComboId => allowed.has(combo)),
    }))
    .filter((topic) => topic.combos.length > 0);
}
