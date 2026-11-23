/**
 * PromptShield Pro — Bilingual Chinese (zh) & English (en) UI localization.
 */

const STORAGE_KEY = 'promptshield_lang_v1';

export const DICTIONARY = Object.freeze({
  zh: {
    appTagline: '100% 本地零联网 AI 隐私脱敏与一键还原',
    zeroNetBadge: '100% 本地 · 零联网',
    tierFree: '免费版',
    tierPro: 'PRO 已激活',
    langSwitch: 'EN',

    // Tabs
    tabPrompt: '脱敏与还原',
    tabBatch: '批量文件脱敏',
    tabRules: '规则与激活',
    proChip: 'PRO',

    // Chat Bridge Bar
    chatBridgeTitle: 'AI 聊天页直连',
    chatSiteNone: '未检测到 ChatGPT / Claude / Gemini 活动标签页',
    chatSiteReady: '已连接：{site}（仅在您点击按钮时读取/写入）',
    chatStandaloneNote: '独立离线网页模式 — 安装为 Chrome 扩展即可在 ChatGPT / Claude / Gemini 侧边栏一键直连',
    btnPullDraft: '读取输入框并脱敏',
    btnPushSafe: '写回安全 Prompt',
    btnPullReply: '读取 AI 回复并还原',
    chatNeedPro: 'AI 网页一键直连为 Pro 功能，请前往“规则与激活”解锁，或手动复制粘贴（免费无限制）。',

    // Tab 1: Prompt Sanitize & Restore
    step1Title: '1. 原始 Prompt（粘贴代码、日志、合同、.env 或客户信息）',
    btnLoadDemo: '加载演示样本',
    btnClearAll: '清空',
    btnResetVault: '重置映射表',
    btnExportVault: '导出映射表 JSON',
    btnImportVault: '导入映射表',
    inputPlaceholder: '在此粘贴包含 API Key、数据库连接串、JWT、邮箱、手机号、身份证、银行卡或客户名称的内容……所有处理均在本地内存完成，绝不联网。',
    btnSanitize: '一键本地脱敏',
    autoSanitizeLabel: '输入时实时脱敏',

    // Category toggles
    catSecrets: '密钥与连接串',
    catApiKeys: '云/AI API Key',
    catPii: '个人/金融 PII',
    catNetwork: 'IP 与网络',
    catCustom: '自定义词/正则',

    // Step 2: Safe Prompt Output
    step2Title: '2. 安全 Prompt（可放心发给 ChatGPT / Claude / Gemini）',
    btnCopySafe: '复制安全 Prompt',
    copiedToast: '已复制到剪贴板',
    hitsSummary: '共拦截 {total} 处敏感信息（{unique} 个唯一占位符）',
    noHitsSummary: '未检测到敏感信息，当前文本安全可发送。',
    viewDiff: '高亮视图',
    viewPlain: '纯文本',
    vaultTitle: '本地可逆映射表（Session Vault）',
    vaultEmpty: '尚无映射记录。脱敏后相同敏感词会自动复用同一个占位符（如 [EMAIL_1]），保持 AI 上下文推理完整。',
    vaultReveal: '显示原文',
    vaultHide: '隐藏原文',
    vaultColToken: '占位符',
    vaultColCategory: '类别',
    vaultColValue: '本地原值',
    vaultColHits: '次数',

    // Step 3: Restore AI Reply
    step3Title: '3. 粘贴 AI 回复 → 本地一键无损还原',
    btnLoadDemoReply: '填入演示 AI 回复',
    aiReplyPlaceholder: '把 ChatGPT / Claude / Gemini 返回的包含 [OPENAI_KEY_1]、[EMAIL_1] 等占位符的回复粘贴到这里……',
    btnRestore: '一键无损还原',
    btnCopyRestored: '复制还原结果',
    restoredSummary: '已本地还原 {count} 处占位符',
    unresolvedWarn: '注意：检测到 {count} 个未在当前映射表中的占位符：{tokens}',
    restoredEmpty: '还原结果将显示在这里。',

    // Tab 2: Batch File / CSV Scrubber
    batchTitle: '批量 CSV / JSON / 日志 / 代码本地脱敏（Pro）',
    batchSubtitle: '多文件共享同一可逆映射表：跨文件的同一邮箱或密钥会映射为同一个占位符，并打包为标准 UTF-8 ZIP。',
    batchDropTitle: '拖放多个文件到此，或点击选择文件',
    batchDropHint: '支持 .csv, .tsv, .json, .jsonl, .log, .env, .py, .js, .ts, .sql, .txt, .md',
    btnPickFiles: '选择本地文件',
    btnLoadDemoBatch: '加载演示三件套 (CSV+JSON+Log)',
    btnClearBatch: '清空队列',
    batchFilesHeading: '待处理文件队列',
    batchCsvColumnsTitle: 'CSV / TSV 敏感列强制脱敏（勾选的整列内容都将可逆替换为占位符）',
    batchCsvAutoNote: '未勾选的列仍会自动扫描 API Key、邮箱、手机号、身份证、银行卡等敏感信息。',
    batchIncludeMapLabel: '将 restore_map.json 一并打入 ZIP（仅限本地备份；发给 AI 前请保持关闭！）',
    batchIncludeMapWarn: '安全提醒：切勿把 restore_map.json 上传给任何外部 AI！',
    btnRunBatchZip: '批量脱敏并导出 ZIP',
    btnDownloadMapOnly: '单独下载 restore_map.json',
    batchPreviewTitle: '脱敏结果预览',
    batchEmptyState: '请拖入文件或点击“加载演示三件套”查看结构化 CSV / JSON 脱敏效果。',
    batchProGateMsg: '已为您预览首个文件脱敏效果。批量多文件打包导出 ZIP 与完整恢复映射下载为 Pro 功能。',
    btnGoUnlock: '前往激活 Pro',
    batchDoneToast: '已导出 {count} 个脱敏文件（共拦截 {hits} 处敏感信息）',

    // Tab 3: Custom Rules & License
    customTermsTitle: '自定义敏感实体词（公司名 / 客户名 / 项目代号）',
    customTermPlaceholder: '例如：AcmeHealth Corp 或 内部项目代号',
    customPrefixPlaceholder: '标签前缀（如 ORG）',
    customCaseLabel: '区分大小写',
    customWordLabel: '全词匹配',
    btnAddTerm: '添加实体词',
    customRegexTitle: '自定义正则规则（Pro）',
    customRegexNamePlaceholder: '规则名称（如 内部订单号）',
    customRegexPatternPlaceholder: '正则表达式（如 ORD-[0-9]{8}）',
    customRegexPrefixPlaceholder: '占位符前缀（如 ORDER_ID）',
    btnAddRegex: '添加正则规则',
    customRegexError: '正则表达式无效或存在安全风险：{error}',
    profilesTitle: '规则配置方案（Profiles · Pro）',
    profileNamePlaceholder: '方案名称（如：医疗客户脱敏规则）',
    btnSaveProfile: '保存当前规则为方案',
    profilesEmpty: '尚未保存自定义规则方案。',
    btnLoadProfile: '加载',
    btnDeleteProfile: '删除',
    proRulesHint: '免费版可在当前会话临时体验自定义实体词；持久化保存规则方案与自定义正则为 Pro 功能。',

    // License Card
    licenseTitle: 'Pro 离线授权激活（ECDSA P-256 零联网验证）',
    licenseStatusFree: '当前为免费版 — 单次脱敏/还原与全部 {count} 项内置检测器永久免费无限制。',
    licenseStatusPro: 'Pro 已激活（{mode} · 序列号 #{serial} · 批次 {batch}）',
    licenseKeyPlaceholder: '粘贴您的激活码（例如 SHD1.xxxx.yyyy）',
    btnActivate: '本地验证并激活',
    btnDeactivate: '退出 Pro 授权',
    btnBuyMbd: '面包多购买（微信/支付宝）',
    btnBuyGumroad: 'Gumroad 购买（国际卡/PayPal）',
    privacyProofTitle: '零联网隐私承诺',
    privacyProofDesc: 'PromptShield Pro 内置 ECDSA P-256 公钥，所有脱敏、还原、ZIP 打包与 SHD1.* 授权验证均 100% 在您的浏览器本地执行，不上传任何文本、映射表或遥测数据。',
    invalidVaultJson: '映射表 JSON 格式无效，请检查文件内容。',
    vaultImportedToast: '已导入映射表（{count} 个占位符）',
    licenseActivatedToast: 'Pro 授权本地验证通过，所有高级功能已解锁！',
    licenseDeactivatedToast: '已清除本地 Pro 授权。',
    detectorsListTitle: '已启用内置检测器（{count} 项）',
  },
  en: {
    appTagline: '100% Local Zero-Network AI Privacy Redactor & 1-Click Restorer',
    zeroNetBadge: '100% Local · 0 Network',
    tierFree: 'FREE',
    tierPro: 'PRO ACTIVE',
    langSwitch: '中文',

    // Tabs
    tabPrompt: 'Sanitize & Restore',
    tabBatch: 'Batch File Scrubber',
    tabRules: 'Rules & License',
    proChip: 'PRO',

    // Chat Bridge Bar
    chatBridgeTitle: 'Active AI Chat Bridge',
    chatSiteNone: 'No active ChatGPT / Claude / Gemini tab detected',
    chatSiteReady: 'Connected: {site} (reads/writes ONLY when you click)',
    chatStandaloneNote: 'Standalone Offline Web Mode — load as a Chrome Extension to enable 1-click ChatGPT / Claude / Gemini Side Panel bridge',
    btnPullDraft: 'Pull Draft & Sanitize',
    btnPushSafe: 'Push Safe Prompt',
    btnPullReply: 'Pull Reply & Restore',
    chatNeedPro: '1-click AI chat bridge is a Pro feature. Unlock in "Rules & License" or copy/paste manually (Free & unlimited).',

    // Tab 1
    step1Title: '1. Raw Prompt (paste code, logs, contracts, .env, or client data)',
    btnLoadDemo: 'Load Realistic Demo',
    btnClearAll: 'Clear',
    btnResetVault: 'Reset Vault',
    btnExportVault: 'Export Vault JSON',
    btnImportVault: 'Import Vault',
    inputPlaceholder: 'Paste text containing API keys, DB URIs, JWTs, emails, phone numbers, IDs, credit cards, or client names... 100% local in-memory processing, zero network.',
    btnSanitize: 'Sanitize Locally',
    autoSanitizeLabel: 'Live sanitize as you type',

    // Category toggles
    catSecrets: 'Secrets & URIs',
    catApiKeys: 'Cloud / AI Keys',
    catPii: 'Personal / Financial PII',
    catNetwork: 'IP & Network',
    catCustom: 'Custom Terms / Regex',

    // Step 2
    step2Title: '2. Safe Prompt (ready for ChatGPT / Claude / Gemini)',
    btnCopySafe: 'Copy Safe Prompt',
    copiedToast: 'Copied to clipboard',
    hitsSummary: 'Redacted {total} sensitive match(es) ({unique} unique placeholder(s))',
    noHitsSummary: 'No sensitive data detected. Text looks safe to send.',
    viewDiff: 'Highlighted',
    viewPlain: 'Plain Text',
    vaultTitle: 'Local Reversible Session Vault',
    vaultEmpty: 'No vault mappings yet. Repeated secrets/emails reuse the exact same placeholder (e.g. [EMAIL_1]) so AI reasoning stays 100% intact.',
    vaultReveal: 'Reveal Values',
    vaultHide: 'Mask Values',
    vaultColToken: 'Placeholder',
    vaultColCategory: 'Category',
    vaultColValue: 'Local Original Value',
    vaultColHits: 'Hits',

    // Step 3
    step3Title: '3. Paste AI Reply → 1-Click Lossless Local Restore',
    btnLoadDemoReply: 'Insert Demo AI Reply',
    aiReplyPlaceholder: 'Paste the AI response containing placeholders like [OPENAI_KEY_1], [EMAIL_1], [ORG_1] here...',
    btnRestore: 'Restore Real Values',
    btnCopyRestored: 'Copy Restored Text',
    restoredSummary: 'Restored {count} placeholder(s) locally',
    unresolvedWarn: 'Warning: {count} placeholder(s) not found in current vault: {tokens}',
    restoredEmpty: 'Restored output will appear here.',

    // Tab 2
    batchTitle: 'Batch CSV / JSON / Log / Code Local Scrubber (Pro)',
    batchSubtitle: 'All dropped files share one deterministic vault so cross-file joins stay consistent, then export as a clean UTF-8 ZIP.',
    batchDropTitle: 'Drop multiple files here or click to browse',
    batchDropHint: 'Supports .csv, .tsv, .json, .jsonl, .log, .env, .py, .js, .ts, .sql, .txt, .md',
    btnPickFiles: 'Choose Local Files',
    btnLoadDemoBatch: 'Load Demo Bundle (CSV+JSON+Log)',
    btnClearBatch: 'Clear Queue',
    batchFilesHeading: 'File Queue',
    batchCsvColumnsTitle: 'Column-Selective CSV / TSV Scrubbing (checked columns are fully replaced with reversible tokens)',
    batchCsvAutoNote: 'Unchecked columns are STILL automatically scanned for API keys, emails, phones, IDs, and cards.',
    batchIncludeMapLabel: 'Include restore_map.json inside ZIP (local backup ONLY — keep OFF before uploading to any AI!)',
    batchIncludeMapWarn: 'Safety Warning: NEVER upload restore_map.json to an external AI!',
    btnRunBatchZip: 'Scrub Batch & Export ZIP',
    btnDownloadMapOnly: 'Download restore_map.json Separately',
    batchPreviewTitle: 'Sanitized Output Preview',
    batchEmptyState: 'Drop files or click "Load Demo Bundle" to inspect structured CSV / JSON scrubbing.',
    batchProGateMsg: 'Previewing first file redaction. Multi-file ZIP export and full restore map download unlock with Pro.',
    btnGoUnlock: 'Unlock Pro',
    batchDoneToast: 'Exported {count} sanitized file(s) ({hits} sensitive match(es) scrubbed)',

    // Tab 3
    customTermsTitle: 'Custom Sensitive Entities (Company, Client, Project Codenames)',
    customTermPlaceholder: 'e.g. AcmeHealth Corp or Project Helios',
    customPrefixPlaceholder: 'Prefix (e.g. ORG)',
    customCaseLabel: 'Case-sensitive',
    customWordLabel: 'Whole word',
    btnAddTerm: 'Add Entity',
    customRegexTitle: 'Custom Regex Rules (Pro)',
    customRegexNamePlaceholder: 'Rule name (e.g. Internal Ticket)',
    customRegexPatternPlaceholder: 'Regex pattern (e.g. TKT-[0-9]{6})',
    customRegexPrefixPlaceholder: 'Prefix (e.g. TICKET)',
    btnAddRegex: 'Add Regex Rule',
    customRegexError: 'Invalid or unsafe regex: {error}',
    profilesTitle: 'Saved Rule Profiles (Pro)',
    profileNamePlaceholder: 'Profile name (e.g. Healthcare Client Audit)',
    btnSaveProfile: 'Save Current Rules as Profile',
    profilesEmpty: 'No saved profiles yet.',
    btnLoadProfile: 'Load',
    btnDeleteProfile: 'Delete',
    proRulesHint: 'Free users can test custom entities in the active session; persistent saved profiles and custom regex rules unlock with Pro.',

    // License Card
    licenseTitle: 'Pro Offline Activation (Zero-Network ECDSA P-256)',
    licenseStatusFree: 'Free Edition — Unlimited single-prompt redaction, restoration & all {count} built-in detectors.',
    licenseStatusPro: 'Pro Active ({mode} · Serial #{serial} · Batch {batch})',
    licenseKeyPlaceholder: 'Paste your license key (e.g. SHD1.xxxx.yyyy)',
    btnActivate: 'Verify & Activate Locally',
    btnDeactivate: 'Deactivate Pro',
    btnBuyMbd: 'Buy via Mianbaoduo (CN)',
    btnBuyGumroad: 'Buy on Gumroad (Global)',
    privacyProofTitle: 'Zero-Network Privacy Guarantee',
    privacyProofDesc: 'PromptShield Pro embeds an ECDSA P-256 public key. All redaction, restoration, ZIP packaging, and SHD1.* license verification run 100% locally in your browser with zero telemetry or cloud calls.',
    invalidVaultJson: 'Invalid restore vault JSON file.',
    vaultImportedToast: 'Imported vault ({count} placeholder(s))',
    licenseActivatedToast: 'Pro key verified locally! All Pro features unlocked.',
    licenseDeactivatedToast: 'Local Pro license cleared.',
    detectorsListTitle: 'Built-in High-Precision Detectors ({count})',
  },
});

export function detectDefaultLang() {
  try {
    if (typeof globalThis.localStorage !== 'undefined') {
      const saved = globalThis.localStorage.getItem(STORAGE_KEY);
      if (saved === 'zh' || saved === 'en') return saved;
    }
    const navLang = String(globalThis.navigator?.language || '').toLowerCase();
    return navLang.startsWith('zh') ? 'zh' : 'en';
  } catch {
    return 'zh';
  }
}

export async function loadLanguage() {
  if (globalThis.chrome?.storage?.local) {
    try {
      const res = await globalThis.chrome.storage.local.get(STORAGE_KEY);
      if (res?.[STORAGE_KEY] === 'zh' || res?.[STORAGE_KEY] === 'en') {
        return res[STORAGE_KEY];
      }
    } catch {
      // ignore storage errors
    }
  }
  return detectDefaultLang();
}

export async function saveLanguage(lang) {
  const safeLang = lang === 'en' ? 'en' : 'zh';
  if (globalThis.chrome?.storage?.local) {
    try {
      await globalThis.chrome.storage.local.set({ [STORAGE_KEY]: safeLang });
    } catch {
      // ignore
    }
  }
  if (typeof globalThis.localStorage !== 'undefined') {
    try {
      globalThis.localStorage.setItem(STORAGE_KEY, safeLang);
    } catch {
      // ignore
    }
  }
  return safeLang;
}

export function t(lang, key, vars = null) {
  const dict = DICTIONARY[lang === 'en' ? 'en' : 'zh'] || DICTIONARY.zh;
  let str = dict[key] ?? DICTIONARY.en[key] ?? key;
  if (vars && typeof vars === 'object') {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replaceAll(`{${k}}`, String(v));
    }
  }
  return str;
}
