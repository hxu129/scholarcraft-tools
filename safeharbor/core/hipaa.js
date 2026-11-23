/**
 * SafeHarbor Studio Pro — HIPAA Safe Harbor (45 CFR § 164.514(b)(2) & § 164.514(c))
 * 18-Identifier Auto-Classification, De-Identification, Pseudonymization & Free-Text Scrubber.
 *
 * 100% pure zero-dependency ES module compatible with modern browsers and Node v22+.
 */

import {
  DEFAULT_DATE_SHIFT_RANGE,
  FREE_MAX_EXPORT_ROWS,
  HIPAA_IDENTIFIERS,
  RESTRICTED_ZIP3_SET,
} from './config.js';
import { parseDelimited, serializeDelimited } from './csv.js';

export const RULE_ACTIONS = Object.freeze({
  DROP: 'drop',
  ZIP3: 'zip3',
  DATE_YEAR_ONLY: 'date_year_only',
  DATE_SHIFT: 'date_shift',
  AGE_CAP: 'age_cap',
  PSEUDONYMIZE: 'pseudonymize',
  SCRUB_TEXT: 'scrub_text',
  KEEP: 'keep',
});

export const VALID_ACTIONS = new Set(Object.values(RULE_ACTIONS));

const HIPAA_BY_CODE = Object.freeze(
  Object.fromEntries(HIPAA_IDENTIFIERS.map((item) => [item.code, item])),
);

const NULL_TOKENS = new Set(['', 'na', 'n/a', 'null', 'none', 'nan', '-', '.', 'missing', 'unknown']);

function isNullishCell(value) {
  const s = String(value ?? '').trim();
  return NULL_TOKENS.has(s.toLowerCase());
}

/**
 * Deterministic 32-bit FNV-1a + Murmur3 finalizer hash (exact cross-language parity with cli/safeharbor.py).
 */
export function deterministicHash32(input) {
  const bytes = new TextEncoder().encode(String(input ?? ''));
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // Murmur3 fmix32 avalanche
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Compute deterministic non-zero per-subject date offset in [-range, -1] U [+1, +range].
 */
export function computeSubjectShiftDays(subjectKey, salt = 'safeharbor-study-2026', rangeDays = DEFAULT_DATE_SHIFT_RANGE) {
  const r = Math.max(1, Math.min(3650, Math.floor(Number(rangeDays) || DEFAULT_DATE_SHIFT_RANGE)));
  const h = deterministicHash32(`${salt}|${subjectKey}`);
  const slot = h % (2 * r);
  return slot < r ? slot - r : (slot - r) + 1;
}

/* ---------- Date Parsing & Transformation ---------- */

const MONTH_MAP = Object.freeze({
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
});

function isValidYMD(year, month, day) {
  if (year < 1850 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/**
 * Parse common clinical/EHR date strings into `{ year, month, day, yearOnly }`, or `null`.
 */
export function parseClinicalDate(raw) {
  const str = String(raw ?? '').trim();
  if (!str || isNullishCell(str)) return null;

  // 1. ISO YYYY-MM-DD or YYYY/MM/DD (with optional time)
  let m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[T\s].*)?$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (isValidYMD(y, mo, d)) return { year: y, month: mo, day: d, yearOnly: false };
  }

  // 2. US MM/DD/YYYY or MM-DD-YYYY (fallback DD/MM/YYYY if first > 12)
  m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s.*)?$/);
  if (m) {
    const p1 = Number(m[1]);
    const p2 = Number(m[2]);
    const y = Number(m[3]);
    if (p1 >= 1 && p1 <= 12 && isValidYMD(y, p1, p2)) {
      return { year: y, month: p1, day: p2, yearOnly: false };
    }
    if (p1 > 12 && p2 >= 1 && p2 <= 12 && isValidYMD(y, p2, p1)) {
      return { year: y, month: p2, day: p1, yearOnly: false };
    }
  }

  // 3. DD-Mon-YYYY or DD Mon YYYY (e.g., 15-Mar-2024)
  m = str.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})\.?[-\s](\d{4})$/);
  if (m) {
    const d = Number(m[1]);
    const mo = MONTH_MAP[m[2].toLowerCase()];
    const y = Number(m[3]);
    if (mo && isValidYMD(y, mo, d)) return { year: y, month: mo, day: d, yearOnly: false };
  }

  // 4. Mon DD, YYYY or Month DD YYYY (e.g., May 1, 2024)
  m = str.match(/^([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mo = MONTH_MAP[m[1].toLowerCase()];
    const d = Number(m[2]);
    const y = Number(m[3]);
    if (mo && isValidYMD(y, mo, d)) return { year: y, month: mo, day: d, yearOnly: false };
  }

  // 5. Pure 4-digit year (e.g., 1933 or 2024)
  m = str.match(/^(\d{4})$/);
  if (m) {
    const y = Number(m[1]);
    if (y >= 1850 && y <= 2200) return { year: y, month: null, day: null, yearOnly: true };
  }

  return null;
}

export function formatUtcDateISO(utcMs) {
  const d = new Date(utcMs);
  const y = String(d.getUTCFullYear()).padStart(4, '0');
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Transform a date cell under either `date_year_only` or `date_shift` (consistent per-subject offset).
 * Enforces HIPAA 45 CFR § 164.514(b)(2)(i)(C) birth-year > 89 censoring when `isBirthColumn` is true.
 */
export function transformDateCell(raw, options = {}) {
  const str = String(raw ?? '').trim();
  if (!str || isNullishCell(str)) {
    return { value: String(raw ?? ''), transformed: false, birthYearOver89Capped: false };
  }

  const mode = options.mode || RULE_ACTIONS.DATE_YEAR_ONLY;
  const isBirthColumn = Boolean(options.isBirthColumn);
  const referenceYear = Number(options.referenceYear) || new Date().getFullYear();
  const offsetDays = Number(options.offsetDays) || 0;

  const parsed = parseClinicalDate(str);
  if (!parsed) {
    // Fallback: extract any 4-digit year if present, otherwise redact unknown non-empty date format
    const yearMatch = str.match(/\b(19\d{2}|20\d{2}|21\d{2})\b/);
    if (yearMatch) {
      const y = Number(yearMatch[1]);
      if (isBirthColumn && (referenceYear - y) > 89) {
        return { value: '90+', transformed: true, birthYearOver89Capped: true };
      }
      return { value: String(y), transformed: String(y) !== str, birthYearOver89Capped: false };
    }
    return { value: '[REDACTED_DATE]', transformed: true, birthYearOver89Capped: false };
  }

  // Birth dates/years indicating age > 89 must have even the year suppressed under 45 CFR § 164.514(b)(2)(i)(C)
  if (isBirthColumn && (referenceYear - parsed.year) > 89) {
    return { value: '90+', transformed: true, birthYearOver89Capped: true };
  }

  if (mode === RULE_ACTIONS.DATE_SHIFT && !parsed.yearOnly && parsed.month && parsed.day) {
    const baseMs = Date.UTC(parsed.year, parsed.month - 1, parsed.day);
    const shifted = formatUtcDateISO(baseMs + offsetDays * 86400000);
    return {
      value: shifted,
      transformed: shifted !== str,
      birthYearOver89Capped: false,
      offsetDays,
    };
  }

  const yearStr = String(parsed.year);
  return {
    value: yearStr,
    transformed: yearStr !== str,
    birthYearOver89Capped: false,
  };
}

/* ---------- ZIP Code 3-Digit Generalization + Exact 17 Restricted Prefixes ---------- */

/**
 * Generalize US ZIP code per 45 CFR § 164.514(b)(2)(i)(B):
 * - First 3 digits retained for standard US ZIPs (e.g., 94107 -> 941, 94107-1234 -> 941)
 * - Exact 17 HHS/OCR low-population prefixes -> "000" (e.g., 03601 -> 000, 82190 -> 000)
 * - Unparseable non-empty postal codes -> "000" (fail-closed)
 */
export function transformZipCell(raw) {
  const str = String(raw ?? '').trim();
  if (!str || isNullishCell(str)) {
    return { value: String(raw ?? ''), transformed: false, isRestricted: false, prefix3: null };
  }

  let prefix3 = null;
  if (/^\d{5}(?:[-\s]?\d{4})?$/.test(str)) {
    prefix3 = str.slice(0, 3);
  } else if (/^\d{4}$/.test(str)) {
    // Handle Excel-stripped leading zero (e.g., 3601 -> 03601 -> 036 -> 000)
    prefix3 = `0${str}`.slice(0, 3);
  } else if (/^\d{3}$/.test(str)) {
    prefix3 = str;
  }

  if (!prefix3) {
    return {
      value: '000',
      transformed: str !== '000',
      isRestricted: true,
      unparseableRedacted: true,
      prefix3: null,
    };
  }

  if (RESTRICTED_ZIP3_SET.has(prefix3)) {
    return {
      value: '000',
      transformed: str !== '000',
      isRestricted: true,
      prefix3,
    };
  }

  return {
    value: prefix3,
    transformed: str !== prefix3,
    isRestricted: false,
    prefix3,
  };
}

/* ---------- Age > 89 Capping ---------- */

/**
 * Cap ages > 89 to "90+" per 45 CFR § 164.514(b)(2)(i)(C).
 * Also handles birth_year columns when `isBirthYear` is true.
 */
export function transformAgeCell(raw, options = {}) {
  const str = String(raw ?? '').trim();
  if (!str || isNullishCell(str)) {
    return { value: String(raw ?? ''), transformed: false, capped: false };
  }

  if (/^(?:90\+|>\s*89|>=\s*90|90\s*\+)$/i.test(str)) {
    return { value: '90+', transformed: str !== '90+', capped: true };
  }

  const m = str.match(/^(\d+(?:\.\d+)?)\s*(?:y|yr|yrs|years?|yo|y\/o)?$/i);
  if (!m) {
    return { value: String(raw ?? ''), transformed: false, capped: false };
  }

  const num = Number(m[1]);
  const referenceYear = Number(options.referenceYear) || new Date().getFullYear();

  if (options.isBirthYear && num >= 1850 && num <= referenceYear) {
    if ((referenceYear - num) > 89) {
      return { value: '90+', transformed: true, capped: true, birthYearOver89Capped: true };
    }
    return { value: String(Math.floor(num)), transformed: false, capped: false };
  }

  if (num > 89) {
    return { value: '90+', transformed: true, capped: true };
  }

  return { value: String(raw ?? ''), transformed: false, capped: false };
}

/* ---------- Free-Text Clinical Notes Scrubber ---------- */

const SCRUB_PATTERNS = [
  {
    type: 'URL',
    hipaaCode: 'N',
    regex: /\b(?:https?:\/\/[^\s,;)"'<>]+|www\.[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+(?:\/[^\s,;)"'<>]*)?)/gi,
    token: '[REDACTED_URL]',
  },
  {
    type: 'EMAIL',
    hipaaCode: 'F',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    token: '[REDACTED_EMAIL]',
  },
  {
    type: 'SSN',
    hipaaCode: 'G',
    regex: /\b(?:SSN[:#\s-]*)?\d{3}-\d{2}-\d{4}\b/gi,
    token: '[REDACTED_SSN]',
  },
  {
    type: 'MRN',
    hipaaCode: 'H',
    regex: /\b(?:MRN|Med(?:ical)?\s*Rec(?:ord)?(?:\s*No\.?|\s*#)?|Chart(?:\s*No\.?|\s*#)?|Patient\s*ID|Pat\s*ID)[:#\s-]*[A-Za-z0-9][A-Za-z0-9-]{3,}\b/gi,
    token: '[REDACTED_MRN]',
  },
  {
    type: 'DATE',
    hipaaCode: 'C',
    regex: /\b(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}[-\s](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?[-\s]\d{4})\b/gi,
    token: '[REDACTED_DATE]',
  },
  {
    type: 'IP',
    hipaaCode: 'O',
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g,
    token: '[REDACTED_IP]',
  },
  {
    type: 'PHONE',
    hipaaCode: 'D',
    regex: /(?<!\w)(?:\+?1[-.\s]?)?(?:\(\d{3}\)[-.\s]?|\d{3}[-.\s])\d{3}[-.\s]\d{4}\b/g,
    token: '[REDACTED_PHONE]',
  },
  {
    type: 'ADDRESS',
    hipaaCode: 'B',
    regex: /\b\d{1,5}\s+(?:[NSEW]\.?\s+)?(?:[A-Z0-9][a-zA-Z0-9'-]*\s+){1,3}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Ct|Court|Way|Pl|Place|Pkwy|Parkway|Plaza|Cir|Circle)\.?(?!\w)/g,
    token: '[REDACTED_ADDRESS]',
  },
  {
    type: 'NAME',
    hipaaCode: 'A',
    regex: /\b(?:(?:Dr|Mr|Mrs|Ms|Miss|Prof)\.?\s+[A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)?|Patient\s+[A-Z][a-zA-Z'-]+\s+[A-Z][a-zA-Z'-]+)\b/g,
    token: '[REDACTED_NAME]',
  },
];

/**
 * Scrub inline PHI patterns from free-text clinical notes and return per-type redaction counts.
 */
export function scrubFreeText(raw) {
  const original = String(raw ?? '');
  if (!original.trim()) {
    return { value: original, transformed: false, totalRedactions: 0, countsByType: {}, countsByHipaa: {} };
  }

  let current = original;
  let totalRedactions = 0;
  const countsByType = {};
  const countsByHipaa = {};

  for (const rule of SCRUB_PATTERNS) {
    rule.regex.lastIndex = 0;
    current = current.replace(rule.regex, (match) => {
      // Avoid double-redacting already inserted [REDACTED_*] tokens
      if (match.includes('[REDACTED_')) return match;
      totalRedactions += 1;
      countsByType[rule.type] = (countsByType[rule.type] || 0) + 1;
      countsByHipaa[rule.hipaaCode] = (countsByHipaa[rule.hipaaCode] || 0) + 1;
      return rule.token;
    });
  }

  return {
    value: current,
    transformed: current !== original,
    totalRedactions,
    countsByType,
    countsByHipaa,
  };
}

/* ---------- 18-Identifier Header & Cell Content Classifier ---------- */

function normalizeHeader(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

const SAFE_CLINICAL_HEADERS = new Set([
  'state', 'us_state', 'state_code', 'sex', 'gender', 'race', 'ethnicity',
  'diagnosis', 'diagnosis_code', 'diagnosis_icd10', 'icd10', 'icd9', 'icd_code',
  'systolic_bp', 'diastolic_bp', 'bp', 'heart_rate', 'hr', 'bmi', 'weight', 'height',
  'hba1c', 'hba1c_pct', 'glucose', 'creatinine', 'egfr', 'cholesterol', 'ldl', 'hdl',
  'treatment', 'treatment_arm', 'arm', 'group', 'cohort', 'outcome', 'outcome_30d',
  'mortality', 'survival_days', 'los_days', 'stage', 'grade', 'tumor_stage', 'biomarker',
]);

const HEADER_RULES = [
  // (H) MRN / Patient ID -> Pseudonymize
  {
    code: 'H',
    action: RULE_ACTIONS.PSEUDONYMIZE,
    regex: /^(?:mrn|medical_record|medical_record_num(?:ber)?|med_rec(?:_no|_num)?|patient_id|pat_id|subject_id|chart_no|chart_num(?:ber)?|ehr_id|empi|hospital_id|person_id|participant_id|encounter_id)$|(?:^|_)(?:mrn|patient_id|pat_id|chart_no|chart_number|medical_record)(?:$|_)/,
    reason: 'Medical record / subject identifier (45 CFR § 164.514(b)(2)(i)(H) & § 164.514(c))',
  },
  // (A) Names -> Drop
  {
    code: 'A',
    action: RULE_ACTIONS.DROP,
    regex: /^(?:name|full_name|patient_name|first_name|last_name|middle_name|given_name|family_name|surname|fname|lname|provider|provider_name|doctor|doctor_name|physician|attending|clinician|nurse|contact_name|next_of_kin|emergency_contact|guardian|spouse_name)$|(?:^|_)(?:patient_name|first_name|last_name|full_name|provider_name|doctor_name|physician_name|surname)(?:$|_)/,
    reason: 'Direct individual or provider name (45 CFR § 164.514(b)(2)(i)(A))',
  },
  // (B) ZIP Code -> 3-Digit + 17-Prefix Check
  {
    code: 'B',
    action: RULE_ACTIONS.ZIP3,
    regex: /^(?:zip|zipcode|zip_code|zip5|zip9|postal|postal_code|postcode|patient_zip)$|(?:^|_)(?:zip|zipcode|zip_code|postal_code)(?:$|_)/,
    reason: 'US ZIP code requiring 3-digit generalization & 17 restricted prefix check (45 CFR § 164.514(b)(2)(i)(B))',
  },
  // (B) Sub-state Geographic Addresses -> Drop
  {
    code: 'B',
    action: RULE_ACTIONS.DROP,
    regex: /^(?:address|street|street_address|home_address|mailing_address|addr|addr1|addr2|address_line_?1|address_line_?2|city|town|county|parish|precinct|census_tract|block_group|geocode|latitude|longitude|lat|lon|lng|apt|apartment|residence)$|(?:^|_)(?:street_address|home_address|mailing_address|city|county|precinct|geocode)(?:$|_)/,
    reason: 'Geographic subdivision smaller than a State (45 CFR § 164.514(b)(2)(i)(B))',
  },
  // (C) Birth Dates -> Year Only / Shift + >89 Birth-Year Censoring
  {
    code: 'C',
    action: RULE_ACTIONS.DATE_YEAR_ONLY,
    isBirthColumn: true,
    regex: /^(?:dob|date_of_birth|birth_date|birthdate|bday|patient_dob)$|(?:^|_)(?:dob|birth_date|date_of_birth)(?:$|_)/,
    reason: 'Date of birth; requires year-only/shift + >89 suppression (45 CFR § 164.514(b)(2)(i)(C))',
  },
  // (C) Birth Year -> Age Cap >89
  {
    code: 'C',
    action: RULE_ACTIONS.AGE_CAP,
    isBirthColumn: true,
    isBirthYear: true,
    regex: /^(?:birth_year|yob|year_of_birth)$/,
    reason: 'Birth year; must suppress years indicating age > 89 (45 CFR § 164.514(b)(2)(i)(C))',
  },
  // (C) Clinical Dates -> Year Only (or Consistent Shift in Pro)
  {
    code: 'C',
    action: RULE_ACTIONS.DATE_YEAR_ONLY,
    regex: /^(?:date|admit_date|admission_date|discharge_date|visit_date|encounter_date|death_date|dod|date_of_death|onset_date|diag_date|diagnosis_date|surgery_date|procedure_date|lab_date|specimen_date|collection_date|followup_date|follow_up_date|enroll_date|enrollment_date|index_date|service_date|timestamp)$|(?:^|_)(?:date|admit_dt|discharge_dt|visit_dt|death_dt|dob|dod)(?:$|_)/,
    reason: 'Directly related individual date (45 CFR § 164.514(b)(2)(i)(C))',
  },
  // (C) Ages -> Cap >89 to 90+
  {
    code: 'C',
    action: RULE_ACTIONS.AGE_CAP,
    regex: /^(?:age|age_yrs|age_years|patient_age|age_at_diagnosis|age_at_visit|age_at_admit|age_at_admission|age_at_enroll|age_at_enrollment|age_at_onset|age_at_death)$|(?:^|_)age(?:$|_yrs|_years|_at_)/,
    reason: 'Individual age; ages > 89 must be aggregated into 90+ (45 CFR § 164.514(b)(2)(i)(C))',
  },
  // (D) Telephone Numbers -> Drop
  {
    code: 'D',
    action: RULE_ACTIONS.DROP,
    regex: /^(?:phone|phone_num(?:ber)?|tel|telephone|mobile|mobile_phone|cell|cell_phone|home_phone|work_phone|day_phone|contact_phone|phone_no)$|(?:^|_)(?:phone|telephone|mobile_num|cell_num)(?:$|_)/,
    reason: 'Telephone number (45 CFR § 164.514(b)(2)(i)(D))',
  },
  // (E) Fax Numbers -> Drop
  {
    code: 'E',
    action: RULE_ACTIONS.DROP,
    regex: /^(?:fax|fax_num(?:ber)?|fax_no|facsimile)$|(?:^|_)fax(?:$|_)/,
    reason: 'Fax number (45 CFR § 164.514(b)(2)(i)(E))',
  },
  // (F) Email Addresses -> Drop
  {
    code: 'F',
    action: RULE_ACTIONS.DROP,
    regex: /^(?:email|e_mail|email_address|patient_email|contact_email|mail_addr)$|(?:^|_)(?:email|e_mail)(?:$|_)/,
    reason: 'Electronic mail address (45 CFR § 164.514(b)(2)(i)(F))',
  },
  // (G) SSN -> Drop
  {
    code: 'G',
    action: RULE_ACTIONS.DROP,
    regex: /^(?:ssn|social_security|social_security_num(?:ber)?|soc_sec|ss_num|ss_no)$|(?:^|_)(?:ssn|social_security)(?:$|_)/,
    reason: 'Social Security Number (45 CFR § 164.514(b)(2)(i)(G))',
  },
  // (I) Health Plan Beneficiary Numbers -> Drop
  {
    code: 'I',
    action: RULE_ACTIONS.DROP,
    regex: /^(?:beneficiary|beneficiary_id|beneficiary_num(?:ber)?|member_id|insurance_id|insurance_num(?:ber)?|health_plan_id|medicare_id|medicaid_id|subscriber_id|policy_number|policy_no|payer_id|mbi|hicn)$|(?:^|_)(?:beneficiary|insurance_id|medicare|medicaid|subscriber_id|member_id)(?:$|_)/,
    reason: 'Health plan beneficiary number (45 CFR § 164.514(b)(2)(i)(I))',
  },
  // (J) Account Numbers -> Drop
  {
    code: 'J',
    action: RULE_ACTIONS.DROP,
    regex: /^(?:account|acct|account_no|account_num(?:ber)?|acct_no|acct_num|billing_id|billing_account|invoice_id|guarantor_id|fin|financial_number)$|(?:^|_)(?:account_num|account_no|billing_account|guarantor_id)(?:$|_)/,
    reason: 'Account / billing number (45 CFR § 164.514(b)(2)(i)(J))',
  },
  // (K) Certificate / License Numbers -> Drop
  {
    code: 'K',
    action: RULE_ACTIONS.DROP,
    regex: /^(?:license|license_no|license_num(?:ber)?|driver_license|drivers_license|dl_no|dl_num(?:ber)?|certificate_no|cert_num(?:ber)?|passport|passport_no|npi|dea_number|dea_no)$|(?:^|_)(?:driver_license|drivers_license|license_no|license_num|certificate_no|passport)(?:$|_)/,
    reason: 'Certificate or license number (45 CFR § 164.514(b)(2)(i)(K))',
  },
  // (L) Vehicle Identifiers / VIN / Plates -> Drop
  {
    code: 'L',
    action: RULE_ACTIONS.DROP,
    regex: /^(?:vin|vehicle_id|vehicle_serial|license_plate|plate_no|plate_num(?:ber)?|car_plate|tag_number)$|(?:^|_)(?:vin|license_plate|vehicle_id)(?:$|_)/,
    reason: 'Vehicle identifier or license plate (45 CFR § 164.514(b)(2)(i)(L))',
  },
  // (M) Device Identifiers / Serial Numbers / UDIs -> Drop
  {
    code: 'M',
    action: RULE_ACTIONS.DROP,
    regex: /^(?:device_id|device_serial|device_sn|udi|implant_serial|pacemaker_serial|serial_no|serial_num(?:ber)?|sensor_serial|pump_serial)$|(?:^|_)(?:device_serial|device_id|udi|implant_serial|serial_number|serial_no)(?:$|_)/,
    reason: 'Medical device identifier or serial number (45 CFR § 164.514(b)(2)(i)(M))',
  },
  // (N) Web URLs -> Drop
  {
    code: 'N',
    action: RULE_ACTIONS.DROP,
    regex: /^(?:url|web_url|website|webpage|homepage|portal_url|patient_portal|link|profile_url)$|(?:^|_)(?:url|website|portal_url)(?:$|_)/,
    reason: 'Web Universal Resource Locator (45 CFR § 164.514(b)(2)(i)(N))',
  },
  // (O) IP Addresses -> Drop
  {
    code: 'O',
    action: RULE_ACTIONS.DROP,
    regex: /^(?:ip|ip_addr|ip_address|ipv4|ipv6|client_ip|remote_ip|remote_addr|source_ip)$|(?:^|_)(?:ip_address|ip_addr|ipv4|ipv6)(?:$|_)/,
    reason: 'Internet Protocol (IP) address (45 CFR § 164.514(b)(2)(i)(O))',
  },
  // (P) Biometric Identifiers -> Drop
  {
    code: 'P',
    action: RULE_ACTIONS.DROP,
    regex: /^(?:biometric|biometric_id|fingerprint|voiceprint|voice_print|retina_scan|iris_scan|facial_template)$|(?:^|_)(?:biometric|fingerprint|voiceprint|retina|iris_scan)(?:$|_)/,
    reason: 'Biometric identifier (45 CFR § 164.514(b)(2)(i)(P))',
  },
  // (Q) Full-Face Photos & Comparable Images -> Drop
  {
    code: 'Q',
    action: RULE_ACTIONS.DROP,
    regex: /^(?:photo|face_photo|photo_url|photo_path|headshot|portrait|patient_photo|facial_image|avatar_url)$|(?:^|_)(?:face_photo|patient_photo|headshot|portrait)(?:$|_)/,
    reason: 'Full-face photographic or comparable image (45 CFR § 164.514(b)(2)(i)(Q))',
  },
  // (R) Other Unique Identifying Codes -> Drop
  {
    code: 'R',
    action: RULE_ACTIONS.DROP,
    regex: /^(?:other_id|unique_id|national_id|nid|badge_no|employee_id|student_id|case_number|citizen_id|tax_id|tin)$|(?:^|_)(?:national_id|unique_id|employee_id|tax_id)(?:$|_)/,
    reason: 'Other unique identifying number or code (45 CFR § 164.514(b)(2)(i)(R))',
  },
  // Free-Text Clinical Notes -> Scrub Free Text
  {
    code: 'FREE_TEXT',
    action: RULE_ACTIONS.SCRUB_TEXT,
    regex: /^(?:note|notes|clinical_note|clinical_notes|progress_note|progress_notes|comment|comments|narrative|free_text|discharge_summary|summary|hpi|impression|remarks|assessment|history|plan_notes|physician_notes|nursing_notes)$|(?:^|_)(?:clinical_notes?|progress_notes?|discharge_summary|comments?|narrative|free_text)(?:$|_)/,
    reason: 'Free-text clinical narrative scanned for inline PHI patterns',
  },
];

const CONTENT_RE_EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const CONTENT_RE_SSN = /^(?:SSN[:#\s-]*)?\d{3}-\d{2}-\d{4}$/i;
const CONTENT_RE_URL = /^(?:https?:\/\/\S+|www\.\S+)$/i;
const CONTENT_RE_IP = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const CONTENT_RE_PHONE = /^(?:\+?1[-.\s]?)?(?:\(\d{3}\)[-.\s]?|\d{3}[-.\s])\d{3}[-.\s]\d{4}$/;
const CONTENT_RE_ZIP = /^\d{5}(?:-\d{4})?$/;

function classifyColumnByContent(header, sampleValues) {
  const nonEmpty = sampleValues.map((v) => String(v ?? '').trim()).filter((v) => !isNullishCell(v));
  if (nonEmpty.length === 0) return null;

  const n = nonEmpty.length;
  let emailHits = 0;
  let ssnHits = 0;
  let urlHits = 0;
  let ipHits = 0;
  let phoneHits = 0;
  let fullDateHits = 0;
  let zipHits = 0;
  let inlinePhiFreeTextHits = 0;
  let multiWordTextCount = 0;

  for (const val of nonEmpty) {
    if (CONTENT_RE_EMAIL.test(val)) emailHits += 1;
    if (CONTENT_RE_SSN.test(val)) ssnHits += 1;
    if (CONTENT_RE_URL.test(val)) urlHits += 1;
    if (CONTENT_RE_IP.test(val)) ipHits += 1;
    if (CONTENT_RE_PHONE.test(val)) phoneHits += 1;
    const parsedDate = parseClinicalDate(val);
    if (parsedDate && !parsedDate.yearOnly) fullDateHits += 1;
    if (CONTENT_RE_ZIP.test(val)) zipHits += 1;
    if (val.length >= 24 && val.includes(' ')) {
      multiWordTextCount += 1;
      const probe = scrubFreeText(val);
      if (probe.totalRedactions > 0) inlinePhiFreeTextHits += 1;
    }
  }

  if (emailHits / n >= 0.4) {
    return { code: 'F', action: RULE_ACTIONS.DROP, source: 'content', reason: `Cell content scan detected email addresses (${emailHits}/${n} cells)` };
  }
  if (ssnHits / n >= 0.4) {
    return { code: 'G', action: RULE_ACTIONS.DROP, source: 'content', reason: `Cell content scan detected SSN patterns (${ssnHits}/${n} cells)` };
  }
  if (urlHits / n >= 0.4) {
    return { code: 'N', action: RULE_ACTIONS.DROP, source: 'content', reason: `Cell content scan detected web URLs (${urlHits}/${n} cells)` };
  }
  if (ipHits / n >= 0.4) {
    return { code: 'O', action: RULE_ACTIONS.DROP, source: 'content', reason: `Cell content scan detected IP addresses (${ipHits}/${n} cells)` };
  }
  if (phoneHits / n >= 0.4) {
    return { code: 'D', action: RULE_ACTIONS.DROP, source: 'content', reason: `Cell content scan detected telephone numbers (${phoneHits}/${n} cells)` };
  }
  if (fullDateHits / n >= 0.5) {
    return { code: 'C', action: RULE_ACTIONS.DATE_YEAR_ONLY, source: 'content', reason: `Cell content scan detected full dates (${fullDateHits}/${n} cells)` };
  }
  const normHeader = normalizeHeader(header);
  if (zipHits / n >= 0.6 && !/(?:icd|cpt|code|count|score|id$|num$|bp|lab|dose)/.test(normHeader)) {
    return { code: 'B', action: RULE_ACTIONS.ZIP3, source: 'content', reason: `Cell content scan detected US 5/9-digit ZIP codes (${zipHits}/${n} cells)` };
  }
  if (inlinePhiFreeTextHits > 0 && multiWordTextCount > 0) {
    return { code: 'FREE_TEXT', action: RULE_ACTIONS.SCRUB_TEXT, source: 'content', reason: `Cell content scan detected inline PHI in free text (${inlinePhiFreeTextHits}/${n} cells)` };
  }
  return null;
}

/**
 * Auto-classify every column across all 18 HIPAA Safe Harbor Identifiers using
 * BOTH header semantics and sampled cell content.
 */
export function classifyColumns(headers, rows, options = {}) {
  const sampleLimit = Math.min(rows.length, options.sampleLimit || 400);
  const dateMode = options.dateMode === 'consistent_shift' ? RULE_ACTIONS.DATE_SHIFT : RULE_ACTIONS.DATE_YEAR_ONLY;

  return headers.map((header, index) => {
    const norm = normalizeHeader(header);
    const sampleValues = [];
    for (let r = 0; r < sampleLimit; r++) {
      sampleValues.push(rows[r]?.[index] ?? '');
    }

    // 1. Header rule check
    let match = null;
    for (const rule of HEADER_RULES) {
      if (rule.regex.test(norm)) {
        match = {
          code: rule.code,
          action: rule.action,
          source: 'header',
          reason: rule.reason,
          isBirthColumn: Boolean(rule.isBirthColumn),
          isBirthYear: Boolean(rule.isBirthYear),
        };
        break;
      }
    }

    // 2. Content scan fallback (also guards against PHI hidden inside generic or safe-named columns)
    const contentMatch = classifyColumnByContent(header, sampleValues);
    if (!match && contentMatch) {
      match = {
        ...contentMatch,
        isBirthColumn: /birth|dob/.test(norm),
        isBirthYear: /birth_year|yob/.test(norm),
      };
    } else if (match && contentMatch && match.code === 'FREE_TEXT') {
      match.reason = `${match.reason}; ${contentMatch.reason}`;
    }

    // 3. Explicit Safe Harbor State check or safe clinical variable
    if (!match) {
      const isState = norm === 'state' || norm === 'us_state' || norm === 'state_code';
      match = {
        code: 'SAFE',
        action: RULE_ACTIONS.KEEP,
        source: isState || SAFE_CLINICAL_HEADERS.has(norm) ? 'safe_clinical' : 'none',
        reason: isState
          ? 'State-level geography permitted under 45 CFR § 164.514(b)(2)(i)(B)'
          : 'No HIPAA Safe Harbor identifier detected',
        isBirthColumn: false,
        isBirthYear: false,
      };
    }

    // Apply requested global date mode to detected date columns
    let recommendedAction = match.action;
    if (recommendedAction === RULE_ACTIONS.DATE_YEAR_ONLY && dateMode === RULE_ACTIONS.DATE_SHIFT) {
      recommendedAction = RULE_ACTIONS.DATE_SHIFT;
    }

    const hipaaMeta = HIPAA_BY_CODE[match.code] || null;

    return {
      index,
      name: header,
      normalizedName: norm,
      hipaaCode: match.code,
      hipaaId: hipaaMeta?.id || (match.code === 'FREE_TEXT' ? 'free_text' : 'safe'),
      hipaaCitation: hipaaMeta?.cfr || (match.code === 'FREE_TEXT' ? '45 CFR § 164.514(b)(2) (Inline PHI)' : 'N/A (Non-PHI)'),
      hipaaLabelEn: hipaaMeta?.labelEn || (match.code === 'FREE_TEXT' ? 'Free-Text Clinical Narrative' : 'Safe Clinical Variable'),
      hipaaLabelZh: hipaaMeta?.labelZh || (match.code === 'FREE_TEXT' ? '自由文本临床记录' : '安全临床变量'),
      detectionSource: match.source,
      reason: match.reason,
      isBirthColumn: Boolean(match.isBirthColumn),
      isBirthYear: Boolean(match.isBirthYear),
      detectedAction: recommendedAction,
    };
  });
}

/* ---------- Full De-Identification Pipeline ---------- */

/**
 * Execute full HIPAA Safe Harbor de-identification on parsed tabular data (or raw CSV/TSV string).
 */
export function deidentifyDataset(input, options = {}) {
  const parsed = typeof input === 'string'
    ? parseDelimited(input, { delimiter: options.delimiter })
    : input;

  const headers = parsed?.headers || [];
  const rows = parsed?.rows || [];
  const delimiter = parsed?.delimiter || ',';
  const format = parsed?.format || (delimiter === '\t' ? 'tsv' : 'csv');

  const isPro = Boolean(options.isPro);
  const requestedDateMode = options.dateMode === 'consistent_shift' ? 'consistent_shift' : 'year_only';
  const effectiveDateMode = requestedDateMode === 'consistent_shift' && isPro
    ? 'consistent_shift'
    : 'year_only';
  const dateShiftDowngradedByTier = requestedDateMode === 'consistent_shift' && !isPro;

  const shiftRangeDays = Math.max(1, Math.min(3650, Math.floor(Number(options.shiftRangeDays) || DEFAULT_DATE_SHIFT_RANGE)));
  const studySalt = String(options.studySalt || 'safeharbor-study-2026');
  const referenceYear = Number(options.referenceYear) || new Date().getFullYear();
  const columnOverrides = options.columnOverrides || {};
  const maxExportRows = Number.isFinite(options.maxRows)
    ? options.maxRows
    : (isPro ? Infinity : FREE_MAX_EXPORT_ROWS);

  const baseClassifications = classifyColumns(headers, rows, {
    dateMode: effectiveDateMode,
  });

  // Resolve applied action for each column (respecting user overrides + Free/Pro gate on date_shift)
  let anyColumnShiftDowngraded = dateShiftDowngradedByTier;
  const columns = baseClassifications.map((col) => {
    const rawOverride = columnOverrides[col.name] ?? columnOverrides[col.index];
    const hasOverride = Boolean(rawOverride && VALID_ACTIONS.has(rawOverride));
    let appliedAction = hasOverride ? rawOverride : col.detectedAction;

    if (appliedAction === RULE_ACTIONS.DATE_SHIFT && !isPro) {
      appliedAction = RULE_ACTIONS.DATE_YEAR_ONLY;
      anyColumnShiftDowngraded = true;
    }

    return {
      ...col,
      appliedAction,
      wasOverridden: hasOverride && appliedAction !== col.detectedAction,
      cellsTransformed: 0,
      cellsRedactedCount: 0,
    };
  });

  // Determine subject ID column for consistent longitudinal date shifting
  let subjectColIndex = -1;
  if (options.subjectIdColumn) {
    subjectColIndex = headers.indexOf(options.subjectIdColumn);
  }
  if (subjectColIndex < 0) {
    const pseudoCol = columns.find((c) => c.appliedAction === RULE_ACTIONS.PSEUDONYMIZE);
    if (pseudoCol) subjectColIndex = pseudoCol.index;
  }
  if (subjectColIndex < 0) {
    const mrnCol = columns.find((c) => c.hipaaCode === 'H');
    if (mrnCol) subjectColIndex = mrnCol.index;
  }

  // Build deterministic pseudonymization crosswalks per pseudonymized column (45 CFR § 164.514(c))
  const pseudoMapsByCol = new Map();
  const reidKeyMap = [];
  const subjectShiftByKey = new Map();

  for (const col of columns) {
    if (col.appliedAction === RULE_ACTIONS.PSEUDONYMIZE) {
      pseudoMapsByCol.set(col.index, new Map());
    }
  }

  const getSubjectKeyForRow = (row, rowIndex) => {
    if (subjectColIndex >= 0) {
      const rawKey = String(row[subjectColIndex] ?? '').trim();
      if (rawKey && !isNullishCell(rawKey)) {
        return rawKey;
      }
    }
    return `ROW_${rowIndex + 1}`;
  };

  const getShiftForSubjectKey = (subjectKey) => {
    if (!subjectShiftByKey.has(subjectKey)) {
      subjectShiftByKey.set(subjectKey, computeSubjectShiftDays(subjectKey, studySalt, shiftRangeDays));
    }
    return subjectShiftByKey.get(subjectKey);
  };

  // Pre-assign study IDs so crosswalk is deterministic and captures exact date shift days
  const hasAnyDateShiftCol = columns.some((c) => c.appliedAction === RULE_ACTIONS.DATE_SHIFT);
  const subjectPseudoPrefix = 'SUBJ_';

  for (const col of columns) {
    if (col.appliedAction !== RULE_ACTIONS.PSEUDONYMIZE) continue;
    const map = pseudoMapsByCol.get(col.index);
    for (let r = 0; r < rows.length; r++) {
      const rawVal = String(rows[r][col.index] ?? '').trim();
      if (!rawVal || isNullishCell(rawVal)) continue;
      if (!map.has(rawVal)) {
        const studyId = `${subjectPseudoPrefix}${String(map.size + 1).padStart(4, '0')}`;
        map.set(rawVal, studyId);
        const shiftVal = hasAnyDateShiftCol && col.index === subjectColIndex
          ? getShiftForSubjectKey(rawVal)
          : (hasAnyDateShiftCol ? getShiftForSubjectKey(getSubjectKeyForRow(rows[r], r)) : 0);
        reidKeyMap.push({
          study_subject_id: studyId,
          source_column: col.name,
          original_identifier: rawVal,
          date_shift_days: hasAnyDateShiftCol ? shiftVal : '',
        });
      }
    }
  }

  // Stats accumulators
  const categoryCounts = Object.fromEntries(HIPAA_IDENTIFIERS.map((h) => [h.code, 0]));
  const inlineRedactionCounts = {
    EMAIL: 0,
    PHONE: 0,
    SSN: 0,
    DATE: 0,
    MRN: 0,
    URL: 0,
    IP: 0,
    ADDRESS: 0,
    NAME: 0,
  };

  const zipStats = {
    zipColumns: columns.filter((c) => c.appliedAction === RULE_ACTIONS.ZIP3).map((c) => c.name),
    totalProcessed: 0,
    restrictedZeroed: 0,
    normalTruncated: 0,
    restrictedPrefixesHit: new Set(),
  };

  const ageStats = {
    ageColumns: columns.filter((c) => c.appliedAction === RULE_ACTIONS.AGE_CAP).map((c) => c.name),
    cellsCappedTo90Plus: 0,
  };

  const dateStats = {
    modeRequested: requestedDateMode,
    modeApplied: hasAnyDateShiftCol ? 'consistent_shift' : 'year_only',
    downgradedByFreeTier: anyColumnShiftDowngraded,
    shiftRangeDays,
    subjectIdColumn: subjectColIndex >= 0 ? headers[subjectColIndex] : null,
    dateColumns: columns
      .filter((c) => c.appliedAction === RULE_ACTIONS.DATE_YEAR_ONLY || c.appliedAction === RULE_ACTIONS.DATE_SHIFT)
      .map((c) => c.name),
    cellsTransformed: 0,
    birthYearsOver89Capped: 0,
    intervalsPreserved: hasAnyDateShiftCol && subjectColIndex >= 0,
  };

  let totalCellsModified = 0;
  const outputColIndices = [];
  const outputHeaders = [];
  const droppedColumns = [];

  for (const col of columns) {
    if (col.appliedAction === RULE_ACTIONS.DROP) {
      droppedColumns.push(col.name);
    } else {
      outputColIndices.push(col.index);
      outputHeaders.push(col.name);
    }
  }

  // Transform all rows (preview covers full dataset; export respects maxExportRows)
  const fullOutputRows = [];
  const previewRows = [];

  for (let r = 0; r < rows.length; r++) {
    const srcRow = rows[r];
    const subjectKey = getSubjectKeyForRow(srcRow, r);
    const shiftDays = hasAnyDateShiftCol ? getShiftForSubjectKey(subjectKey) : 0;

    const outRow = [];
    const diffRow = [];

    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      const rawCell = String(srcRow[c] ?? '');
      const action = col.appliedAction;

      if (action === RULE_ACTIONS.DROP) {
        if (!isNullishCell(rawCell)) {
          col.cellsTransformed += 1;
          col.cellsRedactedCount += 1;
          totalCellsModified += 1;
          if (col.hipaaCode in categoryCounts) {
            categoryCounts[col.hipaaCode] += 1;
          } else {
            categoryCounts.R += 1;
          }
        }
        diffRow.push({
          column: col.name,
          original: rawCell,
          transformed: '[DROPPED]',
          status: 'dropped',
          action,
        });
        continue;
      }

      if (action === RULE_ACTIONS.ZIP3) {
        const res = transformZipCell(rawCell);
        if (!isNullishCell(rawCell)) {
          zipStats.totalProcessed += 1;
          if (res.isRestricted) {
            zipStats.restrictedZeroed += 1;
            if (res.prefix3) zipStats.restrictedPrefixesHit.add(res.prefix3);
          } else {
            zipStats.normalTruncated += 1;
          }
        }
        if (res.transformed) {
          col.cellsTransformed += 1;
          col.cellsRedactedCount += 1;
          totalCellsModified += 1;
          categoryCounts.B += 1;
        }
        outRow.push(res.value);
        diffRow.push({
          column: col.name,
          original: rawCell,
          transformed: res.value,
          status: res.isRestricted ? 'zip_zeroed' : (res.transformed ? 'zip_truncated' : 'kept'),
          action,
        });
        continue;
      }

      if (action === RULE_ACTIONS.DATE_YEAR_ONLY || action === RULE_ACTIONS.DATE_SHIFT) {
        const res = transformDateCell(rawCell, {
          mode: action,
          isBirthColumn: col.isBirthColumn,
          referenceYear,
          offsetDays: shiftDays,
        });
        if (res.birthYearOver89Capped) {
          dateStats.birthYearsOver89Capped += 1;
        }
        if (res.transformed) {
          col.cellsTransformed += 1;
          col.cellsRedactedCount += 1;
          dateStats.cellsTransformed += 1;
          totalCellsModified += 1;
          categoryCounts.C += 1;
        }
        outRow.push(res.value);
        diffRow.push({
          column: col.name,
          original: rawCell,
          transformed: res.value,
          status: res.birthYearOver89Capped
            ? 'capped'
            : (res.transformed ? (action === RULE_ACTIONS.DATE_SHIFT ? 'date_shifted' : 'date_year') : 'kept'),
          action,
          offsetDays: action === RULE_ACTIONS.DATE_SHIFT ? shiftDays : 0,
        });
        continue;
      }

      if (action === RULE_ACTIONS.AGE_CAP) {
        const res = transformAgeCell(rawCell, {
          isBirthYear: col.isBirthYear,
          referenceYear,
        });
        if (res.capped) {
          ageStats.cellsCappedTo90Plus += 1;
          if (res.birthYearOver89Capped) {
            dateStats.birthYearsOver89Capped += 1;
          }
        }
        if (res.transformed) {
          col.cellsTransformed += 1;
          col.cellsRedactedCount += 1;
          totalCellsModified += 1;
          categoryCounts.C += 1;
        }
        outRow.push(res.value);
        diffRow.push({
          column: col.name,
          original: rawCell,
          transformed: res.value,
          status: res.capped ? 'capped' : 'kept',
          action,
        });
        continue;
      }

      if (action === RULE_ACTIONS.PSEUDONYMIZE) {
        const trimmed = rawCell.trim();
        const map = pseudoMapsByCol.get(col.index);
        const mapped = (!trimmed || isNullishCell(trimmed)) ? rawCell : (map.get(trimmed) || rawCell);
        const changed = mapped !== rawCell;
        if (changed) {
          col.cellsTransformed += 1;
          col.cellsRedactedCount += 1;
          totalCellsModified += 1;
          categoryCounts.H += 1;
        }
        outRow.push(mapped);
        diffRow.push({
          column: col.name,
          original: rawCell,
          transformed: mapped,
          status: changed ? 'pseudonymized' : 'kept',
          action,
        });
        continue;
      }

      if (action === RULE_ACTIONS.SCRUB_TEXT) {
        const res = scrubFreeText(rawCell);
        if (res.transformed) {
          col.cellsTransformed += 1;
          col.cellsRedactedCount += res.totalRedactions;
          totalCellsModified += 1;
          for (const [k, v] of Object.entries(res.countsByType)) {
            inlineRedactionCounts[k] = (inlineRedactionCounts[k] || 0) + v;
          }
          for (const [hCode, v] of Object.entries(res.countsByHipaa)) {
            if (hCode in categoryCounts) {
              categoryCounts[hCode] += v;
            }
          }
        }
        outRow.push(res.value);
        diffRow.push({
          column: col.name,
          original: rawCell,
          transformed: res.value,
          status: res.transformed ? 'scrubbed' : 'kept',
          action,
          redactions: res.totalRedactions,
        });
        continue;
      }

      // KEEP
      outRow.push(rawCell);
      diffRow.push({
        column: col.name,
        original: rawCell,
        transformed: rawCell,
        status: 'kept',
        action,
      });
    }

    fullOutputRows.push(outRow);
    previewRows.push(diffRow);
  }

  // Export row slicing (Free tier caps export at 25 rows; Pro is unlimited)
  const truncatedByFreeTier = fullOutputRows.length > maxExportRows;
  const exportRows = truncatedByFreeTier ? fullOutputRows.slice(0, maxExportRows) : fullOutputRows;

  const cleanCsv = serializeDelimited(outputHeaders, exportRows, {
    delimiter,
    lineEnding: parsed?.lineEnding || '\n',
  });

  const reidKeyMapCsv = reidKeyMap.length > 0
    ? serializeDelimited(
      ['study_subject_id', 'source_column', 'original_identifier', 'date_shift_days'],
      reidKeyMap.map((entry) => [
        entry.study_subject_id,
        entry.source_column,
        entry.original_identifier,
        entry.date_shift_days,
      ]),
      { delimiter: ',', lineEnding: '\n' },
    )
    : '';

  // Compliance warnings (e.g., detected PHI manually overridden to Keep)
  const warnings = [];
  for (const col of columns) {
    if (col.hipaaCode !== 'SAFE' && col.appliedAction === RULE_ACTIONS.KEEP) {
      warnings.push({
        code: 'PHI_KEPT_BY_OVERRIDE',
        column: col.name,
        hipaaCode: col.hipaaCode,
        messageEn: `Column "${col.name}" was detected as ${col.hipaaCitation} (${col.hipaaLabelEn}) but manually set to Keep.`,
        messageZh: `字段 "${col.name}" 被识别为 ${col.hipaaCitation}（${col.hipaaLabelZh}），但已被手动覆盖为保留（Keep）。`,
      });
    }
  }
  if (hasAnyDateShiftCol && subjectColIndex < 0) {
    warnings.push({
      code: 'DATE_SHIFT_NO_SUBJECT_ID',
      column: null,
      hipaaCode: 'C',
      messageEn: 'Consistent date shifting is active without a detected MRN/Subject ID column; offsets were assigned per row instead of per subject.',
      messageZh: '已启用一致日期偏移，但未检测到 MRN/受试者 ID 列；日期偏移将按行独立分配，无法跨行保持纵向间隔。',
    });
  }

  const totalPhiColumnsDetected = columns.filter((c) => c.hipaaCode !== 'SAFE').length;
  const pseudonymColumns = columns
    .filter((c) => c.appliedAction === RULE_ACTIONS.PSEUDONYMIZE)
    .map((c) => c.name);

  return {
    delimiter,
    format,
    inputHeaders: headers,
    outputHeaders,
    droppedColumns,
    columns,
    outputRows: exportRows,
    fullOutputRows,
    previewRows,
    cleanCsv,
    reidKeyMap,
    reidKeyMapCsv,
    warnings,
    stats: {
      inputRows: rows.length,
      outputRows: exportRows.length,
      truncatedByFreeTier,
      freeExportCap: FREE_MAX_EXPORT_ROWS,
      inputColumns: headers.length,
      outputColumns: outputHeaders.length,
      droppedColumnCount: droppedColumns.length,
      totalPhiColumnsDetected,
      totalCellsModified,
      referenceYear,
      categoryCounts,
      inlineRedactionCounts,
      zipStats: {
        ...zipStats,
        restrictedPrefixesHit: [...zipStats.restrictedPrefixesHit].sort(),
      },
      ageStats,
      dateStats,
      pseudonymStats: {
        columns: pseudonymColumns,
        uniqueSubjectsMapped: reidKeyMap.length,
      },
    },
  };
}
