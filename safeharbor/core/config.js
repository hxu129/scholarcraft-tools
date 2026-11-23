/**
 * SafeHarbor Studio Pro — Core Configuration & Synthetic Clinical Benchmark
 * Zero-dependency ES module compatible with modern browsers and Node v22+.
 */

export const APP_NAME = 'SafeHarbor Studio Pro';
export const APP_VERSION = '1.0.0';
export const PRODUCT_ID = 'safe';
export const LICENSE_PREFIX = 'SAFE1';

/** Free-tier export row cap (full scan & diff preview work across all loaded rows). */
export const FREE_MAX_EXPORT_ROWS = 25;

/** Default longitudinal date-shift range in days (+/-180 days, excluding 0). */
export const DEFAULT_DATE_SHIFT_RANGE = 180;

/**
 * Embedded ECDSA P-256 Public JWK used for 100% offline verification of
 * signed `SAFE1.<payload>.<sig>` license keys.
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
 * Storefront purchase links ($29 Pro license).
 */
export const PURCHASE_URLS = Object.freeze({
  gumroad: 'https://hxucreativity28.gumroad.com/l/safeharbor-studio',
  mianbaoduo: 'https://mbd.pub/o/bread/YZaWmJ9uZw==',
});

/**
 * Optional online license verification config (Gumroad API v2).
 * Offline `SAFE1.*` ECDSA-signed keys work immediately with zero network calls.
 * Flip `enabled: true` and supply the live Gumroad `product_id` once published.
 */
export const ONLINE_LICENSE_PROVIDERS = Object.freeze({
  gumroad: Object.freeze({
    enabled: true,
    product_id: 'ZJNarisxySKpUYtPmCdI4Q==',
    productPermalink: 'safeharbor-studio',
    validateUrl: 'https://api.gumroad.com/v2/licenses/verify',
  }),
});

export const STORAGE_KEYS = Object.freeze({
  license: 'safeharbor_pro_license_v1',
  lang: 'safeharbor_pro_lang_v1',
  prefs: 'safeharbor_pro_prefs_v1',
});

/**
 * Exact 17 Restricted 3-Digit ZIP Prefixes under 45 CFR § 164.514(b)(2)(i)(B)
 * (geographic units with 2000 Census population <= 20,000).
 * Any US ZIP code beginning with one of these 17 prefixes MUST be coded as "000".
 */
export const RESTRICTED_ZIP3_PREFIXES = Object.freeze([
  '036', '059', '063', '102', '203', '556',
  '692', '790', '821', '823', '830', '831',
  '878', '879', '884', '890', '893',
]);

export const RESTRICTED_ZIP3_SET = new Set(RESTRICTED_ZIP3_PREFIXES);

/**
 * Complete catalog of all 18 HIPAA Safe Harbor Identifiers
 * per 45 CFR § 164.514(b)(2)(i)(A)–(R).
 */
export const HIPAA_IDENTIFIERS = Object.freeze([
  { code: 'A', id: 'names', cfr: '45 CFR § 164.514(b)(2)(i)(A)', labelEn: 'Names', labelZh: '姓名（患者/医生/联系人）' },
  { code: 'B', id: 'geographic', cfr: '45 CFR § 164.514(b)(2)(i)(B)', labelEn: 'Geographic Subdivisions (< State) & ZIP Codes', labelZh: '州以下地理信息与邮编（含17个受限3位前缀）' },
  { code: 'C', id: 'dates_ages', cfr: '45 CFR § 164.514(b)(2)(i)(C)', labelEn: 'Dates (Except Year) & Ages > 89', labelZh: '除年份外的日期与 >89 岁年龄' },
  { code: 'D', id: 'phone', cfr: '45 CFR § 164.514(b)(2)(i)(D)', labelEn: 'Telephone Numbers', labelZh: '电话号码' },
  { code: 'E', id: 'fax', cfr: '45 CFR § 164.514(b)(2)(i)(E)', labelEn: 'Fax Numbers', labelZh: '传真号码' },
  { code: 'F', id: 'email', cfr: '45 CFR § 164.514(b)(2)(i)(F)', labelEn: 'Email Addresses', labelZh: '电子邮箱地址' },
  { code: 'G', id: 'ssn', cfr: '45 CFR § 164.514(b)(2)(i)(G)', labelEn: 'Social Security Numbers (SSN)', labelZh: '社会保障号 (SSN)' },
  { code: 'H', id: 'mrn', cfr: '45 CFR § 164.514(b)(2)(i)(H)', labelEn: 'Medical Record Numbers (MRN)', labelZh: '病历号 (MRN) / 患者 ID' },
  { code: 'I', id: 'beneficiary', cfr: '45 CFR § 164.514(b)(2)(i)(I)', labelEn: 'Health Plan Beneficiary Numbers', labelZh: '医保受益人编号' },
  { code: 'J', id: 'account', cfr: '45 CFR § 164.514(b)(2)(i)(J)', labelEn: 'Account Numbers', labelZh: '账户/账单编号' },
  { code: 'K', id: 'license', cfr: '45 CFR § 164.514(b)(2)(i)(K)', labelEn: 'Certificate / License Numbers', labelZh: '证件/执照编号' },
  { code: 'L', id: 'vehicle', cfr: '45 CFR § 164.514(b)(2)(i)(L)', labelEn: 'Vehicle Identifiers & License Plates', labelZh: '车辆识别号 (VIN) 与车牌号' },
  { code: 'M', id: 'device', cfr: '45 CFR § 164.514(b)(2)(i)(M)', labelEn: 'Device Identifiers & Serial Numbers', labelZh: '医疗设备序列号 / UDI' },
  { code: 'N', id: 'url', cfr: '45 CFR § 164.514(b)(2)(i)(N)', labelEn: 'Web URLs', labelZh: '网址 (URL)' },
  { code: 'O', id: 'ip', cfr: '45 CFR § 164.514(b)(2)(i)(O)', labelEn: 'IP Addresses', labelZh: 'IP 地址' },
  { code: 'P', id: 'biometric', cfr: '45 CFR § 164.514(b)(2)(i)(P)', labelEn: 'Biometric Identifiers', labelZh: '生物特征识别信息' },
  { code: 'Q', id: 'photo', cfr: '45 CFR § 164.514(b)(2)(i)(Q)', labelEn: 'Full-Face Photos & Comparable Images', labelZh: '正面人脸照片及同类影像' },
  { code: 'R', id: 'other_id', cfr: '45 CFR § 164.514(b)(2)(i)(R)', labelEn: 'Other Unique Identifying Codes', labelZh: '其他唯一识别编码或特征' },
]);

/**
 * Built-in realistic 100% SYNTHETIC clinical cohort benchmark dataset:
 * - 12 unique synthetic patients, 16 longitudinal encounter rows (multi-visit MRNs)
 * - Includes a 93-year-old patient (DOB 1933-04-12, age 93 -> 90+) and a 90-year-old patient (age 90 -> 90+) plus an 89-year-old boundary case (stays 89)
 * - Includes restricted HHS 3-digit ZIP codes (03601 -> 000, 82190 -> 000, 89001 -> 000) and normal US ZIPs (94107 -> 941, 10016 -> 100, 02115 -> 021, etc.)
 * - Includes SSNs (fictional 900-series), phones (555-01xx), emails (@example.org), addresses, device serials, and rich clinical notes with inline PHI.
 */
export const CLINICAL_BENCHMARK_CSV = [
  'mrn,patient_name,dob,age,sex,state,zip_code,street_address,phone,email,ssn,admit_date,discharge_date,device_serial,diagnosis_icd10,hba1c_pct,systolic_bp,clinical_notes',
  'MRN-401822,Eleanor Vance,1933-04-12,93,F,NH,03601,"14 Elmwood Ave, Walpole",603-555-0142,e.vance@example.org,900-11-4821,2024-02-10,2024-02-15,UDI-PM-992104,I50.9,6.4,142,"Evaluated by Dr. Sarah Chen on 2024-02-10; contact 603-555-0142 for follow-up. MRN: 401822 stable on diuretics."',
  'MRN-401822,Eleanor Vance,1933-04-12,93,F,NH,03601,"14 Elmwood Ave, Walpole",603-555-0142,e.vance@example.org,900-11-4821,2024-03-11,2024-03-13,UDI-PM-992104,I50.9,6.3,136,"30-day cardiology revisit with Dr. Sarah Chen. Portal link https://ehr.example.org/p/401822 reviewed."',
  'MRN-401835,Marcus Alvarez,1972-09-18,54,M,CA,94107,"742 Townsend St, San Francisco",415-555-0198,m.alvarez@example.org,900-22-7310,2024-01-18,2024-01-22,UDI-CGM-44102,E11.9,8.1,138,"Patient Marcus Alvarez reported fasting glucose 172 mg/dL on 01/18/2024; email m.alvarez@example.org for titration."',
  'MRN-401835,Marcus Alvarez,1972-09-18,54,M,CA,94107,"742 Townsend St, San Francisco",415-555-0198,m.alvarez@example.org,900-22-7310,2024-04-17,2024-04-18,UDI-CGM-44102,E11.9,7.3,130,"90-day glycemic check; telemetry synced from IP 10.24.18.92 without hypoglycemia."',
  'MRN-401849,Priya Nair,1937-03-11,89,F,NY,10016,"210 E 34th St, New York",212-555-0165,p.nair@example.org,900-33-1904,2024-03-04,2024-03-09,UDI-SN-77812,I10,5.9,146,"Boundary age 89 cohort subject. Discharged to family at 210 E 34th St; call (212) 555-0165 if dizzy."',
  'MRN-401860,Robert Hayes,1936-07-22,90,M,WY,82190,"88 Canyon Rd, Yellowstone",307-555-0114,r.hayes@example.org,900-44-6128,2024-02-20,2024-02-27,UDI-SN-30119,J44.1,6.1,134,"Mr. Robert Hayes admitted 02/20/2024 for COPD flare; SSN 900-44-6128 verified at intake."',
  'MRN-401874,Hannah Lindqvist,1984-05-30,42,F,MA,02115,"45 Fenway Blvd, Boston",617-555-0177,h.lindqvist@example.org,900-55-8402,2024-05-01,2024-05-03,UDI-INS-55821,E10.9,7.6,118,"Insulin pump basal adjusted by Dr. David Park on May 1, 2024. No ketosis."',
  'MRN-401874,Hannah Lindqvist,1984-05-30,42,F,MA,02115,"45 Fenway Blvd, Boston",617-555-0177,h.lindqvist@example.org,900-55-8402,2024-06-15,2024-06-15,UDI-INS-55821,E10.9,7.1,116,"45-day outpatient follow-up; time-in-range improved to 76%."',
  'MRN-401888,Samuel Okafor,1959-12-09,66,M,NV,89001,"305 Valley Rd, Alamo",775-555-0133,s.okafor@example.org,900-66-2295,2024-01-25,2024-01-31,UDI-ICD-61042,I48.91,6.7,140,"Atrial fibrillation rate-controlled; consult note from Dr. Linda Morales."',
  'MRN-401893,Mei-Ling Zhou,1968-02-14,58,F,IL,60611,"515 N Michigan Ave, Chicago",312-555-0181,m.zhou@example.org,900-77-9053,2024-03-19,2024-03-21,UDI-SN-88301,K21.9,5.6,124,"Endoscopy negative for ulceration; follow-up scheduled via https://clinic.example.org/sched."',
  'MRN-401907,Daniel Kowalski,1947-08-27,79,M,TX,77030,"1200 Bertner Ave, Houston",713-555-0129,d.kowalski@example.org,900-88-3317,2024-04-02,2024-04-08,UDI-STENT-409,I25.10,6.9,138,"Post-PCI dual antiplatelet therapy started; Chart #401907 cleared for cardiac rehab."',
  'MRN-401907,Daniel Kowalski,1947-08-27,79,M,TX,77030,"1200 Bertner Ave, Houston",713-555-0129,d.kowalski@example.org,900-88-3317,2024-05-02,2024-05-02,UDI-STENT-409,I25.10,6.6,132,"30-day post-PCI evaluation by Dr. Amir Patel; exercise tolerance normal."',
  'MRN-401918,Sofia Rossi,1991-01-21,35,F,WA,98109,"400 Dexter Ave, Seattle",206-555-0156,s.rossi@example.org,900-91-5520,2024-05-12,2024-05-14,UDI-HOLTER-12,G43.909,5.2,112,"Migraine prophylaxis initiated; Ms. Sofia Rossi prefers email s.rossi@example.org."',
  'MRN-401924,Thomas Gallagher,1953-06-15,73,M,NM,87801,"72 Socorro Plaza, Socorro",575-555-0190,t.gallagher@example.org,900-92-4471,2024-02-05,2024-02-11,UDI-CPAP-7102,G47.33,7.0,144,"Sleep study confirms moderate OSA; CPAP adherence uploaded from 192.168.14.22."',
  'MRN-401939,Aisha Mansour,1977-10-08,49,F,CO,80206,"1620 York St, Denver",303-555-0148,a.mansour@example.org,900-93-7789,2024-04-22,2024-04-24,UDI-SN-55210,E03.9,5.5,120,"Levothyroxine dose stabilized; TSH normalized on 2024-04-22 lab panel."',
  'MRN-401951,Kenneth Brooks,1962-03-19,64,M,OH,44106,"2074 Abington Rd, Cleveland",216-555-0162,k.brooks@example.org,900-94-6612,2024-05-18,2024-05-23,UDI-SN-99012,N18.3,7.4,148,"CKD stage 3 nephrology consult with Dr. Rachel Kim; ACE inhibitor continued."',
].join('\n');
