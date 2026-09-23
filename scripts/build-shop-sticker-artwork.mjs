#!/usr/bin/env node
// Generates src/lib/shop-sticker-artwork.ts: the fixed shop-sticker artwork (everything except the member's QR
// modules) as a list of filled/stroked paths, plus the QR box and the Open CryptoPay mark.
// Text is converted to outlines, transforms are baked in, arcs and quadratics become cubics: every path uses only
// absolute M, L, C and Z, so the app can write both SVG and PDF from it without font files or a PDF library.
//
// Usage: node scripts/build-shop-sticker-artwork.mjs && npx prettier --write src/lib/shop-sticker-artwork.ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import svgpath from 'svgpath';

const OUT = fileURLToPath(new URL('../src/lib/shop-sticker-artwork.ts', import.meta.url));

// Pinned sources. Fonts are converted to outlines (Ubuntu Font Licence 1.0, SIL OFL 1.1).
const FONT_URLS = {
  ubuntuBoldItalic:
    'https://raw.githubusercontent.com/google/fonts/a50de97857f6626d6628c91e6a34c12ee8a16ede/ufl/ubuntu/Ubuntu-BoldItalic.ttf',
  ubuntuItalic:
    'https://raw.githubusercontent.com/google/fonts/a50de97857f6626d6628c91e6a34c12ee8a16ede/ufl/ubuntu/Ubuntu-Italic.ttf',
  barlowSemiBold:
    'https://raw.githubusercontent.com/google/fonts/89f5431ff0db41bd2fe3f7ba21a723a01622428b/ofl/barlow/Barlow-SemiBold.ttf',
  barlowRegular:
    'https://raw.githubusercontent.com/google/fonts/89f5431ff0db41bd2fe3f7ba21a723a01622428b/ofl/barlow/Barlow-Regular.ttf',
  outfitBold:
    'https://cdn.jsdelivr.net/npm/@fontsource/outfit@5.2.5/files/outfit-latin-700-normal.woff',
};
// cryptocurrency-icons@0.18.1 svg/black/btc.svg (CC0-1.0): the ₿ glyph without its disc.
const BTC_GLYPH =
  'M23.189 14.02c.314-2.096-1.283-3.223-3.465-3.975l.708-2.84-1.728-.43-.69 2.765c-.454-.114-.92-.22-1.385-.326l.695-2.783L15.596 6l-.708 2.839c-.376-.086-.746-.17-1.104-.26l.002-.009-2.384-.595-.46 1.846s1.283.294 1.256.312c.7.175.826.638.805 1.006l-.806 3.235c.048.012.11.03.18.057l-.183-.045-1.13 4.532c-.086.212-.303.531-.793.41.018.025-1.256-.313-1.256-.313l-.858 1.978 2.25.561c.418.105.828.215 1.231.318l-.715 2.872 1.727.43.708-2.84c.472.127.93.245 1.378.357l-.706 2.828 1.728.43.715-2.866c2.948.558 5.164.333 6.097-2.333.752-2.146-.037-3.385-1.588-4.192 1.13-.26 1.98-1.003 2.207-2.538zm-3.95 5.538c-.533 2.147-4.148.986-5.32.695l.95-3.805c1.172.293 4.929.872 4.37 3.11zm.535-5.569c-.487 1.953-3.495.96-4.47.717l.86-3.45c.975.243 4.118.696 3.61 2.733z';
// DFXswiss/landing-page@8ad23ec images/Open-Crypto-Pay-Logo.svg, first path: the Open CryptoPay mark (54 × 40).
const OCP_MARK =
  'M33.5414 0L14.2494 19.292C13.8602 19.687 13.8602 20.3186 14.2494 20.708L33.5414 40H20.4808C20.2156 40 19.961 39.8923 19.7748 39.7061L0.776736 20.708C0.387571 20.313 0.387573 19.6814 0.776736 19.292L19.7806 0.293945C19.9668 0.107791 20.2206 0.000117132 20.4857 0H33.5414ZM37.7572 35.7842H37.7513L37.7543 35.7812L37.7572 35.7842ZM52.8324 19.2861C53.2218 19.6812 53.2218 20.3137 52.8324 20.7031L37.7543 35.7812L31.0238 29.0508L39.3656 20.708C39.7549 20.3129 39.755 19.6814 39.3656 19.292L28.0717 7.99805L34.8051 1.26465L52.8324 19.2861Z';

const COLORS = { orange: '#F99602', black: '#000000', white: '#FFFFFF' };
const W = 1500;
const H = 918;
const BAND_H = 332;
const MARGIN = 53;
const COL_CX = 1149;
const REF_MODULES = 57; // QR version 10, the minimum the app renders
// The QR box runs from the band (plus a 4-module quiet zone) down to the bottom margin.
const QR_SIZE = (H - MARGIN - BAND_H) / (1 + 4 / REF_MODULES);
const QR_Y = BAND_H + (4 * QR_SIZE) / REF_MODULES;
const QR_X = COL_CX - QR_SIZE / 2;

const fonts = Object.fromEntries(
  await Promise.all(
    Object.entries(FONT_URLS).map(async ([key, url]) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
      return [key, opentype.parse(await res.arrayBuffer())];
    }),
  ),
);

/** @type {{ d: string; fill?: string; stroke?: string; width?: number; join?: 'round'; evenodd?: boolean }[]} */
const elements = [];
const rect = (x, y, w, h, r = 0) =>
  r === 0
    ? `M${x} ${y}H${x + w}V${y + h}H${x}Z`
    : `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
const circle = (cx, cy, r) =>
  `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;

// --- paper and band
elements.push({ d: rect(0, 0, W, H), fill: COLORS.white });
elements.push({ d: rect(0, 0, W, BAND_H), fill: COLORS.orange });

// --- bitcoin disc with the ₿ in orange, sized like the classic logo
const BTC_D = 172.5;
const BTC_CX = 92 + BTC_D / 2;
const BTC_CY = 81.5 + BTC_D / 2;
elements.push({ d: circle(BTC_CX, BTC_CY, BTC_D / 2), fill: COLORS.black });
elements.push({
  d: svgpath(BTC_GLYPH)
    .translate(-16, -16)
    .scale((BTC_D / 32) * 1.06)
    .translate(BTC_CX - 2, BTC_CY - 1.85)
    .toString(),
  fill: COLORS.orange,
  evenodd: true,
});

// --- text
function textPath(font, str, x, baseline, size, tracking = 0) {
  if (!tracking) return font.getPath(str, x, baseline, size, { kerning: true });
  const out = new opentype.Path();
  for (const ch of str) {
    const glyph = font.charToGlyph(ch);
    out.extend(glyph.getPath(x, baseline, size));
    x += (glyph.advanceWidth / font.unitsPerEm) * size + tracking;
  }
  return out;
}
const inkBox = (p) => p.getBoundingBox();
function placeLeft(font, str, left, baseline, size, tracking) {
  const probe = textPath(font, str, 0, baseline, size, tracking);
  return textPath(font, str, left - inkBox(probe).x1, baseline, size, tracking);
}
const pushText = (p, fill = COLORS.black) => elements.push({ d: p.toPathData(3), fill });

pushText(placeLeft(fonts.ubuntuBoldItalic, 'bitcoin', 300, 161.3, 130.5));
for (const [text, baseline] of [
  ['ACCEPTED HERE', 216],
  ['TINATANGGAP DITO', 269],
]) {
  // letter-spaced so both lines share the ink width of the original "ACCEPTED HERE"
  let lo = 0;
  let hi = 30;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const b = inkBox(textPath(fonts.ubuntuItalic, text, 0, baseline, 39, mid));
    if (b.x2 - b.x1 > 399) hi = mid;
    else lo = mid;
  }
  pushText(placeLeft(fonts.ubuntuItalic, text, 297, baseline, 39, lo));
}

// explanation in the band, centred on the QR column: bold lead-in + regular body per hand-set line
const TEXT = [
  [
    ['Curious?', 'Open your camera, scan'],
    ['', 'the QR code – and learn more.'],
  ],
  [
    ['Gusto mong malaman?', 'Buksan ang'],
    ['', 'camera, i-scan ang QR code – at alamin pa.'],
  ],
];
const [SIZE, PITCH, GAP] = [35, 42, 18];
const lines = [];
let y = 0;
TEXT.forEach((block, i) => {
  if (i > 0) y += GAP;
  for (const [lead, body] of block) {
    lines.push({ lead, body, y });
    y += PITCH;
  }
});
const probe = new opentype.Path();
for (const l of lines) {
  probe.extend(
    fonts.barlowRegular.getPath(`${l.lead}${l.lead ? '  ' : ''}${l.body}`, 0, l.y, SIZE),
  );
}
const pb = inkBox(probe);
const shift = (BAND_H - (pb.y2 - pb.y1)) / 2 - pb.y1;
const space2 = fonts.barlowRegular.getAdvanceWidth('  ', SIZE);
for (const l of lines) {
  const leadW = l.lead
    ? fonts.barlowSemiBold.getAdvanceWidth(l.lead, SIZE, { kerning: true }) + space2
    : 0;
  const bodyW = fonts.barlowRegular.getAdvanceWidth(l.body, SIZE, { kerning: true });
  const x = COL_CX - (leadW + bodyW) / 2;
  if (l.lead) {
    pushText(fonts.barlowSemiBold.getPath(l.lead, x, l.y + shift, SIZE, { kerning: true }));
  }
  pushText(fonts.barlowRegular.getPath(l.body, x + leadW, l.y + shift, SIZE, { kerning: true }));
}

// --- sari-sari store pictogram (300 × 312 grid), exactly the QR's height, centred under the band's left content
{
  const S = QR_SIZE / 306.5;
  const ox = (92 + 703) / 2 - 150 * S;
  const oy = QR_Y - 4 * S;
  const g = (d) => svgpath(d).scale(S).translate(ox, oy).toString();
  const K = 9;
  elements.push({
    d: g(rect(22, 96, 256, 210, 6)),
    fill: COLORS.white,
    stroke: COLORS.black,
    width: K * S,
  });
  elements.push({ d: g(rect(46, 150, 208, 7)), fill: COLORS.black });
  const goods = [
    [58, 124, 18, 26, 'orange'],
    [82, 118, 14, 32, 'black'],
    [102, 128, 22, 22, 'orange'],
    [130, 120, 14, 30, 'black'],
    [150, 126, 20, 24, 'orange'],
    [176, 118, 14, 32, 'black'],
    [196, 124, 22, 26, 'orange'],
    [224, 122, 16, 28, 'black'],
    [60, 166, 24, 30, 'black'],
    [90, 172, 20, 24, 'orange'],
    [116, 164, 16, 32, 'black'],
    [140, 170, 26, 26, 'orange'],
    [172, 166, 16, 30, 'black'],
    [194, 172, 22, 24, 'orange'],
    [222, 164, 18, 32, 'black'],
  ];
  for (const [x, yy, w, h, c] of goods) {
    elements.push({ d: g(rect(x, yy, w, h, 3)), fill: COLORS[c] });
  }
  elements.push({ d: g(rect(10, 196, 280, 16, 4)), fill: COLORS.black });
  const stripes = 6;
  const sw = 280 / stripes;
  const ay = 26;
  const ah = 58;
  for (let i = 0; i < stripes; i++) {
    const x = 10 + i * sw;
    elements.push({
      d: g(`M${x} ${ay}h${sw}v${ah}a${sw / 2} ${sw / 2} 0 0 1 ${-sw} 0z`),
      fill: i % 2 ? COLORS.white : COLORS.orange,
    });
  }
  const edge = Array.from({ length: stripes }, () => `a${sw / 2} ${sw / 2} 0 0 1 ${-sw} 0`).join(
    '',
  );
  elements.push({
    d: g(`M10 ${ay}h280v${ah}${edge}z`),
    stroke: COLORS.black,
    width: K * S,
    join: 'round',
  });
  for (let i = 1; i < stripes; i++) {
    elements.push({
      d: g(`M${10 + i * sw} ${ay}v${ah}`),
      stroke: COLORS.black,
      width: (K - 3) * S,
    });
  }
  elements.push({ d: g(rect(0, 4, 300, 26, 8)), fill: COLORS.black });
  // shop sign: the 21.gifts wordmark, "21" orange (Outfit 700, as the app icon)
  const ws = 60;
  const wb = fonts.outfitBold.getPath('21.gifts', 0, 0, ws, { kerning: true }).getBoundingBox();
  const w21 = fonts.outfitBold.getAdvanceWidth('21', ws, { kerning: true });
  const wx = 150 - (wb.x1 + wb.x2) / 2;
  const wy = 259 - (wb.y1 + wb.y2) / 2;
  elements.push({
    d: g(fonts.outfitBold.getPath('21', wx, wy, ws).toPathData(3)),
    fill: COLORS.orange,
  });
  elements.push({
    d: g(fonts.outfitBold.getPath('.gifts', wx + w21, wy, ws, { kerning: true }).toPathData(3)),
    fill: COLORS.black,
  });
}

// --- normalisation: absolute segments, cubic curves only
const roundTo = (digits) => (n) => {
  const f = 10 ** digits;
  const r = Math.round(n * f) / f;
  return Object.is(r, -0) ? '0' : String(r);
};
const num = roundTo(1);
const num5 = roundTo(5);

function segments(d) {
  const out = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  svgpath(d)
    .abs()
    .unarc()
    .unshort()
    .iterate((seg) => {
      const [cmd, ...a] = seg;
      if (cmd === 'M') {
        [cx, cy] = a;
        [sx, sy] = a;
        out.push(['M', cx, cy]);
      } else if (cmd === 'L') {
        [cx, cy] = a;
        out.push(['L', cx, cy]);
      } else if (cmd === 'H') {
        cx = a[0];
        out.push(['L', cx, cy]);
      } else if (cmd === 'V') {
        cy = a[0];
        out.push(['L', cx, cy]);
      } else if (cmd === 'C') {
        out.push(['C', ...a]);
        [cx, cy] = a.slice(4);
      } else if (cmd === 'Q') {
        const [qx, qy, x, yq] = a;
        out.push([
          'C',
          cx + (2 / 3) * (qx - cx),
          cy + (2 / 3) * (qy - cy),
          x + (2 / 3) * (qx - x),
          yq + (2 / 3) * (qy - yq),
          x,
          yq,
        ]);
        [cx, cy] = [x, yq];
      } else if (cmd === 'Z') {
        out.push(['Z']);
        [cx, cy] = [sx, sy];
      } else {
        throw new Error(`unexpected segment ${cmd}`);
      }
    });
  return out;
}
const svgD = (segs, fmt) => segs.map(([c, ...a]) => `${c}${a.map(fmt).join(' ')}`).join('');

const items = elements.map((el) => {
  const item = { d: svgD(segments(el.d), num) };
  if (el.fill) item.fill = el.fill;
  if (el.stroke) {
    item.stroke = { color: el.stroke, width: Number(num(el.width)) };
    if (el.join === 'round') item.stroke.roundJoin = true;
  }
  if (el.evenodd) item.evenOdd = true;
  return item;
});

// Open CryptoPay mark normalised to width 1, centred on (0, 0)
const mark = svgD(
  segments(
    svgpath(OCP_MARK)
      .translate(-26.76, -20)
      .scale(1 / 52.54)
      .toString(),
  ),
  num5,
);

const ts = `// Generated by scripts/build-shop-sticker-artwork.mjs — do not edit by hand.

/** One path of the fixed sticker artwork. \`d\` uses only absolute M, L, C and Z in sticker units. */
export interface ShopStickerElement {
  /** Path data: absolute M, L, C and Z only. */
  readonly d: string;
  /** Fill colour (hex); absent for a stroke-only path. */
  readonly fill?: string;
  /** Outline; absent for a fill-only path. */
  readonly stroke?: ShopStickerStroke;
  /** Even-odd fill rule (otherwise non-zero). */
  readonly evenOdd?: true;
}

/** Outline of a {@link ShopStickerElement}. */
export interface ShopStickerStroke {
  /** Stroke colour (hex). */
  readonly color: string;
  /** Stroke width in sticker units. */
  readonly width: number;
  /** Round line joins (otherwise miter). */
  readonly roundJoin?: true;
}

/** Artwork width in sticker units (the PDF page and the SVG viewBox are drawn in these units). */
export const SHOP_STICKER_WIDTH = ${W};

/** Artwork height in sticker units. */
export const SHOP_STICKER_HEIGHT = ${H};

/** The three sticker colours (hex). The artwork uses no other colour. */
export const SHOP_STICKER_COLORS = ${JSON.stringify(COLORS)} as const;

/** Square box the member's QR modules fill, in sticker units (the 4-module quiet zone to the band lies above it). */
export const SHOP_STICKER_QR_BOX = { x: ${num5(QR_X)}, y: ${num5(QR_Y)}, size: ${num5(QR_SIZE)} } as const;

/** Fixed artwork, painted in order: paper, band, text outlines, bitcoin disc, shop pictogram. */
export const SHOP_STICKER_ELEMENTS: readonly ShopStickerElement[] = ${JSON.stringify(items)};

/** Open CryptoPay mark (absolute M, L, C, Z), width 1, centred on (0, 0). */
export const SHOP_STICKER_MARK = ${JSON.stringify(mark)};
`;
writeFileSync(OUT, ts);
console.log(
  `wrote ${OUT} (${(ts.length / 1024).toFixed(0)} KB, ${items.length} elements, QR box ${num5(QR_SIZE)})`,
);
