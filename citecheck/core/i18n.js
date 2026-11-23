/**
 * CiteCheck Pro — Bilingual Internationalization (zh / en)
 */

export const TRANSLATIONS = {
  zh: {
    appTagline: '论文参考文献防幻觉 · 撤稿预警 · arXiv 转正一键体检',
    badgeFree: '免费版 ({limit} 条/次)',
    badgePro: 'PRO 专业版',
    btnLicense: '激活 / 升级 Pro',
    btnLicenseActive: 'Pro 许可 #{serial}',
    langSwitch: 'EN',

    inputTitle: '粘贴参考文献或拖入 .bib 文件',
    inputPlaceholder:
      '支持直接粘贴 BibTeX (@article / @inproceedings / @misc ...)、GB/T 7714 中文国标、APA、IEEE 或编号参考文献列表…\n\n也可以直接把 .bib / .txt 文件拖放到此处。',
    modeAuto: '自动识别',
    modeBibtex: 'BibTeX',
    modePlaintext: '纯文本 (GB/T / APA / IEEE)',
    btnUpload: '选择文件',
    btnDemo: '载入 5 条真实测试案例',
    btnOverleaf: '从当前 Overleaf 标签页导入',
    btnClear: '清空',
    btnAudit: '开始参考文献体检',
    btnAuditing: '正在核验…',
    btnCancel: '取消',
    detectedCount: '已解析 {count} 条文献 · 模式：{mode}',
    detectedEmpty: '等待输入参考文献…',
    dropHint: '松开鼠标导入文件内容',

    overleafImported: '已从 Overleaf 导入 {count} 条文献（{source}）',
    overleafEmpty: '未在当前 Overleaf 页面检测到有效的 .bib 内容，请先打开 .bib 文件或选中 BibTeX 文本。',
    overleafNotActive: '当前激活标签页不是 Overleaf 项目页面，请切换至 Overleaf 后再试。',
    overleafTruncated: '提示：CodeMirror 虚拟滚动仅加载可见区域文本，若 .bib 较长建议先全选或直接上传本地 .bib 文件。',

    freeLimitNoticeTitle: '免费版单次限核验前 {limit} 条文献',
    freeLimitNoticeBody:
      '本次共检测到 {total} 条文献，已完成前 {limit} 条核验，其余 {locked} 条已锁定。升级 Pro 即可解锁无限批量体检与完整导出。',
    btnUnlockNow: '立即解锁 Pro',

    progressRunning: '正在核验第 {completed}/{total} 条：{title}',
    progressDone: '体检完成：共核验 {total} 条文献（耗时 {seconds}s）',
    progressCancelled: '已取消：已完成 {completed}/{total} 条核验',

    filterAll: '全部',
    searchPlaceholder: '按标题、作者、引用键或期刊筛选…',

    verdict: {
      VERIFIED: '核验通过',
      RETRACTED: '已撤稿警报',
      ARXIV_PUBLISHED: 'arXiv 已正式发表',
      METADATA_MISMATCH: '元数据不符',
      SUSPECT_HALLUCINATION: '疑似幻觉 / 查无此文',
      API_ERROR: '接口查询异常',
    },
    verdictDesc: {
      VERIFIED: '在权威学术数据库中匹配一致，未发现撤稿记录。',
      RETRACTED: '高危预警：权威数据库标记该论文已被撤稿，请立即复核或移除引用！',
      ARXIV_PUBLISHED: '当前引用为预印本（arXiv），但已查到正式同行评审发表版本，建议一键升级。',
      METADATA_MISMATCH: '查到对应论文，但年份、DOI、作者或标题与权威记录存在差异。',
      SUSPECT_HALLUCINATION: '在 OpenAlex / Crossref / DBLP 中均未找到可信匹配，疑似 AI 编造或严重拼写错误。',
      API_ERROR: '外部学术数据库请求超时或限流，未将其误判为幻觉，请稍后重试。',
    },

    cardDetailsToggle: '查看核验详情与修正格式',
    cardDetailsHide: '收起详情',
    cardCanonicalTitle: '权威标准记录',
    cardDiffTitle: '差异对比（输入 vs 权威库）',
    cardUpgradeTitle: '建议升级为正式发表版本',
    cardSourcesLabel: '核验来源',
    cardInputLabel: '输入值',
    cardVerifiedLabel: '权威值',
    cardNoCanonical: '未能匹配到权威文献记录。',
    cardRetryHint: '网络或 API 限流导致核验中断，请重试。',
    cardCopyBib: '复制修正 BibTeX',
    cardCopyGbt: '复制 GB/T 7714',
    cardCopyApa: '复制 APA 7th',
    cardCopied: '已复制!',
    cardOpenDoi: '打开 DOI',
    cardOpenOpenAlex: 'OpenAlex',
    cardOpenDblp: 'DBLP',

    diffField: {
      year: '发表年份',
      doi: 'DOI 编号',
      authors: '作者列表',
      title: '论文标题',
      venue: '发表期刊/会议',
    },

    exportTitle: '导出体检报告与修复文献',
    exportBib: '导出修复 .bib',
    exportMd: '导出 Markdown',
    exportCsv: '导出 CSV',
    exportHtml: '导出可打印 HTML',
    exportProTag: 'PRO',
    exportLockedToast: '批量导出全部修复 .bib / CSV / HTML 为 Pro 功能，请先激活 Pro 许可。',

    emptyResultsTitle: '准备就绪',
    emptyResultsDesc: '粘贴 BibTeX / GB/T 7714 / APA 参考文献，或点击“载入 5 条真实测试案例”立即体验防幻觉、撤稿检测与 arXiv 转正。',
    noFilterMatch: '当前筛选条件下没有匹配的文献。',

    privacyNote: '100% 本地前端运行 · 仅向 OpenAlex / Crossref / DBLP 公开接口查询文献元数据 · 绝不上传论文正文。',

    modalTitle: 'CiteCheck Pro 专业版许可',
    modalSubtitle: '一次买断 · 本地离线 ECDSA P-256 验签 · 无订阅费',
    tierFreeTitle: '免费版',
    tierProTitle: 'Pro 专业版',
    tierFreeItems: [
      '单次最多核验 8 条参考文献',
      '防幻觉、撤稿预警、arXiv 转正全功能检测',
      '单条复制修正 BibTeX / GB/T 7714 / APA 7th',
      'Markdown 审校摘要导出',
    ],
    tierProItems: [
      '单次无限条参考文献批量体检（整篇论文/毕业论文）',
      '一键导出全量修复 .bib 文件',
      '导出 Excel 友好 CSV 与可打印 HTML 审校报告',
      'Overleaf 大型 .bib 工程无缝体检',
      '100% 本地离线验签，无后台账号绑定',
    ],
    buyTitle: '获取 Pro 激活码',
    buyMianbaoduo: '面包多（微信/支付宝）',
    buyGumroad: 'Gumroad（国际卡/PayPal）',
    buyLemon: 'Lemon Squeezy',
    activateLabel: '输入激活码（支持 CITE1. 离线密钥或商城 UUID）',
    activatePlaceholder: '粘贴 CITE1.xxxx.xxxx 激活码…',
    btnActivate: '验证并激活',
    btnDeactivate: '移除当前许可',
    licenseActiveBanner: 'Pro 许可已激活 · 批次 {batch} · 序号 #{serial}（{mode}）',
    licenseModeOffline: '离线 ECDSA 验签',
    licenseModeOnline: '在线商城验签',
    licenseInvalid: '激活码无效：{reason}',
    licenseActivatedToast: 'CiteCheck Pro 激活成功！已解锁无限核验与全量导出。',
    licenseClearedToast: '已移除本地许可，恢复为免费版。',
    licenseReasons: {
      EMPTY_KEY: '请输入激活码',
      INVALID_FORMAT: '密钥格式不正确',
      PRODUCT_MISMATCH: '该密钥属于其他产品，不能用于 CiteCheck Pro',
      INVALID_SIGNATURE: '数字签名验证失败，请检查是否复制完整',
      PAYLOAD_MISMATCH: '密钥载荷产品标识不匹配',
      ONLINE_PROVIDER_NOT_CONFIGURED: '当前构建未配置在线商城 UUID 核验，请使用 CITE1. 离线签名激活码',
      ONLINE_VERIFICATION_FAILED: '在线许可验证未通过',
      NETWORK_ERROR: '无法连接在线许可服务器，请检查网络',
    },

    reportTitle: 'CiteCheck Pro 参考文献体检报告',
    reportGeneratedAt: '生成时间',
    reportSummary: '统计摘要',
    reportTotal: '总计',
    reportDetails: '逐条核验明细',
    reportSuggestedBib: '建议修正 BibTeX',
  },

  en: {
    appTagline: 'Hallucination Guard · Retraction Alert · arXiv-to-Published Upgrade',
    badgeFree: 'FREE ({limit} / audit)',
    badgePro: 'PRO UNLOCKED',
    btnLicense: 'Activate / Upgrade Pro',
    btnLicenseActive: 'Pro License #{serial}',
    langSwitch: '中文',

    inputTitle: 'Paste References or Drop a .bib File',
    inputPlaceholder:
      'Paste BibTeX (@article / @inproceedings / @misc ...), GB/T 7714, APA, IEEE, or numbered plain-text references...\n\nOr drag & drop a .bib / .txt file here.',
    modeAuto: 'Auto-Detect',
    modeBibtex: 'BibTeX',
    modePlaintext: 'Plain Text (APA / IEEE / GB/T)',
    btnUpload: 'Choose File',
    btnDemo: 'Load Demo (5 Real Cases)',
    btnOverleaf: 'Import from Active Overleaf Tab',
    btnClear: 'Clear',
    btnAudit: 'Run Citation Audit',
    btnAuditing: 'Auditing…',
    btnCancel: 'Cancel',
    detectedCount: 'Parsed {count} references · Mode: {mode}',
    detectedEmpty: 'Waiting for references…',
    dropHint: 'Release to load file contents',

    overleafImported: 'Imported {count} references from Overleaf ({source})',
    overleafEmpty: 'No BibTeX content detected in the active Overleaf editor. Open your .bib file or select BibTeX entries first.',
    overleafNotActive: 'Active tab is not an Overleaf project. Switch to an Overleaf tab and try again.',
    overleafTruncated: 'Note: Overleaf CodeMirror virtualizes long files. For huge .bib files, select all or upload the .bib file directly.',

    freeLimitNoticeTitle: 'Free tier audits up to {limit} references per run',
    freeLimitNoticeBody:
      'Detected {total} references. Audited the first {limit}; {locked} remaining entries are locked. Upgrade to Pro for unlimited batch audits & exports.',
    btnUnlockNow: 'Unlock Pro',

    progressRunning: 'Checking {completed}/{total}: {title}',
    progressDone: 'Audit complete: {total} references checked in {seconds}s',
    progressCancelled: 'Cancelled: {completed}/{total} checked',

    filterAll: 'All',
    searchPlaceholder: 'Filter by title, author, key, or venue…',

    verdict: {
      VERIFIED: 'Verified',
      RETRACTED: 'Retracted Alert',
      ARXIV_PUBLISHED: 'arXiv Published',
      METADATA_MISMATCH: 'Metadata Mismatch',
      SUSPECT_HALLUCINATION: 'Suspect Hallucination',
      API_ERROR: 'API Error',
    },
    verdictDesc: {
      VERIFIED: 'Matched authoritative scholarly records cleanly with no retraction flags.',
      RETRACTED: 'CRITICAL: Flagged as RETRACTED in scholarly databases. Review or remove immediately!',
      ARXIV_PUBLISHED: 'Cited as an arXiv/preprint, but a peer-reviewed published venue was found. Ready to upgrade.',
      METADATA_MISMATCH: 'Paper exists, but year, DOI, authors, or title differs from the canonical record.',
      SUSPECT_HALLUCINATION: 'No credible match across OpenAlex, Crossref, or DBLP. Likely fabricated or severely corrupted.',
      API_ERROR: 'Upstream scholarly API timed out or rate-limited. Never falsely marked as hallucinated — please retry.',
    },

    cardDetailsToggle: 'Inspect Diffs & Fixed Citations',
    cardDetailsHide: 'Hide Details',
    cardCanonicalTitle: 'Canonical Record',
    cardDiffTitle: 'Field Differences (Input vs Canonical)',
    cardUpgradeTitle: 'Formal Published Version Available',
    cardSourcesLabel: 'Sources',
    cardInputLabel: 'Input',
    cardVerifiedLabel: 'Canonical',
    cardNoCanonical: 'No authoritative match found.',
    cardRetryHint: 'Network or API rate limit prevented verification. Please retry.',
    cardCopyBib: 'Copy Fixed BibTeX',
    cardCopyGbt: 'Copy GB/T 7714',
    cardCopyApa: 'Copy APA 7th',
    cardCopied: 'Copied!',
    cardOpenDoi: 'Open DOI',
    cardOpenOpenAlex: 'OpenAlex',
    cardOpenDblp: 'DBLP',

    diffField: {
      year: 'Year',
      doi: 'DOI',
      authors: 'Authors',
      title: 'Title',
      venue: 'Venue',
    },

    exportTitle: 'Export Audit Report & Repaired Bibliography',
    exportBib: 'Export Fixed .bib',
    exportMd: 'Export Markdown',
    exportCsv: 'Export CSV',
    exportHtml: 'Export Printable HTML',
    exportProTag: 'PRO',
    exportLockedToast: 'Batch export of Fixed .bib / CSV / Printable HTML requires a Pro license.',

    emptyResultsTitle: 'Ready to Audit',
    emptyResultsDesc: 'Paste BibTeX, APA, IEEE, or GB/T 7714 references — or click "Load Demo (5 Real Cases)" to test hallucination detection, retraction alerts, and arXiv upgrades.',
    noFilterMatch: 'No references match the current filter.',

    privacyNote: '100% client-side · Queries only public OpenAlex / Crossref / DBLP metadata APIs · Your manuscript never leaves your browser.',

    modalTitle: 'CiteCheck Pro License',
    modalSubtitle: 'One-time purchase · Local offline ECDSA P-256 verification · Zero subscription',
    tierFreeTitle: 'Free',
    tierProTitle: 'Pro',
    tierFreeItems: [
      'Up to 8 references per audit run',
      'Full hallucination, retraction & arXiv upgrade detection',
      '1-click single copy (BibTeX / GB/T 7714 / APA 7th)',
      'Markdown audit summary export',
    ],
    tierProItems: [
      'Unlimited references per batch audit (full thesis / paper)',
      '1-click batch export of repaired .bib file',
      'Excel-ready CSV & printable HTML audit reports',
      'Seamless Overleaf large-bibliography auditing',
      '100% offline cryptographic verification, no account required',
    ],
    buyTitle: 'Get a Pro Key',
    buyMianbaoduo: 'Mianbaoduo (WeChat / Alipay)',
    buyGumroad: 'Gumroad (Card / PayPal)',
    buyLemon: 'Lemon Squeezy',
    activateLabel: 'Enter License Key (CITE1. offline key or storefront UUID)',
    activatePlaceholder: 'Paste CITE1.xxxx.xxxx key…',
    btnActivate: 'Verify & Activate',
    btnDeactivate: 'Remove License',
    licenseActiveBanner: 'Pro Active · Batch {batch} · Serial #{serial} ({mode})',
    licenseModeOffline: 'Offline ECDSA',
    licenseModeOnline: 'Online Storefront',
    licenseInvalid: 'Invalid key: {reason}',
    licenseActivatedToast: 'CiteCheck Pro activated! Unlimited audits & full exports unlocked.',
    licenseClearedToast: 'Local license removed. Switched back to Free tier.',
    licenseReasons: {
      EMPTY_KEY: 'Please enter a license key',
      INVALID_FORMAT: 'Malformed license key format',
      PRODUCT_MISMATCH: 'This key belongs to another product, not CiteCheck Pro',
      INVALID_SIGNATURE: 'Cryptographic signature verification failed',
      PAYLOAD_MISMATCH: 'Signed payload does not match CiteCheck Pro',
      ONLINE_PROVIDER_NOT_CONFIGURED: 'Online UUID validation is not configured in this build; please use a CITE1. signed key',
      ONLINE_VERIFICATION_FAILED: 'Online license validation failed',
      NETWORK_ERROR: 'Unable to reach license server; check network connectivity',
    },

    reportTitle: 'CiteCheck Pro Citation Audit Report',
    reportGeneratedAt: 'Generated',
    reportSummary: 'Summary',
    reportTotal: 'Total',
    reportDetails: 'Detailed Findings',
    reportSuggestedBib: 'Suggested Fixed BibTeX',
  },
};

/**
 * Look up a nested or top-level translation string and interpolate `{key}` placeholders.
 */
export function t(lang, keyPath, params = {}) {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.zh;
  const fallbackDict = TRANSLATIONS.en;
  const resolve = (obj, pathStr) =>
    pathStr.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);

  let value = resolve(dict, keyPath);
  if (value === undefined) value = resolve(fallbackDict, keyPath);
  if (value === undefined) return keyPath;
  if (typeof value !== 'string') return value;

  return value.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
}

export function detectDefaultLang() {
  try {
    const navLang = (globalThis.navigator?.language || '').toLowerCase();
    return navLang.startsWith('zh') ? 'zh' : 'en';
  } catch {
    return 'zh';
  }
}
