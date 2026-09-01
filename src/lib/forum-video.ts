/** Maximum video size accepted for a forum upload (32 MiB). */
export const FORUM_VIDEO_MAX_BYTES = 32 * 1024 * 1024;

const FORUM_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']);

/** Client-prepared forum video plus JPEG poster for Damus `imeta`. */
export type ForumVideoPayload = {
  /** Original file. */
  file: File;
  /** First-frame JPEG when capture succeeds, otherwise the fallback JPEG for the API `poster` field. */
  poster: Blob;
  /** Object URL for a local `<video>` preview. */
  previewUrl: string;
};

/** Result of {@link prepareForumVideo}. */
export type PrepareForumVideoResult =
  { ok: true; video: ForumVideoPayload } | { ok: false; error: 'unsupported' | 'tooLarge' };

/**
 * True when `file.type` is MP4, WebM, QuickTime, or MPEG-4 video, or the
 * name ends in `.mp4`, `.m4v`, `.webm`, or `.mov`.
 *
 * @param file - Browser file from a file input.
 * @returns Whether the mime type or filename is accepted for forum videos.
 */
export function isForumVideoFile(file: File): boolean {
  return FORUM_VIDEO_TYPES.has(file.type) || /\.(mp4|m4v|webm|mov)$/i.test(file.name);
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
    const source = new Blob([await file.arrayBuffer()], { type: file.type || 'video/mp4' });
    url = URL.createObjectURL(source);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    await new Promise<void>((resolve, reject) => {
      const fail = window.setTimeout(() => {
        reject(new Error('Could not decode video'));
      }, 8000);
      const done = (): void => {
        window.clearTimeout(fail);
        resolve();
      };
      video.onloadedmetadata = done;
      video.onloadeddata = done;
      video.oncanplay = done;
      video.onerror = () => {
        window.clearTimeout(fail);
        reject(new Error('Could not decode video'));
      };
      video.src = url;
      video.load();
    });
    await Promise.race([
      video.play().catch(() => undefined),
      new Promise<void>((resolve) => {
        window.setTimeout(() => {
          video.pause();
          resolve();
        }, 2000);
      }),
    ]);
    video.pause();
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
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

const FALLBACK_FORUM_VIDEO_POSTER_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x03, 0x02, 0x02, 0x03, 0x02, 0x02, 0x03,
  0x03, 0x03, 0x03, 0x04, 0x03, 0x03, 0x04, 0x05, 0x08, 0x05, 0x05, 0x04, 0x04, 0x05, 0x0a, 0x07,
  0x07, 0x06, 0x08, 0x0c, 0x0a, 0x0c, 0x0c, 0x0b, 0x0a, 0x0b, 0x0b, 0x0d, 0x0e, 0x12, 0x10, 0x0d,
  0x0e, 0x11, 0x0e, 0x0b, 0x0b, 0x10, 0x16, 0x10, 0x11, 0x13, 0x14, 0x15, 0x15, 0x15, 0x0c, 0x0f,
  0x17, 0x18, 0x16, 0x14, 0x18, 0x12, 0x14, 0x15, 0x14, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xc4, 0x00, 0x14,
  0x10, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f, 0x3f, 0xff, 0xd9,
]);

function fallbackForumVideoPoster(): Blob {
  return new Blob([FALLBACK_FORUM_VIDEO_POSTER_JPEG], { type: 'image/jpeg' });
}

/**
 * Validate size and type, then capture a first-frame JPEG when the browser
 * can decode the file. On capture failure still returns `{ ok: true, video }`
 * with a fallback JPEG poster. Returns `{ ok: false }` only for an unsupported
 * type or name (`unsupported`) or an oversized file (`tooLarge`).
 *
 * @param file - Browser file.
 * @returns `{ ok: true, video }` with a JPEG poster, or `{ ok: false }` with
 *   `unsupported` or `tooLarge`.
 */
export async function prepareForumVideo(file: File): Promise<PrepareForumVideoResult> {
  if (!isForumVideoFile(file)) {
    return { ok: false, error: 'unsupported' };
  }
  if (file.size > FORUM_VIDEO_MAX_BYTES) {
    return { ok: false, error: 'tooLarge' };
  }
  const captured = await capturePoster(file);
  let poster = fallbackForumVideoPoster();
  /* v8 ignore start -- captured is non-null only with a real video decoder */
  if (captured !== null) {
    poster = captured;
  }
  /* v8 ignore stop */
  return {
    ok: true,
    video: {
      file,
      poster,
      previewUrl: URL.createObjectURL(file),
    },
  };
}

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
