/**
 * GPSRKit Pro — Compliance Document, Label Sheet, Marketplace Copy & Batch ZIP Generators
 *
 * Outputs:
 *   1. 10-Year Archivable Article 9 Technical Documentation & Risk Assessment Dossier (HTML + JSON + SHA-256)
 *   2. Print-Ready Multilingual Product Label Sheets (50x30mm Thermal Roll & A4 2x5 Cut Grid)
 *   3. Amazon Seller Central, Etsy, and Shopify Compliance Copy Pack
 *   4. Pro Batch Multi-SKU CSV -> UTF-8 ZIP Bundle
 */

import { APP_NAME, APP_VERSION, REGULATION_REF } from './config.js';
import {
  CATEGORY_BY_ID,
  evaluateReadiness,
  normalizeProductRecord,
} from './gpsr.js';
import {
  DISCLAIMER_TEXT,
  LABEL_HEADINGS,
  LABEL_LANGUAGE_CODES,
  LABEL_LANGUAGES,
  WARNING_BY_ID,
} from './translations.js';
import { createZipArchive } from './zip.js';

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function sanitizeSlug(str, fallback = 'sku') {
  const cleaned = String(str || '')
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return cleaned || fallback;
}

/**
 * Compute lowercase 64-char SHA-256 hex digest using WebCrypto subtle API.
 */
export async function computeSha256Hex(text) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('WebCrypto subtle API is unavailable for SHA-256 digest.');
  }
  const bytes = new TextEncoder().encode(String(text ?? ''));
  const digest = await subtle.digest('SHA-256', bytes);
  const arr = new Uint8Array(digest);
  let hex = '';
  for (let i = 0; i < arr.length; i++) {
    hex += arr[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function normalizeSelectedLanguages(languages) {
  const input = Array.isArray(languages) && languages.length > 0 ? languages : ['en', 'de'];
  const valid = input.filter((code) => LABEL_LANGUAGE_CODES.includes(code));
  return valid.length > 0 ? [...new Set(valid)] : ['en'];
}

function getRetentionDateIso(generatedAtIso) {
  const dt = new Date(generatedAtIso);
  const valid = !Number.isNaN(dt.getTime()) ? dt : new Date();
  const retention = new Date(valid.getTime());
  retention.setUTCFullYear(retention.getUTCFullYear() + REGULATION_REF.retentionYears);
  return retention.toISOString().slice(0, 10);
}

/**
 * Build the structured 10-year Archivable Technical File JSON payload + SHA-256 fingerprint.
 */
export async function generateTechnicalFileData(recordInput, options = {}) {
  const record = normalizeProductRecord(recordInput);
  const readiness = options.readiness || evaluateReadiness(record);
  const languages = normalizeSelectedLanguages(options.languages || LABEL_LANGUAGE_CODES);
  const generatedAt = options.generatedAt || new Date().toISOString();
  const retentionUntil = getRetentionDateIso(generatedAt);
  const categoryPreset = CATEGORY_BY_ID[record.product.category];
  const documentId = `GPSR-${sanitizeSlug(record.product.sku, 'ITEM').toUpperCase()}-${generatedAt.slice(0, 10).replace(/-/g, '')}`;

  const warningsMultilingual = record.warnings
    .map((id) => WARNING_BY_ID[id])
    .filter(Boolean)
    .map((w) => ({
      id: w.id,
      severity: w.severity,
      title: w.titleEn,
      translations: Object.fromEntries(languages.map((code) => [code, w.text[code]])),
    }));

  const canonicalBody = {
    schemaVersion: 'gpsrkit-art9-v1',
    generator: `${APP_NAME} v${APP_VERSION}`,
    documentId,
    regulation: `${REGULATION_REF.code} (General Product Safety Regulation — Article 9 & Article 16)`,
    generatedAt,
    retentionHorizonYears: REGULATION_REF.retentionYears,
    retainUntilDate: retentionUntil,
    product: {
      ...record.product,
      categoryLabel: categoryPreset?.labelEn || record.product.category,
    },
    manufacturer: { ...record.manufacturer },
    euResponsiblePerson: { ...record.euResponsiblePerson },
    readiness: {
      score: readiness.score,
      maxScore: readiness.maxScore,
      percentage: readiness.percentage,
      status: readiness.status,
      missingItems: readiness.missingItems.map((m) => ({
        id: m.id,
        article: m.article,
        issue: m.issueEn,
      })),
    },
    riskAssessmentMatrix: {
      methodology: '4x4 Qualitative Risk Matrix (Likelihood 1-4 x Severity 1-4: Low 1-3, Medium 4-7, High 8-11, Critical 12-16)',
      applicableHazardCount: readiness.riskSummary.applicableCount,
      maxRiskScore: readiness.riskSummary.maxScore,
      maxRiskLevel: readiness.riskSummary.maxLevel,
      unmitigatedHighRiskCount: readiness.riskSummary.unmitigatedHighRisks.length,
      hazards: readiness.riskSummary.rows.map((row) => ({
        id: row.id,
        dimension: row.nameEn,
        applicable: row.applicable,
        likelihood: row.likelihood,
        severity: row.severity,
        score: row.score,
        level: row.level,
        mitigation: row.mitigation,
        harmonizedStandardsHint: row.standards,
        unmitigatedFlag: row.isUnmitigatedHighRisk,
      })),
    },
    warningsMultilingual,
    customWarning: record.customWarning,
    disclaimer: DISCLAIMER_TEXT.en,
  };

  const canonicalJson = JSON.stringify(canonicalBody, null, 2);
  const sha256 = await computeSha256Hex(canonicalJson);

  const archiveObject = {
    ...canonicalBody,
    integrity: {
      algorithm: 'SHA-256',
      sha256,
      scope: 'Canonical JSON payload prior to integrity block attachment',
    },
  };

  return {
    documentId,
    generatedAt,
    retentionUntil,
    sha256,
    record,
    readiness,
    archiveObject,
    jsonString: JSON.stringify(archiveObject, null, 2),
  };
}

/**
 * Generate the complete Print-to-PDF 10-Year Archivable Article 9 Technical Documentation HTML.
 */
export async function generateTechnicalFileHtml(recordInput, options = {}) {
  const data = await generateTechnicalFileData(recordInput, options);
  const { documentId, generatedAt, retentionUntil, sha256, record, readiness, archiveObject } = data;
  const languages = normalizeSelectedLanguages(options.languages || LABEL_LANGUAGE_CODES);
  const categoryPreset = CATEGORY_BY_ID[record.product.category];

  const levelBadgeStyle = (levelKey) => {
    switch (levelKey) {
      case 'critical':
        return 'background:#FEE2E2;color:#991B1B;border:1px solid #FCA5A5;';
      case 'high':
        return 'background:#FFEDD5;color:#9A3412;border:1px solid #FDBA74;';
      case 'medium':
        return 'background:#FEF3C7;color:#92400E;border:1px solid #FCD34D;';
      case 'low':
        return 'background:#DCFCE7;color:#166534;border:1px solid #86EFAC;';
      default:
        return 'background:#F1F5F9;color:#475569;border:1px solid #CBD5E1;';
    }
  };

  const hazardRowsHtml = readiness.riskSummary.rows
    .map((row, idx) => `
      <tr class="${row.applicable ? '' : 'row-na'}">
        <td class="col-num">${idx + 1}</td>
        <td>
          <strong>${escapeHtml(row.nameEn)}</strong>
          <div class="sub-std">${escapeHtml(row.standards)}</div>
        </td>
        <td class="col-center">${row.applicable ? 'Yes' : 'N/A'}</td>
        <td class="col-center">${row.applicable ? row.likelihood : '—'}</td>
        <td class="col-center">${row.applicable ? row.severity : '—'}</td>
        <td class="col-center">
          <span class="risk-pill" style="${levelBadgeStyle(row.levelKey)}">
            ${row.applicable ? `${row.score} · ${escapeHtml(row.level)}` : 'N/A'}
          </span>
        </td>
        <td>
          ${row.mitigation ? escapeHtml(row.mitigation) : '<span class="muted">—</span>'}
          ${row.isUnmitigatedHighRisk ? '<div class="alert-flag">ACTION REQUIRED: Unmitigated High/Critical Hazard</div>' : ''}
        </td>
      </tr>`)
    .join('');

  const warningRowsHtml = archiveObject.warningsMultilingual.length > 0
    ? archiveObject.warningsMultilingual
        .map((w) => {
          const langCells = languages
            .map((code) => `
              <div class="warn-line">
                <span class="lang-tag">${code.toUpperCase()}</span>
                <span>${escapeHtml(w.translations[code] || '')}</span>
              </div>`)
            .join('');
          return `
            <tr>
              <td style="width:22%"><strong>${escapeHtml(w.title)}</strong><div class="sub-std">${escapeHtml(w.id)}</div></td>
              <td>${langCells}</td>
            </tr>`;
        })
        .join('')
    : `<tr><td colspan="2" class="muted">No standard safety warning phrases selected.</td></tr>`;

  const missingBlockHtml = readiness.missingItems.length > 0
    ? `<div class="missing-box">
        <strong>Open Compliance Gaps Identified (${readiness.missingItems.length}):</strong>
        <ul>
          ${readiness.missingItems.map((m) => `<li><strong>[${escapeHtml(m.article)}]</strong> ${escapeHtml(m.issueEn)}</li>`).join('')}
        </ul>
      </div>`
    : `<div class="ready-box">All 10 structured GPSR Article 9 &amp; Article 16 checklist items are populated (Readiness: ${readiness.percentage}%).</div>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EU GPSR Article 9 Technical File — ${escapeHtml(record.product.sku || record.product.name)}</title>
  <style>
    @page { size: A4; margin: 13mm 14mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0F172A;
      background: #F8FAFC;
      font-size: 11px;
      line-height: 1.48;
    }
    .doc-sheet {
      max-width: 820px;
      margin: 0 auto;
      background: #FFFFFF;
      border: 1px solid #CBD5E1;
      border-radius: 6px;
      padding: 26px 30px;
    }
    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      border-bottom: 2.5px solid #003399;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    .eyebrow {
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #003399;
      margin-bottom: 4px;
    }
    h1 {
      margin: 0 0 4px 0;
      font-size: 18px;
      color: #0F2544;
    }
    .doc-sub { color: #475569; margin: 0; font-size: 11px; }
    .meta-box {
      min-width: 240px;
      background: #F1F5F9;
      border: 1px solid #CBD5E1;
      border-radius: 5px;
      padding: 8px 10px;
      font-size: 10px;
    }
    .meta-row { display: flex; justify-content: space-between; gap: 8px; margin-bottom: 3px; }
    .meta-row:last-child { margin-bottom: 0; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .sha-bar {
      background: #0F2544;
      color: #E2E8F0;
      padding: 7px 11px;
      border-radius: 4px;
      font-size: 9.5px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
      word-break: break-all;
    }
    .sha-bar strong { color: #FDE047; white-space: nowrap; }
    h2 {
      font-size: 12.5px;
      color: #0F2544;
      border-left: 3.5px solid #003399;
      padding-left: 8px;
      margin: 18px 0 8px 0;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .card {
      border: 1px solid #CBD5E1;
      border-radius: 5px;
      padding: 10px 12px;
      background: #FFFFFF;
    }
    .card-title {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #003399;
      margin-bottom: 6px;
      letter-spacing: 0.04em;
    }
    .kv { width: 100%; border-collapse: collapse; }
    .kv td { padding: 3.5px 4px; vertical-align: top; border-bottom: 1px solid #F1F5F9; }
    .kv td:first-child { width: 36%; color: #475569; font-weight: 600; }
    table.matrix {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6px;
      font-size: 10px;
    }
    table.matrix th, table.matrix td {
      border: 1px solid #CBD5E1;
      padding: 5px 6px;
      vertical-align: top;
      text-align: left;
    }
    table.matrix th {
      background: #EFF6FF;
      color: #0F2544;
      font-weight: 700;
    }
    tr.row-na { background: #F8FAFC; color: #64748B; }
    .col-num { width: 24px; text-align: center !important; }
    .col-center { text-align: center !important; white-space: nowrap; }
    .sub-std { font-size: 9px; color: #64748B; margin-top: 2px; }
    .risk-pill {
      display: inline-block;
      padding: 1.5px 6px;
      border-radius: 999px;
      font-weight: 700;
      font-size: 9px;
      white-space: nowrap;
    }
    .alert-flag {
      margin-top: 4px;
      font-size: 9px;
      font-weight: 700;
      color: #B91C1C;
    }
    .ready-box {
      background: #ECFDF5;
      border: 1px solid #6EE7B7;
      color: #065F46;
      padding: 8px 11px;
      border-radius: 5px;
      font-weight: 600;
      margin-bottom: 10px;
    }
    .missing-box {
      background: #FEF2F2;
      border: 1px solid #FCA5A5;
      color: #991B1B;
      padding: 8px 11px;
      border-radius: 5px;
      margin-bottom: 10px;
    }
    .missing-box ul { margin: 4px 0 0 18px; padding: 0; }
    .warn-line { display: flex; gap: 6px; margin-bottom: 3px; align-items: baseline; }
    .warn-line:last-child { margin-bottom: 0; }
    .lang-tag {
      display: inline-block;
      min-width: 24px;
      text-align: center;
      font-size: 8.5px;
      font-weight: 700;
      background: #0F2544;
      color: #FFFFFF;
      border-radius: 3px;
      padding: 1px 3px;
    }
    .custom-note {
      margin-top: 8px;
      padding: 7px 10px;
      background: #FFFBEB;
      border: 1px solid #FDE68A;
      border-radius: 4px;
    }
    .signoff-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-top: 8px;
    }
    .sign-field {
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      padding: 8px 10px;
      min-height: 54px;
    }
    .sign-label { font-size: 9px; color: #64748B; text-transform: uppercase; font-weight: 700; }
    .disclaimer {
      margin-top: 16px;
      padding: 9px 11px;
      background: #F8FAFC;
      border: 1px solid #94A3B8;
      border-radius: 4px;
      font-size: 9.2px;
      color: #334155;
    }
    .muted { color: #94A3B8; }
    @media print {
      body { background: #FFFFFF; padding: 0; }
      .doc-sheet { border: none; padding: 0; max-width: none; }
      h2 { break-after: avoid; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <article class="doc-sheet">
    <header class="doc-header">
      <div>
        <div class="eyebrow">Regulation (EU) 2023/988 (GPSR) · Article 9 Technical Documentation</div>
        <h1>Internal Risk Analysis &amp; Compliance Technical File</h1>
        <p class="doc-sub">${escapeHtml(record.product.name || 'Unnamed Product')} — SKU: <span class="mono">${escapeHtml(record.product.sku || 'N/A')}</span></p>
      </div>
      <div class="meta-box">
        <div class="meta-row"><span>Document ID:</span><strong class="mono">${escapeHtml(documentId)}</strong></div>
        <div class="meta-row"><span>Generated (UTC):</span><span class="mono">${escapeHtml(generatedAt.slice(0, 19).replace('T', ' '))}</span></div>
        <div class="meta-row"><span>10-Year Archive Until:</span><strong class="mono">${escapeHtml(retentionUntil)}</strong></div>
        <div class="meta-row"><span>Readiness Score:</span><strong>${readiness.percentage}% (${escapeHtml(readiness.status.toUpperCase())})</strong></div>
      </div>
    </header>

    <div class="sha-bar">
      <strong>SHA-256 INTEGRITY FINGERPRINT</strong>
      <span class="mono">${escapeHtml(sha256)}</span>
    </div>

    ${missingBlockHtml}

    <h2>1. Product Identification &amp; Traceability (Art. 9(2) &amp; Art. 9(5))</h2>
    <div class="card">
      <table class="kv">
        <tr><td>Product Name</td><td><strong>${escapeHtml(record.product.name || '—')}</strong></td></tr>
        <tr><td>SKU / Model Identifier</td><td class="mono">${escapeHtml(record.product.sku || '—')}</td></tr>
        <tr><td>Batch / Lot / Serial Format</td><td class="mono">${escapeHtml(record.product.batchFormat || '—')}</td></tr>
        <tr><td>EAN / GTIN</td><td class="mono">${escapeHtml(record.product.eanGtin || 'Not provided')}</td></tr>
        <tr><td>Category Preset</td><td>${escapeHtml(categoryPreset?.labelEn || record.product.category)} <span class="muted">(${escapeHtml(categoryPreset?.standardsHint || '')})</span></td></tr>
        <tr><td>Materials &amp; Components</td><td>${escapeHtml(record.product.materials || '—')}</td></tr>
        <tr><td>Intended Use</td><td>${escapeHtml(record.product.intendedUse || '—')}</td></tr>
        <tr><td>Target Users &amp; Vulnerable Groups</td><td>${escapeHtml(record.product.targetUsers || '—')}</td></tr>
      </table>
    </div>

    <h2>2. Economic Operators &amp; EU Contact Points (Art. 9(6) &amp; Art. 16)</h2>
    <div class="grid-2">
      <div class="card">
        <div class="card-title">Manufacturer (Article 9(6))</div>
        <table class="kv">
          <tr><td>Legal Name</td><td><strong>${escapeHtml(record.manufacturer.name || 'MISSING')}</strong></td></tr>
          <tr><td>Trade Name</td><td>${escapeHtml(record.manufacturer.tradeName || '—')}</td></tr>
          <tr><td>Postal Address</td><td>${escapeHtml(record.manufacturer.postalAddress || 'MISSING')}</td></tr>
          <tr><td>Electronic Address</td><td class="mono">${escapeHtml(record.manufacturer.electronicAddress || 'MISSING')}</td></tr>
        </table>
      </div>
      <div class="card">
        <div class="card-title">EU Responsible Person (Article 16 RP)</div>
        <table class="kv">
          <tr><td>EU RP Name</td><td><strong>${escapeHtml(record.euResponsiblePerson.name || 'MISSING')}</strong></td></tr>
          <tr><td>EU Street Address</td><td>${escapeHtml(record.euResponsiblePerson.euAddress || 'MISSING')}</td></tr>
          <tr><td>Electronic Address</td><td class="mono">${escapeHtml(record.euResponsiblePerson.electronicAddress || 'MISSING')}</td></tr>
          <tr><td>Mandate Scope</td><td>EU market surveillance liaison &amp; Art. 16 technical documentation verification</td></tr>
        </table>
      </div>
    </div>

    <h2>3. Internal Risk Assessment Matrix &amp; Mitigation Register (Art. 9(2))</h2>
    <p class="doc-sub" style="margin-bottom:6px;">
      Scoring scale: Likelihood (1–4) × Severity (1–4). Risk Levels: Low (1–3), Medium (4–7), High (8–11), Critical (12–16).
      Active dimensions: <strong>${readiness.riskSummary.applicableCount}/10</strong> · Peak Risk: <strong>${escapeHtml(readiness.riskSummary.maxLevel)} (${readiness.riskSummary.maxScore})</strong>.
    </p>
    <table class="matrix">
      <thead>
        <tr>
          <th class="col-num">#</th>
          <th style="width:25%">Hazard Dimension &amp; Standards Hint</th>
          <th class="col-center">Active</th>
          <th class="col-center">L</th>
          <th class="col-center">S</th>
          <th class="col-center">Score / Level</th>
          <th>Mitigation Measures &amp; Controls</th>
        </tr>
      </thead>
      <tbody>
        ${hazardRowsHtml}
      </tbody>
    </table>

    <h2>4. Multilingual Safety Warnings &amp; Consumer Information (Art. 9(7))</h2>
    <table class="matrix">
      <thead>
        <tr>
          <th>Warning Category</th>
          <th>Verified EU Language Statements (${languages.map((l) => l.toUpperCase()).join(' / ')})</th>
        </tr>
      </thead>
      <tbody>
        ${warningRowsHtml}
      </tbody>
    </table>
    ${record.customWarning ? `<div class="custom-note"><strong>Additional Product-Specific Note:</strong> ${escapeHtml(record.customWarning)}</div>` : ''}

    <h2>5. 10-Year Archival Sign-Off (Article 9(3))</h2>
    <div class="signoff-grid">
      <div class="sign-field"><div class="sign-label">Assessed By (Name &amp; Role)</div></div>
      <div class="sign-field"><div class="sign-label">Signature &amp; Company Stamp</div></div>
      <div class="sign-field"><div class="sign-label">Review Date / Next Revision</div><div style="margin-top:8px;" class="mono">${escapeHtml(generatedAt.slice(0, 10))}</div></div>
    </div>

    <div class="disclaimer">
      ${escapeHtml(DISCLAIMER_TEXT.en)}
    </div>
  </article>
</body>
</html>`;

  return {
    html,
    json: data.jsonString,
    archiveObject,
    sha256,
    documentId,
    generatedAt,
    retentionUntil,
    readiness,
  };
}

const SVG_FACTORY_ICON = `<svg class="ico" viewBox="0 0 16 16" width="10" height="10" aria-hidden="true"><path fill="currentColor" d="M1 14V6l4 2.5V6l4 2.5V3h2v5.5L15 6v8H1zm2-2h2v-1.5H3V12zm3.5 0h2v-1.5h-2V12zm3.5 0h2v-1.5h-2V12z"/></svg>`;
const SVG_EURP_BADGE = `<svg class="ico-rp" viewBox="0 0 28 14" width="22" height="11" aria-hidden="true"><rect x="0.5" y="0.5" width="27" height="13" rx="2" fill="#003399" stroke="#003399"/><text x="14" y="10" text-anchor="middle" font-family="Arial,sans-serif" font-size="7.5" font-weight="700" fill="#FFFFFF">EU RP</text></svg>`;
const SVG_WARN_ICON = `<svg class="ico" viewBox="0 0 16 16" width="10" height="10" aria-hidden="true"><path fill="#B91C1C" d="M8 1.5L15 14H1L8 1.5zm0 4.2a.8.8 0 00-.8.8v3.2a.8.8 0 001.6 0V6.5a.8.8 0 00-.8-.8zm0 6.5a.9.9 0 100-1.8.9.9 0 000 1.8z"/></svg>`;

function renderSingleLabelCard(record, languages, layout) {
  const isThermal = layout === 'thermal_50x30';
  const selectedWarnings = record.warnings
    .map((id) => WARNING_BY_ID[id])
    .filter(Boolean);

  // For 50x30mm thermal stickers, prioritize up to 2–3 warnings using compact `shortText` so content never overflows 30mm height.
  const maxWarnings = isThermal ? (languages.length > 2 ? 1 : 2) : 3;
  const shownWarnings = selectedWarnings.slice(0, maxWarnings);

  const mfrHeading = languages.length <= 2
    ? languages.map((c) => LABEL_HEADINGS.manufacturer[c]).join(' / ')
    : 'Manufacturer / Hersteller / Fabricant';
  const rpHeading = languages.length <= 2
    ? languages.map((c) => LABEL_HEADINGS.eu_rp[c]).join(' / ')
    : 'EU RP / EU-Verantwortliche Person';

  const warningBlocksHtml = shownWarnings.length > 0
    ? shownWarnings
        .map((w) => {
          const lines = languages
            .map((code) => {
              const phrase = isThermal ? w.shortText[code] : w.text[code];
              return `<div class="lbl-wline"><span class="lbl-lang">${code.toUpperCase()}</span><span>${escapeHtml(phrase)}</span></div>`;
            })
            .join('');
          return `<div class="lbl-wgroup">${lines}</div>`;
        })
        .join('')
    : `<div class="lbl-wline"><span class="lbl-lang">INFO</span><span>${escapeHtml(record.customWarning || 'Inspect before use. Follow product instructions.')}</span></div>`;

  const extraCount = selectedWarnings.length - shownWarnings.length;
  const extraHintHtml = extraCount > 0
    ? `<div class="lbl-more">+${extraCount} more safety notice(s) in insert / technical file</div>`
    : '';

  return `
    <div class="label-card ${isThermal ? 'label-thermal' : 'label-a4'}">
      <div class="lbl-top">
        <div class="lbl-title">${escapeHtml(record.product.name || 'Product Name')}</div>
        <div class="lbl-trace">
          <span><strong>SKU:</strong> ${escapeHtml(record.product.sku || 'N/A')}</span>
          <span><strong>LOT:</strong> ${escapeHtml(record.product.batchFormat || 'N/A')}</span>
          ${!isThermal && record.product.eanGtin ? `<span><strong>EAN:</strong> ${escapeHtml(record.product.eanGtin)}</span>` : ''}
        </div>
      </div>

      <div class="lbl-ops">
        <div class="lbl-op">
          <div class="lbl-op-head">${SVG_FACTORY_ICON} <span>${escapeHtml(mfrHeading)}</span></div>
          <div class="lbl-op-body">
            <strong>${escapeHtml(record.manufacturer.name || 'Manufacturer Name')}</strong>
            ${record.manufacturer.postalAddress ? ` · ${escapeHtml(record.manufacturer.postalAddress)}` : ''}
            ${record.manufacturer.electronicAddress ? ` · ${escapeHtml(record.manufacturer.electronicAddress)}` : ''}
          </div>
        </div>
        <div class="lbl-op">
          <div class="lbl-op-head">${SVG_EURP_BADGE} <span>${escapeHtml(rpHeading)}</span></div>
          <div class="lbl-op-body">
            <strong>${escapeHtml(record.euResponsiblePerson.name || 'EU Responsible Person')}</strong>
            ${record.euResponsiblePerson.euAddress ? ` · ${escapeHtml(record.euResponsiblePerson.euAddress)}` : ''}
            ${record.euResponsiblePerson.electronicAddress ? ` · ${escapeHtml(record.euResponsiblePerson.electronicAddress)}` : ''}
          </div>
        </div>
      </div>

      <div class="lbl-warnings">
        <div class="lbl-warn-head">${SVG_WARN_ICON} <span>${languages.map((c) => c.toUpperCase()).join(' · ')}</span></div>
        ${warningBlocksHtml}
        ${extraHintHtml}
      </div>
    </div>`;
}

/**
 * Generate a Print-Ready Multilingual Product Label Sheet HTML.
 * Supports:
 *   - `layout: 'thermal_50x30'` (50mm x 30mm thermal roll label)
 *   - `layout: 'a4_2x5'` (A4 cut sheet, 2 columns x 5 rows = 10 labels)
 */
export function generateLabelSheetHtml(recordInput, options = {}) {
  const record = normalizeProductRecord(recordInput);
  const layout = options.layout === 'thermal_50x30' ? 'thermal_50x30' : 'a4_2x5';
  const languages = normalizeSelectedLanguages(options.languages || ['en', 'de', 'fr', 'es', 'it']);
  const copies = Math.max(1, Math.min(20, Number(options.copies) || (layout === 'thermal_50x30' ? 1 : 10)));

  const cardHtml = renderSingleLabelCard(record, languages, layout);
  const cards = Array.from({ length: copies }, () => cardHtml).join('');
  const langNames = languages
    .map((code) => LABEL_LANGUAGES.find((l) => l.code === code)?.label || code.toUpperCase())
    .join('/');

  const isThermal = layout === 'thermal_50x30';
  const pageRule = isThermal
    ? '@page { size: 50mm 30mm; margin: 0; }'
    : '@page { size: A4; margin: 8mm; }';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EU GPSR Label Sheet (${isThermal ? '50x30mm Thermal' : 'A4 2x5'}) — ${escapeHtml(record.product.sku || 'SKU')}</title>
  <style>
    ${pageRule}
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: ${isThermal ? '12px' : '14px'};
      background: #EEF2F7;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      color: #0F172A;
    }
    .sheet-banner {
      max-width: ${isThermal ? '50mm' : '194mm'};
      margin: 0 auto 10px auto;
      font-size: 11px;
      color: #334155;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .sheet-grid-a4 {
      width: 194mm;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(2, 95mm);
      gap: 4mm;
      justify-content: center;
    }
    .sheet-grid-thermal {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .label-card {
      background: #FFFFFF;
      border: 0.35mm dashed #94A3B8;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    /* 50mm x 30mm Thermal Roll Label — strict zero-overflow micro layout */
    .label-thermal {
      width: 50mm;
      height: 30mm;
      padding: 1.4mm 1.7mm;
      border-radius: 1mm;
      gap: 0.7mm;
    }
    .label-thermal .lbl-top { border-bottom: 0.25mm solid #CBD5E1; padding-bottom: 0.6mm; }
    .label-thermal .lbl-title {
      font-size: 5.4pt;
      font-weight: 700;
      color: #0F2544;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .label-thermal .lbl-trace {
      display: flex;
      gap: 2mm;
      font-size: 4.5pt;
      color: #334155;
      white-space: nowrap;
      overflow: hidden;
    }
    .label-thermal .lbl-ops {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.2mm;
    }
    .label-thermal .lbl-op-head {
      display: flex;
      align-items: center;
      gap: 0.8mm;
      font-size: 4.2pt;
      font-weight: 700;
      color: #003399;
      white-space: nowrap;
      overflow: hidden;
    }
    .label-thermal .lbl-op-body {
      font-size: 4.1pt;
      line-height: 1.18;
      color: #1E293B;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .label-thermal .lbl-warnings {
      border-top: 0.25mm solid #CBD5E1;
      padding-top: 0.5mm;
      overflow: hidden;
    }
    .label-thermal .lbl-warn-head {
      display: flex;
      align-items: center;
      gap: 0.8mm;
      font-size: 4.1pt;
      font-weight: 700;
      color: #991B1B;
      margin-bottom: 0.3mm;
    }
    .label-thermal .lbl-wline {
      font-size: 3.9pt;
      line-height: 1.16;
      display: flex;
      gap: 0.8mm;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .label-thermal .lbl-lang {
      font-weight: 700;
      color: #0F2544;
      flex: 0 0 auto;
    }
    .label-thermal .lbl-more { font-size: 3.7pt; color: #64748B; }
    .label-thermal .ico { width: 6.5px; height: 6.5px; flex: 0 0 auto; }
    .label-thermal .ico-rp { width: 14px; height: 7px; flex: 0 0 auto; }

    /* A4 2x5 Sheet Sticker (95mm x 52mm) */
    .label-a4 {
      width: 95mm;
      height: 52mm;
      padding: 2.5mm 3mm;
      border-radius: 1.5mm;
      gap: 1.2mm;
    }
    .label-a4 .lbl-top { border-bottom: 0.3mm solid #003399; padding-bottom: 1mm; }
    .label-a4 .lbl-title {
      font-size: 7.5pt;
      font-weight: 700;
      color: #0F2544;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .label-a4 .lbl-trace {
      display: flex;
      flex-wrap: wrap;
      gap: 3mm;
      font-size: 6pt;
      color: #334155;
      margin-top: 0.4mm;
    }
    .label-a4 .lbl-ops {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2.2mm;
    }
    .label-a4 .lbl-op {
      background: #F8FAFC;
      border: 0.2mm solid #E2E8F0;
      border-radius: 1mm;
      padding: 1mm 1.4mm;
      overflow: hidden;
    }
    .label-a4 .lbl-op-head {
      display: flex;
      align-items: center;
      gap: 1mm;
      font-size: 5.4pt;
      font-weight: 700;
      color: #003399;
      margin-bottom: 0.4mm;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .label-a4 .lbl-op-body {
      font-size: 5.3pt;
      line-height: 1.24;
      color: #1E293B;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .label-a4 .lbl-warnings {
      border-top: 0.25mm solid #CBD5E1;
      padding-top: 0.8mm;
      overflow: hidden;
      flex: 1;
    }
    .label-a4 .lbl-warn-head {
      display: flex;
      align-items: center;
      gap: 1mm;
      font-size: 5.3pt;
      font-weight: 700;
      color: #991B1B;
      margin-bottom: 0.5mm;
    }
    .label-a4 .lbl-wgroup { margin-bottom: 0.7mm; }
    .label-a4 .lbl-wline {
      font-size: 4.9pt;
      line-height: 1.2;
      display: flex;
      gap: 1mm;
      align-items: baseline;
    }
    .label-a4 .lbl-lang {
      display: inline-block;
      min-width: 12px;
      font-weight: 700;
      color: #0F2544;
      flex: 0 0 auto;
    }
    .label-a4 .lbl-more { font-size: 4.6pt; color: #64748B; margin-top: 0.4mm; }
    .ico, .ico-rp { flex: 0 0 auto; vertical-align: middle; }

    @media print {
      body { background: #FFFFFF; padding: 0; }
      .sheet-banner { display: none; }
      .label-thermal { border: none; page-break-after: always; }
      .label-thermal:last-child { page-break-after: auto; }
    }
  </style>
</head>
<body>
  <div class="sheet-banner">
    <span><strong>${escapeHtml(APP_NAME)}</strong> · ${isThermal ? '50×30mm Thermal Roll' : 'A4 2×5 Label Sheet'} (${escapeHtml(langNames)})</span>
    <span>SKU: ${escapeHtml(record.product.sku || 'N/A')}</span>
  </div>
  <section class="${isThermal ? 'sheet-grid-thermal' : 'sheet-grid-a4'}">
    ${cards}
  </section>
</body>
</html>`;

  return {
    html,
    layout,
    languages,
    copies,
  };
}

/**
 * Generate ready-to-paste Compliance Copy for Amazon Seller Central, Etsy, and Shopify.
 */
export function generateMarketplaceCopy(recordInput, options = {}) {
  const record = normalizeProductRecord(recordInput);
  const languages = normalizeSelectedLanguages(options.languages || ['en', 'de', 'fr', 'es', 'it']);
  const selectedWarnings = record.warnings.map((id) => WARNING_BY_ID[id]).filter(Boolean);

  const multilingualWarningLines = selectedWarnings
    .map((w) => languages.map((code) => `[${code.toUpperCase()}] ${w.text[code]}`).join('\n'))
    .join('\n\n');

  const enWarnings = selectedWarnings.map((w) => `- ${w.text.en}`).join('\n');

  // 1. Amazon Seller Central GPSR Submission Pack
  const amazon = [
    '=== AMAZON SELLER CENTRAL — EU GPSR (REGULATION (EU) 2023/988) COMPLIANCE PACK ===',
    `Product Name: ${record.product.name || '[Required]'}`,
    `SKU / Model Number: ${record.product.sku || '[Required]'}`,
    `Batch / Lot / Serial Format: ${record.product.batchFormat || '[Required]'}`,
    ...(record.product.eanGtin ? [`EAN / GTIN: ${record.product.eanGtin}`] : []),
    '',
    '--- EU Responsible Person (Article 16) ---',
    `Responsible Person Name: ${record.euResponsiblePerson.name || '[Required]'}`,
    `Responsible Person EU Street Address: ${record.euResponsiblePerson.euAddress || '[Required]'}`,
    `Responsible Person Email / Electronic Contact: ${record.euResponsiblePerson.electronicAddress || '[Required]'}`,
    '',
    '--- Manufacturer Contact Information (Article 9(6)) ---',
    `Manufacturer Legal Name: ${record.manufacturer.name || '[Required]'}`,
    ...(record.manufacturer.tradeName ? [`Registered Trade Name / Brand: ${record.manufacturer.tradeName}`] : []),
    `Manufacturer Postal Address: ${record.manufacturer.postalAddress || '[Required]'}`,
    `Manufacturer Email / Electronic Contact: ${record.manufacturer.electronicAddress || '[Required]'}`,
    '',
    `--- Product Safety & Warning Text (${languages.map((l) => l.toUpperCase()).join(' / ')}) ---`,
    multilingualWarningLines || 'No hazard warnings selected — verify whether safety instructions are required.',
    ...(record.customWarning ? ['', `Additional Product Care / Safety Note: ${record.customWarning}`] : []),
  ].join('\n');

  // 2. Etsy Listing GPSR Safety & Economic Operator Section
  const etsy = [
    'EU GPSR Product Safety & Responsible Person Information',
    '-------------------------------------------------------',
    `Item / Model: ${record.product.name || '[Required]'} (${record.product.sku || 'N/A'})`,
    `Batch / Traceability Code: ${record.product.batchFormat || '[Required]'}`,
    `Materials: ${record.product.materials || 'See item description'}`,
    `Intended Use & Audience: ${record.product.intendedUse || 'Consumer use'} (${record.product.targetUsers || 'General adult consumers'})`,
    '',
    'Manufacturer:',
    `${record.manufacturer.name || '[Required]'}${record.manufacturer.tradeName ? ` (${record.manufacturer.tradeName})` : ''}`,
    `${record.manufacturer.postalAddress || '[Required]'}`,
    `Contact: ${record.manufacturer.electronicAddress || '[Required]'}`,
    '',
    'EU Responsible Person (Art. 16 GPSR):',
    `${record.euResponsiblePerson.name || '[Required]'}`,
    `${record.euResponsiblePerson.euAddress || '[Required]'}`,
    `Contact: ${record.euResponsiblePerson.electronicAddress || '[Required]'}`,
    '',
    'Safety Warnings & Care:',
    enWarnings || '- Inspect item before use and follow included care instructions.',
    ...(record.customWarning ? [`- ${record.customWarning}`] : []),
    ...(languages.length > 1
      ? [
          '',
          `Multilingual EU Safety Summary (${languages.map((l) => l.toUpperCase()).join(' / ')}):`,
          multilingualWarningLines,
        ]
      : []),
  ].join('\n');

  // 3. Shopify Storefront Collapsible HTML Compliance Block
  const shopifyWarningsHtml = selectedWarnings.length > 0
    ? selectedWarnings
        .map((w) => {
          const items = languages
            .map((code) => `<li><strong>${code.toUpperCase()}:</strong> ${escapeHtml(w.text[code])}</li>`)
            .join('');
          return `<ul>${items}</ul>`;
        })
        .join('\n')
    : '<p>Inspect before use and follow standard care guidelines.</p>';

  const shopify = [
    '<details class="gpsr-compliance-block">',
    '  <summary>EU Product Safety &amp; GPSR Compliance Information</summary>',
    `  <p><strong>Product / Model:</strong> ${escapeHtml(record.product.name || '—')} (${escapeHtml(record.product.sku || '—')}) | <strong>Batch:</strong> ${escapeHtml(record.product.batchFormat || '—')}</p>`,
    `  <p><strong>Manufacturer:</strong> ${escapeHtml(record.manufacturer.name || '—')}${record.manufacturer.tradeName ? ` (${escapeHtml(record.manufacturer.tradeName)})` : ''}, ${escapeHtml(record.manufacturer.postalAddress || '—')} (${escapeHtml(record.manufacturer.electronicAddress || '—')})</p>`,
    `  <p><strong>EU Responsible Person (Art. 16):</strong> ${escapeHtml(record.euResponsiblePerson.name || '—')}, ${escapeHtml(record.euResponsiblePerson.euAddress || '—')} (${escapeHtml(record.euResponsiblePerson.electronicAddress || '—')})</p>`,
    '  <div class="gpsr-warnings">',
    `    ${shopifyWarningsHtml.replace(/\n/g, '\n    ')}`,
    ...(record.customWarning ? [`    <p><em>Note:</em> ${escapeHtml(record.customWarning)}</p>`] : []),
    '  </div>',
    '</details>',
  ].join('\n');

  return { amazon, etsy, shopify };
}

/**
 * Generate a complete Batch Multi-SKU UTF-8 ZIP bundle containing for every SKU:
 *   - 01-article9-technical-file.html
 *   - 02-article9-technical-file.json
 *   - 03-labels-50x30mm-thermal.html
 *   - 04-labels-a4-2x5.html
 *   - 05-marketplace-compliance-copy.txt
 * Plus root `INDEX-SUMMARY.csv` and `README.txt`.
 */
export async function generateBatchZipBundle(recordsInput, options = {}) {
  const records = Array.isArray(recordsInput) ? recordsInput : [];
  if (records.length === 0) {
    throw new Error('At least one SKU record is required to generate a batch ZIP bundle.');
  }

  const languages = normalizeSelectedLanguages(options.languages || LABEL_LANGUAGE_CODES);
  const generatedAt = options.generatedAt || new Date().toISOString();
  const entries = [];
  const summary = [];

  for (let i = 0; i < records.length; i++) {
    const rec = normalizeProductRecord(records[i]);
    const folder = sanitizeSlug(rec.product.sku || rec.product.name, `sku-${i + 1}`);
    const tech = await generateTechnicalFileHtml(rec, { languages, generatedAt });
    const labelThermal = generateLabelSheetHtml(rec, { layout: 'thermal_50x30', languages, copies: 1 });
    const labelA4 = generateLabelSheetHtml(rec, { layout: 'a4_2x5', languages, copies: 10 });
    const mp = generateMarketplaceCopy(rec, { languages });

    const marketplaceCombined = [
      mp.amazon,
      '\n\n============================================================\n\n',
      mp.etsy,
      '\n\n============================================================\n\n',
      '=== SHOPIFY PRODUCT COMPLIANCE HTML BLOCK ===\n',
      mp.shopify,
    ].join('');

    entries.push(
      { name: `${folder}/01-article9-technical-file.html`, data: tech.html },
      { name: `${folder}/02-article9-technical-file.json`, data: tech.json },
      { name: `${folder}/03-labels-50x30mm-thermal.html`, data: labelThermal.html },
      { name: `${folder}/04-labels-a4-2x5.html`, data: labelA4.html },
      { name: `${folder}/05-marketplace-compliance-copy.txt`, data: marketplaceCombined },
    );

    summary.push({
      sku: rec.product.sku,
      productName: rec.product.name,
      category: rec.product.category,
      readinessPercent: tech.readiness.percentage,
      status: tech.readiness.status,
      missingCount: tech.readiness.missingItems.length,
      unmitigatedHighRisks: tech.readiness.highRiskUnmitigatedCount,
      sha256: tech.sha256,
      folder,
    });
  }

  const csvCell = (val) => `"${String(val ?? '').replace(/"/g, '""')}"`;
  const indexCsv = [
    'sku,product_name,category,readiness_percent,status,missing_items,unmitigated_high_risks,sha256,folder',
    ...summary.map((s) =>
      [
        s.sku,
        s.productName,
        s.category,
        s.readinessPercent,
        s.status,
        s.missingCount,
        s.unmitigatedHighRisks,
        s.sha256,
        s.folder,
      ]
        .map(csvCell)
        .join(','),
    ),
  ].join('\n');

  const readmeTxt = [
    `${APP_NAME} v${APP_VERSION} — Batch EU GPSR (Regulation (EU) 2023/988) Compliance Archive`,
    `Generated At (UTC): ${generatedAt}`,
    `Total SKUs Packaged: ${summary.length}`,
    `Label Languages Included: ${languages.map((l) => l.toUpperCase()).join(', ')}`,
    '',
    'Folder Contents Per SKU:',
    '  01-article9-technical-file.html  — Print-to-PDF 10-Year Archivable Technical File & Risk Matrix',
    '  02-article9-technical-file.json  — Machine-readable backup with SHA-256 integrity fingerprint',
    '  03-labels-50x30mm-thermal.html   — Print-ready 50x30mm Thermal Roll Label',
    '  04-labels-a4-2x5.html            — Print-ready A4 2x5 (10-per-sheet) Cut Label Sheet',
    '  05-marketplace-compliance-copy.txt — Amazon Seller Central, Etsy & Shopify compliance snippets',
    '',
    DISCLAIMER_TEXT.en,
  ].join('\n');

  entries.unshift(
    { name: 'README.txt', data: readmeTxt },
    { name: 'INDEX-SUMMARY.csv', data: indexCsv },
  );

  const zipBytes = createZipArchive(entries);
  return {
    zipBytes,
    summary,
    fileCount: entries.length,
    skuCount: summary.length,
  };
}
