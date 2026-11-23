/**
 * PromptShield Pro — Pro Batch File & Structured Data Scrubber.
 *
 * Supports multi-file scrubbing across `.csv`, `.tsv`, `.json`, `.jsonl`, `.log`,
 * `.env`, `.py`, `.js`, `.ts`, `.sql`, `.txt`, `.md`, etc., sharing ONE deterministic
 * reversible session vault across the entire batch and exporting a standard UTF-8 ZIP.
 */

import {
  createVault,
  normalizeTokenPrefix,
  redact,
  registerVaultValue,
  restore,
} from './redactor.js';
import { buildZipArchive, normalizeEntryPath } from './zip.js';

export const SUPPORTED_EXTENSIONS = Object.freeze([
  '.csv', '.tsv', '.json', '.jsonl', '.ndjson',
  '.log', '.env', '.py', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx',
  '.sql', '.txt', '.md', '.yaml', '.yml', '.xml', '.ini', '.conf', '.sh',
]);

const SENSITIVE_COL_HINTS = [
  { re: /(?:^|[_-])(e?mail|邮箱|邮件)(?:$|[_-])/i, prefix: 'EMAIL' },
  { re: /(?:^|[_-])(phone|mobile|tel|cell|手机|电话)(?:$|[_-])/i, prefix: 'PHONE' },
  { re: /(?:^|[_-])(id_?card|id_?num(?:ber)?|national_?id|resident_?id|身份证|证件号)(?:$|[_-])/i, prefix: 'ID_NUM' },
  { re: /(?:^|[_-])(ssn|social_?security|tax_?id)(?:$|[_-])/i, prefix: 'SSN' },
  { re: /(?:^|[_-])(card|credit_?card|bank_?account|iban|银行卡|卡号|账号)(?:$|[_-])/i, prefix: 'CARD' },
  { re: /(?:^|[_-])(name|full_?name|first_?name|last_?name|customer_?name|client_?name|user_?name|contact_?name|姓名|客户名|联系人)(?:$|[_-])/i, prefix: 'NAME' },
  { re: /(?:^|[_-])(address|street|home_?addr|住址|地址)(?:$|[_-])/i, prefix: 'ADDRESS' },
  { re: /(?:^|[_-])(password|passwd|secret|token|api_?key|access_?key|密码|密钥)(?:$|[_-])/i, prefix: 'SECRET' },
  { re: /(?:^|[_-])(ip|ip_?addr(?:ess)?|client_?ip)(?:$|[_-])/i, prefix: 'IP' },
  { re: /(?:^|[_-])(company|org|organization|client|vendor|公司|机构)(?:$|[_-])/i, prefix: 'ORG' },
];

const SENSITIVE_JSON_KEY_RE = /(?:secret|password|passwd|api_?key|access_?key|private_?key|auth_?token|access_?token|refresh_?token|webhook_?secret|signing_?key|client_?secret|credential)/i;

/**
 * Detect logical file format from filename.
 * @param {string} filename
 * @returns {'csv'|'tsv'|'json'|'jsonl'|'text'}
 */
export function detectFileFormat(filename) {
  const lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.tsv')) return 'tsv';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.jsonl') || lower.endsWith('.ndjson')) return 'jsonl';
  return 'text';
}

/**
 * RFC 4180 compliant CSV/TSV parser supporting quoted fields, embedded commas/tabs,
 * escaped quotes (`""`), embedded newlines, and UTF-8 BOM.
 *
 * @param {string} text
 * @param {string} [delimiter=',']
 * @returns {{ rows: string[][], hasBom: boolean, lineEnding: string }}
 */
export function parseDelimited(text, delimiter = ',') {
  const raw = String(text ?? '');
  const hasBom = raw.startsWith('\uFEFF');
  const content = hasBom ? raw.slice(1) : raw;
  const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (inQuotes) {
      if (ch === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"' && field.length === 0) {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      if (content[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return { rows, hasBom, lineEnding };
}

/**
 * RFC 4180 CSV/TSV serializer preserving exact structure and escaping quotes/newlines/delimiters.
 * @param {string[][]} rows
 * @param {{ delimiter?: string, hasBom?: boolean, lineEnding?: string, quoteMask?: boolean[][] }} [options]
 * @returns {string}
 */
export function serializeDelimited(rows, options = {}) {
  const delimiter = options.delimiter || ',';
  const lineEnding = options.lineEnding || '\n';
  const hasBom = Boolean(options.hasBom);
  const quoteMask = options.quoteMask || null;

  const lines = rows.map((row, rIdx) => row.map((cell, cIdx) => {
    const s = String(cell ?? '');
    const forceQuote = Boolean(quoteMask?.[rIdx]?.[cIdx]);
    const needsQuote = forceQuote
      || s.includes(delimiter)
      || s.includes('"')
      || s.includes('\n')
      || s.includes('\r');
    if (!needsQuote) return s;
    return `"${s.replace(/"/g, '""')}"`;
  }).join(delimiter));

  return (hasBom ? '\uFEFF' : '') + lines.join(lineEnding);
}

/**
 * Inspect CSV/TSV header row and suggest likely PII columns.
 * @param {string} text
 * @param {string} [delimiter=',']
 */
export function inspectCsvHeaders(text, delimiter = ',') {
  const { rows } = parseDelimited(text, delimiter);
  if (rows.length === 0) {
    return { headers: [], rowCount: 0, suggestedPiiColumns: [] };
  }
  const headers = rows[0].map((h, idx) => (h.trim() ? h.trim() : `column_${idx + 1}`));
  const suggestedPiiColumns = headers.filter((h) => SENSITIVE_COL_HINTS.some((hint) => hint.re.test(h)));
  return {
    headers,
    rowCount: Math.max(0, rows.length - 1),
    suggestedPiiColumns,
  };
}

function getColumnTokenPrefix(headerName) {
  for (const hint of SENSITIVE_COL_HINTS) {
    if (hint.re.test(headerName)) return hint.prefix;
  }
  return normalizeTokenPrefix(`COL_${headerName}`, 'COL_PII');
}

function mergeCategoryStats(target, source) {
  for (const [k, v] of Object.entries(source || {})) {
    target[k] = (target[k] || 0) + v;
  }
}

/**
 * Scrub a CSV or TSV file with optional column-selective full-cell PII redaction
 * PLUS automatic secret & PII detection across every remaining cell.
 */
export function scrubDelimitedFile(text, options = {}, existingVault = null) {
  const delimiter = options.delimiter || ',';
  const vault = options.mutateVault && existingVault?.tokenToEntry
    ? existingVault
    : createVault(existingVault);

  const parsed = parseDelimited(text, delimiter);
  if (parsed.rows.length === 0) {
    return {
      sanitizedText: text,
      mapping: vault,
      totalHits: 0,
      statsByCategory: { secrets: 0, api_keys: 0, pii: 0, network: 0, custom: 0 },
      rowCount: 0,
      headers: [],
      scrubbedColumns: [],
    };
  }

  const headers = parsed.rows[0];
  const selectedSet = new Set(
    Array.isArray(options.selectedColumns)
      ? options.selectedColumns.map((c) => String(c).trim().toLowerCase())
      : [],
  );

  const statsByCategory = { secrets: 0, api_keys: 0, pii: 0, network: 0, custom: 0 };
  let totalHits = 0;
  const scrubbedColumnsUsed = new Set();

  const outRows = [headers];
  const quoteMask = [headers.map(() => false)];
  const redactOpts = {
    enabledCategories: options.enabledCategories,
    disabledRuleIds: options.disabledRuleIds,
    customTerms: options.customTerms,
    customRegexes: options.customRegexes,
    mutateVault: true,
  };

  for (let r = 1; r < parsed.rows.length; r++) {
    const row = parsed.rows[r];
    const outRow = new Array(row.length);
    const rowQuotes = new Array(row.length).fill(false);

    for (let c = 0; c < row.length; c++) {
      const cell = row[c] ?? '';
      const trimmed = cell.trim();
      const headerName = (headers[c] || `column_${c + 1}`).trim();
      const isSelectedCol = selectedSet.has(headerName.toLowerCase());
      // Preserve RFC 4180 quoting if the original cell needed quotes (e.g. "Lin, Chen")
      // so even plain-text restore() keeps valid CSV column boundaries!
      if (cell.includes(delimiter) || cell.includes('"') || cell.includes('\n') || cell.includes('\r')) {
        rowQuotes[c] = true;
      }

      if (!trimmed) {
        outRow[c] = cell;
        continue;
      }

      if (isSelectedCol) {
        scrubbedColumnsUsed.add(headerName);
        // First check if the entire cell is already a single high-precision detector hit
        // (e.g. an email or CN ID) so it gets a semantic token like [EMAIL_1] / [CN_ID_1].
        const probe = redact(trimmed, { ...redactOpts, mutateVault: false }, vault);
        if (
          probe.findings.length === 1
          && probe.findings[0].start === 0
          && probe.findings[0].end === trimmed.length
        ) {
          const applied = redact(trimmed, redactOpts, vault);
          outRow[c] = applied.redactedText;
          totalHits += applied.totalHits;
          mergeCategoryStats(statsByCategory, applied.statsByCategory);
        } else {
          const prefix = getColumnTokenPrefix(headerName);
          const placeholder = registerVaultValue(vault, trimmed, {
            ruleId: `csv_column_${normalizeTokenPrefix(headerName, 'COL')}`,
            category: 'pii',
            tokenPrefix: prefix,
          });
          outRow[c] = placeholder;
          totalHits += 1;
          statsByCategory.pii += 1;
        }
      } else {
        const applied = redact(cell, redactOpts, vault);
        outRow[c] = applied.redactedText;
        totalHits += applied.totalHits;
        mergeCategoryStats(statsByCategory, applied.statsByCategory);
      }
    }
    outRows.push(outRow);
    quoteMask.push(rowQuotes);
  }

  return {
    sanitizedText: serializeDelimited(outRows, {
      delimiter,
      hasBom: parsed.hasBom,
      lineEnding: parsed.lineEnding,
      quoteMask,
    }),
    mapping: vault,
    totalHits,
    statsByCategory,
    rowCount: Math.max(0, parsed.rows.length - 1),
    headers: headers.map((h) => h.trim()),
    scrubbedColumns: Array.from(scrubbedColumnsUsed),
  };
}

/**
 * Restore a sanitized CSV/TSV file cell-by-cell and re-serialize as valid RFC 4180 CSV/TSV.
 */
export function restoreDelimitedFile(text, mapping, options = {}) {
  const delimiter = options.delimiter || ',';
  const parsed = parseDelimited(text, delimiter);
  let restoredCount = 0;
  const unresolvedSet = new Set();

  const restoredRows = parsed.rows.map((row) => row.map((cell) => {
    const r = restore(cell, mapping);
    restoredCount += r.restoredCount;
    for (const tok of r.unresolvedTokens) unresolvedSet.add(tok);
    return r.restoredText;
  }));

  return {
    restoredText: serializeDelimited(restoredRows, {
      delimiter,
      hasBom: parsed.hasBom,
      lineEnding: parsed.lineEnding,
    }),
    restoredCount,
    unresolvedTokens: Array.from(unresolvedSet),
    rows: restoredRows,
  };
}

/**
 * Recursively scrub all string values inside a parsed JSON tree while preserving
 * exact JSON types (numbers, booleans, nulls, arrays, object keys).
 */
function scrubJsonNode(node, parentKey, vault, redactOpts, statsByCategory, counterBox) {
  if (typeof node === 'string') {
    if (!node) return node;
    const res = redact(node, redactOpts, vault);
    if (res.totalHits > 0) {
      counterBox.hits += res.totalHits;
      mergeCategoryStats(statsByCategory, res.statsByCategory);
      return res.redactedText;
    }
    // If parent JSON key clearly indicates a secret (e.g. "webhookSecret", "dbPassword"),
    // redact non-empty string values even if they don't match a vendor prefix.
    if (parentKey && SENSITIVE_JSON_KEY_RE.test(parentKey) && node.trim().length >= 6) {
      const placeholder = registerVaultValue(vault, node, {
        ruleId: 'json_secret_key',
        category: 'secrets',
        tokenPrefix: 'SECRET',
      });
      counterBox.hits += 1;
      statsByCategory.secrets += 1;
      return placeholder;
    }
    return node;
  }

  if (Array.isArray(node)) {
    return node.map((item) => scrubJsonNode(item, parentKey, vault, redactOpts, statsByCategory, counterBox));
  }

  if (node && typeof node === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      out[k] = scrubJsonNode(v, k, vault, redactOpts, statsByCategory, counterBox);
    }
    return out;
  }

  return node;
}

/**
 * Scrub a `.json` file while preserving valid formatted JSON structure.
 */
export function scrubJsonFile(text, options = {}, existingVault = null) {
  const vault = options.mutateVault && existingVault?.tokenToEntry
    ? existingVault
    : createVault(existingVault);
  const statsByCategory = { secrets: 0, api_keys: 0, pii: 0, network: 0, custom: 0 };
  const redactOpts = {
    enabledCategories: options.enabledCategories,
    disabledRuleIds: options.disabledRuleIds,
    customTerms: options.customTerms,
    customRegexes: options.customRegexes,
    mutateVault: true,
  };

  try {
    const parsed = JSON.parse(String(text ?? ''));
    const counterBox = { hits: 0 };
    const scrubbed = scrubJsonNode(parsed, '', vault, redactOpts, statsByCategory, counterBox);
    return {
      sanitizedText: JSON.stringify(scrubbed, null, 2),
      mapping: vault,
      totalHits: counterBox.hits,
      statsByCategory,
      validStructured: true,
      fallbackPlainText: false,
    };
  } catch {
    const fallback = redact(text, redactOpts, vault);
    return {
      sanitizedText: fallback.redactedText,
      mapping: vault,
      totalHits: fallback.totalHits,
      statsByCategory: fallback.statsByCategory,
      validStructured: false,
      fallbackPlainText: true,
    };
  }
}

/**
 * Scrub a `.jsonl` / `.ndjson` file line-by-line preserving valid JSONL output.
 */
export function scrubJsonlFile(text, options = {}, existingVault = null) {
  const vault = options.mutateVault && existingVault?.tokenToEntry
    ? existingVault
    : createVault(existingVault);
  const statsByCategory = { secrets: 0, api_keys: 0, pii: 0, network: 0, custom: 0 };
  const redactOpts = {
    enabledCategories: options.enabledCategories,
    disabledRuleIds: options.disabledRuleIds,
    customTerms: options.customTerms,
    customRegexes: options.customRegexes,
    mutateVault: true,
  };

  const lines = String(text ?? '').split(/\r?\n/);
  let totalHits = 0;
  let validLines = 0;
  let fallbackLines = 0;

  const outLines = lines.map((line) => {
    if (!line.trim()) return line;
    try {
      const parsed = JSON.parse(line);
      const counterBox = { hits: 0 };
      const scrubbed = scrubJsonNode(parsed, '', vault, redactOpts, statsByCategory, counterBox);
      totalHits += counterBox.hits;
      validLines++;
      return JSON.stringify(scrubbed);
    } catch {
      fallbackLines++;
      const res = redact(line, redactOpts, vault);
      totalHits += res.totalHits;
      mergeCategoryStats(statsByCategory, res.statsByCategory);
      return res.redactedText;
    }
  });

  return {
    sanitizedText: outLines.join('\n'),
    mapping: vault,
    totalHits,
    statsByCategory,
    validStructured: fallbackLines === 0 && validLines > 0,
    fallbackPlainText: fallbackLines > 0,
  };
}

/**
 * Scrub a batch of heterogeneous files (`.csv`, `.tsv`, `.json`, `.jsonl`, code, logs, `.env`, `.txt`)
 * sharing ONE deterministic reversible vault so identical entities across files keep the exact same token.
 *
 * @param {Array<{ name: string, content: string, selectedColumns?: string[] }>} files
 * @param {{
 *   selectedColumnsByFile?: Record<string, string[]>,
 *   selectedColumns?: string[],
 *   enabledCategories?: Record<string, boolean>,
 *   disabledRuleIds?: string[],
 *   customTerms?: Array<object>,
 *   customRegexes?: Array<object>,
 * }} [options]
 * @param {object | null} [existingVault]
 */
export function scrubBatchFiles(files, options = {}, existingVault = null) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error('At least one file is required for batch scrubbing');
  }

  const vault = createVault(existingVault);
  const totalStatsByCategory = { secrets: 0, api_keys: 0, pii: 0, network: 0, custom: 0 };
  let totalHits = 0;
  const results = [];

  for (const file of files) {
    const name = String(file.name || 'untitled.txt');
    const content = String(file.content ?? '');
    const format = detectFileFormat(name);

    const fileSelectedColumns = file.selectedColumns
      || options.selectedColumnsByFile?.[name]
      || options.selectedColumns
      || [];

    let res;
    if (format === 'csv' || format === 'tsv') {
      res = scrubDelimitedFile(
        content,
        {
          ...options,
          delimiter: format === 'tsv' ? '\t' : ',',
          selectedColumns: fileSelectedColumns,
          mutateVault: true,
        },
        vault,
      );
    } else if (format === 'json') {
      res = scrubJsonFile(content, { ...options, mutateVault: true }, vault);
    } else if (format === 'jsonl') {
      res = scrubJsonlFile(content, { ...options, mutateVault: true }, vault);
    } else {
      const r = redact(content, { ...options, mutateVault: true }, vault);
      res = {
        sanitizedText: r.redactedText,
        mapping: vault,
        totalHits: r.totalHits,
        statsByCategory: r.statsByCategory,
        validStructured: true,
        fallbackPlainText: false,
      };
    }

    totalHits += res.totalHits;
    mergeCategoryStats(totalStatsByCategory, res.statsByCategory);

    results.push({
      name,
      safeName: normalizeEntryPath(name),
      format,
      originalSize: content.length,
      sanitizedText: res.sanitizedText,
      totalHits: res.totalHits,
      statsByCategory: res.statsByCategory,
      scrubbedColumns: res.scrubbedColumns || [],
      validStructured: res.validStructured ?? true,
      fallbackPlainText: res.fallbackPlainText ?? false,
    });
  }

  return {
    files: results,
    mapping: vault,
    totalHits,
    uniqueTokens: Object.keys(vault.tokenToEntry).length,
    statsByCategory: totalStatsByCategory,
  };
}

/**
 * Package sanitized batch results into a standard UTF-8 ZIP archive with a bilingual
 * audit report and optional `restore_map.json` (disabled by default for safety).
 *
 * @param {ReturnType<typeof scrubBatchFiles>} batchResult
 * @param {{ includeRestoreMap?: boolean, date?: Date }} [options]
 */
export function buildSanitizedBatchZip(batchResult, options = {}) {
  const now = options.date instanceof Date ? options.date : new Date();
  const includeRestoreMap = Boolean(options.includeRestoreMap);
  const iso = now.toISOString();
  const stamp = `${iso.slice(0, 10)}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

  const rows = batchResult.files.map((f, idx) => {
    const cols = f.scrubbedColumns.length > 0 ? f.scrubbedColumns.join(', ') : 'Auto-scan only';
    return `| ${idx + 1} | \`${f.safeName}\` | ${f.format.toUpperCase()} | ${f.totalHits} | ${cols} |`;
  });

  const reportMarkdown = [
    '# PromptShield Pro — Local Batch Sanitization Report',
    '',
    `- **Timestamp**: ${iso}`,
    `- **Files Scrubbed**: ${batchResult.files.length}`,
    `- **Total Sensitive Matches Redacted**: ${batchResult.totalHits}`,
    `- **Unique Reversible Placeholders**: ${batchResult.uniqueTokens}`,
    `- **Restore Map Bundled**: ${includeRestoreMap ? 'YES (LOCAL BACKUP ONLY — DO NOT UPLOAD TO AI!)' : 'NO (Safe for AI upload; keep restore_map.json locally)'}`,
    '',
    '## File Summary',
    '',
    '| # | File | Format | Redacted Hits | Scrubbed CSV Columns |',
    '| :---: | :--- | :---: | ---: | :--- |',
    ...rows,
    '',
    '## Restoration Instructions / 本地还原说明',
    '',
    '1. Upload ONLY files under `sanitized/` to ChatGPT, Claude, or Gemini.',
    '2. Keep `restore_map.json` strictly on your local device.',
    '3. Paste the AI response back into PromptShield Pro with your `restore_map.json` loaded to losslessly restore real values locally.',
    '',
  ].join('\n');

  const entries = [
    { name: '_PROMPTSHIELD_REPORT.md', content: reportMarkdown, date: now },
    ...batchResult.files.map((f) => ({
      name: `sanitized/${f.safeName}`,
      content: f.sanitizedText,
      date: now,
    })),
  ];

  const restoreMapJson = JSON.stringify(batchResult.mapping, null, 2);
  if (includeRestoreMap) {
    entries.push({
      name: 'restore_map.json',
      content: restoreMapJson,
      date: now,
    });
  }

  const bytes = buildZipArchive(entries);
  return {
    bytes,
    filename: `PromptShield-Sanitized-${stamp}.zip`,
    reportMarkdown,
    restoreMapJson,
    entryNames: entries.map((e) => e.name),
  };
}
