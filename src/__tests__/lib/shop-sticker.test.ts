import jsQR from 'jsqr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openCryptoPayQrValue } from '@/lib/gifts-address';
import {
  SHOP_STICKER_FORMATS,
  SHOP_STICKER_RASTER_WIDTH,
  SHOP_STICKER_WIDTH_MM,
  buildShopStickerPdf,
  buildShopStickerSvg,
  shopStickerBlob,
  shopStickerFileName,
} from '@/lib/shop-sticker';
import {
  SHOP_STICKER_ELEMENTS,
  SHOP_STICKER_MARK,
  SHOP_STICKER_QR_BOX,
} from '@/lib/shop-sticker-artwork';

const CAROL =
  'https://21.gifts/pl/?lightning=LNURL1DP68GURN8GHJ7V339ENKJEN5WVHJUAM9D3KZ66MWDAMKUTMVDE6HYMRS9A3KZUN0DS7CX370';

/** Module size in sticker units for an n × n code (rounded like the generated path data). */
function moduleSize(n: number): string {
  return String(Math.round((SHOP_STICKER_QR_BOX.size / n) * 100) / 100);
}

/** jsdom's Blob has no text(); FileReader reads it. */
function readText(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.readAsText(blob);
  });
}

function pdfText(value: string): string {
  return new TextDecoder().decode(buildShopStickerPdf(value));
}

describe('buildShopStickerSvg', () => {
  it('is a 134.4 mm SVG with the artwork, the QR modules, and the orange mark', () => {
    const svg = buildShopStickerSvg(CAROL);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" width="134.4mm"')).toBe(true);
    expect(svg).toContain('height="82.25mm" viewBox="0 0 1500 918"');
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg.split('<path ').length - 1).toBe(SHOP_STICKER_ELEMENTS.length + 2);
    expect(svg).toContain('fill="#000000" shape-rendering="crispEdges"');
    expect(svg).toContain(`v${moduleSize(57)}h`);
    expect(svg).toContain(`<path d="${SHOP_STICKER_MARK}" fill="#F99602" transform="translate(`);
  });

  it('writes fill-only, stroked, round-joined, and even-odd artwork paths', () => {
    const svg = buildShopStickerSvg(CAROL);
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg).toContain('fill="none" stroke="#000000"');
    expect(svg).toContain('stroke-linejoin="round"');
    expect(svg).toMatch(/fill="#FFFFFF" stroke="#000000" stroke-width="[\d.]+"\/>/);
  });

  it('pads a short payload up to version 10 (57 modules)', () => {
    const svg = buildShopStickerSvg('x'.repeat(10));
    expect(svg).toContain(`v${moduleSize(57)}h`);
    expect(svg).toContain(
      `scale(${Math.round(((0.6222 * 13 * SHOP_STICKER_QR_BOX.size) / 57) * 1000) / 1000})`,
    );
  });

  it('keeps larger versions and widens the cleared centre to an odd module count', () => {
    const svg = buildShopStickerSvg('x'.repeat(120));
    expect(svg).toContain(`v${moduleSize(61)}h`);
    // 15 of 61 modules cleared, mark 0.6222 of that
    expect(svg).toContain(
      `scale(${Math.round(((0.6222 * 15 * SHOP_STICKER_QR_BOX.size) / 61) * 1000) / 1000})`,
    );
  });
});

/**
 * Rasterises the QR modules of a sticker SVG (4 px per module, 4-module quiet zone, cleared centre left white)
 * and decodes them.
 */
function decodeStickerQr(svg: string): string | null {
  const modules =
    /<path d="([^"]+)" fill="#000000" shape-rendering="crispEdges"\/>/.exec(svg)?.[1] ?? '';
  const runs = [...modules.matchAll(/M([\d.]+) ([\d.]+)h([\d.]+)v([\d.]+)h/g)].map((m) =>
    m.slice(1).map(Number),
  );
  const m = (runs[0] as number[])[3] as number;
  const n = Math.round(SHOP_STICKER_QR_BOX.size / m);
  const px = 4;
  const side = (n + 8) * px;
  const data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (const [x, y, w] of runs as [number, number, number, number][]) {
    const row = Math.round((y - SHOP_STICKER_QR_BOX.y) / m);
    const col = Math.round((x - SHOP_STICKER_QR_BOX.x) / m);
    const len = Math.round(w / m);
    for (let dy = 0; dy < px; dy++) {
      for (let dx = 0; dx < len * px; dx++) {
        const at = (((row + 4) * px + dy) * side + (col + 4) * px + dx) * 4;
        data.fill(0, at, at + 3);
      }
    }
  }
  return jsQR(data, side, side)?.data ?? null;
}

describe('sticker QR decodes to the member pay link', () => {
  it.each([
    ['a', '21.gifts'],
    ['carol', '21.gifts'],
    ['a'.repeat(32), 'dev.21.gifts'],
  ])('with the centre cleared for %s on %s', (username, host) => {
    const value = openCryptoPayQrValue(username, host) as string;
    expect(decodeStickerQr(buildShopStickerSvg(value))).toBe(value);
  });
});

describe('buildShopStickerPdf', () => {
  it('writes a one-page PDF 1.4 with a 134.4 mm MediaBox and exact xref offsets', () => {
    const text = pdfText(CAROL);
    expect(text.startsWith('%PDF-1.4\n')).toBe(true);
    expect(text.endsWith('%%EOF\n')).toBe(true);
    const widthPt = (SHOP_STICKER_WIDTH_MM * 72) / 25.4;
    expect(text).toContain(`/MediaBox [0 0 ${Math.round(widthPt * 1000) / 1000} `);
    expect(text).toContain('/Count 1');
    const startxref = Number(/startxref\n(\d+)\n/.exec(text)?.[1]);
    expect(text.slice(startxref).startsWith('xref\n0 5\n')).toBe(true);
    const offsets = [...text.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    expect(offsets).toHaveLength(4);
    offsets.forEach((at, i) => {
      expect(text.slice(at).startsWith(`${i + 1} 0 obj\n`)).toBe(true);
    });
    const length = Number(/\/Length (\d+) >>\nstream\n/.exec(text)?.[1]);
    const start = text.indexOf('stream\n') + 'stream\n'.length;
    expect(text.slice(start + length)).toMatch(/^\nendstream/);
  });

  it('paints in sticker units with fills, outlines, the QR rectangles, and the mark', () => {
    const text = pdfText(CAROL);
    expect(text).toMatch(/^q [\d.]+ 0 0 -[\d.]+ 0 [\d.]+ cm$/m);
    expect(text).toContain('0.9765 0.5882 0.0078 rg');
    expect(text).toMatch(/^1 1 1 rg\n0 0 0 RG [\d.]+ w 0 j$/m);
    expect(text).toMatch(/^0 0 0 RG [\d.]+ w 1 j$/m);
    expect(text).toMatch(/^B$/m);
    expect(text).toMatch(/^S$/m);
    expect(text).toMatch(/^f\*$/m);
    expect(text).toMatch(/ c$/m);
    expect(text).toMatch(/^h$/m);
    expect(text).toMatch(/^[\d.]+ [\d.]+ [\d.]+ [\d.]+ re$/m);
    expect(text).toMatch(/^q [\d.]+ 0 0 [\d.]+ [\d.]+ [\d.]+ cm$/m);
    expect(text).not.toMatch(/\/Font|\/XObject|\/Image/);
  });
});

describe('shopStickerFileName', () => {
  it('uses the local part of the handle and the format as extension', () => {
    expect(shopStickerFileName('carol@21.gifts', 'pdf')).toBe('21gifts-shop-sticker-carol.pdf');
    expect(shopStickerFileName('Ada.Lovelace@dev.21.gifts', 'jpg')).toBe(
      '21gifts-shop-sticker-ada.lovelace.jpg',
    );
  });

  it('accepts a bare username and strips anything outside a-z 0-9 . _ -', () => {
    expect(shopStickerFileName('Zoë_1', 'svg')).toBe('21gifts-shop-sticker-zo_1.svg');
    expect(shopStickerFileName('@21.gifts', 'png')).toBe('21gifts-shop-sticker-member.png');
  });

  it('lists the formats in menu order', () => {
    expect(SHOP_STICKER_FORMATS).toEqual(['pdf', 'png', 'jpg', 'svg']);
  });
});

describe('shopStickerBlob', () => {
  type Outcome = 'load' | 'error';
  let imageOutcome: Outcome;
  let context: { fillRect: ReturnType<typeof vi.fn>; drawImage: ReturnType<typeof vi.fn> } | null;
  let encoded: Blob | null;
  const toBlob = vi.fn();
  const createElement = document.createElement.bind(document);

  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      queueMicrotask(() => (imageOutcome === 'load' ? this.onload?.() : this.onerror?.()));
    }
  }

  beforeEach(() => {
    imageOutcome = 'load';
    context = { fillRect: vi.fn(), drawImage: vi.fn() };
    encoded = new Blob(['bytes'], { type: 'image/png' });
    toBlob.mockReset();
    toBlob.mockImplementation((callback: (blob: Blob | null) => void) => callback(encoded));
    vi.stubGlobal('Image', FakeImage);
    // jsdom has no object URLs; define them so they can be spied on
    for (const name of ['createObjectURL', 'revokeObjectURL'] as const) {
      Object.defineProperty(URL, name, { configurable: true, writable: true, value: () => '' });
    }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:sticker');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = createElement(tag);
      if (tag === 'canvas') {
        Object.assign(element, { getContext: () => context, toBlob });
      }
      return element;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the PDF and SVG as typed blobs without a canvas', async () => {
    const pdf = await shopStickerBlob(CAROL, 'pdf');
    expect(pdf.type).toBe('application/pdf');
    expect((await readText(pdf)).startsWith('%PDF-1.4')).toBe(true);
    const svg = await shopStickerBlob(CAROL, 'svg');
    expect(svg.type).toBe('image/svg+xml');
    expect(await readText(svg)).toBe(buildShopStickerSvg(CAROL));
    expect(toBlob).not.toHaveBeenCalled();
  });

  it('renders PNG and JPG at 3000 px on white and frees the object URL', async () => {
    expect(await shopStickerBlob(CAROL, 'png')).toBe(encoded);
    expect(toBlob).toHaveBeenLastCalledWith(expect.any(Function), 'image/png', 0.95);
    expect(await shopStickerBlob(CAROL, 'jpg')).toBe(encoded);
    expect(toBlob).toHaveBeenLastCalledWith(expect.any(Function), 'image/jpeg', 0.95);
    expect(context?.fillRect).toHaveBeenCalledWith(0, 0, SHOP_STICKER_RASTER_WIDTH, 1836);
    expect(context?.drawImage).toHaveBeenCalledWith(
      expect.any(FakeImage),
      0,
      0,
      SHOP_STICKER_RASTER_WIDTH,
      1836,
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:sticker');
  });

  it('rejects when the SVG does not load', async () => {
    imageOutcome = 'error';
    await expect(shopStickerBlob(CAROL, 'png')).rejects.toThrow('Could not load the sticker image');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:sticker');
  });

  it('rejects without a 2D context', async () => {
    context = null;
    await expect(shopStickerBlob(CAROL, 'jpg')).rejects.toThrow('Canvas 2D is not available');
  });

  it('rejects when the canvas cannot encode', async () => {
    encoded = null;
    await expect(shopStickerBlob(CAROL, 'png')).rejects.toThrow(
      'Could not encode the sticker image',
    );
  });
});
