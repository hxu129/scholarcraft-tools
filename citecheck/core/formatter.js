/**
 * CiteCheck Pro — Citation Formatters & Multi-Format Audit Report Exporters
 *
 * Generates:
 *   - Upgraded / repaired BibTeX (preserving citation key)
 *   - GB/T 7714-2015 formatted citations (Chinese & English authors)
 *   - APA 7th Edition formatted citations
 *   - Full Audit Reports in Markdown, CSV (UTF-8 BOM), and Printable HTML
 */

import { t } from './i18n.js';
import { VERDICTS } from './verifier.js';

function isCjk(text) {
  return /[\u4e00-\u9fff]/.test(String(text || ''));
}

/**
 * Pick the best authoritative metadata object for formatting a citation.
 */
function pickCitationRecord(result) {
  const entry = result.entry || {};
  const canon = result.upgradedMetadata || result.canonical || null;
  const useCanonical = Boolean(
    canon &&
      result.verdict !== VERDICTS.SUSPECT_HALLUCINATION &&
      result.verdict !== VERDICTS.API_ERROR,
  );

  if (!useCanonical) {
    return {
      key: entry.key || `ref_${entry.index || 1}`,
      bibType: entry.type || 'misc',
      title: entry.title || '',
      authors: entry.authors || [],
      year: entry.year || '',
      venue: entry.venue || (entry.arxivId ? `arXiv preprint arXiv:${entry.arxivId}` : ''),
      doi: entry.doi || '',
      volume: entry.volume || '',
      number: entry.number || '',
      pages: entry.pages || '',
      publisher: entry.publisher || '',
      url: entry.url || (entry.doi ? `https://doi.org/${entry.doi}` : ''),
      isCanonical: false,
    };
  }

  return {
    key: entry.key || `ref_${entry.index || 1}`,
    bibType: canon.bibType || entry.type || 'article',
    title: canon.cleanTitle || entry.title || '',
    authors: canon.authors?.length ? canon.authors : entry.authors || [],
    year: canon.year || entry.year || '',
    venue: canon.venue || entry.venue || '',
    doi: canon.doi || entry.doi || '',
    volume: canon.volume || entry.volume || '',
    number: canon.number || entry.number || '',
    pages: canon.pages || entry.pages || '',
    publisher: canon.publisher || entry.publisher || '',
    url: canon.url || (canon.doi ? `https://doi.org/${canon.doi}` : entry.url || ''),
    isCanonical: true,
  };
}

function parseAuthorNameParts(author) {
  const raw = String(author || '').trim();
  if (!raw) return { isCjk: false, family: '', given: [] };
  if (isCjk(raw)) {
    return { isCjk: true, family: raw.replace(/\s+/g, ''), given: [] };
  }

  if (raw.includes(',')) {
    const [fam, rest = ''] = raw.split(',');
    return {
      isCjk: false,
      family: fam.trim(),
      given: rest
        .trim()
        .split(/[\s.]+/)
        .filter(Boolean),
    };
  }

  const tokens = raw.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    return { isCjk: false, family: tokens[0], given: [] };
  }

  // Handle "VASWANI A" style
  const trailing = tokens.slice(1);
  if (trailing.every((tok) => /^[A-Z]\.?$/.test(tok)) && tokens[0].length > 2) {
    return {
      isCjk: false,
      family: tokens[0],
      given: trailing.map((x) => x.replace(/\.$/, '')),
    };
  }

  return {
    isCjk: false,
    family: tokens[tokens.length - 1],
    given: tokens.slice(0, -1),
  };
}

function escapeBibValue(val) {
  return String(val || '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatBibAuthor(author) {
  const parts = parseAuthorNameParts(author);
  if (parts.isCjk || parts.given.length === 0) return parts.family;
  return `${parts.family}, ${parts.given.join(' ')}`;
}

/**
 * Generate a clean upgraded/repaired BibTeX entry preserving the original citation key.
 */
export function formatBibTeX(result) {
  const rec = pickCitationRecord(result);
  const lines = [];

  if (result.verdict === VERDICTS.RETRACTED) {
    lines.push(`% WARNING: RETRACTED PAPER — verify before citing (${result.retractionReasons?.join('; ') || 'Retracted'})`);
  } else if (result.verdict === VERDICTS.SUSPECT_HALLUCINATION) {
    lines.push('% WARNING: SUSPECT HALLUCINATION — no authoritative match found');
  } else if (result.verdict === VERDICTS.ARXIV_PUBLISHED) {
    lines.push('% Upgraded from arXiv/preprint to formal published venue by CiteCheck Pro');
  }

  const bibType = rec.bibType || 'article';
  lines.push(`@${bibType}{${rec.key},`);

  const fieldRows = [];
  if (rec.title) fieldRows.push(['title', `{${escapeBibValue(rec.title)}}`]);
  if (rec.authors.length > 0) {
    fieldRows.push(['author', `{${rec.authors.map(formatBibAuthor).join(' and ')}}`]);
  }
  if (rec.venue) {
    const venueKey =
      bibType === 'inproceedings' || bibType === 'incollection'
        ? 'booktitle'
        : bibType === 'book'
          ? 'publisher'
          : bibType === 'misc'
            ? 'howpublished'
            : 'journal';
    fieldRows.push([venueKey, `{${escapeBibValue(rec.venue)}}`]);
  }
  if (rec.year) fieldRows.push(['year', `{${rec.year}}`]);
  if (rec.volume) fieldRows.push(['volume', `{${escapeBibValue(rec.volume)}}`]);
  if (rec.number) fieldRows.push(['number', `{${escapeBibValue(rec.number)}}`]);
  if (rec.pages) fieldRows.push(['pages', `{${escapeBibValue(rec.pages)}}`]);
  if (rec.publisher && bibType !== 'book') fieldRows.push(['publisher', `{${escapeBibValue(rec.publisher)}}`]);
  if (rec.doi) fieldRows.push(['doi', `{${escapeBibValue(rec.doi)}}`]);
  if (rec.url && (!rec.doi || !rec.url.includes(rec.doi))) {
    fieldRows.push(['url', `{${escapeBibValue(rec.url)}}`]);
  }

  fieldRows.forEach(([k, v], idx) => {
    const comma = idx < fieldRows.length - 1 ? ',' : '';
    lines.push(`  ${k} = ${v}${comma}`);
  });
  lines.push('}');
  return lines.join('\n');
}

export function formatAllBibTeX(results) {
  const header = [
    '% Generated by CiteCheck Pro',
    `% Timestamp: ${new Date().toISOString()}`,
    `% Entries: ${results.length}`,
    '',
  ].join('\n');
  return header + results.map(formatBibTeX).join('\n\n') + '\n';
}

/**
 * Format a citation in Chinese national standard GB/T 7714-2015.
 */
export function formatGBT7714(result) {
  const rec = pickCitationRecord(result);
  const chineseMode = isCjk(rec.title) || rec.authors.some(isCjk);

  const formattedAuthors = rec.authors.slice(0, 3).map((a) => {
    const p = parseAuthorNameParts(a);
    if (p.isCjk) return p.family;
    const initials = p.given.map((g) => g.charAt(0).toUpperCase()).join(' ');
    return initials ? `${p.family.toUpperCase()} ${initials}` : p.family.toUpperCase();
  });

  let authorBlock = formattedAuthors.join(', ');
  if (rec.authors.length > 3) {
    authorBlock += chineseMode ? ', 等' : ', et al';
  }

  const typeCode =
    rec.bibType === 'inproceedings' || rec.bibType === 'incollection'
      ? 'C'
      : rec.bibType === 'book'
        ? 'M'
        : rec.bibType === 'phdthesis'
          ? 'D'
          : rec.bibType === 'techreport'
            ? 'R'
            : rec.bibType === 'misc'
              ? 'EB/OL'
              : 'J';

  const parts = [];
  if (authorBlock) parts.push(`${authorBlock}.`);
  parts.push(`${rec.title || '(Untitled)'}[${typeCode}].`);

  const pubDetails = [];
  if (rec.venue) pubDetails.push(rec.venue);
  if (rec.year) pubDetails.push(String(rec.year));

  let volPage = '';
  if (rec.volume) {
    volPage += rec.volume;
    if (rec.number) volPage += `(${rec.number})`;
  }
  if (rec.pages) {
    volPage += volPage ? `: ${rec.pages}` : rec.pages;
  }
  if (volPage) pubDetails.push(volPage);

  if (pubDetails.length > 0) {
    const separator = typeCode === 'C' ? '//' : '';
    parts.push(`${separator}${pubDetails.join(', ')}.`);
  }

  if (rec.doi) {
    parts.push(`DOI:${rec.doi}.`);
  } else if (rec.url && typeCode === 'EB/OL') {
    parts.push(`${rec.url}.`);
  }

  return parts.join(' ').replace(/\.\s*\/\//g, '//').replace(/\s+/g, ' ').trim();
}

/**
 * Format a citation in APA 7th Edition.
 */
export function formatAPA7(result) {
  const rec = pickCitationRecord(result);

  const fmtAuthor = (a) => {
    const p = parseAuthorNameParts(a);
    if (p.isCjk || p.given.length === 0) return p.family;
    const initials = p.given.map((g) => `${g.charAt(0).toUpperCase()}.`).join(' ');
    return `${p.family}, ${initials}`;
  };

  let authorBlock = '';
  const n = rec.authors.length;
  if (n === 1) {
    authorBlock = fmtAuthor(rec.authors[0]);
  } else if (n === 2) {
    authorBlock = `${fmtAuthor(rec.authors[0])}, & ${fmtAuthor(rec.authors[1])}`;
  } else if (n > 2 && n <= 20) {
    authorBlock = `${rec.authors.slice(0, -1).map(fmtAuthor).join(', ')}, & ${fmtAuthor(rec.authors[n - 1])}`;
  } else if (n > 20) {
    authorBlock = `${rec.authors.slice(0, 19).map(fmtAuthor).join(', ')}, ... ${fmtAuthor(rec.authors[n - 1])}`;
  }

  const yearBlock = `(${rec.year || 'n.d.'}).`;
  const titleBlock = `${rec.title || '(Untitled)'}.`;

  let venueBlock = '';
  if (rec.venue) {
    venueBlock = rec.venue;
    if (rec.volume) {
      venueBlock += `, ${rec.volume}`;
      if (rec.number) venueBlock += `(${rec.number})`;
    }
    if (rec.pages) {
      venueBlock += `, ${rec.pages}`;
    }
    venueBlock += '.';
  }

  const linkBlock = rec.doi ? `https://doi.org/${rec.doi}` : rec.url || '';
  return [authorBlock, yearBlock, titleBlock, venueBlock, linkBlock]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ---------- Audit Report Exporters (Markdown, CSV, Printable HTML) ---------- */

export function summarizeVerdicts(results) {
  const counts = {
    total: results.length,
    [VERDICTS.VERIFIED]: 0,
    [VERDICTS.RETRACTED]: 0,
    [VERDICTS.ARXIV_PUBLISHED]: 0,
    [VERDICTS.METADATA_MISMATCH]: 0,
    [VERDICTS.SUSPECT_HALLUCINATION]: 0,
    [VERDICTS.API_ERROR]: 0,
  };
  for (const r of results) {
    if (counts[r.verdict] !== undefined) counts[r.verdict]++;
  }
  return counts;
}

const VERDICT_EMOJI = {
  [VERDICTS.VERIFIED]: '✅',
  [VERDICTS.RETRACTED]: '🚨',
  [VERDICTS.ARXIV_PUBLISHED]: '⬆️',
  [VERDICTS.METADATA_MISMATCH]: '⚠️',
  [VERDICTS.SUSPECT_HALLUCINATION]: '❌',
  [VERDICTS.API_ERROR]: '🔌',
};

export function exportMarkdownReport(results, options = {}) {
  const lang = options.lang || 'zh';
  const counts = summarizeVerdicts(results);
  const now = new Date().toISOString();

  const lines = [
    `# ${t(lang, 'reportTitle')}`,
    '',
    `- **${t(lang, 'reportGeneratedAt')}**: \`${now}\``,
    `- **${t(lang, 'reportTotal')}**: ${counts.total}`,
    '',
    `## ${t(lang, 'reportSummary')}`,
    '',
    `| Status | Count |`,
    `| --- | ---: |`,
  ];

  for (const v of Object.values(VERDICTS)) {
    lines.push(`| ${VERDICT_EMOJI[v]} ${t(lang, `verdict.${v}`)} (\`${v}\`) | ${counts[v]} |`);
  }

  lines.push('', `## ${t(lang, 'reportDetails')}`, '');

  results.forEach((r, idx) => {
    const title = r.entry?.title || r.canonical?.cleanTitle || `(Entry #${idx + 1})`;
    const key = r.entry?.key || `ref_${idx + 1}`;
    lines.push(`### ${idx + 1}. ${VERDICT_EMOJI[r.verdict] || ''} [${t(lang, `verdict.${r.verdict}`)}] ${title}`);
    lines.push('');
    lines.push(`- **Key**: \`${key}\``);
    lines.push(`- **Verdict**: \`${r.verdict}\` (${Math.round((r.confidence || 0) * 100)}%)`);
    if (r.canonical) {
      lines.push(`- **${t(lang, 'cardCanonicalTitle')}**: ${r.canonical.cleanTitle} (${r.canonical.year || 'n.d.'}) — *${r.canonical.venue || 'N/A'}*`);
      if (r.canonical.doi) lines.push(`- **DOI**: https://doi.org/${r.canonical.doi}`);
      if (r.canonical.sources?.length) lines.push(`- **${t(lang, 'cardSourcesLabel')}**: ${r.canonical.sources.join(', ')}`);
    }
    if (r.retractionReasons?.length) {
      lines.push(`- **Retraction Evidence**: ${r.retractionReasons.join('; ')}`);
    }
    if (r.diffs?.length) {
      lines.push(`- **${t(lang, 'cardDiffTitle')}**:`);
      for (const d of r.diffs) {
        lines.push(`  - **${t(lang, `diffField.${d.field}`)}**: \`${d.input}\` → \`${d.canonical}\``);
      }
    }
    if (r.verdict === VERDICTS.ARXIV_PUBLISHED || r.verdict === VERDICTS.METADATA_MISMATCH) {
      lines.push('', `<details><summary>${t(lang, 'reportSuggestedBib')}</summary>`, '', '```bibtex', formatBibTeX(r), '```', '', '</details>');
    }
    lines.push('');
  });

  return lines.join('\n');
}

function csvEscape(val) {
  const s = String(val ?? '');
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportCsvReport(results) {
  const headers = [
    'Index',
    'Key',
    'Verdict',
    'Confidence',
    'Input_Title',
    'Input_Authors',
    'Input_Year',
    'Input_Venue',
    'Input_DOI',
    'Canonical_Title',
    'Canonical_Authors',
    'Canonical_Year',
    'Canonical_Venue',
    'Canonical_DOI',
    'Sources',
    'Diffs',
    'Retraction_Evidence',
    'GBT_7714',
    'APA_7',
  ];

  const rows = [headers.map(csvEscape).join(',')];
  results.forEach((r, idx) => {
    const e = r.entry || {};
    const c = r.upgradedMetadata || r.canonical || {};
    const diffText = (r.diffs || []).map((d) => `${d.field}: ${d.input} -> ${d.canonical}`).join(' | ');
    const row = [
      idx + 1,
      e.key || '',
      r.verdict,
      r.confidence ?? '',
      e.title || '',
      (e.authors || []).join('; '),
      e.year ?? '',
      e.venue || '',
      e.doi || '',
      c.cleanTitle || '',
      (c.authors || []).join('; '),
      c.year ?? '',
      c.venue || '',
      c.doi || '',
      (c.sources || []).join('; '),
      diffText,
      (r.retractionReasons || []).join('; '),
      formatGBT7714(r),
      formatAPA7(r),
    ];
    rows.push(row.map(csvEscape).join(','));
  });

  // Prepend UTF-8 BOM for clean Chinese rendering in Excel
  return '\uFEFF' + rows.join('\r\n') + '\r\n';
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const HTML_BADGE_COLORS = {
  [VERDICTS.VERIFIED]: { fg: '#0F766E', bg: '#ECFDF5', border: '#A7F3D0' },
  [VERDICTS.RETRACTED]: { fg: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
  [VERDICTS.ARXIV_PUBLISHED]: { fg: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  [VERDICTS.METADATA_MISMATCH]: { fg: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  [VERDICTS.SUSPECT_HALLUCINATION]: { fg: '#9F1239', bg: '#FFF1F2', border: '#FECDD3' },
  [VERDICTS.API_ERROR]: { fg: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
};

export function exportHtmlReport(results, options = {}) {
  const lang = options.lang || 'zh';
  const counts = summarizeVerdicts(results);
  const generated = new Date().toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US');

  const summaryCards = Object.values(VERDICTS)
    .map((v) => {
      const c = HTML_BADGE_COLORS[v];
      return `<div class="stat" style="border-color:${c.border};background:${c.bg};color:${c.fg}">
        <div class="stat-num">${counts[v]}</div>
        <div class="stat-label">${escapeHtml(t(lang, `verdict.${v}`))}</div>
      </div>`;
    })
    .join('');

  const itemBlocks = results
    .map((r, idx) => {
      const c = HTML_BADGE_COLORS[r.verdict] || HTML_BADGE_COLORS[VERDICTS.API_ERROR];
      const e = r.entry || {};
      const canon = r.upgradedMetadata || r.canonical;
      const diffsHtml = (r.diffs || []).length
        ? `<table class="diff-table"><thead><tr><th>Field</th><th>${escapeHtml(t(lang, 'cardInputLabel'))}</th><th>${escapeHtml(t(lang, 'cardVerifiedLabel'))}</th></tr></thead><tbody>${r.diffs
            .map(
              (d) =>
                `<tr><td>${escapeHtml(t(lang, `diffField.${d.field}`))}</td><td>${escapeHtml(d.input)}</td><td>${escapeHtml(d.canonical)}</td></tr>`,
            )
            .join('')}</tbody></table>`
        : '';

      const retractionHtml = r.retractionReasons?.length
        ? `<div class="alert-box"><strong>${escapeHtml(t(lang, 'verdict.RETRACTED'))}:</strong> ${escapeHtml(r.retractionReasons.join('; '))}</div>`
        : '';

      const canonHtml = canon
        ? `<div class="meta-line"><strong>${escapeHtml(t(lang, 'cardCanonicalTitle'))}:</strong> ${escapeHtml(canon.cleanTitle)} (${escapeHtml(canon.year || 'n.d.')}) · <em>${escapeHtml(canon.venue || 'N/A')}</em>${canon.doi ? ` · <a href="https://doi.org/${encodeURIComponent(canon.doi)}">doi:${escapeHtml(canon.doi)}</a>` : ''}</div>`
        : `<div class="meta-line muted">${escapeHtml(t(lang, 'cardNoCanonical'))}</div>`;

      return `<article class="card">
        <div class="card-head">
          <span class="badge" style="color:${c.fg};background:${c.bg};border-color:${c.border}">${escapeHtml(t(lang, `verdict.${r.verdict}`))}</span>
          <span class="key-pill">${escapeHtml(e.key || `ref_${idx + 1}`)}</span>
        </div>
        <h3>${idx + 1}. ${escapeHtml(e.title || canon?.cleanTitle || '(Untitled)')}</h3>
        <div class="meta-line">${escapeHtml((e.authors || []).slice(0, 6).join(', '))}${e.year ? ` (${escapeHtml(e.year)})` : ''}${e.venue ? ` · ${escapeHtml(e.venue)}` : ''}</div>
        ${retractionHtml}
        ${canonHtml}
        ${diffsHtml}
        <details>
          <summary>${escapeHtml(t(lang, 'reportSuggestedBib'))} &amp; GB/T 7714</summary>
          <pre>${escapeHtml(formatBibTeX(r))}</pre>
          <p class="gbt"><strong>GB/T 7714:</strong> ${escapeHtml(formatGBT7714(r))}</p>
        </details>
      </article>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="${lang === 'zh' ? 'zh-CN' : 'en'}">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(t(lang, 'reportTitle'))}</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 32px 24px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Noto Sans SC", sans-serif; background: #F8F6F1; color: #16202A; line-height: 1.55; }
  .wrap { max-width: 960px; margin: 0 auto; }
  header { border-bottom: 2px solid #16202A; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
  h1 { margin: 0; font-family: Georgia, "Songti SC", serif; font-size: 26px; }
  .sub { font-size: 13px; color: #556270; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 24px; }
  .stat { border: 1px solid; border-radius: 10px; padding: 12px; text-align: center; }
  .stat-num { font-size: 24px; font-weight: 700; line-height: 1.1; }
  .stat-label { font-size: 12px; margin-top: 4px; font-weight: 600; }
  .card { background: #FFF; border: 1px solid #E4DFD4; border-radius: 12px; padding: 16px 18px; margin-bottom: 14px; break-inside: avoid; }
  .card-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
  .badge { font-size: 12px; font-weight: 700; padding: 2px 10px; border-radius: 999px; border: 1px solid; }
  .key-pill { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; color: #556270; background: #F3F0E8; padding: 2px 8px; border-radius: 6px; }
  h3 { margin: 0 0 6px; font-size: 16px; }
  .meta-line { font-size: 13px; color: #334155; margin-bottom: 6px; }
  .muted { color: #64748B; }
  .alert-box { background: #FEF2F2; border: 1px solid #FECACA; color: #991B1B; padding: 8px 12px; border-radius: 8px; font-size: 13px; margin: 8px 0; }
  .diff-table { width: 100%; border-collapse: collapse; font-size: 12.5px; margin: 10px 0; }
  .diff-table th, .diff-table td { border: 1px solid #E4DFD4; padding: 6px 8px; text-align: left; vertical-align: top; }
  .diff-table th { background: #F8F6F1; }
  details { margin-top: 8px; font-size: 12.5px; }
  summary { cursor: pointer; font-weight: 600; color: #1D4ED8; }
  pre { background: #16202A; color: #F8FAFC; padding: 12px; border-radius: 8px; overflow-x: auto; font-size: 12px; line-height: 1.45; }
  .gbt { font-size: 12.5px; color: #334155; }
  footer { margin-top: 28px; font-size: 12px; color: #64748B; text-align: center; }
  @media print {
    body { background: #FFF; padding: 0; }
    .card { box-shadow: none; }
  }
</style>
</head>
<body>
  <div class="wrap">
    <header>
      <div>
        <h1>${escapeHtml(t(lang, 'reportTitle'))}</h1>
        <div class="sub">${escapeHtml(t(lang, 'appTagline'))}</div>
      </div>
      <div class="sub">${escapeHtml(t(lang, 'reportGeneratedAt'))}: ${escapeHtml(generated)} · ${escapeHtml(t(lang, 'reportTotal'))}: ${counts.total}</div>
    </header>
    <section class="stats">${summaryCards}</section>
    <main>${itemBlocks}</main>
    <footer>${escapeHtml(t(lang, 'privacyNote'))}</footer>
  </div>
</body>
</html>`;
}
