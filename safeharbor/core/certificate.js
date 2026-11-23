/**
 * SafeHarbor Studio Pro — Cryptographic SHA-256 IRB De-Identification Audit Certificate
 *
 * Computes genuine SHA-256 digests of input and output datasets via WebCrypto (`crypto.subtle.digest`),
 * and generates both machine-readable JSON logs and self-contained print-to-PDF HTML certificates
 * citing 45 CFR § 164.514(b)(2) & § 164.514(c).
 */

import {
  APP_NAME,
  APP_VERSION,
  HIPAA_IDENTIFIERS,
  RESTRICTED_ZIP3_PREFIXES,
} from './config.js';

const TEXT_ENCODER = new TextEncoder();

/**
 * Compute lowercase hex SHA-256 digest via WebCrypto (`globalThis.crypto.subtle.digest`).
 */
export async function sha256Hex(input) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('WebCrypto subtle.digest is unavailable in this environment.');
  }
  const bytes = input instanceof Uint8Array
    ? input
    : TEXT_ENCODER.encode(String(input ?? ''));
  const digestBuffer = await subtle.digest('SHA-256', bytes);
  const digestBytes = new Uint8Array(digestBuffer);
  let hex = '';
  for (let i = 0; i < digestBytes.length; i++) {
    hex += digestBytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ACTION_LABELS = Object.freeze({
  drop: { en: 'Drop Column', zh: '删除整列 (Drop)' },
  zip3: { en: 'ZIP 3-Digit + 17-Prefix Check', zh: '邮编保留前3位 + 17前缀归零' },
  date_year_only: { en: 'Date -> Year Only', zh: '日期仅保留年份' },
  date_shift: { en: 'Date -> Consistent Longitudinal Shift', zh: '日期一致性纵向偏移' },
  age_cap: { en: 'Age Cap (>89 -> 90+)', zh: '年龄封顶 (>89 -> 90+)' },
  pseudonymize: { en: 'Pseudonymize MRN (§ 164.514(c))', zh: '假名化 MRN (§ 164.514(c))' },
  scrub_text: { en: 'Scrub Free-Text Inline PHI', zh: '自由文本内联 PHI 脱敏' },
  keep: { en: 'Keep (Clinical Variable)', zh: '保留（临床变量）' },
});

export const ATTESTATION_ITEMS = Object.freeze([
  {
    id: 'all_18_identifiers',
    en: 'All 18 HIPAA Safe Harbor identifiers specified in 45 CFR § 164.514(b)(2)(i)(A)–(R) have been reviewed, removed, generalized, or pseudonymized.',
    zh: '已核查并移除、泛化或假名化 45 CFR § 164.514(b)(2)(i)(A)–(R) 规定的全部 18 类 HIPAA 安全港标识符。',
  },
  {
    id: 'zip_17_prefixes',
    en: 'Geographic subdivisions smaller than a State were removed; 3-digit ZIP codes were verified against all 17 HHS/OCR low-population prefixes (<=20,000) and coded to "000" where required.',
    zh: '州以下地理细分信息已移除；3 位邮编已按 HHS/OCR 规定的全部 17 个低人口前缀（<=20,000）完成核验并按要求归零为 "000"。',
  },
  {
    id: 'ages_over_89',
    en: 'All ages over 89 and any birth dates/years indicative of age > 89 were aggregated into a single "90+" category.',
    zh: '所有超过 89 岁的年龄及可推算年龄 >89 岁的出生年份均已归并至统一的 "90+" 类别。',
  },
  {
    id: 'free_text_spot_check',
    en: 'Free-text clinical notes were scrubbed for inline PHI and manually spot-checked for rare, unstructured, or contextual identifiers.',
    zh: '自由文本临床记录已完成内联 PHI 脱敏，并已人工抽检确认无罕见、非结构化或上下文残留标识信息。',
  },
  {
    id: 'reid_key_firewall',
    en: 'Any re-identification crosswalk (reid_key_map_DO_NOT_SHARE.csv) is non-derived (45 CFR § 164.514(c)), stored separately behind an institutional firewall, and excluded from external data sharing.',
    zh: '任何重识别映射表（reid_key_map_DO_NOT_SHARE.csv）均符合非派生编码要求（45 CFR § 164.514(c)），独立存放于机构防火墙后且不随脱敏数据外发。',
  },
  {
    id: 'no_actual_knowledge',
    en: 'No Actual Knowledge Attestation (45 CFR § 164.514(b)(2)(ii)): The investigator has no actual knowledge that the remaining information could be used alone or in combination with other information to identify any individual subject.',
    zh: '“无实际知情”声明（45 CFR § 164.514(b)(2)(ii)）：研究者确认无任何实际知情表明剩余数据单独或结合其他信息可用于识别任何受试者个人身份。',
  },
]);

export const LEGAL_DISCLAIMER = Object.freeze({
  en: 'LEGAL NOTICE: SafeHarbor Studio Pro is a 100% local, offline data de-identification workflow utility designed to assist clinical and biomedical researchers in applying the technical removal and generalization rules of HIPAA Safe Harbor (45 CFR § 164.514(b)(2) & § 164.514(c)). This certificate documents technical transformations and SHA-256 file integrity hashes only. It does NOT constitute formal legal counsel, HIPAA Privacy Officer sign-off, IRB approval, or a statistical Expert Determination under 45 CFR § 164.514(b)(1). Investigators remain responsible for verifying final dataset suitability, manual review of free-text fields, and institutional compliance prior to release.',
  zh: '法律免责声明：SafeHarbor Studio Pro 是一款 100% 本地离线运行的数据脱敏工作流工具，旨在协助临床与生物医学研究人员执行 HIPAA 安全港（45 CFR § 164.514(b)(2) 与 § 164.514(c)）的技术性移除与泛化规则。本证书仅记录技术转换过程与 SHA-256 文件完整性哈希，不构成正式法律意见、机构隐私官（HIPAA Privacy Officer）签批、IRB 伦理批准或 45 CFR § 164.514(b)(1) 项下的统计学专家认定（Expert Determination）。研究者仍须在对外共享数据前独立审核最终输出、人工复核自由文本字段并遵守所属机构合规要求。',
});

/**
 * Build the structured machine-readable IRB Audit Certificate payload with genuine WebCrypto SHA-256 digests.
 */
export async function buildAuditCertificateData({
  rawInputText,
  result,
  sourceFilename = 'clinical_cohort.csv',
  generatedAt = new Date().toISOString(),
  studyProtocolId = '',
  investigatorName = '',
}) {
  const [inputSha256, outputSha256, reidKeyMapSha256] = await Promise.all([
    sha256Hex(rawInputText ?? ''),
    sha256Hex(result?.cleanCsv ?? ''),
    result?.reidKeyMapCsv ? sha256Hex(result.reidKeyMapCsv) : Promise.resolve(null),
  ]);

  const stats = result.stats;
  const certificateId = `SHC-${outputSha256.slice(0, 12).toUpperCase()}`;

  const categoryBreakdown = HIPAA_IDENTIFIERS.map((item) => ({
    code: item.code,
    id: item.id,
    cfr: item.cfr,
    labelEn: item.labelEn,
    labelZh: item.labelZh,
    redactionCount: stats.categoryCounts?.[item.code] || 0,
  }));

  const columnAuditTable = (result.columns || []).map((col) => ({
    index: col.index,
    name: col.name,
    hipaaCode: col.hipaaCode,
    hipaaCitation: col.hipaaCitation,
    hipaaLabelEn: col.hipaaLabelEn,
    hipaaLabelZh: col.hipaaLabelZh,
    detectionSource: col.detectionSource,
    detectedAction: col.detectedAction,
    appliedAction: col.appliedAction,
    wasOverridden: Boolean(col.wasOverridden),
    cellsTransformed: col.cellsTransformed || 0,
    cellsRedactedCount: col.cellsRedactedCount || 0,
    reason: col.reason,
  }));

  return {
    schemaVersion: '1.0.0',
    certificateId,
    standard: 'HIPAA Safe Harbor De-Identification (45 CFR § 164.514(b)(2) & § 164.514(c))',
    generatedAt,
    tool: {
      name: APP_NAME,
      version: APP_VERSION,
      executionMode: '100% Offline Client-Side (Zero Backend / Zero Upload)',
      hashAlgorithm: 'WebCrypto SHA-256',
    },
    studyMetadata: {
      studyProtocolId: String(studyProtocolId || '').trim(),
      investigatorName: String(investigatorName || '').trim(),
    },
    dataset: {
      sourceFilename,
      format: result.format,
      delimiter: result.delimiter === '\t' ? 'TAB' : 'COMMA',
      inputRows: stats.inputRows,
      outputRows: stats.outputRows,
      truncatedByFreeTier: Boolean(stats.truncatedByFreeTier),
      inputColumns: stats.inputColumns,
      outputColumns: stats.outputColumns,
      droppedColumns: [...(result.droppedColumns || [])],
      totalPhiColumnsDetected: stats.totalPhiColumnsDetected,
      totalCellsModified: stats.totalCellsModified,
      referenceYear: stats.referenceYear,
    },
    hashes: {
      algorithm: 'SHA-256',
      inputSha256,
      outputSha256,
      reidKeyMapSha256,
    },
    zipPrefixVerification: {
      rule: '45 CFR § 164.514(b)(2)(i)(B)',
      verified17RestrictedPrefixes: true,
      restrictedPrefixCount: RESTRICTED_ZIP3_PREFIXES.length,
      restrictedPrefixes: [...RESTRICTED_ZIP3_PREFIXES],
      zipColumnsChecked: [...(stats.zipStats?.zipColumns || [])],
      totalZipCellsProcessed: stats.zipStats?.totalProcessed || 0,
      restrictedZipCellsZeroed: stats.zipStats?.restrictedZeroed || 0,
      normalZipCellsTruncated: stats.zipStats?.normalTruncated || 0,
      restrictedPrefixesEncountered: [...(stats.zipStats?.restrictedPrefixesHit || [])],
    },
    dateHandling: {
      rule: '45 CFR § 164.514(b)(2)(i)(C)',
      modeRequested: stats.dateStats?.modeRequested || 'year_only',
      modeApplied: stats.dateStats?.modeApplied || 'year_only',
      shiftRangeDays: stats.dateStats?.shiftRangeDays || 180,
      subjectIdColumn: stats.dateStats?.subjectIdColumn || null,
      dateColumnsProcessed: [...(stats.dateStats?.dateColumns || [])],
      totalDateCellsTransformed: stats.dateStats?.cellsTransformed || 0,
      birthYearsOver89Capped: stats.dateStats?.birthYearsOver89Capped || 0,
      longitudinalIntervalsPreserved: Boolean(stats.dateStats?.intervalsPreserved),
    },
    ageCapping: {
      rule: '45 CFR § 164.514(b)(2)(i)(C)',
      threshold: 'Age > 89 -> 90+',
      ageColumnsProcessed: [...(stats.ageStats?.ageColumns || [])],
      cellsCappedTo90Plus: stats.ageStats?.cellsCappedTo90Plus || 0,
    },
    pseudonymization: {
      rule: '45 CFR § 164.514(c)',
      columns: [...(stats.pseudonymStats?.columns || [])],
      uniqueSubjectsMapped: stats.pseudonymStats?.uniqueSubjectsMapped || 0,
      reidKeyMapGenerated: Boolean(result.reidKeyMapCsv),
      reidKeyMapHandling: 'PI-ONLY — Store separately behind institutional IRB firewall; DO NOT share with external recipients.',
    },
    categoryBreakdown,
    inlineRedactionCounts: { ...(stats.inlineRedactionCounts || {}) },
    columnAuditTable,
    warnings: (result.warnings || []).map((w) => ({ ...w })),
    attestationChecklist: ATTESTATION_ITEMS.map((item) => ({ ...item })),
    legalDisclaimer: { ...LEGAL_DISCLAIMER },
  };
}

/**
 * Render a clean, self-contained, print-to-PDF-ready HTML IRB Audit Certificate.
 * Zero external stylesheets, fonts, scripts, or network calls.
 */
export function renderAuditCertificateHtml(auditData, lang = 'en') {
  const isZh = lang === 'zh';
  const t = (en, zh) => (isZh ? zh : en);

  const d = auditData;
  const zip = d.zipPrefixVerification;
  const dateH = d.dateHandling;
  const ageC = d.ageCapping;
  const pseudo = d.pseudonymization;
  const activeCategories = (d.categoryBreakdown || []).filter((c) => c.redactionCount > 0);
  const totalCategoryRedactions = (d.categoryBreakdown || []).reduce((acc, c) => acc + c.redactionCount, 0);

  const colRowsHtml = (d.columnAuditTable || []).map((col) => {
    const actionLabel = ACTION_LABELS[col.appliedAction]?.[isZh ? 'zh' : 'en'] || col.appliedAction;
    const badgeClass = col.appliedAction === 'drop'
      ? 'pill-danger'
      : (col.appliedAction === 'keep'
        ? (col.hipaaCode !== 'SAFE' ? 'pill-warn' : 'pill-safe')
        : 'pill-teal');
    const overrideTag = col.wasOverridden
      ? `<span class="mini-tag">${escapeHtml(t('Override', '手动覆盖'))}</span>`
      : '';
    return `
      <tr>
        <td class="mono strong">${escapeHtml(col.name)}</td>
        <td><span class="code-badge">${escapeHtml(col.hipaaCode)}</span> ${escapeHtml(isZh ? col.hipaaLabelZh : col.hipaaLabelEn)}<div class="sub-note">${escapeHtml(col.hipaaCitation)}</div></td>
        <td><span class="pill ${badgeClass}">${escapeHtml(actionLabel)}</span>${overrideTag}</td>
        <td class="num">${col.cellsTransformed}</td>
        <td class="num">${col.cellsRedactedCount}</td>
      </tr>`;
  }).join('');

  const categoryRowsHtml = (d.categoryBreakdown || []).map((cat) => {
    const active = cat.redactionCount > 0;
    return `
      <tr class="${active ? 'cat-active' : 'cat-zero'}">
        <td class="mono strong">(${escapeHtml(cat.code)})</td>
        <td>${escapeHtml(isZh ? cat.labelZh : cat.labelEn)}</td>
        <td class="mono sub-note">${escapeHtml(cat.cfr)}</td>
        <td class="num strong">${cat.redactionCount}</td>
      </tr>`;
  }).join('');

  const warningsHtml = (d.warnings && d.warnings.length > 0)
    ? `<section class="card warn-card">
        <h3>${escapeHtml(t('Compliance Review Warnings', '合规复核警告'))}</h3>
        <ul>
          ${d.warnings.map((w) => `<li>${escapeHtml(isZh ? w.messageZh : w.messageEn)}</li>`).join('')}
        </ul>
      </section>`
    : '';

  const attestationHtml = (d.attestationChecklist || []).map((item) => `
    <li class="check-item">
      <span class="checkbox-box" aria-hidden="true">☐</span>
      <span>${escapeHtml(isZh ? item.zh : item.en)}</span>
    </li>`).join('');

  const inlineEntries = Object.entries(d.inlineRedactionCounts || {}).filter(([, count]) => count > 0);
  const inlineSummaryHtml = inlineEntries.length > 0
    ? inlineEntries.map(([k, v]) => `<span class="inline-chip">${escapeHtml(k)}: <strong>${v}</strong></span>`).join(' ')
    : `<span class="muted">${escapeHtml(t('None detected', '无内联脱敏项'))}</span>`;

  const dateModeLabel = dateH.modeApplied === 'consistent_shift'
    ? t(`Consistent Per-Subject Shift (±${dateH.shiftRangeDays} days)`, `受试者一致性纵向偏移（±${dateH.shiftRangeDays} 天）`)
    : t('Year Only (4-Digit Year)', '仅保留 4 位年份');

  return `<!DOCTYPE html>
<html lang="${isZh ? 'zh-CN' : 'en'}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(t('IRB De-Identification Audit Certificate', 'IRB 临床数据脱敏审计证书'))} — ${escapeHtml(d.certificateId)}</title>
  <style>
    :root {
      --ink: #0f2433;
      --ink-muted: #4b6578;
      --teal: #0b6e75;
      --teal-soft: #e6f4f5;
      --border: #d5e2ea;
      --surface: #f7fafc;
      --danger: #b91c1c;
      --danger-soft: #fee2e2;
      --warn: #b45309;
      --warn-soft: #fef3c7;
      --safe: #0f766e;
      --safe-soft: #dcfce7;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 28px 20px 48px;
      background: #eef4f7;
      color: var(--ink);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Noto Sans SC", sans-serif;
      font-size: 13px;
      line-height: 1.5;
    }
    .sheet {
      max-width: 960px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 32px 36px;
      box-shadow: 0 8px 24px rgba(15, 36, 51, 0.08);
    }
    .print-bar {
      max-width: 960px;
      margin: 0 auto 14px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .print-btn {
      background: var(--teal);
      color: #fff;
      border: 0;
      border-radius: 6px;
      padding: 9px 16px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 20px;
      border-bottom: 2px solid var(--teal);
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .eyebrow {
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--teal);
      font-weight: 700;
      margin: 0 0 4px;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 22px;
      line-height: 1.25;
      color: var(--ink);
    }
    .subtitle { margin: 0; color: var(--ink-muted); font-size: 13px; }
    .cert-meta {
      text-align: right;
      font-size: 12px;
      color: var(--ink-muted);
      flex-shrink: 0;
    }
    .cert-id {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 14px;
      font-weight: 700;
      color: var(--teal);
      margin-bottom: 4px;
    }
    .badge-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 18px;
    }
    .verify-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      background: var(--teal-soft);
      color: var(--teal);
      border: 1px solid #b5dfe2;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 18px;
    }
    .grid-4 {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-bottom: 18px;
    }
    .card {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px 16px;
      background: var(--surface);
      margin-bottom: 16px;
      break-inside: avoid;
    }
    .stat-card {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 11px 13px;
      background: #fff;
    }
    .stat-label { font-size: 11px; color: var(--ink-muted); text-transform: uppercase; letter-spacing: 0.04em; }
    .stat-val { font-size: 20px; font-weight: 700; color: var(--ink); margin-top: 2px; }
    .warn-card {
      background: var(--warn-soft);
      border-color: #f59e0b;
      color: #78350f;
    }
    h2 {
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--teal);
      margin: 22px 0 10px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 5px;
    }
    h3 { margin: 0 0 8px; font-size: 13px; color: var(--ink); }
    .hash-table { width: 100%; border-collapse: collapse; }
    .hash-table td { padding: 5px 6px; vertical-align: top; border-bottom: 1px dashed var(--border); }
    .hash-table tr:last-child td { border-bottom: 0; }
    .hash-label { width: 220px; font-weight: 600; color: var(--ink-muted); }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; word-break: break-all; }
    .strong { font-weight: 600; }
    .muted { color: var(--ink-muted); }
    .sub-note { font-size: 11px; color: var(--ink-muted); margin-top: 2px; }
    table.audit-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      margin-bottom: 16px;
    }
    table.audit-table th, table.audit-table td {
      border: 1px solid var(--border);
      padding: 7px 9px;
      text-align: left;
      vertical-align: top;
    }
    table.audit-table th {
      background: #edf5f7;
      color: var(--ink);
      font-weight: 700;
    }
    table.audit-table td.num, table.audit-table th.num { text-align: right; white-space: nowrap; }
    .cat-zero { color: #7b93a4; }
    .cat-active { background: #f8fcfc; }
    .code-badge {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 4px;
      background: #e2edf2;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      font-weight: 700;
      margin-right: 4px;
    }
    .pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
    }
    .pill-danger { background: var(--danger-soft); color: var(--danger); }
    .pill-teal { background: var(--teal-soft); color: var(--teal); }
    .pill-safe { background: var(--safe-soft); color: var(--safe); }
    .pill-warn { background: var(--warn-soft); color: var(--warn); }
    .mini-tag {
      display: inline-block;
      margin-left: 6px;
      padding: 1px 5px;
      font-size: 10px;
      border-radius: 4px;
      background: var(--warn-soft);
      color: var(--warn);
      font-weight: 700;
    }
    .prefix-list {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 8px;
    }
    .prefix-chip {
      padding: 2px 7px;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      background: #fff;
      border: 1px solid var(--border);
    }
    .prefix-chip.hit {
      background: var(--warn-soft);
      border-color: #d97706;
      color: #92400e;
      font-weight: 700;
    }
    .inline-chip {
      display: inline-block;
      padding: 2px 8px;
      margin: 2px 4px 2px 0;
      border-radius: 999px;
      background: #fff;
      border: 1px solid var(--border);
      font-size: 11px;
    }
    .checklist { list-style: none; padding: 0; margin: 0; }
    .check-item {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      padding: 6px 0;
      border-bottom: 1px dashed var(--border);
    }
    .check-item:last-child { border-bottom: 0; }
    .checkbox-box { font-size: 15px; line-height: 1.2; color: var(--teal); }
    .sig-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
      margin-top: 20px;
      padding-top: 12px;
    }
    .sig-line {
      border-top: 1px solid var(--ink-muted);
      padding-top: 5px;
      font-size: 11px;
      color: var(--ink-muted);
    }
    .disclaimer {
      margin-top: 18px;
      padding: 12px 14px;
      border-radius: 6px;
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      font-size: 11.5px;
      color: #334155;
    }
    @media print {
      @page { size: letter; margin: 12mm; }
      body { background: #fff; padding: 0; }
      .no-print { display: none !important; }
      .sheet { box-shadow: none; border: 0; padding: 0; max-width: none; }
    }
  </style>
</head>
<body>
  <div class="print-bar no-print">
    <span class="muted">${escapeHtml(APP_NAME)} v${escapeHtml(APP_VERSION)} · ${escapeHtml(t('100% Offline Cryptographic Audit Artifact', '100% 离线密码学审计证书'))}</span>
    <button class="print-btn" onclick="window.print()">${escapeHtml(t('Print / Save as PDF', '打印 / 另存为 PDF'))}</button>
  </div>

  <article class="sheet">
    <header class="header">
      <div>
        <p class="eyebrow">${escapeHtml(t('HIPAA Safe Harbor · 45 CFR § 164.514(b)(2) & § 164.514(c)', 'HIPAA 安全港合规审计 · 45 CFR § 164.514(b)(2) & § 164.514(c)'))}</p>
        <h1>${escapeHtml(t('IRB De-Identification Audit Certificate', 'IRB 临床研究数据脱敏审计证书'))}</h1>
        <p class="subtitle">${escapeHtml(t('Cryptographically verified local de-identification transformation record', '本地离线 WebCrypto SHA-256 完整性校验脱敏记录'))}</p>
      </div>
      <div class="cert-meta">
        <div class="cert-id">${escapeHtml(d.certificateId)}</div>
        <div>${escapeHtml(t('Generated (UTC)', '生成时间 (UTC)'))}: ${escapeHtml(d.generatedAt)}</div>
        <div>${escapeHtml(t('Source File', '源文件'))}: ${escapeHtml(d.dataset.sourceFilename)}</div>
        <div>${escapeHtml(APP_NAME)} v${escapeHtml(APP_VERSION)}</div>
      </div>
    </header>

    <div class="badge-row">
      <span class="verify-badge">✓ ${escapeHtml(t('17 HHS Restricted 3-Digit ZIP Prefixes Verified', '已核验 HHS 全部 17 个受限 3 位邮编前缀'))}</span>
      <span class="verify-badge">✓ ${escapeHtml(t('WebCrypto SHA-256 Tamper-Evident Fingerprints', 'WebCrypto SHA-256 防篡改指纹'))}</span>
      <span class="verify-badge">✓ ${escapeHtml(t('100% Client-Side Offline Processing (Zero Upload)', '100% 本地离线处理（零上传）'))}</span>
    </div>

    <div class="grid-4">
      <div class="stat-card">
        <div class="stat-label">${escapeHtml(t('Rows Processed', '处理行数'))}</div>
        <div class="stat-val">${d.dataset.outputRows} / ${d.dataset.inputRows}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${escapeHtml(t('PHI Columns Detected', '检出 PHI 字段'))}</div>
        <div class="stat-val">${d.dataset.totalPhiColumnsDetected} / ${d.dataset.inputColumns}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${escapeHtml(t('Columns Dropped', '删除高危列'))}</div>
        <div class="stat-val">${d.dataset.droppedColumns.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">${escapeHtml(t('Total HIPAA Redactions', '累计脱敏/转换次数'))}</div>
        <div class="stat-val">${totalCategoryRedactions}</div>
      </div>
    </div>

    ${warningsHtml}

    <section class="card">
      <h3>${escapeHtml(t('Cryptographic File Integrity Fingerprints (SHA-256)', '文件密码学完整性指纹（SHA-256）'))}</h3>
      <table class="hash-table">
        <tr>
          <td class="hash-label">${escapeHtml(t('Input Dataset SHA-256', '原始输入数据集 SHA-256'))}</td>
          <td class="mono">${escapeHtml(d.hashes.inputSha256)}</td>
        </tr>
        <tr>
          <td class="hash-label">${escapeHtml(t('De-Identified Output SHA-256', '脱敏输出数据集 SHA-256'))}</td>
          <td class="mono">${escapeHtml(d.hashes.outputSha256)}</td>
        </tr>
        <tr>
          <td class="hash-label">${escapeHtml(t('PI-Only Re-ID Map SHA-256', 'PI 专用重识别映射表 SHA-256'))}</td>
          <td class="mono">${d.hashes.reidKeyMapSha256 ? escapeHtml(d.hashes.reidKeyMapSha256) : escapeHtml(t('N/A (No pseudonymized columns)', '无（未启用假名化列）'))}</td>
        </tr>
      </table>
    </section>

    <div class="grid-2">
      <section class="card">
        <h3>${escapeHtml(t('17 Restricted ZIP Prefix Verification (§ 164.514(b)(2)(i)(B))', '17 个受限邮编前缀核验 (§ 164.514(b)(2)(i)(B))'))}</h3>
        <div>${escapeHtml(t('ZIP Columns Checked', '已校验邮编列'))}: <strong class="mono">${escapeHtml(zip.zipColumnsChecked.join(', ') || t('None', '无'))}</strong></div>
        <div>${escapeHtml(t('ZIP Cells Processed', '处理邮编单元格'))}: <strong>${zip.totalZipCellsProcessed}</strong> · ${escapeHtml(t('Restricted Zeroed to 000', '受限前缀归零为 000'))}: <strong>${zip.restrictedZipCellsZeroed}</strong> · ${escapeHtml(t('Normal Truncated to 3 Digits', '常规保留前 3 位'))}: <strong>${zip.normalZipCellsTruncated}</strong></div>
        <div class="prefix-list">
          ${zip.restrictedPrefixes.map((p) => {
            const hit = (zip.restrictedPrefixesEncountered || []).includes(p);
            return `<span class="prefix-chip${hit ? ' hit' : ''}">${escapeHtml(p)}${hit ? ' → 000' : ''}</span>`;
          }).join('')}
        </div>
      </section>

      <section class="card">
        <h3>${escapeHtml(t('Date Shifting, Age > 89 & Pseudonymization Summary', '日期处理、>89 岁封顶与假名化摘要'))}</h3>
        <div><strong>${escapeHtml(t('Date Mode', '日期脱敏模式'))}:</strong> ${escapeHtml(dateModeLabel)}</div>
        <div><strong>${escapeHtml(t('Subject Linking Column', '受试者关联主键列'))}:</strong> <span class="mono">${escapeHtml(dateH.subjectIdColumn || t('Row-level fallback', '按行独立处理'))}</span> (${escapeHtml(dateH.longitudinalIntervalsPreserved ? t('Inter-visit intervals preserved', '保留同受试者纵向间隔') : t('Year-only / no shift', '仅年份或未偏移'))})</div>
        <div><strong>${escapeHtml(t('Date Cells Transformed', '日期转换单元格'))}:</strong> ${dateH.totalDateCellsTransformed} · <strong>${escapeHtml(t('Birth Years > 89 Capped', '>89 岁出生年封顶'))}:</strong> ${dateH.birthYearsOver89Capped}</div>
        <div><strong>${escapeHtml(t('Ages > 89 Capped to 90+', '年龄 >89 归并为 90+'))}:</strong> ${ageC.cellsCappedTo90Plus}</div>
        <div><strong>${escapeHtml(t('Pseudonymized Subjects (§ 164.514(c))', '假名化受试者数 (§ 164.514(c))'))}:</strong> ${pseudo.uniqueSubjectsMapped} (${escapeHtml(pseudo.columns.join(', ') || t('None', '无'))})</div>
        <div style="margin-top:6px;"><strong>${escapeHtml(t('Free-Text Inline Scrubbing', '自由文本内联脱敏'))}:</strong> ${inlineSummaryHtml}</div>
      </section>
    </div>

    <h2>${escapeHtml(t('1. Column-by-Column De-Identification Rule Table', '一、逐列脱敏规则与执行明细表'))}</h2>
    <table class="audit-table">
      <thead>
        <tr>
          <th>${escapeHtml(t('Column', '字段名'))}</th>
          <th>${escapeHtml(t('Detected HIPAA Classification', '识别到的 HIPAA 标识符类别'))}</th>
          <th>${escapeHtml(t('Applied Transformation Rule', '执行的脱敏规则'))}</th>
          <th class="num">${escapeHtml(t('Cells Modified', '修改单元格'))}</th>
          <th class="num">${escapeHtml(t('Redaction Events', '脱敏事件数'))}</th>
        </tr>
      </thead>
      <tbody>
        ${colRowsHtml}
      </tbody>
    </table>

    <h2>${escapeHtml(t('2. 18 HIPAA Safe Harbor Identifier Redaction Ledger', '二、18 类 HIPAA 安全港标识符脱敏台账'))} (${activeCategories.length} / 18 ${escapeHtml(t('active', '类触发'))})</h2>
    <table class="audit-table">
      <thead>
        <tr>
          <th style="width:60px;">${escapeHtml(t('Code', '编号'))}</th>
          <th>${escapeHtml(t('HIPAA Safe Harbor Identifier', 'HIPAA 安全港标识符类别'))}</th>
          <th>${escapeHtml(t('Regulatory Citation', '法规条款'))}</th>
          <th class="num">${escapeHtml(t('Redactions', '脱敏计数'))}</th>
        </tr>
      </thead>
      <tbody>
        ${categoryRowsHtml}
      </tbody>
    </table>

    <h2>${escapeHtml(t('3. Investigator "No Actual Knowledge" Attestation Checklist', '三、研究者“无实际知情”合规核对清单'))}</h2>
    <section class="card">
      <ul class="checklist">
        ${attestationHtml}
      </ul>
      <div class="sig-grid">
        <div class="sig-line">${escapeHtml(t('Principal Investigator / Data Custodian Signature', '主要研究者 (PI) / 数据负责人签名'))}${d.studyMetadata.investigatorName ? `: ${escapeHtml(d.studyMetadata.investigatorName)}` : ''}</div>
        <div class="sig-line">${escapeHtml(t('IRB Protocol / Study ID', 'IRB 伦理编号 / 研究项目编号'))}${d.studyMetadata.studyProtocolId ? `: ${escapeHtml(d.studyMetadata.studyProtocolId)}` : ''}</div>
        <div class="sig-line">${escapeHtml(t('Review Date (YYYY-MM-DD)', '审核日期 (YYYY-MM-DD)'))}</div>
      </div>
    </section>

    <footer class="disclaimer">
      ${escapeHtml(isZh ? d.legalDisclaimer.zh : d.legalDisclaimer.en)}
    </footer>
  </article>
</body>
</html>`;
}
