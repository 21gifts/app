import QRCode from 'qrcode';
import {
  SHOP_STICKER_COLORS,
  SHOP_STICKER_ELEMENTS,
  SHOP_STICKER_HEIGHT,
  SHOP_STICKER_MARK,
  SHOP_STICKER_QR_BOX,
  SHOP_STICKER_WIDTH,
  type ShopStickerElement,
} from '@/lib/shop-sticker-artwork';

/** File formats offered for the shop-sticker download, in menu order. */
export const SHOP_STICKER_FORMATS = ['pdf', 'png', 'jpg', 'svg'] as const;

/** One of {@link SHOP_STICKER_FORMATS}. */
export type ShopStickerFormat = (typeof SHOP_STICKER_FORMATS)[number];

/** Printed sticker width in millimetres; the height follows the 1500 × 918 artwork (82.25 mm). */
export const SHOP_STICKER_WIDTH_MM = 134.4;

/** Pixel width of PNG and JPG downloads (about 570 dpi at {@link SHOP_STICKER_WIDTH_MM}). */
export const SHOP_STICKER_RASTER_WIDTH = 3000;

/** The artwork's quiet zone to the band is sized for 57 modules, so smaller codes are padded up to version 10. */
const MIN_QR_VERSION = 10;

/** Open CryptoPay mark width as a share of the cleared centre (13 of 57 modules → mark about 8 modules wide). */
const MARK_SHARE = 0.6222;

const HEIGHT_MM = (SHOP_STICKER_WIDTH_MM * SHOP_STICKER_HEIGHT) / SHOP_STICKER_WIDTH;
const PT_PER_MM = 72 / 25.4;

/** A horizontal run of dark QR modules: row, first column, length (module units). */
type QrRun = readonly [row: number, col: number, length: number];

interface StickerQr {
  size: number;
  hole: number;
  runs: QrRun[];
}

function fmt(n: number, digits: number): string {
  const f = 10 ** digits;
  // String(-0) is "0", so a value rounding to minus zero needs no special case
  return String(Math.round(n * f) / f);
}

function stickerQr(value: string): StickerQr {
  const segments = [{ data: new TextEncoder().encode(value), mode: 'byte' as const }];
  const auto = QRCode.create(segments, { errorCorrectionLevel: 'H' });
  const qr =
    auto.version >= MIN_QR_VERSION
      ? auto
      : QRCode.create(segments, { errorCorrectionLevel: 'H', version: MIN_QR_VERSION });
  const size = qr.modules.size;
  // odd, so the cleared square sits exactly in the middle of an odd-sized code
  const rounded = Math.round((size * 13) / 57);
  const hole = rounded % 2 === 0 ? rounded + 1 : rounded;
  const from = (size - hole) / 2;
  const to = from + hole - 1;
  const dark = (r: number, c: number): boolean =>
    qr.modules.get(r, c) === 1 && !(r >= from && r <= to && c >= from && c <= to);
  const runs: QrRun[] = [];
  for (let r = 0; r < size; r++) {
    let c = 0;
    while (c < size) {
      if (!dark(r, c)) {
        c++;
        continue;
      }
      let end = c;
      while (end + 1 < size && dark(r, end + 1)) end++;
      runs.push([r, c, end - c + 1]);
      c = end + 1;
    }
  }
  return { size, hole, runs };
}

function markPlacement(qr: StickerQr): { cx: number; cy: number; width: number } {
  const { x, y, size } = SHOP_STICKER_QR_BOX;
  return {
    cx: x + size / 2,
    cy: y + size / 2,
    width: (MARK_SHARE * qr.hole * size) / qr.size,
  };
}

function elementSvg(el: ShopStickerElement): string {
  const attrs = [`d="${el.d}"`, `fill="${el.fill ?? 'none'}"`];
  if (el.evenOdd === true) attrs.push('fill-rule="evenodd"');
  if (el.stroke !== undefined) {
    attrs.push(`stroke="${el.stroke.color}"`, `stroke-width="${el.stroke.width}"`);
    if (el.stroke.roundJoin === true) attrs.push('stroke-linejoin="round"');
  }
  return `<path ${attrs.join(' ')}/>`;
}

/**
 * Printable shop-window sticker for one member as a standalone SVG document.
 *
 * @param qrValue - Payload of the member's pay QR (`openCryptoPayQrValue`).
 * @returns SVG markup, 134.4 mm wide, fixed artwork plus the QR (error correction H, at least version 10) with the
 *   orange Open CryptoPay mark in the cleared centre.
 */
export function buildShopStickerSvg(qrValue: string): string {
  const qr = stickerQr(qrValue);
  const { x, y, size } = SHOP_STICKER_QR_BOX;
  const m = size / qr.size;
  const modules = qr.runs
    .map(
      ([r, c, len]) =>
        `M${fmt(x + c * m, 2)} ${fmt(y + r * m, 2)}h${fmt(len * m, 2)}v${fmt(m, 2)}h${fmt(-len * m, 2)}z`,
    )
    .join('');
  const mark = markPlacement(qr);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SHOP_STICKER_WIDTH_MM}mm" height="${fmt(HEIGHT_MM, 2)}mm" viewBox="0 0 ${SHOP_STICKER_WIDTH} ${SHOP_STICKER_HEIGHT}">`,
    ...SHOP_STICKER_ELEMENTS.map(elementSvg),
    `<path d="${modules}" fill="${SHOP_STICKER_COLORS.black}" shape-rendering="crispEdges"/>`,
    `<path d="${SHOP_STICKER_MARK}" fill="${SHOP_STICKER_COLORS.orange}" transform="translate(${fmt(mark.cx, 2)} ${fmt(mark.cy, 2)}) scale(${fmt(mark.width, 3)})"/>`,
    '</svg>',
  ].join('');
}

function rgb(hex: string): string {
  return [1, 3, 5].map((i) => fmt(parseInt(hex.slice(i, i + 2), 16) / 255, 4)).join(' ');
}

const ARITY: Record<string, { op: string; count: number }> = {
  M: { op: 'm', count: 2 },
  L: { op: 'l', count: 2 },
  C: { op: 'c', count: 6 },
  Z: { op: 'h', count: 0 },
};

/** PDF path construction for artwork path data (absolute M, L, C, Z only, as the generator writes it). */
function pdfPath(d: string): string {
  const tokens = Array.from(d.matchAll(/[MLCZ]|-?\d*\.?\d+/g), (match) => match[0]);
  const ops: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const spec = ARITY[tokens[i] as string] as { op: string; count: number };
    const args = tokens.slice(i + 1, i + 1 + spec.count);
    ops.push([...args, spec.op].join(' '));
    i += 1 + spec.count;
  }
  return ops.join('\n');
}

function elementPdf(el: ShopStickerElement): string {
  const ops: string[] = [];
  if (el.fill !== undefined) ops.push(`${rgb(el.fill)} rg`);
  if (el.stroke !== undefined) {
    const join = el.stroke.roundJoin === true ? 1 : 0;
    ops.push(`${rgb(el.stroke.color)} RG ${el.stroke.width} w ${join} j`);
  }
  ops.push(pdfPath(el.d));
  const evenOdd = el.evenOdd === true ? '*' : '';
  if (el.fill !== undefined && el.stroke !== undefined) ops.push(`B${evenOdd}`);
  else if (el.stroke !== undefined) ops.push('S');
  else ops.push(`f${evenOdd}`);
  return ops.join('\n');
}

/**
 * Printable shop-window sticker for one member as a one-page vector PDF (134.4 mm wide, no fonts, no images).
 *
 * @param qrValue - Payload of the member's pay QR (`openCryptoPayQrValue`).
 * @returns PDF 1.4 bytes.
 */
export function buildShopStickerPdf(qrValue: string): Uint8Array<ArrayBuffer> {
  const qr = stickerQr(qrValue);
  const { x, y, size } = SHOP_STICKER_QR_BOX;
  const m = size / qr.size;
  const widthPt = SHOP_STICKER_WIDTH_MM * PT_PER_MM;
  const heightPt = HEIGHT_MM * PT_PER_MM;
  const k = widthPt / SHOP_STICKER_WIDTH;
  const mark = markPlacement(qr);
  const content = [
    // sticker units, y pointing down
    `q ${fmt(k, 6)} 0 0 ${fmt(-k, 6)} 0 ${fmt(heightPt, 3)} cm`,
    ...SHOP_STICKER_ELEMENTS.map(elementPdf),
    `${rgb(SHOP_STICKER_COLORS.black)} rg`,
    ...qr.runs.map(
      ([r, c, len]) =>
        `${fmt(x + c * m, 2)} ${fmt(y + r * m, 2)} ${fmt(len * m, 2)} ${fmt(m, 2)} re`,
    ),
    'f',
    `q ${fmt(mark.width, 3)} 0 0 ${fmt(mark.width, 3)} ${fmt(mark.cx, 2)} ${fmt(mark.cy, 2)} cm`,
    `${rgb(SHOP_STICKER_COLORS.orange)} rg`,
    pdfPath(SHOP_STICKER_MARK),
    'f',
    'Q',
    'Q',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${fmt(widthPt, 3)} ${fmt(heightPt, 3)}] /Resources << >> /Contents 4 0 R >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  // every byte is ASCII, so string offsets are byte offsets
  let out = '%PDF-1.4\n';
  const offsets = objects.map((body, i) => {
    const at = out.length;
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    return at;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  out += offsets.map((at) => `${String(at).padStart(10, '0')} 00000 n \n`).join('');
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

async function rasterize(svg: string, format: 'png' | 'jpg'): Promise<Blob> {
  const width = SHOP_STICKER_RASTER_WIDTH;
  const height = Math.round((width * SHOP_STICKER_HEIGHT) / SHOP_STICKER_WIDTH);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not load the sticker image'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('Canvas 2D is not available');
    context.fillStyle = SHOP_STICKER_COLORS.white;
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob === null ? reject(new Error('Could not encode the sticker image')) : resolve(blob),
        format === 'png' ? 'image/png' : 'image/jpeg',
        0.95,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Shop sticker file in the requested format.
 *
 * @param qrValue - Payload of the member's pay QR (`openCryptoPayQrValue`).
 * @param format - `pdf` (vector, 134.4 mm), `svg` (vector), or `png` / `jpg` (3000 px wide, on white).
 * @returns The file as a typed `Blob`.
 * @throws When the browser cannot decode the SVG or encode the canvas (PNG / JPG only).
 */
export async function shopStickerBlob(qrValue: string, format: ShopStickerFormat): Promise<Blob> {
  if (format === 'pdf') {
    return new Blob([buildShopStickerPdf(qrValue)], { type: 'application/pdf' });
  }
  const svg = buildShopStickerSvg(qrValue);
  if (format === 'svg') return new Blob([svg], { type: 'image/svg+xml' });
  return rasterize(svg, format);
}

/**
 * Download file name for a member's shop sticker.
 *
 * @param handle - Public `username@domain` handle (`giftsLightningAddress`).
 * @param format - One of {@link SHOP_STICKER_FORMATS}.
 * @returns `21gifts-shop-sticker-<username>.<format>` with the username reduced to `a-z 0-9 . _ -`.
 */
export function shopStickerFileName(handle: string, format: ShopStickerFormat): string {
  const at = handle.indexOf('@');
  const local = (at === -1 ? handle : handle.slice(0, at))
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');
  return `21gifts-shop-sticker-${local === '' ? 'member' : local}.${format}`;
}
