import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  FORUM_PHOTO_JPEG_QUALITY,
  FORUM_PHOTO_MAX_BYTES,
  FORUM_PHOTO_MAX_EDGE,
  isForumPhotoFile,
  prepareForumPhoto,
} from '@/lib/forum-photo';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function jpegFile(name = 'shot.jpg'): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff])], name, { type: 'image/jpeg' });
}

/** jsdom's URL may omit createObjectURL / revokeObjectURL. */
function stubUrlObjectMethods(): void {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: () => 'blob:preview',
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
}

describe('isForumPhotoFile', () => {
  it('accepts jpeg, png, and webp', () => {
    expect(isForumPhotoFile(new File([], 'a.jpg', { type: 'image/jpeg' }))).toBe(true);
    expect(isForumPhotoFile(new File([], 'a.png', { type: 'image/png' }))).toBe(true);
    expect(isForumPhotoFile(new File([], 'a.webp', { type: 'image/webp' }))).toBe(true);
  });

  it('rejects other types', () => {
    expect(isForumPhotoFile(new File([], 'a.gif', { type: 'image/gif' }))).toBe(false);
    expect(isForumPhotoFile(new File([], 'a.txt', { type: 'text/plain' }))).toBe(false);
  });
});

describe('prepareForumPhoto', () => {
  it('returns unsupported for a non-image type', async () => {
    await expect(prepareForumPhoto(new File([], 'a.gif', { type: 'image/gif' }))).resolves.toEqual({
      ok: false,
      error: 'unsupported',
    });
  });

  it('encodes a small jpeg without upscaling', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({
        width: 40,
        height: 30,
        close: vi.fn(),
      }),
    );
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,smol',
    );

    await expect(prepareForumPhoto(jpegFile())).resolves.toMatchObject({
      ok: true,
      photo: { data: 'smol' },
    });
    expect(drawImage.mock.calls[0]?.[3]).toBe(40);
    expect(drawImage.mock.calls[0]?.[4]).toBe(30);
  });

  it('resizes and encodes a jpeg-ish file via createImageBitmap', async () => {
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({
        width: 2000,
        height: 1000,
        close,
      }),
    );
    const drawImage = vi.fn();
    const getContext = vi.fn().mockReturnValue({ drawImage });
    const toDataURL = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/jpeg;base64,qqq');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(getContext);

    const result = await prepareForumPhoto(jpegFile());
    expect(result).toEqual({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'qqq',
        previewUrl: 'data:image/jpeg;base64,qqq',
      },
    });
    expect(toDataURL).toHaveBeenCalledWith('image/jpeg', FORUM_PHOTO_JPEG_QUALITY);
    expect(drawImage).toHaveBeenCalled();
    const canvasWidth = Math.round(2000 * (FORUM_PHOTO_MAX_EDGE / 2000));
    const canvasHeight = Math.round(1000 * (FORUM_PHOTO_MAX_EDGE / 2000));
    expect(drawImage.mock.calls[0]?.[3]).toBe(canvasWidth);
    expect(drawImage.mock.calls[0]?.[4]).toBe(canvasHeight);
    expect(close).toHaveBeenCalled();
  });

  it('falls back to HTMLImageElement when createImageBitmap is missing', async () => {
    vi.stubGlobal('createImageBitmap', undefined);
    stubUrlObjectMethods();
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:preview');

    class FakeImage {
      naturalWidth = 100;
      naturalHeight = 80;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => {
          this.onload?.();
        });
      }
    }
    vi.stubGlobal('Image', FakeImage);

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,abc',
    );

    await expect(prepareForumPhoto(jpegFile())).resolves.toEqual({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'abc',
        previewUrl: 'data:image/jpeg;base64,abc',
      },
    });
    expect(revoke).toHaveBeenCalledWith('blob:preview');
  });

  it('returns unsupported when canvas 2d context is missing', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({
        width: 10,
        height: 10,
        close: vi.fn(),
      }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);

    await expect(prepareForumPhoto(jpegFile())).resolves.toEqual({
      ok: false,
      error: 'unsupported',
    });
  });

  it('returns unsupported when toDataURL is not a jpeg data URL', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({
        width: 10,
        height: 10,
        close: vi.fn(),
      }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,abc');

    await expect(prepareForumPhoto(jpegFile())).resolves.toEqual({
      ok: false,
      error: 'unsupported',
    });
  });

  it('returns tooLarge when the encoded payload exceeds the byte cap', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({
        width: 10,
        height: 10,
        close: vi.fn(),
      }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    const huge = 'A'.repeat(FORUM_PHOTO_MAX_BYTES + 4);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      `data:image/jpeg;base64,${huge}`,
    );
    vi.stubGlobal('atob', (value: string) => 'x'.repeat(value.length));

    await expect(prepareForumPhoto(jpegFile())).resolves.toEqual({
      ok: false,
      error: 'tooLarge',
    });
  });

  it('revokes the object URL when HTMLImageElement decode fails', async () => {
    vi.stubGlobal('createImageBitmap', undefined);
    stubUrlObjectMethods();
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:bad');

    class FakeImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => {
          this.onerror?.();
        });
      }
    }
    vi.stubGlobal('Image', FakeImage);

    await expect(prepareForumPhoto(jpegFile())).rejects.toThrow('Could not decode image');
    expect(revoke).toHaveBeenCalledWith('blob:bad');
  });
});
