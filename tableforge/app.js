/**
 * TableForge Pro — Web App & Chrome MV3 Side Panel Controller
 * Zero external dependencies, CSP-clean (no inline scripts or eval).
 */

import {
  DEFAULT_CAPTION_EN,
  DEFAULT_CAPTION_ZH,
  DEFAULT_LABEL,
  DEMO_CSV,
  PURCHASE_URLS,
  VENUE_PRESETS,
} from './core/config.js';
import { detectDefaultLang, getCopy } from './core/i18n.js';
import {
  clearStoredLicense,
  getEntitlements,
  loadStoredLang,
  loadStoredLicense,
  saveStoredLang,
  saveStoredLicense,
  verifyLicenseKey,
} from './core/license.js';
import {
  analyzeTable,
  buildCliCommand,
  escapeHtml,
  exportLatex,
  exportMarkdown,
  exportTypst,
  exportWordHtml,
  parseDelimitedTable,
} from './core/table-engine.js';

const state = {
  lang: detectDefaultLang(),
  license: null,
  rawText: DEMO_CSV,
  parsed: null,
  analyzed: null,
  directionOverrides: {},
  preset: 'neurips',
  precision: 'auto',
  baselineRow: '',
  deltaMode: 'abs',
  boldBest: true,
  underlineSecond: true,
  showArrows: true,
  useSiunitx: false,
  useResizebox: false,
  caption: '',
  captionEdited: false,
  label: DEFAULT_LABEL,
  activeFormat: 'latex',
};

const el = {
  tierBadge: document.getElementById('tierBadge'),
  appTagline: document.getElementById('appTagline'),
  licenseBtn: document.getElementById('licenseBtn'),
  langBtn: document.getElementById('langBtn'),

  dropZone: document.getElementById('dropZone'),
  dropHint: document.getElementById('dropHint'),
  inputTitle: document.getElementById('inputTitle'),
  detectedMeta: document.getElementById('detectedMeta'),
  demoBtn: document.getElementById('demoBtn'),
  uploadBtn: document.getElementById('uploadBtn'),
  fileInput: document.getElementById('fileInput'),
  clearBtn: document.getElementById('clearBtn'),
  dataInput: document.getElementById('dataInput'),
  freeLimitBanner: document.getElementById('freeLimitBanner'),
  freeLimitTitle: document.getElementById('freeLimitTitle'),
  freeLimitBody: document.getElementById('freeLimitBody'),
  unlockFromBannerBtn: document.getElementById('unlockFromBannerBtn'),
  privacyNote: document.getElementById('privacyNote'),

  controlsTitle: document.getElementById('controlsTitle'),
  colDirectionsLabel: document.getElementById('colDirectionsLabel'),
  colPills: document.getElementById('colPills'),
  venueLabel: document.getElementById('venueLabel'),
  presetSelect: document.getElementById('presetSelect'),
  precisionLabel: document.getElementById('precisionLabel'),
  precisionSelect: document.getElementById('precisionSelect'),
  optPrecisionAuto: document.getElementById('optPrecisionAuto'),
  baselineLabel: document.getElementById('baselineLabel'),
  baselineProTag: document.getElementById('baselineProTag'),
  baselineSelect: document.getElementById('baselineSelect'),
  deltaModeLabel: document.getElementById('deltaModeLabel'),
  deltaModeSelect: document.getElementById('deltaModeSelect'),
  optDeltaAbs: document.getElementById('optDeltaAbs'),
  optDeltaPct: document.getElementById('optDeltaPct'),
  chkBold: document.getElementById('chkBold'),
  lblBold: document.getElementById('lblBold'),
  chkUnderline: document.getElementById('chkUnderline'),
  lblUnderline: document.getElementById('lblUnderline'),
  chkArrows: document.getElementById('chkArrows'),
  lblArrows: document.getElementById('lblArrows'),
  chkSiunitx: document.getElementById('chkSiunitx'),
  lblSiunitx: document.getElementById('lblSiunitx'),
  siunitxProTag: document.getElementById('siunitxProTag'),
  chkResizebox: document.getElementById('chkResizebox'),
  lblResizebox: document.getElementById('lblResizebox'),
  captionLabel: document.getElementById('captionLabel'),
  captionInput: document.getElementById('captionInput'),
  labelFieldLabel: document.getElementById('labelFieldLabel'),
  labelInput: document.getElementById('labelInput'),

  previewTitle: document.getElementById('previewTitle'),
  previewMeta: document.getElementById('previewMeta'),
  previewLegend: document.getElementById('previewLegend'),
  legendBest: document.getElementById('legendBest'),
  legendSecond: document.getElementById('legendSecond'),
  legendBaselineWrap: document.getElementById('legendBaselineWrap'),
  legendBaseline: document.getElementById('legendBaseline'),
  emptyPreview: document.getElementById('emptyPreview'),
  emptyPreviewTitle: document.getElementById('emptyPreviewTitle'),
  emptyPreviewDesc: document.getElementById('emptyPreviewDesc'),
  paperStage: document.getElementById('paperStage'),
  academicPreview: document.getElementById('academicPreview'),

  outputTitle: document.getElementById('outputTitle'),
  tabLatex: document.getElementById('tabLatex'),
  tabWord: document.getElementById('tabWord'),
  tabWordText: document.getElementById('tabWordText'),
  tabWordProTag: document.getElementById('tabWordProTag'),
  tabTypst: document.getElementById('tabTypst'),
  tabTypstText: document.getElementById('tabTypstText'),
  tabTypstProTag: document.getElementById('tabTypstProTag'),
  tabMarkdown: document.getElementById('tabMarkdown'),
  copyPrimaryBtn: document.getElementById('copyPrimaryBtn'),
  copyWordQuickBtn: document.getElementById('copyWordQuickBtn'),
  downloadTexBtn: document.getElementById('downloadTexBtn'),
  copyCliBtn: document.getElementById('copyCliBtn'),
  copyCliText: document.getElementById('copyCliText'),
  cliProTag: document.getElementById('cliProTag'),
  wordHint: document.getElementById('wordHint'),
  codeOutput: document.getElementById('codeOutput'),
  proLockedOverlay: document.getElementById('proLockedOverlay'),
  proLockedOverlayTitle: document.getElementById('proLockedOverlayTitle'),
  proLockedOverlayDesc: document.getElementById('proLockedOverlayDesc'),
  unlockFromOverlayBtn: document.getElementById('unlockFromOverlayBtn'),

  licenseModal: document.getElementById('licenseModal'),
  modalTitle: document.getElementById('modalTitle'),
  modalSubtitle: document.getElementById('modalSubtitle'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  licenseActiveBox: document.getElementById('licenseActiveBox'),
  licenseActiveText: document.getElementById('licenseActiveText'),
  deactivateBtn: document.getElementById('deactivateBtn'),
  tierFreeTitle: document.getElementById('tierFreeTitle'),
  tierFreeList: document.getElementById('tierFreeList'),
  tierProTitle: document.getElementById('tierProTitle'),
  tierProList: document.getElementById('tierProList'),
  buyTitle: document.getElementById('buyTitle'),
  buyMianbaoduo: document.getElementById('buyMianbaoduo'),
  buyGumroad: document.getElementById('buyGumroad'),
  licenseForm: document.getElementById('licenseForm'),
  activateLabel: document.getElementById('activateLabel'),
  licenseKeyInput: document.getElementById('licenseKeyInput'),
  activateBtn: document.getElementById('activateBtn'),
  licenseError: document.getElementById('licenseError'),
  toast: document.getElementById('toast'),
};

let toastTimer = null;

function showToast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.toast.classList.add('hidden');
  }, 2600);
}

function getEffectiveCaption() {
  if (state.captionEdited && state.caption.trim()) {
    return state.caption.trim();
  }
  return state.lang === 'zh' ? DEFAULT_CAPTION_ZH : DEFAULT_CAPTION_EN;
}

function isProActive() {
  return Boolean(state.license?.valid);
}

function openLicenseModal() {
  el.licenseError.classList.add('hidden');
  el.licenseModal.classList.remove('hidden');
  el.licenseKeyInput.focus();
}

function closeLicenseModal() {
  el.licenseModal.classList.add('hidden');
}

/* ---------- Bilingual Copy Application ---------- */

function applyI18n() {
  const t = getCopy(state.lang);
  document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
  document.title = t.appTitle;

  const isPro = isProActive();
  el.tierBadge.textContent = isPro ? t.tierPro : t.tierFree;
  el.tierBadge.classList.toggle('tier-pro', isPro);
  el.tierBadge.classList.toggle('tier-free', !isPro);

  el.appTagline.textContent = t.tagline;
  el.licenseBtn.textContent = isPro ? t.proActiveBtn : t.unlockPro;
  el.langBtn.textContent = t.langSwitch;

  el.inputTitle.textContent = t.inputTitle;
  el.demoBtn.textContent = t.loadDemo;
  el.uploadBtn.textContent = t.uploadFile;
  el.clearBtn.textContent = t.clearBtn;
  el.dropHint.textContent = t.dropHint;
  el.dataInput.placeholder = t.inputPlaceholder;
  el.privacyNote.textContent = t.privacyNote;
  el.freeLimitTitle.textContent = t.freeLimitTitle;
  el.unlockFromBannerBtn.textContent = t.unlockNow;

  el.controlsTitle.textContent = t.controlsTitle;
  el.colDirectionsLabel.textContent = t.colDirectionsLabel;
  el.venueLabel.textContent = t.venueLabel;
  el.precisionLabel.textContent = t.precisionLabel;
  el.optPrecisionAuto.textContent = t.precisionAuto;
  el.baselineLabel.textContent = t.baselineLabel;
  el.deltaModeLabel.textContent = t.deltaModeLabel;
  el.optDeltaAbs.textContent = t.deltaModeAbs;
  el.optDeltaPct.textContent = t.deltaModePct;
  el.lblBold.textContent = t.optBold;
  el.lblUnderline.textContent = t.optUnderline;
  el.lblArrows.textContent = t.optArrows;
  el.lblSiunitx.textContent = t.optSiunitx;
  el.lblResizebox.textContent = t.optResizebox;
  el.captionLabel.textContent = t.captionLabel;
  el.labelFieldLabel.textContent = t.labelFieldLabel;

  // Update venue option labels cleanly
  for (const opt of el.presetSelect.options) {
    const p = VENUE_PRESETS[opt.value];
    if (p) opt.textContent = state.lang === 'zh' ? p.labelZh : p.labelEn;
  }

  // Hide PRO tags when Pro is unlocked
  el.baselineProTag.classList.toggle('hidden', isPro);
  el.siunitxProTag.classList.toggle('hidden', isPro);
  el.tabWordProTag.classList.toggle('hidden', isPro);
  el.tabTypstProTag.classList.toggle('hidden', isPro);
  el.cliProTag.classList.toggle('hidden', isPro);

  el.previewTitle.textContent = t.previewTitle;
  el.legendBest.textContent = t.legendBest;
  el.legendSecond.textContent = t.legendSecond;
  el.legendBaseline.textContent = t.legendBaseline;
  el.emptyPreviewTitle.textContent = t.emptyPreviewTitle;
  el.emptyPreviewDesc.textContent = t.emptyPreviewDesc;

  el.outputTitle.textContent = t.outputTitle;
  el.tabLatex.textContent = t.tabLatex;
  el.tabWordText.textContent = t.tabWord;
  el.tabTypstText.textContent = t.tabTypst;
  el.tabMarkdown.textContent = t.tabMarkdown;
  el.copyWordQuickBtn.textContent = t.copyWord;
  el.downloadTexBtn.textContent = t.downloadTex;
  el.copyCliText.textContent = t.copyCliCmd;
  el.wordHint.textContent = t.wordHint;
  el.proLockedOverlayTitle.textContent = t.proLockedOverlayTitle;
  el.proLockedOverlayDesc.textContent = t.proLockedOverlayDesc;
  el.unlockFromOverlayBtn.textContent = t.unlockNow;

  // Modal
  el.modalTitle.textContent = t.modalTitle;
  el.modalSubtitle.textContent = t.modalSubtitle;
  el.tierFreeTitle.textContent = t.tierFreeTitle;
  el.tierProTitle.textContent = t.tierProTitle;
  el.tierFreeList.innerHTML = t.tierFreeItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  el.tierProList.innerHTML = t.tierProItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  el.buyTitle.textContent = t.buyTitle;
  el.buyMianbaoduo.textContent = t.buyMianbaoduo;
  el.buyMianbaoduo.href = PURCHASE_URLS.mianbaoduo;
  el.buyGumroad.textContent = t.buyGumroad;
  el.buyGumroad.href = PURCHASE_URLS.gumroad;
  el.activateLabel.textContent = t.activateLabel;
  el.licenseKeyInput.placeholder = t.keyPlaceholder;
  el.activateBtn.textContent = t.activateBtn;
  el.deactivateBtn.textContent = t.deactivateBtn;

  if (isPro) {
    el.licenseActiveBox.classList.remove('hidden');
    el.licenseActiveText.textContent = t.licenseActiveInfo(state.license.serial, state.license.batch);
  } else {
    el.licenseActiveBox.classList.add('hidden');
  }

  if (!state.captionEdited) {
    el.captionInput.value = getEffectiveCaption();
  }
}

/* ---------- Core Parse, Analyze & Render Pipeline ---------- */

function getExportOptions() {
  return {
    preset: state.preset,
    precision: state.precision,
    boldBest: state.boldBest,
    underlineSecond: state.underlineSecond,
    showArrows: state.showArrows,
    useSiunitx: state.useSiunitx && isProActive(),
    useResizebox: state.useResizebox,
    caption: getEffectiveCaption(),
    label: (state.label || DEFAULT_LABEL).trim() || DEFAULT_LABEL,
  };
}

function renderColumnPills(analyzed) {
  const t = getCopy(state.lang);
  el.colPills.innerHTML = '';
  if (analyzed.empty) return;

  for (const col of analyzed.columns) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `col-pill dir-${col.direction}`;
    btn.dataset.colIndex = String(col.index);

    const badgeText = col.direction === 'max'
      ? t.dirMax
      : (col.direction === 'min' ? t.dirMin : t.dirNone);

    const nameSpan = document.createElement('span');
    nameSpan.textContent = col.header;
    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'col-pill-badge';
    badgeSpan.textContent = badgeText;

    btn.appendChild(nameSpan);
    btn.appendChild(badgeSpan);

    btn.addEventListener('click', () => {
      const order = ['max', 'min', 'none'];
      const next = order[(order.indexOf(col.direction) + 1) % order.length];
      state.directionOverrides[col.index] = next;
      recomputeAndRender();
    });

    el.colPills.appendChild(btn);
  }
}

function renderBaselineOptions(analyzed) {
  const t = getCopy(state.lang);
  const currentVal = String(state.baselineRow);
  el.baselineSelect.innerHTML = '';

  const noneOpt = document.createElement('option');
  noneOpt.value = '';
  noneOpt.textContent = t.baselineNone;
  el.baselineSelect.appendChild(noneOpt);

  if (!analyzed.empty) {
    analyzed.dataRows.forEach((row, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      const firstLabel = row.cells[0]?.meanText || `Row ${idx + 1}`;
      opt.textContent = `#${idx + 1} ${firstLabel}`;
      el.baselineSelect.appendChild(opt);
    });
  }

  // Keep valid selection
  if (currentVal !== '' && Number(currentVal) < (analyzed.dataRows?.length || 0)) {
    el.baselineSelect.value = currentVal;
  } else {
    el.baselineSelect.value = '';
    state.baselineRow = '';
  }

  el.deltaModeSelect.disabled = !isProActive() || state.baselineRow === '';
}

function renderAcademicPreview(analyzed) {
  const t = getCopy(state.lang);
  if (analyzed.empty) {
    el.emptyPreview.classList.remove('hidden');
    el.paperStage.classList.add('hidden');
    el.previewLegend.classList.add('hidden');
    el.previewMeta.textContent = '';
    return;
  }

  el.emptyPreview.classList.add('hidden');
  el.paperStage.classList.remove('hidden');
  el.previewLegend.classList.remove('hidden');
  el.legendBaselineWrap.classList.toggle('hidden', !analyzed.baselineActive);

  const preset = VENUE_PRESETS[state.preset] || VENUE_PRESETS.neurips;
  const presetName = state.lang === 'zh' ? preset.labelZh : preset.labelEn;
  el.previewMeta.textContent = t.previewMeta(presetName, analyzed.visibleDataRows, analyzed.visibleCols);

  const captionText = getEffectiveCaption();
  const captionHtml = `<div class="acad-caption ${preset.captionPosition === 'bottom' ? 'acad-caption-bottom' : ''}"><strong>Table 1.</strong> ${escapeHtml(captionText)}</div>`;

  const parts = [];
  if (preset.captionPosition === 'top') parts.push(captionHtml);

  parts.push(`<table class="acad-table" style="font-family:${preset.fontFamily};">`);
  parts.push('<thead>');

  if (analyzed.columnGroups.length > 0) {
    parts.push('<tr class="group-header-row">');
    let c = 0;
    while (c < analyzed.columns.length) {
      const grp = analyzed.columnGroups.find((g) => g.startCol === c);
      if (grp) {
        const span = grp.endCol - grp.startCol + 1;
        parts.push(`<th colspan="${span}" class="has-group">${escapeHtml(grp.label)}</th>`);
        c = grp.endCol + 1;
      } else {
        parts.push('<th></th>');
        c++;
      }
    }
    parts.push('</tr>');
  }

  parts.push('<tr>');
  for (const col of analyzed.columns) {
    let hdr = col.header;
    if (state.showArrows && !/[↑↓]/.test(hdr)) {
      if (col.direction === 'max') hdr += ' ↑';
      if (col.direction === 'min') hdr += ' ↓';
    }
    const alignClass = col.align === 'right' ? 'acad-align-right' : 'acad-align-left';
    parts.push(`<th class="${alignClass}">${escapeHtml(hdr)}</th>`);
  }
  parts.push('</tr>');
  parts.push('</thead><tbody>');

  let pendingMidrule = false;
  for (const row of analyzed.rows) {
    if (row.type === 'midrule') {
      if (row.label) {
        parts.push(`<tr class="group-label-row"><td colspan="${analyzed.columns.length}">${escapeHtml(row.label)}</td></tr>`);
        pendingMidrule = false;
      } else {
        pendingMidrule = true;
      }
      continue;
    }

    const rowClasses = [];
    if (pendingMidrule) rowClasses.push('after-midrule');
    if (row.isBaseline) rowClasses.push('is-baseline');
    pendingMidrule = false;

    parts.push(`<tr class="${rowClasses.join(' ')}">`);
    row.cells.forEach((cell, c) => {
      const col = analyzed.columns[c];
      const alignClass = col.align === 'right' ? 'acad-align-right' : 'acad-align-left';
      let inner;
      if (cell.kind === 'numeric') {
        const pct = cell.isPercent ? '%' : '';
        let core;
        if (cell.stdText !== null) {
          core = cell.uncertaintyStyle === 'paren'
            ? `${escapeHtml(cell.meanText)}${pct} (${escapeHtml(cell.stdText)})`
            : `${escapeHtml(cell.meanText)}${pct} &plusmn; ${escapeHtml(cell.stdText)}${pct}`;
        } else {
          core = `${escapeHtml(cell.meanText)}${pct}`;
        }
        if (state.boldBest && cell.rank === 1) {
          core = `<span class="acad-rank-1">${core}</span>`;
        } else if (state.underlineSecond && cell.rank === 2) {
          core = `<span class="acad-rank-2">${core}</span>`;
        }
        const stars = cell.stars ? `<span class="acad-stars">${escapeHtml(cell.stars)}</span>` : '';
        let deltaHtml = '';
        if (cell.delta?.formatted) {
          const dClass = cell.delta.isImproved
            ? 'acad-delta-pos'
            : (cell.delta.isWorse ? 'acad-delta-neg' : 'acad-delta-zero');
          deltaHtml = `<span class="acad-delta ${dClass}">(${escapeHtml(cell.delta.formatted)})</span>`;
        }
        inner = `${core}${stars}${deltaHtml}`;
      } else {
        inner = escapeHtml(cell.meanText);
      }
      parts.push(`<td class="${alignClass}">${inner}</td>`);
    });
    parts.push('</tr>');
  }

  parts.push('</tbody></table>');
  if (preset.captionPosition === 'bottom') parts.push(captionHtml);

  el.academicPreview.innerHTML = parts.join('');
}

function getFormattedCode(format) {
  const opts = getExportOptions();
  if (format === 'latex') return exportLatex(state.analyzed, opts);
  if (format === 'word') return exportWordHtml(state.analyzed, opts);
  if (format === 'typst') return exportTypst(state.analyzed, opts);
  return exportMarkdown(state.analyzed, opts);
}

function renderExportStudio(analyzed) {
  const t = getCopy(state.lang);
  const entitlements = getEntitlements(state.license);
  const format = state.activeFormat;
  const formatAllowed = entitlements.allowedFormats.includes(format);

  // Active tab UI
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.format === format);
  });

  // Update primary copy label
  const copyLabels = {
    latex: t.copyLatex,
    word: t.copyWord,
    typst: t.copyTypst,
    markdown: t.copyMarkdown,
  };
  el.copyPrimaryBtn.textContent = copyLabels[format] || t.copyLatex;
  el.wordHint.classList.toggle('hidden', format !== 'word');

  if (!formatAllowed) {
    // Show blurred non-sensitive placeholder while locked on Free tier
    el.codeOutput.textContent = format === 'word'
      ? '<table style="border-collapse:collapse;">\n  <thead><tr><th style="border-top:1.5pt solid #000;">Method</th><th>Acc (%)</th></tr></thead>\n  <tbody><tr><td>...</td><td><strong>Pro Table Preview</strong></td></tr></tbody>\n</table>'
      : '#figure(\n  caption: [Benchmark comparison],\n  table(columns: 5, table.hline(stroke: 1.2pt), ...),\n)';
    el.codeOutput.classList.add('blurred');
    el.proLockedOverlay.classList.remove('hidden');
  } else {
    el.codeOutput.classList.remove('blurred');
    el.proLockedOverlay.classList.add('hidden');
    el.codeOutput.textContent = getFormattedCode(format);
  }
}

function recomputeAndRender() {
  const t = getCopy(state.lang);
  state.parsed = parseDelimitedTable(state.rawText);

  // Detected metadata summary
  if (state.parsed.dataRowCount === 0 || state.parsed.colCount === 0) {
    el.detectedMeta.textContent = t.detectedEmpty;
  } else {
    const delimName = state.parsed.delimiter === '\t'
      ? t.delimTab
      : (state.parsed.delimiter === ';' ? t.delimSemi : t.delimComma);
    el.detectedMeta.textContent = t.detectedMeta(state.parsed.dataRowCount, state.parsed.colCount, delimName);
  }

  state.analyzed = analyzeTable(state.parsed, {
    isPro: isProActive(),
    directions: state.directionOverrides,
    precision: state.precision,
    baselineRow: state.baselineRow === '' ? null : Number(state.baselineRow),
    deltaMode: state.deltaMode,
    preset: state.preset,
  });

  // Free truncation banner
  if (!isProActive() && state.analyzed.wasTruncated) {
    el.freeLimitBanner.classList.remove('hidden');
    el.freeLimitBody.textContent = t.freeLimitBody(
      state.analyzed.visibleDataRows,
      state.analyzed.totalDataRows,
      state.analyzed.visibleCols,
      state.analyzed.totalCols,
    );
  } else {
    el.freeLimitBanner.classList.add('hidden');
  }

  renderColumnPills(state.analyzed);
  renderBaselineOptions(state.analyzed);
  renderAcademicPreview(state.analyzed);
  renderExportStudio(state.analyzed);
}

/* ---------- Clipboard & File Download Helpers ---------- */

async function copyPlainText(text, label) {
  const t = getCopy(state.lang);
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  showToast(t.toastCopied(label));
}

async function copyWordRichTable() {
  const t = getCopy(state.lang);
  if (!isProActive()) {
    showToast(t.toastProRequired);
    openLicenseModal();
    return;
  }
  if (!state.analyzed || state.analyzed.empty) return;

  const html = exportWordHtml(state.analyzed, getExportOptions());
  const plainFallback = exportMarkdown(state.analyzed, getExportOptions());

  if (globalThis.ClipboardItem && navigator.clipboard?.write) {
    try {
      const item = new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainFallback], { type: 'text/plain' }),
      });
      await navigator.clipboard.write([item]);
      showToast(t.toastWordCopied);
      return;
    } catch {
      // Fall through to DOM rich selection copy
    }
  }

  // Compatibility fallback using contenteditable off-screen container
  const holder = document.createElement('div');
  holder.style.position = 'fixed';
  holder.style.left = '-9999px';
  holder.innerHTML = html;
  document.body.appendChild(holder);
  const range = document.createRange();
  range.selectNodeContents(holder);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  try {
    document.execCommand('copy');
    showToast(t.toastWordFallback);
  } finally {
    sel.removeAllRanges();
    holder.remove();
  }
}

function triggerDownload(content, filename, mime = 'text/plain;charset=utf-8') {
  const t = getCopy(state.lang);
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast(t.toastDownloaded(filename));
}

/* ---------- Event Wiring ---------- */

function bindEvents() {
  el.langBtn.addEventListener('click', async () => {
    state.lang = state.lang === 'zh' ? 'en' : 'zh';
    await saveStoredLang(state.lang);
    applyI18n();
    recomputeAndRender();
  });

  el.licenseBtn.addEventListener('click', openLicenseModal);
  el.unlockFromBannerBtn.addEventListener('click', openLicenseModal);
  el.unlockFromOverlayBtn.addEventListener('click', openLicenseModal);
  el.closeModalBtn.addEventListener('click', closeLicenseModal);
  el.licenseModal.addEventListener('click', (e) => {
    if (e.target === el.licenseModal) closeLicenseModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.licenseModal.classList.contains('hidden')) {
      closeLicenseModal();
    }
  });

  // Input events
  el.dataInput.addEventListener('input', () => {
    state.rawText = el.dataInput.value;
    state.directionOverrides = {};
    recomputeAndRender();
  });

  el.demoBtn.addEventListener('click', () => {
    state.rawText = DEMO_CSV;
    el.dataInput.value = DEMO_CSV;
    state.directionOverrides = {};
    recomputeAndRender();
    showToast(getCopy(state.lang).toastDemoLoaded);
  });

  el.clearBtn.addEventListener('click', () => {
    state.rawText = '';
    el.dataInput.value = '';
    state.directionOverrides = {};
    state.baselineRow = '';
    recomputeAndRender();
  });

  el.uploadBtn.addEventListener('click', () => el.fileInput.click());
  el.fileInput.addEventListener('change', async () => {
    const file = el.fileInput.files?.[0];
    if (!file) return;
    const text = await file.text();
    state.rawText = text;
    el.dataInput.value = text;
    state.directionOverrides = {};
    recomputeAndRender();
    showToast(getCopy(state.lang).toastFileLoaded(file.name));
    el.fileInput.value = '';
  });

  // Drag & drop CSV / TSV
  el.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.dropZone.classList.add('drag-over');
  });
  el.dropZone.addEventListener('dragleave', (e) => {
    if (!el.dropZone.contains(e.relatedTarget)) {
      el.dropZone.classList.remove('drag-over');
    }
  });
  el.dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    el.dropZone.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const text = await file.text();
    state.rawText = text;
    el.dataInput.value = text;
    state.directionOverrides = {};
    recomputeAndRender();
    showToast(getCopy(state.lang).toastFileLoaded(file.name));
  });

  // Controls
  el.presetSelect.addEventListener('change', () => {
    state.preset = el.presetSelect.value;
    recomputeAndRender();
  });

  el.precisionSelect.addEventListener('change', () => {
    state.precision = el.precisionSelect.value;
    recomputeAndRender();
  });

  el.baselineSelect.addEventListener('change', () => {
    if (el.baselineSelect.value !== '' && !isProActive()) {
      el.baselineSelect.value = '';
      state.baselineRow = '';
      showToast(getCopy(state.lang).toastProRequired);
      openLicenseModal();
      return;
    }
    state.baselineRow = el.baselineSelect.value;
    recomputeAndRender();
  });

  el.deltaModeSelect.addEventListener('change', () => {
    state.deltaMode = el.deltaModeSelect.value;
    recomputeAndRender();
  });

  el.chkBold.addEventListener('change', () => {
    state.boldBest = el.chkBold.checked;
    recomputeAndRender();
  });
  el.chkUnderline.addEventListener('change', () => {
    state.underlineSecond = el.chkUnderline.checked;
    recomputeAndRender();
  });
  el.chkArrows.addEventListener('change', () => {
    state.showArrows = el.chkArrows.checked;
    recomputeAndRender();
  });
  el.chkSiunitx.addEventListener('change', () => {
    if (el.chkSiunitx.checked && !isProActive()) {
      el.chkSiunitx.checked = false;
      state.useSiunitx = false;
      showToast(getCopy(state.lang).toastProRequired);
      openLicenseModal();
      return;
    }
    state.useSiunitx = el.chkSiunitx.checked;
    recomputeAndRender();
  });
  el.chkResizebox.addEventListener('change', () => {
    state.useResizebox = el.chkResizebox.checked;
    recomputeAndRender();
  });

  el.captionInput.addEventListener('input', () => {
    state.caption = el.captionInput.value;
    state.captionEdited = true;
    recomputeAndRender();
  });
  el.labelInput.addEventListener('input', () => {
    state.label = el.labelInput.value;
    recomputeAndRender();
  });

  // Output format tabs
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeFormat = btn.dataset.format;
      renderExportStudio(state.analyzed);
    });
  });

  // Export actions
  el.copyPrimaryBtn.addEventListener('click', async () => {
    const t = getCopy(state.lang);
    const ent = getEntitlements(state.license);
    if (!ent.allowedFormats.includes(state.activeFormat)) {
      showToast(t.toastProRequired);
      openLicenseModal();
      return;
    }
    if (state.activeFormat === 'word') {
      await copyWordRichTable();
      return;
    }
    const labelMap = { latex: 'LaTeX', typst: 'Typst', markdown: 'Markdown' };
    await copyPlainText(getFormattedCode(state.activeFormat), labelMap[state.activeFormat] || 'Code');
  });

  el.copyWordQuickBtn.addEventListener('click', copyWordRichTable);

  el.downloadTexBtn.addEventListener('click', () => {
    if (!state.analyzed || state.analyzed.empty) return;
    const tex = exportLatex(state.analyzed, getExportOptions());
    const safeName = (state.label || 'table1').replace(/^tab:/, '').replace(/[^A-Za-z0-9_-]/g, '_') || 'table1';
    triggerDownload(tex, `${safeName}.tex`, 'application/x-tex;charset=utf-8');
  });

  el.copyCliBtn.addEventListener('click', async () => {
    const t = getCopy(state.lang);
    if (!isProActive()) {
      showToast(t.toastProRequired);
      openLicenseModal();
      return;
    }
    const cmd = buildCliCommand(state.analyzed, {
      preset: state.preset,
      precision: state.precision,
      baselineRow: state.baselineRow,
      deltaMode: state.deltaMode,
      useSiunitx: state.useSiunitx,
      useResizebox: state.useResizebox,
      boldBest: state.boldBest,
      underlineSecond: state.underlineSecond,
      showArrows: state.showArrows,
      format: state.activeFormat,
    });
    await copyPlainText(cmd, 'Python CLI');
  });

  // License activation form
  el.licenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const t = getCopy(state.lang);
    el.licenseError.classList.add('hidden');
    const key = el.licenseKeyInput.value.trim();
    const result = await verifyLicenseKey(key);
    if (!result.valid) {
      const msgMap = {
        EMPTY_KEY: t.errEmptyKey,
        PRODUCT_MISMATCH: t.errProductMismatch,
        PAYLOAD_MISMATCH: t.errProductMismatch,
        INVALID_SIGNATURE: t.errInvalidSig,
        INVALID_FORMAT: t.errInvalidFormat,
        ONLINE_PROVIDER_NOT_CONFIGURED: t.errOnlineNotConfigured,
      };
      el.licenseError.textContent = msgMap[result.reasonCode] || result.reason || t.errGenericKey;
      el.licenseError.classList.remove('hidden');
      return;
    }
    state.license = await saveStoredLicense(result);
    el.licenseKeyInput.value = '';
    applyI18n();
    recomputeAndRender();
    closeLicenseModal();
    showToast(t.toastActivated);
  });

  el.deactivateBtn.addEventListener('click', async () => {
    await clearStoredLicense();
    state.license = null;
    state.useSiunitx = false;
    el.chkSiunitx.checked = false;
    state.baselineRow = '';
    applyI18n();
    recomputeAndRender();
    showToast(getCopy(state.lang).toastDeactivated);
  });
}

/* ---------- Boot ---------- */

async function init() {
  const savedLang = await loadStoredLang();
  if (savedLang) state.lang = savedLang;

  state.license = await loadStoredLicense();

  el.dataInput.value = state.rawText;
  el.labelInput.value = state.label;

  bindEvents();
  applyI18n();
  recomputeAndRender();
}

init();
