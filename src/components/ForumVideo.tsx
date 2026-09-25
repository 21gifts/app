'use client';

import { Maximize, Minimize } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement, type VideoHTMLAttributes } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { IconButton } from '@/components/ui';

/**
 * Playable note video with one fullscreen control.
 *
 * Native fullscreen is hidden (`controlsList="nofullscreen"`). The button
 * calls `requestFullscreen`, or `webkitEnterFullscreen` when that API is
 * missing. Escape stays the browser's.
 *
 * @param props - Native video attributes. `controls` and `playsInline` are set here.
 * @returns The video and its fullscreen button.
 */
export function ForumVideo(props: VideoHTMLAttributes<HTMLVideoElement>): ReactElement {
  const { className, onClick, ...rest } = props;
  const { t } = useTranslations();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const sync = (): void => {
      setFullscreen(document.fullscreenElement === videoRef.current);
    };
    document.addEventListener('fullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
    };
  }, []);

  const enter = (): void => {
    const video = videoRef.current;
    /* v8 ignore next -- the button is only rendered with the video */
    if (video === null) {
      return;
    }
    if (document.fullscreenElement === video) {
      void document.exitFullscreen();
      return;
    }
    if (typeof video.requestFullscreen === 'function') {
      void video.requestFullscreen();
      return;
    }
    const legacy = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    legacy.webkitEnterFullscreen?.();
  };

  return (
    <div className="relative">
      <video
        ref={videoRef}
        {...rest}
        controls
        playsInline
        controlsList="nofullscreen"
        className={className}
        onClick={(event) => {
          event.stopPropagation();
          onClick?.(event);
        }}
      />
      <IconButton
        type="button"
        size="sm"
        variant="secondary"
        className="absolute end-2 top-4 z-10"
        aria-label={fullscreen ? t('forum.videoExitFullscreen') : t('forum.videoFullscreen')}
        onClick={(event) => {
          event.stopPropagation();
          enter();
        }}
      >
        {fullscreen ? (
          <Minimize aria-hidden="true" className="h-4 w-4" />
        ) : (
          <Maximize aria-hidden="true" className="h-4 w-4" />
        )}
      </IconButton>
    </div>
  );
}
