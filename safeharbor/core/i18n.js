/**
 * SafeHarbor Studio Pro — Bilingual EN / ZH Dictionary
 */

export const I18N = Object.freeze({
  en: {
    pageTitle: 'SafeHarbor Studio Pro — Offline HIPAA 18-Identifier De-Identification & IRB Audit',
    tagline: 'HIPAA Safe Harbor (45 CFR § 164.514(b)(2)) CSV/TSV De-Identification & SHA-256 IRB Audit',
    offlinePill: '100% Offline · Zero Upload',
    tierFree: 'FREE',
    tierPro: 'PRO',
    activateProBtn: 'Activate Pro',
    proUnlockedBtn: 'Pro Active',
    langToggle: '中文',

    // Step 1: Input & Policy
    inputTitle: '1. Clinical Dataset Input (CSV / TSV)',
    loadBenchmarkBtn: 'Load Clinical Benchmark',
    uploadBtn: 'Upload CSV/TSV',
    clearBtn: 'Clear',
    dropHint: 'Drop CSV or TSV file here — processed 100% locally in your browser',
    inputPlaceholder: 'Paste clinical CSV/TSV here, drag & drop a file, or click "Load Clinical Benchmark" to inspect all 18 HIPAA Safe Harbor rules...',
    privacyNote: '100% client-side execution: your patient data never leaves this browser tab. Works cleanly with Wi-Fi turned off.',
    metaEmpty: 'No dataset loaded',

    // Policy Controls
    policyTitle: 'De-Identification Policy',
    dateModeLabel: 'Date Handling Mode',
    dateModeYearOnly: 'Year Only (Free & Pro)',
    dateModeConsistentShift: 'Consistent Longitudinal Shift (Pro)',
    shiftRangeLabel: 'Shift Range (± Days)',
    studySaltLabel: 'Study Salt (Deterministic Seed)',
    refYearLabel: 'Reference Year (>89 Birth Check)',
    protocolIdLabel: 'IRB Protocol ID (Optional)',
    investigatorLabel: 'PI / Custodian Name (Optional)',

    // Free Tier Notice
    freeRowBannerTitle: 'Free Tier Export Limit (25 Rows)',
    freeRowBannerBody: 'All {total} rows are scanned and previewed locally. Free CSV export is capped at 25 rows; unlock Pro ($29) for unlimited rows, consistent date shifting, separate PI Re-ID map, SHA-256 IRB Audit Certificate, ZIP bundle, and Python CLI.',
    freeShiftNoticeTitle: 'Consistent Longitudinal Date Shift is a Pro Feature',
    freeShiftNoticeBody: 'Currently running in Year-Only mode on Free tier. Unlock Pro to preserve exact inter-visit and survival intervals via deterministic per-subject date shifts.',
    unlockNowBtn: 'Unlock Pro ($29)',

    // Step 2: Column Classifier & Overrides
    columnsTitle: '2. 18-Identifier Column Scan & Rule Overrides',
    resetOverridesBtn: 'Reset Auto Rules',
    colHeaderName: 'Column',
    colHeaderDetected: 'Detected HIPAA Identifier',
    colHeaderRule: 'Applied Rule (Override)',
    colHeaderAffected: 'Affected',
    sourceHeader: 'Header',
    sourceContent: 'Content',
    sourceSafe: 'Safe',
    overriddenBadge: 'Override',

    // Action dropdown options
    actDrop: 'Drop',
    actZip3: 'ZIP 3-Digit + 17-Prefix Check',
    actDateYear: 'Date -> Year Only',
    actDateShift: 'Date -> Consistent Shift (Pro)',
    actAgeCap: 'Age Cap 90+',
    actPseudo: 'Pseudonymize MRN',
    actScrub: 'Scrub Free Text',
    actKeep: 'Keep',

    // Step 3: Tabs & Preview
    tabDiff: 'Before / After Diff Preview',
    tabClean: 'Clean Output Table',
    tabAudit: 'Compliance Audit Summary',
    tabReid: 'PI-Only Re-ID Map (Pro)',
    diffLegendDropped: 'Dropped Column',
    diffLegendModified: 'Transformed / Scrubbed',
    diffLegendZeroed: 'Restricted ZIP -> 000',
    diffLegendCapped: 'Age/DOB >89 -> 90+',
    diffShowing: 'Showing {shown} of {total} rows',
    emptyPreview: 'Load the built-in 12-patient clinical benchmark or upload a CSV/TSV to preview HIPAA Safe Harbor de-identification.',

    // Audit Summary Tab
    auditKpiPhiCols: 'PHI Columns Detected',
    auditKpiDropped: 'Columns Dropped',
    auditKpiCells: 'Cells Modified',
    auditKpiZipZeroed: 'Restricted ZIPs → 000',
    auditKpiAgeCapped: 'Ages / DOBs >89 → 90+',
    auditKpiSubjects: 'Pseudonymized Subjects',
    auditHashesTitle: 'Live WebCrypto SHA-256 Fingerprints',
    auditInputHash: 'Input CSV/TSV SHA-256',
    auditOutputHash: 'De-Identified Output SHA-256',
    auditReidHash: 'PI-Only Re-ID Map SHA-256',
    auditZipTitle: 'HHS/OCR 17 Restricted 3-Digit ZIP Prefixes (45 CFR § 164.514(b)(2)(i)(B))',
    auditDateTitle: 'Date Handling & Longitudinal Preservation',
    auditLedgerTitle: '18 HIPAA Safe Harbor Identifier Redaction Counts',
    auditAttestTitle: 'Investigator "No Actual Knowledge" Checklist (45 CFR § 164.514(b)(2)(ii))',
    auditWarningsTitle: 'Compliance Warnings',

    // Re-ID Tab
    reidWarningBanner: 'STRICTLY PI-ONLY — DO NOT SHARE WITH EXTERNAL COLLABORATORS. Store this crosswalk separately behind your institutional IRB firewall per 45 CFR § 164.514(c).',
    reidLockedTitle: 'Separate PI-Only Re-Identification Key Map (Pro)',
    reidLockedBody: 'Pro builds and exports a non-derived MRN <-> SUBJ_xxxx crosswalk (with per-subject shift offsets) kept strictly separate from the shareable de-identified dataset.',
    reidEmpty: 'No column is currently configured with "Pseudonymize MRN".',

    // Export Bar
    exportTitle: 'Export & IRB Deliverables',
    exportCsvBtn: 'Download De-Identified CSV',
    exportCsvFreeHint: '(Up to 25 rows)',
    exportCertHtmlBtn: 'IRB Audit Certificate (HTML / PDF)',
    exportCertJsonBtn: 'Audit Log (JSON)',
    exportReidBtn: 'Download PI-Only Re-ID Map',
    exportZipBtn: 'Download Shareable ZIP Bundle',
    exportCliBtn: 'Python CLI Usage',

    // CLI Modal
    cliModalTitle: 'Zero-Dependency Python CLI (cli/safeharbor.py)',
    cliModalDesc: 'Runs offline with Python 3 standard library only (zero pandas, zero PyTorch, zero external packages). Mirrors all 18 HIPAA rules, the exact 17 HHS restricted ZIP prefixes, 90+ age cap, consistent date shifting, MRN pseudonymization, and SHA-256 JSON audit reports.',
    copyCmdBtn: 'Copy Command',
    copiedToast: 'Copied to clipboard',

    // License Modal
    licenseModalTitle: 'Unlock SafeHarbor Studio Pro',
    licenseSubtitle: 'One-time $29 license · 100% offline ECDSA P-256 verification · Zero telemetry',
    freeTierCol: 'Free Tier',
    proTierCol: 'Pro License ($29)',
    freeFeatures: [
      'Full 18 HIPAA Safe Harbor column & content scan',
      'Live side-by-side Before / After diff preview',
      '17 HHS restricted 3-digit ZIP prefix check & 90+ age cap',
      'Free-text clinical notes inline PHI scrubber',
      'CSV/TSV export up to 25 rows (Year-Only dates)',
    ],
    proFeatures: [
      'Unlimited rows & cohort size (100% local speed)',
      'Consistent per-subject longitudinal Date Shifting',
      'Separate PI-only reid_key_map_DO_NOT_SHARE.csv',
      'Printable WebCrypto SHA-256 IRB Audit Certificate (HTML + JSON)',
      'One-click Shareable ZIP Bundle + Zero-Dep Python CLI',
    ],
    buyGumroadBtn: 'Buy on Gumroad ($29)',
    buyMbdBtn: 'Buy on Mianbaoduo (CN)',
    licenseInputLabel: 'Enter License Key (SAFE1... offline key or Gumroad key)',
    licenseInputPlaceholder: 'SAFE1.U0FGRTEu... or Gumroad license key',
    activateBtn: 'Activate License',
    deactivateBtn: 'Remove License',
    closeBtn: 'Close',
    statusLicenseActive: 'Pro license active ({mode} · serial {serial})',
    statusLicenseInvalid: 'Invalid license key: {reason}',
    statusLicenseRemoved: 'License removed; reverted to Free tier.',
    proRequiredToast: 'This export requires SafeHarbor Studio Pro ($29).',

    footerDisclaimer: 'Workflow Utility Notice: SafeHarbor Studio Pro executes HIPAA Safe Harbor (45 CFR § 164.514(b)(2)) technical transformations 100% locally in your browser. It is not formal legal counsel or an Institutional Privacy Officer determination; verify free-text fields and IRB requirements before releasing clinical data.',
  },

  zh: {
    pageTitle: 'SafeHarbor Studio Pro — 离线 HIPAA 18项临床数据脱敏与 IRB 审计证书',
    tagline: 'HIPAA 安全港 (45 CFR § 164.514(b)(2)) 临床研究 CSV/TSV 离线脱敏与 SHA-256 IRB 审计',
    offlinePill: '100% 本地离线 · 零上传',
    tierFree: '免费版',
    tierPro: '专业版',
    activateProBtn: '激活 Pro',
    proUnlockedBtn: 'Pro 已激活',
    langToggle: 'EN',

    // Step 1
    inputTitle: '1. 临床队列数据输入 (CSV / TSV)',
    loadBenchmarkBtn: '加载临床基准样本',
    uploadBtn: '上传 CSV/TSV',
    clearBtn: '清空',
    dropHint: '拖放 CSV 或 TSV 文件到此处 — 100% 在本机浏览器内存完成处理',
    inputPlaceholder: '粘贴临床 CSV/TSV 数据、拖放本地文件，或点击“加载临床基准样本”一键体验全部 18 项 HIPAA 安全港规则...',
    privacyNote: '100% 本地离线运行：患者数据绝不离开当前浏览器标签页，断网状态下亦可完整使用。',
    metaEmpty: '尚未加载数据集',

    // Policy Controls
    policyTitle: '全局脱敏策略',
    dateModeLabel: '日期脱敏模式',
    dateModeYearOnly: '仅保留年份 (Free & Pro)',
    dateModeConsistentShift: '受试者一致性纵向偏移 (Pro)',
    shiftRangeLabel: '偏移范围 (± 天)',
    studySaltLabel: '研究盐值 (确定性种子)',
    refYearLabel: '参考年份 (>89 出生年校验)',
    protocolIdLabel: 'IRB 伦理编号 (可选)',
    investigatorLabel: 'PI / 数据负责人姓名 (可选)',

    // Free Tier Notice
    freeRowBannerTitle: '免费版导出行数上限（25 行）',
    freeRowBannerBody: '全部 {total} 行均已在本地完成扫描与对比预览。免费版 CSV 导出限制前 25 行；解锁 Pro ($29) 可享无限行数、一致性纵向日期偏移、独立 PI 重识别映射表、SHA-256 IRB 审计证书、ZIP 打包导出与 Python CLI。',
    freeShiftNoticeTitle: '一致性纵向日期偏移属于 Pro 专业版功能',
    freeShiftNoticeBody: '免费版当前自动回退为“仅保留年份”模式。激活 Pro 后可按受试者 ID 实施确定性日期偏移，精确保留多次随访与生存时间间隔。',
    unlockNowBtn: '解锁 Pro ($29)',

    // Step 2
    columnsTitle: '2. 18 项标识符自动分类与逐列规则覆盖',
    resetOverridesBtn: '恢复自动识别',
    colHeaderName: '字段名',
    colHeaderDetected: '识别到的 HIPAA 标识符',
    colHeaderRule: '执行规则（可手动覆盖）',
    colHeaderAffected: '受影响',
    sourceHeader: '表头',
    sourceContent: '内容',
    sourceSafe: '安全',
    overriddenBadge: '已覆盖',

    // Action dropdown options
    actDrop: '删除整列 (Drop)',
    actZip3: '邮编前3位 + 17受限前缀归零',
    actDateYear: '日期 -> 仅保留年份',
    actDateShift: '日期 -> 一致性纵向偏移 (Pro)',
    actAgeCap: '年龄封顶 (>89 -> 90+)',
    actPseudo: '假名化 MRN',
    actScrub: '自由文本内联 PHI 脱敏',
    actKeep: '保留 (Keep)',

    // Step 3
    tabDiff: '脱敏前后对比预览',
    tabClean: '洁净输出预览',
    tabAudit: '合规审计摘要',
    tabReid: 'PI 专用重识别映射表 (Pro)',
    diffLegendDropped: '已删除高危列',
    diffLegendModified: '已脱敏 / 转换',
    diffLegendZeroed: '受限邮编 -> 000',
    diffLegendCapped: '年龄/出生年 >89 -> 90+',
    diffShowing: '当前显示 {shown} / {total} 行',
    emptyPreview: '请点击“加载临床基准样本”或上传 CSV/TSV 文件，立即查看 18 项 HIPAA 安全港脱敏对比。',

    // Audit Summary Tab
    auditKpiPhiCols: '检出 PHI 列',
    auditKpiDropped: '已删除高危列',
    auditKpiCells: '已处理单元格',
    auditKpiZipZeroed: '受限邮编归零 → 000',
    auditKpiAgeCapped: '>89 岁归并 → 90+',
    auditKpiSubjects: '假名化受试者数',
    auditHashesTitle: '实时 WebCrypto SHA-256 文件完整性指纹',
    auditInputHash: '原始输入 CSV/TSV SHA-256',
    auditOutputHash: '脱敏输出数据集 SHA-256',
    auditReidHash: 'PI 专用重识别映射表 SHA-256',
    auditZipTitle: 'HHS/OCR 17 个受限 3 位邮编前缀核验 (45 CFR § 164.514(b)(2)(i)(B))',
    auditDateTitle: '日期偏移与纵向时间间隔保留状态',
    auditLedgerTitle: '18 类 HIPAA 安全港标识符脱敏计数台账',
    auditAttestTitle: '研究者“无实际知情”合规核对清单 (45 CFR § 164.514(b)(2)(ii))',
    auditWarningsTitle: '合规复核警告',

    // Re-ID Tab
    reidWarningBanner: '仅限 PI 内部保管 — 严禁与外部合作者共享。请依据 45 CFR § 164.514(c) 将此对照表独立存放于机构 IRB 防火墙之后。',
    reidLockedTitle: 'PI 专用重识别映射表 (Pro)',
    reidLockedBody: 'Pro 版自动生成符合 § 164.514(c) 非派生编码要求的 MRN <-> SUBJ_xxxx 映射表（含受试者日期偏移量），并与可共享脱敏数据集严格隔离导出。',
    reidEmpty: '当前未有字段设置为“假名化 MRN”。',

    // Export Bar
    exportTitle: '导出与 IRB 审计交付件',
    exportCsvBtn: '下载脱敏 CSV/TSV',
    exportCsvFreeHint: '（免费版限 25 行）',
    exportCertHtmlBtn: 'IRB 审计证书 (HTML / 打印 PDF)',
    exportCertJsonBtn: '审计日志 (JSON)',
    exportReidBtn: '下载 PI 专用重识别表',
    exportZipBtn: '下载可共享 ZIP 完整包',
    exportCliBtn: 'Python CLI 命令',

    // CLI Modal
    cliModalTitle: '零依赖 Python CLI (cli/safeharbor.py)',
    cliModalDesc: '仅依赖 Python 3 标准库（零 pandas、零 PyTorch、零第三方包）。完整复现全部 18 项 HIPAA 规则、17 个 HHS 受限邮编前缀、>89 岁封顶、一致性日期偏移、MRN 假名化及 SHA-256 JSON 审计报告。',
    copyCmdBtn: '复制命令',
    copiedToast: '已复制到剪贴板',

    // License Modal
    licenseModalTitle: '解锁 SafeHarbor Studio Pro',
    licenseSubtitle: '一次性买断 $29 · 100% 离线 ECDSA P-256 验签 · 零遥测',
    freeTierCol: '免费版 (Free)',
    proTierCol: '专业版 Pro ($29)',
    freeFeatures: [
      '全部 18 项 HIPAA 安全港表头与内容自动扫描',
      '实时脱敏前后对比预览 (Diff Preview)',
      '精准核验 HHS 17 个受限 3 位邮编前缀与 >89 岁封顶',
      '自由文本临床记录内联 PHI 自动脱敏',
      '导出脱敏 CSV/TSV（限前 25 行，日期仅保留年份）',
    ],
    proFeatures: [
      '不限行数与队列规模（100% 本机高速处理）',
      '受试者一致性纵向日期偏移（精确保留随访/生存间隔）',
      '独立导出 PI 专用 reid_key_map_DO_NOT_SHARE.csv',
      '可打印 WebCrypto SHA-256 IRB 审计证书 (HTML + JSON)',
      '一键打包可共享 ZIP + 零依赖 Python CLI',
    ],
    buyGumroadBtn: '前往 Gumroad 购买 ($29)',
    buyMbdBtn: '前往面包多购买 (国内)',
    licenseInputLabel: '输入激活码（SAFE1... 离线签发码或 Gumroad 激活码）',
    licenseInputPlaceholder: 'SAFE1.U0FGRTEu... 或 Gumroad 授权码',
    activateBtn: '立即激活',
    deactivateBtn: '移除授权',
    closeBtn: '关闭',
    statusLicenseActive: 'Pro 授权已激活（{mode} · 编号 {serial}）',
    statusLicenseInvalid: '授权码无效：{reason}',
    statusLicenseRemoved: '已移除授权，恢复为免费版。',
    proRequiredToast: '此导出功能需要激活 SafeHarbor Studio Pro ($29)。',

    footerDisclaimer: '合规提示：SafeHarbor Studio Pro 为 100% 本地离线运行的 HIPAA 安全港（45 CFR § 164.514(b)(2)）技术脱敏辅助工具，不构成正式法律意见或机构隐私官认定；对外共享临床数据前请人工复核自由文本与所属机构 IRB 要求。',
  },
});

export function getDict(lang) {
  return lang === 'zh' ? I18N.zh : I18N.en;
}

export function fmt(template, vars = {}) {
  return String(template ?? '').replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}
