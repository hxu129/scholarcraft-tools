/**
 * CiteCheck Pro — Main Application Controller
 * Works identically inside Chrome MV3 Side Panel and as a standalone zero-backend static web app.
 */

import { DEMO_BIBTEX, FREE_LIMIT, PURCHASE_URLS } from './core/config.js';
import {
  exportCsvReport,
  exportHtmlReport,
  exportMarkdownReport,
  formatAllBibTeX,
  formatAPA7,
  formatBibTeX,
  formatGBT7714,
  summarizeVerdicts,
} from './core/formatter.js';
import { detectDefaultLang, t } from './core/i18n.js';
import {
  clearStoredLicense,
  loadStoredLang,
  loadStoredLicense,
  saveStoredLang,
  saveStoredLicense,
  verifyLicenseKey,
} from './core/license.js';
import { parseReferences } from './core/parser.js';
import { VERDICTS, verifyReferences } from './core/verifier.js';

const IS_EXTENSION = Boolean(globalThis.chrome?.runtime?.id);

const state = {
  lang: 'zh',
  license: null, // null or verified license object
  mode: 'auto',
  parsed: { mode: 'bibtex', entries: [] },
  results: [],
  lockedCount: 0,
  totalDetectedAtRun: 0,
  activeFilter: 'ALL',
  searchQuery: '',
  expandedIndices: new Set(),
  running: false,
  abortController: null,
};

const dom = {
  tierBadge: document.getElementById('tierBadge'),
  appTagline: document.getElementById('appTagline'),
  licenseBtn: document.getElementById('licenseBtn'),
  langBtn: document.getElementById('langBtn'),

  dropZone: document.getElementById('dropZone'),
  dropHint: document.getElementById('dropHint'),
  inputTitle: document.getElementById('inputTitle'),
  modeSelect: document.getElementById('modeSelect'),
  optAuto: document.getElementById('optAuto'),
  optBibtex: document.getElementById('optBibtex'),
  optPlaintext: document.getElementById('optPlaintext'),
  demoBtn: document.getElementById('demoBtn'),
  overleafBtn: document.getElementById('overleafBtn'),
  uploadBtn: document.getElementById('uploadBtn'),
  fileInput: document.getElementById('fileInput'),
  clearBtn: document.getElementById('clearBtn'),
  refInput: document.getElementById('refInput'),
  detectedMeta: document.getElementById('detectedMeta'),
  auditBtn: document.getElementById('auditBtn'),
  cancelBtn: document.getElementById('cancelBtn'),

  progressWrap: document.getElementById('progressWrap'),
  progressBar: document.getElementById('progressBar'),
  progressText: document.getElementById('progressText'),

  freeLimitBanner: document.getElementById('freeLimitBanner'),
  freeLimitTitle: document.getElementById('freeLimitTitle'),
  freeLimitBody: document.getElementById('freeLimitBody'),
  unlockFromBannerBtn: document.getElementById('unlockFromBannerBtn'),
  privacyNote: document.getElementById('privacyNote'),

  summaryBar: document.getElementById('summaryBar'),
  statPills: document.getElementById('statPills'),
  searchInput: document.getElementById('searchInput'),
  exportBar: document.getElementById('exportBar'),
  exportTitle: document.getElementById('exportTitle'),
  exportBibBtn: document.getElementById('exportBibBtn'),
  exportMdBtn: document.getElementById('exportMdBtn'),
  exportCsvBtn: document.getElementById('exportCsvBtn'),
  exportHtmlBtn: document.getElementById('exportHtmlBtn'),
  emptyState: document.getElementById('emptyState'),
  emptyResultsTitle: document.getElementById('emptyResultsTitle'),
  emptyResultsDesc: document.getElementById('emptyResultsDesc'),
  resultsList: document.getElementById('resultsList'),

  licenseModal: document.getElementById('licenseModal'),
  closeModalBtn: document.getElementById('closeModalBtn'),
  modalTitle: document.getElementById('modalTitle'),
  modalSubtitle: document.getElementById('modalSubtitle'),
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
  buyLemon: document.getElementById('buyLemon'),
  licenseForm: document.getElementById('licenseForm'),
  activateLabel: document.getElementById('activateLabel'),
  licenseKeyInput: document.getElementById('licenseKeyInput'),
  activateBtn: document.getElementById('activateBtn'),
  licenseError: document.getElementById('licenseError'),

  toast: document.getElementById('toast'),
};

function isPro() {
  return Boolean(state.license?.valid);
}

let toastTimer = null;
function showToast(msg) {
  dom.toast.textContent = msg;
  dom.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    dom.toast.classList.add('hidden');
  }, 2600);
}

async function copyText(text, btnEl) {
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
  if (btnEl) {
    const original = btnEl.textContent;
    btnEl.textContent = t(state.lang, 'cardCopied');
    setTimeout(() => {
      btnEl.textContent = original;
    }, 1400);
  } else {
    showToast(t(state.lang, 'cardCopied'));
  }
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- UI Rendering ---------- */

function renderStaticText() {
  const lang = state.lang;
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';

  dom.appTagline.textContent = t(lang, 'appTagline');
  dom.langBtn.textContent = t(lang, 'langSwitch');

  if (isPro()) {
    dom.tierBadge.textContent = t(lang, 'badgePro');
    dom.tierBadge.className = 'tier-badge tier-pro';
    dom.licenseBtn.textContent = t(lang, 'btnLicenseActive', { serial: state.license.serial || 'PRO' });
  } else {
    dom.tierBadge.textContent = t(lang, 'badgeFree', { limit: FREE_LIMIT });
    dom.tierBadge.className = 'tier-badge tier-free';
    dom.licenseBtn.textContent = t(lang, 'btnLicense');
  }

  dom.inputTitle.textContent = t(lang, 'inputTitle');
  dom.refInput.placeholder = t(lang, 'inputPlaceholder');
  dom.optAuto.textContent = t(lang, 'modeAuto');
  dom.optBibtex.textContent = t(lang, 'modeBibtex');
  dom.optPlaintext.textContent = t(lang, 'modePlaintext');
  dom.demoBtn.textContent = t(lang, 'btnDemo');
  dom.overleafBtn.textContent = t(lang, 'btnOverleaf');
  dom.uploadBtn.textContent = t(lang, 'btnUpload');
  dom.clearBtn.textContent = t(lang, 'btnClear');
  dom.dropHint.textContent = t(lang, 'dropHint');
  dom.auditBtn.textContent = state.running ? t(lang, 'btnAuditing') : t(lang, 'btnAudit');
  dom.cancelBtn.textContent = t(lang, 'btnCancel');
  dom.privacyNote.textContent = t(lang, 'privacyNote');

  dom.searchInput.placeholder = t(lang, 'searchPlaceholder');
  dom.exportTitle.textContent = t(lang, 'exportTitle');

  const proChipHtml = isPro() ? '' : ` <span class="pro-chip">${t(lang, 'exportProTag')}</span>`;
  dom.exportBibBtn.innerHTML = `${t(lang, 'exportBib')}${proChipHtml}`;
  dom.exportMdBtn.textContent = t(lang, 'exportMd');
  dom.exportCsvBtn.innerHTML = `${t(lang, 'exportCsv')}${proChipHtml}`;
  dom.exportHtmlBtn.innerHTML = `${t(lang, 'exportHtml')}${proChipHtml}`;

  dom.emptyResultsTitle.textContent = t(lang, 'emptyResultsTitle');
  dom.emptyResultsDesc.textContent = t(lang, 'emptyResultsDesc');

  // Modal text
  dom.modalTitle.textContent = t(lang, 'modalTitle');
  dom.modalSubtitle.textContent = t(lang, 'modalSubtitle');
  dom.tierFreeTitle.textContent = t(lang, 'tierFreeTitle');
  dom.tierProTitle.textContent = t(lang, 'tierProTitle');

  dom.tierFreeList.replaceChildren(
    ...t(lang, 'tierFreeItems').map((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      return li;
    }),
  );
  dom.tierProList.replaceChildren(
    ...t(lang, 'tierProItems').map((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      return li;
    }),
  );

  dom.buyTitle.textContent = t(lang, 'buyTitle');
  dom.buyMianbaoduo.textContent = t(lang, 'buyMianbaoduo');
  dom.buyMianbaoduo.href = PURCHASE_URLS.mianbaoduo;
  dom.buyGumroad.textContent = t(lang, 'buyGumroad');
  dom.buyGumroad.href = PURCHASE_URLS.gumroad;
  dom.buyLemon.textContent = t(lang, 'buyLemon');
  dom.buyLemon.href = PURCHASE_URLS.lemonsqueezy;

  dom.activateLabel.textContent = t(lang, 'activateLabel');
  dom.licenseKeyInput.placeholder = t(lang, 'activatePlaceholder');
  dom.activateBtn.textContent = t(lang, 'btnActivate');
  dom.deactivateBtn.textContent = t(lang, 'btnDeactivate');

  if (isPro()) {
    const modeLabel =
      state.license.mode === 'online' ? t(lang, 'licenseModeOnline') : t(lang, 'licenseModeOffline');
    dom.licenseActiveText.textContent = t(lang, 'licenseActiveBanner', {
      batch: state.license.batch || '-',
      serial: state.license.serial || '-',
      mode: modeLabel,
    });
    dom.licenseActiveBox.classList.remove('hidden');
  } else {
    dom.licenseActiveBox.classList.add('hidden');
  }

  renderDetectedMeta();
  renderFreeLimitBanner();
  renderResults();
}

function renderDetectedMeta() {
  const count = state.parsed.entries.length;
  if (count === 0) {
    dom.detectedMeta.textContent = t(state.lang, 'detectedEmpty');
    dom.auditBtn.disabled = state.running || true;
  } else {
    const modeName = state.parsed.mode === 'bibtex' ? 'BibTeX' : t(state.lang, 'modePlaintext');
    dom.detectedMeta.textContent = t(state.lang, 'detectedCount', { count, mode: modeName });
    dom.auditBtn.disabled = state.running;
  }
}

function renderFreeLimitBanner() {
  if (!isPro() && state.lockedCount > 0) {
    dom.freeLimitTitle.textContent = t(state.lang, 'freeLimitNoticeTitle', { limit: FREE_LIMIT });
    dom.freeLimitBody.textContent = t(state.lang, 'freeLimitNoticeBody', {
      total: state.totalDetectedAtRun,
      limit: FREE_LIMIT,
      locked: state.lockedCount,
    });
    dom.unlockFromBannerBtn.textContent = t(state.lang, 'btnUnlockNow');
    dom.freeLimitBanner.classList.remove('hidden');
  } else {
    dom.freeLimitBanner.classList.add('hidden');
  }
}

function renderSummaryPills() {
  const counts = summarizeVerdicts(state.results);
  const pillDefs = [
    { key: 'ALL', label: t(state.lang, 'filterAll'), count: counts.total },
    { key: VERDICTS.VERIFIED, label: t(state.lang, `verdict.${VERDICTS.VERIFIED}`), count: counts[VERDICTS.VERIFIED] },
    { key: VERDICTS.RETRACTED, label: t(state.lang, `verdict.${VERDICTS.RETRACTED}`), count: counts[VERDICTS.RETRACTED] },
    { key: VERDICTS.ARXIV_PUBLISHED, label: t(state.lang, `verdict.${VERDICTS.ARXIV_PUBLISHED}`), count: counts[VERDICTS.ARXIV_PUBLISHED] },
    { key: VERDICTS.METADATA_MISMATCH, label: t(state.lang, `verdict.${VERDICTS.METADATA_MISMATCH}`), count: counts[VERDICTS.METADATA_MISMATCH] },
    { key: VERDICTS.SUSPECT_HALLUCINATION, label: t(state.lang, `verdict.${VERDICTS.SUSPECT_HALLUCINATION}`), count: counts[VERDICTS.SUSPECT_HALLUCINATION] },
    { key: VERDICTS.API_ERROR, label: t(state.lang, `verdict.${VERDICTS.API_ERROR}`), count: counts[VERDICTS.API_ERROR] },
  ];

  dom.statPills.replaceChildren(
    ...pillDefs
      .filter((p) => p.key === 'ALL' || p.count > 0 || state.activeFilter === p.key)
      .map((p) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `stat-pill pill-${p.key}${state.activeFilter === p.key ? ' active' : ''}`;
        const labelSpan = document.createElement('span');
        labelSpan.textContent = p.label;
        const countSpan = document.createElement('span');
        countSpan.className = 'pill-count';
        countSpan.textContent = String(p.count);
        btn.append(labelSpan, countSpan);
        btn.addEventListener('click', () => {
          state.activeFilter = p.key;
          renderResults();
        });
        return btn;
      }),
  );
}

function createResultCard(result, idx) {
  const lang = state.lang;
  const entry = result.entry || {};
  const canon = result.upgradedMetadata || result.canonical;
  const isExpanded =
    state.expandedIndices.has(idx) ||
    result.verdict === VERDICTS.RETRACTED ||
    result.verdict === VERDICTS.ARXIV_PUBLISHED ||
    result.verdict === VERDICTS.METADATA_MISMATCH;

  const card = document.createElement('article');
  card.className = `result-card verdict-${result.verdict}`;

  // Header row
  const top = document.createElement('div');
  top.className = 'card-top';

  const leftBadges = document.createElement('div');
  leftBadges.className = 'card-badges';

  const vBadge = document.createElement('span');
  vBadge.className = `verdict-badge vb-${result.verdict}`;
  vBadge.textContent = t(lang, `verdict.${result.verdict}`);
  leftBadges.appendChild(vBadge);

  const keyChip = document.createElement('span');
  keyChip.className = 'key-chip';
  keyChip.textContent = `#${entry.index || idx + 1} · ${entry.key || 'ref'}`;
  leftBadges.appendChild(keyChip);

  const srcChips = document.createElement('div');
  srcChips.className = 'source-chips';
  const matchedSources = canon?.sources?.length ? canon.sources : result.sourcesQueried || [];
  for (const s of matchedSources) {
    const sc = document.createElement('span');
    sc.className = 'source-chip';
    sc.textContent = s;
    srcChips.appendChild(sc);
  }

  top.append(leftBadges, srcChips);
  card.appendChild(top);

  // Title & input meta
  const titleEl = document.createElement('h3');
  titleEl.className = 'card-title';
  titleEl.textContent = entry.title || canon?.cleanTitle || '(Untitled Reference)';
  card.appendChild(titleEl);

  const metaEl = document.createElement('div');
  metaEl.className = 'card-meta';
  const authorText = (entry.authors || []).slice(0, 4).join(', ') + ((entry.authors?.length || 0) > 4 ? ' et al.' : '');
  const metaParts = [authorText, entry.year ? String(entry.year) : '', entry.venue || (entry.arxivId ? `arXiv:${entry.arxivId}` : '')].filter(Boolean);
  metaEl.textContent = metaParts.join(' · ');
  card.appendChild(metaEl);

  // Prominent Verdict Callout
  if (result.verdict === VERDICTS.RETRACTED) {
    const box = document.createElement('div');
    box.className = 'card-callout callout-danger';
    box.textContent = `${t(lang, 'verdictDesc.RETRACTED')} ${result.retractionReasons?.length ? `(${result.retractionReasons.join('; ')})` : ''}`;
    card.appendChild(box);
  } else if (result.verdict === VERDICTS.ARXIV_PUBLISHED && canon) {
    const box = document.createElement('div');
    box.className = 'card-callout callout-upgrade';
    box.textContent = `${t(lang, 'cardUpgradeTitle')}: ${canon.venue || ''}${canon.year ? ` (${canon.year})` : ''}${canon.doi ? ` · DOI: ${canon.doi}` : ''}`;
    card.appendChild(box);
  } else if (result.verdict === VERDICTS.SUSPECT_HALLUCINATION) {
    const box = document.createElement('div');
    box.className = 'card-callout callout-suspect';
    box.textContent = t(lang, 'verdictDesc.SUSPECT_HALLUCINATION');
    card.appendChild(box);
  } else if (result.verdict === VERDICTS.METADATA_MISMATCH) {
    const box = document.createElement('div');
    box.className = 'card-callout callout-warn';
    box.textContent = t(lang, 'verdictDesc.METADATA_MISMATCH');
    card.appendChild(box);
  } else if (result.verdict === VERDICTS.API_ERROR) {
    const box = document.createElement('div');
    box.className = 'card-callout callout-warn';
    box.textContent = `${t(lang, 'cardRetryHint')}${result.error ? ` (${result.error})` : ''}`;
    card.appendChild(box);
  }

  // Action bar
  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const copyGroup = document.createElement('div');
  copyGroup.className = 'card-action-group';

  const copyBibBtn = document.createElement('button');
  copyBibBtn.type = 'button';
  copyBibBtn.className = 'btn btn-outline btn-xs';
  copyBibBtn.textContent = t(lang, 'cardCopyBib');
  copyBibBtn.addEventListener('click', () => copyText(formatBibTeX(result), copyBibBtn));

  const copyGbtBtn = document.createElement('button');
  copyGbtBtn.type = 'button';
  copyGbtBtn.className = 'btn btn-outline btn-xs';
  copyGbtBtn.textContent = t(lang, 'cardCopyGbt');
  copyGbtBtn.addEventListener('click', () => copyText(formatGBT7714(result), copyGbtBtn));

  const copyApaBtn = document.createElement('button');
  copyApaBtn.type = 'button';
  copyApaBtn.className = 'btn btn-ghost btn-xs';
  copyApaBtn.textContent = t(lang, 'cardCopyApa');
  copyApaBtn.addEventListener('click', () => copyText(formatAPA7(result), copyApaBtn));

  copyGroup.append(copyBibBtn, copyGbtBtn, copyApaBtn);

  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'btn btn-ghost btn-xs';
  toggleBtn.textContent = isExpanded ? t(lang, 'cardDetailsHide') : t(lang, 'cardDetailsToggle');

  actions.append(copyGroup, toggleBtn);
  card.appendChild(actions);

  // Expandable Details Drawer
  const details = document.createElement('div');
  details.className = `card-details${isExpanded ? '' : ' hidden'}`;

  if (result.diffs?.length > 0) {
    const diffWrap = document.createElement('div');
    const diffHeading = document.createElement('div');
    diffHeading.className = 'detail-section-title';
    diffHeading.textContent = t(lang, 'cardDiffTitle');
    diffWrap.appendChild(diffHeading);

    const table = document.createElement('table');
    table.className = 'diff-table';
    const thead = document.createElement('thead');
    const trH = document.createElement('tr');
    for (const h of ['', t(lang, 'cardInputLabel'), t(lang, 'cardVerifiedLabel')]) {
      const th = document.createElement('th');
      th.textContent = h;
      trH.appendChild(th);
    }
    thead.appendChild(trH);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const d of result.diffs) {
      const tr = document.createElement('tr');
      const tdF = document.createElement('td');
      tdF.textContent = t(lang, `diffField.${d.field}`);
      const tdIn = document.createElement('td');
      tdIn.className = 'diff-old';
      tdIn.textContent = d.input || '—';
      const tdCa = document.createElement('td');
      tdCa.className = 'diff-new';
      tdCa.textContent = d.canonical || '—';
      tr.append(tdF, tdIn, tdCa);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    diffWrap.appendChild(table);
    details.appendChild(diffWrap);
  }

  if (canon) {
    const canonWrap = document.createElement('div');
    const canonHeading = document.createElement('div');
    canonHeading.className = 'detail-section-title';
    canonHeading.textContent = t(lang, 'cardCanonicalTitle');
    canonWrap.appendChild(canonHeading);

    const box = document.createElement('div');
    box.className = 'canonical-box';
    const line1 = document.createElement('div');
    line1.textContent = `${canon.cleanTitle} (${canon.year || 'n.d.'})`;
    const line2 = document.createElement('div');
    line2.className = 'card-meta';
    line2.textContent = [
      (canon.authors || []).slice(0, 6).join(', ') + ((canon.authors?.length || 0) > 6 ? ' et al.' : ''),
      canon.venue,
    ]
      .filter(Boolean)
      .join(' · ');
    box.append(line1, line2);

    const links = document.createElement('div');
    links.className = 'canonical-links';
    if (canon.doi) {
      const a = document.createElement('a');
      a.href = `https://doi.org/${encodeURIComponent(canon.doi)}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = `${t(lang, 'cardOpenDoi')} (${canon.doi})`;
      links.appendChild(a);
    }
    if (canon.openalexUrl) {
      const a = document.createElement('a');
      a.href = canon.openalexUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = t(lang, 'cardOpenOpenAlex');
      links.appendChild(a);
    }
    if (canon.dblpUrl) {
      const a = document.createElement('a');
      a.href = canon.dblpUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = t(lang, 'cardOpenDblp');
      links.appendChild(a);
    }
    if (links.childElementCount > 0) box.appendChild(links);
    canonWrap.appendChild(box);
    details.appendChild(canonWrap);
  }

  const pre = document.createElement('pre');
  pre.className = 'bib-preview';
  pre.textContent = formatBibTeX(result);
  details.appendChild(pre);

  toggleBtn.addEventListener('click', () => {
    const hidden = details.classList.toggle('hidden');
    if (hidden) state.expandedIndices.delete(idx);
    else state.expandedIndices.add(idx);
    toggleBtn.textContent = hidden ? t(lang, 'cardDetailsToggle') : t(lang, 'cardDetailsHide');
  });

  card.appendChild(details);
  return card;
}

function renderResults() {
  const hasResults = state.results.length > 0;
  dom.summaryBar.classList.toggle('hidden', !hasResults);
  dom.exportBar.classList.toggle('hidden', !hasResults);
  dom.emptyState.classList.toggle('hidden', hasResults);

  if (!hasResults) {
    dom.resultsList.replaceChildren();
    return;
  }

  renderSummaryPills();

  const q = state.searchQuery.trim().toLowerCase();
  const filtered = state.results
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => {
      if (state.activeFilter !== 'ALL' && r.verdict !== state.activeFilter) return false;
      if (!q) return true;
      const haystack = [
        r.entry?.key,
        r.entry?.title,
        ...(r.entry?.authors || []),
        r.entry?.venue,
        r.canonical?.cleanTitle,
        r.canonical?.venue,
        r.canonical?.doi,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = t(state.lang, 'noFilterMatch');
    dom.resultsList.replaceChildren(empty);
    return;
  }

  dom.resultsList.replaceChildren(...filtered.map(({ r, i }) => createResultCard(r, i)));
}

/* ---------- Actions ---------- */

function handleInputChanged() {
  state.parsed = parseReferences(dom.refInput.value, state.mode);
  renderDetectedMeta();
}

async function runAudit() {
  const allEntries = state.parsed.entries;
  if (allEntries.length === 0 || state.running) return;

  const limit = isPro() ? allEntries.length : FREE_LIMIT;
  const toCheck = allEntries.slice(0, limit);
  state.lockedCount = Math.max(0, allEntries.length - limit);
  state.totalDetectedAtRun = allEntries.length;
  state.results = [];
  state.activeFilter = 'ALL';
  state.expandedIndices.clear();
  state.running = true;
  state.abortController = new AbortController();

  dom.auditBtn.disabled = true;
  dom.auditBtn.textContent = t(state.lang, 'btnAuditing');
  dom.cancelBtn.classList.remove('hidden');
  dom.progressWrap.classList.remove('hidden');
  dom.progressBar.style.width = '4%';
  dom.progressText.textContent = t(state.lang, 'progressRunning', {
    completed: 0,
    total: toCheck.length,
    title: toCheck[0]?.title || toCheck[0]?.key || '',
  });
  renderFreeLimitBanner();
  renderResults();

  const startedAt = Date.now();
  const liveSlots = new Array(toCheck.length);
  try {
    const results = await verifyReferences(toCheck, {
      concurrency: 3,
      signal: state.abortController.signal,
      onProgress: ({ completed, total, index, entry, result }) => {
        const pct = Math.max(5, Math.round((completed / total) * 100));
        dom.progressBar.style.width = `${pct}%`;
        dom.progressText.textContent = t(state.lang, 'progressRunning', {
          completed,
          total,
          title: entry.title || entry.key || '',
        });
        liveSlots[index] = result;
        state.results = liveSlots.filter(Boolean);
        renderResults();
      },
    });
    state.results = results;
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    dom.progressBar.style.width = '100%';
    dom.progressText.textContent = state.abortController.signal.aborted
      ? t(state.lang, 'progressCancelled', { completed: results.length, total: toCheck.length })
      : t(state.lang, 'progressDone', { total: results.length, seconds: elapsed });
  } catch (err) {
    if (err?.name !== 'AbortError') {
      showToast(String(err?.message || err));
    }
  } finally {
    state.running = false;
    state.abortController = null;
    dom.cancelBtn.classList.add('hidden');
    dom.auditBtn.textContent = t(state.lang, 'btnAudit');
    renderDetectedMeta();
    renderResults();
  }
}

async function importFromOverleaf() {
  if (!IS_EXTENSION || !chrome.tabs?.query) {
    showToast(t(state.lang, 'overleafNotActive'));
    return;
  }
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/overleaf\.com/i.test(tab.url || '')) {
      showToast(t(state.lang, 'overleafNotActive'));
      return;
    }
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'CITECHECK_EXTRACT_OVERLEAF' });
    if (!response?.ok || !response.text) {
      showToast(t(state.lang, 'overleafEmpty'));
      return;
    }
    dom.refInput.value = response.text;
    handleInputChanged();
    const count = state.parsed.entries.length;
    showToast(t(state.lang, 'overleafImported', { count, source: response.source || 'Overleaf' }));
    if (response.truncatedWarning) {
      setTimeout(() => showToast(t(state.lang, 'overleafTruncated')), 2700);
    }
  } catch {
    showToast(t(state.lang, 'overleafEmpty'));
  }
}

function openLicenseModal() {
  dom.licenseError.classList.add('hidden');
  dom.licenseModal.classList.remove('hidden');
  dom.licenseKeyInput.focus();
}

function closeLicenseModal() {
  dom.licenseModal.classList.add('hidden');
}

async function handleActivateLicense(event) {
  event.preventDefault();
  dom.licenseError.classList.add('hidden');
  const rawKey = dom.licenseKeyInput.value.trim();
  dom.activateBtn.disabled = true;

  try {
    const verification = await verifyLicenseKey(rawKey);
    if (!verification.valid) {
      const localizedReason =
        t(state.lang, `licenseReasons.${verification.reasonCode}`) || verification.reason;
      dom.licenseError.textContent = t(state.lang, 'licenseInvalid', { reason: localizedReason });
      dom.licenseError.classList.remove('hidden');
      return;
    }
    state.license = await saveStoredLicense(verification);
    state.lockedCount = 0;
    dom.licenseKeyInput.value = '';
    renderStaticText();
    closeLicenseModal();
    showToast(t(state.lang, 'licenseActivatedToast'));
  } finally {
    dom.activateBtn.disabled = false;
  }
}

async function handleDeactivateLicense() {
  await clearStoredLicense();
  state.license = null;
  renderStaticText();
  showToast(t(state.lang, 'licenseClearedToast'));
}

function requireProForExport() {
  if (isPro()) return true;
  showToast(t(state.lang, 'exportLockedToast'));
  openLicenseModal();
  return false;
}

function bindEvents() {
  dom.langBtn.addEventListener('click', async () => {
    state.lang = state.lang === 'zh' ? 'en' : 'zh';
    await saveStoredLang(state.lang);
    renderStaticText();
  });

  dom.licenseBtn.addEventListener('click', openLicenseModal);
  dom.unlockFromBannerBtn.addEventListener('click', openLicenseModal);
  dom.closeModalBtn.addEventListener('click', closeLicenseModal);
  dom.licenseModal.addEventListener('click', (e) => {
    if (e.target === dom.licenseModal) closeLicenseModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dom.licenseModal.classList.contains('hidden')) {
      closeLicenseModal();
    }
  });
  dom.licenseForm.addEventListener('submit', handleActivateLicense);
  dom.deactivateBtn.addEventListener('click', handleDeactivateLicense);

  dom.modeSelect.addEventListener('change', () => {
    state.mode = dom.modeSelect.value;
    handleInputChanged();
  });

  dom.refInput.addEventListener('input', handleInputChanged);

  dom.demoBtn.addEventListener('click', () => {
    dom.refInput.value = DEMO_BIBTEX;
    state.mode = 'auto';
    dom.modeSelect.value = 'auto';
    handleInputChanged();
  });

  dom.overleafBtn.addEventListener('click', importFromOverleaf);

  dom.uploadBtn.addEventListener('click', () => dom.fileInput.click());
  dom.fileInput.addEventListener('change', async () => {
    const file = dom.fileInput.files?.[0];
    if (!file) return;
    dom.refInput.value = await file.text();
    dom.fileInput.value = '';
    handleInputChanged();
  });

  // Drag & drop .bib / .txt
  ['dragenter', 'dragover'].forEach((evt) => {
    dom.dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dom.dropZone.classList.add('drag-over');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    dom.dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dom.dropZone.classList.remove('drag-over');
    });
  });
  dom.dropZone.addEventListener('drop', async (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    dom.refInput.value = await file.text();
    handleInputChanged();
  });

  dom.clearBtn.addEventListener('click', () => {
    dom.refInput.value = '';
    state.results = [];
    state.lockedCount = 0;
    dom.progressWrap.classList.add('hidden');
    handleInputChanged();
    renderFreeLimitBanner();
    renderResults();
  });

  dom.auditBtn.addEventListener('click', runAudit);
  dom.cancelBtn.addEventListener('click', () => {
    state.abortController?.abort();
  });

  dom.searchInput.addEventListener('input', () => {
    state.searchQuery = dom.searchInput.value;
    renderResults();
  });

  // Exports
  dom.exportBibBtn.addEventListener('click', () => {
    if (!requireProForExport()) return;
    downloadFile('citecheck-fixed.bib', formatAllBibTeX(state.results), 'application/x-bibtex;charset=utf-8');
  });
  dom.exportMdBtn.addEventListener('click', () => {
    downloadFile(
      'citecheck-audit-report.md',
      exportMarkdownReport(state.results, { lang: state.lang }),
      'text/markdown;charset=utf-8',
    );
  });
  dom.exportCsvBtn.addEventListener('click', () => {
    if (!requireProForExport()) return;
    downloadFile('citecheck-audit-report.csv', exportCsvReport(state.results), 'text/csv;charset=utf-8');
  });
  dom.exportHtmlBtn.addEventListener('click', () => {
    if (!requireProForExport()) return;
    downloadFile(
      'citecheck-audit-report.html',
      exportHtmlReport(state.results, { lang: state.lang }),
      'text/html;charset=utf-8',
    );
  });
}

async function init() {
  if (IS_EXTENSION) {
    dom.overleafBtn.classList.remove('hidden');
  }
  const [savedLang, savedLicense] = await Promise.all([loadStoredLang(), loadStoredLicense()]);
  state.lang = savedLang || detectDefaultLang();
  state.license = savedLicense;
  bindEvents();
  renderStaticText();
}

init();
