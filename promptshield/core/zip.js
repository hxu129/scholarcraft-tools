/**
 * PromptShield Pro — Zero-dependency pure JavaScript UTF-8 ZIP builder (STORE).
 * Uses IEEE 802.3 CRC-32 and UTF-8 General Purpose Bit Flag (0x0800) so Chinese
 * and Unicode filenames extract cleanly on macOS Finder, Windows Explorer, and Python zipfile.
 */

const TEXT_ENCODER = new TextEncoder();

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

/**
 * Compute standard IEEE 802.3 CRC-32 checksum.
 * @param {Uint8Array} bytes
 * @returns {number} Unsigned 32-bit CRC
 */
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(dateInput) {
  const d = dateInput instanceof Date && !Number.isNaN(dateInput.getTime())
    ? dateInput
    : new Date();
  const year = Math.min(2107, Math.max(1980, d.getFullYear()));
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = Math.floor(d.getSeconds() / 2);

  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
  return { dosTime, dosDate };
}

const WINDOWS_RESERVED_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * Normalize an archive entry path, preventing directory traversal (`..`)
 * and Windows/macOS illegal characters while preserving UTF-8 / CJK names.
 * @param {string} name
 * @returns {string}
 */
export function normalizeEntryPath(name) {
  const parts = String(name || 'untitled.txt')
    .normalize('NFC')
    .replace(/\\/g, '/')
    .split('/')
    .filter((seg) => seg && seg !== '.' && seg !== '..')
    .map((seg) => {
      let clean = seg
        .replace(/[\x00-\x1f\x7f]/g, '_')
        .replace(/[:*?"<>|]+/g, '_')
        .replace(/^[\s.]+|[\s.]+$/g, '');
      if (!clean || WINDOWS_RESERVED_RE.test(clean.split('.')[0])) {
        clean = `file_${clean || 'untitled'}`;
      }
      return clean;
    });

  return parts.length > 0 ? parts.join('/') : 'untitled.txt';
}

/**
 * Build a standard ZIP archive (STORE method = 0, UTF-8 EFS bit = 0x0800).
 * @param {Array<{ name: string, content: string | Uint8Array, date?: Date }>} entries
 * @returns {Uint8Array}
 */
export function buildZipArchive(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('ZIP archive requires at least one entry');
  }

  const UTF8_FLAG = 0x0800;
  const VERSION_NEEDED = 20; // ZIP 2.0
  const VERSION_MADE_BY = 0x0314; // Unix (3) + ZIP 2.0 (20)
  const EXTERNAL_FILE_ATTR = 0x81a40000; // rw-r--r--

  const localParts = [];
  const centralParts = [];
  const usedPaths = new Set();
  let offset = 0;

  for (const entry of entries) {
    let safeName = normalizeEntryPath(entry.name);
    if (usedPaths.has(safeName.toLowerCase())) {
      const dot = safeName.lastIndexOf('.');
      const stem = dot > safeName.lastIndexOf('/') ? safeName.slice(0, dot) : safeName;
      const ext = dot > safeName.lastIndexOf('/') ? safeName.slice(dot) : '';
      let suffix = 2;
      while (usedPaths.has(`${stem}_${suffix}${ext}`.toLowerCase())) {
        suffix++;
      }
      safeName = `${stem}_${suffix}${ext}`;
    }
    usedPaths.add(safeName.toLowerCase());

    const nameBytes = TEXT_ENCODER.encode(safeName);
    const dataBytes = entry.content instanceof Uint8Array
      ? entry.content
      : TEXT_ENCODER.encode(String(entry.content ?? ''));

    const checksum = crc32(dataBytes);
    const { dosTime, dosDate } = toDosDateTime(entry.date);
    const localOffset = offset;

    // Local File Header (30 bytes + filename)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, VERSION_NEEDED, true);
    lv.setUint16(6, UTF8_FLAG, true);
    lv.setUint16(8, 0, true); // STORE
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, dataBytes.length, true);
    lv.setUint32(22, dataBytes.length, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);
    offset += localHeader.length + dataBytes.length;

    // Central Directory Header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, VERSION_MADE_BY, true);
    cv.setUint16(6, VERSION_NEEDED, true);
    cv.setUint16(8, UTF8_FLAG, true);
    cv.setUint16(10, 0, true); // STORE
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, checksum, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, EXTERNAL_FILE_ATTR, true);
    cv.setUint32(42, localOffset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
  }

  const centralDirectoryOffset = offset;
  let centralDirectorySize = 0;
  for (const part of centralParts) {
    centralDirectorySize += part.length;
  }

  // End of Central Directory Record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralDirectorySize, true);
  ev.setUint32(16, centralDirectoryOffset, true);
  ev.setUint16(20, 0, true);

  const totalSize = offset + centralDirectorySize + eocd.length;
  const output = new Uint8Array(totalSize);
  let cursor = 0;
  for (const part of localParts) {
    output.set(part, cursor);
    cursor += part.length;
  }
  for (const part of centralParts) {
    output.set(part, cursor);
    cursor += part.length;
  }
  output.set(eocd, cursor);

  return output;
}
