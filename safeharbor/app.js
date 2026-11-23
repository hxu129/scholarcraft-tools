/**
 * SafeHarbor Studio Pro — Main Offline Web App Controller
 */

import {
  CLINICAL_BENCHMARK_CSV,
  DEFAULT_DATE_SHIFT_RANGE,
  FREE_MAX_EXPORT_ROWS,
  PURCHASE_URLS,
  RESTRICTED_ZIP3_PREFIXES,
} from './core/config.js';
import { parseDelimited } from './core/csv.js';
import {
  RULE_ACTIONS,
  deidentifyDataset,
} from './core/hipaa.js';
import {
  ATTESTATION_ITEMS,
  buildAuditCertificateData,
  escapeHtml,
  renderAuditCertificateHtml,
} from './core/certificate.js';
import {
  clearStoredLicense,
  getEntitlements,
  loadStoredLang,
  loadStoredLicense,
  saveStoredLang,
  saveStoredLicense,
  verifyLicenseKey,
} from './core/license.js';
import { buildSafeHarborBundleZip } from './core/zip.js';
import { fmt, getDict } from './core/i18n.js';

const state = {
  lang: 'en',
  license: null,
  rawText: '',
  sourceFilename: 'clinical_cohort.csv',
  parsed: null,
  result: null,
  auditData: null,
  columnOverrides: {},
  dateMode: 'year_only',
  shiftRangeDays: DEFAULT_DATE_SHIFT_RANGE,
  studySalt: 'safeharbor-study-2026',
  referenceYear: new Date().getFullYear(),
  studyProtocolId: '',
  investigatorName: '',
  activeTab: 'diff',
  auditRunNonce: 0,
};

const $ = (id) => document.getElementById(id);

let toastTimer = null;
function showToast(message) {
  const el = $('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 2800);
}

function downloadBlob(content, filename, mimeType) {
  const blob = content instanceof Uint8Array
    ? new Blob([content], { type: mimeType })
    : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fileStem(filename) {
  return String(filename || 'clinical_cohort')
    .replace(/\.[^.]+$/, '')
    .replace(/[^A-Za-z0-9._-]+/g, '_') || 'clinical_cohort';
}

function actionOptionsList(dict) {
  return [
    { value: RULE_ACTIONS.DROP, label: dict.actDrop },
    { value: RULE_ACTIONS.ZIP3, label: dict.actZip3 },
    { value: RULE_ACTIONS.DATE_YEAR_ONLY, label: dict.actDateYear },
    { value: RULE_ACTIONS.DATE_SHIFT, label: dict.actDateShift },
    { value: RULE_ACTIONS.AGE_CAP, label: dict.actAgeCap },
    { value: RULE_ACTIONS.PSEUDONYMIZE, label: dict.actPseudo },
    { value: RULE_ACTIONS.SCRUB_TEXT, label: dict.actScrub },
    { value: RULE_ACTIONS.KEEP, label: dict.actKeep },
  ];
}

function applyStaticI18n() {
  const d = getDict(state.lang);
  const ent = getEntitlements(state.license);

  document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
  document.title = d.pageTitle;

  $('appTagline').textContent = d.tagline;
  $('offlinePill').textContent = d.offlinePill;
  $('langBtn').textContent = d.langToggle;

  const badge = $('tierBadge');
  badge.textContent = ent.isPro ? d.tierPro : d.tierFree;
  badge.className = `tier-badge ${ent.isPro ? 'tier-pro' : 'tier-free'}`;

  $('licenseBtn').textContent = ent.isPro ? d.proUnlockedBtn : d.activateProBtn;
  $('licenseBtn').className = ent.isPro ? 'btn btn-teal-soft btn-sm' : 'btn btn-primary btn-sm';

  $('inputTitle').textContent = d.inputTitle;
  $('benchmarkBtn').textContent = d.loadBenchmarkBtn;
  $('uploadBtn').textContent = d.uploadBtn;
  $('clearBtn').textContent = d.clearBtn;
  $('dropHint').textContent = d.dropHint;
  $('dataInput').placeholder = d.inputPlaceholder;
  $('privacyNote').textContent = d.privacyNote;

  $('policyTitle').textContent = d.policyTitle;
  $('dateModeLabel').textContent = d.dateModeLabel;
  $('optDateYearOnly').textContent = d.dateModeYearOnly;
  $('optDateConsistentShift').textContent = d.dateModeConsistentShift;
  $('shiftRangeLabel').textContent = d.shiftRangeLabel;
  $('studySaltLabel').textContent = d.studySaltLabel;
  $('refYearLabel').textContent = d.refYearLabel;
  $('protocolIdLabel').textContent = d.protocolIdLabel;
  $('investigatorLabel').textContent = d.investigatorLabel;

  $('freeRowBannerTitle').textContent = d.freeRowBannerTitle;
  $('unlockFromRowBannerBtn').textContent = d.unlockNowBtn;
  $('freeShiftNoticeTitle').textContent = d.freeShiftNoticeTitle;
  $('freeShiftNoticeBody').textContent = d.freeShiftNoticeBody;
  $('unlockFromShiftBannerBtn').textContent = d.unlockNowBtn;

  $('columnsTitle').textContent = d.columnsTitle;
  $('resetOverridesBtn').textContent = d.resetOverridesBtn;
  $('thColName').textContent = d.colHeaderName;
  $('thColDetected').textContent = d.colHeaderDetected;
  $('thColRule').textContent = d.colHeaderRule;
  $('thColAffected').textContent = d.colHeaderAffected;

  $('exportTitle').textContent = d.exportTitle;
  $('exportCsvBtn').textContent = ent.isPro
    ? d.exportCsvBtn
    : `${d.exportCsvBtn} ${d.exportCsvFreeHint}`;
  $('exportCertHtmlLabel').textContent = d.exportCertHtmlBtn;
  $('exportCertJsonLabel').textContent = d.exportCertJsonBtn;
  $('exportReidLabel').textContent = d.exportReidBtn;
  $('exportZipLabel').textContent = d.exportZipBtn;
  $('exportCliLabel').textContent = d.exportCliBtn;

  for (const tagId of ['tagCertHtml', 'tagCertJson', 'tagReid', 'tagZip', 'tagCli']) {
    $(tagId).classList.toggle('hidden', ent.isPro);
  }

  $('tabDiffBtn').textContent = d.tabDiff;
  $('tabCleanBtn').textContent = d.tabClean;
  $('tabAuditBtn').textContent = d.tabAudit;
  $('tabReidBtn').textContent = d.tabReid;

  $('legendDropped').textContent = d.diffLegendDropped;
  $('legendModified').textContent = d.diffLegendModified;
  $('legendZeroed').textContent = d.diffLegendZeroed;
  $('legendCapped').textContent = d.diffLegendCapped;

  $('footerDisclaimer').textContent = d.footerDisclaimer;

  // Modals
  $('licenseModalTitle').textContent = d.licenseModalTitle;
  $('licenseSubtitle').textContent = d.licenseSubtitle;
  $('freeTierCol').textContent = d.freeTierCol;
  $('proTierCol').textContent = d.proTierCol;
  $('freeFeaturesList').innerHTML = d.freeFeatures.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  $('proFeaturesList').innerHTML = d.proFeatures.map((item) => `<li>${escapeHtml(item)}</li>`).join('');

  $('buyGumroadLink').textContent = d.buyGumroadBtn;
  $('buyGumroadLink').href = PURCHASE_URLS.gumroad;
  $('buyMbdLink').textContent = d.buyMbdBtn;
  $('buyMbdLink').href = PURCHASE_URLS.mianbaoduo;

  $('licenseInputLabel').textContent = d.licenseInputLabel;
  $('licenseKeyInput').placeholder = d.licenseInputPlaceholder;
  $('activateLicenseBtn').textContent = d.activateBtn;
  $('deactivateLicenseBtn').textContent = d.deactivateBtn;
  $('doneLicenseModalBtn').textContent = d.closeBtn;

  $('cliModalTitle').textContent = d.cliModalTitle;
  $('cliModalDesc').textContent = d.cliModalDesc;
  $('copyCliCmdBtn').textContent = d.copyCmdBtn;
  $('doneCliModalBtn').textContent = d.closeBtn;

  renderLicenseStatusInModal();
}

function renderLicenseStatusInModal() {
  const d = getDict(state.lang);
  const statusEl = $('licenseStatusMsg');
  const deactBtn = $('deactivateLicenseBtn');

  if (state.license?.valid) {
    statusEl.textContent = fmt(d.statusLicenseActive, {
      mode: state.license.mode,
      serial: state.license.serial,
    });
    statusEl.className = 'license-status ok';
    statusEl.classList.remove('hidden');
    deactBtn.classList.remove('hidden');
  } else {
    deactBtn.classList.add('hidden');
  }
}

function runPipeline() {
  const d = getDict(state.lang);
  const ent = getEntitlements(state.license);
  const raw = state.rawText;

  if (!raw.trim()) {
    state.parsed = null;
    state.result = null;
    state.auditData = null;
    renderAll();
    return;
  }

  state.parsed = parseDelimited(raw);
  if (state.parsed.headers.length === 0) {
    state.result = null;
    state.auditData = null;
    renderAll();
    return;
  }

  state.result = deidentifyDataset(state.parsed, {
    isPro: ent.isPro,
    maxRows: ent.maxExportRows,
    dateMode: state.dateMode,
    shiftRangeDays: state.shiftRangeDays,
    studySalt: state.studySalt,
    referenceYear: state.referenceYear,
    columnOverrides: state.columnOverrides,
  });

  renderAll();

  // Compute live WebCrypto SHA-256 certificate payload asynchronously
  const nonce = ++state.auditRunNonce;
  buildAuditCertificateData({
    rawInputText: raw,
    result: state.result,
    sourceFilename: state.sourceFilename,
    studyProtocolId: state.studyProtocolId,
    investigatorName: state.investigatorName,
  }).then((auditData) => {
    if (nonce !== state.auditRunNonce) return;
    state.auditData = auditData;
    renderHashChip();
    if (state.activeTab === 'audit') {
      renderAuditTab();
    }
  }).catch(() => {
    // Keep UI responsive even if subtle crypto is unavailable in an exotic test environment
  });

  // Update Free/Pro banners
  const showRowBanner = !ent.isPro && state.result.stats.inputRows > FREE_MAX_EXPORT_ROWS;
  $('freeRowBanner').classList.toggle('hidden', !showRowBanner);
  if (showRowBanner) {
    $('freeRowBannerBody').textContent = fmt(d.freeRowBannerBody, {
      total: state.result.stats.inputRows,
    });
  }

  const showShiftBanner = !ent.isPro && state.result.stats.dateStats.downgradedByFreeTier;
  $('freeShiftBanner').classList.toggle('hidden', !showShiftBanner);
}

function renderHashChip() {
  const el = $('exportHashPreview');
  if (!state.auditData) {
    el.textContent = '';
    return;
  }
  el.textContent = `SHA-256: ${state.auditData.hashes.outputSha256.slice(0, 16)}…`;
  el.title = `Input: ${state.auditData.hashes.inputSha256}\nOutput: ${state.auditData.hashes.outputSha256}`;
}

function renderAll() {
  renderMeta();
  renderColumnsTable();
  renderExportState();
  renderHashChip();
  renderDiffTab();
  renderCleanTab();
  renderAuditTab();
  renderReidTab();
}

function renderMeta() {
  const d = getDict(state.lang);
  const el = $('detectedMeta');
  if (!state.result) {
    el.textContent = d.metaEmpty;
    $('freeRowBanner').classList.add('hidden');
    $('freeShiftBanner').classList.add('hidden');
    return;
  }
  const s = state.result.stats;
  const fmtUpper = state.result.format.toUpperCase();
  el.textContent = state.lang === 'zh'
    ? `${fmtUpper} · ${s.inputRows} 行 × ${s.inputColumns} 列 · 检出 ${s.totalPhiColumnsDetected} 个 PHI 列`
    : `${fmtUpper} · ${s.inputRows} rows × ${s.inputColumns} cols · ${s.totalPhiColumnsDetected} PHI columns detected`;
}

function renderColumnsTable() {
  const d = getDict(state.lang);
  const emptyEl = $('columnsEmptyState');
  const wrapEl = $('columnsTableWrap');
  const tbody = $('columnsTableBody');
  const resetBtn = $('resetOverridesBtn');

  if (!state.result || state.result.columns.length === 0) {
    emptyEl.textContent = d.emptyPreview;
    emptyEl.classList.remove('hidden');
    wrapEl.classList.add('hidden');
    resetBtn.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  wrapEl.classList.remove('hidden');
  const hasAnyOverride = Object.keys(state.columnOverrides).length > 0;
  resetBtn.classList.toggle('hidden', !hasAnyOverride);

  const actions = actionOptionsList(d);
  tbody.innerHTML = '';

  for (const col of state.result.columns) {
    const tr = document.createElement('tr');

    const tdName = document.createElement('td');
    tdName.className = 'col-name-cell';
    tdName.textContent = col.name;

    const tdDetected = document.createElement('td');
    const codeClass = col.hipaaCode === 'SAFE'
      ? 'code-safe'
      : (col.detectedAction === RULE_ACTIONS.DROP ? 'code-phi' : 'code-transform');
    const srcLabel = col.detectionSource === 'header'
      ? d.sourceHeader
      : (col.detectionSource === 'content' ? d.sourceContent : d.sourceSafe);
    const labelText = state.lang === 'zh' ? col.hipaaLabelZh : col.hipaaLabelEn;
    tdDetected.innerHTML = `
      <div class="hipaa-tag">
        <span class="code-chip ${codeClass}">${escapeHtml(col.hipaaCode)}</span>
        <span>${escapeHtml(labelText)}</span>
        <span class="source-chip">${escapeHtml(srcLabel)}</span>
      </div>`;

    const tdRule = document.createElement('td');
    const sel = document.createElement('select');
    sel.className = `select-input override-select${col.wasOverridden ? ' is-overridden' : ''}`;
    sel.setAttribute('aria-label', `Rule for ${col.name}`);
    for (const opt of actions) {
      const optionEl = document.createElement('option');
      optionEl.value = opt.value;
      optionEl.textContent = opt.label;
      if (opt.value === col.appliedAction) optionEl.selected = true;
      sel.appendChild(optionEl);
    }
    sel.addEventListener('change', () => {
      const ent = getEntitlements(state.license);
      if (sel.value === RULE_ACTIONS.DATE_SHIFT && !ent.consistentDateShift) {
        state.columnOverrides[col.name] = RULE_ACTIONS.DATE_SHIFT;
        showToast(d.proRequiredToast);
      } else if (sel.value === col.detectedAction) {
        delete state.columnOverrides[col.name];
      } else {
        state.columnOverrides[col.name] = sel.value;
      }
      runPipeline();
    });
    tdRule.appendChild(sel);

    const tdAffected = document.createElement('td');
    tdAffected.className = 'num mono';
    tdAffected.textContent = String(col.cellsRedactedCount);

    tr.append(tdName, tdDetected, tdRule, tdAffected);
    tbody.appendChild(tr);
  }
}

function renderExportState() {
  const hasData = Boolean(state.result && state.result.stats.inputRows > 0);
  const hasReid = Boolean(state.result && state.result.reidKeyMap.length > 0);

  $('exportCsvBtn').disabled = !hasData;
  $('exportCertHtmlBtn').disabled = !hasData;
  $('exportCertJsonBtn').disabled = !hasData;
  $('exportReidBtn').disabled = !hasData || !hasReid;
  $('exportZipBtn').disabled = !hasData;
}

function renderEmptyCallout(container) {
  const d = getDict(state.lang);
  container.innerHTML = `
    <div class="empty-callout">
      <p>${escapeHtml(d.emptyPreview)}</p>
      <button type="button" class="btn btn-primary btn-sm" id="inlineBenchmarkBtn">${escapeHtml(d.loadBenchmarkBtn)}</button>
    </div>`;
  const btn = container.querySelector('#inlineBenchmarkBtn');
  if (btn) {
    btn.addEventListener('click', loadClinicalBenchmark);
  }
}

function renderDiffTab() {
  const d = getDict(state.lang);
  const container = $('diffContainer');
  const countEl = $('diffCountMeta');

  if (!state.result) {
    countEl.textContent = '';
    renderEmptyCallout(container);
    return;
  }

  const maxPreview = 100;
  const rowsToShow = state.result.previewRows.slice(0, maxPreview);
  countEl.textContent = fmt(d.diffShowing, {
    shown: rowsToShow.length,
    total: state.result.stats.inputRows,
  });

  const theadCols = state.result.columns.map((col) => {
    const cls = col.appliedAction === RULE_ACTIONS.DROP ? ' class="col-dropped"' : '';
    return `<th${cls}>${escapeHtml(col.name)}</th>`;
  }).join('');

  const bodyRows = rowsToShow.map((diffRow) => {
    const cells = diffRow.map((cell) => {
      if (cell.status === 'dropped') {
        return `<td class="cell-dropped"><span class="diff-old">${escapeHtml(cell.original)}</span><span class="diff-new">[DROPPED]</span></td>`;
      }
      if (cell.status === 'zip_zeroed') {
        return `<td class="cell-zeroed"><span class="diff-old">${escapeHtml(cell.original)}</span><span class="diff-new">→ ${escapeHtml(cell.transformed)}</span></td>`;
      }
      if (cell.status === 'capped') {
        return `<td class="cell-capped"><span class="diff-old">${escapeHtml(cell.original)}</span><span class="diff-new">→ ${escapeHtml(cell.transformed)}</span></td>`;
      }
      if (cell.status !== 'kept') {
        return `<td class="cell-modified"><span class="diff-old">${escapeHtml(cell.original)}</span><span class="diff-new">→ ${escapeHtml(cell.transformed)}</span></td>`;
      }
      return `<td>${escapeHtml(cell.transformed)}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  container.innerHTML = `<table class="data-table"><thead><tr>${theadCols}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

function renderCleanTab() {
  const container = $('cleanContainer');
  if (!state.result) {
    renderEmptyCallout(container);
    return;
  }

  const maxPreview = 100;
  const rowsToShow = state.result.outputRows.slice(0, maxPreview);
  const thead = state.result.outputHeaders.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const tbody = rowsToShow.map((row) => {
    return `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`;
  }).join('');

  container.innerHTML = `<table class="data-table"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
}

function renderAuditTab() {
  const d = getDict(state.lang);
  const container = $('auditContainer');
  if (!state.result) {
    renderEmptyCallout(container);
    return;
  }

  const s = state.result.stats;
  const isZh = state.lang === 'zh';
  const hashes = state.auditData?.hashes;

  const warningsHtml = state.result.warnings.length > 0
    ? `<div class="warn-box">
        <strong>${escapeHtml(d.auditWarningsTitle)}</strong>
        <ul>${state.result.warnings.map((w) => `<li>${escapeHtml(isZh ? w.messageZh : w.messageEn)}</li>`).join('')}</ul>
      </div>`
    : '';

  const prefixBadges = RESTRICTED_ZIP3_PREFIXES.map((p) => {
    const hit = s.zipStats.restrictedPrefixesHit.includes(p);
    return `<span class="prefix-badge${hit ? ' hit' : ''}">${p}${hit ? ' → 000' : ''}</span>`;
  }).join('');

  const activeLedger = Object.entries(s.categoryCounts)
    .map(([code, count]) => ({ code, count }))
    .filter((entry) => entry.count > 0);

  const ledgerRows = activeLedger.length > 0
    ? activeLedger.map(({ code, count }) => {
      const colMatch = state.result.columns.find((c) => c.hipaaCode === code);
      const label = colMatch ? (isZh ? colMatch.hipaaLabelZh : colMatch.hipaaLabelEn) : `HIPAA (${code})`;
      return `<tr><td class="mono">(${escapeHtml(code)})</td><td>${escapeHtml(label)}</td><td class="num mono"><strong>${count}</strong></td></tr>`;
    }).join('')
    : `<tr><td colspan="3" class="detected-meta">${escapeHtml(isZh ? '尚未触发脱敏计数' : 'No PHI redactions triggered')}</td></tr>`;

  const dateModeDesc = s.dateStats.modeApplied === 'consistent_shift'
    ? (isZh
      ? `受试者一致性纵向偏移（±${s.dateStats.shiftRangeDays} 天，关联主键：${s.dateStats.subjectIdColumn || '按行'}）`
      : `Consistent Per-Subject Shift (±${s.dateStats.shiftRangeDays} days, linked by: ${s.dateStats.subjectIdColumn || 'row'})`)
    : (isZh ? '仅保留 4 位年份 (Year Only)' : 'Year Only (4-Digit Year)');

  container.innerHTML = `
    ${warningsHtml}

    <div class="audit-kpi-grid">
      <div class="kpi-card"><div class="kpi-label">${escapeHtml(d.auditKpiPhiCols)}</div><div class="kpi-val">${s.totalPhiColumnsDetected}</div></div>
      <div class="kpi-card"><div class="kpi-label">${escapeHtml(d.auditKpiDropped)}</div><div class="kpi-val">${s.droppedColumnCount}</div></div>
      <div class="kpi-card"><div class="kpi-label">${escapeHtml(d.auditKpiCells)}</div><div class="kpi-val">${s.totalCellsModified}</div></div>
      <div class="kpi-card"><div class="kpi-label">${escapeHtml(d.auditKpiZipZeroed)}</div><div class="kpi-val">${s.zipStats.restrictedZeroed}</div></div>
      <div class="kpi-card"><div class="kpi-label">${escapeHtml(d.auditKpiAgeCapped)}</div><div class="kpi-val">${s.ageStats.cellsCappedTo90Plus + s.dateStats.birthYearsOver89Capped}</div></div>
      <div class="kpi-card"><div class="kpi-label">${escapeHtml(d.auditKpiSubjects)}</div><div class="kpi-val">${s.pseudonymStats.uniqueSubjectsMapped}</div></div>
    </div>

    <div class="audit-section">
      <h3>${escapeHtml(d.auditHashesTitle)}</h3>
      <div class="hash-row"><strong>${escapeHtml(d.auditInputHash)}</strong><span class="mono">${escapeHtml(hashes?.inputSha256 || 'Computing…')}</span></div>
      <div class="hash-row"><strong>${escapeHtml(d.auditOutputHash)}</strong><span class="mono">${escapeHtml(hashes?.outputSha256 || 'Computing…')}</span></div>
      <div class="hash-row"><strong>${escapeHtml(d.auditReidHash)}</strong><span class="mono">${escapeHtml(hashes?.reidKeyMapSha256 || 'N/A')}</span></div>
    </div>

    <div class="audit-section">
      <h3>${escapeHtml(d.auditZipTitle)}</h3>
      <div class="detected-meta">
        ${escapeHtml(isZh
          ? `已处理邮编单元格：${s.zipStats.totalProcessed} · 受限归零：${s.zipStats.restrictedZeroed} · 常规保留前3位：${s.zipStats.normalTruncated}`
          : `Processed ZIP cells: ${s.zipStats.totalProcessed} · Restricted zeroed: ${s.zipStats.restrictedZeroed} · Normal 3-digit retained: ${s.zipStats.normalTruncated}`)}
      </div>
      <div class="prefix-grid">${prefixBadges}</div>
    </div>

    <div class="audit-section">
      <h3>${escapeHtml(d.auditDateTitle)}</h3>
      <div><strong>${escapeHtml(dateModeDesc)}</strong></div>
      <div class="detected-meta" style="margin-top:4px;">
        ${escapeHtml(isZh
          ? `日期列：${s.dateStats.dateColumns.join(', ') || '无'} · 转换单元格：${s.dateStats.cellsTransformed} · >89 岁出生年封顶：${s.dateStats.birthYearsOver89Capped}`
          : `Date columns: ${s.dateStats.dateColumns.join(', ') || 'None'} · Cells transformed: ${s.dateStats.cellsTransformed} · Birth years >89 capped: ${s.dateStats.birthYearsOver89Capped}`)}
      </div>
    </div>

    <div class="audit-section">
      <h3>${escapeHtml(d.auditLedgerTitle)}</h3>
      <table class="rules-table">
        <tbody>${ledgerRows}</tbody>
      </table>
    </div>

    <div class="audit-section">
      <h3>${escapeHtml(d.auditAttestTitle)}</h3>
      <ul class="attest-list">
        ${ATTESTATION_ITEMS.map((item) => `<li><span>☐</span><span>${escapeHtml(isZh ? item.zh : item.en)}</span></li>`).join('')}
      </ul>
    </div>`;
}

function renderReidTab() {
  const d = getDict(state.lang);
  const ent = getEntitlements(state.license);
  const container = $('reidContainer');

  if (!state.result) {
    renderEmptyCallout(container);
    return;
  }

  if (!ent.reidKeyMapExport) {
    container.innerHTML = `
      <div class="reid-locked">
        <h3>${escapeHtml(d.reidLockedTitle)}</h3>
        <p>${escapeHtml(d.reidLockedBody)}</p>
        <button type="button" class="btn btn-amber btn-sm" id="unlockFromReidBtn">${escapeHtml(d.unlockNowBtn)}</button>
      </div>`;
    container.querySelector('#unlockFromReidBtn')?.addEventListener('click', openLicenseModal);
    return;
  }

  if (state.result.reidKeyMap.length === 0) {
    container.innerHTML = `<div class="empty-inline">${escapeHtml(d.reidEmpty)}</div>`;
    return;
  }

  const rowsHtml = state.result.reidKeyMap.map((entry) => `
    <tr>
      <td class="mono"><strong>${escapeHtml(entry.study_subject_id)}</strong></td>
      <td class="mono">${escapeHtml(entry.source_column)}</td>
      <td class="mono">${escapeHtml(entry.original_identifier)}</td>
      <td class="num mono">${entry.date_shift_days === '' ? '—' : escapeHtml(String(entry.date_shift_days))}</td>
    </tr>`).join('');

  container.innerHTML = `
    <div class="reid-banner">${escapeHtml(d.reidWarningBanner)}</div>
    <div class="table-scroll preview-scroll">
      <table class="data-table">
        <thead>
          <tr>
            <th>study_subject_id</th>
            <th>source_column</th>
            <th>original_identifier</th>
            <th class="num">date_shift_days</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>`;
}

function loadClinicalBenchmark() {
  state.sourceFilename = 'clinical_cohort_benchmark.csv';
  state.rawText = CLINICAL_BENCHMARK_CSV;
  state.columnOverrides = {};
  $('dataInput').value = CLINICAL_BENCHMARK_CSV;
  runPipeline();
}

function buildCliCommandPreview() {
  const inFile = state.sourceFilename || 'clinical_cohort.csv';
  const stem = fileStem(inFile);
  const ext = state.result?.format === 'tsv' ? 'tsv' : 'csv';
  const parts = [
    'python3 cli/safeharbor.py',
    `--input "${inFile}"`,
    `--output "${stem}_deidentified.${ext}"`,
    `--date-mode ${state.dateMode}`,
  ];
  if (state.dateMode === 'consistent_shift') {
    parts.push(`--shift-range ${state.shiftRangeDays}`);
    parts.push(`--salt "${state.studySalt}"`);
  }
  parts.push(`--reference-year ${state.referenceYear}`);
  parts.push('--reid-map "reid_key_map_DO_NOT_SHARE.csv"');
  parts.push('--audit-json "IRB_DeIdentification_Audit_Log.json"');
  for (const [col, act] of Object.entries(state.columnOverrides)) {
    parts.push(`--override "${col}=${act}"`);
  }
  return parts.join(' \\\n  ');
}

/* ---------- Modal Helpers ---------- */

function openLicenseModal() {
  renderLicenseStatusInModal();
  $('licenseModal').classList.remove('hidden');
  $('licenseKeyInput').focus();
}

function closeLicenseModal() {
  $('licenseModal').classList.add('hidden');
}

function openCliModal() {
  const d = getDict(state.lang);
  const ent = getEntitlements(state.license);
  if (!ent.cliScript) {
    showToast(d.proRequiredToast);
    openLicenseModal();
    return;
  }
  $('cliCommandPre').textContent = buildCliCommandPreview();
  $('cliModal').classList.remove('hidden');
}

function closeCliModal() {
  $('cliModal').classList.add('hidden');
}

async function ensureAuditData() {
  if (state.auditData) return state.auditData;
  state.auditData = await buildAuditCertificateData({
    rawInputText: state.rawText,
    result: state.result,
    sourceFilename: state.sourceFilename,
    studyProtocolId: state.studyProtocolId,
    investigatorName: state.investigatorName,
  });
  return state.auditData;
}

/* ---------- Event Wiring ---------- */

function wireEvents() {
  // Language toggle
  $('langBtn').addEventListener('click', async () => {
    state.lang = state.lang === 'zh' ? 'en' : 'zh';
    await saveStoredLang(state.lang);
    applyStaticI18n();
    renderAll();
  });

  // Load benchmark / Upload / Clear
  $('benchmarkBtn').addEventListener('click', loadClinicalBenchmark);
  $('uploadBtn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    readUploadedFile(file);
    ev.target.value = '';
  });
  $('clearBtn').addEventListener('click', () => {
    state.rawText = '';
    state.sourceFilename = 'clinical_cohort.csv';
    state.columnOverrides = {};
    $('dataInput').value = '';
    runPipeline();
  });

  // Drag & Drop
  const dropZone = $('dropZone');
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-active');
  });
  dropZone.addEventListener('dragleave', (e) => {
    if (!dropZone.contains(e.relatedTarget)) {
      dropZone.classList.remove('drag-active');
    }
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-active');
    const file = e.dataTransfer?.files?.[0];
    if (file) readUploadedFile(file);
  });

  // Live textarea input
  let inputDebounce = null;
  $('dataInput').addEventListener('input', (e) => {
    state.rawText = e.target.value;
    clearTimeout(inputDebounce);
    inputDebounce = setTimeout(() => runPipeline(), 120);
  });

  // Global policy inputs
  $('dateModeSelect').addEventListener('change', (e) => {
    state.dateMode = e.target.value;
    runPipeline();
  });
  $('shiftRangeInput').addEventListener('change', (e) => {
    state.shiftRangeDays = Math.max(1, Math.min(3650, Number(e.target.value) || DEFAULT_DATE_SHIFT_RANGE));
    e.target.value = String(state.shiftRangeDays);
    runPipeline();
  });
  $('studySaltInput').addEventListener('input', (e) => {
    state.studySalt = e.target.value || 'safeharbor-study-2026';
    runPipeline();
  });
  $('refYearInput').addEventListener('change', (e) => {
    state.referenceYear = Math.max(1990, Math.min(2100, Number(e.target.value) || new Date().getFullYear()));
    e.target.value = String(state.referenceYear);
    runPipeline();
  });
  $('protocolIdInput').addEventListener('input', (e) => {
    state.studyProtocolId = e.target.value;
    if (state.result) runPipeline();
  });
  $('investigatorInput').addEventListener('input', (e) => {
    state.investigatorName = e.target.value;
    if (state.result) runPipeline();
  });

  $('resetOverridesBtn').addEventListener('click', () => {
    state.columnOverrides = {};
    runPipeline();
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeTab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
      $('panelDiff').classList.toggle('active', state.activeTab === 'diff');
      $('panelClean').classList.toggle('active', state.activeTab === 'clean');
      $('panelAudit').classList.toggle('active', state.activeTab === 'audit');
      $('panelReid').classList.toggle('active', state.activeTab === 'reid');
      if (state.activeTab === 'audit') renderAuditTab();
      if (state.activeTab === 'reid') renderReidTab();
    });
  });

  // Exports
  $('exportCsvBtn').addEventListener('click', () => {
    if (!state.result) return;
    const ext = state.result.format === 'tsv' ? 'tsv' : 'csv';
    const mime = ext === 'tsv' ? 'text/tab-separated-values;charset=utf-8' : 'text/csv;charset=utf-8';
    downloadBlob(state.result.cleanCsv, `${fileStem(state.sourceFilename)}_deidentified.${ext}`, mime);
  });

  $('exportCertHtmlBtn').addEventListener('click', async () => {
    const d = getDict(state.lang);
    const ent = getEntitlements(state.license);
    if (!ent.auditCertificateExport) {
      showToast(d.proRequiredToast);
      openLicenseModal();
      return;
    }
    if (!state.result) return;
    const audit = await ensureAuditData();
    const html = renderAuditCertificateHtml(audit, state.lang);
    downloadBlob(html, `IRB_Audit_Certificate_${audit.certificateId}.html`, 'text/html;charset=utf-8');
  });

  $('exportCertJsonBtn').addEventListener('click', async () => {
    const d = getDict(state.lang);
    const ent = getEntitlements(state.license);
    if (!ent.auditCertificateExport) {
      showToast(d.proRequiredToast);
      openLicenseModal();
      return;
    }
    if (!state.result) return;
    const audit = await ensureAuditData();
    const json = JSON.stringify(audit, null, 2);
    downloadBlob(json, `IRB_Audit_Log_${audit.certificateId}.json`, 'application/json;charset=utf-8');
  });

  $('exportReidBtn').addEventListener('click', () => {
    const d = getDict(state.lang);
    const ent = getEntitlements(state.license);
    if (!ent.reidKeyMapExport) {
      showToast(d.proRequiredToast);
      openLicenseModal();
      return;
    }
    if (!state.result?.reidKeyMapCsv) return;
    downloadBlob(state.result.reidKeyMapCsv, 'reid_key_map_DO_NOT_SHARE.csv', 'text/csv;charset=utf-8');
  });

  $('exportZipBtn').addEventListener('click', async () => {
    const d = getDict(state.lang);
    const ent = getEntitlements(state.license);
    if (!ent.zipBundleExport) {
      showToast(d.proRequiredToast);
      openLicenseModal();
      return;
    }
    if (!state.result) return;
    const audit = await ensureAuditData();
    const html = renderAuditCertificateHtml(audit, state.lang);
    const json = JSON.stringify(audit, null, 2);
    const ext = state.result.format === 'tsv' ? 'tsv' : 'csv';
    const zip = buildSafeHarborBundleZip({
      cleanCsv: state.result.cleanCsv,
      cleanFilename: `${fileStem(state.sourceFilename)}_deidentified.${ext}`,
      certificateHtml: html,
      certificateJson: json,
      includeReidMap: false,
    });
    downloadBlob(zip.bytes, zip.filename, 'application/zip');
  });

  $('exportCliBtn').addEventListener('click', openCliModal);

  // License Modal triggers
  $('licenseBtn').addEventListener('click', openLicenseModal);
  $('unlockFromRowBannerBtn').addEventListener('click', openLicenseModal);
  $('unlockFromShiftBannerBtn').addEventListener('click', openLicenseModal);
  $('closeLicenseModalBtn').addEventListener('click', closeLicenseModal);
  $('doneLicenseModalBtn').addEventListener('click', closeLicenseModal);
  $('licenseModal').addEventListener('click', (e) => {
    if (e.target === $('licenseModal')) closeLicenseModal();
  });

  $('activateLicenseBtn').addEventListener('click', async () => {
    const d = getDict(state.lang);
    const key = $('licenseKeyInput').value.trim();
    const statusEl = $('licenseStatusMsg');

    const res = await verifyLicenseKey(key);
    if (res.valid) {
      state.license = await saveStoredLicense(res);
      $('licenseKeyInput').value = '';
      applyStaticI18n();
      runPipeline();
      statusEl.textContent = fmt(d.statusLicenseActive, {
        mode: res.mode,
        serial: res.serial,
      });
      statusEl.className = 'license-status ok';
      statusEl.classList.remove('hidden');
      showToast(statusEl.textContent);
    } else {
      statusEl.textContent = fmt(d.statusLicenseInvalid, { reason: res.reason || res.reasonCode });
      statusEl.className = 'license-status err';
      statusEl.classList.remove('hidden');
    }
  });

  $('deactivateLicenseBtn').addEventListener('click', async () => {
    const d = getDict(state.lang);
    await clearStoredLicense();
    state.license = null;
    applyStaticI18n();
    runPipeline();
    const statusEl = $('licenseStatusMsg');
    statusEl.textContent = d.statusLicenseRemoved;
    statusEl.className = 'license-status err';
    statusEl.classList.remove('hidden');
  });

  // CLI Modal triggers
  $('closeCliModalBtn').addEventListener('click', closeCliModal);
  $('doneCliModalBtn').addEventListener('click', closeCliModal);
  $('cliModal').addEventListener('click', (e) => {
    if (e.target === $('cliModal')) closeCliModal();
  });
  $('copyCliCmdBtn').addEventListener('click', async () => {
    const d = getDict(state.lang);
    try {
      await navigator.clipboard.writeText($('cliCommandPre').textContent);
      showToast(d.copiedToast);
    } catch {
      showToast('Select and copy the command above.');
    }
  });
}

function readUploadedFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    state.sourceFilename = file.name || 'clinical_cohort.csv';
    state.rawText = String(reader.result || '');
    state.columnOverrides = {};
    $('dataInput').value = state.rawText;
    runPipeline();
  };
  reader.readAsText(file, 'utf-8');
}

async function init() {
  const savedLang = await loadStoredLang();
  if (savedLang) {
    state.lang = savedLang;
  } else {
    state.lang = (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }

  state.license = await loadStoredLicense();
  $('refYearInput').value = String(state.referenceYear);

  applyStaticI18n();
  wireEvents();
  renderAll();
}

init();
