/**
 * TableForge Pro — Core Configuration
 * Zero-dependency ES module compatible with Chrome MV3, modern browsers, and Node v22.
 */

export const APP_NAME = 'TableForge Pro';
export const APP_VERSION = '1.0.0';
export const PRODUCT_ID = 'tbl';
export const LICENSE_PREFIX = 'TBL1';

/** Free-tier table limits (data rows excluding separator rows, and columns). */
export const FREE_MAX_ROWS = 5;
export const FREE_MAX_COLS = 5;

/**
 * Embedded ECDSA P-256 Public JWK used for 100% offline verification of
 * signed `TBL1.<payload>.<sig>` license keys.
 */
export const LICENSE_PUBLIC_JWK = Object.freeze({
  key_ops: ['verify'],
  ext: true,
  kty: 'EC',
  x: 'NSDoxkI-j1zCkjRzvhy60DwyY3hKkDSrAYgXF29AkZc',
  y: 'wwyr0VnMv7C69dmMcjlYktPR-P0JgDEc0gv6s2FagVE',
  crv: 'P-256',
});

/**
 * Storefront purchase links.
 */
export const PURCHASE_URLS = Object.freeze({
  gumroad: 'https://hxucreativity28.gumroad.com/l/tableforge-pro',
  mianbaoduo: 'https://mbd.pub/o/bread/tableforge-pro',
});

/**
 * Online license verification config (Gumroad API v2).
 * Offline `TBL1.*` ECDSA-signed keys work immediately with zero backend or network calls.
 * Flip `enabled: true` and supply the live Gumroad `product_id` once published.
 */
export const ONLINE_LICENSE_PROVIDERS = Object.freeze({
  gumroad: Object.freeze({
    enabled: true,
    product_id: 'rRNlovQ6rxOOAFYC97o_qg==',
    productPermalink: 'tableforge-pro',
    validateUrl: 'https://api.gumroad.com/v2/licenses/verify',
  }),
});

export const STORAGE_KEYS = Object.freeze({
  license: 'tableforge_pro_license_v1',
  lang: 'tableforge_pro_lang_v1',
  prefs: 'tableforge_pro_prefs_v1',
});

/**
 * Supported publication venue presets.
 */
export const VENUE_PRESETS = Object.freeze({
  neurips: Object.freeze({
    id: 'neurips',
    labelEn: 'NeurIPS / ICML',
    labelZh: 'NeurIPS / ICML',
    captionPosition: 'top',
    tableEnv: 'table',
    placement: 't',
    sizeCmd: '\\small',
    tabcolsep: '5pt',
    arraystretch: '1.08',
    fontFamily: '"Times New Roman", "STIX Two Text", Georgia, "Songti SC", serif',
  }),
  nature: Object.freeze({
    id: 'nature',
    labelEn: 'Nature 3-Line',
    labelZh: 'Nature 三线表',
    captionPosition: 'top',
    tableEnv: 'table',
    placement: 'htbp',
    sizeCmd: '\\footnotesize',
    tabcolsep: '6pt',
    arraystretch: '1.15',
    fontFamily: '"Helvetica Neue", Arial, "PingFang SC", sans-serif',
  }),
  ieee: Object.freeze({
    id: 'ieee',
    labelEn: 'IEEE Two-Column',
    labelZh: 'IEEE 双栏通栏',
    captionPosition: 'top',
    tableEnv: 'table*',
    placement: 't',
    sizeCmd: '\\footnotesize',
    tabcolsep: '5pt',
    arraystretch: '1.12',
    fontFamily: '"Times New Roman", Georgia, "Songti SC", serif',
  }),
  acl: Object.freeze({
    id: 'acl',
    labelEn: 'ACL / EMNLP',
    labelZh: 'ACL / EMNLP',
    captionPosition: 'bottom',
    tableEnv: 'table',
    placement: 't',
    sizeCmd: '\\small',
    tabcolsep: '5pt',
    arraystretch: '1.08',
    fontFamily: '"Times New Roman", Georgia, "Songti SC", serif',
  }),
});

/**
 * Curated ML/Scientific benchmark demo CSV (8 models x 6 metrics):
 * Mixes Accuracy (↑), F1 (↑), FID (↓), Latency ms (↓), Params M (meta), and AUC (↑),
 * plus both `±` and `+-` uncertainty strings, ties, significance stars, and a `---` group rule.
 */
export const DEMO_CSV = `Method,Accuracy (%),F1 Score,FID,Latency (ms),Params (M),AUC (%)
ResNet-50 (Baseline),84.15 ± 0.42,83.20+-0.38,18.40 ± 0.55,14.2,25.6,91.10 ± 0.25
ViT-B/16,86.72 ± 0.35,85.94+-0.30,14.12 ± 0.41,22.8,86.6,93.45 ± 0.21
ConvNeXt-S,87.64 ± 0.28,86.88 ± 0.27,12.85+-0.36,19.4,50.2,94.18 ± 0.19
Swin-B,88.10 ± 0.33,87.45 ± 0.29,11.90 ± 0.32,26.5,87.8,94.62+-0.18
DiffNet-Base,89.42 ± 0.31,88.76+-0.26,9.84 ± 0.28,16.8,44.1,95.40 ± 0.16
---
TableForge-Small,89.42+-0.24,89.10 ± 0.22,8.92 ± 0.21,11.6,31.4,95.88 ± 0.14
TableForge-Base*,90.85 ± 0.19,90.42 ± 0.18,7.45+-0.19,13.1,46.8,96.74 ± 0.12
TableForge-Large**,91.64 ± 0.17,91.18 ± 0.16,6.82 ± 0.15,17.9,78.5,97.32 ± 0.10`;

export const DEFAULT_CAPTION_ZH = '主要实验基准对比结果（粗体为最优，下划线为次优）。';
export const DEFAULT_CAPTION_EN = 'Main benchmark comparison across models (best in bold, second-best underlined).';
export const DEFAULT_LABEL = 'tab:main_results';
