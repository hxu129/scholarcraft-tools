/**
 * PromptShield Pro — Deterministic Reversible Token-Swapping Privacy Engine.
 *
 * 30 high-precision built-in Secret & PII detectors (ordered longest / most-specific
 * first via priority tiers) + Custom Entity Terms + Custom Regex Rules.
 *
 * Zero dependencies. Runs identically in Chrome MV3 Extension, browser, and Node v22.
 */

export const DETECTOR_CATEGORIES = Object.freeze({
  secrets: { id: 'secrets', labelZh: '密钥与连接串', labelEn: 'Secrets & URIs', risk: 'high' },
  api_keys: { id: 'api_keys', labelZh: '云/AI API Key', labelEn: 'Cloud / AI Keys', risk: 'high' },
  pii: { id: 'pii', labelZh: '个人/金融 PII', labelEn: 'Personal / Financial PII', risk: 'medium' },
  network: { id: 'network', labelZh: 'IP 与网络', labelEn: 'IP & Network', risk: 'low' },
  custom: { id: 'custom', labelZh: '自定义词/正则', labelEn: 'Custom Terms / Regex', risk: 'custom' },
});

const VALID_CN_PROVINCES = new Set([
  '11', '12', '13', '14', '15',
  '21', '22', '23',
  '31', '32', '33', '34', '35', '36', '37',
  '41', '42', '43', '44', '45', '46',
  '50', '51', '52', '53', '54',
  '61', '62', '63', '64', '65',
  '71', '81', '82',
]);

const CN_ID_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const CN_ID_CHECK_MAP = '10X98765432';

/**
 * Validate Mainland China 18-digit Resident Identity Card number
 * per GB 11643-1999 (province code + Gregorian calendar date + mod-11 checksum).
 * @param {string} id
 * @returns {boolean}
 */
export function isValidChineseId(id) {
  const s = String(id || '').trim().toUpperCase();
  if (!/^[1-8]\d{16}[\dX]$/.test(s)) return false;
  if (!VALID_CN_PROVINCES.has(s.slice(0, 2))) return false;

  const year = Number(s.slice(6, 10));
  const month = Number(s.slice(10, 12));
  const day = Number(s.slice(12, 14));
  if (year < 1900 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year
    || dt.getUTCMonth() !== month - 1
    || dt.getUTCDate() !== day
  ) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 17; i++) {
    sum += (s.charCodeAt(i) - 48) * CN_ID_WEIGHTS[i];
  }
  const expected = CN_ID_CHECK_MAP[sum % 11];
  return s[17] === expected;
}

/**
 * Standard Luhn (mod-10) checksum verification.
 * @param {string} input
 * @returns {boolean}
 */
export function isValidLuhn(input) {
  const digits = String(input || '').replace(/[\s-]+/g, '');
  if (!/^\d{13,19}$/.test(digits)) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

const CARD_IIN_PATTERNS = [
  /^4\d{12}(?:\d{3})?(?:\d{3})?$/, // Visa (13, 16, 19)
  /^(?:5[1-5]\d{14}|2(?:22[1-9]|2[3-9]\d|[3-6]\d{2}|7[01]\d|720)\d{12})$/, // Mastercard (16)
  /^3[47]\d{13}$/, // Amex (15)
  /^(?:6011\d{12}|65\d{14}|64[4-9]\d{13})$/, // Discover (16)
  /^62\d{14,17}$/, // UnionPay (16-19)
  /^35(?:2[89]|[3-8]\d)\d{12,15}$/, // JCB (16-19)
  /^3(?:0[0-5]|[689]\d)\d{11,13}$/, // Diners Club (14-16)
];

/**
 * Validate payment card candidate: consistent grouping, known card network IIN,
 * and valid Luhn checksum (eliminating false positives on arbitrary long numbers).
 * @param {string} candidate
 * @returns {boolean}
 */
export function isValidCreditCard(candidate) {
  const raw = String(candidate || '').trim();
  const hasDash = raw.includes('-');
  const hasSpace = raw.includes(' ');
  if (hasDash && hasSpace) return false;

  const digits = raw.replace(/[\s-]+/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  if (!CARD_IIN_PATTERNS.some((re) => re.test(digits))) return false;
  return isValidLuhn(digits);
}

/**
 * Validate IPv6 address (distinguishing real IPv6 from HH:MM:SS timestamps and MAC addresses).
 * @param {string} value
 * @returns {boolean}
 */
export function isValidIpv6(value) {
  const s = String(value || '').trim();
  if (!s.includes(':')) return false;
  const doubleColons = s.split('::');
  if (doubleColons.length > 2) return false;

  if (doubleColons.length === 1) {
    // Full uncompressed IPv6 MUST have exactly 8 1-4 hex groups
    const groups = s.split(':');
    return groups.length === 8 && groups.every((g) => /^[0-9A-Fa-f]{1,4}$/.test(g));
  }

  const left = doubleColons[0] ? doubleColons[0].split(':') : [];
  const right = doubleColons[1] ? doubleColons[1].split(':') : [];
  const all = [...left, ...right];
  if (all.length === 0 || all.length > 7) return false;
  if (!all.every((g) => /^[0-9A-Fa-f]{1,4}$/.test(g))) return false;
  // Require either at least 2 groups (e.g. fe80::1) or exact loopback ::1
  return all.length >= 2 || s === '::1';
}

const ENV_PLACEHOLDER_RE = /^(?:true|false|null|none|nil|undefined|empty|example|changeme|placeholder|redacted|masked|\*+|x+|your[_-].*|replace[_-].*|todo[_-].*|dummy[_-].*)$/i;

function isLikelyPlaceholderValue(val) {
  const s = String(val || '').trim();
  if (s.length < 6) return true;
  if (s.startsWith('$') || s.startsWith('${')) return true;
  if ((s.startsWith('<') && s.endsWith('>')) || (s.startsWith('[') && s.endsWith(']'))) return true;
  if (s.startsWith('{{') && s.endsWith('}}')) return true;
  if (/^(?:process\.env\.|os\.environ|env\.|import\.meta\.env\.)/i.test(s)) return true;
  if (s.endsWith('()')) return true;
  if (ENV_PLACEHOLDER_RE.test(s)) return true;
  return false;
}

/**
 * Built-in 30 high-precision Secret & PII detectors ordered by priority tier
 * (lower priority number wins on overlap; longer span breaks ties).
 */
export const BUILTIN_DETECTORS = Object.freeze([
  // Tier 0 (0-9): Multi-line blocks, URIs, and full webhook endpoints
  {
    id: 'private_key',
    category: 'secrets',
    tokenPrefix: 'PRIVATE_KEY',
    labelZh: 'PEM 私钥块',
    labelEn: 'PEM Private Key Block',
    priority: 1,
    regex: /-----BEGIN (?:[A-Z0-9 ]+ )?PRIVATE KEY-----[\s\S]{16,16000}?-----END (?:[A-Z0-9 ]+ )?PRIVATE KEY-----/gd,
  },
  {
    id: 'db_uri',
    category: 'secrets',
    tokenPrefix: 'DB_URI',
    labelZh: '含密码数据库连接串',
    labelEn: 'Database URI w/ Credentials',
    priority: 2,
    regex: /(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis|rediss|amqp|amqps|mssql|sqlserver):\/\/[^\s"'`<>@]+:[^\s"'`<>@]+@[^\s"'`<>]+/gid,
  },
  {
    id: 'webhook_url',
    category: 'secrets',
    tokenPrefix: 'WEBHOOK_URL',
    labelZh: 'Webhook 密钥链接 (Slack/Discord/飞书/钉钉)',
    labelEn: 'Webhook URL (Slack/Discord/Feishu/DingTalk)',
    priority: 3,
    regex: /https:\/\/(?:hooks\.slack\.com\/services\/T[A-Z0-9]{8,}\/B[A-Z0-9]{8,}\/[A-Za-z0-9]{16,}|(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d{16,22}\/[A-Za-z0-9_-]{32,}|open\.(?:feishu\.cn|larksuite\.com)\/open-apis\/bot\/v2\/hook\/[0-9a-f-]{20,}|oapi\.dingtalk\.com\/robot\/send\?access_token=[0-9a-f]{32,})/gd,
  },

  // Tier 1 (10-19): Cloud, AI, DevOps API keys & JWTs
  {
    id: 'anthropic_key',
    category: 'api_keys',
    tokenPrefix: 'ANTHROPIC_KEY',
    labelZh: 'Anthropic Claude API Key',
    labelEn: 'Anthropic Claude API Key',
    priority: 10,
    regex: /\bsk-ant-(?:api\d{2}|admin\d{2})-[A-Za-z0-9_-]{20,}\b/gd,
  },
  {
    id: 'openai_key',
    category: 'api_keys',
    tokenPrefix: 'OPENAI_KEY',
    labelZh: 'OpenAI API Key',
    labelEn: 'OpenAI API Key',
    priority: 11,
    regex: /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}\b/gd,
    validate: (val) => !val.startsWith('sk-ant-'),
  },
  {
    id: 'aws_access_key',
    category: 'api_keys',
    tokenPrefix: 'AWS_KEY',
    labelZh: 'AWS Access Key ID',
    labelEn: 'AWS Access Key ID',
    priority: 12,
    regex: /\b(?:AKIA|ASIA|AIDA|AROA|ANPA|ANVA|APKA)[0-9A-Z]{16}\b/gd,
  },
  {
    id: 'google_api_key',
    category: 'api_keys',
    tokenPrefix: 'GOOGLE_KEY',
    labelZh: 'Google / Gemini API Key',
    labelEn: 'Google / Gemini API Key',
    priority: 12,
    regex: /\bAIza[0-9A-Za-z_-]{35}\b/gd,
  },
  {
    id: 'github_token',
    category: 'api_keys',
    tokenPrefix: 'GITHUB_TOKEN',
    labelZh: 'GitHub PAT / OAuth Token',
    labelEn: 'GitHub PAT / OAuth Token',
    priority: 12,
    regex: /\b(?:(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/gd,
  },
  {
    id: 'stripe_key',
    category: 'api_keys',
    tokenPrefix: 'STRIPE_KEY',
    labelZh: 'Stripe API Key',
    labelEn: 'Stripe API Key',
    priority: 12,
    regex: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/gd,
  },
  {
    id: 'slack_token',
    category: 'api_keys',
    tokenPrefix: 'SLACK_TOKEN',
    labelZh: 'Slack Bot / User Token',
    labelEn: 'Slack Bot / User Token',
    priority: 12,
    regex: /\bxox(?:b|p|a|r|s)-[0-9A-Za-z-]{16,}\b/gd,
  },
  {
    id: 'huggingface_token',
    category: 'api_keys',
    tokenPrefix: 'HF_TOKEN',
    labelZh: 'Hugging Face Token',
    labelEn: 'Hugging Face Token',
    priority: 12,
    regex: /\bhf_[A-Za-z0-9]{20,}\b/gd,
  },
  {
    id: 'gitlab_token',
    category: 'api_keys',
    tokenPrefix: 'GITLAB_TOKEN',
    labelZh: 'GitLab Personal Access Token',
    labelEn: 'GitLab Personal Access Token',
    priority: 12,
    regex: /\bglpat-[A-Za-z0-9_-]{20,}\b/gd,
  },
  {
    id: 'npm_token',
    category: 'api_keys',
    tokenPrefix: 'NPM_TOKEN',
    labelZh: 'npm Access Token',
    labelEn: 'npm Access Token',
    priority: 12,
    regex: /\bnpm_[A-Za-z0-9]{30,}\b/gd,
  },
  {
    id: 'pypi_token',
    category: 'api_keys',
    tokenPrefix: 'PYPI_TOKEN',
    labelZh: 'PyPI API Token',
    labelEn: 'PyPI API Token',
    priority: 12,
    regex: /\bpypi-[A-Za-z0-9_-]{32,}\b/gd,
  },
  {
    id: 'sendgrid_key',
    category: 'api_keys',
    tokenPrefix: 'SENDGRID_KEY',
    labelZh: 'SendGrid API Key',
    labelEn: 'SendGrid API Key',
    priority: 12,
    regex: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{20,}\b/gd,
  },
  {
    id: 'twilio_key',
    category: 'api_keys',
    tokenPrefix: 'TWILIO_KEY',
    labelZh: 'Twilio Account SID / Key',
    labelEn: 'Twilio Account SID / Key',
    priority: 13,
    regex: /\b(?:AC|SK)[a-f0-9]{32}\b/gd,
  },
  {
    id: 'aliyun_key',
    category: 'api_keys',
    tokenPrefix: 'ALIYUN_KEY',
    labelZh: '阿里云 AccessKey ID',
    labelEn: 'Alibaba Cloud AccessKey ID',
    priority: 13,
    regex: /\bLTAI[A-Za-z0-9]{16,24}\b/gd,
  },
  {
    id: 'telegram_token',
    category: 'api_keys',
    tokenPrefix: 'TELEGRAM_TOKEN',
    labelZh: 'Telegram Bot Token',
    labelEn: 'Telegram Bot Token',
    priority: 14,
    regex: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/gd,
  },
  {
    id: 'jwt_token',
    category: 'secrets',
    tokenPrefix: 'JWT',
    labelZh: 'JWT 三段式令牌',
    labelEn: 'JWT 3-Segment Token',
    priority: 15,
    regex: /\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{16,}\b/gd,
  },

  // Tier 2 (20-29): Generic context-aware auth / .env secrets (value-only redaction)
  {
    id: 'bearer_token',
    category: 'secrets',
    tokenPrefix: 'BEARER_TOKEN',
    labelZh: 'Bearer 授权令牌',
    labelEn: 'Generic Bearer Token',
    priority: 22,
    valueGroups: [1],
    regex: /\bBearer[ \t]+([A-Za-z0-9._~+/=-]{20,})(?=\s|["'`,;)\]}]|$)/gd,
    validate: (val) => !isLikelyPlaceholderValue(val),
  },
  {
    id: 'env_secret',
    category: 'secrets',
    tokenPrefix: 'SECRET',
    labelZh: '.env / 配置密钥与密码',
    labelEn: '.env / Config Secret Value',
    priority: 25,
    valueGroups: [1, 2, 3],
    regex: /(?:^|[\r\n,;{\s])(?:export[ \t]+)?["']?[A-Za-z][A-Za-z0-9_.-]{0,60}(?:SECRET|PASSWORD|PASSWD|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY|AUTH_?TOKEN|ACCESS_?TOKEN|REFRESH_?TOKEN|CLIENT_?SECRET|SIGNING_?KEY|SIGNING_?SECRET|WEBHOOK_?SECRET|ENCRYPTION_?KEY|APP_?KEY|MASTER_?KEY|TOKEN|CREDENTIAL|PWD)["']?[ \t]*[=:][ \t]*(?:"([^"\r\n]{6,256})"|'([^'\r\n]{6,256})'|([^\s"'`,;{}[\]#]{6,256}))/gid,
    validate: (val) => !isLikelyPlaceholderValue(val),
  },

  // Tier 3 (30-39): High-precision structured PII (checksum-verified where applicable)
  {
    id: 'email',
    category: 'pii',
    tokenPrefix: 'EMAIL',
    labelZh: '电子邮箱地址',
    labelEn: 'Email Address',
    priority: 30,
    regex: /(?<![A-Za-z0-9._%+-])([A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+)(?![A-Za-z0-9-])/gd,
    valueGroups: [1],
  },
  {
    id: 'cn_resident_id',
    category: 'pii',
    tokenPrefix: 'CN_ID',
    labelZh: '中国18位居民身份证号 (GB 11643 校验)',
    labelEn: 'Chinese 18-Digit Resident ID (GB 11643)',
    priority: 31,
    regex: /(?<![0-9A-Za-z])([1-8]\d{5}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx])(?![0-9A-Za-z])/gd,
    valueGroups: [1],
    validate: (val) => isValidChineseId(val),
  },
  {
    id: 'credit_card',
    category: 'pii',
    tokenPrefix: 'CREDIT_CARD',
    labelZh: '银行卡 / 信用卡号 (Luhn 校验)',
    labelEn: 'Credit / Debit Card (Luhn Verified)',
    priority: 33,
    regex: /(?<![0-9A-Za-z-])((?:\d{4}[- ]){3}\d{4}(?:[- ]\d{3})?|\d{4}[- ]\d{6}[- ]\d{5}|\d{13,19})(?![0-9A-Za-z-])/gd,
    valueGroups: [1],
    validate: (val) => isValidCreditCard(val),
  },
  {
    id: 'us_ssn',
    category: 'pii',
    tokenPrefix: 'US_SSN',
    labelZh: '美国社会安全号 (SSN)',
    labelEn: 'US Social Security Number (SSN)',
    priority: 34,
    regex: /(?<![0-9A-Za-z-])((?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4})(?![0-9A-Za-z-])/gd,
    valueGroups: [1],
  },

  // Tier 4 (40-49): Reserved for Custom Regex & Custom Entity Terms

  // Tier 5 (50-59): Phone Numbers & Network Identifiers
  {
    id: 'cn_phone',
    category: 'pii',
    tokenPrefix: 'PHONE_CN',
    labelZh: '中国大陆手机号',
    labelEn: 'Mainland China Mobile Number',
    priority: 50,
    regex: /(?<![0-9A-Za-z.])((?:\+?86[\s-]?)?1[3-9]\d(?:[\s-]?\d{4}){2})(?![0-9A-Za-z.])/gd,
    valueGroups: [1],
    validate: (val) => {
      const stripped = val.replace(/[\s-]+/g, '').replace(/^\+?86/, '');
      return /^1[3-9]\d{9}$/.test(stripped);
    },
  },
  {
    id: 'intl_phone',
    category: 'pii',
    tokenPrefix: 'PHONE_INTL',
    labelZh: '国际 / 北美电话号码',
    labelEn: 'International / US Phone Number',
    priority: 52,
    regex: /(?<![0-9A-Za-z.])(\+(?:[1-9]\d{0,2})[\s.-](?:\(\d{1,4}\)[\s.-]?)?\d{2,4}(?:[\s.-]\d{2,4}){1,3}|(?:\+?1[\s.-])?\(\d{3}\)[\s.-]?\d{3}[\s.-]\d{4}|\+?1[\s.-]\d{3}[\s.-]\d{3}[\s.-]\d{4})(?![0-9A-Za-z.])/gd,
    valueGroups: [1],
    validate: (val) => {
      const digits = val.replace(/\D/g, '');
      if (digits.length < 8 || digits.length > 15) return false;
      if (/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return false;
      return true;
    },
  },
  {
    id: 'ipv4',
    category: 'network',
    tokenPrefix: 'IP',
    labelZh: 'IPv4 地址',
    labelEn: 'IPv4 Address',
    priority: 54,
    regex: /(?<![0-9A-Za-z.])((?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d))(?![0-9A-Za-z.])/gd,
    valueGroups: [1],
  },
  {
    id: 'ipv6',
    category: 'network',
    tokenPrefix: 'IPV6',
    labelZh: 'IPv6 地址',
    labelEn: 'IPv6 Address',
    priority: 55,
    regex: /(?<![0-9A-Za-z:])((?:[0-9A-Fa-f]{1,4}:){2,7}[0-9A-Fa-f]{1,4}|(?:[0-9A-Fa-f]{1,4}:){1,7}:|:(?::[0-9A-Fa-f]{1,4}){1,7}|(?:[0-9A-Fa-f]{1,4}:){1,6}:[0-9A-Fa-f]{1,4}|(?:[0-9A-Fa-f]{1,4}:){1,5}(?::[0-9A-Fa-f]{1,4}){1,2}|(?:[0-9A-Fa-f]{1,4}:){1,4}(?::[0-9A-Fa-f]{1,4}){1,3}|(?:[0-9A-Fa-f]{1,4}:){1,3}(?::[0-9A-Fa-f]{1,4}){1,4}|(?:[0-9A-Fa-f]{1,4}:){1,2}(?::[0-9A-Fa-f]{1,4}){1,5}|[0-9A-Fa-f]{1,4}:(?::[0-9A-Fa-f]{1,4}){1,6})(?![0-9A-Za-z:])/gd,
    valueGroups: [1],
    validate: (val) => isValidIpv6(val),
  },
  {
    id: 'mac_address',
    category: 'network',
    tokenPrefix: 'MAC',
    labelZh: 'MAC 硬件地址',
    labelEn: 'MAC Address',
    priority: 56,
    regex: /(?<![0-9A-Za-z:-])((?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2})(?![0-9A-Za-z:-])/gd,
    valueGroups: [1],
    validate: (val) => !(val.includes(':') && val.includes('-')),
  },
]);

/**
 * Normalize a user-provided placeholder prefix into safe uppercase identifier form.
 * @param {string} raw
 * @param {string} [fallback]
 * @returns {string}
 */
export function normalizeTokenPrefix(raw, fallback = 'CUSTOM') {
  const cleaned = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28);
  if (!cleaned || !/^[A-Z]/.test(cleaned)) {
    return cleaned ? `X_${cleaned}`.slice(0, 28) : fallback;
  }
  return cleaned;
}

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Validate a user-supplied custom regex pattern for syntax and basic ReDoS safety.
 * @param {string} pattern
 * @param {string} [flags]
 * @returns {{ valid: boolean, regex?: RegExp, error?: string }}
 */
export function validateCustomRegex(pattern, flags = 'g') {
  const src = String(pattern || '').trim();
  if (!src) {
    return { valid: false, error: 'Pattern cannot be empty' };
  }
  if (src.length > 250) {
    return { valid: false, error: 'Pattern exceeds 250 characters' };
  }
  // Reject obvious nested-quantifier ReDoS patterns such as (a+)+, (.+)*, (\w+){2,}
  if (/\([^)]*[+*][^)]*\)[+*{]/.test(src)) {
    return { valid: false, error: 'Nested quantifiers are disallowed for safety' };
  }
  const safeFlags = Array.from(new Set([...String(flags || '').replace(/[^gimsu]/g, ''), 'g', 'd'])).join('');
  try {
    const compiled = new RegExp(src, safeFlags);
    compiled.lastIndex = 0;
    const emptyTest = compiled.exec('');
    if (emptyTest && emptyTest[0] === '') {
      return { valid: false, error: 'Pattern must not match empty strings' };
    }
    compiled.lastIndex = 0;
    return { valid: true, regex: compiled };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

/**
 * Create or clone a deterministic reversible session vault.
 * Accepts either an existing full vault or a plain `{ '[TOKEN_1]': 'real' }` map.
 * @param {object | null} [existingMap]
 */
export function createVault(existingMap = null) {
  const now = new Date().toISOString();
  const vault = {
    version: 1,
    createdAt: now,
    updatedAt: now,
    tokenToEntry: {},
    valueToToken: {},
    counters: {},
  };

  if (!existingMap || typeof existingMap !== 'object') {
    return vault;
  }

  if (existingMap.tokenToEntry && typeof existingMap.tokenToEntry === 'object') {
    vault.createdAt = existingMap.createdAt || now;
    vault.updatedAt = existingMap.updatedAt || now;
    for (const [token, entry] of Object.entries(existingMap.tokenToEntry)) {
      if (!entry || typeof entry.value !== 'string') continue;
      vault.tokenToEntry[token] = { ...entry };
      vault.valueToToken[entry.value] = token;
      const prefix = entry.tokenPrefix || extractPrefixFromToken(token);
      const num = extractNumberFromToken(token);
      if (prefix && num > (vault.counters[prefix] || 0)) {
        vault.counters[prefix] = num;
      }
    }
    if (existingMap.counters && typeof existingMap.counters === 'object') {
      for (const [k, v] of Object.entries(existingMap.counters)) {
        const n = Number(v) || 0;
        if (n > (vault.counters[k] || 0)) {
          vault.counters[k] = n;
        }
      }
    }
    return vault;
  }

  // Plain dictionary compatibility: { '[EMAIL_1]': 'alice@example.com' }
  for (const [token, rawVal] of Object.entries(existingMap)) {
    if (typeof rawVal !== 'string') continue;
    const prefix = extractPrefixFromToken(token) || 'TOKEN';
    const num = extractNumberFromToken(token);
    vault.tokenToEntry[token] = {
      value: rawVal,
      ruleId: 'imported',
      category: 'custom',
      tokenPrefix: prefix,
      count: 1,
    };
    vault.valueToToken[rawVal] = token;
    if (num > (vault.counters[prefix] || 0)) {
      vault.counters[prefix] = num;
    }
  }
  return vault;
}

function extractPrefixFromToken(token) {
  const m = /^\[([A-Z][A-Z0-9_]*)_(\d+)\]$/.exec(String(token || ''));
  return m ? m[1] : null;
}

function extractNumberFromToken(token) {
  const m = /^\[([A-Z][A-Z0-9_]*)_(\d+)\]$/.exec(String(token || ''));
  return m ? Number(m[2]) : 0;
}

/**
 * Allocate or retrieve the deterministic placeholder for an exact raw value.
 */
export function registerVaultValue(vault, rawValue, meta = {}) {
  const existingToken = vault.valueToToken[rawValue];
  if (existingToken && vault.tokenToEntry[existingToken]) {
    vault.tokenToEntry[existingToken].count = (vault.tokenToEntry[existingToken].count || 0) + 1;
    vault.updatedAt = new Date().toISOString();
    return existingToken;
  }

  const prefix = normalizeTokenPrefix(meta.tokenPrefix, 'SECRET');
  let nextNum = (vault.counters[prefix] || 0) + 1;
  let token = `[${prefix}_${nextNum}]`;
  while (vault.tokenToEntry[token]) {
    nextNum++;
    token = `[${prefix}_${nextNum}]`;
  }
  vault.counters[prefix] = nextNum;
  vault.valueToToken[rawValue] = token;
  vault.tokenToEntry[token] = {
    value: rawValue,
    ruleId: meta.ruleId || 'custom',
    category: meta.category || 'custom',
    tokenPrefix: prefix,
    count: 1,
  };
  vault.updatedAt = new Date().toISOString();
  return token;
}

function collectRegexSpans(text, detector) {
  const spans = [];
  const flags = detector.regex.flags.includes('d')
    ? detector.regex.flags
    : `${detector.regex.flags}d`;
  const re = new RegExp(detector.regex.source, flags);
  let match;

  while ((match = re.exec(text)) !== null) {
    if (match[0].length === 0) {
      re.lastIndex++;
      continue;
    }

    let start = match.index;
    let end = match.index + match[0].length;
    let rawValue = match[0];

    if (Array.isArray(detector.valueGroups) && detector.valueGroups.length > 0) {
      let foundGroup = false;
      for (const grp of detector.valueGroups) {
        if (match[grp] !== undefined && match[grp] !== '') {
          rawValue = match[grp];
          if (match.indices && match.indices[grp]) {
            [start, end] = match.indices[grp];
          } else {
            const rel = match[0].lastIndexOf(rawValue);
            start = match.index + Math.max(0, rel);
            end = start + rawValue.length;
          }
          foundGroup = true;
          break;
        }
      }
      if (!foundGroup) continue;
    }

    if (typeof detector.validate === 'function' && !detector.validate(rawValue, match, text)) {
      continue;
    }

    spans.push({
      start,
      end,
      rawValue,
      ruleId: detector.id,
      category: detector.category,
      tokenPrefix: detector.tokenPrefix,
      labelZh: detector.labelZh || detector.id,
      labelEn: detector.labelEn || detector.id,
      priority: detector.priority,
    });
  }

  return spans;
}

function collectCustomTermSpans(text, customTerms) {
  const spans = [];
  if (!Array.isArray(customTerms)) return spans;

  for (let i = 0; i < customTerms.length; i++) {
    const item = customTerms[i];
    if (!item || item.enabled === false) continue;
    const term = String(item.term || '').trim();
    if (!term) continue;

    const escaped = escapeRegExp(term);
    const isAsciiEdge = /^[A-Za-z0-9]/.test(term) && /[A-Za-z0-9]$/.test(term);
    const useBoundary = item.wholeWord !== false && isAsciiEdge;
    const pattern = useBoundary
      ? `(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`
      : escaped;
    const flags = item.caseSensitive ? 'gd' : 'gid';
    const re = new RegExp(pattern, flags);
    const prefix = normalizeTokenPrefix(item.tokenPrefix || item.label || 'CUSTOM', 'CUSTOM');

    let match;
    while ((match = re.exec(text)) !== null) {
      if (match[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        rawValue: match[0],
        ruleId: `custom_term_${item.id || i}`,
        category: 'custom',
        tokenPrefix: prefix,
        labelZh: `自定义词 (${prefix})`,
        labelEn: `Custom Term (${prefix})`,
        priority: 41,
      });
    }
  }
  return spans;
}

function collectCustomRegexSpans(text, customRegexes) {
  const spans = [];
  if (!Array.isArray(customRegexes)) return spans;

  for (let i = 0; i < customRegexes.length; i++) {
    const item = customRegexes[i];
    if (!item || item.enabled === false) continue;
    const checked = validateCustomRegex(item.pattern, item.flags || 'g');
    if (!checked.valid || !checked.regex) continue;

    const prefix = normalizeTokenPrefix(item.tokenPrefix || item.label || 'CUSTOM', 'CUSTOM');
    const re = checked.regex;
    let match;
    while ((match = re.exec(text)) !== null) {
      if (match[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        rawValue: match[0],
        ruleId: `custom_regex_${item.id || i}`,
        category: 'custom',
        tokenPrefix: prefix,
        labelZh: item.name || `自定义正则 (${prefix})`,
        labelEn: item.name || `Custom Regex (${prefix})`,
        priority: 40,
      });
    }
  }
  return spans;
}

/**
 * Resolve overlapping candidate spans cleanly:
 * lower priority number wins; longer span breaks ties; earlier start breaks ties.
 */
function resolveOverlappingSpans(candidates) {
  if (candidates.length === 0) return [];

  const sorted = [...candidates].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    const lenDiff = (b.end - b.start) - (a.end - a.start);
    if (lenDiff !== 0) return lenDiff;
    return a.start - b.start;
  });

  const accepted = [];
  for (const span of sorted) {
    let overlaps = false;
    for (const kept of accepted) {
      if (span.start < kept.end && span.end > kept.start) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) {
      accepted.push(span);
    }
  }

  accepted.sort((a, b) => a.start - b.start);
  return accepted;
}

/**
 * Deterministically redact secrets, PII, and custom entities into reversible placeholders.
 *
 * @param {string} text
 * @param {{
 *   enabledCategories?: Record<string, boolean>,
 *   disabledRuleIds?: string[] | Set<string>,
 *   customTerms?: Array<{ id?: string, term: string, tokenPrefix?: string, label?: string, caseSensitive?: boolean, wholeWord?: boolean, enabled?: boolean }>,
 *   customRegexes?: Array<{ id?: string, name?: string, pattern: string, flags?: string, tokenPrefix?: string, enabled?: boolean }>,
 *   mutateVault?: boolean,
 * }} [options]
 * @param {object | null} [existingMap]
 */
export function redact(text, options = {}, existingMap = null) {
  const input = String(text ?? '');
  const vault = options.mutateVault && existingMap?.tokenToEntry
    ? existingMap
    : createVault(existingMap);

  const enabledCategories = {
    secrets: true,
    api_keys: true,
    pii: true,
    network: true,
    custom: true,
    ...(options.enabledCategories || {}),
  };

  const disabledRuleSet = options.disabledRuleIds instanceof Set
    ? options.disabledRuleIds
    : new Set(Array.isArray(options.disabledRuleIds) ? options.disabledRuleIds : []);

  const candidates = [];

  for (const detector of BUILTIN_DETECTORS) {
    if (!enabledCategories[detector.category]) continue;
    if (disabledRuleSet.has(detector.id)) continue;
    const hits = collectRegexSpans(input, detector);
    for (const h of hits) candidates.push(h);
  }

  if (enabledCategories.custom) {
    if (Array.isArray(options.customRegexes) && options.customRegexes.length > 0) {
      for (const h of collectCustomRegexSpans(input, options.customRegexes)) {
        candidates.push(h);
      }
    }
    if (Array.isArray(options.customTerms) && options.customTerms.length > 0) {
      for (const h of collectCustomTermSpans(input, options.customTerms)) {
        candidates.push(h);
      }
    }
  }

  const resolved = resolveOverlappingSpans(candidates);

  const statsByCategory = {
    secrets: 0,
    api_keys: 0,
    pii: 0,
    network: 0,
    custom: 0,
  };
  const statsByRule = {};
  const uniqueTokensInText = new Set();
  const findings = [];
  const segments = [];
  const parts = [];

  let cursor = 0;
  let redactedOffset = 0;

  for (const span of resolved) {
    if (span.start > cursor) {
      const plainChunk = input.slice(cursor, span.start);
      parts.push(plainChunk);
      segments.push({ type: 'text', text: plainChunk });
      redactedOffset += plainChunk.length;
    }

    const placeholder = registerVaultValue(vault, span.rawValue, {
      ruleId: span.ruleId,
      category: span.category,
      tokenPrefix: span.tokenPrefix,
    });

    parts.push(placeholder);
    const redactedStart = redactedOffset;
    redactedOffset += placeholder.length;

    statsByCategory[span.category] = (statsByCategory[span.category] || 0) + 1;
    statsByRule[span.ruleId] = (statsByRule[span.ruleId] || 0) + 1;
    uniqueTokensInText.add(placeholder);

    findings.push({
      start: span.start,
      end: span.end,
      redactedStart,
      redactedEnd: redactedOffset,
      placeholder,
      rawValue: span.rawValue,
      ruleId: span.ruleId,
      category: span.category,
      tokenPrefix: span.tokenPrefix,
      labelZh: span.labelZh,
      labelEn: span.labelEn,
    });

    segments.push({
      type: 'token',
      text: placeholder,
      placeholder,
      rawValue: span.rawValue,
      ruleId: span.ruleId,
      category: span.category,
      labelZh: span.labelZh,
      labelEn: span.labelEn,
    });

    cursor = span.end;
  }

  if (cursor < input.length) {
    const tail = input.slice(cursor);
    parts.push(tail);
    segments.push({ type: 'text', text: tail });
  }

  return {
    redactedText: parts.join(''),
    mapping: vault,
    statsByCategory,
    statsByRule,
    totalHits: findings.length,
    uniqueCount: uniqueTokensInText.size,
    findings,
    segments,
  };
}

const GENERIC_PLACEHOLDER_RE = /\[[A-Z][A-Z0-9_]{1,36}_\d+\]/g;

/**
 * Losslessly swap PromptShield placeholders in an AI response back to real local values.
 * Uses a single-pass replacement so restored values containing bracketed text are NEVER
 * re-substituted in a second pass.
 *
 * @param {string} aiResponseText
 * @param {object | null} mapping
 */
export function restore(aiResponseText, mapping) {
  const input = String(aiResponseText ?? '');
  const vault = createVault(mapping);
  const tokenMap = vault.tokenToEntry;
  const knownTokens = Object.keys(tokenMap);

  const restoredByToken = {};
  const unresolvedSet = new Set();
  const segments = [];
  let restoredCount = 0;

  // Single-pass scan for both known tokens AND any unknown placeholder-like tokens
  const knownSet = new Set(knownTokens);
  const patternParts = [
    ...knownTokens
      .slice()
      .sort((a, b) => b.length - a.length)
      .map(escapeRegExp),
    GENERIC_PLACEHOLDER_RE.source,
  ];
  const combinedRe = new RegExp(patternParts.join('|'), 'g');

  const out = [];
  let cursor = 0;
  let match;

  while ((match = combinedRe.exec(input)) !== null) {
    const token = match[0];
    if (match.index > cursor) {
      const plain = input.slice(cursor, match.index);
      out.push(plain);
      segments.push({ type: 'text', text: plain });
    }

    if (knownSet.has(token)) {
      const entry = tokenMap[token];
      out.push(entry.value);
      restoredCount++;
      restoredByToken[token] = (restoredByToken[token] || 0) + 1;
      segments.push({
        type: 'restored',
        text: entry.value,
        placeholder: token,
        category: entry.category || 'custom',
      });
    } else {
      out.push(token);
      unresolvedSet.add(token);
      segments.push({
        type: 'unresolved',
        text: token,
        placeholder: token,
      });
    }

    cursor = match.index + token.length;
  }

  if (cursor < input.length) {
    const tail = input.slice(cursor);
    out.push(tail);
    segments.push({ type: 'text', text: tail });
  }

  return {
    restoredText: out.join(''),
    restoredCount,
    restoredByToken,
    unresolvedTokens: Array.from(unresolvedSet),
    segments,
  };
}

/**
 * Mask a secret value for safe display in UI vault tables (e.g., `sk-p...OpQr`).
 * @param {string} value
 * @returns {string}
 */
export function maskPreviewValue(value) {
  const s = String(value ?? '');
  if (s.includes('\n')) {
    const firstLine = s.split('\n')[0].trim();
    return `${firstLine.slice(0, 26)} … [${s.length} chars]`;
  }
  if (s.length <= 6) return '•'.repeat(Math.max(4, s.length));
  if (s.length <= 12) return `${s.slice(0, 2)}${'•'.repeat(s.length - 4)}${s.slice(-2)}`;
  return `${s.slice(0, 4)}••••${s.slice(-4)}`;
}
