/**
 * GPSRKit Pro — Browser Compliance Studio Controller
 * 100% offline, zero external CDN or npm dependencies.
 */

import {
  FREE_LABEL_LANGUAGES,
  PRO_LABEL_LANGUAGES,
  PURCHASE_URLS,
  STORAGE_KEYS,
} from './core/config.js';
import {
  CATEGORY_BY_ID,
  CATEGORY_PRESETS,
  SAMPLE_BATCH_CSV,
  SAMPLE_PRODUCTS,
  assessRiskMatrix,
  createDefaultHazardsForCategory,
  evaluateReadiness,
  getSampleProduct,
  normalizeProductRecord,
  parseBatchCsv,
} from './core/gpsr.js';
import {
  clearStoredLicense,
  getEntitlements,
  loadStoredLang,
  loadStoredLicense,
  saveStoredLang,
  saveStoredLicense,
  storageGet,
  storageSet,
  verifyLicenseKey,
} from './core/license.js';
import {
  escapeHtml,
  generateBatchZipBundle,
  generateLabelSheetHtml,
  generateMarketplaceCopy,
  generateTechnicalFileHtml,
  sanitizeSlug,
} from './core/templates.js';
import {
  DISCLAIMER_TEXT,
  LABEL_LANGUAGES,
  WARNING_PHRASES,
  t,
} from './core/translations.js';

const $ = (id) => document.getElementById(id);

const state = {
  lang: 'en',
  license: null,
  entitlements: getEntitlements(null),
  record: getSampleProduct('ceramic_mug'),
  profiles: [],
  activeEditorTab: 'product',
  activeOutTab: 'labels',
  labelLayout: 'a4_2x5',
  selectedLabelLangs: [...FREE_LABEL_LANGUAGES],
  activeMpChannel: 'amazon',
  batchCsv: '',
  batchParsed: [],
  latestTechFile: null,
  latestLabelHtml: '',
  latestMpCopy: { amazon: '', etsy: '', shopify: '' },
  renderSeq: 0,
};

let toastTimer = null;
function showToast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
}

function downloadBlob(data, filename, mimeType) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function printIframe(iframeEl) {
  try {
    if (iframeEl?.contentWindow) {
      iframeEl.contentWindow.focus();
      iframeEl.contentWindow.print();
      return;
    }
  } catch {
    // Fallback below
  }
  const srcdoc = iframeEl?.srcdoc || '';
  if (!srcdoc) return;
  const blob = new Blob([srcdoc], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function getEffectiveLabelLanguages() {
  const allowed = state.entitlements.allowedLabelLanguages;
  const filtered = state.selectedLabelLangs.filter((code) => allowed.includes(code));
  return filtered.length > 0 ? filtered : [allowed[0]];
}

function saveDraftDebounced() {
  storageSet(STORAGE_KEYS.draft, state.record).catch(() => {});
}

/* ---------- Bilingual UI Text Application ---------- */

function applyI18n() {
  const l = state.lang;
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : 'en';

  $('appSubtitle').textContent = t(l, 'appSubtitle');
  $('offlinePill').textContent = t(l, 'offlinePill');
  $('langBtn').textContent = t(l, 'btnLangToggle');
  $('sampleLabel').textContent = t(l, 'sampleLabel');
  $('btnSampleMug').textContent = t(l, 'sampleCeramicMug');
  $('btnSampleWood').textContent = t(l, 'sampleWoodenCraft');
  $('btnSampleLamp').textContent = t(l, 'sampleUsbLamp');

  $('tabBtnProduct').textContent = t(l, 'tabProduct');
  $('tabBtnRisk').textContent = t(l, 'tabRisk');
  $('tabBtnWarnings').textContent = t(l, 'tabWarnings');
  $('tabBtnBatch').textContent = t(l, 'tabBatch');

  $('outTabLabels').textContent = t(l, 'outTabLabels');
  $('outTabTechFile').textContent = t(l, 'outTabTechFile');
  $('outTabMarketplace').textContent = t(l, 'outTabMarketplace');

  $('secProfiles').textContent = t(l, 'secProfiles');
  $('btnSaveProfile').textContent = t(l, 'btnSaveProfile');
  $('btnDeleteProfile').textContent = t(l, 'btnDeleteProfile');
  $('profileProNote').textContent = t(l, 'profileProNote');

  $('secProduct').textContent = t(l, 'secProduct');
  $('lblProductName').textContent = t(l, 'lblProductName');
  $('lblSku').textContent = t(l, 'lblSku');
  $('lblBatchFormat').textContent = t(l, 'lblBatchFormat');
  $('lblEan').textContent = t(l, 'lblEan');
  $('lblCategory').textContent = t(l, 'lblCategory');
  $('btnApplyPreset').textContent = t(l, 'btnApplyPreset');
  $('lblApplyPresetHint').textContent = t(l, 'lblApplyPresetHint');
  $('lblMaterials').textContent = t(l, 'lblMaterials');
  $('lblIntendedUse').textContent = t(l, 'lblIntendedUse');
  $('lblTargetUsers').textContent = t(l, 'lblTargetUsers');

  $('secManufacturer').textContent = t(l, 'secManufacturer');
  $('lblMfrName').textContent = t(l, 'lblMfrName');
  $('lblMfrTrade').textContent = t(l, 'lblMfrTrade');
  $('lblMfrAddress').textContent = t(l, 'lblMfrAddress');
  $('lblMfrContact').textContent = t(l, 'lblMfrContact');

  $('secEuRp').textContent = t(l, 'secEuRp');
  $('lblRpName').textContent = t(l, 'lblRpName');
  $('lblRpAddress').textContent = t(l, 'lblRpAddress');
  $('lblRpContact').textContent = t(l, 'lblRpContact');

  $('riskMatrixTitle').textContent = t(l, 'riskMatrixTitle');
  $('riskMatrixSub').textContent = t(l, 'riskMatrixSub');

  $('warningsTitle').textContent = t(l, 'warningsTitle');
  $('warningsSub').textContent = t(l, 'warningsSub');
  $('lblCustomWarning').textContent = t(l, 'lblCustomWarning');
  $('fCustomWarning').placeholder = t(l, 'customWarningPh');

  $('batchTitle').textContent = t(l, 'batchTitle');
  $('batchSub').textContent = t(l, 'batchSub');
  $('batchProBannerText').textContent = t(l, 'batchProBanner');
  $('btnLoadSampleCsv').textContent = t(l, 'btnLoadSampleCsv');
  $('btnUploadCsv').textContent = t(l, 'btnUploadCsv');
  $('btnExportZip').textContent = t(l, 'btnExportZip');

  $('readinessTitle').textContent = t(l, 'readinessTitle');

  $('btnLayoutA4').textContent = t(l, 'labelLayoutA4');
  $('btnLayoutThermal').textContent = t(l, 'labelLayoutThermal');
  $('freeLabelBannerText').textContent = t(l, 'freeLabelBanner');
  $('thermalOverflowHint').textContent = t(l, 'thermalOverflowHint');
  $('btnPrintLabel').textContent = t(l, 'btnPrintLabel');
  $('btnExportLabelHtml').textContent = t(l, 'btnExportLabelHtml');

  $('techFileFreeBannerText').textContent = t(l, 'techFileBannerFree');
  $('btnPrintTechFile').textContent = t(l, 'btnPrintTechFile');
  $('btnDownloadTechHtml').textContent = t(l, 'btnDownloadTechHtml');
  $('btnDownloadTechJson').textContent = t(l, 'btnDownloadTechJson');

  $('btnMpAmazon').textContent = t(l, 'mpAmazon');
  $('btnMpEtsy').textContent = t(l, 'mpEtsy');
  $('btnMpShopify').textContent = t(l, 'mpShopify');
  $('btnCopyMp').textContent = t(l, 'btnCopy');
  $('mpFreeIncluded').textContent = t(l, 'mpFreeIncluded');

  $('footerDisclaimer').textContent = DISCLAIMER_TEXT[l] || DISCLAIMER_TEXT.en;

  $('modalLicenseTitle').textContent = t(l, 'modalLicenseTitle');
  $('modalLicenseSub').textContent = t(l, 'modalLicenseSub');
  $('lblLicenseKey').textContent = t(l, 'lblLicenseKey');
  $('licenseKeyInput').placeholder = t(l, 'phLicenseKey');
  $('btnActivateLicense').textContent = t(l, 'btnActivate');
  $('btnClearLicense').textContent = t(l, 'btnClearLicense');
  $('btnCloseModal').textContent = t(l, 'btnClose');
  $('linkBuyGumroad').textContent = t(l, 'btnBuyGumroad');
  $('linkBuyGumroad').href = PURCHASE_URLS.gumroad;
  $('linkBuyMbd').textContent = t(l, 'btnBuyMbd');
  $('linkBuyMbd').href = PURCHASE_URLS.mianbaoduo;

  document.querySelectorAll('.js-open-license').forEach((btn) => {
    btn.textContent = t(l, 'btnLicenseFree');
  });

  renderCategorySelect();
  renderTierUi();
  renderProfileSelect();
  renderRiskMatrix();
  renderWarningsChecklist();
  renderLabelLangChips();
  renderBatchPreview();
  refreshComplianceOutputs();
}

function renderTierUi() {
  const isPro = state.entitlements.isPro;
  const l = state.lang;

  const badge = $('tierBadge');
  badge.textContent = isPro ? t(l, 'badgePro') : t(l, 'badgeFree');
  badge.className = `tier-badge ${isPro ? 'tier-pro' : 'tier-free'}`;

  $('licenseBtn').textContent = isPro ? t(l, 'btnLicensePro') : t(l, 'btnLicenseFree');
  $('licenseBtn').className = `btn btn-sm ${isPro ? 'btn-outline' : 'btn-primary'}`;

  $('freeLabelBanner').classList.toggle('hidden', isPro);
  $('techFileFreeBanner').classList.toggle('hidden', isPro);
  $('batchProBanner').classList.toggle('hidden', isPro);
  $('profileProNote').classList.toggle('hidden', isPro);

  const activeBox = $('licenseActiveBox');
  if (isPro && state.license) {
    activeBox.textContent = t(l, 'licenseActiveStatus', {
      mode: state.license.mode || 'offline',
      serial: state.license.serial || 'PRO',
    });
    activeBox.classList.remove('hidden');
    $('btnClearLicense').classList.remove('hidden');
  } else {
    activeBox.classList.add('hidden');
    $('btnClearLicense').classList.add('hidden');
  }
}

/* ---------- Form <-> State Sync ---------- */

function renderCategorySelect() {
  const sel = $('fCategory');
  const current = state.record.product.category;
  sel.innerHTML = CATEGORY_PRESETS.map(
    (c) => `<option value="${c.id}">${escapeHtml(state.lang === 'zh' ? c.labelZh : c.labelEn)}</option>`,
  ).join('');
  sel.value = current;
}

function populateFormFromRecord() {
  const r = state.record;
  $('fProductName').value = r.product.name;
  $('fSku').value = r.product.sku;
  $('fBatchFormat').value = r.product.batchFormat;
  $('fEan').value = r.product.eanGtin;
  $('fCategory').value = r.product.category;
  $('fMaterials').value = r.product.materials;
  $('fIntendedUse').value = r.product.intendedUse;
  $('fTargetUsers').value = r.product.targetUsers;

  $('fMfrName').value = r.manufacturer.name;
  $('fMfrTrade').value = r.manufacturer.tradeName;
  $('fMfrAddress').value = r.manufacturer.postalAddress;
  $('fMfrContact').value = r.manufacturer.electronicAddress;

  $('fRpName').value = r.euResponsiblePerson.name;
  $('fRpAddress').value = r.euResponsiblePerson.euAddress;
  $('fRpContact').value = r.euResponsiblePerson.electronicAddress;

  $('fCustomWarning').value = r.customWarning;
}

function readFormIntoRecord() {
  state.record.product.name = $('fProductName').value.trim();
  state.record.product.sku = $('fSku').value.trim();
  state.record.product.batchFormat = $('fBatchFormat').value.trim();
  state.record.product.eanGtin = $('fEan').value.trim();
  state.record.product.category = $('fCategory').value;
  state.record.product.materials = $('fMaterials').value.trim();
  state.record.product.intendedUse = $('fIntendedUse').value.trim();
  state.record.product.targetUsers = $('fTargetUsers').value.trim();

  state.record.manufacturer.name = $('fMfrName').value.trim();
  state.record.manufacturer.tradeName = $('fMfrTrade').value.trim();
  state.record.manufacturer.postalAddress = $('fMfrAddress').value.trim();
  state.record.manufacturer.electronicAddress = $('fMfrContact').value.trim();

  state.record.euResponsiblePerson.name = $('fRpName').value.trim();
  state.record.euResponsiblePerson.euAddress = $('fRpAddress').value.trim();
  state.record.euResponsiblePerson.electronicAddress = $('fRpContact').value.trim();

  state.record.customWarning = $('fCustomWarning').value.trim();
  saveDraftDebounced();
  refreshComplianceOutputs();
}

/* ---------- Risk Matrix Renderer ---------- */

function getLevelLabel(levelKey) {
  const l = state.lang;
  switch (levelKey) {
    case 'low': return t(l, 'levelLow');
    case 'medium': return t(l, 'levelMedium');
    case 'high': return t(l, 'levelHigh');
    case 'critical': return t(l, 'levelCritical');
    default: return t(l, 'levelNa');
  }
}

function renderRiskMatrix() {
  const l = state.lang;
  const assessed = assessRiskMatrix(state.record.hazards);
  const lOpts = t(l, 'likelihoodOpts');
  const sOpts = t(l, 'severityOpts');

  const container = $('riskMatrixList');
  container.innerHTML = assessed.rows
    .map((row, idx) => {
      const lSelect = [1, 2, 3, 4]
        .map((v) => `<option value="${v}" ${row.likelihood === v ? 'selected' : ''}>${escapeHtml(lOpts[v - 1])}</option>`)
        .join('');
      const sSelect = [1, 2, 3, 4]
        .map((v) => `<option value="${v}" ${row.severity === v ? 'selected' : ''}>${escapeHtml(sOpts[v - 1])}</option>`)
        .join('');

      const name = l === 'zh' ? `${idx + 1}. ${row.nameZh}` : `${idx + 1}. ${row.nameEn}`;
      const badgeText = row.applicable
        ? `${row.score} · ${getLevelLabel(row.levelKey)}`
        : getLevelLabel('na');

      return `
        <div class="hazard-card ${row.applicable ? '' : 'inactive'} ${row.isUnmitigatedHighRisk ? 'unmitigated' : ''}" data-hazard-id="${row.id}">
          <div class="hazard-top">
            <div>
              <label class="hazard-title-wrap">
                <input type="checkbox" class="js-hz-active" ${row.applicable ? 'checked' : ''} />
                <span class="hazard-name">${escapeHtml(name)}</span>
              </label>
              <div class="hazard-std">${escapeHtml(t(l, 'lblStandards'))}: ${escapeHtml(row.standards)}</div>
            </div>
            <div class="hazard-controls">
              <select class="input js-hz-likelihood" aria-label="${escapeHtml(t(l, 'colLikelihood'))}" ${row.applicable ? '' : 'disabled'}>${lSelect}</select>
              <span aria-hidden="true">×</span>
              <select class="input js-hz-severity" aria-label="${escapeHtml(t(l, 'colSeverity'))}" ${row.applicable ? '' : 'disabled'}>${sSelect}</select>
              <span class="risk-badge risk-${row.levelKey}">${escapeHtml(badgeText)}</span>
            </div>
          </div>
          <div class="hazard-mitigation-row">
            <label>${escapeHtml(t(l, 'lblMitigation'))}</label>
            <textarea rows="2" class="input js-hz-mitigation" ${row.applicable ? '' : 'disabled'}>${escapeHtml(row.mitigation)}</textarea>
            ${row.isUnmitigatedHighRisk
              ? `<div class="hazard-alert-text">${l === 'zh' ? '⚠ 高/严重风险必须填写具体缓解措施（至少 10 个字符）' : '⚠ High/Critical hazard requires concrete mitigation steps (at least 10 characters).'}</div>`
              : ''}
          </div>
        </div>`;
    })
    .join('');

  container.querySelectorAll('.hazard-card').forEach((card) => {
    const id = card.dataset.hazardId;
    const ensureHazard = () => {
      let item = state.record.hazards.find((h) => h.id === id);
      if (!item) {
        item = { id, applicable: true, likelihood: 1, severity: 1, mitigation: '', standards: '' };
        state.record.hazards.push(item);
      }
      return item;
    };

    card.querySelector('.js-hz-active').addEventListener('change', (e) => {
      const h = ensureHazard();
      h.applicable = e.target.checked;
      saveDraftDebounced();
      renderRiskMatrix();
      refreshComplianceOutputs();
    });

    card.querySelector('.js-hz-likelihood').addEventListener('change', (e) => {
      const h = ensureHazard();
      h.likelihood = Number(e.target.value);
      saveDraftDebounced();
      renderRiskMatrix();
      refreshComplianceOutputs();
    });

    card.querySelector('.js-hz-severity').addEventListener('change', (e) => {
      const h = ensureHazard();
      h.severity = Number(e.target.value);
      saveDraftDebounced();
      renderRiskMatrix();
      refreshComplianceOutputs();
    });

    card.querySelector('.js-hz-mitigation').addEventListener('input', (e) => {
      const h = ensureHazard();
      h.mitigation = e.target.value;
      saveDraftDebounced();
      // Update readiness and outputs without tearing down textarea focus
      const refreshed = assessRiskMatrix(state.record.hazards).rows.find((r) => r.id === id);
      card.classList.toggle('unmitigated', Boolean(refreshed?.isUnmitigatedHighRisk));
      const alertEl = card.querySelector('.hazard-alert-text');
      if (refreshed?.isUnmitigatedHighRisk && !alertEl) {
        const div = document.createElement('div');
        div.className = 'hazard-alert-text';
        div.textContent = state.lang === 'zh'
          ? '⚠ 高/严重风险必须填写具体缓解措施（至少 10 个字符）'
          : '⚠ High/Critical hazard requires concrete mitigation steps (at least 10 characters).';
        card.querySelector('.hazard-mitigation-row').appendChild(div);
      } else if (!refreshed?.isUnmitigatedHighRisk && alertEl) {
        alertEl.remove();
      }
      refreshComplianceOutputs();
    });
  });
}

/* ---------- 5-Language Warnings Checklist ---------- */

function renderWarningsChecklist() {
  const l = state.lang;
  const activeLangs = getEffectiveLabelLanguages();
  const selectedSet = new Set(state.record.warnings);
  const container = $('warningsChecklist');

  container.innerHTML = WARNING_PHRASES.map((w) => {
    const checked = selectedSet.has(w.id);
    const title = l === 'zh' ? w.titleZh : w.titleEn;
    const previewHtml = checked
      ? `<div class="warn-preview-langs">
          ${activeLangs
            .map(
              (code) => `<div class="warn-preview-row"><span class="lang-pill-mini">${code.toUpperCase()}</span><span>${escapeHtml(w.text[code])}</span></div>`,
            )
            .join('')}
        </div>`
      : '';

    return `
      <div class="warn-item ${checked ? 'selected' : ''}">
        <label class="warn-header">
          <input type="checkbox" class="js-warn-check" value="${w.id}" ${checked ? 'checked' : ''} />
          <span>
            <span class="warn-title">${escapeHtml(title)}</span>
            <span class="warn-id mono">${escapeHtml(w.id)}</span>
          </span>
        </label>
        ${previewHtml}
      </div>`;
  }).join('');

  container.querySelectorAll('.js-warn-check').forEach((chk) => {
    chk.addEventListener('change', (e) => {
      const id = e.target.value;
      const set = new Set(state.record.warnings);
      if (e.target.checked) set.add(id);
      else set.delete(id);
      state.record.warnings = [...set];
      saveDraftDebounced();
      renderWarningsChecklist();
      refreshComplianceOutputs();
    });
  });
}

/* ---------- Label Language Chips ---------- */

function renderLabelLangChips() {
  const allowed = state.entitlements.allowedLabelLanguages;
  const active = new Set(getEffectiveLabelLanguages());
  const container = $('labelLangChips');

  container.innerHTML = LABEL_LANGUAGES.map((langObj) => {
    const isAllowed = allowed.includes(langObj.code);
    const isActive = active.has(langObj.code);
    return `<button type="button" class="lang-chip ${isActive ? 'active' : ''} ${isAllowed ? '' : 'locked'}" data-lang-code="${langObj.code}">
      ${langObj.label}${isAllowed ? '' : ' 🔒'}
    </button>`;
  }).join('');

  container.querySelectorAll('.lang-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const code = btn.dataset.langCode;
      if (!state.entitlements.allowedLabelLanguages.includes(code)) {
        showToast(t(state.lang, 'toastProRequired'));
        openLicenseModal();
        return;
      }
      const set = new Set(getEffectiveLabelLanguages());
      if (set.has(code)) {
        if (set.size === 1) return; // keep at least 1 language active
        set.delete(code);
      } else {
        set.add(code);
      }
      state.selectedLabelLangs = LABEL_LANGUAGES.map((x) => x.code).filter((c) => set.has(c));
      renderLabelLangChips();
      renderWarningsChecklist();
      refreshComplianceOutputs();
    });
  });
}

/* ---------- Readiness Score & Live Output Refresh ---------- */

async function refreshComplianceOutputs() {
  const seq = ++state.renderSeq;
  const l = state.lang;
  const readiness = evaluateReadiness(state.record);
  const labelLangs = getEffectiveLabelLanguages();

  // 1. Update Readiness Score Card & Topbar Pill
  const pctText = `${readiness.percentage}%`;
  $('scoreNumber').textContent = pctText;
  $('headerReadinessText').textContent = `GPSR ${pctText}`;
  $('readinessBar').style.width = pctText;

  const tone = readiness.status === 'ready' ? '' : (readiness.status === 'needs_attention' ? 'warn' : 'bad');
  $('scoreRing').className = `score-ring ${tone}`.trim();
  $('readinessBar').className = `progress-fill ${tone}`.trim();
  $('headerReadinessDot').className = `hr-dot ${tone}`.trim();

  const statusBadge = $('readinessStatusBadge');
  statusBadge.className = `status-pill status-${readiness.status}`;
  statusBadge.textContent = readiness.status === 'ready'
    ? t(l, 'readinessReady')
    : (readiness.status === 'needs_attention' ? t(l, 'readinessAttention') : t(l, 'readinessIncomplete'));

  const listEl = $('readinessChecklist');
  listEl.innerHTML = readiness.checks
    .map((chk) => {
      const label = l === 'zh' ? (chk.passed ? chk.titleZh : chk.issueZh) : (chk.passed ? chk.titleEn : chk.issueEn);
      return `<li class="readiness-item ${chk.passed ? 'pass' : 'fail'}">
        <span class="r-icon ${chk.passed ? 'pass' : 'fail'}">${chk.passed ? '✓' : '!'}</span>
        <span><span class="r-art">${escapeHtml(chk.article)}</span>${escapeHtml(label)}</span>
      </li>`;
    })
    .join('');

  // 2. Render Label Sheet Preview
  const copies = state.labelLayout === 'thermal_50x30' ? 1 : 4; // compact 4-card preview in pane; full 10-card on export
  const previewLabel = generateLabelSheetHtml(state.record, {
    layout: state.labelLayout,
    languages: labelLangs,
    copies,
  });
  const exportLabel = generateLabelSheetHtml(state.record, {
    layout: state.labelLayout,
    languages: labelLangs,
    copies: state.labelLayout === 'thermal_50x30' ? 1 : 10,
  });
  state.latestLabelHtml = exportLabel.html;
  $('labelPreviewFrame').srcdoc = previewLabel.html;
  $('thermalOverflowHint').classList.toggle('hidden', state.labelLayout !== 'thermal_50x30');

  // 3. Render Marketplace Copy (Amazon / Etsy / Shopify)
  state.latestMpCopy = generateMarketplaceCopy(state.record, { languages: labelLangs });
  $('mpCopyOutput').value = state.latestMpCopy[state.activeMpChannel] || state.latestMpCopy.amazon;

  // 4. Generate Article 9 Technical File + SHA-256 asynchronously
  const tech = await generateTechnicalFileHtml(state.record, {
    languages: state.entitlements.isPro ? [...PRO_LABEL_LANGUAGES] : labelLangs,
    readiness,
  });
  if (seq !== state.renderSeq) return; // stale async render

  state.latestTechFile = tech;
  $('readinessShaLine').textContent = `${t(l, 'readinessSha')} ${tech.sha256.slice(0, 16)}…`;
  $('readinessShaLine').title = tech.sha256;
  $('techFilePreviewFrame').srcdoc = tech.html;
}

/* ---------- Saved Manufacturer / EU RP Profiles (Pro) ---------- */

function renderProfileSelect() {
  const sel = $('profileSelect');
  const placeholder = `<option value="">${escapeHtml(t(state.lang, 'profileSelectPlaceholder'))}</option>`;
  const opts = state.profiles
    .map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`)
    .join('');
  sel.innerHTML = placeholder + opts;
}

async function handleSaveProfile() {
  if (!state.entitlements.savedProfiles) {
    showToast(t(state.lang, 'toastProRequired'));
    openLicenseModal();
    return;
  }
  const defaultName = state.record.euResponsiblePerson.name || state.record.manufacturer.name || 'EU Operator Profile';
  const name = window.prompt(t(state.lang, 'promptProfileName'), defaultName);
  if (!name || !name.trim()) return;

  const entry = {
    id: `prof_${Date.now()}`,
    name: name.trim(),
    manufacturer: { ...state.record.manufacturer },
    euResponsiblePerson: { ...state.record.euResponsiblePerson },
  };
  state.profiles.push(entry);
  await storageSet(STORAGE_KEYS.profiles, state.profiles);
  renderProfileSelect();
  $('profileSelect').value = entry.id;
  showToast(t(state.lang, 'toastProfileSaved', { name: entry.name }));
}

async function handleDeleteProfile() {
  if (!state.entitlements.savedProfiles) {
    showToast(t(state.lang, 'toastProRequired'));
    openLicenseModal();
    return;
  }
  const id = $('profileSelect').value;
  if (!id) return;
  state.profiles = state.profiles.filter((p) => p.id !== id);
  await storageSet(STORAGE_KEYS.profiles, state.profiles);
  renderProfileSelect();
  showToast(t(state.lang, 'toastProfileDeleted'));
}

/* ---------- Batch Multi-SKU CSV -> ZIP ---------- */

function renderBatchPreview() {
  const l = state.lang;
  const csv = state.batchCsv.trim();
  if (!csv) {
    state.batchParsed = [];
    $('batchMetaRow').textContent = '';
    $('batchTableWrap').innerHTML = `<p class="field-hint">${escapeHtml(t(l, 'batchEmptyHint'))}</p>`;
    return;
  }

  const parsed = parseBatchCsv(csv, {
    manufacturer: state.record.manufacturer,
    euResponsiblePerson: state.record.euResponsiblePerson,
  });
  state.batchParsed = parsed.records;
  $('batchMetaRow').textContent = t(l, 'batchParsedCount', { count: parsed.records.length });

  if (parsed.records.length === 0) {
    $('batchTableWrap').innerHTML = `<p class="field-hint">${escapeHtml(parsed.errors.join(' '))}</p>`;
    return;
  }

  const rowsHtml = parsed.records
    .map((rec) => {
      const r = evaluateReadiness(rec);
      const cat = CATEGORY_BY_ID[rec.product.category];
      const catLabel = l === 'zh' ? (cat?.labelZh || rec.product.category) : (cat?.labelEn || rec.product.category);
      return `
        <tr>
          <td class="mono"><strong>${escapeHtml(rec.product.sku)}</strong></td>
          <td>${escapeHtml(rec.product.name)}</td>
          <td>${escapeHtml(catLabel)}</td>
          <td><span class="status-pill status-${r.status}">${r.percentage}%</span></td>
          <td>${r.missingItems.length === 0 ? '✓ 0' : `${r.missingItems.length} item(s)`}</td>
        </tr>`;
    })
    .join('');

  $('batchTableWrap').innerHTML = `
    <table class="batch-table">
      <thead>
        <tr>
          <th>${escapeHtml(t(l, 'batchColSku'))}</th>
          <th>${escapeHtml(t(l, 'batchColName'))}</th>
          <th>${escapeHtml(t(l, 'batchColCat'))}</th>
          <th>${escapeHtml(t(l, 'batchColReadiness'))}</th>
          <th>${escapeHtml(t(l, 'batchColAlerts'))}</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;
}

async function handleExportBatchZip() {
  if (!state.entitlements.batchCsvZip) {
    showToast(t(state.lang, 'toastProRequired'));
    openLicenseModal();
    return;
  }
  if (state.batchParsed.length === 0) {
    showToast(t(state.lang, 'batchEmptyHint'));
    return;
  }
  const bundle = await generateBatchZipBundle(state.batchParsed, {
    languages: [...PRO_LABEL_LANGUAGES],
  });
  const dateTag = new Date().toISOString().slice(0, 10);
  const filename = `gpsrkit-batch-${bundle.skuCount}skus-${dateTag}.zip`;
  downloadBlob(bundle.zipBytes, filename, 'application/zip');
  showToast(t(state.lang, 'toastZipDone', { skus: bundle.skuCount, files: bundle.fileCount }));
}

/* ---------- License Modal ---------- */

function openLicenseModal() {
  $('licenseFeedback').classList.add('hidden');
  $('licenseModal').classList.remove('hidden');
  $('licenseKeyInput').focus();
}

function closeLicenseModal() {
  $('licenseModal').classList.add('hidden');
}

async function handleActivateLicense() {
  const key = $('licenseKeyInput').value.trim();
  const feedback = $('licenseFeedback');
  const res = await verifyLicenseKey(key);
  if (res.valid) {
    state.license = await saveStoredLicense(res);
    state.entitlements = getEntitlements(state.license);
    state.selectedLabelLangs = [...PRO_LABEL_LANGUAGES];
    feedback.textContent = t(state.lang, 'licenseSuccess');
    feedback.className = 'license-feedback ok';
    feedback.classList.remove('hidden');
    $('licenseKeyInput').value = '';
    renderTierUi();
    renderLabelLangChips();
    renderWarningsChecklist();
    refreshComplianceOutputs();
    showToast(t(state.lang, 'licenseSuccess'));
  } else {
    feedback.textContent = `${t(state.lang, 'licenseInvalidPrefix')}${res.reason || res.reasonCode}`;
    feedback.className = 'license-feedback err';
    feedback.classList.remove('hidden');
  }
}

async function handleClearLicense() {
  await clearStoredLicense();
  state.license = null;
  state.entitlements = getEntitlements(null);
  state.selectedLabelLangs = [...FREE_LABEL_LANGUAGES];
  $('licenseFeedback').classList.add('hidden');
  renderTierUi();
  renderLabelLangChips();
  renderWarningsChecklist();
  refreshComplianceOutputs();
}

/* ---------- Event Wiring & Boot ---------- */

function bindEvents() {
  // Language toggle
  $('langBtn').addEventListener('click', () => {
    state.lang = state.lang === 'zh' ? 'en' : 'zh';
    saveStoredLang(state.lang).catch(() => {});
    applyI18n();
  });

  // License modal controls
  $('licenseBtn').addEventListener('click', openLicenseModal);
  document.querySelectorAll('.js-open-license').forEach((b) => b.addEventListener('click', openLicenseModal));
  $('btnCloseModal').addEventListener('click', closeLicenseModal);
  $('btnCloseModalX').addEventListener('click', closeLicenseModal);
  $('licenseModal').addEventListener('click', (e) => {
    if (e.target === $('licenseModal')) closeLicenseModal();
  });
  $('btnActivateLicense').addEventListener('click', handleActivateLicense);
  $('btnClearLicense').addEventListener('click', handleClearLicense);

  // 1-Click Sample Products
  document.querySelectorAll('[data-sample]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.sample;
      state.record = getSampleProduct(id);
      populateFormFromRecord();
      renderRiskMatrix();
      renderWarningsChecklist();
      saveDraftDebounced();
      refreshComplianceOutputs();
      const meta = SAMPLE_PRODUCTS[id];
      const name = state.lang === 'zh' ? meta.labelZh : meta.labelEn;
      showToast(t(state.lang, 'toastSampleLoaded', { name }));
    });
  });

  // Editor Tabs
  document.querySelectorAll('[data-editor-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.editorTab;
      state.activeEditorTab = tab;
      document.querySelectorAll('[data-editor-tab]').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${tab}`));
    });
  });

  // Output Tabs
  document.querySelectorAll('[data-out-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.outTab;
      state.activeOutTab = tab;
      document.querySelectorAll('[data-out-tab]').forEach((b) => b.classList.toggle('active', b === btn));
      document.querySelectorAll('.out-panel').forEach((p) => p.classList.toggle('active', p.id === `out-${tab}`));
    });
  });

  // Form inputs -> live state sync
  [
    'fProductName', 'fSku', 'fBatchFormat', 'fEan', 'fCategory',
    'fMaterials', 'fIntendedUse', 'fTargetUsers',
    'fMfrName', 'fMfrTrade', 'fMfrAddress', 'fMfrContact',
    'fRpName', 'fRpAddress', 'fRpContact', 'fCustomWarning',
  ].forEach((id) => {
    $(id).addEventListener('input', readFormIntoRecord);
    $(id).addEventListener('change', readFormIntoRecord);
  });

  // Apply category risk baseline & warnings
  $('btnApplyPreset').addEventListener('click', () => {
    const catId = $('fCategory').value;
    const preset = CATEGORY_BY_ID[catId];
    if (!preset) return;
    state.record.product.category = catId;
    state.record.hazards = createDefaultHazardsForCategory(catId);
    state.record.warnings = [...preset.defaultWarnings];
    renderRiskMatrix();
    renderWarningsChecklist();
    saveDraftDebounced();
    refreshComplianceOutputs();
    showToast(t(state.lang, 'toastPresetApplied', {
      cat: state.lang === 'zh' ? preset.labelZh : preset.labelEn,
    }));
  });

  // Operator Profiles (Pro)
  $('btnSaveProfile').addEventListener('click', handleSaveProfile);
  $('btnDeleteProfile').addEventListener('click', handleDeleteProfile);
  $('profileSelect').addEventListener('change', (e) => {
    const prof = state.profiles.find((p) => p.id === e.target.value);
    if (!prof) return;
    state.record.manufacturer = { ...prof.manufacturer };
    state.record.euResponsiblePerson = { ...prof.euResponsiblePerson };
    populateFormFromRecord();
    saveDraftDebounced();
    refreshComplianceOutputs();
    showToast(t(state.lang, 'toastProfileLoaded', { name: prof.name }));
  });

  // Label Sheet layout & exports
  document.querySelectorAll('[data-layout]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.labelLayout = btn.dataset.layout;
      document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('active', b === btn));
      refreshComplianceOutputs();
    });
  });

  $('btnPrintLabel').addEventListener('click', () => {
    if (!state.entitlements.printLabelSheets) {
      showToast(t(state.lang, 'toastProRequired'));
      openLicenseModal();
      return;
    }
    printIframe($('labelPreviewFrame'));
  });

  $('btnExportLabelHtml').addEventListener('click', () => {
    if (!state.entitlements.printLabelSheets) {
      showToast(t(state.lang, 'toastProRequired'));
      openLicenseModal();
      return;
    }
    const slug = sanitizeSlug(state.record.product.sku, 'product');
    const filename = `gpsr-labels-${state.labelLayout}-${slug}.html`;
    downloadBlob(state.latestLabelHtml, filename, 'text/html;charset=utf-8');
    showToast(t(state.lang, 'toastExportDone', { file: filename }));
  });

  // Technical File exports (Pro)
  $('btnPrintTechFile').addEventListener('click', () => {
    if (!state.entitlements.technicalFileExport) {
      showToast(t(state.lang, 'toastProRequired'));
      openLicenseModal();
      return;
    }
    printIframe($('techFilePreviewFrame'));
  });

  $('btnDownloadTechHtml').addEventListener('click', () => {
    if (!state.entitlements.technicalFileExport) {
      showToast(t(state.lang, 'toastProRequired'));
      openLicenseModal();
      return;
    }
    if (!state.latestTechFile) return;
    const filename = `${state.latestTechFile.documentId}-technical-file.html`;
    downloadBlob(state.latestTechFile.html, filename, 'text/html;charset=utf-8');
    showToast(t(state.lang, 'toastExportDone', { file: filename }));
  });

  $('btnDownloadTechJson').addEventListener('click', () => {
    if (!state.entitlements.technicalFileExport) {
      showToast(t(state.lang, 'toastProRequired'));
      openLicenseModal();
      return;
    }
    if (!state.latestTechFile) return;
    const filename = `${state.latestTechFile.documentId}-technical-file.json`;
    downloadBlob(state.latestTechFile.json, filename, 'application/json;charset=utf-8');
    showToast(t(state.lang, 'toastExportDone', { file: filename }));
  });

  // Marketplace Copy
  document.querySelectorAll('[data-mp]').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.activeMpChannel = btn.dataset.mp;
      document.querySelectorAll('[data-mp]').forEach((b) => b.classList.toggle('active', b === btn));
      $('mpCopyOutput').value = state.latestMpCopy[state.activeMpChannel] || '';
    });
  });

  $('btnCopyMp').addEventListener('click', async () => {
    const text = $('mpCopyOutput').value;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      $('mpCopyOutput').select();
      document.execCommand('copy');
    }
    const btn = $('btnCopyMp');
    const prev = btn.textContent;
    btn.textContent = t(state.lang, 'btnCopied');
    setTimeout(() => { btn.textContent = prev; }, 1600);
  });

  // Batch CSV -> ZIP
  $('btnLoadSampleCsv').addEventListener('click', () => {
    state.batchCsv = SAMPLE_BATCH_CSV;
    $('batchCsvInput').value = SAMPLE_BATCH_CSV;
    renderBatchPreview();
  });

  $('batchCsvInput').addEventListener('input', (e) => {
    state.batchCsv = e.target.value;
    renderBatchPreview();
  });

  $('btnUploadCsv').addEventListener('click', () => $('csvFileInput').click());
  $('csvFileInput').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.batchCsv = String(reader.result || '');
      $('batchCsvInput').value = state.batchCsv;
      renderBatchPreview();
    };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  });

  $('btnExportZip').addEventListener('click', handleExportBatchZip);
}

async function init() {
  const storedLang = await loadStoredLang();
  if (storedLang) {
    state.lang = storedLang;
  } else if (typeof navigator !== 'undefined' && /^zh/i.test(navigator.language || '')) {
    state.lang = 'zh';
  }

  state.license = await loadStoredLicense();
  state.entitlements = getEntitlements(state.license);
  state.selectedLabelLangs = [...state.entitlements.allowedLabelLanguages];

  const savedProfiles = await storageGet(STORAGE_KEYS.profiles);
  if (Array.isArray(savedProfiles)) {
    state.profiles = savedProfiles;
  }

  const savedDraft = await storageGet(STORAGE_KEYS.draft);
  if (savedDraft && savedDraft.product?.name) {
    state.record = normalizeProductRecord(savedDraft);
  } else {
    state.record = getSampleProduct('ceramic_mug');
  }

  bindEvents();
  populateFormFromRecord();
  applyI18n();
}

init();
