import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForumVideo } from '@/components/ForumVideo';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
  Object.defineProperty(document, 'fullscreenElement', {
    configurable: true,
    get: () => null,
  });
});

describe('ForumVideo', () => {
  it('fullscreens the frame that holds the button', () => {
    const onClick = vi.fn();
    renderWithLocale(
      <ForumVideo src="/messages/clip/video.mp4" className="max-h-80" onClick={onClick} />,
    );
    const video = document.querySelector('video');
    expect(video?.getAttribute('src')).toBe('/messages/clip/video.mp4');
    expect(video?.getAttribute('controlsList')).toContain('nofullscreen');
    expect(video?.hasAttribute('playsinline')).toBe(true);
    const frame = video?.parentElement;
    if (!(frame instanceof HTMLElement) || !(video instanceof HTMLVideoElement)) {
      throw new Error('missing video frame');
    }
    fireEvent.click(video);
    expect(onClick).toHaveBeenCalledTimes(1);
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(frame, 'requestFullscreen', {
      configurable: true,
      value: requestFullscreen,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    const exitFullscreen = vi.fn().mockResolvedValue(undefined);
    document.exitFullscreen = exitFullscreen;
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => frame,
    });
    act(() => {
      document.dispatchEvent(new Event('fullscreenchange'));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Leave full screen' }));
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it('uses the webkit video call when the frame cannot request fullscreen', () => {
    renderWithLocale(<ForumVideo src="/messages/clip/video.webm" />);
    const video = document.querySelector('video');
    const frame = video?.parentElement;
    if (!(frame instanceof HTMLElement) || !(video instanceof HTMLVideoElement)) {
      throw new Error('missing video frame');
    }
    Object.defineProperty(frame, 'requestFullscreen', {
      configurable: true,
      value: undefined,
    });
    const webkitEnterFullscreen = vi.fn();
    Object.defineProperty(video, 'webkitEnterFullscreen', {
      configurable: true,
      value: webkitEnterFullscreen,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Full screen' }));
    expect(webkitEnterFullscreen).toHaveBeenCalledTimes(1);
  });
});
