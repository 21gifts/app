'use client';

import { User, X } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, IconButton } from '@/components/ui';
import { setMessageShopAccount } from '@/lib/api';
import type { ForumMessage } from '@/lib/api-types';
import { isShopNote } from '@/lib/forum-shop';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/** Props for the shops-feed staff account editor. */
export interface ShopAccountControlProps {
  /** Top-level shop note to attach an account to. */
  message: ForumMessage;
  /** Apply the saved account (or `null` when cleared) to the listed row. */
  onUpdated: (
    messageId: string,
    shopAccount: { id: string; username: string; name: string } | null,
  ) => void;
}

/**
 * Moderator-only shop-account editor on a shop note. Absent on replies, hidden
 * notes, non-shop text, and ranks below moderator.
 *
 * @param props - Note and successful-save callback.
 * @returns The compact account control, or null when it must not edit.
 */
export function ShopAccountControl({
  message,
  onUpdated,
}: ShopAccountControlProps): ReactElement | null {
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(message.shopAccount?.username ?? '');
  const [errorKey, setErrorKey] = useState<'missing' | 'failed' | null>(null);

  if (
    message.parentId !== undefined ||
    message.deletedAt !== undefined ||
    !isShopNote(message.text) ||
    session === null ||
    !roleAtLeast(account?.role, 'moderator')
  ) {
    return null;
  }

  const token = session;
  const hasAccount = message.shopAccount !== undefined;
  const ariaLabel = hasAccount ? t('forum.editShopAccount') : t('forum.addShopAccount');

  const saveUsername = async (): Promise<void> => {
    let trimmed = draft.trim();
    if (trimmed.startsWith('@')) {
      trimmed = trimmed.slice(1);
    }
    if (trimmed === '') {
      setErrorKey('missing');
      return;
    }
    setSaving(true);
    setErrorKey(null);
    try {
      const updated = await setMessageShopAccount(token, message.id, trimmed);
      onUpdated(message.id, updated.shopAccount ?? null);
      setOpen(false);
      setErrorKey(null);
    } catch (err) {
      if (err instanceof Error && err.message === 'No account with that username') {
        setErrorKey('missing');
      } else {
        setErrorKey('failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const removeAccount = async (): Promise<void> => {
    setSaving(true);
    setErrorKey(null);
    try {
      await setMessageShopAccount(token, message.id, null);
      onUpdated(message.id, null);
      setOpen(false);
      setErrorKey(null);
    } catch {
      setErrorKey('failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="relative shrink-0"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <IconButton
        type="button"
        size="sm"
        variant="ghost"
        aria-label={ariaLabel}
        title={ariaLabel}
        aria-expanded={open}
        disabled={saving}
        onClick={() => {
          setOpen((current) => {
            if (!current) {
              setDraft(message.shopAccount?.username ?? '');
              setErrorKey(null);
            }
            return !current;
          });
        }}
      >
        <User aria-hidden="true" className="h-4 w-4 shrink-0" />
      </IconButton>
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-2 w-[min(90vw,24rem)] rounded-2xl border border-app-border bg-app-card-muted p-3">
          <input
            type="text"
            aria-label={t('forum.shopAccountLabel')}
            value={draft}
            disabled={saving}
            onChange={(event) => {
              setDraft(event.target.value);
            }}
            className="mt-0 w-full rounded-2xl border border-app-border-strong px-4 py-2.5 text-base text-app-fg"
          />
          {errorKey !== null ? (
            <p role="alert" className="mt-3 text-sm text-app-danger">
              {errorKey === 'missing'
                ? t('forum.shopAccountMissing')
                : t('forum.shopAccountSaveFailed')}
            </p>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            className="mt-3"
            disabled={saving}
            onClick={() => {
              void saveUsername();
            }}
          >
            {t('forum.shopAccountSave')}
          </Button>
          {hasAccount ? (
            <IconButton
              type="button"
              size="sm"
              variant="secondary"
              className="mt-3"
              aria-label={t('forum.shopAccountRemove')}
              disabled={saving}
              onClick={() => {
                void removeAccount();
              }}
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </IconButton>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
