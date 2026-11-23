/**
 * SafeHarbor Studio Pro — Zero-Dependency Pure-JS Standard UTF-8 ZIP Builder
 *
 * Uses STORE compression (method 0), IEEE 802.3 CRC-32, and UTF-8 General Purpose Bit Flag (0x0800)
 * so ASCII and Unicode/CJK filenames unpack cleanly in macOS Finder, Windows Explorer, and Python zipfile.
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
 * @returns {number}
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

export function normalizeZipEntryPath(name) {
  const cleaned = String(name || 'untitled.txt')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\.\.\//g, '')
    .replace(/\/+/g, '/');
  return cleaned || 'untitled.txt';
}

/**
 * Build a standard ZIP archive (STORE method = 0, UTF-8 EFS flag = 0x0800).
 * @param {Array<{ name: string, content: string | Uint8Array, date?: Date }>} entries
 * @returns {Uint8Array}
 */
export function buildZipArchive(entries) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('ZIP archive requires at least one entry');
  }

  const UTF8_FLAG = 0x0800;
  const VERSION_NEEDED = 20;
  const VERSION_MADE_BY = 0x0314;
  const EXTERNAL_FILE_ATTR = 0x81a40000;

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const safeName = normalizeZipEntryPath(entry.name);
    const nameBytes = TEXT_ENCODER.encode(safeName);
    const dataBytes = entry.content instanceof Uint8Array
      ? entry.content
      : TEXT_ENCODER.encode(String(entry.content ?? ''));

    const checksum = crc32(dataBytes);
    const { dosTime, dosDate } = toDosDateTime(entry.date);
    const localOffset = offset;

    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, VERSION_NEEDED, true);
    lv.setUint16(6, UTF8_FLAG, true);
    lv.setUint16(8, 0, true);
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

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, VERSION_MADE_BY, true);
    cv.setUint16(6, VERSION_NEEDED, true);
    cv.setUint16(8, UTF8_FLAG, true);
    cv.setUint16(10, 0, true);
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

/**
 * Package shareable de-identified dataset + IRB Audit Certificate (HTML & JSON) + handling instructions.
 * NOTE: By default, `reid_key_map_DO_NOT_SHARE.csv` is intentionally EXCLUDED from the shareable bundle
 * so researchers never accidentally transmit the PI-only re-identification key with the de-identified CSV.
 */
export function buildSafeHarborBundleZip({
  cleanCsv,
  cleanFilename = 'cohort_deidentified.csv',
  certificateHtml = '',
  certificateJson = '',
  reidKeyMapCsv = '',
  includeReidMap = false,
  date = new Date(),
  filename = '',
}) {
  const now = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const entries = [
    {
      name: normalizeZipEntryPath(cleanFilename),
      content: cleanCsv,
      date: now,
    },
  ];

  if (certificateHtml) {
    entries.push({
      name: 'IRB_DeIdentification_Audit_Certificate.html',
      content: certificateHtml,
      date: now,
    });
  }

  if (certificateJson) {
    entries.push({
      name: 'IRB_DeIdentification_Audit_Log.json',
      content: certificateJson,
      date: now,
    });
  }

  if (includeReidMap && reidKeyMapCsv) {
    entries.push({
      name: 'reid_key_map_DO_NOT_SHARE.csv',
      content: reidKeyMapCsv,
      date: now,
    });
  }

  const handlingNote = [
    'SafeHarbor Studio Pro — De-Identified Research Bundle',
    '=====================================================',
    '',
    'Contents:',
    `- ${normalizeZipEntryPath(cleanFilename)} : De-identified dataset processed under HIPAA Safe Harbor (45 CFR § 164.514(b)(2)).`,
    '- IRB_DeIdentification_Audit_Certificate.html : Printable SHA-256 cryptographic audit certificate (open in browser and Print -> Save as PDF).',
    '- IRB_DeIdentification_Audit_Log.json : Machine-readable compliance audit manifest with SHA-256 input/output digests.',
    '',
    'Re-Identification Key Policy (45 CFR § 164.514(c)):',
    includeReidMap
      ? '- WARNING: reid_key_map_DO_NOT_SHARE.csv was explicitly included. Remove it before external sharing.'
      : '- reid_key_map_DO_NOT_SHARE.csv is intentionally omitted from this shareable archive. Download and store it separately behind your IRB firewall.',
    '',
    'Disclaimer:',
    'SafeHarbor Studio Pro is a local workflow utility and does not constitute legal counsel or formal Institutional Privacy Officer determination.',
    'Review all output columns and free-text fields before external release.',
    '',
  ].join('\n');

  entries.push({
    name: 'README_HANDLING_INSTRUCTIONS.txt',
    content: handlingNote,
    date: now,
  });

  const bytes = buildZipArchive(entries);
  const stamp = now.toISOString().slice(0, 10);
  return {
    bytes,
    filename: filename || `safeharbor-deidentified-${stamp}.zip`,
    entryCount: entries.length,
    entryNames: entries.map((e) => e.name),
  };
}
