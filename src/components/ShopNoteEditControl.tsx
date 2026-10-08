'use client';

import { Pencil } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { ShopAddWizard, type ShopKeptMedia } from '@/components/ShopAddWizard';
import { SundayWritingGate } from '@/components/SundayWritingGate';
import { IconButton } from '@/components/ui';
import {
  fetchMessagePhoto,
  fetchShopNoteEdits,
  setMessagePlace,
  setMessageShopAccount,
  setMessageShopPhotos,
  setMessageShopText,
  type ShopNoteEdit,
} from '@/lib/api';
import { FORUM_MESSAGE_MAX_LENGTH, type ForumMessage, type ForumPlacePin } from '@/lib/api-types';
import { prepareForumPhoto, type ForumPhotoPayload } from '@/lib/forum-photo';
import { ensureShopHashtag, isShopNote, stripShopHashtag } from '@/lib/forum-shop';
import { formatForumTime } from '@/lib/forum-time';
import { forumVideoSrc } from '@/lib/forum-video';
import { roleAtLeast } from '@/lib/roles';
import { useAuthStore } from '@/stores/auth-store';

/** Props for the shop-note editor. */
export interface ShopNoteEditControlProps {
  /** Top-level shop note to edit. */
  message: ForumMessage;
  /** Apply the saved note to the listed row. Runs after each saved part of the note. */
  onUpdated: (message: ForumMessage) => void;
  /** Runs once after every changed part of the note is saved. */
  onSaved?: () => void;
  /** Still previews already loaded for this note, in order. */
  existingPhotos?: readonly string[];
  /** Video preview already loaded for this note. */
  existingVideoUrl?: string;
  /** Open the steps immediately. Used after the map pencil has loaded the note. */
  startOpen?: boolean;
}

/**
 * Short label for one history value.
 *
 * @param field - Which column changed.
 * @param value - Stored before or after value.
 * @param none - Copy used when the value is empty or not the expected shape.
 * @returns Visible text for that value.
 */
function editValueText(field: ShopNoteEdit['field'], value: unknown, none: string): string {
  if (value === null || value === undefined) {
    return none;
  }
  if (field === 'text') {
    return typeof value === 'string' ? stripShopHashtag(value) : none;
  }
  if (typeof value !== 'object' || Array.isArray(value)) {
    return none;
  }
  if (field === 'place') {
    const place = value as { lat?: unknown; lng?: unknown; label?: unknown };
    if (typeof place.label === 'string' && place.label.trim() !== '') {
      return place.label;
    }
    if (typeof place.lat === 'number' && typeof place.lng === 'number') {
      return `${place.lat}, ${place.lng}`;
    }
    return none;
  }
  const account = value as { username?: unknown };
  return typeof account.username === 'string' ? `@${account.username}` : none;
}

function placeStamp(place: ForumPlacePin | null): string {
  if (place === null) {
    return '';
  }
  return `${place.lat},${place.lng},${place.label ?? ''}`;
}

function placesEqual(left: ForumPlacePin | null, right: ForumPlacePin | null): boolean {
  return placeStamp(left) === placeStamp(right);
}

function usernameOf(value: string): string {
  return value.trim().replace(/^@/, '');
}

const KEPT_STILL_TYPES = new Set(['image/png', 'image/webp']);

function keptStillType(type: string): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (KEPT_STILL_TYPES.has(type)) {
    return type as 'image/png' | 'image/webp';
  }
  return 'image/jpeg';
}

function encodeBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

type KeptStillBytes = {
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  data: string;
};

async function stillFromUrl(url: string): Promise<KeptStillBytes> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Could not save shop note');
  }
  const blob = await response.blob();
  const data = encodeBytes(new Uint8Array(await blob.arrayBuffer()));
  return { contentType: keptStillType(blob.type), data };
}

/**
 * Copy already-shown stills onto addresses this editor owns.
 * A partial save revokes the feed addresses. These copies stay.
 * A failed copy revokes only the copies, never the feed addresses.
 */
async function ownFeedStills(
  feedUrls: readonly string[],
  owned: string[],
  cache: Map<string, KeptStillBytes>,
): Promise<string[]> {
  for (const url of owned) {
    URL.revokeObjectURL(url);
  }
  owned.length = 0;
  const copies: string[] = [];
  try {
    for (const feedUrl of feedUrls) {
      const response = await fetch(feedUrl);
      if (!response.ok) {
        throw new Error('Could not save shop note');
      }
      const blob = await response.blob();
      const copy = URL.createObjectURL(blob);
      owned.push(copy);
      copies.push(copy);
      cache.set(copy, {
        contentType: keptStillType(blob.type),
        data: encodeBytes(new Uint8Array(await blob.arrayBuffer())),
      });
    }
    return copies;
  } catch (error) {
    for (const url of owned) {
      URL.revokeObjectURL(url);
    }
    owned.length = 0;
    cache.clear();
    throw error;
  }
}

/**
 * Moderator-only editor and edit history on a shop note. The pencil opens the
 * same steps as adding a shop, filled with the current text, place, pictures,
 * and 21.gifts user. Absent on replies, hidden notes, non-shop text, and ranks
 * below moderator.
 *
 * @param props - Note, loaded media, the per-part update callback, and the optional
 * whole-save callback.
 * @returns The pencil, or null when it must not edit.
 */
export function ShopNoteEditControl({
  message,
  onUpdated,
  onSaved,
  existingPhotos = [],
  existingVideoUrl,
  startOpen = false,
}: ShopNoteEditControlProps): ReactElement | null {
  const account = useAuthStore((state) => state.account);
  const session = useAuthStore((state) => state.session);
  const { t, locale } = useTranslations();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [place, setPlace] = useState<ForumPlacePin | null>(null);
  const [username, setUsername] = useState('');
  const [kept, setKept] = useState<ShopKeptMedia[]>([]);
  const [photoDrafts, setPhotoDrafts] = useState<ForumPhotoPayload[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [history, setHistory] = useState<ShopNoteEdit[] | null>(null);
  const [historyError, setHistoryError] = useState(false);
  const [photoBaseline, setPhotoBaseline] = useState<readonly string[]>([]);
  const [photosReady, setPhotosReady] = useState(false);
  const ownedPhotoUrls = useRef<string[]>([]);
  const openEditorRef = useRef<(() => void) | null>(null);
  const openingRef = useRef(false);
  // Bytes read before the feed revokes preview URLs. A later step can fail
  // and leave this panel open; the next save must not fetch those URLs again.
  const keptStillBytes = useRef(new Map<string, KeptStillBytes>());

  function revokeOwnedPhotos(): void {
    for (const url of ownedPhotoUrls.current) {
      URL.revokeObjectURL(url);
    }
    ownedPhotoUrls.current.length = 0;
  }

  useEffect(() => {
    if (!startOpen) {
      return;
    }
    openEditorRef.current?.();
  }, [startOpen]);

  useEffect(() => {
    return () => {
      revokeOwnedPhotos();
    };
  }, []);

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

  async function openEditor(): Promise<void> {
    if (openingRef.current) {
      return;
    }
    openingRef.current = true;
    try {
      keptStillBytes.current.clear();
      setDraft(stripShopHashtag(message.text));
      setPlace(message.place ?? null);
      setUsername(message.shopAccount?.username ?? '');
      setPhotoDrafts([]);
      setSaveError(false);
      setHistory(null);
      setHistoryError(false);
      let photos = existingPhotos.length >= message.photoCount ? [...existingPhotos] : [];
      if (photos.length < message.photoCount) {
        setKept([]);
        setPhotoBaseline([]);
        revokeOwnedPhotos();
        try {
          const loaded: string[] = [];
          for (let index = 0; index < message.photoCount; index += 1) {
            const blob = await fetchMessagePhoto(token, message.id, index);
            const url = URL.createObjectURL(blob);
            ownedPhotoUrls.current.push(url);
            loaded.push(url);
          }
          photos = loaded;
        } catch {
          setKept([]);
          setPhotoBaseline([]);
          revokeOwnedPhotos();
          setPhotosReady(false);
          setSaveError(true);
          setOpen(true);
          return;
        }
      } else if (photos.length > 0) {
        try {
          photos = await ownFeedStills(photos, ownedPhotoUrls.current, keptStillBytes.current);
        } catch {
          setKept([]);
          setPhotoBaseline([]);
          setPhotosReady(false);
          setSaveError(true);
          setOpen(true);
          return;
        }
      }
      setPhotosReady(true);
      const video =
        existingVideoUrl ??
        (message.hasVideo ? forumVideoSrc(message.id, message.videoContentType) : '');
      setPhotoBaseline(photos);
      setKept([
        ...photos.map((url) => ({ url, kind: 'photo' as const })),
        ...(video !== '' ? [{ url: video, kind: 'video' as const }] : []),
      ]);
      setOpen(true);
      void fetchShopNoteEdits(token, message.id)
        .then((rows) => {
          setHistory(rows);
        })
        .catch(() => {
          setHistoryError(true);
        });
    } finally {
      openingRef.current = false;
    }
  }

  openEditorRef.current = () => {
    void openEditor();
  };

  /* v8 ignore start -- edit mode never has a pending video to clear */
  function clearPendingPhotos(): void {
    setPhotoDrafts([]);
  }
  /* v8 ignore stop */

  async function onPickFiles(files: File[]): Promise<void> {
    const prepared: ForumPhotoPayload[] = [];
    for (const file of files) {
      const result = await prepareForumPhoto(file);
      if (result.ok) {
        prepared.push(result.photo);
      }
    }
    if (prepared.length > 0) {
      setPhotoDrafts((current) => {
        const keptCount = kept.filter((item) => item.kind === 'photo').length;
        const room = 10 - keptCount - current.length;
        if (room <= 0) {
          return current;
        }
        return current.concat(prepared.slice(0, room));
      });
    }
  }

  async function save(): Promise<void> {
    setSaving(true);
    setSaveError(false);
    try {
      const keptPhotos = kept.filter((item) => item.kind === 'photo');
      const hasMedia =
        keptPhotos.length > 0 ||
        photoDrafts.length > 0 ||
        message.hasVideo ||
        kept.some((item) => item.kind === 'video');
      if (draft.trim() === '' && !hasMedia) {
        setSaveError(true);
        return;
      }
      const textChanged = draft !== stripShopHashtag(message.text);
      if (textChanged && ensureShopHashtag(draft).length > FORUM_MESSAGE_MAX_LENGTH) {
        setSaveError(true);
        return;
      }
      const photosChanged = photoDrafts.length > 0 || keptPhotos.length !== photoBaseline.length;
      if (photosChanged && !photosReady) {
        setSaveError(true);
        return;
      }
      const stills: { contentType: string; data: string; takenAt?: string | null }[] = [];
      for (const item of keptPhotos) {
        const cached = keptStillBytes.current.get(item.url);
        const encoded = cached ?? (await stillFromUrl(item.url));
        if (cached === undefined) {
          keptStillBytes.current.set(item.url, encoded);
        }
        if (photosChanged) {
          stills.push(encoded);
        }
      }
      if (photosChanged) {
        for (const photo of photoDrafts) {
          stills.push({
            contentType: photo.contentType,
            data: photo.data,
            ...(typeof photo.takenAt === 'string' && photo.takenAt !== ''
              ? { takenAt: photo.takenAt }
              : {}),
          });
        }
      }
      let latest = message;
      if (textChanged) {
        latest = await setMessageShopText(token, message.id, draft);
        onUpdated(latest);
      }
      if (!placesEqual(place, message.place ?? null)) {
        latest = await setMessagePlace(token, message.id, place);
        onUpdated(latest);
      }
      const nextUser = usernameOf(username);
      const prevUser = message.shopAccount?.username ?? '';
      if (nextUser !== prevUser) {
        latest = await setMessageShopAccount(token, message.id, nextUser === '' ? null : nextUser);
        onUpdated(latest);
      }
      if (photosChanged) {
        latest = await setMessageShopPhotos(token, message.id, stills);
        onUpdated(latest);
      }
      onUpdated(latest);
      setOpen(false);
      onSaved?.();
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="min-w-0 max-w-full"
      onClick={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
      }}
    >
      <IconButton
        type="button"
        size="sm"
        variant="ghost"
        aria-label={t('forum.editShopNote')}
        title={t('forum.editShopNote')}
        aria-expanded={open}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }
          openEditor();
        }}
      >
        <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
      </IconButton>
      {open ? (
        <div className="mt-2 flex w-full min-w-0 max-w-full flex-col gap-2">
          <SundayWritingGate>
            <ShopAddWizard
              mode="edit"
              posting={saving}
              draft={draft}
              onDraftChange={setDraft}
              photoDrafts={photoDrafts}
              videoDraft={null}
              onPickFiles={(files) => {
                void onPickFiles(files);
              }}
              onRemovePhoto={(index) => {
                setPhotoDrafts((current) =>
                  current.filter((_, photoIndex) => photoIndex !== index),
                );
              }}
              onClearPhoto={clearPendingPhotos}
              place={place}
              onPlaceChange={setPlace}
              username={username}
              onUsernameChange={setUsername}
              onSubmit={() => {
                void save();
              }}
              onCancel={() => {
                setSaveError(false);
                setOpen(false);
              }}
              resetToken={0}
              maxLength={FORUM_MESSAGE_MAX_LENGTH - '\n\n#21GiftsShop'.length}
              submitLabel={t('shops.saveChanges')}
              keptMedia={kept}
              onRemoveKept={(index) => {
                setKept((current) => current.filter((_, keptIndex) => keptIndex !== index));
              }}
              imagesOnly
            />
          </SundayWritingGate>
          {saveError ? (
            <p role="alert" className="text-xs text-app-danger">
              {t('forum.editShopNoteFailed')}
            </p>
          ) : null}
          <h3 className="text-xs font-medium text-app-fg">{t('forum.editHistory')}</h3>
          {historyError ? (
            <p role="alert" className="text-xs text-app-danger">
              {t('forum.editHistoryFailed')}
            </p>
          ) : null}
          {history !== null && history.length === 0 ? (
            <p className="text-xs text-app-muted">{t('forum.editHistoryEmpty')}</p>
          ) : null}
          {history !== null && history.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {history.map((edit) => {
                const who = edit.actor.name?.trim() ? edit.actor.name : edit.actor.id;
                const fieldLabel =
                  edit.field === 'text'
                    ? t('forum.editFieldText')
                    : edit.field === 'place'
                      ? t('forum.editFieldPlace')
                      : t('forum.editFieldAccount');
                return (
                  <li key={edit.id} className="text-xs text-app-muted">
                    <p>
                      {who} · {formatForumTime(edit.createdAt, locale)} · {fieldLabel}
                    </p>
                    <p className="whitespace-pre-wrap">
                      {editValueText(edit.field, edit.before, t('forum.editNone'))}
                      {' → '}
                      {editValueText(edit.field, edit.after, t('forum.editNone'))}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
