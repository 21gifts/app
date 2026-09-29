'use client';

import { Loader2, X } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { Button, IconButton } from '@/components/ui';
import {
  encodeWideBanner,
  initialBannerCrop,
  panBannerCrop,
  zoomBannerCrop,
  type BannerCrop,
} from '@/lib/banner-crop';

/**
 * Loads an image bitmap from a file via `createImageBitmap` or an `<img>`.
 *
 * @param file - Image file to decode.
 * @returns Width/height source that can be drawn to a canvas.
 */
async function loadImageSource(
  file: File,
): Promise<{ source: CanvasImageSource; width: number; height: number; revoke: () => void }> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      revoke: () => {
        bitmap.close();
      },
    };
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve(img);
      };
      img.onerror = () => {
        reject(new Error('Could not decode image'));
      };
      img.src = objectUrl;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      revoke: () => {
        URL.revokeObjectURL(objectUrl);
      },
    };
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

type PointerPt = { x: number; y: number };

type Gesture =
  | { mode: 'pan'; startCrop: BannerCrop; startX: number; startY: number }
  | { mode: 'pinch'; startCrop: BannerCrop; startDistance: number };

type Session = {
  source: CanvasImageSource;
  width: number;
  height: number;
  crop: BannerCrop;
};

/**
 * Distance between the first two tracked pointers.
 *
 * @param pointers - Active pointer positions.
 * @returns Euclidean distance, or 0 when fewer than two pointers are down.
 */
function pointerDistance(pointers: Map<number, PointerPt>): number {
  const pts = [...pointers.values()];
  const first = pts[0];
  const second = pts[1];
  /* v8 ignore start -- pinch only measures while two pointers are tracked */
  if (first === undefined || second === undefined) {
    return 0;
  }
  /* v8 ignore end */
  return Math.hypot(first.x - second.x, first.y - second.y);
}

/**
 * Pixel box for the photo inside the 5:2 frame, or `undefined` before a crop exists.
 *
 * @param view - Current crop and source size, or `null` while decoding.
 * @param frameWidth - Frame width in CSS pixels.
 * @returns SVG image box, or `undefined` when there is nothing to place.
 */
function placedImageBox(
  view: { crop: BannerCrop; imageWidth: number; imageHeight: number } | null,
  frameWidth: number,
): { x: number; y: number; width: number; height: number } | undefined {
  if (view === null || frameWidth <= 0) {
    return undefined;
  }
  const scale = frameWidth / view.crop.width;
  return {
    x: -view.crop.x * scale,
    y: -view.crop.y * scale,
    width: view.imageWidth * scale,
    height: view.imageHeight * scale,
  };
}

/**
 * In-app 5:2 cropper for a picked wide profile image.
 *
 * @param props - Source file, optional save lock, and confirm/cancel/error callbacks.
 * @returns The crop frame, hint, and actions.
 */
export function WideImageCropper(props: {
  file: File;
  busy?: boolean;
  onConfirm: (photo: { contentType: 'image/jpeg'; data: string }) => void;
  onCancel: () => void;
  onError: (error: 'unsupported' | 'tooLarge') => void;
}): ReactElement {
  const { file, busy = false, onConfirm, onCancel, onError } = props;
  const { t } = useTranslations();
  const frameRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<Session | null>(null);
  const onErrorRef = useRef(onError);
  const pointersRef = useRef(new Map<number, PointerPt>());
  const gestureRef = useRef<Gesture | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [view, setView] = useState<{
    crop: BannerCrop;
    imageWidth: number;
    imageHeight: number;
  } | null>(null);
  const [frameWidth, setFrameWidth] = useState(0);
  onErrorRef.current = onError;

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    let cancelled = false;
    let released = false;
    let release: (() => void) | undefined;
    sessionRef.current = null;
    setView(null);
    void (async () => {
      try {
        const loaded = await loadImageSource(file);
        release = () => {
          if (released) {
            return;
          }
          released = true;
          loaded.revoke();
        };
        if (cancelled) {
          release();
          return;
        }
        const initial = initialBannerCrop(loaded.width, loaded.height);
        if (initial === null) {
          release();
          onErrorRef.current('unsupported');
          return;
        }
        sessionRef.current = {
          source: loaded.source,
          width: loaded.width,
          height: loaded.height,
          crop: initial,
        };
        setView({ crop: initial, imageWidth: loaded.width, imageHeight: loaded.height });
      } catch {
        if (!cancelled) {
          onErrorRef.current('unsupported');
        }
      }
    })();
    return () => {
      cancelled = true;
      release?.();
    };
  }, [file]);

  useEffect(() => {
    const el = frameRef.current as HTMLDivElement;
    const apply = (): void => {
      setFrameWidth(el.getBoundingClientRect().width);
    };
    apply();
    if (typeof ResizeObserver !== 'function') {
      return;
    }
    const ro = new ResizeObserver(() => {
      apply();
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
    };
  }, []);

  const publish = (session: Session, crop: BannerCrop): void => {
    session.crop = crop;
    setView({ crop, imageWidth: session.width, imageHeight: session.height });
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const session = sessionRef.current;
    if (session === null) {
      return;
    }
    if (pointersRef.current.size >= 2) {
      gestureRef.current = {
        mode: 'pinch',
        startCrop: session.crop,
        startDistance: pointerDistance(pointersRef.current),
      };
      return;
    }
    gestureRef.current = {
      mode: 'pan',
      startCrop: session.crop,
      startX: event.clientX,
      startY: event.clientY,
    };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!pointersRef.current.has(event.pointerId)) {
      return;
    }
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const gesture = gestureRef.current;
    const session = sessionRef.current;
    if (gesture === null || session === null) {
      return;
    }
    if (gesture.mode === 'pinch') {
      const dist = pointerDistance(pointersRef.current);
      if (gesture.startDistance <= 0 || dist <= 0) {
        return;
      }
      publish(
        session,
        zoomBannerCrop(
          session.width,
          session.height,
          gesture.startCrop,
          dist / gesture.startDistance,
        ),
      );
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) {
      return;
    }
    const dx = ((event.clientX - gesture.startX) * gesture.startCrop.width) / rect.width;
    const dy = ((event.clientY - gesture.startY) * gesture.startCrop.height) / rect.height;
    publish(session, panBannerCrop(session.width, session.height, gesture.startCrop, -dx, -dy));
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) {
      gestureRef.current = null;
    }
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>): void => {
    event.preventDefault();
    const session = sessionRef.current;
    if (session === null) {
      return;
    }
    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    publish(session, zoomBannerCrop(session.width, session.height, session.crop, factor));
  };

  const confirm = (): void => {
    const session = sessionRef.current;
    if (session === null) {
      return;
    }
    const result = encodeWideBanner(session.source, session.width, session.height, session.crop);
    if (result.ok) {
      onConfirm({ contentType: result.photo.contentType, data: result.photo.data });
      return;
    }
    onError(result.error);
  };

  const imageBox = placedImageBox(view, frameWidth);

  return (
    <div className="flex w-full flex-col gap-3">
      <div
        ref={frameRef}
        role="group"
        aria-label={t('profile.about.bannerCropHint')}
        className="relative aspect-[5/2] w-full touch-none overflow-hidden rounded-2xl"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {previewUrl !== null ? (
          <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
            <image href={previewUrl} preserveAspectRatio="none" {...(imageBox ?? {})} />
          </svg>
        ) : null}
      </div>
      <p className="text-center text-sm text-app-muted">{t('profile.about.bannerCropHint')}</p>
      <Button
        type="button"
        variant="primary"
        size="lg"
        disabled={busy || view === null}
        icon={busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : undefined}
        onClick={confirm}
      >
        {t('profile.about.bannerUse')}
      </Button>
      <div className="flex justify-center">
        <IconButton
          type="button"
          variant="secondary"
          size="md"
          disabled={busy}
          aria-label={t('profile.about.bannerCancel')}
          title={t('profile.about.bannerCancel')}
          onClick={onCancel}
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}
