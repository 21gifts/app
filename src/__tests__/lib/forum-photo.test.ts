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

/** Smallest JPEG whose IFD0 DateTime holds `dateTime` (little-endian Exif). */
function exifJpegBytes(dateTime: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(64);
  const view = new DataView(bytes.buffer);
  const tiff = 12;
  const valueOffset = 8 + 2 + 12 + 4;
  bytes.set([0xff, 0xd8, 0xff, 0xe1], 0);
  bytes.set([0x45, 0x78, 0x69, 0x66, 0, 0], 6);
  bytes.set([0x49, 0x49], tiff);
  view.setUint16(tiff + 2, 42, true);
  view.setUint32(tiff + 4, 8, true);
  view.setUint16(tiff + 8, 1, true);
  view.setUint16(tiff + 10, 0x0132, true);
  view.setUint16(tiff + 12, 2, true);
  view.setUint32(tiff + 14, dateTime.length + 1, true);
  view.setUint32(tiff + 18, valueOffset, true);
  view.setUint32(tiff + 22, 0, true);
  for (let index = 0; index < dateTime.length; index += 1) {
    bytes[tiff + valueOffset + index] = dateTime.charCodeAt(index);
  }
  const end = tiff + valueOffset + dateTime.length + 1;
  view.setUint16(4, end - 4, false);
  bytes.set([0xff, 0xd9], end);
  return bytes.slice(0, end + 2);
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

  it('accepts heic and heif from a phone camera', () => {
    expect(isForumPhotoFile(new File([], 'a.heic', { type: 'image/heic' }))).toBe(true);
    expect(isForumPhotoFile(new File([], 'a.heif', { type: 'image/heif' }))).toBe(true);
  });

  it('accepts a camera photo without a type by its file name', () => {
    expect(isForumPhotoFile(new File([], 'IMG_0001.JPG'))).toBe(true);
    expect(isForumPhotoFile(new File([], 'image.jpeg'))).toBe(true);
    expect(isForumPhotoFile(new File([], 'IMG_0002.HEIC'))).toBe(true);
    expect(isForumPhotoFile(new File([], 'shot.png'))).toBe(true);
    expect(isForumPhotoFile(new File([], 'shot.webp'))).toBe(true);
    expect(isForumPhotoFile(new File([], 'shot.heif'))).toBe(true);
  });

  it('rejects other types', () => {
    expect(isForumPhotoFile(new File([], 'a.gif', { type: 'image/gif' }))).toBe(false);
    expect(isForumPhotoFile(new File([], 'a.txt', { type: 'text/plain' }))).toBe(false);
    expect(isForumPhotoFile(new File([], 'a.jpg', { type: 'text/plain' }))).toBe(false);
  });

  it('rejects a file without a type whose name is not a photo', () => {
    expect(isForumPhotoFile(new File([], 'notes.txt'))).toBe(false);
    expect(isForumPhotoFile(new File([], 'clip.mp4'))).toBe(false);
    expect(isForumPhotoFile(new File([], 'jpg'))).toBe(false);
  });
});

describe('prepareForumPhoto', () => {
  it('returns unsupported for a non-image type', async () => {
    await expect(prepareForumPhoto(new File([], 'a.gif', { type: 'image/gif' }))).resolves.toEqual({
      ok: false,
      error: 'unsupported',
    });
  });

  it('reads bytes through File.arrayBuffer when the method exists', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 8, height: 8, close: vi.fn() }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,smol',
    );
    const file = jpegFile();
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: async () => Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]).buffer,
    });

    await expect(prepareForumPhoto(file)).resolves.toMatchObject({
      ok: true,
      photo: { takenAt: null },
    });
  });

  it('leaves takenAt null for a png', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 8, height: 8, close: vi.fn() }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,smol',
    );
    const file = new File([new Uint8Array([1, 2, 3])], 'shot.png', { type: 'image/png' });
    await expect(prepareForumPhoto(file)).resolves.toMatchObject({
      ok: true,
      photo: { takenAt: null },
    });
  });

  it('re-encodes a heic camera photo as jpeg when the browser decodes it', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 8, height: 8, close: vi.fn() }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,smol',
    );
    const file = new File([new Uint8Array([0, 0, 0, 24])], 'IMG_0001.HEIC', {
      type: 'image/heic',
    });
    await expect(prepareForumPhoto(file)).resolves.toEqual({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'smol',
        previewUrl: 'data:image/jpeg;base64,smol',
        takenAt: null,
      },
    });
  });

  it('reads the capture time of a camera jpeg that arrives without a type', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 8, height: 8, close: vi.fn() }),
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
      'data:image/jpeg;base64,smol',
    );
    const bytes = exifJpegBytes('2026:10:06 09:15:00');
    const file = new File([bytes], 'image.jpg');
    Object.defineProperty(file, 'arrayBuffer', {
      configurable: true,
      value: async () => bytes.buffer,
    });
    await expect(prepareForumPhoto(file)).resolves.toMatchObject({
      ok: true,
      photo: { takenAt: '2026-10-06T09:15:00' },
    });
  });

  it('throws when the browser cannot decode a heic camera photo', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode')));
    const file = new File([new Uint8Array([0, 0, 0, 24])], 'IMG_0001.HEIC', {
      type: 'image/heic',
    });
    await expect(prepareForumPhoto(file)).rejects.toThrow('decode');
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
      photo: { data: 'smol', takenAt: null },
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
        takenAt: null,
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
        takenAt: null,
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
