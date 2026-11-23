/**
 * GPSRKit Pro — Pure-JS Zero-Dependency UTF-8 PKZIP Archiver
 *
 * Produces standard PKZIP (Method 0 / STORE) archives with IEEE 802.3 CRC-32
 * and UTF-8 filename flag (bit 11 = 0x0800). Works identically in browsers and Node v22.
 */

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
 * Compute standard IEEE 802.3 CRC-32 checksum over a Uint8Array or string.
 */
export function crc32(input) {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : (input instanceof Uint8Array ? input : new Uint8Array(input));
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosTimeDate(date = new Date()) {
  const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const year = Math.min(2107, Math.max(1980, d.getFullYear()));
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const seconds = Math.floor(d.getSeconds() / 2);

  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { dosTime, dosDate };
}

function sanitizeZipPath(rawPath, index) {
  const normalized = String(rawPath || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((seg) => seg && seg !== '.' && seg !== '..')
    .join('/');
  return normalized || `file-${index + 1}.txt`;
}

/**
 * Create a PKZIP archive `Uint8Array` from an array of `{ name, data, date? }` entries.
 */
export function createZipArchive(entries = []) {
  const encoder = new TextEncoder();
  const prepared = [];
  const usedNames = new Set();

  entries.forEach((entry, idx) => {
    let safeName = sanitizeZipPath(entry?.name, idx);
    if (usedNames.has(safeName)) {
      const dot = safeName.lastIndexOf('.');
      if (dot > 0) {
        safeName = `${safeName.slice(0, dot)}-${idx + 1}${safeName.slice(dot)}`;
      } else {
        safeName = `${safeName}-${idx + 1}`;
      }
    }
    usedNames.add(safeName);

    const nameBytes = encoder.encode(safeName);
    const dataBytes = typeof entry?.data === 'string'
      ? encoder.encode(entry.data)
      : (entry?.data instanceof Uint8Array ? entry.data : new Uint8Array(entry?.data || []));
    const checksum = crc32(dataBytes);
    const { dosTime, dosDate } = toDosTimeDate(entry?.date);

    prepared.push({
      name: safeName,
      nameBytes,
      dataBytes,
      checksum,
      dosTime,
      dosDate,
      localHeaderOffset: 0,
    });
  });

  // Calculate total archive byte size
  let localSectionSize = 0;
  let centralDirSize = 0;
  for (const item of prepared) {
    item.localHeaderOffset = localSectionSize;
    localSectionSize += 30 + item.nameBytes.length + item.dataBytes.length;
    centralDirSize += 46 + item.nameBytes.length;
  }

  const totalSize = localSectionSize + centralDirSize + 22;
  const output = new Uint8Array(totalSize);
  const view = new DataView(output.buffer);

  // 1. Write Local File Headers + File Data
  let offset = 0;
  for (const item of prepared) {
    view.setUint32(offset, 0x04034b50, true); // Local file header signature
    view.setUint16(offset + 4, 20, true); // Version needed to extract (2.0)
    view.setUint16(offset + 6, 0x0800, true); // General purpose bit flag: UTF-8 filename
    view.setUint16(offset + 8, 0, true); // Compression method: 0 (STORE)
    view.setUint16(offset + 10, item.dosTime, true);
    view.setUint16(offset + 12, item.dosDate, true);
    view.setUint32(offset + 14, item.checksum, true);
    view.setUint32(offset + 18, item.dataBytes.length, true); // Compressed size
    view.setUint32(offset + 22, item.dataBytes.length, true); // Uncompressed size
    view.setUint16(offset + 26, item.nameBytes.length, true);
    view.setUint16(offset + 28, 0, true); // Extra field length
    offset += 30;

    output.set(item.nameBytes, offset);
    offset += item.nameBytes.length;

    output.set(item.dataBytes, offset);
    offset += item.dataBytes.length;
  }

  // 2. Write Central Directory Headers
  const centralDirOffset = offset;
  for (const item of prepared) {
    view.setUint32(offset, 0x02014b50, true); // Central directory file header signature
    view.setUint16(offset + 4, 0x0314, true); // Version made by (Unix, 2.0)
    view.setUint16(offset + 6, 20, true); // Version needed to extract
    view.setUint16(offset + 8, 0x0800, true); // UTF-8 filename flag
    view.setUint16(offset + 10, 0, true); // Compression method: 0 (STORE)
    view.setUint16(offset + 12, item.dosTime, true);
    view.setUint16(offset + 14, item.dosDate, true);
    view.setUint32(offset + 16, item.checksum, true);
    view.setUint32(offset + 20, item.dataBytes.length, true);
    view.setUint32(offset + 24, item.dataBytes.length, true);
    view.setUint16(offset + 28, item.nameBytes.length, true);
    view.setUint16(offset + 30, 0, true); // Extra field length
    view.setUint16(offset + 32, 0, true); // Comment length
    view.setUint16(offset + 34, 0, true); // Disk number start
    view.setUint16(offset + 36, 0, true); // Internal file attributes
    view.setUint32(offset + 38, (0o100644 << 16) >>> 0, true); // External file attributes (-rw-r--r--)
    view.setUint32(offset + 42, item.localHeaderOffset, true);
    offset += 46;

    output.set(item.nameBytes, offset);
    offset += item.nameBytes.length;
  }

  // 3. Write End of Central Directory Record (EOCD)
  view.setUint32(offset, 0x06054b50, true); // EOCD signature
  view.setUint16(offset + 4, 0, true); // Number of this disk
  view.setUint16(offset + 6, 0, true); // Disk where CD starts
  view.setUint16(offset + 8, prepared.length, true); // Entries on this disk
  view.setUint16(offset + 10, prepared.length, true); // Total entries
  view.setUint32(offset + 12, centralDirSize, true);
  view.setUint32(offset + 16, centralDirOffset, true);
  view.setUint16(offset + 20, 0, true); // ZIP comment length

  return output;
}
