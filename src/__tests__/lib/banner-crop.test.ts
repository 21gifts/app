import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  encodeWideBanner,
  initialBannerCrop,
  outputBannerSize,
  panBannerCrop,
  zoomBannerCrop,
  type BannerCrop,
} from '@/lib/banner-crop';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('initialBannerCrop', () => {
  it('returns null unless both dimensions are finite and positive', () => {
    expect(initialBannerCrop(0, 10)).toBeNull();
    expect(initialBannerCrop(10, 0)).toBeNull();
    expect(initialBannerCrop(-4, 10)).toBeNull();
    expect(initialBannerCrop(10, Number.NaN)).toBeNull();
    expect(initialBannerCrop(Number.POSITIVE_INFINITY, 10)).toBeNull();
  });

  it('covers a 4:3 and an exact 5:2 frame from the full width', () => {
    expect(initialBannerCrop(1200, 900)).toEqual({ x: 0, y: 210, width: 1200, height: 480 });
    expect(initialBannerCrop(1000, 400)).toEqual({ x: 0, y: 0, width: 1000, height: 400 });
  });

  it('centers a 5:2 window in a panorama', () => {
    expect(initialBannerCrop(1000, 100)).toEqual({ x: 375, y: 0, width: 250, height: 100 });
  });
});

describe('panBannerCrop', () => {
  const crop: BannerCrop = { x: 10, y: 20, width: 500, height: 200 };

  it('moves inside the image and clamps on each edge', () => {
    expect(panBannerCrop(1000, 400, crop, 15, -5)).toEqual({
      x: 25,
      y: 15,
      width: 500,
      height: 200,
    });
    expect(panBannerCrop(1000, 400, crop, -100, -100)).toEqual({
      x: 0,
      y: 0,
      width: 500,
      height: 200,
    });
    expect(panBannerCrop(1000, 400, crop, 900, 900)).toEqual({
      x: 500,
      y: 200,
      width: 500,
      height: 200,
    });
  });
});

describe('zoomBannerCrop', () => {
  it('returns the same crop when the image has no 5:2 window', () => {
    const crop: BannerCrop = { x: 0, y: 0, width: 10, height: 4 };
    expect(zoomBannerCrop(0, 10, crop, 2)).toBe(crop);
  });

  it('shrinks around the center and will not pass the initial window or a 32px height', () => {
    const crop: BannerCrop = { x: 0, y: 300, width: 1000, height: 400 };
    const zoomed = zoomBannerCrop(1000, 1000, crop, 2);
    expect(zoomed.height).toBe(200);
    expect(zoomed.width).toBe(500);
    expect(zoomed.x).toBe(250);
    expect(zoomed.y).toBe(400);

    const tiny = zoomBannerCrop(1000, 1000, crop, 100);
    expect(tiny.height).toBe(32);
    expect(tiny.width).toBe(80);

    const grown = zoomBannerCrop(1000, 1000, tiny, 0.05);
    expect(grown).toEqual(crop);
  });

  it('keeps a fitting window that is already shorter than 32px', () => {
    const crop = initialBannerCrop(40, 10);
    expect(crop).toEqual({ x: 7.5, y: 0, width: 25, height: 10 });
    expect(zoomBannerCrop(40, 10, crop as BannerCrop, 8).height).toBe(10);
  });
});

describe('outputBannerSize', () => {
  it('clamps the encoded width and keeps the API wide-image rule', () => {
    expect(outputBannerSize(100)).toEqual({ width: 640, height: 256 });
    expect(outputBannerSize(1000)).toEqual({ width: 1000, height: 400 });
    expect(outputBannerSize(2000)).toEqual({ width: 1280, height: 512 });
    for (let cropWidth = 1; cropWidth <= 4000; cropWidth += 1) {
      const { width, height } = outputBannerSize(cropWidth);
      expect(width).toBeGreaterThanOrEqual(640);
      expect(width * 2).toBeGreaterThanOrEqual(height * 3);
    }
  });
});

describe('encodeWideBanner', () => {
  const source = {} as CanvasImageSource;
  const crop: BannerCrop = { x: 10, y: 20, width: 1000, height: 400 };

  function mockCanvas(context: object | null, url = 'data:image/jpeg;base64,aaaa'): void {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as CanvasRenderingContext2D | null,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(url);
  }

  it('rejects a crop that is not finite and positive', () => {
    expect(encodeWideBanner(source, 100, 100, { ...crop, width: 0 })).toEqual({
      ok: false,
      error: 'unsupported',
    });
    expect(encodeWideBanner(source, 100, 100, { ...crop, height: Number.NaN })).toEqual({
      ok: false,
      error: 'unsupported',
    });
  });

  it('returns unsupported when the canvas has no 2d context or the data URL is not a jpeg', () => {
    mockCanvas(null);
    expect(encodeWideBanner(source, 1000, 800, crop)).toEqual({ ok: false, error: 'unsupported' });

    mockCanvas({ drawImage: vi.fn() }, 'data:image/png;base64,aaaa');
    expect(encodeWideBanner(source, 1000, 800, crop)).toEqual({ ok: false, error: 'unsupported' });
  });

  it('draws the clamped window and lowers JPEG quality until the payload fits', () => {
    const drawImage = vi.fn();
    const toDataURL = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValueOnce('data:image/jpeg;base64,BIGG')
      .mockReturnValueOnce('data:image/jpeg;base64,aaaa');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
      imageSmoothingQuality: 'low',
    } as unknown as CanvasRenderingContext2D);
    vi.stubGlobal('atob', (value: string) => (value === 'BIGG' ? 'x'.repeat(1_048_577) : 'ok'));

    expect(
      encodeWideBanner(source, 1000, 800, { x: -5, y: 900, width: 1000, height: 400 }),
    ).toEqual({
      ok: true,
      photo: {
        contentType: 'image/jpeg',
        data: 'aaaa',
        previewUrl: 'data:image/jpeg;base64,aaaa',
      },
    });
    expect(toDataURL).toHaveBeenNthCalledWith(1, 'image/jpeg', 0.8);
    expect(toDataURL).toHaveBeenNthCalledWith(2, 'image/jpeg', 0.6);
    expect(drawImage).toHaveBeenCalledWith(source, 0, 800, 995, 0, 0, 0, 1000, 400);
  });

  it('returns tooLarge when every quality is still over 1 MB', () => {
    const toDataURL = vi
      .spyOn(HTMLCanvasElement.prototype, 'toDataURL')
      .mockReturnValue('data:image/jpeg;base64,BIGG');
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.stubGlobal('atob', () => 'x'.repeat(1_048_577));

    expect(encodeWideBanner(source, 800, 800, crop)).toEqual({ ok: false, error: 'tooLarge' });
    expect(toDataURL).toHaveBeenCalledTimes(3);
    expect(toDataURL).toHaveBeenLastCalledWith('image/jpeg', 0.4);
  });
});
