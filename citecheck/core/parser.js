/**
 * CiteCheck Pro — Robust BibTeX & Plain-Text Reference Parser
 *
 * Supports:
 *   - BibTeX (@article, @inproceedings, @misc, @book, @phdthesis, @techreport, etc.)
 *     with nested braces, quoted strings, @string macros, # concatenation, LaTeX accents, comments.
 *   - Plain-text lists: numbered ([1], 1., (1)), APA 7th, IEEE, and Chinese/English GB/T 7714.
 *   - Auto-detection between BibTeX and plain text.
 */

const LATEX_ACCENT_MAP = {
  '"': { a: 'ä', e: 'ë', i: 'ï', o: 'ö', u: 'ü', y: 'ÿ', A: 'Ä', E: 'Ë', I: 'Ï', O: 'Ö', U: 'Ü', Y: 'Ÿ' },
  "'": { a: 'á', c: 'ć', e: 'é', i: 'í', n: 'ń', o: 'ó', s: 'ś', u: 'ú', y: 'ý', z: 'ź', A: 'Á', C: 'Ć', E: 'É', I: 'Í', N: 'Ń', O: 'Ó', S: 'Ś', U: 'Ú', Y: 'Ý', Z: 'Ź' },
  '`': { a: 'à', e: 'è', i: 'ì', o: 'ò', u: 'ù', A: 'À', E: 'È', I: 'Ì', O: 'Ò', U: 'Ù' },
  '^': { a: 'â', e: 'ê', i: 'î', o: 'ô', u: 'û', A: 'Â', E: 'Ê', I: 'Î', O: 'Ô', U: 'Û' },
  '~': { a: 'ã', n: 'ñ', o: 'õ', A: 'Ã', N: 'Ñ', O: 'Õ' },
  '=': { a: 'ā', e: 'ē', i: 'ī', o: 'ō', u: 'ū', A: 'Ā', E: 'Ē', I: 'Ī', O: 'Ō', U: 'Ū' },
  '.': { c: 'ċ', e: 'ė', g: 'ġ', I: 'İ', z: 'ż', Z: 'Ż' },
  c: { c: 'ç', C: 'Ç', s: 'ş', S: 'Ş', t: 'ţ', T: 'Ţ' },
  v: { c: 'č', C: 'Č', r: 'ř', R: 'Ř', s: 'š', S: 'Š', z: 'ž', Z: 'Ž', n: 'ň', N: 'Ň' },
  u: { a: 'ă', A: 'Ă', g: 'ğ', G: 'Ğ' },
  H: { o: 'ő', O: 'Ő', u: 'ű', U: 'Ű' },
  r: { a: 'å', A: 'Å', u: 'ů', U: 'Ů' },
};

const LATEX_SPECIAL_COMMANDS = [
  [/\\(?:L)\b/g, 'Ł'],
  [/\\(?:l)\b/g, 'ł'],
  [/\\(?:O)\b/g, 'Ø'],
  [/\\(?:o)\b/g, 'ø'],
  [/\\(?:AE)\b/g, 'Æ'],
  [/\\(?:ae)\b/g, 'æ'],
  [/\\(?:OE)\b/g, 'Œ'],
  [/\\(?:oe)\b/g, 'œ'],
  [/\\(?:AA)\b/g, 'Å'],
  [/\\(?:aa)\b/g, 'å'],
  [/\\(?:ss)\b/g, 'ß'],
  [/\\(?:i)\b/g, 'i'],
  [/\\(?:j)\b/g, 'j'],
];

const PREPRINT_VENUE_RE =
  /\b(arxiv|corr|computing research repository|biorxiv|medrxiv|chemrxiv|psyarxiv|socarxiv|ssrn|preprint|preprints\.org|research square|osf preprints|techrxiv|eartharxiv|e-?prints?)\b/i;

export function isPreprintVenueName(venue) {
  if (!venue) return false;
  return PREPRINT_VENUE_RE.test(String(venue));
}

/**
 * Clean LaTeX markup, accents, formatting commands, and protective braces.
 */
export function cleanLatexText(input) {
  if (!input) return '';
  let s = String(input);

  // Convert \href{url}{label} -> label, \url{...} -> ...
  s = s.replace(/\\href\s*\{[^{}]*\}\s*\{([^{}]*)\}/g, '$1');
  s = s.replace(/\\(?:url|textbf|textit|emph|textrm|texttt|textsf|textsc|mathrm|mathbf|mathit|text)\s*\{([^{}]*)\}/g, '$1');

  // Symbol-style accents: {\"o}, \"{o}, \"o, \'e, \`a, \^o, \~n, \=a, \.z
  s = s.replace(/\{\\(["'`^~=.])\s*\{?\\?([A-Za-z])\}?\}/g, (_, acc, ch) => LATEX_ACCENT_MAP[acc]?.[ch] || ch);
  s = s.replace(/\\(["'`^~=.])\s*\{([A-Za-z])\}/g, (_, acc, ch) => LATEX_ACCENT_MAP[acc]?.[ch] || ch);
  s = s.replace(/\\(["'`^~=])([A-Za-z])/g, (_, acc, ch) => LATEX_ACCENT_MAP[acc]?.[ch] || ch);

  // Letter-command accents: {\c{c}}, \c{c}, {\v{s}}, \v{s}, {\H{o}}, {\u{g}}, {\r{a}}, {\c c}
  s = s.replace(/\{\\([cvuHr])\s*\{([A-Za-z])\}\}/g, (_, acc, ch) => LATEX_ACCENT_MAP[acc]?.[ch] || ch);
  s = s.replace(/\{\\([cvuHr])\s+([A-Za-z])\}/g, (_, acc, ch) => LATEX_ACCENT_MAP[acc]?.[ch] || ch);
  s = s.replace(/\\([cvuHr])\s*\{([A-Za-z])\}/g, (_, acc, ch) => LATEX_ACCENT_MAP[acc]?.[ch] || ch);

  // Special letters such as {\L}, {\o}, {\ss}
  for (const [pattern, replacement] of LATEX_SPECIAL_COMMANDS) {
    s = s.replace(pattern, replacement);
  }

  // Escaped punctuation and ties
  s = s
    .replace(/\\&/g, '&')
    .replace(/\\%/g, '%')
    .replace(/\\_/g, '_')
    .replace(/\\#/g, '#')
    .replace(/\\\$/g, '$')
    .replace(/\\~/g, '~')
    .replace(/~/g, ' ')
    .replace(/---/g, '—')
    .replace(/--/g, '–')
    .replace(/``/g, '"')
    .replace(/''/g, '"');

  // Remove remaining simple braces used for capitalization protection
  s = s.replace(/[{}]/g, '');

  // Collapse whitespace
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Normalize a DOI string safely, preserving balanced parentheses (e.g., Lancet DOIs).
 */
export function normalizeDoi(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  s = s.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '');
  s = s.replace(/^doi\s*:\s*/i, '');
  s = s.replace(/^[\s<\[(]+/, '');

  // Strip trailing punctuation except ')' if balanced inside DOI
  while (s.length > 0) {
    const last = s[s.length - 1];
    if (/[.,;>\]]/.test(last)) {
      s = s.slice(0, -1);
      continue;
    }
    if (last === ')') {
      const opens = (s.match(/\(/g) || []).length;
      const closes = (s.match(/\)/g) || []).length;
      if (closes > opens) {
        s = s.slice(0, -1);
        continue;
      }
    }
    break;
  }

  const match = s.match(/10\.\d{4,9}\/[^\s"<>]+/i);
  if (!match) return '';
  let doi = match[0];
  while (doi.length > 0) {
    const last = doi[doi.length - 1];
    if (/[.,;>\]]/.test(last)) {
      doi = doi.slice(0, -1);
    } else if (last === ')') {
      const opens = (doi.match(/\(/g) || []).length;
      const closes = (doi.match(/\)/g) || []).length;
      if (closes > opens) doi = doi.slice(0, -1);
      else break;
    } else {
      break;
    }
  }
  return doi.trim();
}

/**
 * Extract normalized arXiv identifier (stripping trailing version like v2) from text/fields.
 */
export function extractArxivId(text) {
  if (!text) return '';
  const s = String(text);

  // Explicit arXiv: prefix or arxiv.org URL or 10.48550/arXiv.
  const modernExplicit = s.match(
    /(?:arxiv(?:\s*:\s*|\/|\s+preprint\s+arxiv\s*:\s*)|arxiv\.org\/(?:abs|pdf)\/|10\.48550\/arxiv\.)(\d{4}\.\d{4,5})(?:v\d+)?/i,
  );
  if (modernExplicit) return modernExplicit[1];

  // Legacy arXiv IDs: hep-th/9901001, cs.CL/0102003
  const legacyExplicit = s.match(
    /(?:arxiv\s*:\s*|arxiv\.org\/(?:abs|pdf)\/|10\.48550\/arxiv\.)([a-z\-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?/i,
  );
  if (legacyExplicit) return legacyExplicit[1];

  return '';
}

function extractBareArxivEprint(eprint, archivePrefix) {
  if (!eprint) return '';
  const fromExplicit = extractArxivId(eprint);
  if (fromExplicit) return fromExplicit;
  const trimmed = String(eprint).trim();
  const isArxivPrefix = !archivePrefix || /arxiv/i.test(archivePrefix);
  if (isArxivPrefix) {
    const m = trimmed.match(/^(\d{4}\.\d{4,5})(?:v\d+)?$/);
    if (m) return m[1];
    const oldM = trimmed.match(/^([a-z\-]+(?:\.[A-Z]{2})?\/\d{7})(?:v\d+)?$/i);
    if (oldM) return oldM[1];
  }
  return '';
}

function extractYear(raw) {
  if (raw === null || raw === undefined) return null;
  const m = String(raw).match(/\b(1[5-9]\d{2}|20[0-3]\d)\b/);
  return m ? Number(m[1]) : null;
}

/**
 * Split BibTeX author field on top-level `and` (ignoring `and` inside `{...}`).
 */
export function splitBibtexAuthors(rawAuthor) {
  if (!rawAuthor) return [];
  const s = String(rawAuthor);
  const parts = [];
  let depth = 0;
  let current = '';

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '{') {
      depth++;
      current += ch;
      continue;
    }
    if (ch === '}') {
      depth = Math.max(0, depth - 1);
      current += ch;
      continue;
    }
    if (depth === 0) {
      const rest = s.slice(i);
      const andMatch = rest.match(/^\s+and\s+/i);
      if (andMatch && current.trim().length > 0) {
        parts.push(cleanLatexText(current));
        current = '';
        i += andMatch[0].length - 1;
        continue;
      }
    }
    current += ch;
  }
  if (current.trim()) {
    parts.push(cleanLatexText(current));
  }
  return parts
    .map((a) => a.trim())
    .filter((a) => a && !/^others$/i.test(a) && !/^et\s+al\.?$/i.test(a));
}

/* ---------- BibTeX Tokenizer & Recursive Parser ---------- */

function skipWhitespaceAndComments(src, idx) {
  let i = idx;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
    } else if (ch === '%') {
      while (i < n && src[i] !== '\n') i++;
    } else {
      break;
    }
  }
  return i;
}

function readBracedValue(src, startIdx) {
  let i = startIdx + 1;
  let depth = 1;
  const n = src.length;
  while (i < n && depth > 0) {
    if (src[i] === '\\' && i + 1 < n) {
      i += 2;
      continue;
    }
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    i++;
  }
  return {
    value: src.slice(startIdx + 1, Math.max(startIdx + 1, i - 1)),
    nextIdx: i,
  };
}

function readQuotedValue(src, startIdx) {
  let i = startIdx + 1;
  let depth = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (ch === '\\' && i + 1 < n) {
      i += 2;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') depth = Math.max(0, depth - 1);
    else if (ch === '"' && depth === 0) {
      return { value: src.slice(startIdx + 1, i), nextIdx: i + 1 };
    }
    i++;
  }
  return { value: src.slice(startIdx + 1), nextIdx: n };
}

function readFieldValue(src, startIdx, stringsMap, closingChar) {
  let i = skipWhitespaceAndComments(src, startIdx);
  const n = src.length;
  const chunks = [];

  while (i < n) {
    i = skipWhitespaceAndComments(src, i);
    if (i >= n) break;
    const ch = src[i];
    if (ch === '{') {
      const { value, nextIdx } = readBracedValue(src, i);
      chunks.push(value);
      i = nextIdx;
    } else if (ch === '"') {
      const { value, nextIdx } = readQuotedValue(src, i);
      chunks.push(value);
      i = nextIdx;
    } else {
      const bareStart = i;
      while (i < n && !/[,#}\)\s]/.test(src[i]) && src[i] !== closingChar) {
        i++;
      }
      const token = src.slice(bareStart, i).trim();
      if (token) {
        const macro = stringsMap.get(token.toLowerCase());
        chunks.push(macro !== undefined ? macro : token);
      }
    }

    i = skipWhitespaceAndComments(src, i);
    if (i < n && src[i] === '#') {
      i++;
      continue;
    }
    break;
  }

  return { value: chunks.join(''), nextIdx: i };
}

function findEntryEnd(src, openIdx, openChar) {
  const closeChar = openChar === '{' ? '}' : ')';
  let i = openIdx + 1;
  let depth = 1;
  let inQuotes = false;
  const n = src.length;

  while (i < n && depth > 0) {
    const ch = src[i];
    if (ch === '\\' && i + 1 < n) {
      i += 2;
      continue;
    }
    if (ch === '"' && depth === 1) {
      inQuotes = !inQuotes;
      i++;
      continue;
    }
    if (!inQuotes) {
      if (ch === openChar) depth++;
      else if (ch === closeChar) depth--;
    }
    i++;
  }
  return i;
}

/**
 * Parse BibTeX text into structured normalized reference entries.
 */
export function parseBibTeX(input) {
  const src = String(input || '');
  const entries = [];
  const stringsMap = new Map([
    ['jan', 'January'],
    ['feb', 'February'],
    ['mar', 'March'],
    ['apr', 'April'],
    ['may', 'May'],
    ['jun', 'June'],
    ['jul', 'July'],
    ['aug', 'August'],
    ['sep', 'September'],
    ['oct', 'October'],
    ['nov', 'November'],
    ['dec', 'December'],
  ]);

  let i = 0;
  const n = src.length;

  while (i < n) {
    // Skip comments and junk until '@'
    if (src[i] === '%') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (src[i] !== '@') {
      i++;
      continue;
    }

    const entryStart = i;
    i++; // consume '@'
    const typeStart = i;
    while (i < n && /[a-zA-Z0-9_-]/.test(src[i])) i++;
    const rawType = src.slice(typeStart, i).trim();
    const type = rawType.toLowerCase();

    i = skipWhitespaceAndComments(src, i);
    if (i >= n || (src[i] !== '{' && src[i] !== '(')) {
      continue;
    }

    const openChar = src[i];
    const closeChar = openChar === '{' ? '}' : ')';
    const entryEnd = findEntryEnd(src, i, openChar);
    const rawEntry = src.slice(entryStart, entryEnd).trim();
    const bodyStart = i + 1;
    const bodyEnd = Math.max(bodyStart, entryEnd - 1);
    const body = src.slice(bodyStart, bodyEnd);

    if (type === 'comment' || type === 'preamble') {
      i = entryEnd;
      continue;
    }

    if (type === 'string') {
      const eqIdx = body.indexOf('=');
      if (eqIdx > 0) {
        const k = body.slice(0, eqIdx).trim().toLowerCase();
        const { value } = readFieldValue(body, eqIdx + 1, stringsMap, closeChar);
        if (k) stringsMap.set(k, value);
      }
      i = entryEnd;
      continue;
    }

    // Read citation key up to first comma
    let cursor = skipWhitespaceAndComments(body, 0);
    const keyStart = cursor;
    while (cursor < body.length && body[cursor] !== ',' && !/\s/.test(body[cursor])) {
      cursor++;
    }
    const key = body.slice(keyStart, cursor).trim();
    cursor = skipWhitespaceAndComments(body, cursor);
    if (body[cursor] === ',') cursor++;

    // Parse key = value fields
    const rawFields = {};
    while (cursor < body.length) {
      cursor = skipWhitespaceAndComments(body, cursor);
      if (cursor >= body.length) break;
      if (body[cursor] === ',') {
        cursor++;
        continue;
      }

      const nameStart = cursor;
      while (cursor < body.length && /[a-zA-Z0-9_:-]/.test(body[cursor])) {
        cursor++;
      }
      const fieldName = body.slice(nameStart, cursor).trim().toLowerCase();
      cursor = skipWhitespaceAndComments(body, cursor);
      if (!fieldName || body[cursor] !== '=') {
        // Advance past malformed token to avoid infinite loop
        while (cursor < body.length && body[cursor] !== ',') cursor++;
        if (body[cursor] === ',') cursor++;
        continue;
      }
      cursor++; // consume '='
      const { value, nextIdx } = readFieldValue(body, cursor, stringsMap, closeChar);
      rawFields[fieldName] = value;
      cursor = nextIdx;
      cursor = skipWhitespaceAndComments(body, cursor);
      if (body[cursor] === ',') cursor++;
    }

    const title = cleanLatexText(rawFields.title || '');
    const authors = splitBibtexAuthors(rawFields.author || rawFields.editor || '');
    const year = extractYear(rawFields.year || rawFields.date || '');
    const venue = cleanLatexText(
      rawFields.journal ||
        rawFields.journaltitle ||
        rawFields.booktitle ||
        rawFields.howpublished ||
        rawFields.publisher ||
        rawFields.school ||
        rawFields.institution ||
        '',
    );
    const url = cleanLatexText(rawFields.url || '');
    const doi = normalizeDoi(rawFields.doi || (url.includes('doi.org/') ? url : ''));
    const arxivId =
      extractBareArxivEprint(rawFields.eprint, rawFields.archiveprefix) ||
      extractArxivId(rawFields.journal) ||
      extractArxivId(rawFields.booktitle) ||
      extractArxivId(rawFields.howpublished) ||
      extractArxivId(rawFields.note) ||
      extractArxivId(url) ||
      extractArxivId(doi);

    const hasFormalVenue = Boolean(venue) && !isPreprintVenueName(venue);
    const isPreprintHint = Boolean(
      isPreprintVenueName(venue) ||
        (arxivId && !hasFormalVenue) ||
        (type === 'misc' && (arxivId || /arxiv\.org|biorxiv\.org|medrxiv\.org/i.test(url)) && !hasFormalVenue),
    );

    const cleanedFields = {};
    for (const [k, v] of Object.entries(rawFields)) {
      cleanedFields[k] = cleanLatexText(v);
    }

    if (title || doi || arxivId || key) {
      entries.push({
        index: entries.length + 1,
        sourceFormat: 'bibtex',
        key: key || `ref_${entries.length + 1}`,
        type,
        title,
        authors,
        year,
        venue,
        doi,
        arxivId,
        url,
        volume: cleanedFields.volume || '',
        number: cleanedFields.number || cleanedFields.issue || '',
        pages: cleanedFields.pages || '',
        publisher: cleanedFields.publisher || '',
        isPreprintHint,
        fields: cleanedFields,
        raw: rawEntry,
      });
    }

    i = entryEnd;
  }

  return entries;
}

/* ---------- Plain-Text Reference Parser (GB/T 7714, APA, IEEE, Numbered) ---------- */

const NUMBERED_PREFIX_RE = /^\s*(?:\[(\d{1,4})\]|\((\d{1,4})\)|(\d{1,4})[.)、])\s+(.*)$/;

function splitPlainTextBlocks(input) {
  const normalized = String(input || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const lines = normalized.split('\n');
  const numberedLineCount = lines.filter((l) => NUMBERED_PREFIX_RE.test(l)).length;

  // Case 1: Numbered list (handles multi-line wrapped entries cleanly)
  if (numberedLineCount >= 1) {
    const blocks = [];
    let current = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (current) {
          blocks.push(current.trim());
          current = '';
        }
        continue;
      }
      if (NUMBERED_PREFIX_RE.test(trimmed)) {
        if (current) blocks.push(current.trim());
        current = trimmed;
      } else if (current) {
        current += ' ' + trimmed;
      } else {
        current = trimmed;
      }
    }
    if (current) blocks.push(current.trim());
    return blocks.filter((b) => b.length >= 8);
  }

  // Case 2: Blank-line separated paragraphs (common for APA)
  const paragraphs = normalized
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter((p) => p.length >= 8);

  if (paragraphs.length > 1) return paragraphs;

  // Case 3: Single-line-per-reference paste
  const nonEmptyLines = lines.map((l) => l.trim()).filter((l) => l.length >= 12);
  if (nonEmptyLines.length > 1) {
    const looksLikeSeparateRefs = nonEmptyLines.filter(
      (l) => /\b(19|20)\d{2}\b/.test(l) || /\[[JCMDRPSNZA](?:\/OL)?\]/i.test(l) || /10\.\d{4,9}\//.test(l),
    ).length;
    if (looksLikeSeparateRefs >= Math.ceil(nonEmptyLines.length * 0.6)) {
      return nonEmptyLines;
    }
  }

  return paragraphs;
}

function splitPlainAuthors(authorStr) {
  if (!authorStr) return [];
  let s = String(authorStr)
    .replace(/\b(?:et\s+al\.?)\b/gi, '')
    .replace(/[，,]\s*等\.?$/g, '')
    .replace(/\s*等\.?$/g, '')
    .replace(/[.;,，]+$/g, '')
    .trim();
  if (!s) return [];

  // Chinese comma / ideographic comma separated authors
  if (/[\u4e00-\u9fff]/.test(s)) {
    return s
      .split(/[，、,;；]+|\s+and\s+/i)
      .map((a) => a.trim())
      .filter(Boolean);
  }

  // APA style: "Vaswani, A., Shazeer, N., & Parmar, N."
  if (/[A-Za-z\-]+,\s+[A-Z]\./.test(s)) {
    const normalized = s.replace(/,?\s*(?:&|\band\b)\s+/gi, '; ');
    const pieces = [];
    // Split on `., ` followed by a new surname
    const regex = /([A-Za-zÀ-ÖØ-öø-ÿ'\-\s]+?,\s*(?:[A-Z]\.\s*)+)(?:,\s*|;\s*|$)/g;
    let m;
    while ((m = regex.exec(normalized)) !== null) {
      const candidate = m[1].trim().replace(/[;,]+$/, '');
      if (candidate) pieces.push(candidate);
    }
    if (pieces.length > 0) return pieces;
  }

  // GB/T English style: "VASWANI A, SHAZEER N, PARMAR N" or IEEE: "A. Vaswani, N. Shazeer, and N. Parmar"
  return s
    .replace(/,?\s*(?:&|\band\b)\s+/gi, ', ')
    .split(/[,;]+/)
    .map((a) => a.trim())
    .filter((a) => a.length >= 2 && !/^and$/i.test(a));
}

function makePlainKey(authors, year, index) {
  const first = authors[0] || '';
  let slug = '';
  if (/[\u4e00-\u9fff]/.test(first)) {
    slug = `ref_${index}`;
  } else {
    const surnamePart = first.includes(',') ? first.split(',')[0] : first.split(/\s+/).pop() || '';
    const ascii = surnamePart
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z]/g, '')
      .toLowerCase();
    slug = ascii ? `${ascii}${year || index}` : `ref_${index}`;
  }
  return slug;
}

function mapGbtTypeToBibType(code) {
  const base = String(code || '').toUpperCase().split('/')[0];
  if (base === 'J') return 'article';
  if (base === 'C' || base === 'A') return 'inproceedings';
  if (base === 'M') return 'book';
  if (base === 'D') return 'phdthesis';
  if (base === 'R') return 'techreport';
  return 'misc';
}

function parseSinglePlainReference(block, index) {
  const raw = block.trim();
  let text = raw;
  const numMatch = text.match(NUMBERED_PREFIX_RE);
  if (numMatch) {
    text = numMatch[4].trim();
  }

  // Extract universal identifiers first
  const urlMatch = text.match(/https?:\/\/[^\s\]>),]+/i);
  const url = urlMatch ? urlMatch[0].replace(/[.,;]+$/, '') : '';
  const doi = normalizeDoi(text);
  const arxivId = extractArxivId(text);

  // Strip trailing DOI / URL fragments for cleaner title/venue segmentation
  const textWithoutTrailingIds = text
    .replace(/(?:https?:\/\/(?:dx\.)?doi\.org\/|doi\s*:\s*)10\.\d{4,9}\/[^\s]+/gi, '')
    .replace(/https?:\/\/[^\s]+/gi, '')
    .trim();

  let authors = [];
  let title = '';
  let venue = '';
  let year = null;
  let type = 'article';
  let style = 'generic';

  // 1. GB/T 7714 detection: `Authors. Title[J]. Venue, 2020...` or `[C]//Venue`
  const gbtMatch = textWithoutTrailingIds.match(
    /^(.+?)[.。．]\s*(.+?)\s*[\[［]([JCMDRPSNZA](?:\/[A-Z]{2})?)[\]］]\s*(?:\/\/|[.。．])?\s*(.*)$/i,
  );
  if (gbtMatch) {
    style = 'gbt7714';
    authors = splitPlainAuthors(gbtMatch[1]);
    title = gbtMatch[2].trim().replace(/^["“]|["”]$/g, '');
    type = mapGbtTypeToBibType(gbtMatch[3]);
    const tail = gbtMatch[4].trim();
    year = extractYear(tail) || extractYear(text);
    // Venue in GB/T is typically before the first comma/colon/year
    const venuePart = tail
      .replace(/\[[\d\-]+\]/g, '')
      .split(/[,，]/)[0]
      .replace(/\b(19|20)\d{2}\b.*$/, '')
      .trim()
      .replace(/[.。:：]+$/, '');
    venue = venuePart;
  }

  // 2. APA style: `Authors (2017). Title. Venue, 30...`
  if (!title) {
    const apaMatch = textWithoutTrailingIds.match(
      /^(.+?)\s*\((\d{4}[a-z]?(?:,\s*[A-Za-z]+(?:\s+\d+)?)?)\)\.\s*(.+)$/,
    );
    if (apaMatch) {
      style = 'apa';
      authors = splitPlainAuthors(apaMatch[1]);
      year = extractYear(apaMatch[2]);
      const rest = apaMatch[3].trim();
      // Split title from venue on sentence boundary `. ` / `? ` / `! ` (avoiding abbreviations like `e.g.` or initials)
      const splitIdx = rest.search(/(?:[.?!])(?:\s+|$)/);
      if (splitIdx > 5) {
        title = rest.slice(0, splitIdx).trim();
        const afterTitle = rest.slice(splitIdx + 1).trim();
        venue = afterTitle
          .replace(/^In\s+/i, '')
          .split(/[,(]/)[0]
          .trim()
          .replace(/\.$/, '');
      } else {
        title = rest.replace(/\.$/, '').trim();
      }
      if (/\b(proceedings|conference|symposium|workshop|neurips|icml|iclr|cvpr|acl|emnlp|aaai)\b/i.test(venue)) {
        type = 'inproceedings';
      }
    }
  }

  // 3. IEEE / Quoted-title style: `A. Vaswani et al., "Attention is all you need," in Proc. NeurIPS, 2017.`
  if (!title) {
    const quotedMatch = textWithoutTrailingIds.match(/^(.+?)[,，]\s*["“]([^"”]{6,})["”]\s*(.*)$/);
    if (quotedMatch) {
      style = 'ieee';
      authors = splitPlainAuthors(quotedMatch[1]);
      title = quotedMatch[2].replace(/[.,，。]+$/, '').trim();
      const tail = quotedMatch[3].replace(/^[,，.\s]+/, '').trim();
      year = extractYear(tail) || extractYear(text);
      venue = tail
        .replace(/^in\s+/i, '')
        .split(/[,，]/)[0]
        .replace(/\b(19|20)\d{2}\b.*$/, '')
        .trim();
      if (/\b(proc\.|proceedings|conference|symposium|workshop|cvpr|iccv|neurips|icml|iclr|acl|aaai)\b/i.test(tail)) {
        type = 'inproceedings';
      }
    }
  }

  // 4. Generic period-separated fallback
  if (!title) {
    year = extractYear(text);
    const segments = textWithoutTrailingIds
      .split(/[.。．]\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (segments.length >= 2) {
      authors = splitPlainAuthors(segments[0]);
      title = segments[1].replace(/^["“]|["”]$/g, '').trim();
      venue = (segments[2] || '').split(/[,，(]/)[0].trim();
    } else {
      title = textWithoutTrailingIds.replace(/\b(19|20)\d{2}\b/g, '').trim();
    }
  }

  if (!year) year = extractYear(text);

  const hasFormalVenue = Boolean(venue) && !isPreprintVenueName(venue);
  const isPreprintHint = Boolean(
    isPreprintVenueName(venue) ||
      (arxivId && !hasFormalVenue) ||
      (/\barxiv\b/i.test(text) && !hasFormalVenue),
  );

  return {
    index,
    sourceFormat: 'plaintext',
    detectedStyle: style,
    key: makePlainKey(authors, year, index),
    type: isPreprintHint ? 'misc' : type,
    title: title.replace(/\s+/g, ' ').trim(),
    authors,
    year,
    venue: venue.replace(/\s+/g, ' ').trim(),
    doi,
    arxivId,
    url,
    volume: '',
    number: '',
    pages: '',
    publisher: '',
    isPreprintHint,
    fields: {},
    raw,
  };
}

/**
 * Parse a plain-text reference list (APA, IEEE, GB/T 7714, numbered).
 */
export function parsePlainTextReferences(input) {
  const blocks = splitPlainTextBlocks(input);
  const entries = blocks.map((block, idx) => parseSinglePlainReference(block, idx + 1));

  // Deduplicate generated keys cleanly
  const keyCounts = new Map();
  for (const entry of entries) {
    const base = entry.key;
    const count = keyCounts.get(base) || 0;
    keyCounts.set(base, count + 1);
    if (count > 0) {
      entry.key = `${base}_${count + 1}`;
    }
  }
  return entries;
}

/**
 * Auto-detect whether raw input is BibTeX or plain-text references.
 */
export function detectInputFormat(input) {
  const src = String(input || '');
  if (/@(?:article|inproceedings|proceedings|misc|book|incollection|inbook|phdthesis|mastersthesis|techreport|unpublished|conference|online|software|dataset|manual|booklet)\s*[{(]/i.test(src)) {
    return 'bibtex';
  }
  return 'plaintext';
}

/**
 * Unified parse entry point.
 * @param {string} input
 * @param {'auto'|'bibtex'|'plaintext'} mode
 * @returns {{ mode: 'bibtex'|'plaintext', entries: Array<object> }}
 */
export function parseReferences(input, mode = 'auto') {
  const resolvedMode = mode === 'bibtex' || mode === 'plaintext' ? mode : detectInputFormat(input);
  const entries = resolvedMode === 'bibtex' ? parseBibTeX(input) : parsePlainTextReferences(input);
  return { mode: resolvedMode, entries };
}
