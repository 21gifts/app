'use client';

import { Check, ChevronDown, X } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card, IconButton, SegmentedControl } from '@/components/ui';
import {
  SHOP_STICKER_FORMATS,
  buildShopStickerSvg,
  shopStickerBlob,
  shopStickerFileName,
  shopStickerLangInitial,
  type ShopStickerFormat,
  type ShopStickerLang,
} from '@/lib/shop-sticker';

const FORMAT_OPTIONS = SHOP_STICKER_FORMATS.map((format) => ({
  value: format,
  label: format.toUpperCase(),
}));

/** Menu order. English-only first. The first selection follows the UI language unless a lang query names one. */
const STICKER_LANGS = ['english', 'spanish', 'german', 'french', 'filipino', 'kikamba'] as const;

const LANG_MESSAGE = {
  english: 'profile.shopStickerLangNone',
  spanish: 'profile.shopStickerLangSpanish',
  german: 'profile.shopStickerLangGerman',
  french: 'profile.shopStickerLangFrench',
  filipino: 'profile.shopStickerLangFilipino',
  kikamba: 'profile.shopStickerLangKikamba',
} as const;

const LANG_ROW =
  'flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-app-fg hover:bg-app-hover';

/**
 * Stable id for one second-language option.
 *
 * @param lang - Sticker language.
 * @returns Option element id.
 */
function stickerLangOptionId(lang: ShopStickerLang): string {
  return `shop-sticker-lang-${lang}`;
}

/**
 * Language at a wrapped index, so ArrowUp from the first row lands on the last.
 *
 * @param index - Possibly negative or past the end.
 * @returns The language at that position.
 */
function stickerLangAt(index: number): ShopStickerLang {
  const length = STICKER_LANGS.length;
  const wrapped = ((index % length) + length) % length;
  return STICKER_LANGS[wrapped]!;
}

/**
 * Second-language combobox. The closed control stays in the card flow. The list opens upward
 * (`bottom-full`) so a six-row menu is not clipped below the viewport.
 *
 * @param props - Selected language, whether the list is open, and the two callbacks.
 * @returns The labeled combobox.
 */
function ShopStickerLangMenu({
  value,
  open,
  onOpenChange,
  onChange,
}: {
  value: ShopStickerLang;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (lang: ShopStickerLang) => void;
}): ReactElement {
  const { t } = useTranslations();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [highlight, setHighlight] = useState<ShopStickerLang>(value);
  const label = t('profile.shopStickerLang');

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent): void => {
      const root = rootRef.current;
      /* v8 ignore next -- the ref is set before this listener can run */
      if (root === null) return;
      if (!root.contains(event.target as Node)) onOpenChange(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open, onOpenChange]);

  const openList = (): void => {
    setHighlight(value);
    onOpenChange(true);
  };

  const choose = (lang: ShopStickerLang): void => {
    onOpenChange(false);
    onChange(lang);
    // The trigger is mounted for the life of this menu, including while the list is open.
    (triggerRef.current as HTMLButtonElement).focus();
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (event.key === 'Tab') {
      onOpenChange(false);
      return;
    }
    const index = STICKER_LANGS.indexOf(highlight);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight(stickerLangAt(index + 1));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight(stickerLangAt(index - 1));
      return;
    }
    if (event.key === 'Home') {
      event.preventDefault();
      setHighlight(stickerLangAt(0));
      return;
    }
    if (event.key === 'End') {
      event.preventDefault();
      setHighlight(stickerLangAt(STICKER_LANGS.length - 1));
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(highlight);
    }
  };

  return (
    <div className="flex w-full flex-col gap-1">
      <span id="shop-sticker-lang-label" className="w-full text-left text-sm text-app-muted">
        {label}
      </span>
      <div ref={rootRef} className="relative w-full" onKeyDown={onKeyDown}>
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls="shop-sticker-lang-list"
          aria-labelledby="shop-sticker-lang-label"
          {...(open ? { 'aria-activedescendant': stickerLangOptionId(highlight) } : {})}
          className="flex w-full min-h-11 items-center justify-between gap-2 rounded-2xl border border-app-border bg-app-card px-4 py-2 text-left text-base text-app-fg"
          onClick={() => {
            if (open) onOpenChange(false);
            else openList();
          }}
        >
          {t(LANG_MESSAGE[value])}
          <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-app-muted" />
        </button>
        {open ? (
          <div
            role="listbox"
            id="shop-sticker-lang-list"
            aria-label={label}
            aria-activedescendant={stickerLangOptionId(highlight)}
            className="absolute bottom-full left-0 right-0 z-50 mb-2 rounded-xl border border-app-border bg-app-card p-2 shadow-lg"
          >
            {STICKER_LANGS.map((lang) => {
              const selected = value === lang;
              return (
                <button
                  key={lang}
                  type="button"
                  role="option"
                  id={stickerLangOptionId(lang)}
                  tabIndex={-1}
                  aria-selected={selected}
                  className={`${LANG_ROW}${selected ? ' font-medium' : ''}`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  onMouseEnter={() => {
                    setHighlight(lang);
                  }}
                  onClick={() => {
                    choose(lang);
                  }}
                >
                  <span
                    className="flex h-4 w-4 shrink-0 items-center justify-center"
                    aria-hidden="true"
                  >
                    {selected ? (
                      <Check className="h-4 w-4 shrink-0 text-app-fg" aria-hidden="true" />
                    ) : null}
                  </span>
                  {t(LANG_MESSAGE[lang])}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Props for {@link ShopStickerOverlay}. */
export interface ShopStickerOverlayProps {
  /** Payload of the member's pay QR (`openCryptoPayQrValue`). */
  qrValue: string;
  /** Public `username@domain` handle shown in the copy and used for the file name. */
  handle: string;
  /** Dismisses the overlay. */
  onClose: () => void;
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // give the browser time to start the download before the object URL goes away
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Shop-sticker overlay on a member profile: preview of the printable sticker with this member's pay QR, a
 * PDF | PNG | JPG | SVG choice, a second-language menu, and a labeled Download. Mounted wherever the
 * profile shows its QR, including on a smartphone. A known page `lang` query sets the first selection.
 * Otherwise the visitor's UI language does: English settings select English only. Changing the menu
 * does not write the URL.
 *
 * @param props - See {@link ShopStickerOverlayProps}.
 * @returns The overlay dialog.
 */
export function ShopStickerOverlay({
  qrValue,
  handle,
  onClose,
}: ShopStickerOverlayProps): ReactElement {
  const { locale, t } = useTranslations();
  const [format, setFormat] = useState<ShopStickerFormat>('pdf');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [lang, setLang] = useState<ShopStickerLang>(() => shopStickerLangInitial(locale));
  const [langOpen, setLangOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const preview = useMemo(
    () =>
      `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildShopStickerSvg(qrValue, lang))}`,
    [qrValue, lang],
  );

  useEffect(() => {
    // the trigger sits outside the dialog, so focus moves in once on open and goes back to it on close
    const opener = document.activeElement as HTMLElement;
    (dialogRef.current as HTMLDivElement).focus();
    return () => opener.focus();
  }, []);

  useEffect(() => {
    // Escape from outside the dialog (e.g. after a click on the preview). Keys inside it are handled by the
    // dialog's onKeyDown; with the app root on document both listeners see the same event, so skip those here.
    const onKey = (event: KeyboardEvent): void => {
      const dialog = dialogRef.current as HTMLDivElement;
      if (event.key === 'Escape' && !dialog.contains(event.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const download = async (): Promise<void> => {
    setBusy(true);
    setFailed(false);
    try {
      saveBlob(
        await shopStickerBlob(qrValue, format, lang),
        shopStickerFileName(handle, format, lang),
      );
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={t('profile.shopSticker')}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay p-4 outline-none"
      onClick={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key !== 'Escape') return;
        // the open list takes Escape; a second press closes the dialog
        if (langOpen) {
          setLangOpen(false);
          return;
        }
        onClose();
      }}
    >
      <Card maxWidth="xl">
        <div className="flex w-full items-start justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-app-fg">
            {t('profile.shopSticker')}
          </h2>
          <IconButton
            type="button"
            variant="ghost"
            size="md"
            aria-label={t('profile.shopStickerClose')}
            onClick={onClose}
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </IconButton>
        </div>
        <p className="w-full text-sm text-app-muted">{t('profile.shopStickerLead', { handle })}</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL of the generated sticker SVG */}
        <img
          src={preview}
          alt={t('profile.shopStickerPreview', { handle })}
          className="w-full rounded-xl border border-app-border"
        />
        <SegmentedControl
          value={format}
          options={FORMAT_OPTIONS}
          onChange={setFormat}
          ariaLabel={t('profile.shopStickerFormat')}
          tone="neutral"
        />
        <ShopStickerLangMenu
          value={lang}
          open={langOpen}
          onOpenChange={setLangOpen}
          onChange={setLang}
        />
        {failed ? (
          <p role="alert" className="text-sm text-app-danger">
            {t('profile.shopStickerFailed')}
          </p>
        ) : null}
        <Button
          type="button"
          size="lg"
          disabled={busy}
          onClick={() => {
            void download();
          }}
        >
          {t('profile.shopStickerDownload')}
        </Button>
      </Card>
    </div>
  );
}
