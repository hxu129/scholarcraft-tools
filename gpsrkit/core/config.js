/**
 * GPSRKit Pro — Core Configuration
 * 100% offline, zero-dependency ES module compatible with modern browsers and Node v22.
 */

export const APP_NAME = 'GPSRKit Pro';
export const APP_VERSION = '1.0.0';
export const PRODUCT_ID = 'gpsr';
export const LICENSE_PREFIX = 'GPSR1';
export const PRO_PRICE_USD = 29;
export const PRO_PRICE_LABEL = '$29';

/** Free vs Pro label language entitlements. */
export const FREE_LABEL_LANGUAGES = Object.freeze(['en', 'de']);
export const PRO_LABEL_LANGUAGES = Object.freeze(['en', 'de', 'fr', 'es', 'it']);

/**
 * Embedded ECDSA P-256 Public JWK used for 100% offline verification of
 * signed `GPSR1.<payload>.<sig>` license keys.
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
  gumroad: 'https://hxucreativity28.gumroad.com/l/gpsrkit-pro',
  mianbaoduo: 'https://mbd.pub/o/bread/YZaWmJ9uaA==',
});

/**
 * Optional online license verification config (Gumroad API v2).
 * Offline `GPSR1.*` ECDSA-signed keys work immediately with zero backend or network calls.
 * Flip `enabled: true` and supply the live Gumroad `product_id` once published.
 */
export const ONLINE_LICENSE_PROVIDERS = Object.freeze({
  gumroad: Object.freeze({
    enabled: true,
    product_id: 'BdK3b_7cxN0pk2s-efcXTg==',
    productPermalink: 'gpsrkit-pro',
    validateUrl: 'https://api.gumroad.com/v2/licenses/verify',
  }),
});

export const STORAGE_KEYS = Object.freeze({
  license: 'gpsrkit_pro_license_v1',
  lang: 'gpsrkit_pro_lang_v1',
  draft: 'gpsrkit_pro_draft_v1',
  profiles: 'gpsrkit_pro_profiles_v1',
});

export const REGULATION_REF = Object.freeze({
  code: 'Regulation (EU) 2023/988',
  shortName: 'EU GPSR',
  retentionYears: 10,
  effectiveDate: '2024-12-13',
});
