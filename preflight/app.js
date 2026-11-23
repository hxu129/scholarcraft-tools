/**
 * PaperPreflight Pro — Web App & Chrome MV3 Side Panel Controller
 * Strict CSP compliance: zero inline scripts, DOM built exclusively via textContent.
 */

import {
  DEMO_BLOCKLIST,
  DEMO_MAIN_TEX,
  DEMO_REFERENCES_BIB,
  FREE_MAX_FILES,
  FREE_MAX_LINES,
  PURCHASE_URLS,
  VENUE_PRESETS,
} from './core/config.js';
import {
  auditProject,
  generateHtmlReport,
  generateMarkdownReport,
  sanitizeProject,
} from './core/auditor.js';
import { buildSamplePdfBytes } from './core/pdf-scanner.js';
import { buildSanitizedSubmissionZip } from './core/zip.js';
import {
  clearStoredLicense,
  loadStoredBlocklist,
  loadStoredLang,
  loadStoredLicense,
  saveStoredBlocklist,
  saveStoredLang,
  saveStoredLicense,
  verifyLicenseKey,
} from './core/license.js';
import { t } from './core/i18n.js';

const state = {
  lang: 'en',
  license: null,
  isDemo: false,
  venue: 'auto',
  files: [], // { id, name, type, content?, bytes?, size }
  blocklist: [],
  auditResult: null,
  sanitizedResult: null,
  activeTab: 'findings',
  severityFilter: 'all',
  categoryFilter: 'all',
  searchQuery: '',
};

const els = {
  btnLoadDemo: document.getElementById('btnLoadDemo'),
  btnLangToggle: document.getElementById('btnLangToggle'),
  btnLicenseOpen: document.getElementById('btnLicenseOpen'),
  licenseStatusText: document.getElementById('licenseStatusText'),
  statusBanner: document.getElementById('statusBanner'),
  statusTitle: document.getElementById('statusTitle'),
  statusDesc: document.getElementById('statusDesc'),
  demoModeBadge: document.getElementById('demoModeBadge'),
  statCritical: document.getElementById('statCritical'),
  statHigh: document.getElementById('statHigh'),
  statMedium: document.getElementById('statMedium'),
  statScope: document.getElementById('statScope'),
  freeLimitNotice: document.getElementById('freeLimitNotice'),
  freeLimitText: document.getElementById('freeLimitText'),
  btnBannerUpgrade: document.getElementById('btnBannerUpgrade'),

  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
  folderInput: document.getElementById('folderInput'),
  btnChooseFiles: document.getElementById('btnChooseFiles'),
  btnChooseFolder: document.getElementById('btnChooseFolder'),
  btnPasteOpen: document.getElementById('btnPasteOpen'),
  btnClearFiles: document.getElementById('btnClearFiles'),
  fileCountLabel: document.getElementById('fileCountLabel'),
  fileList: document.getElementById('fileList'),

  blocklistInput: document.getElementById('blocklistInput'),
  btnAddBlocklist: document.getElementById('btnAddBlocklist'),
  blocklistChips: document.getElementById('blocklistChips'),
  venueSelect: document.getElementById('venueSelect'),
  btnRunAudit: document.getElementById('btnRunAudit'),
  btnExportZip: document.getElementById('btnExportZip'),
  btnExportHtml: document.getElementById('btnExportHtml'),
  btnExportMd: document.getElementById('btnExportMd'),

  tabButtons: Array.from(document.querySelectorAll('.deck-tab')),
  tabFindingsCount: document.getElementById('tabFindingsCount'),
  tabPdfCount: document.getElementById('tabPdfCount'),
  tabPanelFindings: document.getElementById('tabPanelFindings'),
  tabPanelPdf: document.getElementById('tabPanelPdf'),
  tabPanelSanitizer: document.getElementById('tabPanelSanitizer'),

  severityPills: Array.from(document.querySelectorAll('#severityPills .pill')),
  categoryFilter: document.getElementById('categoryFilter'),
  searchFilter: document.getElementById('searchFilter'),
  findingsList: document.getElementById('findingsList'),
  pdfInspectorContent: document.getElementById('pdfInspectorContent'),
  sanitizerContent: document.getElementById('sanitizerContent'),

  pasteModal: document.getElementById('pasteModal'),
  btnPasteClose: document.getElementById('btnPasteClose'),
  btnPasteCancel: document.getElementById('btnPasteCancel'),
  btnPasteConfirm: document.getElementById('btnPasteConfirm'),
  pasteFilename: document.getElementById('pasteFilename'),
  pasteContent: document.getElementById('pasteContent'),

  licenseModal: document.getElementById('licenseModal'),
  btnLicenseClose: document.getElementById('btnLicenseClose'),
  licenseActiveBox: document.getElementById('licenseActiveBox'),
  licenseActiveMeta: document.getElementById('licenseActiveMeta'),
  btnLicenseDeactivate: document.getElementById('btnLicenseDeactivate'),
  licenseKeyInput: document.getElementById('licenseKeyInput'),
  btnLicenseVerify: document.getElementById('btnLicenseVerify'),
  licenseErrorMsg: document.getElementById('licenseErrorMsg'),
  linkBuyGumroad: document.getElementById('linkBuyGumroad'),
  linkBuyMbd: document.getElementById('linkBuyMbd'),

  toast: document.getElementById('toast'),
};

let toastTimer = null;
function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.add('hidden');
  }, 3600);
}

function isProActive() {
  return Boolean(state.license?.valid);
}

function detectFileType(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.bib')) return 'bib';
  return 'tex';
}

function populateVenues() {
  els.venueSelect.replaceChildren();
  for (const v of VENUE_PRESETS) {
    const opt = document.createElement('option');
    opt.value = v.id;
    opt.textContent = state.lang === 'zh' ? v.labelZh : v.labelEn;
    if (v.id === state.venue) opt.selected = true;
    els.venueSelect.appendChild(opt);
  }
}

function applyTranslations() {
  document.documentElement.lang = state.lang === 'zh' ? 'zh-CN' : 'en';
  for (const node of document.querySelectorAll('[data-i18n]')) {
    const key = node.getAttribute('data-i18n');
    node.textContent = t(state.lang, key);
  }
  for (const node of document.querySelectorAll('[data-i18n-placeholder]')) {
    const key = node.getAttribute('data-i18n-placeholder');
    node.setAttribute('placeholder', t(state.lang, key));
  }
  els.btnLangToggle.textContent = state.lang === 'zh' ? 'EN' : '中文';
  populateVenues();
  renderLicenseBadge();
  renderFileList();
  renderAuditViews();
}

function renderLicenseBadge() {
  if (isProActive()) {
    els.btnLicenseOpen.classList.add('is-pro');
    els.licenseStatusText.textContent = t(state.lang, 'proBadge');
    els.licenseActiveBox.classList.remove('hidden');
    els.licenseActiveMeta.textContent = `${state.license.provider || 'offline'} · #${state.license.serial || 'PRO'} (${state.license.batch || 'std'})`;
  } else {
    els.btnLicenseOpen.classList.remove('is-pro');
    els.licenseStatusText.textContent = t(state.lang, 'unlockPro');
    els.licenseActiveBox.classList.add('hidden');
  }
}

function renderFileList() {
  els.fileCountLabel.textContent = String(state.files.length);
  els.fileList.replaceChildren();

  if (state.files.length === 0) {
    const li = document.createElement('li');
    li.className = 'file-empty';
    li.textContent = t(state.lang, 'filesEmpty');
    els.fileList.appendChild(li);
    return;
  }

  for (const f of state.files) {
    const li = document.createElement('li');
    li.className = 'file-item';

    const left = document.createElement('div');
    left.className = 'file-item-left';

    const tag = document.createElement('span');
    tag.className = `file-type-tag file-type-${f.type}`;
    tag.textContent = f.type.toUpperCase();

    const nameSpan = document.createElement('span');
    nameSpan.className = 'file-name';
    nameSpan.textContent = f.name;
    nameSpan.title = f.name;

    left.append(tag, nameSpan);

    const right = document.createElement('div');
    right.className = 'file-item-left';

    const meta = document.createElement('span');
    meta.className = 'file-meta';
    if (f.type === 'pdf') {
      meta.textContent = `${Math.max(1, Math.round((f.bytes?.length || 0) / 1024))} ${t(state.lang, 'bytesUnit')}`;
    } else {
      const lineCount = String(f.content || '').split(/\r?\n/).length;
      meta.textContent = `${lineCount} ${t(state.lang, 'lineUnit')}`;
    }

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'file-remove';
    rm.textContent = '×';
    rm.setAttribute('aria-label', `Remove ${f.name}`);
    rm.addEventListener('click', () => {
      state.files = state.files.filter((x) => x.id !== f.id);
      state.isDemo = false;
      renderFileList();
      runAudit();
    });

    right.append(meta, rm);
    li.append(left, right);
    els.fileList.appendChild(li);
  }
}

function renderBlocklistChips() {
  els.blocklistChips.replaceChildren();
  for (const term of state.blocklist) {
    const chip = document.createElement('span');
    chip.className = 'chip';

    const label = document.createElement('span');
    label.textContent = term;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'chip-remove';
    btn.textContent = '×';
    btn.setAttribute('aria-label', `Remove ${term}`);
    btn.addEventListener('click', async () => {
      state.blocklist = state.blocklist.filter((item) => item !== term);
      await saveStoredBlocklist(state.blocklist);
      renderBlocklistChips();
      if (state.files.length > 0) runAudit();
    });

    chip.append(label, btn);
    els.blocklistChips.appendChild(chip);
  }
}

async function addBlocklistTerms(rawText) {
  const tokens = String(rawText || '')
    .split(/[,;\n，；]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2);
  if (tokens.length === 0) return;

  const existingLower = new Set(state.blocklist.map((s) => s.toLowerCase()));
  let changed = false;
  for (const tok of tokens) {
    if (!existingLower.has(tok.toLowerCase())) {
      state.blocklist.push(tok);
      existingLower.add(tok.toLowerCase());
      changed = true;
    }
  }
  if (changed) {
    await saveStoredBlocklist(state.blocklist);
    renderBlocklistChips();
    if (state.files.length > 0) runAudit();
  }
}

function runAudit() {
  if (state.files.length === 0) {
    state.auditResult = null;
    state.sanitizedResult = null;
    renderAuditViews();
    return;
  }

  const enforceLimits = !isProActive() && !state.isDemo;
  const result = auditProject(state.files, {
    blocklist: state.blocklist,
    venue: state.venue,
    isPro: isProActive() || state.isDemo,
    enforceFreeLimits: enforceLimits,
    freeMaxFiles: FREE_MAX_FILES,
    freeMaxLines: FREE_MAX_LINES,
  });

  state.auditResult = result;
  state.sanitizedResult = sanitizeProject(state.files, result);
  renderAuditViews();
}

function renderAuditViews() {
  const res = state.auditResult;

  els.demoModeBadge.classList.toggle('hidden', !state.isDemo);

  if (!res) {
    els.statusBanner.className = 'status-banner status-idle';
    els.statusTitle.textContent = t(state.lang, 'bannerIdleTitle');
    els.statusDesc.textContent = t(state.lang, 'bannerIdleDesc');
    els.statCritical.textContent = '0';
    els.statHigh.textContent = '0';
    els.statMedium.textContent = '0';
    els.statScope.textContent = '0 / 0';
    els.tabFindingsCount.textContent = '0';
    els.tabPdfCount.textContent = '0';
    els.freeLimitNotice.classList.add('hidden');
    renderFindingsList([]);
    renderPdfInspector([]);
    renderSanitizerPreview(null);
    return;
  }

  // Banner verdict
  els.statusBanner.className = `status-banner status-${res.status}`;
  if (res.status === 'critical') {
    els.statusTitle.textContent = t(state.lang, 'bannerCriticalTitle');
    els.statusDesc.textContent = t(state.lang, 'bannerCriticalDesc');
  } else if (res.status === 'warning') {
    els.statusTitle.textContent = t(state.lang, 'bannerWarningTitle');
    els.statusDesc.textContent = t(state.lang, 'bannerWarningDesc');
  } else {
    els.statusTitle.textContent = t(state.lang, 'bannerPassTitle');
    els.statusDesc.textContent = t(state.lang, 'bannerPassDesc');
  }

  els.statCritical.textContent = String(res.counts.critical);
  els.statHigh.textContent = String(res.counts.high);
  els.statMedium.textContent = String(res.counts.medium + res.counts.low);
  els.statScope.textContent = `${res.stats.filesScanned} / ${res.stats.linesScanned}`;
  els.tabFindingsCount.textContent = String(res.issues.length);
  els.tabPdfCount.textContent = String(res.pdfReports.length);

  els.freeLimitNotice.classList.toggle('hidden', !res.freeTierLimitHit?.limited);

  renderFindingsList(res.issues);
  renderPdfInspector(res.pdfReports);
  renderSanitizerPreview(state.sanitizedResult);
}

function buildHighlightedExcerpt(excerpt, matchStr) {
  const pre = document.createElement('pre');
  pre.className = 'issue-excerpt';
  if (!matchStr) {
    pre.textContent = excerpt;
    return pre;
  }
  const idx = excerpt.toLowerCase().indexOf(String(matchStr).toLowerCase());
  if (idx === -1) {
    pre.textContent = excerpt;
    return pre;
  }
  pre.append(document.createTextNode(excerpt.slice(0, idx)));
  const span = document.createElement('span');
  span.className = 'excerpt-hit';
  span.textContent = excerpt.slice(idx, idx + matchStr.length);
  pre.append(span);
  pre.append(document.createTextNode(excerpt.slice(idx + matchStr.length)));
  return pre;
}

function renderFindingsList(allIssues) {
  els.findingsList.replaceChildren();
  const q = state.searchQuery.trim().toLowerCase();

  const filtered = allIssues.filter((iss) => {
    if (state.severityFilter !== 'all' && iss.severity !== state.severityFilter) return false;
    if (state.categoryFilter !== 'all' && iss.category !== state.categoryFilter) return false;
    if (q) {
      const hay = `${iss.file} ${iss.ruleId} ${iss.titleEn} ${iss.titleZh} ${iss.messageEn} ${iss.messageZh} ${iss.excerpt || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const h4 = document.createElement('h4');
    h4.textContent = t(state.lang, 'noFindingsTitle');
    const p = document.createElement('p');
    p.textContent = t(state.lang, 'noFindingsDesc');
    empty.append(h4, p);
    els.findingsList.appendChild(empty);
    return;
  }

  for (const iss of filtered) {
    const card = document.createElement('article');
    card.className = `issue-card sev-${iss.severity}`;

    const head = document.createElement('div');
    head.className = 'issue-head';

    const badges = document.createElement('div');
    badges.className = 'issue-badges';

    const sev = document.createElement('span');
    sev.className = `sev-badge sev-badge-${iss.severity}`;
    sev.textContent = iss.severity;

    const rule = document.createElement('span');
    rule.className = 'rule-badge';
    rule.textContent = iss.ruleId;

    badges.append(sev, rule);

    const loc = document.createElement('span');
    loc.className = 'loc-badge';
    loc.textContent = iss.line ? `${iss.file}:${iss.line}` : iss.file;

    head.append(badges, loc);

    const title = document.createElement('h4');
    title.className = 'issue-title';
    title.textContent = state.lang === 'zh' ? iss.titleZh : iss.titleEn;

    const msg = document.createElement('p');
    msg.className = 'issue-msg';
    msg.textContent = state.lang === 'zh' ? iss.messageZh : iss.messageEn;

    card.append(head, title, msg);

    if (iss.excerpt) {
      card.appendChild(buildHighlightedExcerpt(iss.excerpt, iss.match));
    }

    const fix = document.createElement('div');
    fix.className = 'issue-fix';
    const fixStrong = document.createElement('strong');
    fixStrong.textContent = `${t(state.lang, 'fixLabel')}:`;
    fix.append(fixStrong, document.createTextNode(state.lang === 'zh' ? iss.fixZh : iss.fixEn));
    card.appendChild(fix);

    els.findingsList.appendChild(card);
  }
}

function renderPdfInspector(pdfReports) {
  els.pdfInspectorContent.replaceChildren();

  if (!pdfReports || pdfReports.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const h4 = document.createElement('h4');
    h4.textContent = t(state.lang, 'pdfEmptyTitle');
    const p = document.createElement('p');
    p.textContent = t(state.lang, 'pdfEmptyDesc');
    empty.append(h4, p);
    els.pdfInspectorContent.appendChild(empty);
    return;
  }

  for (const pr of pdfReports) {
    const card = document.createElement('div');
    card.className = 'pdf-card';

    const head = document.createElement('div');
    head.className = 'pdf-card-head';
    const h4 = document.createElement('h4');
    h4.textContent = `${pr.file} (${(pr.byteLength / 1024).toFixed(1)} KB)`;
    head.appendChild(h4);
    card.appendChild(head);

    const infoLabel = document.createElement('p');
    infoLabel.className = 'field-label';
    infoLabel.textContent = t(state.lang, 'pdfInfoHeading');
    card.appendChild(infoLabel);

    const table = document.createElement('table');
    table.className = 'data-table';
    const thead = document.createElement('thead');
    const thr = document.createElement('tr');
    const th1 = document.createElement('th');
    th1.textContent = 'Metadata Field';
    const th2 = document.createElement('th');
    th2.textContent = 'Extracted Value';
    thr.append(th1, th2);
    thead.appendChild(thr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const rows = [];
    for (const [k, v] of Object.entries(pr.info)) {
      if (k.endsWith('_all')) continue;
      rows.push([`/${k}`, String(v)]);
    }
    if (pr.xmp?.found) {
      if (pr.xmp.creator.length) rows.push(['XMP <dc:creator>', pr.xmp.creator.join('; ')]);
      if (pr.xmp.creatorTool.length) rows.push(['XMP <xmp:CreatorTool>', pr.xmp.creatorTool.join('; ')]);
      if (pr.xmp.producer.length) rows.push(['XMP <pdf:Producer>', pr.xmp.producer.join('; ')]);
      if (pr.xmp.title.length) rows.push(['XMP <dc:title>', pr.xmp.title.join('; ')]);
    }
    if (rows.length === 0) {
      rows.push(['(Info / XMP)', 'No metadata strings present']);
    }
    for (const [k, v] of rows) {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td');
      const code = document.createElement('code');
      code.textContent = k;
      td1.appendChild(code);
      const td2 = document.createElement('td');
      td2.textContent = v;
      tr.append(td1, td2);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    card.appendChild(table);

    const uriLabel = document.createElement('p');
    uriLabel.className = 'field-label';
    uriLabel.textContent = t(state.lang, 'pdfUrisHeading');
    card.appendChild(uriLabel);

    if (!pr.uris || pr.uris.length === 0) {
      const p = document.createElement('p');
      p.className = 'panel-help';
      p.textContent = t(state.lang, 'pdfNoUris');
      card.appendChild(p);
    } else {
      const ut = document.createElement('table');
      ut.className = 'data-table';
      const utbody = document.createElement('tbody');
      for (const u of pr.uris) {
        const tr = document.createElement('tr');
        const td1 = document.createElement('td');
        const code = document.createElement('code');
        code.textContent = u.uri;
        td1.appendChild(code);
        const td2 = document.createElement('td');
        const pill = document.createElement('span');
        pill.className = `uri-pill ${u.status === 'leak' ? 'uri-leak' : u.status === 'anonymous_ok' ? 'uri-anon' : 'uri-ok'}`;
        pill.textContent = u.status === 'leak' ? `LEAK (${u.reason})` : u.status === 'anonymous_ok' ? 'ANONYMOUS OK' : 'OK';
        td2.appendChild(pill);
        tr.append(td1, td2);
        utbody.appendChild(tr);
      }
      ut.appendChild(utbody);
      card.appendChild(ut);
    }

    els.pdfInspectorContent.appendChild(card);
  }
}

function renderSanitizerPreview(sanitized) {
  els.sanitizerContent.replaceChildren();

  const h4 = document.createElement('h4');
  h4.className = 'panel-heading';
  h4.textContent = t(state.lang, 'sanitizerTitle');
  const desc = document.createElement('p');
  desc.className = 'panel-help';
  desc.textContent = t(state.lang, 'sanitizerDesc');
  els.sanitizerContent.append(h4, desc);

  if (!sanitized || sanitized.files.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const p = document.createElement('p');
    p.textContent = t(state.lang, 'filesEmpty');
    empty.appendChild(p);
    els.sanitizerContent.appendChild(empty);
    return;
  }

  const statsGrid = document.createElement('div');
  statsGrid.className = 'sanitizer-stats';
  const statItems = [
    [sanitized.summary.totalCommentsStripped, t(state.lang, 'sanStatComments')],
    [sanitized.summary.totalTodosRemoved, t(state.lang, 'sanStatTodos')],
    [sanitized.summary.totalBibPruned, t(state.lang, 'sanStatBibPruned')],
  ];
  for (const [val, lbl] of statItems) {
    const box = document.createElement('div');
    box.className = 'san-stat';
    const n = document.createElement('div');
    n.className = 'san-stat-num';
    n.textContent = String(val);
    const l = document.createElement('div');
    l.className = 'san-stat-lbl';
    l.textContent = lbl;
    box.append(n, l);
    statsGrid.appendChild(box);
  }
  els.sanitizerContent.appendChild(statsGrid);

  const listLabel = document.createElement('p');
  listLabel.className = 'field-label';
  listLabel.textContent = t(state.lang, 'sanFilesList');
  els.sanitizerContent.appendChild(listLabel);

  const previewBox = document.createElement('pre');
  previewBox.className = 'san-preview-box';
  previewBox.textContent = sanitized.files[0].content.slice(0, 3500);

  const btnRow = document.createElement('div');
  btnRow.className = 'chip-container';
  sanitized.files.forEach((sf, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = idx === 0 ? 'pill active' : 'pill';
    btn.textContent = sf.outputName;
    btn.addEventListener('click', () => {
      for (const b of btnRow.querySelectorAll('button')) b.classList.remove('active');
      btn.classList.add('active');
      previewBox.textContent = sf.content.slice(0, 5000);
    });
    btnRow.appendChild(btn);
  });

  els.sanitizerContent.append(btnRow, previewBox);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function handleUploadedFiles(fileList) {
  const accepted = Array.from(fileList || []).filter((f) => {
    const lower = f.name.toLowerCase();
    return /\.(?:tex|ltx|bib|pdf|sty|cls)$/.test(lower) && !f.webkitRelativePath?.includes('/.git/');
  });
  if (accepted.length === 0) return;

  if (state.isDemo) {
    state.files = [];
    state.isDemo = false;
  }

  for (const file of accepted) {
    const relName = file.webkitRelativePath || file.name;
    const type = detectFileType(relName);
    const id = `${relName}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    // Replace existing file with same path if re-uploaded
    state.files = state.files.filter((existing) => existing.name !== relName);
    if (type === 'pdf') {
      const buf = await file.arrayBuffer();
      state.files.push({ id, name: relName, type: 'pdf', bytes: new Uint8Array(buf) });
    } else {
      const text = await file.text();
      state.files.push({ id, name: relName, type, content: text });
    }
  }

  renderFileList();
  runAudit();
}

function loadDemoSubmission() {
  state.isDemo = true;
  state.venue = 'neurips';
  els.venueSelect.value = 'neurips';
  state.blocklist = [...DEMO_BLOCKLIST];
  state.files = [
    { id: 'demo-tex', name: 'main.tex', type: 'tex', content: DEMO_MAIN_TEX },
    { id: 'demo-bib', name: 'references.bib', type: 'bib', content: DEMO_REFERENCES_BIB },
    { id: 'demo-pdf', name: 'demo_submission.pdf', type: 'pdf', bytes: buildSamplePdfBytes() },
  ];
  renderBlocklistChips();
  renderFileList();
  runAudit();
  showToast(t(state.lang, 'toastDemoLoaded'));
}

function switchTab(tabName) {
  state.activeTab = tabName;
  for (const btn of els.tabButtons) {
    const active = btn.dataset.tab === tabName;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  }
  els.tabPanelFindings.classList.toggle('hidden', tabName !== 'findings');
  els.tabPanelPdf.classList.toggle('hidden', tabName !== 'pdf');
  els.tabPanelSanitizer.classList.toggle('hidden', tabName !== 'sanitizer');
}

function openLicenseModal() {
  els.licenseErrorMsg.classList.add('hidden');
  els.licenseModal.classList.remove('hidden');
  els.licenseKeyInput.focus();
}

function wireEvents() {
  els.linkBuyGumroad.href = PURCHASE_URLS.gumroad;
  els.linkBuyMbd.href = PURCHASE_URLS.mianbaoduo;

  els.btnLoadDemo.addEventListener('click', loadDemoSubmission);

  els.btnLangToggle.addEventListener('click', async () => {
    state.lang = state.lang === 'zh' ? 'en' : 'zh';
    await saveStoredLang(state.lang);
    applyTranslations();
  });

  els.btnChooseFiles.addEventListener('click', (e) => {
    e.stopPropagation();
    els.fileInput.click();
  });
  els.btnChooseFolder.addEventListener('click', (e) => {
    e.stopPropagation();
    els.folderInput.click();
  });
  els.dropZone.addEventListener('click', () => els.fileInput.click());
  els.dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      els.fileInput.click();
    }
  });
  els.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.dropZone.classList.add('drag-over');
  });
  els.dropZone.addEventListener('dragleave', () => els.dropZone.classList.remove('drag-over'));
  els.dropZone.addEventListener('drop', async (e) => {
    e.preventDefault();
    els.dropZone.classList.remove('drag-over');
    await handleUploadedFiles(e.dataTransfer?.files);
  });

  els.fileInput.addEventListener('change', async () => {
    await handleUploadedFiles(els.fileInput.files);
    els.fileInput.value = '';
  });
  els.folderInput.addEventListener('change', async () => {
    await handleUploadedFiles(els.folderInput.files);
    els.folderInput.value = '';
  });

  els.btnClearFiles.addEventListener('click', () => {
    state.files = [];
    state.isDemo = false;
    renderFileList();
    runAudit();
  });

  // Paste modal
  els.btnPasteOpen.addEventListener('click', (e) => {
    e.stopPropagation();
    els.pasteModal.classList.remove('hidden');
    els.pasteContent.focus();
  });
  const closePaste = () => els.pasteModal.classList.add('hidden');
  els.btnPasteClose.addEventListener('click', closePaste);
  els.btnPasteCancel.addEventListener('click', closePaste);
  els.btnPasteConfirm.addEventListener('click', () => {
    const fname = els.pasteFilename.value.trim() || 'pasted.tex';
    const content = els.pasteContent.value;
    if (!content.trim()) return;
    if (state.isDemo) {
      state.files = [];
      state.isDemo = false;
    }
    state.files = state.files.filter((x) => x.name !== fname);
    state.files.push({
      id: `paste-${Date.now()}`,
      name: fname,
      type: detectFileType(fname),
      content,
    });
    els.pasteContent.value = '';
    closePaste();
    renderFileList();
    runAudit();
  });

  // Blocklist
  els.btnAddBlocklist.addEventListener('click', async () => {
    await addBlocklistTerms(els.blocklistInput.value);
    els.blocklistInput.value = '';
  });
  els.blocklistInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      await addBlocklistTerms(els.blocklistInput.value);
      els.blocklistInput.value = '';
    }
  });

  els.venueSelect.addEventListener('change', () => {
    state.venue = els.venueSelect.value;
    if (state.files.length > 0) runAudit();
  });

  els.btnRunAudit.addEventListener('click', runAudit);

  // Export Sanitized ZIP (Pro)
  els.btnExportZip.addEventListener('click', () => {
    if (!state.auditResult || !state.sanitizedResult) return;
    if (!isProActive()) {
      showToast(t(state.lang, 'toastProRequired'));
      openLicenseModal();
      return;
    }
    const md = generateMarkdownReport(state.auditResult, state.lang);
    const html = generateHtmlReport(state.auditResult, state.lang);
    const { bytes, filename } = buildSanitizedSubmissionZip(state.sanitizedResult.files, md, html);
    downloadBlob(new Blob([bytes], { type: 'application/zip' }), filename);
    showToast(t(state.lang, 'toastZipExported'));
  });

  els.btnExportHtml.addEventListener('click', () => {
    if (!state.auditResult) return;
    if (!isProActive() && !state.isDemo) {
      showToast(t(state.lang, 'toastProRequired'));
      openLicenseModal();
      return;
    }
    const html = generateHtmlReport(state.auditResult, state.lang);
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), 'PREFLIGHT_REPORT.html');
    showToast(t(state.lang, 'toastReportExported'));
  });

  els.btnExportMd.addEventListener('click', () => {
    if (!state.auditResult) return;
    if (!isProActive() && !state.isDemo) {
      showToast(t(state.lang, 'toastProRequired'));
      openLicenseModal();
      return;
    }
    const md = generateMarkdownReport(state.auditResult, state.lang);
    downloadBlob(new Blob([md], { type: 'text/markdown;charset=utf-8' }), 'PREFLIGHT_REPORT.md');
    showToast(t(state.lang, 'toastReportExported'));
  });

  // Tabs & Filters
  for (const btn of els.tabButtons) {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  }
  for (const pill of els.severityPills) {
    pill.addEventListener('click', () => {
      state.severityFilter = pill.dataset.sev;
      for (const p of els.severityPills) p.classList.toggle('active', p === pill);
      renderFindingsList(state.auditResult?.issues || []);
    });
  }
  els.categoryFilter.addEventListener('change', () => {
    state.categoryFilter = els.categoryFilter.value;
    renderFindingsList(state.auditResult?.issues || []);
  });
  els.searchFilter.addEventListener('input', () => {
    state.searchQuery = els.searchFilter.value;
    renderFindingsList(state.auditResult?.issues || []);
  });

  // License Modal
  els.btnLicenseOpen.addEventListener('click', openLicenseModal);
  els.btnBannerUpgrade.addEventListener('click', openLicenseModal);
  els.btnLicenseClose.addEventListener('click', () => els.licenseModal.classList.add('hidden'));

  els.btnLicenseVerify.addEventListener('click', async () => {
    const key = els.licenseKeyInput.value.trim();
    const verdict = await verifyLicenseKey(key);
    if (!verdict.valid) {
      els.licenseErrorMsg.textContent = verdict.reason || 'Invalid license key';
      els.licenseErrorMsg.classList.remove('hidden');
      return;
    }
    state.license = await saveStoredLicense(verdict);
    els.licenseErrorMsg.classList.add('hidden');
    els.licenseKeyInput.value = '';
    els.licenseModal.classList.add('hidden');
    renderLicenseBadge();
    if (state.files.length > 0) runAudit();
    showToast(t(state.lang, 'toastLicenseSuccess'));
  });

  els.btnLicenseDeactivate.addEventListener('click', async () => {
    await clearStoredLicense();
    state.license = null;
    renderLicenseBadge();
    if (state.files.length > 0) runAudit();
    showToast(t(state.lang, 'toastLicenseCleared'));
  });
}

async function init() {
  const savedLang = await loadStoredLang();
  if (savedLang) {
    state.lang = savedLang;
  } else {
    state.lang = navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }

  state.license = await loadStoredLicense();
  const savedBlocklist = await loadStoredBlocklist();
  if (savedBlocklist) {
    state.blocklist = savedBlocklist;
  }

  wireEvents();
  applyTranslations();
  renderBlocklistChips();
  renderFileList();
}

init();
