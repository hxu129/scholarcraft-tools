/**
 * CleanClip MD Pro — Product configuration, embedded ECDSA P-256 public key,
 * storefront links, and frontmatter presets.
 */

export const APP_NAME = 'CleanClip MD Pro';
export const APP_VERSION = '1.0.0';
export const PRODUCT_ID = 'clip';
export const PRODUCT_PREFIX = 'CLIP1';

/**
 * Embedded ECDSA P-256 Public JWK for 100% offline license signature verification.
 * Private signing key is NEVER shipped with the extension.
 */
export const PUBLIC_LICENSE_JWK = Object.freeze({
  key_ops: ['verify'],
  ext: true,
  kty: 'EC',
  x: 'NSDoxkI-j1zCkjRzvhy60DwyY3hKkDSrAYgXF29AkZc',
  y: 'wwyr0VnMv7C69dmMcjlYktPR-P0JgDEc0gv6s2FagVE',
  crv: 'P-256',
});

/**
 * Storefront placeholders — replace with your live checkout URLs before listing.
 */
export const STOREFRONT_LINKS = Object.freeze({
  mianbaoduo: 'https://mbd.pub/o/bread/YZaWmJ5uZA==',
  gumroad: 'https://hxucreativity28.gumroad.com/l/cleanclip-md-pro',
  lemonSqueezy: 'https://hxucreativity28.gumroad.com/l/cleanclip-md-pro',
  supportEmail: 'hxucreativity28@gmail.com',
});

/**
 * Optional online license validation (Gumroad enabled for automatic buyer license keys;
 * offline ECDSA P-256 CLIP1.* keys always verify 100% locally with zero network calls).
 */
export const ONLINE_LICENSE_CONFIG = Object.freeze({
  enabled: true,
  provider: 'gumroad', // 'lemonsqueezy' | 'gumroad'
  lemonSqueezyEndpoint: 'https://api.lemonsqueezy.com/v1/licenses/validate',
  gumroadEndpoint: 'https://api.gumroad.com/v2/licenses/verify',
  gumroadProductId: 'LQmbpJf1keQG0dWjBPTu9w==',
});

export const DEFAULT_CUSTOM_TEMPLATE = `---
title: {{title_yaml}}
source: {{source_yaml}}
author: {{author_yaml}}
site: {{site_yaml}}
clipped_at: {{clipped_at_yaml}}
date: {{date}}
estimated_tokens: {{estimated_tokens}}
tags:
{{tags_yaml}}
---

# {{title}}

{{summary_callout}}{{content}}`;

export const DEFAULT_BYOK_SETTINGS = Object.freeze({
  enabled: false,
  provider: 'openai', // 'openai' | 'gemini'
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  geminiModel: 'gemini-2.5-flash',
  apiKey: '',
});

export const CONTEXT_WINDOWS = Object.freeze({
  k128: 128000,
  k200: 200000,
});
