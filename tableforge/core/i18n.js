/**
 * TableForge Pro — Bilingual UI Dictionary (Chinese / English)
 */

export const I18N = {
  zh: {
    appTitle: 'TableForge Pro — 科研论文实验结果一键转顶刊三线表',
    tagline: 'CSV / Excel 一键转顶刊 booktabs LaTeX · Word 三线表 · Typst · Markdown',
    tierFree: 'FREE',
    tierPro: 'PRO',
    unlockPro: '解锁 Pro',
    proActiveBtn: 'Pro 已激活',
    langSwitch: 'EN',

    // Input panel
    inputTitle: '1. 粘贴实验数据（CSV / TSV / Excel）',
    loadDemo: '加载 ML 基准示例',
    uploadFile: '导入 .csv/.tsv',
    clearBtn: '清空',
    dropHint: '松开鼠标即可导入 CSV / TSV 文件',
    inputPlaceholder: '直接从 Excel / Google Sheets 复制粘贴，或输入 CSV/TSV 数据…\n支持 mean ± std、mean+-std、88.5%、0.42***，以及用 "---" 分隔模型分组。',
    privacyNote: '100% 本地浏览器离线处理，你的实验数据与未发表结果绝不上传任何服务器。',
    detectedMeta: (rows, cols, delim) => `已解析 ${rows} 行 × ${cols} 列（${delim}）`,
    detectedEmpty: '粘贴数据或点击「加载 ML 基准示例」立即预览',
    delimTab: 'Excel / TSV 制表符',
    delimComma: 'CSV 逗号',
    delimSemi: '分号分隔',

    // Free limit banner
    freeLimitTitle: '当前为免费版预览上限（5 行 × 5 列）',
    freeLimitBody: (shownR, totalR, shownC, totalC) =>
      `已显示前 ${shownR}/${totalR} 行 × ${shownC}/${totalC} 列。升级 Pro 解锁无限行列、siunitx 对齐、Baseline Δ 增益列、Word 三线表一键复制、Typst 导出与 Python CLI 自动化脚本。`,
    freeFeatureBanner: '此功能属于 Pro 版',
    unlockNow: '激活 Pro 密钥',

    // Controls panel
    controlsTitle: '2. 排版规则与列排序方向',
    colDirectionsLabel: '点击切换各列优化方向（自动识别最优加粗 / 次优下划线）',
    dirMax: '↑ 越大越好',
    dirMin: '↓ 越小越好',
    dirNone: '— 文本/不排序',
    venueLabel: '期刊/顶会模板',
    precisionLabel: '小数位数',
    precisionAuto: '保持原精度',
    baselineLabel: 'Baseline 对比行 (Δ)',
    baselineNone: '不显示 Δ',
    deltaModeLabel: 'Δ 显示模式',
    deltaModeAbs: '± 绝对差值',
    deltaModePct: '% 相对提升',
    captionLabel: '表题 Caption',
    labelFieldLabel: 'LaTeX Label',
    optBold: '最优加粗',
    optUnderline: '次优下划线',
    optArrows: '表头 ↑/↓',
    optSiunitx: 'siunitx 对齐',
    optResizebox: '\\resizebox 自适应',
    proBadge: 'PRO',

    // Preview panel
    previewTitle: '3. 顶刊排版实时预览',
    previewMeta: (preset, rows, cols) => `${preset} · ${rows} 行 × ${cols} 列`,
    legendBest: '最优 #1',
    legendSecond: '次优 #2',
    legendBaseline: 'Baseline 行',
    emptyPreviewTitle: '尚无表格数据',
    emptyPreviewDesc: '在左侧粘贴 Excel/CSV 结果，或点击「加载 ML 基准示例」体验自动标粗、次优下划线与多格式导出。',

    // Export panel
    outputTitle: '4. 一键导出代码与文档',
    tabLatex: 'LaTeX (booktabs)',
    tabWord: 'Word 三线表',
    tabTypst: 'Typst',
    tabMarkdown: 'Markdown',
    copyLatex: '复制 LaTeX',
    copyWord: '复制 Word 三线表',
    copyTypst: '复制 Typst',
    copyMarkdown: '复制 Markdown',
    downloadTex: '下载 .tex',
    downloadCurrent: '下载当前文件',
    copyCliCmd: '复制 Python CLI 命令',
    wordHint: '点击「复制 Word 三线表」后，在 Microsoft Word / Google Docs / WPS 中直接 Ctrl+V / Cmd+V 即可得到标准 1.5pt / 0.75pt / 1.5pt 三线表。',
    proLockedOverlayTitle: '升级 TableForge Pro 解锁此格式',
    proLockedOverlayDesc: '一次买断，终身离线使用：无限行列、Word/Docs 三线表富文本复制、Typst、siunitx 小数点对齐、Baseline Δ 增益列及零依赖 Python CLI。',

    // Modal
    modalTitle: 'TableForge Pro 授权激活',
    modalSubtitle: '一次买断 · 本地 ECDSA 离线验签 · 零订阅',
    tierFreeTitle: 'Free 免费版',
    tierFreeItems: [
      '最多 5 行 × 5 列实时预览',
      '自动识别 mean ± std 与最优/次优并列排名',
      'NeurIPS / Nature / IEEE / ACL LaTeX 导出',
      'GitHub Flavored Markdown 导出',
    ],
    tierProTitle: 'Pro 完整版（买断）',
    tierProItems: [
      '无限行数与无限列数，适配大型消融实验表',
      'Word / Google Docs 一键复制标准三线表（富文本 HTML）',
      'Typst 现代排版导出 + siunitx 小数点对齐',
      'Baseline 行 Δ 绝对/相对增益自动计算',
      '零依赖 Python CLI（直接嵌入训练/评测脚本）',
    ],
    buyTitle: '获取 Pro 授权密钥',
    buyMianbaoduo: '面包多（国内微信/支付宝）',
    buyGumroad: 'Gumroad（国际信用卡/PayPal）',
    activateLabel: '输入授权密钥（TBL1.xxx...）',
    keyPlaceholder: '粘贴你的 TBL1. 离线授权密钥',
    activateBtn: '立即激活',
    deactivateBtn: '取消激活',
    licenseActiveInfo: (serial, batch) => `已激活 Pro 授权 · 编号 #${serial}（批次 ${batch}）`,

    // Toasts & errors
    toastCopied: (what) => `已复制 ${what} 到剪贴板`,
    toastWordCopied: '已复制 Word 三线表（富文本 HTML），可直接粘贴到 Word / Google Docs',
    toastWordFallback: '已使用兼容方式复制 Word 三线表',
    toastDownloaded: (name) => `已下载 ${name}`,
    toastDemoLoaded: '已加载 8 模型 × 6 指标基准示例',
    toastActivated: 'TableForge Pro 激活成功！全部专业功能已解锁',
    toastDeactivated: '已退出 Pro 授权，恢复 Free 模式',
    toastFileLoaded: (name) => `已导入 ${name}`,
    toastProRequired: '该功能需激活 TableForge Pro 密钥',
    errEmptyKey: '请输入授权密钥',
    errProductMismatch: '该密钥不属于 TableForge Pro（需要 TBL1. 前缀）',
    errInvalidSig: '密钥签名无效，请检查是否复制完整',
    errInvalidFormat: '密钥格式不正确',
    errOnlineNotConfigured: '在线验签尚未启用，请使用 TBL1. 离线签名密钥',
    errGenericKey: '密钥验证失败',
  },

  en: {
    appTitle: 'TableForge Pro — CSV/Excel to Publication LaTeX, Word & Typst Tables',
    tagline: 'CSV / Excel to NeurIPS booktabs LaTeX · Word 3-Line · Typst · Markdown',
    tierFree: 'FREE',
    tierPro: 'PRO',
    unlockPro: 'Unlock Pro',
    proActiveBtn: 'Pro Active',
    langSwitch: '中文',

    // Input panel
    inputTitle: '1. Paste Experiment Data (CSV / TSV / Excel)',
    loadDemo: 'Load ML Benchmark Demo',
    uploadFile: 'Upload .csv/.tsv',
    clearBtn: 'Clear',
    dropHint: 'Drop your CSV or TSV file to load immediately',
    inputPlaceholder: 'Paste directly from Excel / Google Sheets, or type CSV/TSV...\nSupports mean ± std, mean+-std, 88.5%, 0.42***, and "---" row-group dividers.',
    privacyNote: '100% local offline processing. Your unpublished results never leave your browser.',
    detectedMeta: (rows, cols, delim) => `Parsed ${rows} rows × ${cols} cols (${delim})`,
    detectedEmpty: 'Paste data or click "Load ML Benchmark Demo" to preview',
    delimTab: 'Excel / TSV Tab',
    delimComma: 'CSV Comma',
    delimSemi: 'Semicolon',

    // Free limit banner
    freeLimitTitle: 'Free tier preview limit (5 rows × 5 cols)',
    freeLimitBody: (shownR, totalR, shownC, totalC) =>
      `Showing ${shownR}/${totalR} rows × ${shownC}/${totalC} cols. Upgrade to Pro for unlimited size, siunitx alignment, Baseline Δ gains, 1-click Word 3-Line paste, Typst export, and Python CLI automation.`,
    freeFeatureBanner: 'Pro feature',
    unlockNow: 'Activate Pro Key',

    // Controls panel
    controlsTitle: '2. Formatting & Column Ranking',
    colDirectionsLabel: 'Click pills to toggle column direction (auto-bolds #1 & underlines #2)',
    dirMax: '↑ Max',
    dirMin: '↓ Min',
    dirNone: '— Text',
    venueLabel: 'Venue Preset',
    precisionLabel: 'Decimals',
    precisionAuto: 'Auto (keep)',
    baselineLabel: 'Baseline Row (Δ)',
    baselineNone: 'No Δ',
    deltaModeLabel: 'Δ Display Mode',
    deltaModeAbs: '± Abs Δ',
    deltaModePct: '% Rel Δ',
    captionLabel: 'Table Caption',
    labelFieldLabel: 'LaTeX Label',
    optBold: 'Bold #1',
    optUnderline: 'Underline #2',
    optArrows: 'Header ↑/↓',
    optSiunitx: 'siunitx Align',
    optResizebox: '\\resizebox Fit',
    proBadge: 'PRO',

    // Preview panel
    previewTitle: '3. Live Publication Table Preview',
    previewMeta: (preset, rows, cols) => `${preset} · ${rows} rows × ${cols} cols`,
    legendBest: 'Best #1',
    legendSecond: '2nd #2',
    legendBaseline: 'Baseline',
    emptyPreviewTitle: 'No table data yet',
    emptyPreviewDesc: 'Paste from Excel/CSV on the left or load the ML Benchmark Demo to see auto-ranking, tie handling, and instant publication exports.',

    // Export panel
    outputTitle: '4. One-Click Publication Exports',
    tabLatex: 'LaTeX (booktabs)',
    tabWord: 'Word 3-Line',
    tabTypst: 'Typst',
    tabMarkdown: 'Markdown',
    copyLatex: 'Copy LaTeX',
    copyWord: 'Copy Word 3-Line',
    copyTypst: 'Copy Typst',
    copyMarkdown: 'Copy Markdown',
    downloadTex: 'Download .tex',
    downloadCurrent: 'Download File',
    copyCliCmd: 'Copy Python CLI Command',
    wordHint: 'Click "Copy Word 3-Line" and paste (Ctrl+V / Cmd+V) directly into Microsoft Word or Google Docs for instant 1.5pt / 0.75pt / 1.5pt rules.',
    proLockedOverlayTitle: 'Unlock with TableForge Pro',
    proLockedOverlayDesc: 'One-time purchase, 100% offline: unlimited rows & cols, rich-HTML Word/Docs 3-line paste, Typst export, siunitx alignment, Baseline Δ column, and zero-dep Python CLI.',

    // Modal
    modalTitle: 'TableForge Pro License',
    modalSubtitle: 'One-time purchase · Local ECDSA P-256 verification · Zero subscription',
    tierFreeTitle: 'Free Tier',
    tierFreeItems: [
      'Up to 5 rows × 5 columns live preview',
      'Smart mean ± std parsing & tie-aware ranking',
      'NeurIPS / Nature / IEEE / ACL LaTeX export',
      'GitHub Flavored Markdown export',
    ],
    tierProTitle: 'Pro Edition (One-Time)',
    tierProItems: [
      'Unlimited rows & columns for full ablation tables',
      '1-click Word / Google Docs 3-Line rich HTML copy',
      'Typst export + siunitx decimal-point alignment',
      'Baseline row Δ (absolute & relative %) comparisons',
      'Zero-dep Python CLI for automated experiment pipelines',
    ],
    buyTitle: 'Get a Pro License Key',
    buyMianbaoduo: 'Mianbaoduo (WeChat / Alipay)',
    buyGumroad: 'Gumroad (Card / PayPal)',
    activateLabel: 'Enter License Key (TBL1.xxx...)',
    keyPlaceholder: 'Paste your TBL1. offline license key',
    activateBtn: 'Activate',
    deactivateBtn: 'Deactivate',
    licenseActiveInfo: (serial, batch) => `Pro Active · Serial #${serial} (Batch ${batch})`,

    // Toasts & errors
    toastCopied: (what) => `Copied ${what} to clipboard`,
    toastWordCopied: 'Copied Word 3-Line rich HTML — paste directly into Word or Google Docs',
    toastWordFallback: 'Copied Word 3-Line table using compatibility fallback',
    toastDownloaded: (name) => `Downloaded ${name}`,
    toastDemoLoaded: 'Loaded 8-model × 6-metric ML benchmark demo',
    toastActivated: 'TableForge Pro activated! All Pro features unlocked.',
    toastDeactivated: 'License removed; reverted to Free tier.',
    toastFileLoaded: (name) => `Loaded ${name}`,
    toastProRequired: 'Activate a TableForge Pro license to unlock this feature.',
    errEmptyKey: 'Please enter a license key',
    errProductMismatch: 'This key is not for TableForge Pro (expected TBL1. prefix)',
    errInvalidSig: 'Invalid cryptographic signature — verify the entire key was pasted',
    errInvalidFormat: 'Invalid license key format',
    errOnlineNotConfigured: 'Online validation is not enabled; please use a TBL1. offline key',
    errGenericKey: 'License verification failed',
  },
};

export function detectDefaultLang() {
  try {
    const nav = globalThis.navigator?.language || '';
    return nav.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  } catch {
    return 'zh';
  }
}

export function getCopy(lang) {
  return I18N[lang] || I18N.zh;
}
