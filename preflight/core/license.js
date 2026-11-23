/**
 * PaperPreflight Pro — Offline ECDSA P-256 & Optional Online License Engine
 *
 * Offline signed key format:
 *   PRE1.<base64url(payload)>.<base64url(ecdsa_p256_sha256_raw_sig)>
 *   where payload = "PRE1.pre.pro.<batch>.<serial>.<rand>"
 *
 * Works identically in Chrome MV3, standalone web browsers, and Node v22 via WebCrypto.
 */

import {
  LICENSE_PREFIX,
  LICENSE_PUBLIC_JWK,
  ONLINE_LICENSE_PROVIDERS,
  PRODUCT_ID,
  STORAGE_KEYS,
} from './config.js';

function getSubtle() {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('WebCrypto subtle API is unavailable in this environment.');
  }
  return subtle;
}

export function fromBase64Url(str) {
  if (typeof str !== 'string' || !str || !/^[A-Za-z0-9\-_]+$/.test(str)) {
    throw new Error('Invalid base64url characters');
  }
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

let cachedPublicKeyPromise = null;
let cachedPublicJwkStr = '';

async function importVerifyKey(jwk = LICENSE_PUBLIC_JWK) {
  const serialized = JSON.stringify(jwk);
  if (cachedPublicKeyPromise && cachedPublicJwkStr === serialized) {
    return cachedPublicKeyPromise;
  }
  const subtle = getSubtle();
  const promise = subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
  if (jwk === LICENSE_PUBLIC_JWK) {
    cachedPublicKeyPromise = promise;
    cachedPublicJwkStr = serialized;
  }
  return promise;
}

/**
 * Verify an offline ECDSA P-256 signed key (`PRE1.<payload>.<sig>`).
 */
export async function verifyOfflineLicenseKey(keyString, publicJwkOverride = null) {
  const trimmed = String(keyString || '').trim();
  if (!trimmed) {
    return { valid: false, reasonCode: 'EMPTY_KEY', reason: 'License key is empty' };
  }

  const parts = trimmed.split('.');
  if (parts.length !== 3) {
    return { valid: false, reasonCode: 'INVALID_FORMAT', reason: 'Invalid key format' };
  }

  const [prefix, payloadB64, sigB64] = parts;
  if (prefix !== LICENSE_PREFIX) {
    return {
      valid: false,
      reasonCode: 'PRODUCT_MISMATCH',
      reason: `Key prefix "${prefix}" does not match ${LICENSE_PREFIX}`,
    };
  }

  let payloadBytes;
  let sigBytes;
  try {
    payloadBytes = fromBase64Url(payloadB64);
    sigBytes = fromBase64Url(sigB64);
  } catch {
    return { valid: false, reasonCode: 'INVALID_FORMAT', reason: 'Malformed base64url encoding' };
  }

  if (sigBytes.length !== 64) {
    return { valid: false, reasonCode: 'INVALID_SIGNATURE', reason: 'Invalid signature length' };
  }

  try {
    const publicKey = await importVerifyKey(publicJwkOverride || LICENSE_PUBLIC_JWK);
    const subtle = getSubtle();
    const ok = await subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey,
      sigBytes,
      payloadBytes,
    );
    if (!ok) {
      return { valid: false, reasonCode: 'INVALID_SIGNATURE', reason: 'Invalid cryptographic signature' };
    }
  } catch {
    return { valid: false, reasonCode: 'INVALID_SIGNATURE', reason: 'Signature verification error' };
  }

  const decoded = new TextDecoder().decode(payloadBytes);
  const fields = decoded.split('.');
  const [pPrefix, prod, tier, batch, seq] = fields;
  if (pPrefix !== LICENSE_PREFIX || prod !== PRODUCT_ID || !tier || !seq) {
    return { valid: false, reasonCode: 'PAYLOAD_MISMATCH', reason: 'Payload product mismatch' };
  }

  return {
    valid: true,
    mode: 'offline',
    provider: 'offline-ecdsa',
    product: prod,
    tier,
    batch: batch || 'standard',
    serial: seq,
    key: trimmed,
  };
}

/**
 * Optional online license validation (Gumroad API v2 via product_id / Lemon Squeezy).
 */
export async function verifyOnlineLicenseKey(keyString, options = {}) {
  const trimmed = String(keyString || '').trim();
  const providers = options.providers || ONLINE_LICENSE_PROVIDERS;
  const fetchFn = options.fetchImpl || globalThis.fetch;

  if (!trimmed) {
    return { valid: false, reasonCode: 'EMPTY_KEY', reason: 'License key is empty' };
  }

  const gr = providers.gumroad;
  if (gr?.enabled && gr.productId && gr.productId !== 'REPLACE_GUMROAD_PRODUCT_ID') {
    try {
      const body = new URLSearchParams({
        product_id: gr.productId,
        license_key: trimmed,
        increment_uses_count: 'false',
      });
      const res = await fetchFn(gr.validateUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });
      const data = await res.json();
      if (data?.success && !data?.purchase?.refunded && !data?.purchase?.chargebacked) {
        return {
          valid: true,
          mode: 'online',
          provider: 'gumroad',
          product: PRODUCT_ID,
          tier: 'pro',
          batch: 'gumroad',
          serial: String(data?.purchase?.sale_id || trimmed.slice(0, 8)),
          key: trimmed,
        };
      }
      return {
        valid: false,
        reasonCode: 'ONLINE_VERIFICATION_FAILED',
        reason: data?.message || 'Gumroad rejected the license key',
      };
    } catch {
      return { valid: false, reasonCode: 'NETWORK_ERROR', reason: 'Network error validating Gumroad key' };
    }
  }

  const ls = providers.lemonSqueezy;
  if (ls?.enabled && ls.storeId) {
    try {
      const body = new URLSearchParams({ license_key: trimmed });
      const res = await fetchFn(ls.validateUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });
      const data = await res.json();
      const storeMatch = !ls.storeId || String(data?.meta?.store_id) === String(ls.storeId);
      const productMatch = !ls.productId || String(data?.meta?.product_id) === String(ls.productId);
      if (data?.valid && storeMatch && productMatch) {
        return {
          valid: true,
          mode: 'online',
          provider: 'lemonsqueezy',
          product: PRODUCT_ID,
          tier: 'pro',
          batch: 'lemonsqueezy',
          serial: String(data?.license_key?.id || trimmed.slice(0, 8)),
          key: trimmed,
        };
      }
      return {
        valid: false,
        reasonCode: 'ONLINE_VERIFICATION_FAILED',
        reason: data?.error || 'Lemon Squeezy rejected the license key',
      };
    } catch {
      return { valid: false, reasonCode: 'NETWORK_ERROR', reason: 'Network error validating Lemon Squeezy key' };
    }
  }

  return {
    valid: false,
    reasonCode: 'ONLINE_PROVIDER_NOT_CONFIGURED',
    reason: `Online license verification is disabled; enter an offline ${LICENSE_PREFIX}.* key`,
  };
}

/**
 * Unified license verification entry point.
 */
export async function verifyLicenseKey(keyString, options = {}) {
  const trimmed = String(keyString || '').trim();
  if (!trimmed) {
    return { valid: false, reasonCode: 'EMPTY_KEY', reason: 'License key is empty' };
  }

  if (/^[A-Z]+[0-9]+\./.test(trimmed)) {
    return verifyOfflineLicenseKey(trimmed, options.publicJwkOverride || null);
  }

  if (/^[A-Za-z0-9\-]{12,128}$/.test(trimmed)) {
    return verifyOnlineLicenseKey(trimmed, options);
  }

  return { valid: false, reasonCode: 'INVALID_FORMAT', reason: 'Unrecognized license key format' };
}

/* ---------- Cross-Environment Storage Helpers (Chrome MV3 / Web / Node) ---------- */

const memoryStorage = new Map();

export async function storageGet(key) {
  if (globalThis.chrome?.storage?.local) {
    const obj = await globalThis.chrome.storage.local.get(key);
    return obj?.[key] ?? null;
  }
  if (globalThis.localStorage) {
    const raw = globalThis.localStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return memoryStorage.get(key) ?? null;
}

export async function storageSet(key, value) {
  if (globalThis.chrome?.storage?.local) {
    await globalThis.chrome.storage.local.set({ [key]: value });
    return;
  }
  if (globalThis.localStorage) {
    globalThis.localStorage.setItem(key, JSON.stringify(value));
    return;
  }
  memoryStorage.set(key, value);
}

export async function storageRemove(key) {
  if (globalThis.chrome?.storage?.local) {
    await globalThis.chrome.storage.local.remove(key);
    return;
  }
  if (globalThis.localStorage) {
    globalThis.localStorage.removeItem(key);
    return;
  }
  memoryStorage.delete(key);
}

export async function loadStoredLicense(options = {}) {
  const saved = await storageGet(STORAGE_KEYS.license);
  if (!saved || !saved.key) return null;

  if (saved.mode === 'offline' || /^[A-Z]+[0-9]+\./.test(saved.key)) {
    const verified = await verifyOfflineLicenseKey(saved.key, options.publicJwkOverride || null);
    if (!verified.valid) {
      await storageRemove(STORAGE_KEYS.license);
      return null;
    }
    return { ...verified, activatedAt: saved.activatedAt || null };
  }

  if (saved.mode === 'online' && saved.valid) {
    return saved;
  }
  return null;
}

export async function saveStoredLicense(licenseResult) {
  if (!licenseResult?.valid) {
    throw new Error('Cannot save an invalid license');
  }
  const record = {
    valid: true,
    mode: licenseResult.mode,
    provider: licenseResult.provider || 'offline-ecdsa',
    product: licenseResult.product,
    tier: licenseResult.tier,
    batch: licenseResult.batch,
    serial: licenseResult.serial,
    key: licenseResult.key,
    activatedAt: new Date().toISOString(),
  };
  await storageSet(STORAGE_KEYS.license, record);
  return record;
}

export async function clearStoredLicense() {
  await storageRemove(STORAGE_KEYS.license);
}

export async function loadStoredLang() {
  const saved = await storageGet(STORAGE_KEYS.lang);
  return saved === 'en' || saved === 'zh' ? saved : null;
}

export async function saveStoredLang(lang) {
  if (lang === 'en' || lang === 'zh') {
    await storageSet(STORAGE_KEYS.lang, lang);
  }
}

export async function loadStoredBlocklist() {
  const saved = await storageGet(STORAGE_KEYS.blocklist);
  return Array.isArray(saved) ? saved.filter((s) => typeof s === 'string' && s.trim()) : null;
}

export async function saveStoredBlocklist(list) {
  if (Array.isArray(list)) {
    await storageSet(STORAGE_KEYS.blocklist, list);
  }
}
