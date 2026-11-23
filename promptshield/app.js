/**
 * PromptShield Pro — Main UI Controller (Chrome MV3 Side Panel + Standalone Offline Web App).
 *
 * Strictly zero-network for all redaction, restoration, batch scrubbing, ZIP export,
 * and offline ECDSA P-256 license verification. Zero `innerHTML` with user input.
 */

import {
  DEMO_AI_RESPONSE,
  DEMO_BATCH_FILES,
  DEMO_CUSTOM_TERMS,
  DEMO_PROMPT,
  PRO_FEATURES,
  STOREFRONT_LINKS,
} from './core/config.js';
import {
  BUILTIN_DETECTORS,
  DETECTOR_CATEGORIES,
  createVault,
  maskPreviewValue,
  normalizeTokenPrefix,
  redact,
  restore,
  validateCustomRegex,
} from './core/redactor.js';
import {
  buildSanitizedBatchZip,
  detectFileFormat,
  inspectCsvHeaders,
  scrubBatchFiles,
} from './core/batch.js';
import {
  activateLicenseKey,
  canUseFeature,
  clearLicenseState,
  loadLicenseState,
} from './core/license.js';
import { loadLanguage, saveLanguage, t } from './core/i18n.js';

const RULES_STORAGE_KEY = 'promptshield_rules_v1';
const PROFILES_STORAGE_KEY = 'promptshield_profiles_v1';

const state = {
  lang: 'zh',
  activeTab: 'prompt',
  license: { isPro: false, status: 'free', details: null },
  enabledCategories: {
    secrets: true,
    api_keys: true,
    pii: true,
    network: true,
    custom: true,
  },
  vault: createVault(),
  lastRedactResult: null,
  lastRestoreResult: null,
  viewMode: 'diff', // 'diff' | 'plain'
  revealVaultValues: false,

  // Custom rules & saved profiles
  customTerms: [...DEMO_CUSTOM_TERMS.map((x) => ({ ...x }))],
  customRegexes: [],
  profiles: [],

  // Batch scrubber state
  batchFiles: [], // [{ name, content, format, headers, suggestedPiiColumns, selectedColumns }]
  batchSelectedIndex: 0,
  lastBatchResult: null,

  // Active AI chat tab state (Chrome extension only)
  isExtension: Boolean(globalThis.chrome?.tabs && globalThis.chrome?.runtime?.id),
  activeChatTabId: null,
  activeChatSite: null,
};

const $ = (id) => document.getElementById(id);

let toastTimer = null;
function showToast(message, variant = 'ok') {
  const banner = $('toastBanner');
  if (!banner) return;
  banner.textContent = message;
  banner.className = 'toast';
  if (variant === 'warn') banner.classList.add('toast-warn');
  if (variant === 'danger') banner.classList.add('toast-danger');
  banner.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    banner.classList.add('hidden');
  }, 3600);
}

async function storageGet(key) {
  if (globalThis.chrome?.storage?.local) {
    try {
      const res = await globalThis.chrome.storage.local.get(key);
      return res?.[key] ?? null;
    } catch {
      return null;
    }
  }
  if (typeof globalThis.localStorage !== 'undefined') {
    try {
      const raw = globalThis.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function storageSet(key, value) {
  if (globalThis.chrome?.storage?.local) {
    try {
      await globalThis.chrome.storage.local.set({ [key]: value });
    } catch {
      // ignore
    }
  }
  if (typeof globalThis.localStorage !== 'undefined') {
    try {
      globalThis.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore
    }
  }
}

async function copyTextToClipboard(text) {
  const value = String(text ?? '');
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fallback below
  }
  const tmp = document.createElement('textarea');
  tmp.value = value;
  tmp.className = 'hidden';
  document.body.appendChild(tmp);
  tmp.select();
  const ok = document.execCommand('copy');
  tmp.remove();
  return ok;
}

function triggerDownload(content, filename, mimeType) {
  const blob = content instanceof Uint8Array
    ? new Blob([content], { type: mimeType })
    : new Blob([String(content)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function getEffectiveRedactOptions() {
  const allowCustomRegex = canUseFeature(PRO_FEATURES.customRuleProfiles, state.license);
  return {
    enabledCategories: { ...state.enabledCategories },
    customTerms: state.customTerms,
    customRegexes: allowCustomRegex ? state.customRegexes : [],
  };
}

/* =========================================================================
 * Localization
 * ========================================================================= */
function applyTranslations() {
  const lang = state.lang;
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';

  $('appTagline').textContent = t(lang, 'appTagline');
  $('zeroNetText').textContent = t(lang, 'zeroNetBadge');
  $('langToggleBtn').textContent = t(lang, 'langSwitch');

  $('tabLabelPrompt').textContent = t(lang, 'tabPrompt');
  $('tabLabelBatch').textContent = t(lang, 'tabBatch');
  $('tabLabelRules').textContent = t(lang, 'tabRules');

  // Chat Bridge
  $('chatBridgeTitle').textContent = t(lang, 'chatBridgeTitle');
  $('btnPullDraft').textContent = t(lang, 'btnPullDraft');
  $('btnPushSafe').textContent = t(lang, 'btnPushSafe');
  $('btnPullReply').textContent = t(lang, 'btnPullReply');

  // Tab 1
  $('step1Title').textContent = t(lang, 'step1Title');
  $('btnLoadDemo').textContent = t(lang, 'btnLoadDemo');
  $('btnClearPrompt').textContent = t(lang, 'btnClearAll');
  $('btnResetVault').textContent = t(lang, 'btnResetVault');
  $('btnExportVault').textContent = t(lang, 'btnExportVault');
  $('btnImportVault').textContent = t(lang, 'btnImportVault');
  $('rawPromptInput').placeholder = t(lang, 'inputPlaceholder');
  $('btnSanitizeNow').textContent = t(lang, 'btnSanitize');
  $('autoSanitizeLabel').textContent = t(lang, 'autoSanitizeLabel');

  $('catLabelSecrets').textContent = t(lang, 'catSecrets');
  $('catLabelApiKeys').textContent = t(lang, 'catApiKeys');
  $('catLabelPii').textContent = t(lang, 'catPii');
  $('catLabelNetwork').textContent = t(lang, 'catNetwork');
  $('catLabelCustom').textContent = t(lang, 'catCustom');

  $('step2Title').textContent = t(lang, 'step2Title');
  $('btnViewDiff').textContent = t(lang, 'viewDiff');
  $('btnViewPlain').textContent = t(lang, 'viewPlain');
  $('btnCopySafe').textContent = t(lang, 'btnCopySafe');

  $('vaultTitle').textContent = t(lang, 'vaultTitle');
  $('vaultEmptyMsg').textContent = t(lang, 'vaultEmpty');
  $('btnToggleReveal').textContent = state.revealVaultValues ? t(lang, 'vaultHide') : t(lang, 'vaultReveal');
  $('thVaultToken').textContent = t(lang, 'vaultColToken');
  $('thVaultCat').textContent = t(lang, 'vaultColCategory');
  $('thVaultVal').textContent = t(lang, 'vaultColValue');
  $('thVaultHits').textContent = t(lang, 'vaultColHits');

  $('step3Title').textContent = t(lang, 'step3Title');
  $('btnLoadDemoReply').textContent = t(lang, 'btnLoadDemoReply');
  $('aiReplyInput').placeholder = t(lang, 'aiReplyPlaceholder');
  $('btnRestoreNow').textContent = t(lang, 'btnRestore');
  $('btnCopyRestored').textContent = t(lang, 'btnCopyRestored');

  // Tab 2
  $('batchTitle').textContent = t(lang, 'batchTitle');
  $('batchSubtitle').textContent = t(lang, 'batchSubtitle');
  $('batchDropTitle').textContent = t(lang, 'batchDropTitle');
  $('batchDropHint').textContent = t(lang, 'batchDropHint');
  $('btnPickBatchFiles').textContent = t(lang, 'btnPickFiles');
  $('btnLoadDemoBatch').textContent = t(lang, 'btnLoadDemoBatch');
  $('btnClearBatch').textContent = t(lang, 'btnClearBatch');
  $('batchFilesHeading').textContent = t(lang, 'batchFilesHeading');
  $('batchCsvColumnsTitle').textContent = t(lang, 'batchCsvColumnsTitle');
  $('batchCsvAutoNote').textContent = t(lang, 'batchCsvAutoNote');
  $('batchIncludeMapLabel').textContent = t(lang, 'batchIncludeMapLabel');
  $('includeMapWarnBox').textContent = t(lang, 'batchIncludeMapWarn');
  $('btnRunBatchZip').textContent = t(lang, 'btnRunBatchZip');
  $('btnDownloadMapOnly').textContent = t(lang, 'btnDownloadMapOnly');
  $('batchPreviewTitle').textContent = t(lang, 'batchPreviewTitle');
  $('batchEmptyState').textContent = t(lang, 'batchEmptyState');
  $('batchProGateMsg').textContent = t(lang, 'batchProGateMsg');
  $('btnBatchGoUnlock').textContent = t(lang, 'btnGoUnlock');

  // Tab 3
  $('customTermsTitle').textContent = t(lang, 'customTermsTitle');
  $('customTermInput').placeholder = t(lang, 'customTermPlaceholder');
  $('customPrefixInput').placeholder = t(lang, 'customPrefixPlaceholder');
  $('customCaseLabel').textContent = t(lang, 'customCaseLabel');
  $('customWordLabel').textContent = t(lang, 'customWordLabel');
  $('btnAddTerm').textContent = t(lang, 'btnAddTerm');
  $('proRulesHint').textContent = t(lang, 'proRulesHint');

  $('customRegexTitle').textContent = t(lang, 'customRegexTitle');
  $('customRegexNameInput').placeholder = t(lang, 'customRegexNamePlaceholder');
  $('customRegexPatternInput').placeholder = t(lang, 'customRegexPatternPlaceholder');
  $('customRegexPrefixInput').placeholder = t(lang, 'customRegexPrefixPlaceholder');
  $('btnAddRegex').textContent = t(lang, 'btnAddRegex');

  $('profilesTitle').textContent = t(lang, 'profilesTitle');
  $('profileNameInput').placeholder = t(lang, 'profileNamePlaceholder');
  $('btnSaveProfile').textContent = t(lang, 'btnSaveProfile');
  $('profilesEmptyMsg').textContent = t(lang, 'profilesEmpty');

  $('licenseTitle').textContent = t(lang, 'licenseTitle');
  $('licenseKeyInput').placeholder = t(lang, 'licenseKeyPlaceholder');
  $('btnActivateLicense').textContent = t(lang, 'btnActivate');
  $('btnDeactivateLicense').textContent = t(lang, 'btnDeactivate');
  $('linkBuyMbd').textContent = t(lang, 'btnBuyMbd');
  $('linkBuyMbd').href = STOREFRONT_LINKS.mianbaoduo;
  $('linkBuyGumroad').textContent = t(lang, 'btnBuyGumroad');
  $('linkBuyGumroad').href = STOREFRONT_LINKS.gumroad;
  $('privacyProofTitle').textContent = t(lang, 'privacyProofTitle');
  $('privacyProofDesc').textContent = t(lang, 'privacyProofDesc');
  $('detectorsListTitle').textContent = t(lang, 'detectorsListTitle', {
    count: BUILTIN_DETECTORS.length,
  });

  renderLicenseUI();
  renderChatBridgeStatus();
  renderBuiltinDetectors();
  renderCustomRulesUI();
  renderPromptResults();
  renderRestoreResults();
  renderBatchUI();
}

/* =========================================================================
 * Tab Navigation
 * ========================================================================= */
function switchTab(tabName) {
  state.activeTab = tabName;
  const map = {
    prompt: { btn: $('tabBtnPrompt'), panel: $('panelPrompt') },
    batch: { btn: $('tabBtnBatch'), panel: $('panelBatch') },
    rules: { btn: $('tabBtnRules'), panel: $('panelRules') },
  };
  for (const [key, refs] of Object.entries(map)) {
    const active = key === tabName;
    refs.btn.classList.toggle('active', active);
    refs.btn.setAttribute('aria-selected', String(active));
    refs.panel.classList.toggle('active', active);
  }
}

/* =========================================================================
 * Tab 1: Prompt Sanitize, Vault & Restore
 * ========================================================================= */
function runSanitize({ freshVault = false } = {}) {
  const raw = $('rawPromptInput').value;
  $('rawCharCount').textContent = `${raw.length.toLocaleString()} chars`;

  const baseVault = freshVault ? createVault() : state.vault;
  const res = redact(raw, getEffectiveRedactOptions(), baseVault);
  state.vault = res.mapping;
  state.lastRedactResult = res;

  renderPromptResults();
  if ($('aiReplyInput').value.trim()) {
    runRestore();
  }
}

function renderPromptResults() {
  const res = state.lastRedactResult;
  const lang = state.lang;

  // Update category hit counters
  const stats = res?.statsByCategory || { secrets: 0, api_keys: 0, pii: 0, network: 0, custom: 0 };
  const idMap = {
    secrets: 'catCountSecrets',
    api_keys: 'catCountApiKeys',
    pii: 'catCountPii',
    network: 'catCountNetwork',
    custom: 'catCountCustom',
  };
  for (const [cat, countId] of Object.entries(idMap)) {
    const count = stats[cat] || 0;
    const countEl = $(countId);
    if (countEl) countEl.textContent = String(count);
    const chip = document.querySelector(`.cat-chip[data-cat="${cat}"]`);
    if (chip) {
      chip.classList.toggle('active', Boolean(state.enabledCategories[cat]));
      chip.classList.toggle('has-hits', count > 0);
    }
  }

  // Status bar
  const bar = $('hitsSummaryBar');
  if (!res || res.totalHits === 0) {
    bar.textContent = t(lang, 'noHitsSummary');
    bar.className = 'status-strip status-neutral';
  } else {
    bar.textContent = t(lang, 'hitsSummary', {
      total: res.totalHits,
      unique: res.uniqueCount,
    });
    bar.className = 'status-strip status-ok';
  }

  // Highlighted diff preview (XSS-safe DOM nodes)
  const diffBox = $('safeDiffPreview');
  const plainBox = $('safePlainOutput');
  diffBox.replaceChildren();
  plainBox.value = res?.redactedText ?? '';

  if (res?.segments?.length) {
    const frag = document.createDocumentFragment();
    for (const seg of res.segments) {
      if (seg.type === 'token') {
        const span = document.createElement('span');
        span.className = `tok tok-${seg.category || 'custom'}`;
        span.textContent = seg.text;
        const label = lang === 'zh' ? seg.labelZh : seg.labelEn;
        span.title = `${label} · ${maskPreviewValue(seg.rawValue)}`;
        frag.appendChild(span);
      } else {
        frag.appendChild(document.createTextNode(seg.text));
      }
    }
    diffBox.appendChild(frag);
  }

  diffBox.classList.toggle('hidden', state.viewMode !== 'diff');
  plainBox.classList.toggle('hidden', state.viewMode !== 'plain');
  $('btnViewDiff').classList.toggle('active', state.viewMode === 'diff');
  $('btnViewPlain').classList.toggle('active', state.viewMode === 'plain');

  const vaultEntries = Object.entries(state.vault.tokenToEntry);
  $('safeMetaInfo').textContent = `${vaultEntries.length} vault token(s)`;
  renderVaultTable();
}

function renderVaultTable() {
  const entries = Object.entries(state.vault.tokenToEntry);
  $('vaultCountBadge').textContent = String(entries.length);
  $('vaultEmptyMsg').classList.toggle('hidden', entries.length > 0);
  $('vaultTableWrap').classList.toggle('hidden', entries.length === 0);

  const tbody = $('vaultTableBody');
  tbody.replaceChildren();
  const frag = document.createDocumentFragment();

  for (const [token, entry] of entries) {
    const tr = document.createElement('tr');

    const tdTok = document.createElement('td');
    const tokSpan = document.createElement('span');
    tokSpan.className = `tok tok-${entry.category || 'custom'}`;
    tokSpan.textContent = token;
    tdTok.appendChild(tokSpan);

    const tdCat = document.createElement('td');
    const catMeta = DETECTOR_CATEGORIES[entry.category];
    tdCat.textContent = catMeta
      ? (state.lang === 'zh' ? catMeta.labelZh : catMeta.labelEn)
      : entry.category;

    const tdVal = document.createElement('td');
    tdVal.textContent = state.revealVaultValues ? entry.value : maskPreviewValue(entry.value);

    const tdHits = document.createElement('td');
    tdHits.textContent = String(entry.count || 1);

    tr.append(tdTok, tdCat, tdVal, tdHits);
    frag.appendChild(tr);
  }
  tbody.appendChild(frag);
}

function runRestore() {
  const aiText = $('aiReplyInput').value;
  state.lastRestoreResult = restore(aiText, state.vault);
  renderRestoreResults();
}

function renderRestoreResults() {
  const res = state.lastRestoreResult;
  const lang = state.lang;
  const statusBar = $('restoreStatusBar');
  const warnBar = $('unresolvedWarnBar');
  const preview = $('restoredPreview');
  preview.replaceChildren();

  if (!res || !$('aiReplyInput').value.trim()) {
    statusBar.classList.add('hidden');
    warnBar.classList.add('hidden');
    preview.textContent = t(lang, 'restoredEmpty');
    $('restoredMetaCount').textContent = '0 restored';
    return;
  }

  statusBar.textContent = t(lang, 'restoredSummary', { count: res.restoredCount });
  statusBar.className = res.restoredCount > 0 ? 'status-strip status-ok' : 'status-strip status-neutral';
  statusBar.classList.remove('hidden');

  if (res.unresolvedTokens.length > 0) {
    warnBar.textContent = t(lang, 'unresolvedWarn', {
      count: res.unresolvedTokens.length,
      tokens: res.unresolvedTokens.join(', '),
    });
    warnBar.classList.remove('hidden');
  } else {
    warnBar.classList.add('hidden');
  }

  const frag = document.createDocumentFragment();
  for (const seg of res.segments) {
    if (seg.type === 'restored') {
      const span = document.createElement('span');
      span.className = 'tok tok-restored';
      span.textContent = seg.text;
      span.title = `Restored from ${seg.placeholder}`;
      frag.appendChild(span);
    } else if (seg.type === 'unresolved') {
      const span = document.createElement('span');
      span.className = 'tok tok-unresolved';
      span.textContent = seg.text;
      span.title = 'Unresolved placeholder';
      frag.appendChild(span);
    } else {
      frag.appendChild(document.createTextNode(seg.text));
    }
  }
  preview.appendChild(frag);
  $('restoredMetaCount').textContent = `${res.restoredCount} restored`;
}

/* =========================================================================
 * Tab 2: Batch File / CSV / JSON Scrubber (Pro)
 * ========================================================================= */
function addBatchFileRecords(items) {
  for (const item of items) {
    const format = detectFileFormat(item.name);
    let headers = [];
    let suggestedPiiColumns = [];
    let selectedColumns = [];
    if (format === 'csv' || format === 'tsv') {
      const inspected = inspectCsvHeaders(item.content, format === 'tsv' ? '\t' : ',');
      headers = inspected.headers;
      suggestedPiiColumns = inspected.suggestedPiiColumns;
      selectedColumns = [...inspected.suggestedPiiColumns];
    }

    const existingIdx = state.batchFiles.findIndex((f) => f.name === item.name);
    const record = {
      name: item.name,
      content: item.content,
      format,
      headers,
      suggestedPiiColumns,
      selectedColumns,
    };
    if (existingIdx >= 0) {
      state.batchFiles[existingIdx] = record;
    } else {
      state.batchFiles.push(record);
    }
  }

  if (state.batchSelectedIndex >= state.batchFiles.length) {
    state.batchSelectedIndex = 0;
  }
  recomputeBatchPreview();
}

function recomputeBatchPreview() {
  if (state.batchFiles.length === 0) {
    state.lastBatchResult = null;
    renderBatchUI();
    return;
  }
  state.lastBatchResult = scrubBatchFiles(
    state.batchFiles.map((f) => ({
      name: f.name,
      content: f.content,
      selectedColumns: f.selectedColumns,
    })),
    getEffectiveRedactOptions(),
  );
  renderBatchUI();
}

function renderBatchUI() {
  const hasFiles = state.batchFiles.length > 0;
  const isBatchPro = canUseFeature(PRO_FEATURES.batchScrubber, state.license);

  $('batchFileCountBadge').textContent = String(state.batchFiles.length);
  $('batchEmptyState').classList.toggle('hidden', hasFiles);
  $('batchExportControls').classList.toggle('hidden', !hasFiles);
  $('batchProBanner').classList.toggle('hidden', isBatchPro || !hasFiles);

  const listEl = $('batchFileList');
  listEl.replaceChildren();

  if (hasFiles && state.lastBatchResult) {
    const frag = document.createDocumentFragment();
    state.lastBatchResult.files.forEach((resFile, idx) => {
      const li = document.createElement('li');
      li.className = `file-item${idx === state.batchSelectedIndex ? ' selected' : ''}`;
      li.addEventListener('click', () => {
        state.batchSelectedIndex = idx;
        renderBatchUI();
      });

      const meta = document.createElement('div');
      meta.className = 'file-item-meta';

      const nameEl = document.createElement('span');
      nameEl.className = 'file-item-name';
      nameEl.textContent = resFile.name;

      const subEl = document.createElement('span');
      subEl.className = 'file-item-sub';
      subEl.textContent = `${resFile.format.toUpperCase()} · ${resFile.totalHits} redacted`;
      meta.append(nameEl, subEl);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn btn-ghost btn-xs';
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.batchFiles.splice(idx, 1);
        if (state.batchSelectedIndex >= state.batchFiles.length) {
          state.batchSelectedIndex = Math.max(0, state.batchFiles.length - 1);
        }
        recomputeBatchPreview();
      });

      li.append(meta, removeBtn);
      frag.appendChild(li);
    });
    listEl.appendChild(frag);
  }

  // CSV Column selector for currently selected file
  const selectedFile = state.batchFiles[state.batchSelectedIndex];
  const colPanel = $('csvColumnPanel');
  const colChecks = $('csvColumnChecks');
  colChecks.replaceChildren();

  if (selectedFile && (selectedFile.format === 'csv' || selectedFile.format === 'tsv') && selectedFile.headers.length > 0) {
    colPanel.classList.remove('hidden');
    const frag = document.createDocumentFragment();
    for (const header of selectedFile.headers) {
      const isSuggested = selectedFile.suggestedPiiColumns.includes(header);
      const isChecked = selectedFile.selectedColumns.includes(header);

      const label = document.createElement('label');
      label.className = `col-check-chip${isSuggested ? ' suggested' : ''}`;
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = isChecked;
      cb.addEventListener('change', () => {
        if (cb.checked) {
          if (!selectedFile.selectedColumns.includes(header)) {
            selectedFile.selectedColumns.push(header);
          }
        } else {
          selectedFile.selectedColumns = selectedFile.selectedColumns.filter((c) => c !== header);
        }
        recomputeBatchPreview();
      });

      const span = document.createElement('span');
      span.textContent = header;
      label.append(cb, span);
      frag.appendChild(label);
    }
    colChecks.appendChild(frag);
  } else {
    colPanel.classList.add('hidden');
  }

  // Preview sanitized output
  const previewCode = $('batchPreviewCode');
  const previewMeta = $('batchPreviewMeta');
  if (hasFiles && state.lastBatchResult) {
    const activeIdx = isBatchPro ? state.batchSelectedIndex : 0;
    const activeRes = state.lastBatchResult.files[activeIdx];
    previewMeta.textContent = `${activeRes.name} · ${activeRes.totalHits} hits`;
    previewCode.textContent = activeRes.sanitizedText;
  } else {
    previewMeta.textContent = '—';
    previewCode.textContent = '';
  }

  const includeMap = $('includeRestoreMapToggle').checked;
  $('includeMapWarnBox').classList.toggle('hidden', !includeMap);
}

/* =========================================================================
 * Tab 3: Custom Terms, Custom Regex, Saved Profiles & Pro License
 * ========================================================================= */
async function persistCustomRulesIfPro() {
  if (canUseFeature(PRO_FEATURES.customRuleProfiles, state.license)) {
    await storageSet(RULES_STORAGE_KEY, {
      customTerms: state.customTerms,
      customRegexes: state.customRegexes,
    });
  }
}

function renderCustomRulesUI() {
  const isProRules = canUseFeature(PRO_FEATURES.customRuleProfiles, state.license);

  // Custom Terms List
  const termList = $('customTermList');
  termList.replaceChildren();
  for (const item of state.customTerms) {
    const li = document.createElement('li');
    li.className = 'rule-item';

    const meta = document.createElement('div');
    meta.className = 'rule-item-meta';

    const nameEl = document.createElement('span');
    nameEl.className = 'rule-item-name';
    nameEl.textContent = `${item.term} → [${item.tokenPrefix}_n]`;

    const subEl = document.createElement('span');
    subEl.className = 'rule-item-sub';
    subEl.textContent = `${item.caseSensitive ? 'Case-sensitive' : 'Ignore-case'} · ${item.wholeWord ? 'Whole-word' : 'Substring'}`;
    meta.append(nameEl, subEl);

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'btn btn-danger-ghost btn-xs';
    rm.textContent = '×';
    rm.addEventListener('click', async () => {
      state.customTerms = state.customTerms.filter((x) => x.id !== item.id);
      await persistCustomRulesIfPro();
      renderCustomRulesUI();
      if ($('rawPromptInput').value) runSanitize({ freshVault: true });
      if (state.batchFiles.length) recomputeBatchPreview();
    });

    li.append(meta, rm);
    termList.appendChild(li);
  }

  // Custom Regex List
  const regexList = $('customRegexList');
  regexList.replaceChildren();
  for (const item of state.customRegexes) {
    const li = document.createElement('li');
    li.className = 'rule-item';

    const meta = document.createElement('div');
    meta.className = 'rule-item-meta';

    const nameEl = document.createElement('span');
    nameEl.className = 'rule-item-name';
    nameEl.textContent = `${item.name} → [${item.tokenPrefix}_n]`;

    const subEl = document.createElement('span');
    subEl.className = 'rule-item-sub mono';
    subEl.textContent = `/${item.pattern}/${item.flags || 'g'}`;
    meta.append(nameEl, subEl);

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'btn btn-danger-ghost btn-xs';
    rm.textContent = '×';
    rm.addEventListener('click', async () => {
      state.customRegexes = state.customRegexes.filter((x) => x.id !== item.id);
      await persistCustomRulesIfPro();
      renderCustomRulesUI();
      if ($('rawPromptInput').value) runSanitize({ freshVault: true });
      if (state.batchFiles.length) recomputeBatchPreview();
    });

    li.append(meta, rm);
    regexList.appendChild(li);
  }

  // Saved Profiles List
  const profList = $('profilesList');
  profList.replaceChildren();
  $('profilesEmptyMsg').classList.toggle('hidden', state.profiles.length > 0);

  for (const prof of state.profiles) {
    const li = document.createElement('li');
    li.className = 'rule-item';

    const meta = document.createElement('div');
    meta.className = 'rule-item-meta';

    const nameEl = document.createElement('span');
    nameEl.className = 'rule-item-name';
    nameEl.textContent = prof.name;

    const subEl = document.createElement('span');
    subEl.className = 'rule-item-sub';
    subEl.textContent = `${prof.customTerms.length} terms · ${prof.customRegexes.length} regex`;
    meta.append(nameEl, subEl);

    const actions = document.createElement('div');
    actions.className = 'btn-group';

    const loadBtn = document.createElement('button');
    loadBtn.type = 'button';
    loadBtn.className = 'btn btn-secondary btn-xs';
    loadBtn.textContent = t(state.lang, 'btnLoadProfile');
    loadBtn.disabled = !isProRules;
    loadBtn.addEventListener('click', async () => {
      state.customTerms = prof.customTerms.map((x) => ({ ...x }));
      state.customRegexes = prof.customRegexes.map((x) => ({ ...x }));
      await persistCustomRulesIfPro();
      renderCustomRulesUI();
      if ($('rawPromptInput').value) runSanitize({ freshVault: true });
      showToast(`Loaded profile: ${prof.name}`);
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-danger-ghost btn-xs';
    delBtn.textContent = t(state.lang, 'btnDeleteProfile');
    delBtn.addEventListener('click', async () => {
      state.profiles = state.profiles.filter((p) => p.id !== prof.id);
      await storageSet(PROFILES_STORAGE_KEY, state.profiles);
      renderCustomRulesUI();
    });

    actions.append(loadBtn, delBtn);
    li.append(meta, actions);
    profList.appendChild(li);
  }
}

function renderBuiltinDetectors() {
  const container = $('builtinDetectorsList');
  container.replaceChildren();
  const frag = document.createDocumentFragment();
  for (const det of BUILTIN_DETECTORS) {
    const div = document.createElement('div');
    div.className = 'detector-chip';

    const prefix = document.createElement('span');
    prefix.className = 'detector-chip-prefix';
    prefix.textContent = `[${det.tokenPrefix}_1]`;

    const label = document.createElement('span');
    label.className = 'detector-chip-label';
    label.textContent = state.lang === 'zh' ? det.labelZh : det.labelEn;

    div.append(prefix, label);
    frag.appendChild(div);
  }
  container.appendChild(frag);
}

function renderLicenseUI() {
  const isPro = Boolean(state.license.isPro);
  const lang = state.lang;

  const badge = $('tierBadge');
  badge.textContent = isPro ? t(lang, 'tierPro') : t(lang, 'tierFree');
  badge.className = `badge ${isPro ? 'badge-pro' : 'badge-free'}`;

  const statusBox = $('licenseStatusBox');
  if (isPro) {
    const d = state.license.details || {};
    statusBox.textContent = t(lang, 'licenseStatusPro', {
      mode: d.mode === 'offline' ? 'ECDSA P-256 Offline' : (d.mode || 'Pro'),
      serial: d.serial || '0000',
      batch: d.batch || 'default',
    });
    statusBox.className = 'status-strip status-ok';
    $('btnDeactivateLicense').classList.remove('hidden');
  } else {
    statusBox.textContent = t(lang, 'licenseStatusFree', { count: BUILTIN_DETECTORS.length });
    statusBox.className = 'status-strip status-neutral';
    $('btnDeactivateLicense').classList.add('hidden');
  }
}

/* =========================================================================
 * Chrome Extension Active AI Chat Bridge (Explicit Click Only)
 * ========================================================================= */
async function probeActiveChatTab() {
  if (!state.isExtension) {
    state.activeChatTabId = null;
    state.activeChatSite = null;
    renderChatBridgeStatus();
    return;
  }

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs?.[0];
    if (!tab?.id) {
      state.activeChatTabId = null;
      state.activeChatSite = null;
      renderChatBridgeStatus();
      return;
    }

    const resp = await chrome.tabs.sendMessage(tab.id, { type: 'PS_GET_SITE_INFO' });
    if (resp?.ok && resp.site && resp.site !== 'unknown') {
      state.activeChatTabId = tab.id;
      state.activeChatSite = resp.site;
    } else {
      state.activeChatTabId = null;
      state.activeChatSite = null;
    }
  } catch {
    state.activeChatTabId = null;
    state.activeChatSite = null;
  }
  renderChatBridgeStatus();
}

function renderChatBridgeStatus() {
  const lang = state.lang;
  const statusEl = $('chatBridgeStatus');
  const actionsEl = $('chatBridgeActions');

  if (!state.isExtension) {
    statusEl.textContent = t(lang, 'chatStandaloneNote');
    actionsEl.classList.add('hidden');
    return;
  }

  actionsEl.classList.remove('hidden');
  const connected = Boolean(state.activeChatTabId && state.activeChatSite);
  if (connected) {
    const names = { chatgpt: 'ChatGPT', claude: 'Claude', gemini: 'Gemini' };
    statusEl.textContent = t(lang, 'chatSiteReady', {
      site: names[state.activeChatSite] || state.activeChatSite,
    });
  } else {
    statusEl.textContent = t(lang, 'chatSiteNone');
  }

  $('btnPullDraft').disabled = !connected;
  $('btnPushSafe').disabled = !connected;
  $('btnPullReply').disabled = !connected;
}

async function handleChatAction(actionType) {
  if (!canUseFeature(PRO_FEATURES.chatIntegration, state.license)) {
    showToast(t(state.lang, 'chatNeedPro'), 'warn');
    switchTab('rules');
    return;
  }
  await probeActiveChatTab();
  if (!state.activeChatTabId) {
    showToast(t(state.lang, 'chatSiteNone'), 'warn');
    return;
  }

  try {
    if (actionType === 'pullDraft') {
      const resp = await chrome.tabs.sendMessage(state.activeChatTabId, { type: 'PS_READ_PROMPT' });
      if (!resp?.ok) {
        showToast(resp?.error || 'Could not read chat input', 'warn');
        return;
      }
      $('rawPromptInput').value = resp.text || '';
      switchTab('prompt');
      runSanitize();
      showToast(t(state.lang, 'hitsSummary', {
        total: state.lastRedactResult?.totalHits || 0,
        unique: state.lastRedactResult?.uniqueCount || 0,
      }));
    } else if (actionType === 'pushSafe') {
      const safeText = state.lastRedactResult?.redactedText ?? $('rawPromptInput').value;
      if (!safeText) return;
      const resp = await chrome.tabs.sendMessage(state.activeChatTabId, {
        type: 'PS_WRITE_PROMPT',
        text: safeText,
      });
      if (resp?.ok) {
        showToast('Safe prompt inserted into active AI chat.');
      } else {
        showToast(resp?.error || 'Could not write to chat input', 'warn');
      }
    } else if (actionType === 'pullReply') {
      const resp = await chrome.tabs.sendMessage(state.activeChatTabId, { type: 'PS_READ_LAST_REPLY' });
      if (!resp?.ok) {
        showToast(resp?.error || 'No AI reply found yet', 'warn');
        return;
      }
      $('aiReplyInput').value = resp.text || '';
      switchTab('prompt');
      runRestore();
      showToast(t(state.lang, 'restoredSummary', {
        count: state.lastRestoreResult?.restoredCount || 0,
      }));
    }
  } catch (err) {
    showToast(err.message || 'Tab communication error', 'danger');
  }
}

/* =========================================================================
 * Event Wiring
 * ========================================================================= */
function bindEvents() {
  // Language switch
  $('langToggleBtn').addEventListener('click', async () => {
    state.lang = state.lang === 'zh' ? 'en' : 'zh';
    await saveLanguage(state.lang);
    applyTranslations();
  });

  // Tabs
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Chat Bridge buttons
  $('btnPullDraft').addEventListener('click', () => handleChatAction('pullDraft'));
  $('btnPushSafe').addEventListener('click', () => handleChatAction('pushSafe'));
  $('btnPullReply').addEventListener('click', () => handleChatAction('pullReply'));

  // Category filter chips
  document.querySelectorAll('.cat-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      const cat = chip.dataset.cat;
      state.enabledCategories[cat] = !state.enabledCategories[cat];
      runSanitize({ freshVault: true });
      if (state.batchFiles.length) recomputeBatchPreview();
    });
  });

  // Tab 1 controls
  $('rawPromptInput').addEventListener('input', () => {
    $('rawCharCount').textContent = `${$('rawPromptInput').value.length.toLocaleString()} chars`;
    if ($('autoSanitizeToggle').checked) {
      runSanitize({ freshVault: false });
    }
  });

  $('btnSanitizeNow').addEventListener('click', () => runSanitize({ freshVault: false }));

  $('btnLoadDemo').addEventListener('click', () => {
    // Ensure AcmeHealth Corp demo term is active
    if (!state.customTerms.some((x) => x.term.toLowerCase() === 'acmehealth corp')) {
      state.customTerms.unshift({ ...DEMO_CUSTOM_TERMS[0] });
      renderCustomRulesUI();
    }
    state.vault = createVault();
    $('rawPromptInput').value = DEMO_PROMPT;
    runSanitize({ freshVault: true });
    $('aiReplyInput').value = '';
    state.lastRestoreResult = null;
    renderRestoreResults();
  });

  $('btnLoadDemoReply').addEventListener('click', () => {
    if (Object.keys(state.vault.tokenToEntry).length === 0) {
      $('btnLoadDemo').click();
    }
    $('aiReplyInput').value = DEMO_AI_RESPONSE;
    runRestore();
  });

  $('btnClearPrompt').addEventListener('click', () => {
    $('rawPromptInput').value = '';
    $('aiReplyInput').value = '';
    state.lastRedactResult = null;
    state.lastRestoreResult = null;
    $('rawCharCount').textContent = '0 chars';
    renderPromptResults();
    renderRestoreResults();
  });

  $('btnResetVault').addEventListener('click', () => {
    state.vault = createVault();
    if ($('rawPromptInput').value.trim()) {
      runSanitize({ freshVault: true });
    } else {
      renderVaultTable();
    }
    showToast('Session vault cleared.');
  });

  $('btnViewDiff').addEventListener('click', () => {
    state.viewMode = 'diff';
    renderPromptResults();
  });

  $('btnViewPlain').addEventListener('click', () => {
    state.viewMode = 'plain';
    renderPromptResults();
  });

  $('btnCopySafe').addEventListener('click', async () => {
    const text = state.lastRedactResult?.redactedText ?? '';
    if (!text) return;
    if (await copyTextToClipboard(text)) {
      showToast(t(state.lang, 'copiedToast'));
    }
  });

  $('btnToggleReveal').addEventListener('click', () => {
    state.revealVaultValues = !state.revealVaultValues;
    $('btnToggleReveal').textContent = state.revealVaultValues
      ? t(state.lang, 'vaultHide')
      : t(state.lang, 'vaultReveal');
    renderVaultTable();
  });

  $('btnExportVault').addEventListener('click', () => {
    const json = JSON.stringify(state.vault, null, 2);
    triggerDownload(json, 'promptshield-restore-map.json', 'application/json;charset=utf-8');
  });

  $('btnImportVault').addEventListener('click', () => $('vaultFileInput').click());
  $('vaultFileInput').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const imported = createVault(parsed);
      const count = Object.keys(imported.tokenToEntry).length;
      if (count === 0) throw new Error('Empty vault');
      state.vault = imported;
      renderVaultTable();
      if ($('aiReplyInput').value.trim()) runRestore();
      showToast(t(state.lang, 'vaultImportedToast', { count }));
    } catch {
      showToast(t(state.lang, 'invalidVaultJson'), 'danger');
    } finally {
      e.target.value = '';
    }
  });

  $('btnRestoreNow').addEventListener('click', () => runRestore());
  $('aiReplyInput').addEventListener('input', () => {
    if ($('autoSanitizeToggle').checked) {
      runRestore();
    }
  });

  $('btnCopyRestored').addEventListener('click', async () => {
    const text = state.lastRestoreResult?.restoredText ?? '';
    if (!text) return;
    if (await copyTextToClipboard(text)) {
      showToast(t(state.lang, 'copiedToast'));
    }
  });

  // Tab 2: Batch Scrubber
  const dropzone = $('batchDropzone');
  $('btnPickBatchFiles').addEventListener('click', (e) => {
    e.stopPropagation();
    $('batchFileInput').click();
  });
  dropzone.addEventListener('click', (e) => {
    if (e.target === dropzone || e.target.classList.contains('dropzone-title') || e.target.classList.contains('dropzone-hint')) {
      $('batchFileInput').click();
    }
  });
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('drag-over');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    const dropped = Array.from(e.dataTransfer?.files || []);
    if (dropped.length === 0) return;
    const loaded = [];
    for (const f of dropped) {
      loaded.push({ name: f.name, content: await f.text() });
    }
    addBatchFileRecords(loaded);
  });

  $('batchFileInput').addEventListener('change', async (e) => {
    const picked = Array.from(e.target.files || []);
    if (picked.length === 0) return;
    const loaded = [];
    for (const f of picked) {
      loaded.push({ name: f.name, content: await f.text() });
    }
    addBatchFileRecords(loaded);
    e.target.value = '';
  });

  $('btnLoadDemoBatch').addEventListener('click', (e) => {
    e.stopPropagation();
    addBatchFileRecords(DEMO_BATCH_FILES.map((f) => ({ ...f })));
  });

  $('btnClearBatch').addEventListener('click', (e) => {
    e.stopPropagation();
    state.batchFiles = [];
    state.batchSelectedIndex = 0;
    state.lastBatchResult = null;
    renderBatchUI();
  });

  $('includeRestoreMapToggle').addEventListener('change', () => renderBatchUI());
  $('btnBatchGoUnlock').addEventListener('click', () => switchTab('rules'));

  $('btnRunBatchZip').addEventListener('click', () => {
    if (!canUseFeature(PRO_FEATURES.batchScrubber, state.license)) {
      showToast(t(state.lang, 'batchProGateMsg'), 'warn');
      switchTab('rules');
      return;
    }
    if (!state.lastBatchResult) return;
    const includeRestoreMap = $('includeRestoreMapToggle').checked;
    const pkg = buildSanitizedBatchZip(state.lastBatchResult, { includeRestoreMap });
    // Sync batch vault into active session vault so user can immediately restore AI responses!
    state.vault = createVault(state.lastBatchResult.mapping);
    renderVaultTable();
    triggerDownload(pkg.bytes, pkg.filename, 'application/zip');
    showToast(t(state.lang, 'batchDoneToast', {
      count: state.lastBatchResult.files.length,
      hits: state.lastBatchResult.totalHits,
    }));
  });

  $('btnDownloadMapOnly').addEventListener('click', () => {
    if (!canUseFeature(PRO_FEATURES.batchScrubber, state.license)) {
      showToast(t(state.lang, 'batchProGateMsg'), 'warn');
      switchTab('rules');
      return;
    }
    if (!state.lastBatchResult) return;
    const json = JSON.stringify(state.lastBatchResult.mapping, null, 2);
    triggerDownload(json, 'restore_map.json', 'application/json;charset=utf-8');
  });

  // Tab 3: Custom Rules & Profiles
  $('btnAddTerm').addEventListener('click', async () => {
    const term = $('customTermInput').value.trim();
    if (!term) return;
    const prefix = normalizeTokenPrefix($('customPrefixInput').value, 'CUSTOM');
    state.customTerms.push({
      id: `term-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      term,
      tokenPrefix: prefix,
      caseSensitive: $('customCaseToggle').checked,
      wholeWord: $('customWordToggle').checked,
      enabled: true,
    });
    $('customTermInput').value = '';
    await persistCustomRulesIfPro();
    renderCustomRulesUI();
    if ($('rawPromptInput').value) runSanitize({ freshVault: true });
    if (state.batchFiles.length) recomputeBatchPreview();
  });

  $('btnAddRegex').addEventListener('click', async () => {
    const errBox = $('customRegexErrorBox');
    errBox.classList.add('hidden');
    if (!canUseFeature(PRO_FEATURES.customRuleProfiles, state.license)) {
      showToast(t(state.lang, 'proRulesHint'), 'warn');
      return;
    }
    const name = $('customRegexNameInput').value.trim() || 'Custom Regex';
    const pattern = $('customRegexPatternInput').value.trim();
    const prefix = normalizeTokenPrefix($('customRegexPrefixInput').value, 'CUSTOM');
    const check = validateCustomRegex(pattern, 'g');
    if (!check.valid) {
      errBox.textContent = t(state.lang, 'customRegexError', { error: check.error });
      errBox.classList.remove('hidden');
      return;
    }
    state.customRegexes.push({
      id: `rx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      pattern,
      flags: 'g',
      tokenPrefix: prefix,
      enabled: true,
    });
    $('customRegexNameInput').value = '';
    $('customRegexPatternInput').value = '';
    await persistCustomRulesIfPro();
    renderCustomRulesUI();
    if ($('rawPromptInput').value) runSanitize({ freshVault: true });
    if (state.batchFiles.length) recomputeBatchPreview();
  });

  $('btnSaveProfile').addEventListener('click', async () => {
    if (!canUseFeature(PRO_FEATURES.customRuleProfiles, state.license)) {
      showToast(t(state.lang, 'proRulesHint'), 'warn');
      return;
    }
    const name = $('profileNameInput').value.trim();
    if (!name) return;
    state.profiles.push({
      id: `prof-${Date.now()}`,
      name,
      customTerms: state.customTerms.map((x) => ({ ...x })),
      customRegexes: state.customRegexes.map((x) => ({ ...x })),
      savedAt: new Date().toISOString(),
    });
    $('profileNameInput').value = '';
    await storageSet(PROFILES_STORAGE_KEY, state.profiles);
    renderCustomRulesUI();
    showToast(`Saved profile: ${name}`);
  });

  // License activation
  $('btnActivateLicense').addEventListener('click', async () => {
    const key = $('licenseKeyInput').value.trim();
    const feedback = $('licenseFeedback');
    feedback.classList.add('hidden');
    const res = await activateLicenseKey(key);
    if (res.valid) {
      state.license = res;
      $('licenseKeyInput').value = '';
      feedback.textContent = t(state.lang, 'licenseActivatedToast');
      feedback.className = 'status-strip status-ok';
      feedback.classList.remove('hidden');
      renderLicenseUI();
      renderCustomRulesUI();
      renderBatchUI();
      showToast(t(state.lang, 'licenseActivatedToast'));
    } else {
      feedback.textContent = res.reason || 'Invalid license key';
      feedback.className = 'status-strip status-danger';
      feedback.classList.remove('hidden');
    }
  });

  $('btnDeactivateLicense').addEventListener('click', async () => {
    state.license = await clearLicenseState();
    $('licenseFeedback').classList.add('hidden');
    renderLicenseUI();
    renderCustomRulesUI();
    renderBatchUI();
    showToast(t(state.lang, 'licenseDeactivatedToast'), 'warn');
  });

  // Chrome extension tab switch refresh
  if (state.isExtension && chrome.tabs?.onActivated) {
    chrome.tabs.onActivated.addListener(() => probeActiveChatTab());
    chrome.tabs.onUpdated.addListener((_tabId, info) => {
      if (info.status === 'complete') probeActiveChatTab();
    });
  }
}

/* =========================================================================
 * Bootstrap
 * ========================================================================= */
async function init() {
  state.lang = await loadLanguage();
  state.license = await loadLicenseState();

  const savedRules = await storageGet(RULES_STORAGE_KEY);
  if (savedRules && typeof savedRules === 'object') {
    if (Array.isArray(savedRules.customTerms)) state.customTerms = savedRules.customTerms;
    if (Array.isArray(savedRules.customRegexes)) state.customRegexes = savedRules.customRegexes;
  }

  const savedProfiles = await storageGet(PROFILES_STORAGE_KEY);
  if (Array.isArray(savedProfiles)) {
    state.profiles = savedProfiles;
  }

  bindEvents();
  applyTranslations();
  await probeActiveChatTab();
}

init();
