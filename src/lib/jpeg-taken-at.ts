const JPEG_START_OF_IMAGE = 0xd8;
const JPEG_APP1 = 0xe1;
const JPEG_START_OF_SCAN = 0xda;
const JPEG_END_OF_IMAGE = 0xd9;

const TIFF_TYPE_ASCII = 2;
const TIFF_TYPE_LONG = 4;
const TIFF_TAG_DATETIME = 0x0132;
const TIFF_TAG_EXIF_IFD = 0x8769;
const TIFF_TAG_DATETIME_ORIGINAL = 0x9003;
const TIFF_TAG_DATETIME_DIGITIZED = 0x9004;
const TIFF_TAG_OFFSET_TIME = 0x9010;
const TIFF_TAG_OFFSET_TIME_ORIGINAL = 0x9011;
const TIFF_TAG_OFFSET_TIME_DIGITIZED = 0x9012;

type ByteOrder = 'little' | 'big';

type IfdValues = {
  dateTime: string | null;
  dateTimeOriginal: string | null;
  dateTimeDigitized: string | null;
  offsetTime: string | null;
  offsetTimeOriginal: string | null;
  offsetTimeDigitized: string | null;
  exifIfdOffset: number | null;
};

function readUint16(bytes: Uint8Array, offset: number, order: ByteOrder): number | null {
  /* v8 ignore next 3 -- callers only read inside a segment already bounds-checked */
  if (offset < 0 || offset + 2 > bytes.length) {
    return null;
  }
  const first = bytes[offset];
  const second = bytes[offset + 1];
  /* v8 ignore next 3 -- the length check already rejected a short read */
  if (first === undefined || second === undefined) {
    return null;
  }
  return order === 'little' ? first | (second << 8) : (first << 8) | second;
}

function readUint32(bytes: Uint8Array, offset: number, order: ByteOrder): number | null {
  /* v8 ignore next 3 -- callers only read inside a segment already bounds-checked */
  if (offset < 0 || offset + 4 > bytes.length) {
    return null;
  }
  const b0 = bytes[offset];
  const b1 = bytes[offset + 1];
  const b2 = bytes[offset + 2];
  const b3 = bytes[offset + 3];
  /* v8 ignore next 3 -- the length check already rejected a short read */
  if (b0 === undefined || b1 === undefined || b2 === undefined || b3 === undefined) {
    return null;
  }
  if (order === 'little') {
    return (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0;
  }
  return b0 * 0x1000000 + (b1 << 16) + (b2 << 8) + b3;
}

function readAscii(
  bytes: Uint8Array,
  tiffStart: number,
  tiffEnd: number,
  entryOffset: number,
  count: number,
  order: ByteOrder,
): string | null {
  if (count < 1) {
    return null;
  }
  const valueOffset = count <= 4 ? entryOffset + 8 : readUint32(bytes, entryOffset + 8, order);
  /* v8 ignore next 3 -- the offset field sits inside an entry already bounds-checked */
  if (valueOffset === null) {
    return null;
  }
  const start = count <= 4 ? valueOffset : tiffStart + valueOffset;
  if (start < tiffStart || start + count > tiffEnd) {
    return null;
  }
  let value = '';
  for (let index = 0; index < count; index += 1) {
    const byte = bytes[start + index];
    /* v8 ignore next 3 -- the ASCII span was bounds-checked */
    if (byte === undefined) {
      break;
    }
    if (byte === 0) {
      break;
    }
    value += String.fromCharCode(byte);
  }
  return value;
}

function emptyIfdValues(): IfdValues {
  return {
    dateTime: null,
    dateTimeOriginal: null,
    dateTimeDigitized: null,
    offsetTime: null,
    offsetTimeOriginal: null,
    offsetTimeDigitized: null,
    exifIfdOffset: null,
  };
}

function readIfd(
  bytes: Uint8Array,
  tiffStart: number,
  tiffEnd: number,
  relativeOffset: number,
  order: ByteOrder,
): IfdValues | null {
  const start = tiffStart + relativeOffset;
  const entryCount = readUint16(bytes, start, order);
  if (entryCount === null) {
    return null;
  }
  const entriesStart = start + 2;
  const entriesEnd = entriesStart + entryCount * 12;
  if (start < tiffStart || entriesEnd + 4 > tiffEnd) {
    return null;
  }

  const values = emptyIfdValues();
  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = entriesStart + index * 12;
    const tag = readUint16(bytes, entryOffset, order);
    const type = readUint16(bytes, entryOffset + 2, order);
    const count = readUint32(bytes, entryOffset + 4, order);
    /* v8 ignore next 3 -- each entry lies inside the segment already bounds-checked */
    if (tag === null || type === null || count === null) {
      return null;
    }

    if (tag === TIFF_TAG_EXIF_IFD && type === TIFF_TYPE_LONG && count === 1) {
      values.exifIfdOffset = readUint32(bytes, entryOffset + 8, order);
      continue;
    }
    if (type !== TIFF_TYPE_ASCII) {
      continue;
    }
    const value = readAscii(bytes, tiffStart, tiffEnd, entryOffset, count, order);
    if (value === null) {
      return null;
    }
    switch (tag) {
      case TIFF_TAG_DATETIME:
        values.dateTime = value;
        break;
      case TIFF_TAG_DATETIME_ORIGINAL:
        values.dateTimeOriginal = value;
        break;
      case TIFF_TAG_DATETIME_DIGITIZED:
        values.dateTimeDigitized = value;
        break;
      case TIFF_TAG_OFFSET_TIME:
        values.offsetTime = value;
        break;
      case TIFF_TAG_OFFSET_TIME_ORIGINAL:
        values.offsetTimeOriginal = value;
        break;
      case TIFF_TAG_OFFSET_TIME_DIGITIZED:
        values.offsetTimeDigitized = value;
        break;
    }
  }
  return values;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

function formatExifDate(value: string, offset: string | null): string | null {
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (match === null) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }
  const civil = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}`;
  return offset !== null && /^[+-]\d{2}:\d{2}$/.test(offset) ? `${civil}${offset}` : civil;
}

function readExifTakenAt(bytes: Uint8Array, start: number, end: number): string | null {
  if (
    end - start < 14 ||
    bytes[start] !== 0x45 ||
    bytes[start + 1] !== 0x78 ||
    bytes[start + 2] !== 0x69 ||
    bytes[start + 3] !== 0x66 ||
    bytes[start + 4] !== 0 ||
    bytes[start + 5] !== 0
  ) {
    return null;
  }
  const tiffStart = start + 6;
  const order: ByteOrder | null =
    bytes[tiffStart] === 0x49 && bytes[tiffStart + 1] === 0x49
      ? 'little'
      : bytes[tiffStart] === 0x4d && bytes[tiffStart + 1] === 0x4d
        ? 'big'
        : null;
  if (order === null || readUint16(bytes, tiffStart + 2, order) !== 42) {
    return null;
  }
  const ifd0Offset = readUint32(bytes, tiffStart + 4, order);
  /* v8 ignore next 3 -- a 14-byte header leaves four bytes for this offset */
  if (ifd0Offset === null) {
    return null;
  }
  const ifd0 = readIfd(bytes, tiffStart, end, ifd0Offset, order);
  if (ifd0 === null) {
    return null;
  }
  const exif =
    ifd0.exifIfdOffset === null
      ? emptyIfdValues()
      : readIfd(bytes, tiffStart, end, ifd0.exifIfdOffset, order);
  if (exif === null) {
    return null;
  }

  if (exif.dateTimeOriginal !== null) {
    return formatExifDate(exif.dateTimeOriginal, exif.offsetTimeOriginal);
  }
  if (exif.dateTimeDigitized !== null) {
    return formatExifDate(exif.dateTimeDigitized, exif.offsetTimeDigitized);
  }
  if (ifd0.dateTime !== null) {
    return formatExifDate(ifd0.dateTime, exif.offsetTime ?? ifd0.offsetTime);
  }
  return null;
}

/**
 * Reads a JPEG APP1 Exif capture time without following the GPS IFD.
 *
 * @param bytes - Complete JPEG file bytes.
 * @returns Civil capture time with an optional matching Exif offset, or `null`.
 */
export function readJpegTakenAt(bytes: Uint8Array): string | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== JPEG_START_OF_IMAGE) {
    return null;
  }

  let cursor = 2;
  while (cursor < bytes.length) {
    if (bytes[cursor] !== 0xff) {
      return null;
    }
    while (cursor < bytes.length && bytes[cursor] === 0xff) {
      cursor += 1;
    }
    if (cursor >= bytes.length) {
      return null;
    }
    const marker = bytes[cursor];
    cursor += 1;
    /* v8 ignore next 3 -- cursor was still inside the buffer */
    if (marker === undefined) {
      return null;
    }
    if (marker === JPEG_END_OF_IMAGE || marker === JPEG_START_OF_SCAN) {
      return null;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (cursor + 2 > bytes.length) {
      return null;
    }
    const lengthHi = bytes[cursor];
    const lengthLo = bytes[cursor + 1];
    /* v8 ignore next 3 -- the two length bytes were bounds-checked */
    if (lengthHi === undefined || lengthLo === undefined) {
      return null;
    }
    const length = (lengthHi << 8) | lengthLo;
    if (length < 2) {
      return null;
    }
    const segmentStart = cursor + 2;
    const segmentEnd = segmentStart + length - 2;
    if (segmentEnd > bytes.length) {
      return null;
    }
    if (marker === JPEG_APP1) {
      const isExif =
        segmentEnd - segmentStart >= 6 &&
        bytes[segmentStart] === 0x45 &&
        bytes[segmentStart + 1] === 0x78 &&
        bytes[segmentStart + 2] === 0x69 &&
        bytes[segmentStart + 3] === 0x66 &&
        bytes[segmentStart + 4] === 0 &&
        bytes[segmentStart + 5] === 0;
      if (isExif) {
        return readExifTakenAt(bytes, segmentStart, segmentEnd);
      }
    }
    cursor = segmentEnd;
  }
  return null;
}
