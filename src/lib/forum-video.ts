/** Maximum video size accepted for a forum upload (32 MiB). */
export const FORUM_VIDEO_MAX_BYTES = 32 * 1024 * 1024;

const FORUM_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

/** Client-prepared forum video plus JPEG poster for Damus `imeta`. */
export type ForumVideoPayload = {
  /** Original file. */
  file: File;
  /** First-frame JPEG for the API `poster` field. */
  poster: Blob;
  /** Object URL for a local `<video>` preview. */
  previewUrl: string;
};

/** Result of {@link prepareForumVideo}. */
export type PrepareForumVideoResult =
  { ok: true; video: ForumVideoPayload } | { ok: false; error: 'unsupported' | 'tooLarge' };

/**
 * True when `file.type` is MP4, WebM, or QuickTime.
 *
 * @param file - Browser file from a file input.
 * @returns Whether the mime type is accepted for forum videos.
 */
export function isForumVideoFile(file: File): boolean {
  return FORUM_VIDEO_TYPES.has(file.type) || /\.(mp4|webm|mov)$/i.test(file.name);
}

/**
 * Grab the first video frame as a JPEG poster.
 *
 * @param file - Video file.
 * @returns JPEG blob, or `null` when the browser cannot decode the file.
 */
/* v8 ignore start -- needs a real video decoder in the browser */
async function capturePoster(file: File): Promise<Blob | null> {
  let url = '';
  try {
    url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      const fail = window.setTimeout(() => {
        reject(new Error('Could not decode video'));
      }, 2000);
      video.onloadeddata = () => {
        window.clearTimeout(fail);
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(fail);
        reject(new Error('Could not decode video'));
      };
    });
    await new Promise<void>((resolve, reject) => {
      const finish = (): void => {
        window.clearTimeout(timer);
        resolve();
      };
      const timer = window.setTimeout(finish, 400);
      video.onseeked = finish;
      video.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error('Could not decode video'));
      };
      if (video.readyState >= 2 && video.currentTime === 0) {
        finish();
        return;
      }
      video.currentTime = 0;
    });
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 360;
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      return null;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          resolve(blob);
        },
        'image/jpeg',
        0.8,
      );
    });
  } catch {
    return null;
  } finally {
    if (url !== '') {
      URL.revokeObjectURL(url);
    }
  }
}
/* v8 ignore stop */

/**
 * Validate size/type and capture a poster for a forum video.
 *
 * @param file - Browser file.
 * @returns Payload or an error code.
 */
export async function prepareForumVideo(file: File): Promise<PrepareForumVideoResult> {
  if (!isForumVideoFile(file)) {
    return { ok: false, error: 'unsupported' };
  }
  if (file.size > FORUM_VIDEO_MAX_BYTES) {
    return { ok: false, error: 'tooLarge' };
  }
  /* v8 ignore start -- capturePoster needs a real video decoder */
  const poster = await capturePoster(file);
  if (poster === null) {
    return { ok: false, error: 'unsupported' };
  }
  return {
    ok: true,
    video: {
      file,
      poster,
      previewUrl: URL.createObjectURL(file),
    },
  };
}
/* v8 ignore stop */

/**
 * Public same-origin video path for a forum message, keyed by MIME.
 *
 * Damus / the api serve `.mp4`, `.webm`, or `.mov`. Default is `.mp4`
 * when `contentType` is missing or unknown.
 *
 * @param messageId - Forum message id.
 * @param contentType - `video/mp4` | `video/webm` | `video/quicktime`, or null/undefined.
 * @returns `/messages/${id}/video.mp4` | `.webm` | `.mov`.
 */
export function forumVideoSrc(messageId: string, contentType: string | null | undefined): string {
  if (contentType === 'video/webm') {
    return `/messages/${messageId}/video.webm`;
  }
  if (contentType === 'video/quicktime') {
    return `/messages/${messageId}/video.mov`;
  }
  return `/messages/${messageId}/video.mp4`;
}
