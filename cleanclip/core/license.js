/**
 * CleanClip MD Pro — Offline ECDSA P-256 license verification + optional online
 * Lemon Squeezy / Gumroad validation + Pro feature gates.
 *
 * Uses standard WebCrypto (`globalThis.crypto.subtle`) so verification is 100%
 * identical in Chrome MV3 Extension, Playground browser page, and Node v22.
 */

import {
  ONLINE_LICENSE_CONFIG,
  PRODUCT_ID,
  PRODUCT_PREFIX,
  PUBLIC_LICENSE_JWK,
} from './config.js';

const STORAGE_KEY = 'cleanclip_pro_license_v1';
const TEXT_DECODER = new TextDecoder();

export const PRO_FEATURES = Object.freeze({
  batchZip: 'batchZip',
  customFrontmatter: 'customFrontmatter',
  byokSummary: 'byokSummary',
});

let cachedCryptoKey = null;
let memoryFallbackLicense = null;

function fromBase64Url(str) {
  if (typeof str !== 'string' || !/^[A-Za-z0-9_-]+$/.test(str)) {
    throw new Error('Invalid base64url characters');
  }
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  const binary = globalThis.atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getVerifyPublicKey(publicJwkOverride = null) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('WebCrypto subtle API is unavailable in this environment');
  }
  if (!publicJwkOverride && cachedCryptoKey) {
    return cachedCryptoKey;
  }
  const jwk = publicJwkOverride || PUBLIC_LICENSE_JWK;
  const imported = await subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  if (!publicJwkOverride) {
    cachedCryptoKey = imported;
  }
  return imported;
}

/**
 * Verify an offline ECDSA P-256 signed key (`CLIP1.<payload>.<sig>`).
 * Strictly compatible with `tools/keygen.mjs`.
 *
 * @param {string} keyString
 * @param {{ publicJwk?: JsonWebKey, expectedProduct?: string, expectedPrefix?: string }} [options]
 */
export async function verifyOfflineLicenseKey(keyString, options = {}) {
  const expectedProduct = options.expectedProduct || PRODUCT_ID;
  const expectedPrefix = options.expectedPrefix || PRODUCT_PREFIX;

  const trimmed = String(keyString || '').trim();
  if (!trimmed) {
    return { valid: false, reason: 'Empty license key' };
  }

  const parts = trimmed.split('.');
  if (parts.length !== 3) {
    return { valid: false, reason: 'Invalid key format (expected CLIP1.<payload>.<sig>)' };
  }

  const [prefix, payloadB64, sigB64] = parts;
  if (prefix !== expectedPrefix) {
    return { valid: false, reason: `Key does not match this product (expected ${expectedPrefix})` };
  }

  let payloadBytes;
  let sigBytes;
  try {
    payloadBytes = fromBase64Url(payloadB64);
    sigBytes = fromBase64Url(sigB64);
  } catch {
    return { valid: false, reason: 'Malformed base64url key encoding' };
  }

  if (sigBytes.length !== 64) {
    return { valid: false, reason: 'Invalid ECDSA P-256 signature length' };
  }

  let ok = false;
  try {
    const publicKey = await getVerifyPublicKey(options.publicJwk || null);
    ok = await globalThis.crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      sigBytes,
      payloadBytes,
    );
  } catch (err) {
    return { valid: false, reason: `Signature verification error: ${err.message}` };
  }

  if (!ok) {
    return { valid: false, reason: 'Invalid cryptographic signature' };
  }

  const decoded = TEXT_DECODER.decode(payloadBytes);
  const fields = decoded.split('.');
  const [pPrefix, prod, tier, batch, serial] = fields;
  if (pPrefix !== expectedPrefix || prod !== expectedProduct) {
    return { valid: false, reason: 'Payload product mismatch' };
  }

  return {
    valid: true,
    mode: 'offline',
    product: prod,
    tier: tier || 'pro',
    batch: batch || 'unknown',
    serial: serial || '0000',
    key: trimmed,
  };
}

/**
 * Optional online license validation for Lemon Squeezy or Gumroad.
 * Only called when explicitly configured/enabled by the store owner.
 */
export async function verifyOnlineLicenseKey(keyString, options = {}) {
  const trimmed = String(keyString || '').trim();
  const provider = options.provider || ONLINE_LICENSE_CONFIG.provider;
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  if (!trimmed) {
    return { valid: false, reason: 'Empty license key' };
  }
  if (typeof fetchImpl !== 'function') {
    return { valid: false, reason: 'Fetch API unavailable for online check' };
  }

  try {
    if (provider === 'gumroad') {
      const productId = options.gumroadProductId || ONLINE_LICENSE_CONFIG.gumroadProductId;
      const body = new URLSearchParams({
        product_id: productId,
        license_key: trimmed,
        increment_uses_count: 'false',
      });
      const resp = await fetchImpl(ONLINE_LICENSE_CONFIG.gumroadEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });
      const data = await resp.json();
      if (resp.ok && data?.success && !data?.purchase?.refunded && !data?.purchase?.chargebacked) {
        return {
          valid: true,
          mode: 'online-gumroad',
          product: PRODUCT_ID,
          tier: 'pro',
          batch: 'gumroad',
          serial: String(data.purchase?.sale_id || 'ONLINE').slice(0, 12),
          key: trimmed,
        };
      }
      return { valid: false, reason: data?.message || 'Gumroad license check failed' };
    }

    // Default online provider: Lemon Squeezy
    const body = new URLSearchParams({ license_key: trimmed });
    const resp = await fetchImpl(ONLINE_LICENSE_CONFIG.lemonSqueezyEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    const data = await resp.json();
    if (resp.ok && data?.valid) {
      return {
        valid: true,
        mode: 'online-lemonsqueezy',
        product: PRODUCT_ID,
        tier: 'pro',
        batch: 'lemonsqueezy',
        serial: String(data?.license_key?.id || 'ONLINE'),
        key: trimmed,
      };
    }
    return { valid: false, reason: data?.error || 'Lemon Squeezy license check failed' };
  } catch (err) {
    return { valid: false, reason: `Online verification failed: ${err.message}` };
  }
}

/**
 * Unified license verification entry point:
 *  - Keys starting with `CLIP1.` (or containing 2 dots) verify 100% offline.
 *  - Other keys fall back to online verification ONLY if enabled.
 */
export async function verifyLicenseKey(keyString, options = {}) {
  const trimmed = String(keyString || '').trim();
  if (!trimmed) {
    return { valid: false, reason: 'Please enter a license key' };
  }

  const onlineEnabled = options.onlineEnabled ?? ONLINE_LICENSE_CONFIG.enabled;
  if (trimmed.startsWith(`${PRODUCT_PREFIX}.`) || trimmed.split('.').length === 3) {
    const offline = await verifyOfflineLicenseKey(trimmed, options);
    if (offline.valid || !onlineEnabled) {
      return offline;
    }
  }

  if (onlineEnabled) {
    return verifyOnlineLicenseKey(trimmed, options);
  }

  return verifyOfflineLicenseKey(trimmed, options);
}

/**
 * Storage helpers supporting chrome.storage.local, browser localStorage, and Node memory.
 */
function hasChromeStorage() {
  return Boolean(globalThis.chrome?.storage?.local);
}

export async function loadLicenseState() {
  let stored = null;
  if (hasChromeStorage()) {
    const result = await globalThis.chrome.storage.local.get(STORAGE_KEY);
    stored = result?.[STORAGE_KEY] || null;
  } else if (typeof globalThis.localStorage !== 'undefined') {
    try {
      const raw = globalThis.localStorage.getItem(STORAGE_KEY);
      stored = raw ? JSON.parse(raw) : null;
    } catch {
      stored = null;
    }
  } else {
    stored = memoryFallbackLicense;
  }

  if (!stored || !stored.key) {
    return { isPro: false, status: 'free', details: null };
  }

  // Re-verify offline keys locally on load so tampering local storage never bypasses verification
  if (stored.mode === 'offline' || String(stored.key).startsWith(`${PRODUCT_PREFIX}.`)) {
    const verified = await verifyOfflineLicenseKey(stored.key);
    if (!verified.valid) {
      return { isPro: false, status: 'invalid', details: null };
    }
    return { isPro: true, status: 'pro', details: verified };
  }

  return { isPro: Boolean(stored.valid), status: stored.valid ? 'pro' : 'free', details: stored };
}

export async function activateLicenseKey(keyString, options = {}) {
  const verified = await verifyLicenseKey(keyString, options);
  if (!verified.valid) {
    return { isPro: false, ...verified };
  }

  const record = {
    ...verified,
    activatedAt: new Date().toISOString(),
  };

  if (hasChromeStorage()) {
    await globalThis.chrome.storage.local.set({ [STORAGE_KEY]: record });
  } else if (typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } else {
    memoryFallbackLicense = record;
  }

  return { isPro: true, status: 'pro', details: record, valid: true };
}

export async function clearLicenseState() {
  if (hasChromeStorage()) {
    await globalThis.chrome.storage.local.remove(STORAGE_KEY);
  } else if (typeof globalThis.localStorage !== 'undefined') {
    globalThis.localStorage.removeItem(STORAGE_KEY);
  } else {
    memoryFallbackLicense = null;
  }
  return { isPro: false, status: 'free', details: null };
}

/**
 * Check whether a feature is unlocked under the current license state.
 * @param {string} feature
 * @param {{ isPro?: boolean }} licenseState
 */
export function canUseFeature(feature, licenseState) {
  if (!Object.values(PRO_FEATURES).includes(feature)) {
    return true; // Free feature
  }
  return Boolean(licenseState?.isPro);
}
