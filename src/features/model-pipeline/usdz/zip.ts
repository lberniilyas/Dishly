/**
 * Minimal ZIP writer for USDZ packages.
 *
 * A .usdz file is a ZIP archive with strict rules (Pixar USD spec, required by
 * iPhone AR Quick Look):
 *  - files are stored uncompressed
 *  - each file's data starts on a 64-byte boundary (iOS memory-maps it)
 *  - the first file is the main scene layer (.usda / .usdc)
 *
 * Generic zip libraries don't guarantee the alignment, so we write the format
 * by hand: it's simple for uncompressed files.
 */

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const DOS_DATE_1980_01_01 = (0 << 9) | (1 << 5) | 1;
/** Extra-field id used for padding (same as Pixar's own usdzip). */
const PADDING_EXTRA_ID = 0x1986;

export function writeUsdzArchive(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const size = entry.data.byteLength;
    const crc = crc32(entry.data);

    // Pad the local header's "extra" field so the data starts at a multiple of 64.
    const headerLength = 30 + name.length;
    let pad = (64 - ((offset + headerLength) % 64)) % 64;
    if (pad > 0 && pad < 4) pad += 64; // an extra field needs at least 4 bytes
    const local = new Uint8Array(headerLength + pad);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // local file header signature
    lv.setUint16(4, 20, true); // version needed to extract (2.0)
    lv.setUint16(6, 0, true); // flags
    lv.setUint16(8, 0, true); // compression: stored
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, DOS_DATE_1980_01_01, true); // mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true); // compressed size
    lv.setUint32(22, size, true); // uncompressed size
    lv.setUint16(26, name.length, true);
    lv.setUint16(28, pad, true); // extra field length
    local.set(name, 30);
    if (pad > 0) {
      lv.setUint16(headerLength, PADDING_EXTRA_ID, true);
      lv.setUint16(headerLength + 2, pad - 4, true);
    }

    const cen = new Uint8Array(46 + name.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true); // central directory signature
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0, true); // flags
    cv.setUint16(10, 0, true); // compression: stored
    cv.setUint16(12, 0, true); // time
    cv.setUint16(14, DOS_DATE_1980_01_01, true); // date
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint16(30, 0, true); // extra length
    cv.setUint16(32, 0, true); // comment length
    cv.setUint16(34, 0, true); // disk number
    cv.setUint16(36, 0, true); // internal attributes
    cv.setUint32(38, 0, true); // external attributes
    cv.setUint32(42, offset, true); // offset of local header
    cen.set(name, 46);

    parts.push(local, entry.data);
    central.push(cen);
    offset += local.length + size;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true); // end of central directory signature
  ev.setUint16(8, entries.length, true); // entries on this disk
  ev.setUint16(10, entries.length, true); // total entries
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true); // central directory offset

  const out = new Uint8Array(offset + centralSize + end.length);
  let pos = 0;
  for (const part of [...parts, ...central, end]) {
    out.set(part, pos);
    pos += part.length;
  }
  return out;
}
