/**
 * TableForge Pro — Core Table Parsing, Auto-Ranking & Publication Export Engine
 * Zero-dependency ES module compatible with Chrome MV3, modern browsers, and Node v22.
 */

import {
  DEFAULT_CAPTION_EN,
  DEFAULT_LABEL,
  FREE_MAX_COLS,
  FREE_MAX_ROWS,
  VENUE_PRESETS,
} from './config.js';

const EPS = 1e-12;

const MISSING_TOKENS = new Set([
  '',
  '-',
  '--',
  '—',
  '–',
  'n/a',
  'na',
  'nan',
  'null',
  'none',
]);

/* ============================================================================
 * 1. Delimiter Detection & RFC-4180 CSV/TSV/Excel Parser
 * ========================================================================== */

function countOutsideQuotes(line, delim) {
  let inQuotes = false;
  let count = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && ch === delim) {
      count++;
    }
  }
  return count;
}

function isSeparatorRawLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^\\midrule$/i.test(trimmed)) return true;
  if (/^-{3,}(?:\s*.+?\s*-{3,})?$/.test(trimmed)) return true;
  if (/^={3,}(?:\s*.+?\s*={3,})?$/.test(trimmed)) return true;
  if (/^(?:-{3,}|={3,})(?:[\t,;]+(?:-{3,}|={3,}|))*$/.test(trimmed)) return true;
  return false;
}

/**
 * Detect whether input uses tab (Excel/TSV), comma (CSV), or semicolon.
 */
export function detectDelimiter(rawText) {
  const clean = String(rawText || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const sampleLines = clean
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isSeparatorRawLine(l))
    .slice(0, 20);

  if (sampleLines.length === 0) return ',';

  const candidates = ['\t', ',', ';'];
  let bestDelim = ',';
  let bestScore = -1;

  for (const d of candidates) {
    const counts = sampleLines.map((l) => countOutsideQuotes(l, d));
    const positive = counts.filter((c) => c > 0);
    if (positive.length === 0) continue;

    // Prefer delimiters present on every (or almost every) sampled line with low variance.
    const freq = new Map();
    for (const c of positive) freq.set(c, (freq.get(c) || 0) + 1);
    const modeHits = Math.max(...freq.values());
    const coverage = positive.length / sampleLines.length;
    const consistency = modeHits / sampleLines.length;
    const avgCount = positive.reduce((a, b) => a + b, 0) / positive.length;
    // Excel paste (tab) gets a small tie-breaker bonus because text cells may contain commas.
    const tabBonus = d === '\t' ? 0.35 : 0;
    const score = coverage * 2 + consistency * 2 + Math.min(avgCount, 12) * 0.05 + tabBonus;

    if (score > bestScore) {
      bestScore = score;
      bestDelim = d;
    }
  }

  return bestDelim;
}

/**
 * Parse RFC-4180 delimited text into rows of string cells.
 */
function parseDelimitedRows(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field.length === 0) {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field.trim());
      field = '';
    } else if (ch === '\n') {
      row.push(field.trim());
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows;
}

function classifySeparatorRow(cells) {
  const nonEmpty = cells.filter((c) => c !== '');
  if (nonEmpty.length === 0) return { isEmpty: true, isMidrule: false, label: '' };

  if (nonEmpty.length === 1) {
    const only = nonEmpty[0];
    if (/^\\midrule$/i.test(only) || /^-{3,}$/.test(only) || /^={3,}$/.test(only)) {
      return { isEmpty: false, isMidrule: true, label: '' };
    }
    const labeled = only.match(/^-{3,}\s*(.+?)\s*-{3,}$/) || only.match(/^={3,}\s*(.+?)\s*={3,}$/);
    if (labeled) {
      return { isEmpty: false, isMidrule: true, label: labeled[1].trim() };
    }
  }

  const allDashes = nonEmpty.every((c) => /^-{3,}$/.test(c) || /^={3,}$/.test(c) || /^\\midrule$/i.test(c));
  if (allDashes) {
    return { isEmpty: false, isMidrule: true, label: '' };
  }

  return { isEmpty: false, isMidrule: false, label: '' };
}

/**
 * Extract optional grouped column spans from `Group :: Metric` header syntax.
 */
function extractColumnGroups(rawHeaders, explicitGroups = null) {
  if (Array.isArray(explicitGroups) && explicitGroups.length > 0) {
    return { headers: [...rawHeaders], columnGroups: explicitGroups };
  }

  const hasGroupSyntax = rawHeaders.some((h) => h.includes('::'));
  if (!hasGroupSyntax) {
    return { headers: [...rawHeaders], columnGroups: [] };
  }

  const headers = [];
  const rawGroups = [];
  for (const h of rawHeaders) {
    const idx = h.indexOf('::');
    if (idx > 0) {
      rawGroups.push(h.slice(0, idx).trim());
      headers.push(h.slice(idx + 2).trim());
    } else {
      rawGroups.push('');
      headers.push(h);
    }
  }

  const columnGroups = [];
  let i = 0;
  while (i < rawGroups.length) {
    const label = rawGroups[i];
    if (!label) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < rawGroups.length && rawGroups[j + 1] === label) {
      j++;
    }
    columnGroups.push({ label, startCol: i, endCol: j });
    i = j + 1;
  }

  return { headers, columnGroups };
}

/**
 * Parse CSV / TSV / Excel-clipboard text into a structured table object.
 */
export function parseDelimitedTable(rawText, options = {}) {
  const clean = String(rawText || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  if (!clean.trim()) {
    return {
      delimiter: ',',
      headers: [],
      rawHeaders: [],
      columnGroups: [],
      rows: [],
      dataRowCount: 0,
      colCount: 0,
    };
  }

  const delimiter = options.delimiter || detectDelimiter(clean);
  const rawRows = parseDelimitedRows(clean, delimiter);

  // Drop empty lines
  const filtered = [];
  for (const r of rawRows) {
    const info = classifySeparatorRow(r);
    if (info.isEmpty) continue;
    filtered.push({ cells: r, info });
  }

  if (filtered.length === 0) {
    return {
      delimiter,
      headers: [],
      rawHeaders: [],
      columnGroups: [],
      rows: [],
      dataRowCount: 0,
      colCount: 0,
    };
  }

  // First non-separator row is the header row
  let headerIdx = filtered.findIndex((r) => !r.info.isMidrule);
  if (headerIdx < 0) {
    return {
      delimiter,
      headers: [],
      rawHeaders: [],
      columnGroups: [],
      rows: [],
      dataRowCount: 0,
      colCount: 0,
    };
  }

  const rawHeaderCells = filtered[headerIdx].cells;
  const bodyItems = filtered.slice(headerIdx + 1);

  let colCount = rawHeaderCells.length;
  for (const item of bodyItems) {
    if (!item.info.isMidrule && item.cells.length > colCount) {
      colCount = item.cells.length;
    }
  }

  const paddedRawHeaders = [];
  for (let c = 0; c < colCount; c++) {
    paddedRawHeaders.push(rawHeaderCells[c] !== undefined && rawHeaderCells[c] !== '' ? rawHeaderCells[c] : `Col ${c + 1}`);
  }

  const { headers, columnGroups } = extractColumnGroups(paddedRawHeaders, options.columnGroups || null);

  const rows = [];
  let dataRowCount = 0;
  for (const item of bodyItems) {
    if (item.info.isMidrule) {
      rows.push({ type: 'midrule', label: item.info.label });
    } else {
      const cells = [];
      for (let c = 0; c < colCount; c++) {
        cells.push(item.cells[c] !== undefined ? item.cells[c] : '');
      }
      rows.push({ type: 'data', dataIndex: dataRowCount, cells });
      dataRowCount++;
    }
  }

  return {
    delimiter,
    headers,
    rawHeaders: paddedRawHeaders,
    columnGroups,
    rows,
    dataRowCount,
    colCount,
  };
}

/* ============================================================================
 * 2. Smart Numeric & Uncertainty Cell Parser
 * ========================================================================== */

const NUM_RE = '[+\\-−]?(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?(?:[eE][+\\-]?\\d+)?';
const UNUM_RE = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d+)?(?:[eE][+\\-]?\\d+)?';

const PM_PATTERN = new RegExp(`^(${NUM_RE})(%?)\\s*(?:±|\\+-|\\+/-|\\\\pm)\\s*(${UNUM_RE})(%?)$`);
const PAREN_PATTERN = new RegExp(`^(${NUM_RE})(%?)\\s*\\(\\s*(${UNUM_RE})(%?)\\s*\\)$`);
const PLAIN_PATTERN = new RegExp(`^(${NUM_RE})(%?)$`);
const STARS_PATTERN = /(\*{1,3}|†{1,2}|‡)$/;

function parseNumToken(tok) {
  const normalized = tok.replace(/−/g, '-');
  const hasThousandsSep = /,/.test(normalized);
  const stripped = normalized.replace(/,/g, '');
  const value = Number(stripped);
  if (!Number.isFinite(value)) return null;

  const isSci = /[eE]/.test(stripped);
  let decimals = 0;
  if (!isSci) {
    const dotIdx = stripped.indexOf('.');
    decimals = dotIdx >= 0 ? stripped.length - dotIdx - 1 : 0;
  }
  return { value, decimals, hasThousandsSep, isSci, rawToken: tok };
}

/**
 * Parse a cell string into structured numeric / uncertainty / missing / text metadata.
 */
export function parseCellValue(raw) {
  const trimmed = String(raw ?? '').trim();
  const lowered = trimmed.toLowerCase();

  if (MISSING_TOKENS.has(lowered)) {
    return {
      kind: 'missing',
      raw: trimmed,
      displayRaw: trimmed === '' ? '-' : trimmed,
      mean: null,
      std: null,
      isPercent: false,
      stars: '',
    };
  }

  // Extract trailing significance stars only if the base string actually parses as numeric
  let base = trimmed;
  let stars = '';
  const starMatch = trimmed.match(STARS_PATTERN);
  if (starMatch) {
    base = trimmed.slice(0, trimmed.length - starMatch[1].length).trim();
    stars = starMatch[1];
  }

  const tryParseNumeric = (candidate, extractedStars) => {
    let m = candidate.match(PM_PATTERN);
    if (m) {
      const meanInfo = parseNumToken(m[1]);
      const stdInfo = parseNumToken(m[3]);
      if (meanInfo && stdInfo) {
        return {
          kind: 'numeric',
          raw: trimmed,
          mean: meanInfo.value,
          std: stdInfo.value,
          uncertaintyStyle: 'pm',
          isPercent: Boolean(m[2] || m[4]),
          meanDecimals: meanInfo.decimals,
          stdDecimals: stdInfo.decimals,
          hasThousandsSep: meanInfo.hasThousandsSep,
          isSci: meanInfo.isSci || stdInfo.isSci,
          stars: extractedStars,
        };
      }
    }

    m = candidate.match(PAREN_PATTERN);
    if (m) {
      const meanInfo = parseNumToken(m[1]);
      const stdInfo = parseNumToken(m[3]);
      if (meanInfo && stdInfo) {
        return {
          kind: 'numeric',
          raw: trimmed,
          mean: meanInfo.value,
          std: stdInfo.value,
          uncertaintyStyle: 'paren',
          isPercent: Boolean(m[2] || m[4]),
          meanDecimals: meanInfo.decimals,
          stdDecimals: stdInfo.decimals,
          hasThousandsSep: meanInfo.hasThousandsSep,
          isSci: meanInfo.isSci || stdInfo.isSci,
          stars: extractedStars,
        };
      }
    }

    m = candidate.match(PLAIN_PATTERN);
    if (m) {
      const meanInfo = parseNumToken(m[1]);
      if (meanInfo) {
        return {
          kind: 'numeric',
          raw: trimmed,
          mean: meanInfo.value,
          std: null,
          uncertaintyStyle: null,
          isPercent: Boolean(m[2]),
          meanDecimals: meanInfo.decimals,
          stdDecimals: null,
          hasThousandsSep: meanInfo.hasThousandsSep,
          isSci: meanInfo.isSci,
          stars: extractedStars,
        };
      }
    }
    return null;
  };

  const parsedNum = tryParseNumeric(base, stars) || (stars ? tryParseNumeric(trimmed, '') : null);
  if (parsedNum) return parsedNum;

  return {
    kind: 'text',
    raw: trimmed,
    text: trimmed,
    mean: null,
    std: null,
    isPercent: false,
    stars: '',
  };
}

/* ============================================================================
 * 3. Column Direction Auto-Detection
 * ========================================================================== */

const MIN_HEADER_RE = /\b(loss|fid|kid|err|error|errors|wer|cer|per|latency|lat|mse|rmse|mae|mape|nll|bpd|ppl|perplexity|time|runtime|sec|secs|ms|cost|mem|memory|vram|flops|gflops|macs|energy|dist|distance|lpips|emd|ece|brier|l1|l2)\b/i;
const MAX_HEADER_RE = /\b(acc|accuracy|top1|top-1|top5|top-5|f1|f1-score|auc|auroc|auprc|ap|map|bleu|bleu-4|rouge|rouge-l|meteor|cider|r2|r\^2|psnr|ssim|score|precision|prec|recall|rec|iou|miou|dice|em|exact|throughput|fps|speedup|win|winrate|reward|ndcg|mrr|corr|pearson|spearman|pass@\d+|pass@k)\b/i;
const NEUTRAL_HEADER_RE = /\b(method|model|name|dataset|task|backbone|param|params|parameters|size|year|epoch|epochs|step|steps|seed|seeds|layer|layers|dim|id|rank|samples|count)\b/i;

/**
 * Infer default ranking direction ('max' | 'min' | 'none') from header & column values.
 */
export function inferColumnDirection(header, parsedCells = []) {
  const numericCount = parsedCells.filter((c) => c.kind === 'numeric').length;
  if (parsedCells.length > 0 && numericCount < 2) {
    return 'none';
  }

  const h = String(header || '').trim();
  if (/↑|\\uparrow/i.test(h)) return 'max';
  if (/↓|\\downarrow/i.test(h)) return 'min';

  const normalized = h
    .replace(/²/g, '2')
    .replace(/[_/()[\]%]+/g, ' ')
    .trim();

  if (MIN_HEADER_RE.test(normalized)) return 'min';
  if (MAX_HEADER_RE.test(normalized)) return 'max';
  if (NEUTRAL_HEADER_RE.test(normalized)) return 'none';

  return 'none';
}

/* ============================================================================
 * 4. Number Formatting & Table Analysis (Ranking + Baseline Δ + Tier Gate)
 * ========================================================================== */

function addThousandsCommas(numStr) {
  const parts = numStr.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
}

export function formatNumericValue(value, decimals, useThousands = false) {
  const safeVal = Math.abs(value) < EPS ? 0 : value;
  const fixed = decimals !== null && decimals !== undefined ? safeVal.toFixed(decimals) : String(safeVal);
  return useThousands ? addThousandsCommas(fixed) : fixed;
}

export function formatDeltaString(deltaInfo, precision, deltaMode, cellDecimals) {
  if (!deltaInfo) return '';
  if (deltaMode === 'pct') {
    if (deltaInfo.pct === null) return '';
    const v = Math.abs(deltaInfo.pct) < 1e-9 ? 0 : deltaInfo.pct;
    const sign = v > 0 ? '+' : '';
    return `${sign}${v.toFixed(1)}%`;
  }
  const dec = precision === 'auto'
    ? Math.min(Math.max(cellDecimals ?? 2, 1), 3)
    : Number(precision);
  const v = Math.abs(deltaInfo.abs) < 1e-9 ? 0 : deltaInfo.abs;
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(dec)}`;
}

/**
 * Analyze a parsed table: apply Free/Pro gating, parse cells, compute tie-aware
 * Rank 1 & Rank 2, and compute optional Baseline row deltas.
 */
export function analyzeTable(parsed, options = {}) {
  const isPro = Boolean(options.isPro);
  const maxRows = isPro ? Infinity : (options.freeMaxRows ?? FREE_MAX_ROWS);
  const maxCols = isPro ? Infinity : (options.freeMaxCols ?? FREE_MAX_COLS);

  const totalCols = parsed.colCount || 0;
  const totalDataRows = parsed.dataRowCount || 0;

  if (totalCols === 0 || totalDataRows === 0) {
    return {
      empty: true,
      isPro,
      totalDataRows,
      totalCols,
      visibleDataRows: 0,
      visibleCols: 0,
      truncatedRows: false,
      truncatedCols: false,
      wasTruncated: false,
      headers: [],
      columnGroups: [],
      columns: [],
      rows: [],
      baselineRow: null,
      baselineActive: false,
      deltaMode: options.deltaMode || 'abs',
      precision: options.precision ?? 'auto',
      preset: VENUE_PRESETS[options.preset] || VENUE_PRESETS.neurips,
    };
  }

  const visibleCols = Math.min(totalCols, maxCols);
  const truncatedCols = totalCols > visibleCols;
  const headers = parsed.headers.slice(0, visibleCols);

  // Filter & clip column groups to visible column range
  const columnGroups = (parsed.columnGroups || [])
    .filter((g) => g.startCol < visibleCols)
    .map((g) => ({
      label: g.label,
      startCol: g.startCol,
      endCol: Math.min(g.endCol, visibleCols - 1),
    }));

  // Clip rows to maxRows data rows while keeping internal midrule separators cleanly
  const clippedRows = [];
  let keptData = 0;
  for (const row of parsed.rows) {
    if (row.type === 'data') {
      if (keptData >= maxRows) break;
      clippedRows.push({
        type: 'data',
        dataIndex: keptData,
        cells: row.cells.slice(0, visibleCols).map((raw) => parseCellValue(raw)),
      });
      keptData++;
    } else if (row.type === 'midrule') {
      // Only push midrule if at least one data row precedes it
      if (keptData > 0 && keptData < maxRows) {
        clippedRows.push({ type: 'midrule', label: row.label || '' });
      }
    }
  }
  // Remove trailing dangling midrules
  while (clippedRows.length > 0 && clippedRows[clippedRows.length - 1].type === 'midrule') {
    clippedRows.pop();
  }

  const truncatedRows = totalDataRows > keptData;
  const dataRows = clippedRows.filter((r) => r.type === 'data');

  // Resolve directions per column
  const dirOverrides = options.directions || {};
  const columns = [];
  for (let c = 0; c < visibleCols; c++) {
    const colCells = dataRows.map((r) => r.cells[c]);
    const numericCells = colCells.filter((cell) => cell.kind === 'numeric');
    const inferred = inferColumnDirection(headers[c], colCells);

    let dir;
    if (Array.isArray(dirOverrides) && dirOverrides[c]) {
      dir = dirOverrides[c];
    } else if (!Array.isArray(dirOverrides) && dirOverrides[c] !== undefined) {
      dir = dirOverrides[c];
    } else if (!Array.isArray(dirOverrides) && dirOverrides[headers[c]] !== undefined) {
      dir = dirOverrides[headers[c]];
    } else {
      dir = inferred;
    }

    if (dir !== 'max' && dir !== 'min' && dir !== 'none') {
      dir = inferred;
    }

    const isNumericCol = numericCells.length >= Math.max(1, Math.ceil(dataRows.length * 0.5));
    const hasUncertainty = numericCells.some((cell) => cell.std !== null);
    const hasPercent = numericCells.some((cell) => cell.isPercent);
    const hasStars = numericCells.some((cell) => Boolean(cell.stars));

    columns.push({
      index: c,
      header: headers[c],
      inferredDirection: inferred,
      direction: dir,
      isNumeric: isNumericCol,
      hasUncertainty,
      hasPercent,
      hasStars,
      align: c === 0 && !isNumericCol ? 'left' : (isNumericCol ? 'right' : 'left'),
    });
  }

  // Tie-aware Rank 1 & Rank 2 per column
  for (let c = 0; c < visibleCols; c++) {
    const col = columns[c];
    if (col.direction !== 'max' && col.direction !== 'min') {
      for (const r of dataRows) r.cells[c].rank = null;
      continue;
    }

    const values = dataRows
      .map((r) => r.cells[c])
      .filter((cell) => cell.kind === 'numeric')
      .map((cell) => cell.mean);

    // Distinct values with floating tolerance EPS
    const sorted = [...values].sort((a, b) => (col.direction === 'max' ? b - a : a - b));
    const distinct = [];
    for (const v of sorted) {
      if (distinct.length === 0 || Math.abs(v - distinct[distinct.length - 1]) > EPS) {
        distinct.push(v);
      }
    }

    if (distinct.length < 2) {
      for (const r of dataRows) r.cells[c].rank = null;
      continue;
    }

    const bestVal = distinct[0];
    const secondVal = distinct[1];

    for (const r of dataRows) {
      const cell = r.cells[c];
      if (cell.kind !== 'numeric') {
        cell.rank = null;
      } else if (Math.abs(cell.mean - bestVal) <= EPS) {
        cell.rank = 1;
      } else if (Math.abs(cell.mean - secondVal) <= EPS) {
        cell.rank = 2;
      } else {
        cell.rank = null;
      }
    }
  }

  // Baseline Row Delta (Pro feature)
  const requestedBaseline = options.baselineRow !== null && options.baselineRow !== undefined && options.baselineRow !== ''
    ? Number(options.baselineRow)
    : null;
  const baselineValid = Number.isInteger(requestedBaseline) && requestedBaseline >= 0 && requestedBaseline < dataRows.length;
  const baselineActive = Boolean(isPro && baselineValid);
  const deltaMode = options.deltaMode === 'pct' ? 'pct' : 'abs';
  const precision = options.precision === 'auto' || options.precision === undefined || options.precision === null
    ? 'auto'
    : Number(options.precision);

  if (baselineActive) {
    const baseRow = dataRows[requestedBaseline];
    for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
      const row = dataRows[rIdx];
      row.isBaseline = rIdx === requestedBaseline;
      for (let c = 0; c < visibleCols; c++) {
        const col = columns[c];
        const cell = row.cells[c];
        const baseCell = baseRow.cells[c];
        if (rIdx === requestedBaseline || (col.direction !== 'max' && col.direction !== 'min')) {
          cell.delta = null;
          continue;
        }
        if (cell.kind === 'numeric' && baseCell.kind === 'numeric') {
          const abs = cell.mean - baseCell.mean;
          const pct = Math.abs(baseCell.mean) > EPS ? (abs / Math.abs(baseCell.mean)) * 100 : null;
          const isImproved = col.direction === 'max' ? abs > EPS : abs < -EPS;
          const isWorse = col.direction === 'max' ? abs < -EPS : abs > EPS;
          const deltaObj = { abs, pct, isImproved, isWorse };
          deltaObj.formatted = formatDeltaString(deltaObj, precision, deltaMode, cell.meanDecimals);
          cell.delta = deltaObj;
        } else {
          cell.delta = null;
        }
      }
    }
  } else {
    for (const row of dataRows) {
      row.isBaseline = false;
      for (const cell of row.cells) {
        cell.delta = null;
      }
    }
  }

  // Pre-format display pieces for every cell
  for (const row of dataRows) {
    for (let c = 0; c < visibleCols; c++) {
      const cell = row.cells[c];
      if (cell.kind === 'numeric') {
        const meanDec = precision === 'auto' ? (cell.isSci ? null : cell.meanDecimals) : precision;
        const stdDec = cell.std !== null
          ? (precision === 'auto' ? (cell.isSci ? null : cell.stdDecimals) : precision)
          : null;
        const useThousands = precision === 'auto' && cell.hasThousandsSep;
        cell.meanText = formatNumericValue(cell.mean, meanDec, useThousands);
        cell.stdText = cell.std !== null ? formatNumericValue(cell.std, stdDec, false) : null;
        cell.pctSuffix = cell.isPercent ? '%' : '';
      } else if (cell.kind === 'missing') {
        cell.meanText = cell.displayRaw;
        cell.stdText = null;
        cell.pctSuffix = '';
      } else {
        cell.meanText = cell.text;
        cell.stdText = null;
        cell.pctSuffix = '';
      }
    }
  }

  return {
    empty: false,
    isPro,
    totalDataRows,
    totalCols,
    visibleDataRows: dataRows.length,
    visibleCols,
    truncatedRows,
    truncatedCols,
    wasTruncated: truncatedRows || truncatedCols,
    headers,
    columnGroups,
    columns,
    rows: clippedRows,
    dataRows,
    baselineRow: baselineActive ? requestedBaseline : null,
    baselineRequested: baselineValid ? requestedBaseline : null,
    baselineActive,
    deltaMode,
    precision,
    preset: VENUE_PRESETS[options.preset] || VENUE_PRESETS.neurips,
  };
}

/* ============================================================================
 * 5. LaTeX (booktabs / siunitx) Exporter
 * ========================================================================== */

const UP_TOKEN = '\uE001';
const DOWN_TOKEN = '\uE002';
const PM_TOKEN = '\uE003';

/**
 * Safely escape arbitrary text for LaTeX while converting arrow / pm symbols cleanly.
 */
export function escapeLatex(str) {
  let s = String(str ?? '');
  s = s.replace(/↑/g, UP_TOKEN).replace(/↓/g, DOWN_TOKEN).replace(/±/g, PM_TOKEN);
  s = s
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}');
  s = s
    .replace(new RegExp(UP_TOKEN, 'g'), '$\\uparrow$')
    .replace(new RegExp(DOWN_TOKEN, 'g'), '$\\downarrow$')
    .replace(new RegExp(PM_TOKEN, 'g'), '$\\pm$');
  return s;
}

function formatHeaderLabel(col, showArrows, target) {
  let base = col.header;
  const alreadyHasArrow = /[↑↓]/.test(base);
  if (showArrows && !alreadyHasArrow) {
    if (col.direction === 'max') base = `${base} ↑`;
    if (col.direction === 'min') base = `${base} ↓`;
  }
  if (target === 'latex') return escapeLatex(base);
  if (target === 'typst') return escapeTypst(base);
  if (target === 'markdown') return escapeMarkdown(base);
  return base;
}

function computeSiunitxFormat(analyzed, colIndex) {
  let maxInt = 1;
  let maxDec = 0;
  let maxStdInt = 0;
  let maxStdDec = 0;
  let hasNeg = false;
  let hasStd = false;

  for (const row of analyzed.dataRows) {
    const cell = row.cells[colIndex];
    if (cell.kind !== 'numeric' || cell.isSci) continue;
    const rawMean = cell.meanText.replace(/,/g, '');
    if (rawMean.startsWith('-')) hasNeg = true;
    const unsigned = rawMean.replace(/^[+-]/, '');
    const [iPart, dPart = ''] = unsigned.split('.');
    maxInt = Math.max(maxInt, iPart.length);
    maxDec = Math.max(maxDec, dPart.length);
    if (cell.stdText !== null) {
      hasStd = true;
      const [si, sd = ''] = cell.stdText.replace(/,/g, '').split('.');
      maxStdInt = Math.max(maxStdInt, si.length);
      maxStdDec = Math.max(maxStdDec, sd.length);
    }
  }

  let fmt = `${hasNeg ? '-' : ''}${maxInt}`;
  if (maxDec > 0) fmt += `.${maxDec}`;
  if (hasStd) {
    fmt += `+-${maxStdInt}`;
    if (maxStdDec > 0) fmt += `.${maxStdDec}`;
  }
  return fmt;
}

function formatLatexCell(cell, col, options) {
  const { boldBest = true, underlineSecond = true, useSiunitx = false } = options;

  if (cell.kind === 'missing') {
    const token = cell.meanText === '-' ? '--' : escapeLatex(cell.meanText);
    return useSiunitx && col.siunitxEligible ? `{${token}}` : token;
  }

  if (cell.kind === 'text') {
    const txt = escapeLatex(cell.text);
    return useSiunitx && col.siunitxEligible ? `{${txt}}` : txt;
  }

  const isBest = boldBest && cell.rank === 1;
  const isSecond = underlineSecond && cell.rank === 2;
  const pct = cell.isPercent ? '\\%' : '';
  const stars = cell.stars ? `$^{${escapeLatex(cell.stars)}}$` : '';
  const deltaPart = cell.delta?.formatted
    ? ` {\\scriptsize(${escapeLatex(cell.delta.formatted)})}`
    : '';

  // Pure siunitx S-column formatting when no percent/stars/delta interfere
  const pureSiCell = useSiunitx
    && col.siunitxEligible
    && !cell.isPercent
    && !cell.stars
    && !deltaPart
    && !cell.hasThousandsSep
    && cell.uncertaintyStyle !== 'paren';

  if (pureSiCell) {
    const core = cell.stdText !== null
      ? `${cell.meanText} \\pm ${cell.stdText}`
      : cell.meanText;
    if (isBest) return `\\bfseries ${core}`;
    if (isSecond) return `{\\underline{${cell.stdText !== null ? `${cell.meanText} $\\pm$ ${cell.stdText}` : cell.meanText}}}`;
    return core;
  }

  let body;
  if (cell.stdText !== null) {
    if (cell.uncertaintyStyle === 'paren') {
      body = `${cell.meanText}${pct} (${cell.stdText})`;
    } else {
      body = `${cell.meanText}${pct} $\\pm$ ${cell.stdText}${pct ? pct : ''}`;
    }
  } else {
    body = `${cell.meanText}${pct}`;
  }

  if (isBest) {
    body = `\\textbf{${body}}`;
  } else if (isSecond) {
    body = `\\underline{${body}}`;
  }

  const full = `${body}${stars}${deltaPart}`;
  return useSiunitx && col.siunitxEligible ? `{${full}}` : full;
}

/**
 * Export analyzed table to publication-ready booktabs (and optional siunitx) LaTeX.
 */
export function exportLatex(analyzed, options = {}) {
  if (analyzed.empty) return '% Paste CSV/TSV data to generate LaTeX code.';

  const preset = VENUE_PRESETS[options.preset] || analyzed.preset || VENUE_PRESETS.neurips;
  const boldBest = options.boldBest !== false;
  const underlineSecond = options.underlineSecond !== false;
  const showArrows = options.showArrows !== false;
  const useSiunitx = Boolean(options.useSiunitx && (analyzed.isPro || options.bypassGate));
  const useResizebox = Boolean(options.useResizebox);
  const caption = options.caption !== undefined && options.caption !== ''
    ? options.caption
    : DEFAULT_CAPTION_EN;
  const label = options.label !== undefined && options.label !== ''
    ? options.label
    : DEFAULT_LABEL;

  // Determine which columns use S[...] in siunitx mode
  const colMeta = analyzed.columns.map((col, idx) => {
    const siunitxEligible = Boolean(useSiunitx && col.isNumeric);
    return {
      ...col,
      siunitxEligible,
      siFormat: siunitxEligible ? computeSiunitxFormat(analyzed, idx) : null,
    };
  });

  const colSpecs = colMeta.map((col) => {
    if (col.siunitxEligible) {
      return `S[table-format=${col.siFormat}]`;
    }
    return col.align === 'right' ? 'r' : 'l';
  });

  const packages = ['booktabs'];
  if (useSiunitx) packages.push('siunitx');
  if (useResizebox) packages.push('graphicx');

  const lines = [];
  lines.push(`% Generated by TableForge Pro (${preset.labelEn})`);
  lines.push(`% Required packages: \\usepackage{${packages.join(', ')}}`);
  lines.push(`\\begin{${preset.tableEnv}}[${preset.placement}]`);
  lines.push('  \\centering');
  if (preset.captionPosition === 'top') {
    lines.push(`  \\caption{${escapeLatex(caption)}}`);
    lines.push(`  \\label{${label}}`);
  }
  lines.push(`  ${preset.sizeCmd}`);
  if (preset.tabcolsep) {
    lines.push(`  \\setlength{\\tabcolsep}{${preset.tabcolsep}}`);
  }
  if (preset.arraystretch && preset.arraystretch !== '1.0') {
    lines.push(`  \\renewcommand{\\arraystretch}{${preset.arraystretch}}`);
  }
  if (useSiunitx) {
    lines.push('  \\sisetup{detect-weight=true, mode=text, separate-uncertainty=true}');
  }

  const widthTarget = preset.tableEnv === 'table*' ? '\\textwidth' : '\\linewidth';
  const indent = useResizebox ? '    ' : '  ';
  if (useResizebox) {
    lines.push(`  \\resizebox{${widthTarget}}{!}{%`);
  }

  lines.push(`${indent}\\begin{tabular}{${colSpecs.join(' ')}}`);
  lines.push(`${indent}  \\toprule`);

  // Optional grouped column headers
  if (analyzed.columnGroups.length > 0) {
    const groupCells = [];
    const cmidrules = [];
    let c = 0;
    while (c < colMeta.length) {
      const grp = analyzed.columnGroups.find((g) => g.startCol === c);
      if (grp) {
        const span = grp.endCol - grp.startCol + 1;
        groupCells.push(`\\multicolumn{${span}}{c}{\\textbf{${escapeLatex(grp.label)}}}`);
        cmidrules.push(`\\cmidrule(lr){${grp.startCol + 1}-${grp.endCol + 1}}`);
        c = grp.endCol + 1;
      } else {
        groupCells.push('');
        c++;
      }
    }
    lines.push(`${indent}  ${groupCells.join(' & ')} \\\\`);
    lines.push(`${indent}  ${cmidrules.join(' ')}`);
  }

  // Header row
  const headerCells = colMeta.map((col) => {
    const txt = formatHeaderLabel(col, showArrows, 'latex');
    return col.siunitxEligible ? `{${txt}}` : txt;
  });
  lines.push(`${indent}  ${headerCells.join(' & ')} \\\\`);
  lines.push(`${indent}  \\midrule`);

  // Body rows
  for (const row of analyzed.rows) {
    if (row.type === 'midrule') {
      lines.push(`${indent}  \\midrule`);
      if (row.label) {
        lines.push(`${indent}  \\multicolumn{${colMeta.length}}{l}{\\textit{${escapeLatex(row.label)}}} \\\\`);
        lines.push(`${indent}  \\midrule`);
      }
      continue;
    }

    const formatted = row.cells.map((cell, c) =>
      formatLatexCell(cell, colMeta[c], { boldBest, underlineSecond, useSiunitx }),
    );
    lines.push(`${indent}  ${formatted.join(' & ')} \\\\`);
  }

  lines.push(`${indent}  \\bottomrule`);
  lines.push(`${indent}\\end{tabular}`);

  if (useResizebox) {
    lines.push('  }');
  }

  if (preset.captionPosition === 'bottom') {
    lines.push(`  \\caption{${escapeLatex(caption)}}`);
    lines.push(`  \\label{${label}}`);
  }

  lines.push(`\\end{${preset.tableEnv}}`);
  return lines.join('\n');
}

/* ============================================================================
 * 6. Word / Google Docs 3-Line Rich HTML Exporter
 * ========================================================================== */

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatHtmlCellInner(cell, { boldBest = true, underlineSecond = true }) {
  if (cell.kind === 'missing') {
    return escapeHtml(cell.meanText);
  }
  if (cell.kind === 'text') {
    return escapeHtml(cell.text);
  }

  const pct = cell.isPercent ? '%' : '';
  let core;
  if (cell.stdText !== null) {
    if (cell.uncertaintyStyle === 'paren') {
      core = `${escapeHtml(cell.meanText)}${pct} (${escapeHtml(cell.stdText)})`;
    } else {
      core = `${escapeHtml(cell.meanText)}${pct} &plusmn; ${escapeHtml(cell.stdText)}${pct}`;
    }
  } else {
    core = `${escapeHtml(cell.meanText)}${pct}`;
  }

  if (boldBest && cell.rank === 1) {
    core = `<strong style="font-weight:700;">${core}</strong>`;
  } else if (underlineSecond && cell.rank === 2) {
    core = `<u style="text-decoration:underline;">${core}</u>`;
  }

  const stars = cell.stars ? `<sup style="font-size:75%;">${escapeHtml(cell.stars)}</sup>` : '';
  let deltaHtml = '';
  if (cell.delta?.formatted) {
    const color = cell.delta.isImproved ? '#0f766e' : (cell.delta.isWorse ? '#b91c1c' : '#555555');
    deltaHtml = ` <span style="font-size:8.5pt;color:${color};">(${escapeHtml(cell.delta.formatted)})</span>`;
  }

  return `${core}${stars}${deltaHtml}`;
}

/**
 * Export publication-styled 3-line HTML table (1.5pt / 0.75pt / 1.5pt rules)
 * ready for direct clipboard paste (`text/html`) into Microsoft Word & Google Docs.
 */
export function exportWordHtml(analyzed, options = {}) {
  if (analyzed.empty) return '<!-- Paste CSV/TSV data to generate a Word 3-Line table -->';

  const preset = VENUE_PRESETS[options.preset] || analyzed.preset || VENUE_PRESETS.neurips;
  const boldBest = options.boldBest !== false;
  const underlineSecond = options.underlineSecond !== false;
  const showArrows = options.showArrows !== false;
  const caption = options.caption !== undefined && options.caption !== ''
    ? options.caption
    : DEFAULT_CAPTION_EN;

  const font = preset.fontFamily || '"Times New Roman", "Songti SC", Georgia, serif';
  const captionHtml = `<p style="font-family:${font};font-size:10pt;color:#111111;margin:0 0 6pt 0;text-align:left;"><strong>Table 1.</strong> ${escapeHtml(caption)}</p>`;

  const lines = [];
  lines.push(`<div style="font-family:${font};color:#111111;">`);
  if (preset.captionPosition === 'top') {
    lines.push(`  ${captionHtml}`);
  }
  lines.push(`  <table style="border-collapse:collapse;width:100%;font-family:${font};font-size:10.5pt;line-height:1.35;color:#111111;border:none;">`);
  lines.push('    <thead>');

  const hasGroups = analyzed.columnGroups.length > 0;
  if (hasGroups) {
    lines.push('      <tr>');
    let c = 0;
    while (c < analyzed.columns.length) {
      const grp = analyzed.columnGroups.find((g) => g.startCol === c);
      if (grp) {
        const span = grp.endCol - grp.startCol + 1;
        lines.push(
          `        <th colspan="${span}" style="border-top:1.5pt solid #000000;border-bottom:0.5pt solid #444444;border-left:none;border-right:none;padding:5pt 7pt 3pt 7pt;text-align:center;font-weight:700;">${escapeHtml(grp.label)}</th>`,
        );
        c = grp.endCol + 1;
      } else {
        lines.push(
          '        <th style="border-top:1.5pt solid #000000;border-bottom:none;border-left:none;border-right:none;padding:5pt 7pt 3pt 7pt;"></th>',
        );
        c++;
      }
    }
    lines.push('      </tr>');
  }

  lines.push('      <tr>');
  for (const col of analyzed.columns) {
    const label = formatHeaderLabel(col, showArrows, 'html');
    const topBorder = hasGroups ? 'border-top:none;' : 'border-top:1.5pt solid #000000;';
    const align = col.align === 'right' ? 'right' : 'left';
    lines.push(
      `        <th style="${topBorder}border-bottom:0.75pt solid #000000;border-left:none;border-right:none;padding:5pt 7pt;text-align:${align};font-weight:700;white-space:nowrap;">${escapeHtml(label)}</th>`,
    );
  }
  lines.push('      </tr>');
  lines.push('    </thead>');
  lines.push('    <tbody>');

  // Identify last data row index for bottom 1.5pt rule
  let lastDataRowIdx = -1;
  analyzed.rows.forEach((r, idx) => {
    if (r.type === 'data') lastDataRowIdx = idx;
  });

  let pendingMidrule = false;
  analyzed.rows.forEach((row, idx) => {
    if (row.type === 'midrule') {
      if (row.label) {
        lines.push('      <tr>');
        lines.push(
          `        <td colspan="${analyzed.columns.length}" style="border-top:0.5pt solid #555555;border-bottom:0.5pt solid #bbbbbb;border-left:none;border-right:none;padding:4pt 7pt;font-style:italic;text-align:left;color:#333333;">${escapeHtml(row.label)}</td>`,
        );
        lines.push('      </tr>');
        pendingMidrule = false;
      } else {
        pendingMidrule = true;
      }
      return;
    }

    const isLast = idx === lastDataRowIdx;
    const topStyle = pendingMidrule ? 'border-top:0.5pt solid #555555;' : 'border-top:none;';
    const bottomStyle = isLast ? 'border-bottom:1.5pt solid #000000;' : 'border-bottom:none;';
    pendingMidrule = false;

    lines.push('      <tr>');
    row.cells.forEach((cell, c) => {
      const col = analyzed.columns[c];
      const align = col.align === 'right' ? 'right' : 'left';
      const inner = formatHtmlCellInner(cell, { boldBest, underlineSecond });
      lines.push(
        `        <td style="${topStyle}${bottomStyle}border-left:none;border-right:none;padding:4pt 7pt;text-align:${align};font-variant-numeric:tabular-nums;white-space:nowrap;">${inner}</td>`,
      );
    });
    lines.push('      </tr>');
  });

  lines.push('    </tbody>');
  lines.push('  </table>');
  if (preset.captionPosition === 'bottom') {
    lines.push(`  <div style="margin-top:6pt;">${captionHtml}</div>`);
  }
  lines.push('</div>');
  return lines.join('\n');
}

/* ============================================================================
 * 7. Typst Exporter
 * ========================================================================== */

export function escapeTypst(str) {
  return String(str ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/#/g, '\\#')
    .replace(/\$/g, '\\$')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>')
    .replace(/@/g, '\\@')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

function formatTypstCell(cell, { boldBest = true, underlineSecond = true }) {
  if (cell.kind === 'missing') {
    return `[${escapeTypst(cell.meanText)}]`;
  }
  if (cell.kind === 'text') {
    return `[${escapeTypst(cell.text)}]`;
  }

  const pct = cell.isPercent ? '%' : '';
  let core;
  if (cell.stdText !== null) {
    if (cell.uncertaintyStyle === 'paren') {
      core = `${escapeTypst(cell.meanText)}${pct} (${escapeTypst(cell.stdText)})`;
    } else {
      core = `${escapeTypst(cell.meanText)}${pct} ± ${escapeTypst(cell.stdText)}${pct}`;
    }
  } else {
    core = `${escapeTypst(cell.meanText)}${pct}`;
  }

  if (boldBest && cell.rank === 1) {
    core = `#strong[${core}]`;
  } else if (underlineSecond && cell.rank === 2) {
    core = `#underline[${core}]`;
  }

  const stars = cell.stars ? `#super[${escapeTypst(cell.stars)}]` : '';
  const deltaPart = cell.delta?.formatted
    ? ` #text(size: 0.8em)[(${escapeTypst(cell.delta.formatted)})]`
    : '';

  return `[${core}${stars}${deltaPart}]`;
}

/**
 * Export analyzed table to modern Typst `#figure(table(...))`.
 */
export function exportTypst(analyzed, options = {}) {
  if (analyzed.empty) return '// Paste CSV/TSV data to generate Typst code.';

  const preset = VENUE_PRESETS[options.preset] || analyzed.preset || VENUE_PRESETS.neurips;
  const boldBest = options.boldBest !== false;
  const underlineSecond = options.underlineSecond !== false;
  const showArrows = options.showArrows !== false;
  const caption = options.caption !== undefined && options.caption !== ''
    ? options.caption
    : DEFAULT_CAPTION_EN;
  const rawLabel = options.label !== undefined && options.label !== ''
    ? options.label
    : DEFAULT_LABEL;
  const typstLabel = rawLabel.replace(/[^A-Za-z0-9:_-]/g, '-');

  const aligns = analyzed.columns.map((col) => (col.align === 'right' ? 'right' : 'left'));
  const lines = [];
  lines.push(`// Generated by TableForge Pro (${preset.labelEn})`);
  lines.push('#figure(');
  lines.push(`  caption: [${escapeTypst(caption)}],`);
  lines.push('  table(');
  lines.push(`    columns: ${analyzed.columns.length},`);
  lines.push(`    align: (${aligns.join(', ')}),`);
  lines.push('    stroke: none,');
  lines.push('    inset: (x: 6pt, y: 4pt),');
  lines.push('    table.hline(stroke: 1.2pt),');

  // Header
  const headerItems = [];
  if (analyzed.columnGroups.length > 0) {
    let c = 0;
    const grpCells = [];
    while (c < analyzed.columns.length) {
      const grp = analyzed.columnGroups.find((g) => g.startCol === c);
      if (grp) {
        const span = grp.endCol - grp.startCol + 1;
        grpCells.push(`table.cell(colspan: ${span}, align: center)[#strong[${escapeTypst(grp.label)}]]`);
        c = grp.endCol + 1;
      } else {
        grpCells.push('[]');
        c++;
      }
    }
    headerItems.push(`      ${grpCells.join(', ')},`);
  }

  const hCells = analyzed.columns.map((col) => `[#strong[${formatHeaderLabel(col, showArrows, 'typst')}]]`);
  headerItems.push(`      ${hCells.join(', ')},`);
  lines.push('    table.header(');
  lines.push(...headerItems);
  lines.push('    ),');
  lines.push('    table.hline(stroke: 0.6pt),');

  for (const row of analyzed.rows) {
    if (row.type === 'midrule') {
      lines.push('    table.hline(stroke: 0.4pt),');
      if (row.label) {
        lines.push(`    table.cell(colspan: ${analyzed.columns.length}, align: left)[#emph[${escapeTypst(row.label)}]],`);
        lines.push('    table.hline(stroke: 0.4pt),');
      }
      continue;
    }

    const rCells = row.cells.map((cell) => formatTypstCell(cell, { boldBest, underlineSecond }));
    lines.push(`    ${rCells.join(', ')},`);
  }

  lines.push('    table.hline(stroke: 1.2pt),');
  lines.push('  ),');
  lines.push(`) <${typstLabel}>`);
  return lines.join('\n');
}

/* ============================================================================
 * 8. GitHub Flavored Markdown Exporter
 * ========================================================================== */

export function escapeMarkdown(str) {
  return String(str ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function formatMarkdownCell(cell, { boldBest = true, underlineSecond = true }) {
  if (cell.kind === 'missing') {
    return escapeMarkdown(cell.meanText);
  }
  if (cell.kind === 'text') {
    return escapeMarkdown(cell.text);
  }

  const pct = cell.isPercent ? '%' : '';
  let core;
  if (cell.stdText !== null) {
    if (cell.uncertaintyStyle === 'paren') {
      core = `${cell.meanText}${pct} (${cell.stdText})`;
    } else {
      core = `${cell.meanText}${pct} ± ${cell.stdText}${pct}`;
    }
  } else {
    core = `${cell.meanText}${pct}`;
  }

  if (boldBest && cell.rank === 1) {
    core = `**${core}**`;
  } else if (underlineSecond && cell.rank === 2) {
    core = `*${core}*`;
  }

  const stars = cell.stars || '';
  const deltaPart = cell.delta?.formatted ? ` (${cell.delta.formatted})` : '';
  return escapeMarkdown(`${core}${stars}${deltaPart}`);
}

/**
 * Export analyzed table as a clean aligned GitHub Flavored Markdown pipe table.
 */
export function exportMarkdown(analyzed, options = {}) {
  if (analyzed.empty) return '<!-- Paste CSV/TSV data to generate a Markdown table -->';

  const boldBest = options.boldBest !== false;
  const underlineSecond = options.underlineSecond !== false;
  const showArrows = options.showArrows !== false;

  const headerRow = analyzed.columns.map((col) => formatHeaderLabel(col, showArrows, 'markdown'));
  const bodyRows = [];

  for (const row of analyzed.rows) {
    if (row.type === 'midrule') {
      if (row.label) {
        const labelRow = new Array(analyzed.columns.length).fill('');
        labelRow[0] = `*${escapeMarkdown(row.label)}*`;
        bodyRows.push(labelRow);
      }
      continue;
    }
    bodyRows.push(row.cells.map((cell) => formatMarkdownCell(cell, { boldBest, underlineSecond })));
  }

  // Compute column widths for clean aligned pipes
  const widths = analyzed.columns.map((_, c) => {
    let w = Math.max(3, headerRow[c].length);
    for (const r of bodyRows) {
      w = Math.max(w, r[c].length);
    }
    return w;
  });

  const padCell = (text, width, align) => {
    const pad = Math.max(0, width - text.length);
    return align === 'right' ? `${' '.repeat(pad)}${text}` : `${text}${' '.repeat(pad)}`;
  };

  const lines = [];
  if (options.caption) {
    lines.push(`**Table 1.** ${options.caption}`);
    lines.push('');
  }

  lines.push(`| ${headerRow.map((h, c) => padCell(h, widths[c], analyzed.columns[c].align)).join(' | ')} |`);
  lines.push(
    `| ${analyzed.columns
      .map((col, c) => (col.align === 'right' ? `${'-'.repeat(Math.max(3, widths[c] - 1))}:` : `:${'-'.repeat(Math.max(3, widths[c] - 1))}`))
      .join(' | ')} |`,
  );

  for (const r of bodyRows) {
    lines.push(`| ${r.map((val, c) => padCell(val, widths[c], analyzed.columns[c].align)).join(' | ')} |`);
  }

  return lines.join('\n');
}

/* ============================================================================
 * 9. Python CLI Command Generator
 * ========================================================================== */

function shellQuote(val) {
  const s = String(val ?? '');
  if (/^[A-Za-z0-9_./:=+-]+$/.test(s)) return s;
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Build a reproducible `python3 cli/tableforge.py ...` CLI command matching current UI config.
 */
export function buildCliCommand(analyzed, options = {}) {
  const parts = ['python3 cli/tableforge.py results.csv'];
  const presetId = options.preset || analyzed?.preset?.id || 'neurips';
  parts.push(`--preset ${presetId}`);

  if (analyzed && !analyzed.empty) {
    const maxCols = analyzed.columns.filter((c) => c.direction === 'max').map((c) => c.header);
    const minCols = analyzed.columns.filter((c) => c.direction === 'min').map((c) => c.header);
    if (maxCols.length > 0) parts.push(`--max ${shellQuote(maxCols.join(','))}`);
    if (minCols.length > 0) parts.push(`--min ${shellQuote(minCols.join(','))}`);
  }

  if (options.precision !== undefined && options.precision !== 'auto') {
    parts.push(`--precision ${options.precision}`);
  }
  if (options.baselineRow !== null && options.baselineRow !== undefined && options.baselineRow !== '') {
    parts.push(`--baseline ${options.baselineRow}`);
    if (options.deltaMode === 'pct') parts.push('--delta-mode pct');
  }
  if (options.useSiunitx) parts.push('--siunitx');
  if (options.useResizebox) parts.push('--resizebox');
  if (options.boldBest === false) parts.push('--no-bold');
  if (options.underlineSecond === false) parts.push('--no-underline');
  if (options.showArrows === false) parts.push('--no-arrows');

  const fmt = options.format || 'latex';
  parts.push(`--format ${fmt}`);
  const extMap = { latex: 'tex', word: 'html', typst: 'typ', markdown: 'md' };
  parts.push(`--out table1.${extMap[fmt] || 'tex'}`);
  return parts.join(' ');
}
