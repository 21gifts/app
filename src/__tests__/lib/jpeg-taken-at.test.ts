// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readJpegTakenAt } from '@/lib/jpeg-taken-at';

type ExifFixture = {
  little?: boolean;
  dateTime?: string;
  dateTimeOriginal?: string;
  dateTimeDigitized?: string;
  offsetTime?: string;
  offsetTimeOriginal?: string;
  offsetTimeDigitized?: string;
};

type FixtureEntry = { tag: number; value: string };

function jpegExif(fixture: ExifFixture): Uint8Array {
  const little = fixture.little !== false;
  const bytes = new Uint8Array(512);
  const view = new DataView(bytes.buffer);
  const tiffStart = 12;
  const ifd0Entries: Array<FixtureEntry | { tag: number; pointer: true }> = [];
  const exifEntries: FixtureEntry[] = [];

  if (fixture.dateTime !== undefined) {
    ifd0Entries.push({ tag: 0x0132, value: fixture.dateTime });
  }
  if (fixture.offsetTime !== undefined) {
    exifEntries.push({ tag: 0x9010, value: fixture.offsetTime });
  }
  if (fixture.dateTimeOriginal !== undefined) {
    exifEntries.push({ tag: 0x9003, value: fixture.dateTimeOriginal });
  }
  if (fixture.dateTimeDigitized !== undefined) {
    exifEntries.push({ tag: 0x9004, value: fixture.dateTimeDigitized });
  }
  if (fixture.offsetTimeOriginal !== undefined) {
    exifEntries.push({ tag: 0x9011, value: fixture.offsetTimeOriginal });
  }
  if (fixture.offsetTimeDigitized !== undefined) {
    exifEntries.push({ tag: 0x9012, value: fixture.offsetTimeDigitized });
  }
  if (exifEntries.length > 0) {
    ifd0Entries.push({ tag: 0x8769, pointer: true });
  }

  bytes.set([0xff, 0xd8, 0xff, 0xe1], 0);
  bytes.set([0x45, 0x78, 0x69, 0x66, 0, 0], 6);
  bytes.set(little ? [0x49, 0x49] : [0x4d, 0x4d], tiffStart);
  view.setUint16(tiffStart + 2, 42, little);
  view.setUint32(tiffStart + 4, 8, little);

  const ifd0Offset = 8;
  const ifd0Size = 2 + ifd0Entries.length * 12 + 4;
  const exifOffset = ifd0Offset + ifd0Size;
  const exifSize = exifEntries.length === 0 ? 0 : 2 + exifEntries.length * 12 + 4;
  let dataOffset = exifOffset + exifSize;

  const writeAsciiEntry = (entryOffset: number, entry: FixtureEntry): void => {
    view.setUint16(tiffStart + entryOffset, entry.tag, little);
    view.setUint16(tiffStart + entryOffset + 2, 2, little);
    view.setUint32(tiffStart + entryOffset + 4, entry.value.length + 1, little);
    view.setUint32(tiffStart + entryOffset + 8, dataOffset, little);
    for (let index = 0; index < entry.value.length; index += 1) {
      bytes[tiffStart + dataOffset + index] = entry.value.charCodeAt(index);
    }
    bytes[tiffStart + dataOffset + entry.value.length] = 0;
    dataOffset += entry.value.length + 1;
  };

  view.setUint16(tiffStart + ifd0Offset, ifd0Entries.length, little);
  ifd0Entries.forEach((entry, index) => {
    const entryOffset = ifd0Offset + 2 + index * 12;
    if ('pointer' in entry) {
      view.setUint16(tiffStart + entryOffset, entry.tag, little);
      view.setUint16(tiffStart + entryOffset + 2, 4, little);
      view.setUint32(tiffStart + entryOffset + 4, 1, little);
      view.setUint32(tiffStart + entryOffset + 8, exifOffset, little);
    } else {
      writeAsciiEntry(entryOffset, entry);
    }
  });
  view.setUint32(tiffStart + ifd0Offset + 2 + ifd0Entries.length * 12, 0, little);

  if (exifEntries.length > 0) {
    view.setUint16(tiffStart + exifOffset, exifEntries.length, little);
    exifEntries.forEach((entry, index) => {
      writeAsciiEntry(exifOffset + 2 + index * 12, entry);
    });
    view.setUint32(tiffStart + exifOffset + 2 + exifEntries.length * 12, 0, little);
  }

  const app1Length = 2 + 6 + dataOffset;
  view.setUint16(4, app1Length, false);
  const end = tiffStart + dataOffset;
  bytes.set([0xff, 0xd9], end);
  return bytes.slice(0, end + 2);
}

describe('readJpegTakenAt', () => {
  it('reads DateTimeOriginal with its matching offset', () => {
    const bytes = jpegExif({
      dateTimeOriginal: '2026:09:22 11:40:00',
      offsetTimeOriginal: '+08:00',
    });

    expect(readJpegTakenAt(bytes)).toBe('2026-09-22T11:40:00+08:00');
  });

  it('reads an IFD0 DateTime without adding an offset', () => {
    const bytes = jpegExif({ dateTime: '2026:09:22 11:40:00' });

    expect(readJpegTakenAt(bytes)).toBe('2026-09-22T11:40:00');
  });

  it('prefers DateTimeOriginal over a different IFD0 DateTime', () => {
    const bytes = jpegExif({
      dateTime: '2025:01:02 03:04:05',
      dateTimeOriginal: '2026:09:22 11:40:00',
    });

    expect(readJpegTakenAt(bytes)).toBe('2026-09-22T11:40:00');
  });

  it('returns null for empty and non-JPEG bytes', () => {
    expect(readJpegTakenAt(new Uint8Array())).toBeNull();
    expect(readJpegTakenAt(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });

  it('reads DateTimeDigitized with its own offset and ignores a bad offset', () => {
    expect(
      readJpegTakenAt(
        jpegExif({
          dateTimeDigitized: '2026:09:22 11:40:00',
          offsetTimeDigitized: '+08:00',
        }),
      ),
    ).toBe('2026-09-22T11:40:00+08:00');
    expect(
      readJpegTakenAt(
        jpegExif({
          dateTime: '2026:09:22 11:40:00',
          offsetTime: 'Z',
        }),
      ),
    ).toBe('2026-09-22T11:40:00');
  });

  it('returns null for an impossible date and a truncated file', () => {
    expect(readJpegTakenAt(jpegExif({ dateTimeOriginal: '2026:02:31 11:40:00' }))).toBeNull();
    expect(readJpegTakenAt(jpegExif({ dateTimeOriginal: '2024:02:29 00:00:00' }))).toBe(
      '2024-02-29T00:00:00',
    );
    expect(readJpegTakenAt(jpegExif({ dateTimeOriginal: '2023:02:29 00:00:00' }))).toBeNull();
    expect(readJpegTakenAt(jpegExif({ dateTimeOriginal: '2026:04:31 00:00:00' }))).toBeNull();
    expect(readJpegTakenAt(jpegExif({ dateTimeOriginal: '0000:01:01 00:00:00' }))).toBeNull();
    expect(readJpegTakenAt(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(readJpegTakenAt(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBeNull();
    expect(readJpegTakenAt(new Uint8Array([0xff, 0xd8, 0x00]))).toBeNull();
    expect(readJpegTakenAt(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x01]))).toBeNull();
    expect(readJpegTakenAt(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10, 0x00]))).toBeNull();
    expect(readJpegTakenAt(new Uint8Array([0xff, 0xd8, 0xff, 0xd0, 0xff, 0xd9]))).toBeNull();
    expect(readJpegTakenAt(new Uint8Array([0xff, 0xd8, 0xff, 0x01, 0xff, 0xd9]))).toBeNull();
    expect(
      readJpegTakenAt(
        new Uint8Array([
          0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x00, 0xff, 0xd9,
        ]),
      ),
    ).toBeNull();
  });

  it('rejects a capture string that is not a clock time', () => {
    expect(readJpegTakenAt(jpegExif({ dateTimeOriginal: 'not a clock' }))).toBeNull();
    expect(readJpegTakenAt(jpegExif({ dateTimeOriginal: '2026:01:01 24:00:00' }))).toBeNull();
    expect(readJpegTakenAt(jpegExif({ dateTimeOriginal: '2026:01:01 00:60:00' }))).toBeNull();
    expect(readJpegTakenAt(jpegExif({ dateTimeOriginal: '2026:01:01 00:00:60' }))).toBeNull();
    expect(readJpegTakenAt(jpegExif({ dateTimeOriginal: '2026:00:01 00:00:00' }))).toBeNull();
    expect(readJpegTakenAt(jpegExif({ dateTimeOriginal: '2026:01:00 00:00:00' }))).toBeNull();
    expect(readJpegTakenAt(jpegExif({ dateTimeOriginal: '2026:06:31 00:00:00' }))).toBeNull();
    expect(readJpegTakenAt(jpegExif({ dateTimeOriginal: '2026:09:31 00:00:00' }))).toBeNull();
    expect(readJpegTakenAt(jpegExif({ dateTimeOriginal: '2026:11:31 00:00:00' }))).toBeNull();
    expect(readJpegTakenAt(jpegExif({ dateTimeOriginal: '1900:02:29 00:00:00' }))).toBeNull();
    expect(readJpegTakenAt(jpegExif({ dateTimeOriginal: '2000:02:29 00:00:00' }))).toBe(
      '2000-02-29T00:00:00',
    );
  });

  it('returns null for broken markers and a bad TIFF header', () => {
    expect(readJpegTakenAt(new Uint8Array([0xff, 0xd8, 0x00, 0x00]))).toBeNull();
    expect(readJpegTakenAt(new Uint8Array([0xff, 0xd8, 0xff, 0xff]))).toBeNull();
    expect(readJpegTakenAt(new Uint8Array([0xff, 0xd8, 0xff, 0xe1]))).toBeNull();
    const notQuiteExif = [0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x01];
    expect(readJpegTakenAt(new Uint8Array(notQuiteExif))).toBeNull();
    expect(
      readJpegTakenAt(
        new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x08, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00]),
      ),
    ).toBeNull();
    const wrapTiff = (tiff: number[]): Uint8Array => {
      const payload = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
      const length = payload.length + 2;
      return Uint8Array.from([
        0xff,
        0xd8,
        0xff,
        0xe1,
        (length >> 8) & 255,
        length & 255,
        ...payload,
      ]);
    };
    expect(
      readJpegTakenAt(
        wrapTiff([
          0x49, 0x49, 42, 0, 8, 0, 0, 0, 1, 0, 0x03, 0x90, 2, 0, 20, 0, 0, 0, 0xff, 0xff, 0, 0, 0,
          0, 0, 0,
        ]),
      ),
    ).toBeNull();
    const badOrder = [
      0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x58, 0x58, 0x00,
      0x2a, 0x00, 0x00, 0x00, 0x08,
    ];
    expect(readJpegTakenAt(new Uint8Array(badOrder))).toBeNull();
    const badMagic = [
      0xff, 0xd8, 0xff, 0xe1, 0x00, 0x10, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00, 0x49, 0x49, 0x00,
      0x00, 0x08, 0x00, 0x00, 0x00,
    ];
    expect(readJpegTakenAt(new Uint8Array(badMagic))).toBeNull();
    const wrap = (tiff: number[]): Uint8Array => {
      const payload = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
      const length = payload.length + 2;
      return Uint8Array.from([
        0xff,
        0xd8,
        0xff,
        0xe1,
        (length >> 8) & 255,
        length & 255,
        ...payload,
      ]);
    };
    expect(
      readJpegTakenAt(
        wrap([
          0x49, 0x49, 42, 0, 8, 0, 0, 0, 1, 0, 0x00, 0x01, 3, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ]),
      ),
    ).toBeNull();
    expect(
      readJpegTakenAt(
        wrap([
          0x49, 0x49, 42, 0, 8, 0, 0, 0, 1, 0, 0x03, 0x90, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ]),
      ),
    ).toBeNull();
    expect(readJpegTakenAt(wrap([0x49, 0x49, 42, 0, 8, 0, 0, 0, 50, 0]))).toBeNull();
    expect(
      readJpegTakenAt(
        wrap([
          0x49, 0x49, 42, 0, 8, 0, 0, 0, 1, 0, 0x69, 0x87, 4, 0, 1, 0, 0, 0, 200, 0, 0, 0, 0, 0, 0,
          0,
        ]),
      ),
    ).toBeNull();
  });

  it('reads a big-endian DateTimeOriginal', () => {
    expect(
      readJpegTakenAt(
        jpegExif({
          little: false,
          dateTimeOriginal: '2026:09:22 11:40:00',
          offsetTimeOriginal: '+08:00',
        }),
      ),
    ).toBe('2026-09-22T11:40:00+08:00');
  });
});
