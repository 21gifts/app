'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button } from '@/components/ui';
import { fetchMessages } from '@/lib/api';
import { SHOP_NPUB_RE, type ForumMessage } from '@/lib/api-types';
import { formatPlacePinText, isShopNote, SHOP_HASHTAG, stripShopHashtag } from '@/lib/forum-shop';
import { MissingRequirementsError } from '@/lib/missing-requirements';
import { useAuthStore } from '@/stores/auth-store';

/** Page size, same as the shops post list. */
const PAGE_LIMIT = 20;

/**
 * Shop name for the list: the place label when the pin is a structured shop,
 * otherwise the first real line of the note, else the stored name.
 *
 * @param message - Shop note.
 * @returns Link text.
 */
function shopLinkText(message: ForumMessage): string {
  const place = message.place;
  if (place !== undefined) {
    const label = place.label?.trim() ?? '';
    if (label !== '' && place.address !== undefined && place.address !== null) {
      return label;
    }
  }
  const line = stripShopHashtag(message.text)
    .split('\n')
    .map((part) => part.trim())
    .find((part) => part !== '' && part !== '#Shop');
  return line ?? message.name;
}

/**
 * List of shop pages. A row is a shop name linking to that shop's page.
 *
 * A forum note without a listed shop npub is not a row.
 *
 * @returns The list, empty copy, or an error with retry. Null without a session.
 */
export function ShopList(): ReactElement | null {
  const session = useAuthStore((state) => state.session);
  const router = useRouter();
  const replaceRef = useRef(router.replace);
  replaceRef.current = router.replace;
  const { t, locale } = useTranslations();
  const [rows, setRows] = useState<Array<ForumMessage & { shopNpub: string }> | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadId, setLoadId] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);

  useEffect(() => {
    if (session === null) {
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    void fetchMessages(session, {
      mode: 'all',
      limit: PAGE_LIMIT,
      hashtag: SHOP_HASHTAG,
      ...(cursor !== null ? { cursor } : {}),
    })
      .then((page) => {
        if (cancelled) {
          return;
        }
        const shops = page.messages
          .filter((row) => isShopNote(row.text))
          .filter(
            (row): row is ForumMessage & { shopNpub: string } =>
              typeof row.shopNpub === 'string' && SHOP_NPUB_RE.test(row.shopNpub),
          );
        setRows((prev) => (cursor === null || prev === null ? shops : [...prev, ...shops]));
        setNextCursor(page.nextCursor);
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (error instanceof MissingRequirementsError) {
          replaceRef.current('/setup/rules');
          return;
        }
        setFailed(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [session, loadId, cursor]);

  if (session === null) {
    return null;
  }

  if (failed && rows === null) {
    return (
      <div className="mt-4 flex flex-col items-center gap-3">
        <p role="alert" className="text-center text-sm text-app-danger">
          {t('forum.error')}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setCursor(null);
            setRows(null);
            setFailed(false);
            setLoadId((n) => n + 1);
          }}
        >
          {t('forum.retry')}
        </Button>
      </div>
    );
  }

  if (rows === null) {
    return <p className="mt-4 text-center text-sm text-app-muted">{t('map.loading')}</p>;
  }

  if (rows.length === 0 && nextCursor === null) {
    return <p className="mt-4 text-center text-sm text-app-fg">{t('shops.empty')}</p>;
  }

  return (
    <div className="mt-4 w-full min-w-0 max-w-full self-stretch">
      {rows.length === 0 ? null : (
        <ul className="flex w-full min-w-0 list-none flex-col gap-3 p-0 text-sm text-app-fg">
          {rows.map((row) => {
            const place = row.place;
            return (
              <li key={row.id} className="flex min-w-0 flex-col gap-1 break-words">
                <a href={`/${row.shopNpub}`} className="underline">
                  {shopLinkText(row)}
                </a>
                {place !== undefined ? (
                  <p className="text-sm text-app-muted">{formatPlacePinText(place, locale)}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
      {failed ? (
        <div className="mt-3 flex flex-col items-center gap-3">
          <p role="alert" className="text-center text-sm text-app-danger">
            {t('forum.error')}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setFailed(false);
              setLoadId((n) => n + 1);
            }}
          >
            {t('forum.retry')}
          </Button>
        </div>
      ) : null}
      {nextCursor !== null ? (
        <Button
          type="button"
          variant="secondary"
          className="mt-3"
          disabled={loading}
          onClick={() => {
            setCursor(nextCursor);
            setLoadId((n) => n + 1);
          }}
        >
          {t('shops.showMore')}
        </Button>
      ) : null}
    </div>
  );
}
