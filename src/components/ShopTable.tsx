'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { ShopNoteEditControl } from '@/components/ShopNoteEditControl';
import { Button } from '@/components/ui';
import { fetchMessages } from '@/lib/api';
import type { ForumMessage } from '@/lib/api-types';
import { isShopNote, SHOP_HASHTAG, stripShopHashtag } from '@/lib/forum-shop';
import { MissingRequirementsError } from '@/lib/missing-requirements';
import { useAuthStore } from '@/stores/auth-store';

/** Page size, same as the shops post list. */
const PAGE_LIMIT = 20;

/**
 * Shop name for the table: the first real line of the note, else the stored name.
 *
 * @param message - Shop note.
 * @returns Display name.
 */
function shopDisplayName(message: ForumMessage): string {
  const line = stripShopHashtag(message.text)
    .split('\n')
    .map((part) => part.trim())
    .find((part) => part !== '' && part !== '#Shop');
  return line ?? message.name;
}

/**
 * Place cell: the label, or coordinates when the pin has no name.
 *
 * @param message - Shop note.
 * @returns Link text, or null when the note has no pin.
 */
function placeText(message: ForumMessage): string | null {
  const place = message.place;
  if (place === undefined) {
    return null;
  }
  if (typeof place.label === 'string' && place.label.trim() !== '') {
    return place.label;
  }
  return `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`;
}

/**
 * Table of loaded shop notes: name, place, and operator.
 *
 * @returns The table, empty copy, or an error with retry. Null without a session.
 */
export function ShopTable(): ReactElement | null {
  const session = useAuthStore((state) => state.session);
  const router = useRouter();
  const replaceRef = useRef(router.replace);
  replaceRef.current = router.replace;
  const { t } = useTranslations();
  const [rows, setRows] = useState<ForumMessage[] | null>(null);
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
        const shops = page.messages.filter((row) => isShopNote(row.text));
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
    <div className="mt-4">
      {rows.length === 0 ? null : (
        <table className="w-full text-left text-sm text-app-fg">
          <thead>
            <tr className="text-app-muted">
              <th scope="col" className="py-2 pr-3 font-medium">
                {t('shops.columnName')}
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                {t('shops.columnPlace')}
              </th>
              <th scope="col" className="py-2 font-medium">
                {t('shops.columnOperator')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const place = placeText(row);
              const operator = row.shopAccount;
              return (
                <tr key={row.id} className="border-t border-app-border">
                  <td className="py-2 pr-3">
                    <span className="inline-flex items-center gap-2">
                      {shopDisplayName(row)}
                      <ShopNoteEditControl
                        message={row}
                        onUpdated={(updated) => {
                          setRows((current) => {
                            /* v8 ignore next 3 -- the table is on screen before a row editor can save */
                            if (current === null) {
                              return current;
                            }
                            return current.map((item) => (item.id === updated.id ? updated : item));
                          });
                        }}
                      />
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    {place === null ? (
                      t('shops.missing')
                    ) : (
                      <a href={`/map?pin=${row.id}`} className="underline">
                        {place}
                      </a>
                    )}
                  </td>
                  <td className="py-2">
                    {operator === undefined ? (
                      t('shops.missing')
                    ) : (
                      <a href={`/members/${operator.id}`} className="underline">
                        @{operator.username}
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
