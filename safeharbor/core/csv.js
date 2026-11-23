/**
 * SafeHarbor Studio Pro — RFC 4180 CSV/TSV Parser & Serializer
 * Zero-dependency ES module supporting:
 * - UTF-8 BOM stripping/emitting
 * - Auto-detection of CSV (comma) vs TSV (tab) respecting quoted fields
 * - Quoted fields containing delimiters, newlines (LF/CRLF), and escaped quotes ("")
 * - CRLF, LF, and CR line endings
 */

/**
 * Strip a leading UTF-8 BOM (`\uFEFF`) if present.
 */
export function stripUtf8Bom(text) {
  const str = String(text ?? '');
  if (str.charCodeAt(0) === 0xfeff) {
    return { text: str.slice(1), hadBom: true };
  }
  return { text: str, hadBom: false };
}

/**
 * Detect whether raw tabular text uses comma (CSV) or tab (TSV) delimiters,
 * ignoring delimiter characters enclosed inside double-quoted fields.
 */
export function detectDelimiter(rawText) {
  const { text } = stripUtf8Bom(rawText);
  if (!text.trim()) return ',';

  let commaCounts = [];
  let tabCounts = [];
  let inQuotes = false;
  let curCommas = 0;
  let curTabs = 0;
  let lineCount = 0;

  for (let i = 0; i < text.length && lineCount < 12; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          i += 1;
        } else {
          inQuotes = false;
        }
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      curCommas += 1;
    } else if (ch === '\t') {
      curTabs += 1;
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      if (curCommas > 0 || curTabs > 0 || lineCount > 0) {
        commaCounts.push(curCommas);
        tabCounts.push(curTabs);
        lineCount += 1;
      }
      curCommas = 0;
      curTabs = 0;
    }
  }
  if (lineCount < 12 && (curCommas > 0 || curTabs > 0)) {
    commaCounts.push(curCommas);
    tabCounts.push(curTabs);
  }

  if (commaCounts.length === 0) return ',';

  const headerTabs = tabCounts[0] || 0;
  const headerCommas = commaCounts[0] || 0;

  // Prefer TSV when the header line has tabs and consistent tab structure across sampled lines.
  if (headerTabs > 0) {
    const consistentTabs = tabCounts.every((c) => c === headerTabs);
    const consistentCommas = headerCommas > 0 && commaCounts.every((c) => c === headerCommas);
    if (consistentTabs && !consistentCommas) return '\t';
    if (headerTabs >= headerCommas) return '\t';
  }

  return ',';
}

/**
 * Parse RFC 4180 CSV or TSV text into `{ headers, rows, delimiter, format, hadBom, lineEnding }`.
 */
export function parseDelimited(rawText, options = {}) {
  const { text, hadBom } = stripUtf8Bom(rawText);
  const lineEnding = text.includes('\r\n') ? '\r\n' : '\n';
  const delimiter = options.delimiter || detectDelimiter(text);
  const format = delimiter === '\t' ? 'tsv' : 'csv';

  if (!text.trim()) {
    return { headers: [], rows: [], delimiter, format, hadBom, lineEnding };
  }

  const records = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let fieldStarted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
      continue;
    }

    if (ch === delimiter) {
      row.push(field);
      field = '';
      fieldStarted = false;
      continue;
    }

    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      row.push(field);
      records.push(row);
      row = [];
      field = '';
      fieldStarted = false;
      continue;
    }

    field += ch;
    fieldStarted = true;
  }

  // Flush final record if non-empty
  if (fieldStarted || row.length > 0) {
    row.push(field);
    records.push(row);
  }

  // Drop trailing completely-empty records caused by trailing newlines
  while (
    records.length > 0 &&
    records[records.length - 1].length === 1 &&
    records[records.length - 1][0] === ''
  ) {
    records.pop();
  }

  if (records.length === 0) {
    return { headers: [], rows: [], delimiter, format, hadBom, lineEnding };
  }

  const rawHeaders = records[0].map((h, idx) => {
    const cleaned = String(h ?? '').trim();
    return cleaned || `column_${idx + 1}`;
  });

  // Compute maximum width across all records so ragged rows never drop data
  let maxCols = rawHeaders.length;
  for (let r = 1; r < records.length; r++) {
    if (records[r].length > maxCols) {
      maxCols = records[r].length;
    }
  }

  const headers = [...rawHeaders];
  while (headers.length < maxCols) {
    headers.push(`column_${headers.length + 1}`);
  }

  const rows = [];
  for (let r = 1; r < records.length; r++) {
    const rec = records[r];
    // Skip pure blank lines inside or at end of file
    if (rec.length === 1 && rec[0].trim() === '') continue;
    const normalized = new Array(maxCols);
    for (let c = 0; c < maxCols; c++) {
      normalized[c] = c < rec.length ? String(rec[c] ?? '') : '';
    }
    rows.push(normalized);
  }

  return { headers, rows, delimiter, format, hadBom, lineEnding };
}

/**
 * Format a single field according to RFC 4180 quoting rules.
 */
export function escapeDelimitedField(value, delimiter = ',') {
  const str = String(value ?? '');
  const needsQuotes =
    str.includes(delimiter) ||
    str.includes('"') ||
    str.includes('\n') ||
    str.includes('\r');
  if (!needsQuotes) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Serialize headers and row arrays into RFC 4180 CSV or TSV text.
 */
export function serializeDelimited(headers, rows, options = {}) {
  const delimiter = options.delimiter || ',';
  const lineEnding = options.lineEnding || '\n';
  const bom = Boolean(options.bom);

  const lines = [];
  if (Array.isArray(headers) && headers.length > 0) {
    lines.push(headers.map((h) => escapeDelimitedField(h, delimiter)).join(delimiter));
  }
  for (const row of rows || []) {
    lines.push(row.map((cell) => escapeDelimitedField(cell, delimiter)).join(delimiter));
  }

  return (bom ? '\uFEFF' : '') + lines.join(lineEnding);
}
