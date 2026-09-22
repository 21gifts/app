'use client';

import { X } from 'lucide-react';
import { useMemo, useState, type ReactElement } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, Card, IconButton, SegmentedControl } from '@/components/ui';
import {
  SHOP_STICKER_FORMATS,
  buildShopStickerSvg,
  shopStickerBlob,
  shopStickerFileName,
  type ShopStickerFormat,
} from '@/lib/shop-sticker';

const FORMAT_OPTIONS = SHOP_STICKER_FORMATS.map((format) => ({
  value: format,
  label: format.toUpperCase(),
}));

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
 * PDF | PNG | JPG | SVG choice, and a labeled Download. Only mounted where the profile shows its QR (never on a
 * smartphone UA).
 *
 * @param props - See {@link ShopStickerOverlayProps}.
 * @returns The overlay dialog.
 */
export function ShopStickerOverlay({
  qrValue,
  handle,
  onClose,
}: ShopStickerOverlayProps): ReactElement {
  const { t } = useTranslations();
  const [format, setFormat] = useState<ShopStickerFormat>('pdf');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const preview = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(buildShopStickerSvg(qrValue))}`,
    [qrValue],
  );

  const download = async (): Promise<void> => {
    setBusy(true);
    setFailed(false);
    try {
      saveBlob(await shopStickerBlob(qrValue, format), shopStickerFileName(handle, format));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('profile.shopSticker')}
      className="fixed inset-0 z-50 flex items-center justify-center bg-app-overlay p-4"
      onClick={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Escape') onClose();
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
