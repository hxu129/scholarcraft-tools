/**
 * CiteCheck Pro — Real-Time Scholarly Verification Engine
 *
 * Queries free zero-auth scholarly APIs directly via native `fetch`:
 *   1. OpenAlex (works by DOI / arXiv / title search; checks `is_retracted`, `locations`)
 *   2. Crossref (works by DOI / title search; checks `updated-by` / `relation` / `update-to` retractions)
 *   3. DBLP (CS/ML conference & journal publication search with graceful bot-gate fallback)
 *
 * Verdicts:
 *   - VERIFIED
 *   - RETRACTED
 *   - ARXIV_PUBLISHED
 *   - METADATA_MISMATCH
 *   - SUSPECT_HALLUCINATION
 *   - API_ERROR
 */

import { API_CONFIG } from './config.js';
import { isPreprintVenueName, normalizeDoi } from './parser.js';

export const VERDICTS = Object.freeze({
  VERIFIED: 'VERIFIED',
  RETRACTED: 'RETRACTED',
  ARXIV_PUBLISHED: 'ARXIV_PUBLISHED',
  METADATA_MISMATCH: 'METADATA_MISMATCH',
  SUSPECT_HALLUCINATION: 'SUSPECT_HALLUCINATION',
  API_ERROR: 'API_ERROR',
});

const RETRACTION_PREFIX_RE =
  /^(?:\[\s*)?(?:retracted(?:\s+article)?|withdrawn(?:\s+article)?)(?:\s*\])?\s*[:\-–—]\s*/i;

const RETRACTION_NOTICE_RE =
  /^(?:retraction(?:\s+(?:notice|note|statement|of))?|notice\s+of\s+retraction|withdrawal\s+notice|erratum|corrigendum|expression\s+of\s+concern|comment\s+on|reply\s+to)\b/i;

const STOP_WORDS = new Set(['a', 'an', 'the', 'of', 'for', 'in', 'on', 'to', 'and', 'with', 'by', 'from', 'at', 'as', 'is', 'are']);

/* ---------- Text Normalization, Similarity & Author Comparison ---------- */

export function stripRetractionPrefix(title) {
  if (!title) return { clean: '', hadRetractedPrefix: false };
  const s = String(title).trim();
  const hadRetractedPrefix = RETRACTION_PREFIX_RE.test(s);
  const clean = hadRetractedPrefix ? s.replace(RETRACTION_PREFIX_RE, '').trim() : s;
  return { clean, hadRetractedPrefix };
}

export function isRetractionOrNoticeTitle(title) {
  if (!title) return false;
  return RETRACTION_NOTICE_RE.test(String(title).trim());
}

export function normalizeTitle(title) {
  if (!title) return '';
  return String(title)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\u2010-\u2015\-_/\\:;,.'"`!?()[\]{}<>|~@#$%^&*+=]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenizeTitle(title) {
  const norm = normalizeTitle(title);
  if (!norm) return [];
  const rawTokens = norm.split(' ').filter(Boolean);
  const tokens = [];
  for (const tok of rawTokens) {
    // Split continuous CJK runs into individual characters so Chinese titles score accurately
    if (/[\u4e00-\u9fff]/.test(tok)) {
      for (const ch of tok) {
        if (ch.trim()) tokens.push(ch);
      }
    } else {
      tokens.push(tok);
    }
  }
  return tokens;
}

/**
 * Compute calibrated title similarity combining exact match, Jaccard, Dice,
 * content-word overlap, and guarded token containment.
 */
export function computeTitleSimilarity(titleA, titleB) {
  const normA = normalizeTitle(titleA);
  const normB = normalizeTitle(titleB);
  if (!normA || !normB) {
    return { score: 0, exact: false, jaccard: 0, containment: 0, dice: 0 };
  }
  if (normA === normB) {
    return { score: 1, exact: true, jaccard: 1, containment: 1, dice: 1 };
  }

  const tokensA = tokenizeTitle(normA);
  const tokensB = tokenizeTitle(normB);
  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersection = 0;
  for (const tok of setA) {
    if (setB.has(tok)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  const minSize = Math.min(setA.size, setB.size);
  const maxSize = Math.max(setA.size, setB.size);
  const jaccard = union > 0 ? intersection / union : 0;
  const dice = setA.size + setB.size > 0 ? (2 * intersection) / (setA.size + setB.size) : 0;
  const containment = minSize > 0 ? intersection / minSize : 0;

  // Guarded containment bonus for subtitle omissions (e.g. main title matches full title+subtitle)
  const lengthRatio = maxSize > 0 ? minSize / maxSize : 0;
  const subtitleBonus = containment >= 0.95 && minSize >= 4 && lengthRatio >= 0.55;

  // Also check content-word Jaccard to reduce sensitivity to minor stopword diffs
  const contentA = new Set(tokensA.filter((t) => !STOP_WORDS.has(t)));
  const contentB = new Set(tokensB.filter((t) => !STOP_WORDS.has(t)));
  let contentInter = 0;
  for (const tok of contentA) {
    if (contentB.has(tok)) contentInter++;
  }
  const contentUnion = contentA.size + contentB.size - contentInter;
  const contentJaccard = contentUnion > 0 ? contentInter / contentUnion : jaccard;

  let score = 0.45 * jaccard + 0.35 * dice + 0.2 * contentJaccard;
  if (subtitleBonus) {
    score = Math.max(score, 0.86 * containment);
  }

  return {
    score: Number(Math.min(1, score).toFixed(4)),
    exact: false,
    jaccard: Number(jaccard.toFixed(4)),
    containment: Number(containment.toFixed(4)),
    dice: Number(dice.toFixed(4)),
  };
}

/**
 * Extract normalized author surname for cross-database matching.
 * Handles "Last, First", "First Middle Last", "VASWANI A", particles, accents, and CJK names.
 */
export function extractSurname(authorName) {
  if (!authorName) return '';
  const cleaned = String(authorName)
    .replace(/\b(?:jr\.?|sr\.?|iii|ii|iv|phd|md)\b/gi, '')
    .trim();
  if (!cleaned) return '';

  // Chinese / CJK full name: keep exact characters
  if (/^[\u4e00-\u9fff\s·]+$/.test(cleaned)) {
    return cleaned.replace(/\s+/g, '');
  }

  let surname = '';
  if (cleaned.includes(',')) {
    surname = cleaned.split(',')[0].trim();
  } else {
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      surname = parts[0];
    } else {
      // Detect GB/T style "VASWANI A" or "HE K M" (surname first, trailing initials)
      const trailingTokens = parts.slice(1);
      const trailingAreInitials = trailingTokens.every((p) => /^[A-Z]\.?$/i.test(p) || /^[A-Z]{1,2}$/.test(p));
      if (trailingAreInitials && parts[0].length > 2) {
        surname = parts[0];
      } else {
        surname = parts[parts.length - 1];
      }
    }
  }

  return surname
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ł/gi, 'l')
    .replace(/ø/gi, 'o')
    .replace(/ß/g, 'ss')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
}

/**
 * Compare input author list against candidate author list by normalized surname.
 */
export function compareAuthors(inputAuthors = [], candidateAuthors = []) {
  const inSurnames = inputAuthors.map(extractSurname).filter(Boolean);
  const candSurnames = candidateAuthors.map(extractSurname).filter(Boolean);

  if (inSurnames.length === 0 || candSurnames.length === 0) {
    return {
      hasInputAuthors: inSurnames.length > 0,
      hasCandidateAuthors: candSurnames.length > 0,
      matchedCount: 0,
      overlapRatio: 0,
      firstAuthorMatch: false,
      inSurnames,
      candSurnames,
    };
  }

  const candSet = new Set(candSurnames);
  const uniqueIn = [...new Set(inSurnames)];
  let matchedCount = 0;
  for (const s of uniqueIn) {
    if (candSet.has(s)) {
      matchedCount++;
    } else if (s.length >= 4 && candSurnames.some((c) => c.endsWith(s) || s.endsWith(c))) {
      // Handles compound surnames like "van der Waals" vs "Waals"
      matchedCount++;
    }
  }

  const firstIn = inSurnames[0];
  const firstCand = candSurnames[0];
  const firstAuthorMatch =
    firstIn === firstCand ||
    (firstIn.length >= 4 && firstCand.length >= 4 && (firstCand.endsWith(firstIn) || firstIn.endsWith(firstCand)));

  const denom = Math.min(uniqueIn.length, Math.max(1, candSet.size));
  const overlapRatio = Number((matchedCount / denom).toFixed(4));

  return {
    hasInputAuthors: true,
    hasCandidateAuthors: true,
    matchedCount,
    overlapRatio,
    firstAuthorMatch,
    inSurnames,
    candSurnames,
  };
}

function cleanVenueDisplayName(name) {
  if (!name) return '';
  let v = String(name).replace(/\s+/g, ' ').trim();
  // Deduplicate OpenAlex doubled venue names like "Foo - Foo"
  const halfSep = v.indexOf(' - ');
  if (halfSep > 10) {
    const left = v.slice(0, halfSep).trim();
    const right = v.slice(halfSep + 3).trim();
    if (left.toLowerCase() === right.toLowerCase()) {
      v = left;
    }
  }
  // Normalize all-lowercase OpenAlex venue strings like "neural information processing systems"
  if (v.length > 4 && v === v.toLowerCase() && /[a-z]/.test(v)) {
    const small = new Set(['of', 'in', 'on', 'and', 'for', 'the', 'to', 'at', 'by', 'with']);
    v = v
      .split(' ')
      .map((w, idx) => (idx > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(' ');
  }
  return v;
}

/* ---------- Polite Resilient HTTP Client ---------- */

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function fetchJsonPolite(url, options = {}) {
  const fetchFn = options.fetchImpl || globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? API_CONFIG.timeoutMs;
  const maxRetries = options.maxRetries ?? API_CONFIG.maxRetries;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? API_CONFIG.retryBaseDelayMs;
  const externalSignal = options.signal;

  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (externalSignal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const controller = new AbortController();
    const onExternalAbort = () => controller.abort();
    externalSignal?.addEventListener('abort', onExternalAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchFn(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(options.headers || {}),
        },
        signal: controller.signal,
      });

      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onExternalAbort);

      if (response.status === 404) {
        return { status: 'not_found', httpStatus: 404, data: null };
      }

      if (response.status === 429 || (response.status >= 500 && response.status <= 599)) {
        lastError = new Error(`HTTP ${response.status}`);
        if (attempt < maxRetries) {
          const retryAfter = Number(response.headers?.get?.('retry-after'));
          const delay = Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.min(retryAfter * 1000, 4000)
            : retryBaseDelayMs * Math.pow(2, attempt);
          await sleep(delay, externalSignal);
          continue;
        }
        return { status: 'error', httpStatus: response.status, error: lastError.message, data: null };
      }

      const contentType = (response.headers?.get?.('content-type') || '').toLowerCase();
      // Gracefully detect bot gates or non-JSON pages (e.g. DBLP HTTP 202 HTML challenge)
      if (response.status === 202 || (contentType && !contentType.includes('json'))) {
        return {
          status: 'unavailable',
          httpStatus: response.status,
          error: `Non-JSON response (${response.status} ${contentType})`,
          data: null,
        };
      }

      if (!response.ok) {
        return { status: 'error', httpStatus: response.status, error: `HTTP ${response.status}`, data: null };
      }

      const text = await response.text();
      try {
        const data = JSON.parse(text);
        return { status: 'ok', httpStatus: response.status, data };
      } catch {
        return { status: 'unavailable', httpStatus: response.status, error: 'Invalid JSON payload', data: null };
      }
    } catch (err) {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onExternalAbort);
      if (externalSignal?.aborted) throw err;
      lastError = err;
      if (attempt < maxRetries) {
        await sleep(retryBaseDelayMs * Math.pow(2, attempt), externalSignal);
        continue;
      }
      return {
        status: 'error',
        httpStatus: 0,
        error: err?.name === 'AbortError' ? 'Request timeout' : String(err?.message || err),
        data: null,
      };
    }
  }

  return { status: 'error', httpStatus: 0, error: String(lastError?.message || 'Unknown fetch error'), data: null };
}

/* ---------- Source Adapters: OpenAlex, Crossref, DBLP ---------- */

function parseOpenAlexWork(work) {
  if (!work || !work.id) return null;
  const rawTitle = work.title || work.display_name || '';
  const { clean: cleanTitle, hadRetractedPrefix } = stripRetractionPrefix(rawTitle);
  const doi = normalizeDoi(work.doi || '');
  const isArxivDoi = /^10\.48550\/arxiv\./i.test(doi);

  const authors = (work.authorships || [])
    .map((a) => a?.author?.display_name || a?.raw_author_name || '')
    .filter(Boolean);

  const primarySource = work.primary_location?.source || null;
  const primaryVenue = cleanVenueDisplayName(primarySource?.display_name || '');
  const primaryType = primarySource?.type || '';
  const primaryIsFormal =
    Boolean(primaryVenue) &&
    !isPreprintVenueName(primaryVenue) &&
    ['journal', 'conference', 'book series', 'ebook platform'].includes(primaryType);

  // Inspect all locations to detect when an arXiv preprint has a peer-reviewed published venue
  let formalLocationVenue = '';
  let formalLocationType = '';
  let formalLocationUrl = '';
  for (const loc of work.locations || []) {
    const src = loc?.source;
    if (!src?.display_name) continue;
    const vName = cleanVenueDisplayName(src.display_name);
    if (isPreprintVenueName(vName)) continue;
    if (['journal', 'conference', 'book series'].includes(src.type)) {
      if (loc.is_published || !formalLocationVenue) {
        formalLocationVenue = vName;
        formalLocationType = src.type;
        formalLocationUrl = loc.landing_page_url || '';
        if (loc.is_published) break;
      }
    }
  }

  const effectiveVenue = primaryIsFormal ? primaryVenue : formalLocationVenue || primaryVenue;
  const effectiveSourceType = primaryIsFormal ? primaryType : formalLocationType || primaryType;
  const isFormalPublished = Boolean(primaryIsFormal || formalLocationVenue);

  const biblio = work.biblio || {};
  const pages =
    biblio.first_page && biblio.last_page
      ? `${biblio.first_page}-${biblio.last_page}`
      : biblio.first_page || '';

  const year = typeof work.publication_year === 'number' ? work.publication_year : null;
  const knownYears = year ? [year] : [];

  const isRetracted = Boolean(work.is_retracted === true || hadRetractedPrefix);
  const bibType =
    effectiveSourceType === 'conference' || work.type === 'proceedings-article'
      ? 'inproceedings'
      : work.type === 'book' || work.type === 'monograph'
        ? 'book'
        : isFormalPublished
          ? 'article'
          : 'misc';

  return {
    source: 'OpenAlex',
    sources: ['OpenAlex'],
    id: work.id,
    openalexUrl: work.id,
    dblpUrl: '',
    rawTitle,
    cleanTitle,
    authors,
    year,
    knownYears,
    venue: effectiveVenue,
    doi: isArxivDoi && isFormalPublished ? doi : doi,
    isArxivDoi,
    volume: biblio.volume || '',
    number: biblio.issue || '',
    pages,
    publisher: primarySource?.host_organization_name || '',
    url: formalLocationUrl || work.primary_location?.landing_page_url || (doi ? `https://doi.org/${doi}` : work.id),
    workType: work.type || '',
    bibType,
    isFormalPublished,
    isRetracted,
    retractionReasons: work.is_retracted ? ['OpenAlex is_retracted=true'] : hadRetractedPrefix ? ['Title prefixed with RETRACTED'] : [],
    citedByCount: work.cited_by_count ?? null,
    isNotice: isRetractionOrNoticeTitle(cleanTitle) || work.type === 'erratum',
  };
}

function extractCrossrefYears(item) {
  const years = new Set();
  for (const field of ['published-print', 'published-online', 'published', 'issued', 'created']) {
    const y = item?.[field]?.['date-parts']?.[0]?.[0];
    if (typeof y === 'number' && y >= 1500 && y <= 2040) {
      years.add(y);
    }
  }
  return [...years];
}

function parseCrossrefWork(item) {
  if (!item || !item.DOI) return null;
  const rawTitle = (Array.isArray(item.title) ? item.title[0] : item.title) || '';
  const { clean: cleanTitle, hadRetractedPrefix } = stripRetractionPrefix(rawTitle);
  const doi = normalizeDoi(item.DOI);
  const isArxivDoi = /^10\.48550\/arxiv\./i.test(doi);

  const authors = (item.author || [])
    .map((a) => {
      if (a.name) return a.name.trim();
      const parts = [a.given, a.family].filter(Boolean);
      return parts.join(' ').trim();
    })
    .filter(Boolean);

  const venue = cleanVenueDisplayName((Array.isArray(item['container-title']) ? item['container-title'][0] : item['container-title']) || '');
  const knownYears = extractCrossrefYears(item);
  const primaryYear =
    item['published-print']?.['date-parts']?.[0]?.[0] ||
    item['published-online']?.['date-parts']?.[0]?.[0] ||
    item.issued?.['date-parts']?.[0]?.[0] ||
    knownYears[0] ||
    null;

  // Check Crossref retraction signals across `updated-by`, `relation`, `update-to`, and title
  const retractionReasons = [];
  if (Array.isArray(item['updated-by'])) {
    for (const upd of item['updated-by']) {
      if (/retract|withdraw/i.test(`${upd.type || ''} ${upd.label || ''}`)) {
        retractionReasons.push(
          `Crossref ${upd.source || 'update'}: ${upd.label || upd.type}${upd.DOI ? ` (${upd.DOI})` : ''}`,
        );
      }
    }
  }
  if (item.relation) {
    for (const relKey of ['is-retracted-by', 'has-retraction']) {
      if (Array.isArray(item.relation[relKey]) && item.relation[relKey].length > 0) {
        retractionReasons.push(`Crossref relation ${relKey}`);
      }
    }
  }
  const isRetractionNoticeItself =
    Array.isArray(item['update-to']) &&
    item['update-to'].some((u) => /retract/i.test(`${u.type || ''} ${u.label || ''}`));
  if (hadRetractedPrefix) {
    retractionReasons.push('Title prefixed with RETRACTED');
  }

  const crType = item.type || '';
  const isFormalType = ['journal-article', 'proceedings-article', 'book-chapter', 'book', 'monograph'].includes(crType);
  const isFormalPublished = Boolean(isFormalType && venue && !isPreprintVenueName(venue) && !isArxivDoi);
  const bibType =
    crType === 'proceedings-article'
      ? 'inproceedings'
      : crType === 'book' || crType === 'monograph'
        ? 'book'
        : crType === 'book-chapter'
          ? 'incollection'
          : isFormalPublished
            ? 'article'
            : 'misc';

  return {
    source: 'Crossref',
    sources: ['Crossref'],
    id: `crossref:${doi}`,
    openalexUrl: '',
    dblpUrl: '',
    rawTitle,
    cleanTitle,
    authors,
    year: primaryYear,
    knownYears,
    venue,
    doi,
    isArxivDoi,
    volume: item.volume || '',
    number: item.issue || '',
    pages: item.page || '',
    publisher: item.publisher || '',
    url: item.URL || (doi ? `https://doi.org/${doi}` : ''),
    workType: crType,
    bibType,
    isFormalPublished,
    isRetracted: retractionReasons.length > 0,
    retractionReasons,
    citedByCount: item['is-referenced-by-count'] ?? null,
    isNotice: isRetractionNoticeItself || isRetractionOrNoticeTitle(cleanTitle),
  };
}

function parseDblpHit(hit) {
  const info = hit?.info;
  if (!info?.title) return null;
  const rawTitle = String(info.title).replace(/\.\s*$/, '').trim();
  const { clean: cleanTitle, hadRetractedPrefix } = stripRetractionPrefix(rawTitle);

  const rawAuthorNode = info.authors?.author;
  const authorArray = Array.isArray(rawAuthorNode) ? rawAuthorNode : rawAuthorNode ? [rawAuthorNode] : [];
  const authors = authorArray
    .map((a) => (typeof a === 'string' ? a : a?.text || ''))
    .map((a) => a.replace(/\s+\d{4}$/, '').trim()) // strip DBLP disambiguation digits like "Wei Wang 0001"
    .filter(Boolean);

  const venue = cleanVenueDisplayName(Array.isArray(info.venue) ? info.venue[0] : info.venue || '');
  const year = info.year ? Number(info.year) : null;
  const doi = normalizeDoi(info.doi || '');
  const isArxivDoi = /^10\.48550\/arxiv\./i.test(doi);
  const dblpType = info.type || '';
  const isFormalPublished =
    Boolean(venue) &&
    !isPreprintVenueName(venue) &&
    !/informal/i.test(dblpType);

  const bibType = /conference|workshop/i.test(dblpType)
    ? 'inproceedings'
    : /journal/i.test(dblpType)
      ? 'article'
      : /book/i.test(dblpType)
        ? 'book'
        : isFormalPublished
          ? 'inproceedings'
          : 'misc';

  return {
    source: 'DBLP',
    sources: ['DBLP'],
    id: info.key || info.url || `dblp:${cleanTitle}`,
    openalexUrl: '',
    dblpUrl: info.url || '',
    rawTitle,
    cleanTitle,
    authors,
    year,
    knownYears: year ? [year] : [],
    venue,
    doi,
    isArxivDoi,
    volume: info.volume || '',
    number: info.number || '',
    pages: info.pages || '',
    publisher: '',
    url: info.ee || info.url || (doi ? `https://doi.org/${doi}` : ''),
    workType: dblpType,
    bibType,
    isFormalPublished,
    isRetracted: hadRetractedPrefix,
    retractionReasons: hadRetractedPrefix ? ['Title prefixed with RETRACTED'] : [],
    citedByCount: null,
    isNotice: isRetractionOrNoticeTitle(cleanTitle),
  };
}

async function queryOpenAlexByDoi(doi, options) {
  const polite = options.politeEmail ? `?mailto=${encodeURIComponent(options.politeEmail)}` : '';
  const url = `${API_CONFIG.openalexBaseUrl}/works/https://doi.org/${encodeURIComponent(doi)}${polite}`;
  const res = await fetchJsonPolite(url, options);
  if (res.status === 'ok') {
    const parsed = parseOpenAlexWork(res.data);
    return { status: 'ok', candidates: parsed ? [parsed] : [] };
  }
  return { status: res.status, error: res.error, candidates: [] };
}

async function queryOpenAlexByTitle(title, options) {
  const params = new URLSearchParams({
    search: title,
    'per-page': '5',
  });
  if (options.politeEmail) params.set('mailto', options.politeEmail);
  const url = `${API_CONFIG.openalexBaseUrl}/works?${params.toString()}`;
  const res = await fetchJsonPolite(url, options);
  if (res.status === 'ok') {
    const candidates = (res.data?.results || []).map(parseOpenAlexWork).filter(Boolean);
    return { status: 'ok', candidates };
  }
  return { status: res.status, error: res.error, candidates: [] };
}

async function queryCrossrefByDoi(doi, options) {
  const polite = options.politeEmail ? `?mailto=${encodeURIComponent(options.politeEmail)}` : '';
  const url = `${API_CONFIG.crossrefBaseUrl}/works/${encodeURIComponent(doi)}${polite}`;
  const res = await fetchJsonPolite(url, options);
  if (res.status === 'ok') {
    const parsed = parseCrossrefWork(res.data?.message);
    return { status: 'ok', candidates: parsed ? [parsed] : [] };
  }
  return { status: res.status, error: res.error, candidates: [] };
}

async function queryCrossrefByTitle(title, firstAuthorSurname, options) {
  const params = new URLSearchParams({
    'query.title': title,
    rows: '5',
  });
  if (firstAuthorSurname && /^[a-z]+$/i.test(firstAuthorSurname)) {
    params.set('query.author', firstAuthorSurname);
  }
  if (options.politeEmail) params.set('mailto', options.politeEmail);
  const url = `${API_CONFIG.crossrefBaseUrl}/works?${params.toString()}`;
  const res = await fetchJsonPolite(url, options);
  if (res.status === 'ok') {
    const candidates = (res.data?.message?.items || []).map(parseCrossrefWork).filter(Boolean);
    return { status: 'ok', candidates };
  }
  return { status: res.status, error: res.error, candidates: [] };
}

async function queryDblpByTitle(title, options) {
  const params = new URLSearchParams({
    q: title,
    h: '5',
    format: 'json',
  });
  const url = `${API_CONFIG.dblpBaseUrl}?${params.toString()}`;
  const res = await fetchJsonPolite(url, options);
  if (res.status === 'ok') {
    const rawHits = res.data?.result?.hits?.hit;
    const hitArray = Array.isArray(rawHits) ? rawHits : rawHits ? [rawHits] : [];
    const candidates = hitArray.map(parseDblpHit).filter(Boolean);
    return { status: 'ok', candidates };
  }
  return { status: res.status, error: res.error, candidates: [] };
}

/* ---------- Candidate Merging, Scoring & Verdict Synthesis ---------- */

function mergeCandidates(candidates) {
  const byKey = new Map();

  for (const cand of candidates) {
    const doiKey = cand.doi ? `doi:${cand.doi.toLowerCase()}` : '';
    const titleKey = `t:${normalizeTitle(cand.cleanTitle)}|y:${cand.year || ''}|f:${cand.isFormalPublished ? 1 : 0}`;
    const key = doiKey || titleKey;

    if (!byKey.has(key)) {
      byKey.set(key, {
        ...cand,
        sources: [...new Set(cand.sources)],
        knownYears: [...new Set(cand.knownYears)],
        retractionReasons: [...new Set(cand.retractionReasons)],
      });
      continue;
    }

    const existing = byKey.get(key);
    existing.sources = [...new Set([...existing.sources, ...cand.sources])];
    existing.knownYears = [...new Set([...existing.knownYears, ...cand.knownYears])];
    existing.isRetracted = existing.isRetracted || cand.isRetracted;
    existing.retractionReasons = [...new Set([...existing.retractionReasons, ...cand.retractionReasons])];
    existing.isFormalPublished = existing.isFormalPublished || cand.isFormalPublished;
    if (!existing.openalexUrl && cand.openalexUrl) existing.openalexUrl = cand.openalexUrl;
    if (!existing.dblpUrl && cand.dblpUrl) existing.dblpUrl = cand.dblpUrl;
    if (!existing.volume && cand.volume) existing.volume = cand.volume;
    if (!existing.number && cand.number) existing.number = cand.number;
    if (!existing.pages && cand.pages) existing.pages = cand.pages;
    if (!existing.publisher && cand.publisher) existing.publisher = cand.publisher;
    if (cand.authors.length > existing.authors.length) existing.authors = cand.authors;
    if (cand.citedByCount != null && (existing.citedByCount == null || cand.citedByCount > existing.citedByCount)) {
      existing.citedByCount = cand.citedByCount;
    }

    // Prefer Crossref / DBLP cleaner venue name over verbose OpenAlex strings when both are formal
    if (cand.isFormalPublished && cand.venue && !isPreprintVenueName(cand.venue)) {
      const existingWeak =
        !existing.venue ||
        isPreprintVenueName(existing.venue) ||
        (cand.source === 'Crossref' && existing.venue.length > cand.venue.length + 15);
      if (existingWeak) {
        existing.venue = cand.venue;
        existing.bibType = cand.bibType;
      }
    }
    if (!existing.year && cand.year) existing.year = cand.year;
    if (!existing.isNotice && cand.isNotice) {
      // Keep non-notice flag if at least one source isn't a notice
    } else if (existing.isNotice && !cand.isNotice) {
      existing.isNotice = false;
    }
  }

  return [...byKey.values()];
}

function evaluateCandidate(entry, cand) {
  const titleSim = entry.title
    ? computeTitleSimilarity(entry.title, cand.cleanTitle)
    : { score: cand.doi && entry.doi ? 1 : 0, exact: false, jaccard: 0, containment: 0, dice: 0 };
  const authorMatch = compareAuthors(entry.authors, cand.authors);
  const doiExact = Boolean(entry.doi && cand.doi && entry.doi.toLowerCase() === cand.doi.toLowerCase());
  const yearMatch = Boolean(entry.year && cand.knownYears.includes(entry.year));
  const titleTokenCount = tokenizeTitle(entry.title || cand.cleanTitle).length;

  let isCredible = false;
  if (!cand.isNotice || isRetractionOrNoticeTitle(entry.title)) {
    if (doiExact && (!entry.title || titleSim.score >= 0.55)) {
      isCredible = true;
    } else if (titleSim.score >= 0.78) {
      // Guard against posted-content/random clones with completely mismatched authors
      const authorContradiction =
        authorMatch.hasInputAuthors && authorMatch.hasCandidateAuthors && authorMatch.matchedCount === 0;
      if (!authorContradiction) {
        isCredible = true;
      } else if (titleSim.exact && titleTokenCount >= 4 && cand.isFormalPublished && cand.workType !== 'posted-content') {
        // Allow exact formal-venue title matches so wrong-author errors are caught as METADATA_MISMATCH
        isCredible = true;
      }
    } else if (titleSim.score >= 0.68 && (authorMatch.matchedCount >= 2 || (authorMatch.firstAuthorMatch && authorMatch.overlapRatio >= 0.5))) {
      isCredible = true;
    }
  }

  // Composite rank score for choosing the best canonical record among credible matches
  let rankScore = titleSim.score * 100;
  if (authorMatch.hasInputAuthors && authorMatch.hasCandidateAuthors) {
    if (authorMatch.matchedCount > 0) {
      rankScore += 35 + authorMatch.overlapRatio * 20 + (authorMatch.firstAuthorMatch ? 10 : 0);
    } else {
      rankScore -= 50;
    }
  }
  if (cand.isFormalPublished) rankScore += 25;
  if (doiExact && !(entry.isPreprintHint && !cand.isFormalPublished)) rankScore += 20;
  if (yearMatch) rankScore += 8;
  if (cand.sources.length > 1) rankScore += 6;
  if (cand.doi && !cand.isArxivDoi) rankScore += 5;
  if (cand.workType === 'posted-content') rankScore -= 25;

  return {
    candidate: cand,
    titleSim,
    authorMatch,
    doiExact,
    yearMatch,
    isCredible,
    rankScore: Number(rankScore.toFixed(2)),
  };
}

/**
 * Pure verdict synthesizer (exported for deterministic unit testing).
 */
export function synthesizeVerdict(entry, rawCandidates, queryMeta = {}) {
  const merged = mergeCandidates(rawCandidates);
  const evaluated = merged.map((c) => evaluateCandidate(entry, c));
  const credible = evaluated.filter((e) => e.isCredible).sort((a, b) => b.rankScore - a.rankScore);

  const sourcesQueried = queryMeta.sourcesQueried || [];
  const sourceStatuses = queryMeta.sourceStatuses || {};
  const successfulSources = Object.values(sourceStatuses).filter((s) => s === 'ok' || s === 'not_found').length;
  const erroredSources = Object.values(sourceStatuses).filter((s) => s === 'error').length;

  // Never misclassify API outage as verified or hallucinated
  if (credible.length === 0 && successfulSources === 0 && erroredSources > 0) {
    return {
      entry,
      verdict: VERDICTS.API_ERROR,
      confidence: 0,
      canonical: null,
      upgradedMetadata: null,
      diffs: [],
      retractionReasons: [],
      sourcesQueried,
      sourceStatuses,
      error: queryMeta.errorSummary || 'All scholarly API requests failed or timed out',
    };
  }

  // Also check if DOI resolved to a completely different paper while title matched nothing
  if (credible.length === 0) {
    if (queryMeta.doiResolvedDifferentWork) {
      const wrongWork = queryMeta.doiResolvedDifferentWork;
      return {
        entry,
        verdict: VERDICTS.METADATA_MISMATCH,
        confidence: 0.75,
        canonical: wrongWork,
        upgradedMetadata: null,
        diffs: [
          {
            field: 'title',
            input: entry.title,
            canonical: wrongWork.cleanTitle,
            note: 'Input DOI resolves to a different paper',
          },
          {
            field: 'doi',
            input: entry.doi,
            canonical: wrongWork.doi,
            note: 'DOI does not match the cited title',
          },
        ],
        retractionReasons: wrongWork.isRetracted ? wrongWork.retractionReasons : [],
        sourcesQueried,
        sourceStatuses,
      };
    }

    return {
      entry,
      verdict: VERDICTS.SUSPECT_HALLUCINATION,
      confidence: 0.9,
      canonical: null,
      upgradedMetadata: null,
      diffs: [],
      retractionReasons: [],
      sourcesQueried,
      sourceStatuses,
    };
  }

  // Pick the best formal published match if available (especially for arXiv upgrades)
  const publishedCredible = credible.filter(
    (e) => e.candidate.isFormalPublished && (!e.authorMatch.hasInputAuthors || e.authorMatch.matchedCount > 0),
  );
  const bestEval = publishedCredible[0] || credible[0];
  const canonical = bestEval.candidate;

  // Aggregate retraction status across ALL matching records of the same paper
  const retractionReasons = [];
  for (const item of credible) {
    const samePaper =
      item.doiExact ||
      (item.titleSim.score >= 0.85 && (!item.authorMatch.hasInputAuthors || item.authorMatch.matchedCount > 0));
    if (samePaper && item.candidate.isRetracted) {
      retractionReasons.push(...item.candidate.retractionReasons);
    }
  }
  const isRetracted = retractionReasons.length > 0;

  // Collect all valid publication years across matched records (handles print vs online-first)
  const allKnownYears = new Set(canonical.knownYears);
  for (const item of credible) {
    if (item.titleSim.score >= 0.88 && (!item.authorMatch.hasInputAuthors || item.authorMatch.matchedCount > 0)) {
      for (const y of item.candidate.knownYears) allKnownYears.add(y);
    }
  }

  // Compute explicit metadata diffs
  const diffs = [];

  // 1. DOI diff
  if (entry.doi) {
    const inputDoiLower = entry.doi.toLowerCase();
    const isInputArxivDoi = /^10\.48550\/arxiv\./i.test(inputDoiLower);
    const canonDoiLower = (canonical.doi || '').toLowerCase();
    if (queryMeta.doiNotFound) {
      diffs.push({
        field: 'doi',
        input: entry.doi,
        canonical: canonical.doi || '(none)',
        note: 'Cited DOI returned 404 (not found)',
      });
    } else if (canonDoiLower && inputDoiLower !== canonDoiLower && !(entry.isPreprintHint && isInputArxivDoi)) {
      diffs.push({
        field: 'doi',
        input: entry.doi,
        canonical: canonical.doi,
        note: 'Cited DOI differs from canonical DOI',
      });
    }
  }

  // 2. Author diff
  const hasSevereAuthorMismatch =
    bestEval.authorMatch.hasInputAuthors &&
    bestEval.authorMatch.hasCandidateAuthors &&
    (bestEval.authorMatch.matchedCount === 0 ||
      (!bestEval.authorMatch.firstAuthorMatch && bestEval.authorMatch.overlapRatio < 0.34));
  if (hasSevereAuthorMismatch) {
    diffs.push({
      field: 'authors',
      input: entry.authors.slice(0, 4).join(', '),
      canonical: canonical.authors.slice(0, 4).join(', '),
      note: 'Author surnames do not align with canonical record',
    });
  }

  // 3. Title diff (when matched by DOI or partial match with noticeable wording mismatch)
  if (entry.title && bestEval.titleSim.score < 0.86 && !bestEval.titleSim.exact) {
    diffs.push({
      field: 'title',
      input: entry.title,
      canonical: canonical.cleanTitle,
      note: `Title similarity ${Math.round(bestEval.titleSim.score * 100)}%`,
    });
  }

  // 4. Year diff (for non-preprint citations, or if year doesn't match any known year of the paper)
  const isCleanArxivUpgrade = Boolean(
    entry.isPreprintHint &&
      canonical.isFormalPublished &&
      !hasSevereAuthorMismatch &&
      !queryMeta.doiNotFound &&
      diffs.every((d) => d.field !== 'doi' && d.field !== 'title'),
  );

  if (entry.year && canonical.year) {
    const yearInKnown = allKnownYears.has(entry.year);
    if (!yearInKnown && !isCleanArxivUpgrade) {
      diffs.push({
        field: 'year',
        input: String(entry.year),
        canonical: String(canonical.year),
        note: `Cited year ${entry.year} differs from published year ${canonical.year}`,
      });
    }
  }

  // Final verdict priority: RETRACTED > ARXIV_PUBLISHED > METADATA_MISMATCH > VERIFIED
  if (isRetracted) {
    return {
      entry,
      verdict: VERDICTS.RETRACTED,
      confidence: Number(Math.max(0.9, bestEval.titleSim.score).toFixed(2)),
      canonical,
      upgradedMetadata: null,
      diffs,
      retractionReasons: [...new Set(retractionReasons)],
      sourcesQueried,
      sourceStatuses,
    };
  }

  if (isCleanArxivUpgrade) {
    const upgradeDiffs = [
      {
        field: 'venue',
        input: entry.venue || (entry.arxivId ? `arXiv:${entry.arxivId}` : 'Preprint'),
        canonical: canonical.venue,
        note: 'Peer-reviewed published venue available',
      },
    ];
    if (entry.year && canonical.year && entry.year !== canonical.year) {
      upgradeDiffs.push({
        field: 'year',
        input: String(entry.year),
        canonical: String(canonical.year),
        note: 'Published year updated from preprint year',
      });
    }
    if (canonical.doi && (!entry.doi || entry.doi.toLowerCase() !== canonical.doi.toLowerCase())) {
      upgradeDiffs.push({
        field: 'doi',
        input: entry.doi || (entry.arxivId ? `arXiv:${entry.arxivId}` : '(none)'),
        canonical: canonical.doi,
        note: 'Formal publication DOI available',
      });
    }

    return {
      entry,
      verdict: VERDICTS.ARXIV_PUBLISHED,
      confidence: Number(Math.min(0.99, Math.max(0.85, bestEval.titleSim.score)).toFixed(2)),
      canonical,
      upgradedMetadata: canonical,
      diffs: upgradeDiffs,
      retractionReasons: [],
      sourcesQueried,
      sourceStatuses,
    };
  }

  if (diffs.length > 0) {
    return {
      entry,
      verdict: VERDICTS.METADATA_MISMATCH,
      confidence: Number(Math.max(0.75, bestEval.titleSim.score).toFixed(2)),
      canonical,
      upgradedMetadata: null,
      diffs,
      retractionReasons: [],
      sourcesQueried,
      sourceStatuses,
    };
  }

  return {
    entry,
    verdict: VERDICTS.VERIFIED,
    confidence: Number(Math.min(0.99, Math.max(0.85, bestEval.titleSim.score || 0.95)).toFixed(2)),
    canonical,
    upgradedMetadata: null,
    diffs: [],
    retractionReasons: [],
    sourcesQueried,
    sourceStatuses,
  };
}

/* ---------- Live Verification Orchestrator ---------- */

/**
 * Verify a single parsed reference entry against OpenAlex, Crossref, and DBLP.
 */
export async function verifyReference(entry, options = {}) {
  const reqOpts = {
    fetchImpl: options.fetchImpl || globalThis.fetch,
    timeoutMs: options.timeoutMs ?? API_CONFIG.timeoutMs,
    maxRetries: options.maxRetries ?? API_CONFIG.maxRetries,
    retryBaseDelayMs: options.retryBaseDelayMs ?? API_CONFIG.retryBaseDelayMs,
    politeEmail: options.politeEmail ?? API_CONFIG.politeEmail,
    signal: options.signal,
  };

  const candidates = [];
  const sourceStatuses = {};
  const sourcesQueried = new Set();
  const errors = [];

  let doiNotFound = false;
  let doiResolvedDifferentWork = null;
  let resolvedTitle = entry.title || '';

  // Stage 1: Direct DOI lookup (OpenAlex + Crossref in parallel)
  if (entry.doi) {
    sourcesQueried.add('OpenAlex');
    sourcesQueried.add('Crossref');
    const [oaDoi, crDoi] = await Promise.all([
      queryOpenAlexByDoi(entry.doi, reqOpts),
      queryCrossrefByDoi(entry.doi, reqOpts),
    ]);

    sourceStatuses['OpenAlex(DOI)'] = oaDoi.status;
    sourceStatuses['Crossref(DOI)'] = crDoi.status;
    if (oaDoi.error) errors.push(`OpenAlex: ${oaDoi.error}`);
    if (crDoi.error) errors.push(`Crossref: ${crDoi.error}`);

    const doiCandidates = [...oaDoi.candidates, ...crDoi.candidates];
    if (doiCandidates.length === 0 && oaDoi.status === 'not_found' && crDoi.status === 'not_found') {
      doiNotFound = true;
    } else if (doiCandidates.length > 0) {
      for (const c of doiCandidates) {
        if (!resolvedTitle && c.cleanTitle) resolvedTitle = c.cleanTitle;
        if (entry.title) {
          const sim = computeTitleSimilarity(entry.title, c.cleanTitle);
          if (sim.score < 0.55) {
            doiResolvedDifferentWork = doiResolvedDifferentWork || c;
          } else {
            candidates.push(c);
          }
        } else {
          candidates.push(c);
        }
      }
    }
  }

  // Stage 1b: If arXiv ID is present with no title, resolve via OpenAlex arXiv DOI first
  if (!resolvedTitle && entry.arxivId) {
    sourcesQueried.add('OpenAlex');
    const oaArxiv = await queryOpenAlexByDoi(`10.48550/arxiv.${entry.arxivId}`, reqOpts);
    sourceStatuses['OpenAlex(arXiv)'] = oaArxiv.status;
    if (oaArxiv.candidates.length > 0) {
      candidates.push(...oaArxiv.candidates);
      resolvedTitle = oaArxiv.candidates[0].cleanTitle || '';
    }
  }

  // Stage 2: Title search across OpenAlex, Crossref, and DBLP
  // Run when: no DOI match yet, OR DOI was 404/mismatched, OR entry is a preprint (search for published version!)
  const needTitleSearch =
    Boolean(resolvedTitle) &&
    (candidates.length === 0 || doiNotFound || Boolean(doiResolvedDifferentWork) || entry.isPreprintHint);

  if (needTitleSearch) {
    const firstSurname = entry.authors?.length ? extractSurname(entry.authors[0]) : '';
    sourcesQueried.add('OpenAlex');
    sourcesQueried.add('Crossref');
    sourcesQueried.add('DBLP');

    const [oaTitle, crTitle, dblpTitle] = await Promise.all([
      queryOpenAlexByTitle(resolvedTitle, reqOpts),
      queryCrossrefByTitle(resolvedTitle, firstSurname, reqOpts),
      queryDblpByTitle(resolvedTitle, reqOpts),
    ]);

    sourceStatuses['OpenAlex(Search)'] = oaTitle.status;
    sourceStatuses['Crossref(Search)'] = crTitle.status;
    sourceStatuses['DBLP(Search)'] = dblpTitle.status;
    if (oaTitle.error) errors.push(`OpenAlex: ${oaTitle.error}`);
    if (crTitle.error) errors.push(`Crossref: ${crTitle.error}`);
    if (dblpTitle.status === 'error' && dblpTitle.error) errors.push(`DBLP: ${dblpTitle.error}`);

    candidates.push(...oaTitle.candidates, ...crTitle.candidates, ...dblpTitle.candidates);
  }

  return synthesizeVerdict(entry, candidates, {
    sourcesQueried: [...sourcesQueried],
    sourceStatuses,
    doiNotFound,
    doiResolvedDifferentWork,
    errorSummary: errors.join('; '),
  });
}

/**
 * Verify an array of parsed references with polite bounded concurrency (default 3).
 */
export async function verifyReferences(entries, options = {}) {
  const concurrency = Math.max(1, Math.min(6, options.concurrency ?? API_CONFIG.concurrency));
  const results = new Array(entries.length);
  let nextIndex = 0;
  let completed = 0;

  async function worker() {
    while (true) {
      if (options.signal?.aborted) break;
      const idx = nextIndex++;
      if (idx >= entries.length) break;

      const entry = entries[idx];
      const result = await verifyReference(entry, options);
      results[idx] = result;
      completed++;

      if (typeof options.onProgress === 'function') {
        options.onProgress({
          completed,
          total: entries.length,
          index: idx,
          entry,
          result,
        });
      }
    }
  }

  const workerCount = Math.min(concurrency, entries.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results.filter(Boolean);
}
