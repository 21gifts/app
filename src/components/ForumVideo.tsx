'use client';

import { Maximize, Minimize, Play } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement, type VideoHTMLAttributes } from 'react';
import { useTranslations } from '@/components/LocaleProvider';
import { IconButton } from '@/components/ui';

/**
 * Playable note video. No native controls; one play button while paused; a
 * click on the playing video pauses it; the fullscreen button sits in an
 * absolutely positioned wrapper because the small icon button stays relative;
 * the frame is `mx-auto w-fit` (centered, and both controls sit on the
 * picture); the fullscreen button calls `requestFullscreen` on that frame.
 *
 * @param props - Native video attributes. `playsInline` is set here.
 * @returns The video, play control, and fullscreen button.
 */
export function ForumVideo(
  props: Omit<VideoHTMLAttributes<HTMLVideoElement>, 'controls' | 'controlsList' | 'playsInline'>,
): ReactElement {
  const { className, onClick, onPlay, onPause, ...rest } = props;
  const { t } = useTranslations();
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    const sync = (): void => {
      setFullscreen(document.fullscreenElement === frameRef.current);
    };
    document.addEventListener('fullscreenchange', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
    };
  }, []);

  const enter = (): void => {
    const frame = frameRef.current;
    const video = videoRef.current;
    /* v8 ignore next -- the button is only rendered with the video */
    if (frame === null || video === null) return;
    if (document.fullscreenElement === frame) {
      void document.exitFullscreen();
      return;
    }
    if (typeof frame.requestFullscreen === 'function') {
      void frame.requestFullscreen();
      return;
    }
    const legacy = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    legacy.webkitEnterFullscreen?.();
  };

  return (
    <div ref={frameRef} className="relative mx-auto w-fit max-w-full">
      <video
        ref={videoRef}
        {...rest}
        playsInline
        className={className}
        onClick={(event) => {
          event.stopPropagation();
          if (!paused) {
            videoRef.current?.pause();
          }
          onClick?.(event);
        }}
        onPlay={(event) => {
          setPaused(false);
          onPlay?.(event);
        }}
        onPause={(event) => {
          setPaused(true);
          onPause?.(event);
        }}
      />
      {paused ? (
        <button
          type="button"
          aria-label={t('forum.videoPlay')}
          className="absolute inset-0 z-10 flex items-center justify-center"
          onClick={(event) => {
            event.stopPropagation();
            void videoRef.current?.play();
          }}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white">
            <Play aria-hidden="true" className="h-6 w-6 fill-current" />
          </span>
        </button>
      ) : null}
      <div className="absolute end-2 top-2 z-20">
        <IconButton
          type="button"
          size="sm"
          variant="secondary"
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
    </div>
  );
}
