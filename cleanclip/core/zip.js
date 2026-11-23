/**
 * Zero-dependency pure JavaScript standard ZIP archive builder (STORE method)
 * with IEEE 802.3 CRC-32 and UTF-8 General Purpose Bit Flag (0x0800) so Chinese
 * and Unicode filenames extract cleanly on macOS Finder, Windows Explorer, and Python zipfile.
 */

import { estimateTokens, formatContextPercent } from './tokens.js';

const TEXT_ENCODER = new TextEncoder();

// Precompute IEEE 802.3 CRC-32 lookup table (polynomial 0xEDB88320)
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
 * Compute standard IEEE CRC-32 checksum for a Uint8Array.
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

function normalizeEntryPath(name) {
  const cleaned = String(name || 'untitled.txt')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/');
  return cleaned || 'untitled.txt';
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
  const EXTERNAL_FILE_ATTR = 0x81a40000; // Regular file rw-r--r-- (0100644 << 16)

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const safeName = normalizeEntryPath(entry.name);
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
    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, VERSION_NEEDED, true);
    lv.setUint16(6, UTF8_FLAG, true);
    lv.setUint16(8, 0, true); // Compression method: 0 (STORE)
    lv.setUint16(10, dosTime, true);
    lv.setUint16(12, dosDate, true);
    lv.setUint32(14, checksum, true);
    lv.setUint32(18, dataBytes.length, true); // Compressed size
    lv.setUint32(22, dataBytes.length, true); // Uncompressed size
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true); // Extra field length
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, dataBytes);
    offset += localHeader.length + dataBytes.length;

    // Central Directory File Header (46 bytes + filename)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central directory signature
    cv.setUint16(4, VERSION_MADE_BY, true);
    cv.setUint16(6, VERSION_NEEDED, true);
    cv.setUint16(8, UTF8_FLAG, true);
    cv.setUint16(10, 0, true); // Compression method: 0 (STORE)
    cv.setUint16(12, dosTime, true);
    cv.setUint16(14, dosDate, true);
    cv.setUint32(16, checksum, true);
    cv.setUint32(20, dataBytes.length, true);
    cv.setUint32(24, dataBytes.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true); // Extra field length
    cv.setUint16(32, 0, true); // File comment length
    cv.setUint16(34, 0, true); // Disk number start
    cv.setUint16(36, 0, true); // Internal file attributes
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
  ev.setUint16(4, 0, true); // Number of this disk
  ev.setUint16(6, 0, true); // Disk with start of CD
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralDirectorySize, true);
  ev.setUint32(16, centralDirectoryOffset, true);
  ev.setUint16(20, 0, true); // ZIP file comment length

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

const WINDOWS_RESERVED_RE = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

/**
 * Sanitize a document title into a clean cross-platform & Obsidian-safe filename
 * (without extension), preserving readable English and CJK characters.
 *
 * @param {string} title
 * @param {number} [index] Optional 1-based index prefix (e.g., 1 -> "01-")
 * @param {{ maxLength?: number, padWidth?: number }} [options]
 * @returns {string}
 */
export function sanitizeFilename(title, index = null, options = {}) {
  const maxLength = options.maxLength || 72;
  const padWidth = options.padWidth || 2;

  let base = String(title || '')
    .normalize('NFC')
    // Strip control characters and OS/Obsidian unsafe characters
    .replace(/[\x00-\x1f\x7f]/g, ' ')
    .replace(/[\\/:*?"<>|#^\[\]]+/g, ' ')
    // Collapse whitespace
    .replace(/\s+/g, ' ')
    // Remove leading/trailing dots and spaces (Windows forbids trailing dots/spaces)
    .replace(/^[\s.]+|[\s.]+$/g, '');

  if (!base || WINDOWS_RESERVED_RE.test(base)) {
    base = base ? `note-${base}` : 'untitled-note';
  }

  // Truncate by Unicode code points so surrogate pairs are never split
  const codePoints = Array.from(base);
  if (codePoints.length > maxLength) {
    base = codePoints.slice(0, maxLength).join('').replace(/[\s.]+$/, '');
  }

  if (typeof index === 'number' && Number.isFinite(index) && index > 0) {
    const prefix = String(Math.floor(index)).padStart(padWidth, '0');
    return `${prefix}-${base}`;
  }
  return base;
}

function escapeTableCell(str) {
  return String(str || '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .trim();
}

/**
 * Build a complete Obsidian batch export ZIP containing all clipped `.md` notes
 * plus an auto-generated `_INDEX.md` with clickable Obsidian `[[wikilinks]]`,
 * source URLs, and token totals.
 *
 * @param {Array<{
 *   title: string,
 *   url?: string,
 *   markdown: string,
 *   tokens?: number,
 *   clippedAt?: string,
 *   tags?: string[]
 * }>} notes
 * @param {{ date?: Date, folderPrefix?: string, archiveTitle?: string }} [options]
 */
export function buildObsidianBatchZip(notes, options = {}) {
  if (!Array.isArray(notes) || notes.length === 0) {
    throw new Error('At least one clipped note is required to build a batch ZIP');
  }

  const now = options.date instanceof Date ? options.date : new Date();
  const padWidth = notes.length >= 100 ? 3 : 2;
  const prefix = options.folderPrefix
    ? `${normalizeEntryPath(options.folderPrefix).replace(/\/+$/, '')}/`
    : '';

  const usedStems = new Set();
  const files = [];
  let totalTokens = 0;

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i];
    const title = String(note.title || `Note ${i + 1}`).trim();
    const markdown = String(note.markdown || '');
    const tokens = typeof note.tokens === 'number'
      ? note.tokens
      : estimateTokens(markdown).tokens;
    totalTokens += tokens;

    let stem = sanitizeFilename(title, i + 1, { padWidth });
    let suffix = 2;
    while (usedStems.has(stem.toLowerCase())) {
      stem = `${sanitizeFilename(title, i + 1, { padWidth, maxLength: 64 })}-${suffix++}`;
    }
    usedStems.add(stem.toLowerCase());

    const filename = `${stem}.md`;
    files.push({
      stem,
      filename,
      path: `${prefix}${filename}`,
      title,
      url: String(note.url || ''),
      tokens,
      tags: Array.isArray(note.tags) ? note.tags : [],
      markdown,
    });
  }

  const totalStats = estimateTokens('');
  totalStats.tokens = totalTokens;
  const share128k = formatContextPercent(totalTokens / 128000);
  const share200k = formatContextPercent(totalTokens / 200000);
  const isoNow = now.toISOString();
  const dateStamp = isoNow.slice(0, 10);
  const archiveTitle = options.archiveTitle || `CleanClip Batch Export (${dateStamp})`;

  const rows = files.map((f, idx) => {
    const wikilink = `[[${f.stem}\\|${escapeTableCell(f.title)}]]`;
    const sourceCell = f.url ? `[Link](${f.url})` : '—';
    const tagsCell = f.tags.length > 0 ? f.tags.map((t) => `\`#${t}\``).join(' ') : '—';
    return `| ${idx + 1} | ${wikilink} | ${sourceCell} | ${f.tokens.toLocaleString('en-US')} | ${tagsCell} |`;
  });

  const indexMarkdown = [
    '---',
    `title: "${archiveTitle.replace(/"/g, '\\"')}"`,
    `created_at: "${isoNow}"`,
    `note_count: ${files.length}`,
    `total_estimated_tokens: ${totalTokens}`,
    'tags:',
    '  - cleanclip-batch',
    '  - index',
    '---',
    '',
    `# ${archiveTitle}`,
    '',
    `> **Notes**: ${files.length} · **Total Estimated Tokens**: ${totalTokens.toLocaleString('en-US')} (~${share128k} of 128k / ~${share200k} of 200k context)`,
    '',
    '| # | Note (Obsidian Wikilink) | Source | Est. Tokens | Tags |',
    '| :---: | :--- | :---: | ---: | :--- |',
    ...rows,
    '',
  ].join('\n');

  const zipEntries = [
    { name: `${prefix}_INDEX.md`, content: indexMarkdown, date: now },
    ...files.map((f) => ({ name: f.path, content: f.markdown, date: now })),
  ];

  const bytes = buildZipArchive(zipEntries);
  const timeStamp = `${dateStamp}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  return {
    bytes,
    filename: `CleanClip-Obsidian-${timeStamp}.zip`,
    indexMarkdown,
    files: files.map(({ stem, filename, path, title, url, tokens }) => ({
      stem,
      filename,
      path,
      title,
      url,
      tokens,
    })),
    totalTokens,
  };
}
