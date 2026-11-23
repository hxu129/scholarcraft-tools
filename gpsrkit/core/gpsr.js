/**
 * GPSRKit Pro — EU Regulation (EU) 2023/988 (GPSR) Article 9 Core Engine
 *
 * Implements:
 *   - Structured Product & Economic Operator model (Manufacturer + Article 16 EU RP)
 *   - 8 Category presets with baseline hazards, mitigations, and EU harmonized standard hints
 *   - 10-dimension Risk Assessment Matrix (Likelihood 1–4 × Severity 1–4 -> Low/Medium/High/Critical)
 *   - Deterministic 0–100% GPSR Completeness Readiness Scorer
 *   - 3 one-click Sample Products (Ceramic Mug, Wooden Craft, USB Desk Lamp)
 *   - RFC-4180 Batch Multi-SKU CSV Parser
 */

import { WARNING_BY_ID } from './translations.js';

export const RISK_LEVELS = Object.freeze({
  na: Object.freeze({ key: 'na', labelEn: 'Not Applicable', labelZh: '不适用', min: 0, max: 0 }),
  low: Object.freeze({ key: 'low', labelEn: 'Low', labelZh: '低风险', min: 1, max: 3 }),
  medium: Object.freeze({ key: 'medium', labelEn: 'Medium', labelZh: '中风险', min: 4, max: 7 }),
  high: Object.freeze({ key: 'high', labelEn: 'High', labelZh: '高风险', min: 8, max: 11 }),
  critical: Object.freeze({ key: 'critical', labelEn: 'Critical', labelZh: '严重风险', min: 12, max: 16 }),
});

/**
 * 10 Structured EU GPSR Hazard Dimensions (Article 9(2) Internal Risk Analysis).
 */
export const HAZARD_CATALOG = Object.freeze([
  Object.freeze({
    id: 'small_parts_choking',
    nameEn: 'Small Parts / Choking',
    nameZh: '小零件与窒息风险',
    standards: 'EN 71-1 §5.1 (Small Parts Cylinder), ISO 8124-1',
    defaultMitigation: 'Verify detachment resistance via tension/torque check; include <3 years choking warning where small detachable components exist.',
  }),
  Object.freeze({
    id: 'sharp_edges_pinch',
    nameEn: 'Sharp Edges / Mechanical Pinch',
    nameZh: '锐边、毛刺与机械夹伤',
    standards: 'EN 71-1 §4.7, ISO 12100, EN 14072',
    defaultMitigation: 'Deburr and sand all accessible edges and seams during QC; verify smooth finish and hinge clearance prior to dispatch.',
  }),
  Object.freeze({
    id: 'chemical_skin_reach',
    nameEn: 'Chemical / Skin Contact / REACH',
    nameZh: '化学物质、皮肤接触与 REACH 限制',
    standards: 'REACH Annex XVII (EC 1907/2006), EN 1811 (Nickel), EC 1935/2004 (Food Contact)',
    defaultMitigation: 'Obtain supplier material declarations confirming absence of restricted SVHCs, azo dyes, lead/cadmium, and excess nickel release.',
  }),
  Object.freeze({
    id: 'flammability_thermal',
    nameEn: 'Flammability / Thermal Burns',
    nameZh: '易燃性与高温烫伤风险',
    standards: 'EN 71-2, EN 14878 (Textiles), EN ISO 12952',
    defaultMitigation: 'Use thermally stable materials, avoid loose flammable finishes, and label clear heat/flame clearance and hot-surface cautions.',
  }),
  Object.freeze({
    id: 'electrical_battery_usb',
    nameEn: 'Electrical / Battery / USB Safety',
    nameZh: '电气、电池与 USB 供电安全',
    standards: 'EN 62368-1, Directive 2011/65/EU (RoHS), EMC 2014/30/EU, EN IEC 62115',
    defaultMitigation: 'Operate exclusively on SELV 5V USB input with integrated overcurrent/thermal cutoff; retain RoHS & EMC test documentation.',
  }),
  Object.freeze({
    id: 'suffocation_packaging',
    nameEn: 'Suffocation / Packaging Film',
    nameZh: '塑料包装袋与薄膜窒息风险',
    standards: 'EN 71-1 §6 (Packaging Film >=0.038mm or Vent Holes), Directive 94/62/EC',
    defaultMitigation: 'Use breathable paperboard or perforated/thick polybags (>=0.038mm) printed with multilingual suffocation warning.',
  }),
  Object.freeze({
    id: 'strangulation_cords',
    nameEn: 'Strangulation / Cords & Cables',
    nameZh: '绳索、抽绳与线缆缠绕窒息',
    standards: 'EN 14682 (Cords & Drawstrings), EN 71-1 §5.4',
    defaultMitigation: 'Limit free cord lengths where feasible, supply cable management ties, and include cord strangulation warnings on packaging.',
  }),
  Object.freeze({
    id: 'foreseeable_misuse',
    nameEn: 'Foreseeable Misuse & Vulnerable Users',
    nameZh: '可预见的误用与易感群体保护',
    standards: 'Regulation (EU) 2023/988 Art. 6 & Art. 9(2), ISO/IEC Guide 51',
    defaultMitigation: 'Clearly specify intended adult/consumer use, load/temperature limits, and "Not a toy" warnings to deter foreseeable misuse.',
  }),
  Object.freeze({
    id: 'fragile_breakage',
    nameEn: 'Fragile / Glass & Ceramic Breakage',
    nameZh: '易碎品与玻璃/陶瓷破损割伤',
    standards: 'EC 1935/2004, EN 1183 (Thermal Shock), EN 1388-1/-2',
    defaultMitigation: 'Perform drop/packaging transit tests, inspect for micro-cracks before shipment, and advise users to discard chipped items immediately.',
  }),
  Object.freeze({
    id: 'labeling_traceability',
    nameEn: 'Labeling & Traceability Completeness',
    nameZh: '标签规范与全链路可追溯性完整性',
    standards: 'Regulation (EU) 2023/988 Art. 9(5)-(7) & Art. 16(3)',
    defaultMitigation: 'Affix permanent SKU, batch/lot code, Manufacturer contact, EU Responsible Person street + electronic address, and EU-language warnings.',
  }),
]);

export const HAZARD_BY_ID = Object.freeze(
  Object.fromEntries(HAZARD_CATALOG.map((h) => [h.id, h])),
);

/**
 * 8 EU GPSR Product Category Presets
 */
export const CATEGORY_PRESETS = Object.freeze([
  Object.freeze({
    id: 'home_kitchen',
    labelEn: 'Home & Kitchen',
    labelZh: '家居厨具 (Home & Kitchen)',
    defaultWarnings: ['fragile_breakage', 'plastic_bag_suffocation', 'care_and_disposal'],
    standardsHint: 'EC 1935/2004 (FCM), EN 1388-1/-2, REACH Annex XVII',
    hazards: {
      small_parts_choking: { applicable: false, likelihood: 1, severity: 2 },
      sharp_edges_pinch: { applicable: true, likelihood: 1, severity: 2 },
      chemical_skin_reach: { applicable: true, likelihood: 2, severity: 3 },
      flammability_thermal: { applicable: true, likelihood: 2, severity: 3 },
      electrical_battery_usb: { applicable: false, likelihood: 1, severity: 1 },
      suffocation_packaging: { applicable: true, likelihood: 2, severity: 3 },
      strangulation_cords: { applicable: false, likelihood: 1, severity: 1 },
      foreseeable_misuse: { applicable: true, likelihood: 2, severity: 2 },
      fragile_breakage: { applicable: true, likelihood: 3, severity: 3 },
      labeling_traceability: { applicable: true, likelihood: 2, severity: 2 },
    },
  }),
  Object.freeze({
    id: 'apparel_textiles',
    labelEn: 'Apparel & Textiles',
    labelZh: '服装纺织品 (Apparel & Textiles)',
    defaultWarnings: ['keep_away_from_fire', 'plastic_bag_suffocation', 'care_and_disposal'],
    standardsHint: 'REACH Annex XVII (Azo dyes/Nickel), Regulation (EU) 1007/2011, EN 14682',
    hazards: {
      small_parts_choking: { applicable: true, likelihood: 2, severity: 3 },
      sharp_edges_pinch: { applicable: true, likelihood: 1, severity: 2 },
      chemical_skin_reach: { applicable: true, likelihood: 2, severity: 3 },
      flammability_thermal: { applicable: true, likelihood: 2, severity: 4 },
      electrical_battery_usb: { applicable: false, likelihood: 1, severity: 1 },
      suffocation_packaging: { applicable: true, likelihood: 2, severity: 4 },
      strangulation_cords: { applicable: true, likelihood: 2, severity: 4 },
      foreseeable_misuse: { applicable: true, likelihood: 2, severity: 2 },
      fragile_breakage: { applicable: false, likelihood: 1, severity: 1 },
      labeling_traceability: { applicable: true, likelihood: 2, severity: 2 },
    },
  }),
  Object.freeze({
    id: 'jewelry_accessories',
    labelEn: 'Jewelry & Accessories',
    labelZh: '饰品与配件 (Jewelry & Accessories)',
    defaultWarnings: ['choking_under_3', 'allergen_nickel_magnet', 'not_a_toy', 'keep_out_of_reach_children'],
    standardsHint: 'REACH Annex XVII (Entries 23 Cd, 27 Ni, 63 Pb), EN 1811, EN 12472',
    hazards: {
      small_parts_choking: { applicable: true, likelihood: 3, severity: 4 },
      sharp_edges_pinch: { applicable: true, likelihood: 2, severity: 2 },
      chemical_skin_reach: { applicable: true, likelihood: 3, severity: 3 },
      flammability_thermal: { applicable: false, likelihood: 1, severity: 1 },
      electrical_battery_usb: { applicable: false, likelihood: 1, severity: 1 },
      suffocation_packaging: { applicable: true, likelihood: 2, severity: 3 },
      strangulation_cords: { applicable: true, likelihood: 2, severity: 3 },
      foreseeable_misuse: { applicable: true, likelihood: 2, severity: 3 },
      fragile_breakage: { applicable: false, likelihood: 1, severity: 2 },
      labeling_traceability: { applicable: true, likelihood: 2, severity: 2 },
    },
  }),
  Object.freeze({
    id: 'toys_child',
    labelEn: 'Toys & Child Products',
    labelZh: '玩具与儿童用品 (Toys & Child Products)',
    defaultWarnings: ['choking_under_3', 'plastic_bag_suffocation', 'adult_supervision', 'care_and_disposal'],
    standardsHint: 'Directive 2009/48/EC (Toy Safety), EN 71-1 / EN 71-2 / EN 71-3, REACH Annex XVII',
    hazards: {
      small_parts_choking: { applicable: true, likelihood: 3, severity: 4 },
      sharp_edges_pinch: { applicable: true, likelihood: 2, severity: 3 },
      chemical_skin_reach: { applicable: true, likelihood: 3, severity: 4 },
      flammability_thermal: { applicable: true, likelihood: 2, severity: 4 },
      electrical_battery_usb: { applicable: false, likelihood: 1, severity: 2 },
      suffocation_packaging: { applicable: true, likelihood: 3, severity: 4 },
      strangulation_cords: { applicable: true, likelihood: 2, severity: 4 },
      foreseeable_misuse: { applicable: true, likelihood: 3, severity: 3 },
      fragile_breakage: { applicable: true, likelihood: 2, severity: 3 },
      labeling_traceability: { applicable: true, likelihood: 2, severity: 3 },
    },
  }),
  Object.freeze({
    id: 'electronics_usb',
    labelEn: 'Electronics & USB Accessories',
    labelZh: '电子与 USB 配件 (Electronics & USB Accessories)',
    defaultWarnings: ['indoor_electrical_safety', 'strangulation_cord', 'plastic_bag_suffocation', 'not_a_toy', 'care_and_disposal'],
    standardsHint: 'EN 62368-1, Directive 2011/65/EU (RoHS), EMC 2014/30/EU, WEEE 2012/19/EU',
    hazards: {
      small_parts_choking: { applicable: true, likelihood: 1, severity: 3 },
      sharp_edges_pinch: { applicable: true, likelihood: 1, severity: 2 },
      chemical_skin_reach: { applicable: true, likelihood: 2, severity: 3 },
      flammability_thermal: { applicable: true, likelihood: 2, severity: 4 },
      electrical_battery_usb: { applicable: true, likelihood: 3, severity: 4 },
      suffocation_packaging: { applicable: true, likelihood: 2, severity: 3 },
      strangulation_cords: { applicable: true, likelihood: 2, severity: 4 },
      foreseeable_misuse: { applicable: true, likelihood: 2, severity: 3 },
      fragile_breakage: { applicable: true, likelihood: 1, severity: 2 },
      labeling_traceability: { applicable: true, likelihood: 2, severity: 3 },
    },
  }),
  Object.freeze({
    id: 'stationery_crafts',
    labelEn: 'Stationery & Crafts',
    labelZh: '文具与手工艺品 (Stationery & Crafts)',
    defaultWarnings: ['sharp_edges_splinters', 'not_a_toy', 'keep_away_from_fire', 'care_and_disposal'],
    standardsHint: 'REACH Annex XVII, Regulation (EU) 2023/988, Formaldehyde/VOC finish limits',
    hazards: {
      small_parts_choking: { applicable: true, likelihood: 2, severity: 3 },
      sharp_edges_pinch: { applicable: true, likelihood: 3, severity: 3 },
      chemical_skin_reach: { applicable: true, likelihood: 2, severity: 2 },
      flammability_thermal: { applicable: true, likelihood: 2, severity: 3 },
      electrical_battery_usb: { applicable: false, likelihood: 1, severity: 1 },
      suffocation_packaging: { applicable: true, likelihood: 2, severity: 3 },
      strangulation_cords: { applicable: false, likelihood: 1, severity: 1 },
      foreseeable_misuse: { applicable: true, likelihood: 2, severity: 2 },
      fragile_breakage: { applicable: false, likelihood: 1, severity: 2 },
      labeling_traceability: { applicable: true, likelihood: 2, severity: 2 },
    },
  }),
  Object.freeze({
    id: 'cosmetics_packaging',
    labelEn: 'Cosmetics / Packaging Accessories',
    labelZh: '美妆工具与包装配件 (Cosmetics / Packaging)',
    defaultWarnings: ['keep_out_of_reach_children', 'plastic_bag_suffocation', 'care_and_disposal'],
    standardsHint: 'REACH Annex XVII, Regulation (EC) 1223/2009 (if cosmetic contact), Directive 94/62/EC',
    hazards: {
      small_parts_choking: { applicable: true, likelihood: 2, severity: 3 },
      sharp_edges_pinch: { applicable: true, likelihood: 2, severity: 2 },
      chemical_skin_reach: { applicable: true, likelihood: 3, severity: 3 },
      flammability_thermal: { applicable: false, likelihood: 1, severity: 2 },
      electrical_battery_usb: { applicable: false, likelihood: 1, severity: 1 },
      suffocation_packaging: { applicable: true, likelihood: 2, severity: 3 },
      strangulation_cords: { applicable: false, likelihood: 1, severity: 1 },
      foreseeable_misuse: { applicable: true, likelihood: 2, severity: 3 },
      fragile_breakage: { applicable: true, likelihood: 2, severity: 3 },
      labeling_traceability: { applicable: true, likelihood: 2, severity: 2 },
    },
  }),
  Object.freeze({
    id: 'sports_outdoor',
    labelEn: 'Sports & Outdoor',
    labelZh: '运动与户外 (Sports & Outdoor)',
    defaultWarnings: ['sharp_edges_splinters', 'adult_supervision', 'keep_away_from_fire', 'care_and_disposal'],
    standardsHint: 'EN ISO 20957 (Stationary Training), EN 957, REACH Annex XVII, EN 13537',
    hazards: {
      small_parts_choking: { applicable: true, likelihood: 1, severity: 3 },
      sharp_edges_pinch: { applicable: true, likelihood: 3, severity: 3 },
      chemical_skin_reach: { applicable: true, likelihood: 2, severity: 2 },
      flammability_thermal: { applicable: true, likelihood: 2, severity: 3 },
      electrical_battery_usb: { applicable: false, likelihood: 1, severity: 1 },
      suffocation_packaging: { applicable: true, likelihood: 2, severity: 3 },
      strangulation_cords: { applicable: true, likelihood: 2, severity: 3 },
      foreseeable_misuse: { applicable: true, likelihood: 3, severity: 3 },
      fragile_breakage: { applicable: false, likelihood: 1, severity: 2 },
      labeling_traceability: { applicable: true, likelihood: 2, severity: 2 },
    },
  }),
]);

export const CATEGORY_BY_ID = Object.freeze(
  Object.fromEntries(CATEGORY_PRESETS.map((c) => [c.id, c])),
);

/**
 * Deterministic Risk Score & Level calculation.
 * Likelihood (1..4) × Severity (1..4) => score (1..16)
 *   1–3   => Low
 *   4–7   => Medium
 *   8–11  => High
 *   12–16 => Critical
 */
export function computeRiskScore(likelihood, severity, applicable = true) {
  if (!applicable) {
    return {
      applicable: false,
      likelihood: 0,
      severity: 0,
      score: 0,
      levelKey: 'na',
      level: 'Not Applicable',
    };
  }
  const l = Math.min(4, Math.max(1, Math.round(Number(likelihood) || 1)));
  const s = Math.min(4, Math.max(1, Math.round(Number(severity) || 1)));
  const score = l * s;
  let levelKey = 'low';
  if (score >= 12) levelKey = 'critical';
  else if (score >= 8) levelKey = 'high';
  else if (score >= 4) levelKey = 'medium';

  return {
    applicable: true,
    likelihood: l,
    severity: s,
    score,
    levelKey,
    level: RISK_LEVELS[levelKey].labelEn,
  };
}

/**
 * Build default 10-hazard matrix rows for a given category preset.
 */
export function createDefaultHazardsForCategory(categoryId = 'home_kitchen') {
  const preset = CATEGORY_BY_ID[categoryId] || CATEGORY_PRESETS[0];
  return HAZARD_CATALOG.map((meta) => {
    const cfg = preset.hazards[meta.id] || { applicable: false, likelihood: 1, severity: 1 };
    return {
      id: meta.id,
      applicable: Boolean(cfg.applicable),
      likelihood: cfg.likelihood,
      severity: cfg.severity,
      mitigation: cfg.applicable ? meta.defaultMitigation : '',
      standards: meta.standards,
    };
  });
}

/**
 * Evaluate and normalize a 10-dimension risk matrix.
 */
export function assessRiskMatrix(hazardsInput = []) {
  const byId = new Map();
  if (Array.isArray(hazardsInput)) {
    for (const item of hazardsInput) {
      if (item && item.id) byId.set(item.id, item);
    }
  } else if (hazardsInput && typeof hazardsInput === 'object') {
    for (const [k, v] of Object.entries(hazardsInput)) {
      byId.set(k, { id: k, ...v });
    }
  }

  const counts = { na: 0, low: 0, medium: 0, high: 0, critical: 0 };
  const unmitigatedHighRisks = [];
  let maxScore = 0;
  let maxLevelKey = 'na';
  let applicableCount = 0;

  const rows = HAZARD_CATALOG.map((meta) => {
    const raw = byId.get(meta.id) || {
      id: meta.id,
      applicable: false,
      likelihood: 1,
      severity: 1,
      mitigation: '',
      standards: meta.standards,
    };
    const applicable = Boolean(raw.applicable);
    const calc = computeRiskScore(raw.likelihood, raw.severity, applicable);
    const mitigation = String(raw.mitigation ?? '').trim();
    const standards = String(raw.standards ?? meta.standards).trim() || meta.standards;

    counts[calc.levelKey] += 1;
    if (applicable) {
      applicableCount += 1;
      if (calc.score > maxScore) {
        maxScore = calc.score;
        maxLevelKey = calc.levelKey;
      }
    }

    const requiresMitigation = applicable && (calc.levelKey === 'high' || calc.levelKey === 'critical');
    const isUnmitigatedHighRisk = requiresMitigation && mitigation.length < 10;
    if (isUnmitigatedHighRisk) {
      unmitigatedHighRisks.push({
        id: meta.id,
        nameEn: meta.nameEn,
        nameZh: meta.nameZh,
        score: calc.score,
        level: calc.level,
      });
    }

    return {
      id: meta.id,
      nameEn: meta.nameEn,
      nameZh: meta.nameZh,
      applicable,
      likelihood: calc.likelihood,
      severity: calc.severity,
      score: calc.score,
      levelKey: calc.levelKey,
      level: calc.level,
      mitigation,
      standards,
      requiresMitigation,
      isUnmitigatedHighRisk,
    };
  });

  return {
    rows,
    counts,
    applicableCount,
    maxScore,
    maxLevelKey,
    maxLevel: RISK_LEVELS[maxLevelKey].labelEn,
    unmitigatedHighRisks,
  };
}

/**
 * Validate whether an electronic address string looks like a valid email or HTTP(S) URL.
 */
export function isValidElectronicAddress(value) {
  const s = String(value || '').trim();
  if (!s) return false;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s)) return true;
  if (/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(s)) return true;
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+([/?#].*)?$/i.test(s) && s.includes('.')) return true;
  return false;
}

/**
 * Normalize a partial or raw GPSR product record into the canonical schema.
 */
export function normalizeProductRecord(raw = {}) {
  const categoryId = CATEGORY_BY_ID[raw?.product?.category]
    ? raw.product.category
    : 'home_kitchen';
  const preset = CATEGORY_BY_ID[categoryId];

  const product = {
    name: String(raw?.product?.name ?? '').trim(),
    sku: String(raw?.product?.sku ?? '').trim(),
    batchFormat: String(raw?.product?.batchFormat ?? '').trim(),
    eanGtin: String(raw?.product?.eanGtin ?? '').trim(),
    category: categoryId,
    materials: String(raw?.product?.materials ?? '').trim(),
    intendedUse: String(raw?.product?.intendedUse ?? '').trim(),
    targetUsers: String(raw?.product?.targetUsers ?? '').trim(),
  };

  const manufacturer = {
    name: String(raw?.manufacturer?.name ?? '').trim(),
    tradeName: String(raw?.manufacturer?.tradeName ?? '').trim(),
    postalAddress: String(raw?.manufacturer?.postalAddress ?? '').trim(),
    electronicAddress: String(raw?.manufacturer?.electronicAddress ?? '').trim(),
  };

  const euResponsiblePerson = {
    name: String(raw?.euResponsiblePerson?.name ?? '').trim(),
    euAddress: String(raw?.euResponsiblePerson?.euAddress ?? '').trim(),
    electronicAddress: String(raw?.euResponsiblePerson?.electronicAddress ?? '').trim(),
  };

  const rawWarnings = Array.isArray(raw?.warnings)
    ? raw.warnings.filter((id) => Boolean(WARNING_BY_ID[id]))
    : [...preset.defaultWarnings];

  const warnings = [...new Set(rawWarnings)];
  const customWarning = String(raw?.customWarning ?? '').trim();

  const hazards = Array.isArray(raw?.hazards) && raw.hazards.length > 0
    ? raw.hazards
    : createDefaultHazardsForCategory(categoryId);

  return {
    product,
    manufacturer,
    euResponsiblePerson,
    warnings,
    customWarning,
    hazards,
  };
}

/**
 * Compute GPSR Completeness Readiness Score (0–100%) and itemized compliance checklist.
 */
export function evaluateReadiness(recordInput) {
  const record = normalizeProductRecord(recordInput);
  const riskSummary = assessRiskMatrix(record.hazards);

  const checks = [];
  const pushCheck = ({ id, article, weight, passed, earned, titleEn, titleZh, issueEn, issueZh }) => {
    checks.push({
      id,
      article,
      weight,
      earned: earned !== undefined ? earned : (passed ? weight : 0),
      passed: Boolean(passed),
      titleEn,
      titleZh,
      issueEn: passed ? '' : issueEn,
      issueZh: passed ? '' : issueZh,
    });
  };

  // 1. Product Name & SKU/Model (10 pts)
  const hasNameAndSku = record.product.name.length >= 2 && record.product.sku.length >= 2;
  pushCheck({
    id: 'product_identity',
    article: 'Art. 9(5)',
    weight: 10,
    passed: hasNameAndSku,
    titleEn: 'Product Name & Model / SKU',
    titleZh: '产品名称与型号/SKU',
    issueEn: 'Enter both a clear Product Name and SKU / Model identifier.',
    issueZh: '请填写完整的产品名称与 SKU/型号编码。',
  });

  // 2. Batch / Lot / Serial traceability (10 pts)
  const hasBatch = record.product.batchFormat.length >= 3;
  pushCheck({
    id: 'traceability_batch',
    article: 'Art. 9(5)',
    weight: 10,
    passed: hasBatch,
    titleEn: 'Batch / Lot / Serial Traceability',
    titleZh: '批次号 / 序列号可追溯标识',
    issueEn: 'Missing batch, lot, or serial format required for EU recall traceability (Art. 9(5)).',
    issueZh: '缺少欧盟召回追溯所需的批次号/序列号格式（第 9(5) 条）。',
  });

  // 3. Materials & Intended Use (10 pts)
  const hasMaterialsAndUse = record.product.materials.length >= 3 && record.product.intendedUse.length >= 5;
  pushCheck({
    id: 'materials_intended_use',
    article: 'Art. 9(2)',
    weight: 10,
    passed: hasMaterialsAndUse,
    titleEn: 'Materials & Intended Use Description',
    titleZh: '材质构成与预期用途描述',
    issueEn: 'Document primary materials and intended use for the Article 9(2) technical file.',
    issueZh: '请在技术文档中明确产品主要材质与预期用途（第 9(2) 条）。',
  });

  // 4. Target Users / Vulnerable Groups (6 pts)
  const hasTargetUsers = record.product.targetUsers.length >= 3;
  pushCheck({
    id: 'target_users',
    article: 'Art. 6(1)(d)',
    weight: 6,
    passed: hasTargetUsers,
    titleEn: 'Target Users & Vulnerable Groups',
    titleZh: '目标人群与儿童/老人等易感群体说明',
    issueEn: 'Specify target consumer group and any child/elderly/allergy vulnerability considerations.',
    issueZh: '请说明适用人群及儿童、老年人、过敏体质等易感群体评估。',
  });

  // 5. Manufacturer Name & Postal Street Address (12 pts)
  const hasMfrPostal = record.manufacturer.name.length >= 2 && record.manufacturer.postalAddress.length >= 8;
  pushCheck({
    id: 'manufacturer_postal',
    article: 'Art. 9(6)',
    weight: 12,
    passed: hasMfrPostal,
    titleEn: 'Manufacturer Name & Postal Street Address',
    titleZh: '制造商法定名称与邮寄街道地址',
    issueEn: 'Provide full Manufacturer legal name and complete physical postal address (Art. 9(6)).',
    issueZh: '请填写完整的制造商法定名称及可收件的实体街道地址（第 9(6) 条）。',
  });

  // 6. Manufacturer Electronic Address (8 pts)
  const hasMfrElectronic = isValidElectronicAddress(record.manufacturer.electronicAddress);
  pushCheck({
    id: 'manufacturer_electronic',
    article: 'Art. 9(6)',
    weight: 8,
    passed: hasMfrElectronic,
    titleEn: 'Manufacturer Electronic Contact (Email / URL)',
    titleZh: '制造商电子联系方式（邮箱 / 网址）',
    issueEn: 'Provide a valid Manufacturer email address or website URL (Art. 9(6)).',
    issueZh: '请填写有效的制造商电子邮箱或官方网址（第 9(6) 条）。',
  });

  // 7. EU Responsible Person Name & EU Street Address (14 pts)
  const hasRpStreet = record.euResponsiblePerson.name.length >= 2 && record.euResponsiblePerson.euAddress.length >= 8;
  pushCheck({
    id: 'eu_rp_address',
    article: 'Art. 16(3)',
    weight: 14,
    passed: hasRpStreet,
    titleEn: 'EU Responsible Person Name & EU Street Address',
    titleZh: '欧盟负责人 (欧代) 名称与欧盟实体街道地址',
    issueEn: 'Missing mandatory Article 16 EU Responsible Person name or EU/EEA postal street address.',
    issueZh: '缺少第 16 条强制要求的欧盟负责人（欧代）名称或欧盟境内街道地址。',
  });

  // 8. EU Responsible Person Electronic Address (8 pts)
  const hasRpElectronic = isValidElectronicAddress(record.euResponsiblePerson.electronicAddress);
  pushCheck({
    id: 'eu_rp_electronic',
    article: 'Art. 16(3)',
    weight: 8,
    passed: hasRpElectronic,
    titleEn: 'EU Responsible Person Electronic Contact',
    titleZh: '欧代电子联系方式（邮箱 / 网址）',
    issueEn: 'Missing valid electronic contact (email or URL) for the EU Responsible Person.',
    issueZh: '缺少有效的欧代电子邮箱或官网联系方式（第 16(3) 条）。',
  });

  // 9. Risk Assessment Matrix & High/Critical Mitigation (14 pts)
  const hasApplicableHazards = riskSummary.applicableCount > 0;
  const unmitigatedCount = riskSummary.unmitigatedHighRisks.length;
  const riskPassed = hasApplicableHazards && unmitigatedCount === 0;
  let riskEarned = 0;
  if (riskPassed) riskEarned = 14;
  else if (hasApplicableHazards && unmitigatedCount > 0) riskEarned = 4;

  const riskIssueEn = !hasApplicableHazards
    ? 'Evaluate at least one applicable hazard dimension in the Article 9(2) Risk Matrix.'
    : `${unmitigatedCount} High/Critical hazard(s) lack concrete mitigation steps (${riskSummary.unmitigatedHighRisks.map((h) => h.nameEn).join(', ')}).`;
  const riskIssueZh = !hasApplicableHazards
    ? '请在第 9(2) 条风险评估矩阵中至少评估 1 项适用风险维度。'
    : `存在 ${unmitigatedCount} 项高/严重风险尚未填写具体缓解措施（${riskSummary.unmitigatedHighRisks.map((h) => h.nameZh).join('、')}）。`;

  pushCheck({
    id: 'risk_matrix_mitigated',
    article: 'Art. 9(2)',
    weight: 14,
    passed: riskPassed,
    earned: riskEarned,
    titleEn: 'Risk Assessment & High/Critical Hazard Mitigations',
    titleZh: '内部风险评估与高/严重风险缓解措施',
    issueEn: riskIssueEn,
    issueZh: riskIssueZh,
  });

  // 10. Safety Warnings & Consumer Information (8 pts)
  const hasWarnings = record.warnings.length > 0 || record.customWarning.length >= 5;
  pushCheck({
    id: 'safety_warnings',
    article: 'Art. 9(7)',
    weight: 8,
    passed: hasWarnings,
    titleEn: 'Multilingual Safety Warnings / Care Notice',
    titleZh: '多语种安全警示语或养护说明',
    issueEn: 'Select at least one applicable safety warning or inspection/care notice for EU consumers.',
    issueZh: '请至少选择 1 条适用安全警示语或检查/回收说明。',
  });

  const score = checks.reduce((sum, c) => sum + c.earned, 0);
  const maxScore = checks.reduce((sum, c) => sum + c.weight, 0);
  const missingItems = checks.filter((c) => !c.passed);

  let status = 'incomplete';
  if (score >= 90 && unmitigatedCount === 0 && hasRpStreet && hasRpElectronic) {
    status = 'ready';
  } else if (score >= 65 && unmitigatedCount === 0) {
    status = 'needs_attention';
  }

  return {
    score,
    maxScore,
    percentage: Math.round((score / maxScore) * 100),
    status,
    checks,
    missingItems,
    highRiskUnmitigatedCount: unmitigatedCount,
    applicableHazardCount: riskSummary.applicableCount,
    maxRiskLevel: riskSummary.maxLevel,
    maxRiskLevelKey: riskSummary.maxLevelKey,
    riskSummary,
  };
}

/**
 * 3 Built-In 1-Click Sample Products (Ceramic Mug / Wooden Craft / USB Desk Lamp)
 */
export const SAMPLE_PRODUCTS = Object.freeze({
  ceramic_mug: Object.freeze({
    presetId: 'ceramic_mug',
    labelEn: 'Ceramic Mug',
    labelZh: '陶瓷马克杯',
    record: {
      product: {
        name: 'Artisan Glazed Stoneware Coffee Mug (350 ml)',
        sku: 'HOME-MUG-350-BLU',
        batchFormat: 'LOT-YYYYMM-NNN (e.g., LOT-202611-014)',
        eanGtin: '4260991234561',
        category: 'home_kitchen',
        materials: 'Lead-free glazed stoneware ceramic (100%), food-safe mineral cobalt pigment, recycled kraft gift box',
        intendedUse: 'Domestic beverage drinking vessel for hot and cold non-alcoholic drinks (max 100°C).',
        targetUsers: 'General adult household consumers; not intended for unsupervised use by children under 6 years due to hot liquids and breakage risk.',
      },
      manufacturer: {
        name: 'Jingdezhen Atelier Ceramics Co., Ltd.',
        tradeName: 'NordicKiln Home',
        postalAddress: 'No. 88 Taoyang South Road, Changjiang District, Jingdezhen 333000, Jiangxi, China',
        electronicAddress: 'compliance@nordickiln-home.example',
      },
      euResponsiblePerson: {
        name: 'EuroBridge Compliance Services GmbH',
        euAddress: 'Friedrichstraße 114A, 10117 Berlin, Germany',
        electronicAddress: 'gpsr@eurobridge-compliance.example',
      },
      warnings: ['fragile_breakage', 'plastic_bag_suffocation', 'care_and_disposal'],
      customWarning: 'Dishwasher safe up to 60°C. Do not place directly over open stove flame.',
      hazards: [
        { id: 'small_parts_choking', applicable: false, likelihood: 1, severity: 1, mitigation: '', standards: 'EN 71-1' },
        { id: 'sharp_edges_pinch', applicable: true, likelihood: 1, severity: 2, mitigation: 'Rim and handle edges smoothed and visually inspected 100% before glazing and packing.', standards: 'ISO 12100' },
        { id: 'chemical_skin_reach', applicable: true, likelihood: 2, severity: 3, mitigation: 'Batch migration test confirms Lead and Cadmium release well below Directive 84/500/EEC and EN 1388-1/-2 limits.', standards: 'EC 1935/2004, EN 1388-1/-2, REACH Annex XVII' },
        { id: 'flammability_thermal', applicable: true, likelihood: 2, severity: 3, mitigation: 'Insulated ceramic handle reduces heat transfer; hot-liquid scald caution printed in 5 EU languages.', standards: 'EN 1183 (Thermal Shock)' },
        { id: 'electrical_battery_usb', applicable: false, likelihood: 1, severity: 1, mitigation: '', standards: 'N/A' },
        { id: 'suffocation_packaging', applicable: true, likelihood: 2, severity: 3, mitigation: 'Uses molded pulp inner tray and perforated transit wrap printed with multilingual suffocation warning.', standards: 'EN 71-1 §6, Directive 94/62/EC' },
        { id: 'strangulation_cords', applicable: false, likelihood: 1, severity: 1, mitigation: '', standards: 'N/A' },
        { id: 'foreseeable_misuse', applicable: true, likelihood: 2, severity: 2, mitigation: 'Label states no open-flame heating and advises immediate disposal if cracked or chipped.', standards: 'Regulation (EU) 2023/988 Art. 6 & Art. 9' },
        { id: 'fragile_breakage', applicable: true, likelihood: 3, severity: 3, mitigation: 'ISTA-3A drop-tested corrugated box with foam-free honeycomb dividers; fragile handling caution included on outer carton and insert.', standards: 'EC 1935/2004, EN 1183' },
        { id: 'labeling_traceability', applicable: true, likelihood: 2, severity: 2, mitigation: 'Permanent bottom stamp carries SKU & LOT code; packaging insert carries Manufacturer, EU RP street + email, and 5-language warnings.', standards: 'Regulation (EU) 2023/988 Art. 9(5)-(7) & Art. 16' },
      ],
    },
  }),

  wooden_craft: Object.freeze({
    presetId: 'wooden_craft',
    labelEn: 'Wooden Craft',
    labelZh: '木质工艺品',
    record: {
      product: {
        name: 'Handcrafted Solid Beechwood Desk Organizer & Pen Tray',
        sku: 'CRAFT-WOOD-ORG-02',
        batchFormat: 'BATCH-YYYYWww (e.g., BATCH-2026W47)',
        eanGtin: '4260991234899',
        category: 'stationery_crafts',
        materials: 'FSC-certified European solid beechwood, EN 71-3 compliant water-based matte wood oil, 4× self-adhesive wool felt foot pads',
        intendedUse: 'Indoor desktop storage tray for pens, notebooks, and small stationery items.',
        targetUsers: 'Adult office and studio users; not a toy and unsuitable for unsupervised children under 3 years due to detachable felt pads.',
      },
      manufacturer: {
        name: 'Linden & Grain Woodcraft Studio',
        tradeName: 'LindenGrain Workshop',
        postalAddress: 'Gewerbestraße 22, 83022 Rosenheim, Germany',
        electronicAddress: 'safety@lindengrain-craft.example',
      },
      euResponsiblePerson: {
        name: 'Linden & Grain Woodcraft Studio (EU Manufacturer)',
        euAddress: 'Gewerbestraße 22, 83022 Rosenheim, Germany',
        electronicAddress: 'safety@lindengrain-craft.example',
      },
      warnings: ['sharp_edges_splinters', 'not_a_toy', 'keep_away_from_fire', 'care_and_disposal'],
      customWarning: 'Wipe with dry cloth only. Keep away from prolonged moisture to prevent wood warping.',
      hazards: [
        { id: 'small_parts_choking', applicable: true, likelihood: 2, severity: 3, mitigation: 'Felt foot pads are recessed and bonded with industrial adhesive; packaging includes "Not a toy" caution.', standards: 'EN 71-1 §5.1' },
        { id: 'sharp_edges_pinch', applicable: true, likelihood: 3, severity: 3, mitigation: 'All corners CNC-chamfered to 2 mm radius and hand-sanded to 320 grit to eliminate splinters and sharp edges.', standards: 'ISO 12100, EN 71-1 §4.7' },
        { id: 'chemical_skin_reach', applicable: true, likelihood: 2, severity: 2, mitigation: 'Finished exclusively with zero-VOC plant-based wood oil meeting REACH Annex XVII and EN 71-3 heavy-metal limits.', standards: 'REACH Annex XVII, EN 71-3' },
        { id: 'flammability_thermal', applicable: true, likelihood: 2, severity: 3, mitigation: 'Combustible solid timber bears clear "Keep away from fire and open flames" warning in 5 EU languages.', standards: 'Regulation (EU) 2023/988 Art. 9' },
        { id: 'electrical_battery_usb', applicable: false, likelihood: 1, severity: 1, mitigation: '', standards: 'N/A' },
        { id: 'suffocation_packaging', applicable: true, likelihood: 1, severity: 3, mitigation: 'Shipped in plastic-free kraft tissue and cardboard box; no polybag used.', standards: 'Directive 94/62/EC' },
        { id: 'strangulation_cords', applicable: false, likelihood: 1, severity: 1, mitigation: '', standards: 'N/A' },
        { id: 'foreseeable_misuse', applicable: true, likelihood: 2, severity: 2, mitigation: 'Marked as adult desk stationery item ("Not a toy") and advises against use as food serving board.', standards: 'Regulation (EU) 2023/988 Art. 6 & Art. 9' },
        { id: 'fragile_breakage', applicable: false, likelihood: 1, severity: 1, mitigation: '', standards: 'N/A' },
        { id: 'labeling_traceability', applicable: true, likelihood: 2, severity: 2, mitigation: 'Laser-etched SKU & BATCH code on underside plus 5-language compliance card inside box.', standards: 'Regulation (EU) 2023/988 Art. 9(5)-(7) & Art. 16' },
      ],
    },
  }),

  usb_desk_lamp: Object.freeze({
    presetId: 'usb_desk_lamp',
    labelEn: 'USB Desk Lamp',
    labelZh: 'USB 台灯',
    record: {
      product: {
        name: 'Minimalist Touch LED USB-C Desk Lamp (5V DC, 5W)',
        sku: 'ELEC-LAMP-USBC-09',
        batchFormat: 'SN-YYYYMM-NNNN (e.g., SN-202611-0401)',
        eanGtin: '4260991235100',
        category: 'electronics_usb',
        materials: 'Anodized aluminum alloy arm, UL94 V-0 flame-retardant ABS base, frosted polycarbonate LED diffuser, 1.5 m braided USB-C power cable (no internal lithium battery)',
        intendedUse: 'Indoor dry-location study and office task lighting powered by a certified external 5V DC / 1A USB SELV power adapter.',
        targetUsers: 'Adult and student desk users; not a toy; keep power cord out of reach of infants and toddlers.',
      },
      manufacturer: {
        name: 'Shenzhen LuminaOptics Technology Co., Ltd.',
        tradeName: 'LuminaDesk EU',
        postalAddress: 'Building B, Floor 4, Nanshan Hi-Tech Park, Shenzhen 518057, Guangdong, China',
        electronicAddress: 'eu-compliance@luminadesk.example',
      },
      euResponsiblePerson: {
        name: 'RheinTrust Product Compliance UG',
        euAddress: 'Königsallee 60F, 40212 Düsseldorf, Germany',
        electronicAddress: 'rp@rheintrust-eu.example',
      },
      warnings: ['indoor_electrical_safety', 'strangulation_cord', 'plastic_bag_suffocation', 'not_a_toy', 'care_and_disposal'],
      customWarning: 'Powered via 5V DC 1A USB-C only (adapter not included). Do not cover LED head during operation.',
      hazards: [
        { id: 'small_parts_choking', applicable: true, likelihood: 1, severity: 3, mitigation: 'All fasteners are enclosed and tool-secured; no small detachable user-accessible components.', standards: 'EN 71-1 §5.1' },
        { id: 'sharp_edges_pinch', applicable: true, likelihood: 2, severity: 2, mitigation: 'Folding hinge includes 12 mm finger-clearance stop and anodized chamfered aluminum edges.', standards: 'EN 62368-1, ISO 12100' },
        { id: 'chemical_skin_reach', applicable: true, likelihood: 2, severity: 3, mitigation: 'Full RoHS 2.0 (2011/65/EU + 2015/863) and REACH SVHC (<0.1% w/w) supplier test reports archived in technical file.', standards: 'Directive 2011/65/EU (RoHS), REACH Annex XVII' },
        { id: 'flammability_thermal', applicable: true, likelihood: 2, severity: 4, mitigation: 'Base molded in UL94 V-0 ABS; steady-state LED housing temperature verified <=44°C at 25°C ambient.', standards: 'EN 62368-1 §6 & §9, EN 60598-1' },
        { id: 'electrical_battery_usb', applicable: true, likelihood: 3, severity: 4, mitigation: 'Battery-free 5V SELV USB-C design with PTC resettable fuse (1.2A) and ESD protection; EMC (EN 55015 / EN 61547) & photobiological RG0 verified.', standards: 'EN 62368-1, EMC 2014/30/EU, RoHS 2011/65/EU, EN 62471' },
        { id: 'suffocation_packaging', applicable: true, likelihood: 2, severity: 3, mitigation: 'Protective sleeve is 0.05 mm LDPE with 6 mm vent holes and printed 5-language suffocation warning.', standards: 'EN 71-1 §6, Directive 94/62/EC' },
        { id: 'strangulation_cords', applicable: true, likelihood: 2, severity: 4, mitigation: '1.5 m USB-C cable supplied with reusable Velcro keeper and multilingual strangulation warning on label and manual.', standards: 'Regulation (EU) 2023/988 Art. 9, EN 71-1 §5.4' },
        { id: 'foreseeable_misuse', applicable: true, likelihood: 2, severity: 3, mitigation: '5V USB input clamping prevents damage from PD adapters; "Indoor dry use only" and "Not a toy" warnings printed on base label.', standards: 'Regulation (EU) 2023/988 Art. 6 & Art. 9' },
        { id: 'fragile_breakage', applicable: true, likelihood: 1, severity: 2, mitigation: 'Shatter-resistant polycarbonate diffuser replaces glass lens; passes 1 m drop test.', standards: 'EN 62368-1' },
        { id: 'labeling_traceability', applicable: true, likelihood: 2, severity: 3, mitigation: 'Rating label on base carries Model, SN batch code, 5V DC input, CE/WEEE mark, Manufacturer, and EU RP street + email.', standards: 'Regulation (EU) 2023/988 Art. 9(5)-(7) & Art. 16, WEEE 2012/19/EU' },
      ],
    },
  }),
});

export function getSampleProduct(presetId = 'ceramic_mug') {
  const sample = SAMPLE_PRODUCTS[presetId] || SAMPLE_PRODUCTS.ceramic_mug;
  return normalizeProductRecord(structuredClone(sample.record));
}

/**
 * Sample 3-SKU CSV for Batch Mode testing and onboarding.
 */
export const SAMPLE_BATCH_CSV = [
  'sku,product_name,category,batch_format,ean_gtin,materials,intended_use,target_users,warnings,manufacturer_name,manufacturer_trade_name,manufacturer_address,manufacturer_contact,eu_rp_name,eu_rp_address,eu_rp_contact',
  'HOME-MUG-350-BLU,"Artisan Glazed Stoneware Coffee Mug (350 ml)",home_kitchen,LOT-202611-014,4260991234561,"Lead-free glazed stoneware ceramic","Hot and cold domestic beverages","Adult household consumers","fragile_breakage;plastic_bag_suffocation;care_and_disposal","Jingdezhen Atelier Ceramics Co., Ltd.","NordicKiln Home","No. 88 Taoyang South Road, Jingdezhen 333000, China",compliance@nordickiln-home.example,"EuroBridge Compliance Services GmbH","Friedrichstraße 114A, 10117 Berlin, Germany",gpsr@eurobridge-compliance.example',
  'CRAFT-WOOD-ORG-02,"Handcrafted Solid Beechwood Desk Organizer",stationery_crafts,BATCH-2026W47,4260991234899,"Solid European beechwood, water-based oil","Desktop stationery storage","Adult office users; not a toy","sharp_edges_splinters;not_a_toy;keep_away_from_fire;care_and_disposal","Linden & Grain Woodcraft Studio","LindenGrain","Gewerbestraße 22, 83022 Rosenheim, Germany",safety@lindengrain-craft.example,"Linden & Grain Woodcraft Studio","Gewerbestraße 22, 83022 Rosenheim, Germany",safety@lindengrain-craft.example',
  'ELEC-LAMP-USBC-09,"Minimalist Touch LED USB-C Desk Lamp (5V DC)",electronics_usb,SN-202611-0401,4260991235100,"Anodized aluminum, UL94 V-0 ABS, polycarbonate diffuser","Indoor dry-location study lighting via 5V USB","Adult and student desk users","indoor_electrical_safety;strangulation_cord;plastic_bag_suffocation;not_a_toy;care_and_disposal","Shenzhen LuminaOptics Technology Co., Ltd.","LuminaDesk EU","Building B, Floor 4, Nanshan Hi-Tech Park, Shenzhen 518057, China",eu-compliance@luminadesk.example,"RheinTrust Product Compliance UG","Königsallee 60F, 40212 Düsseldorf, Germany",rp@rheintrust-eu.example',
].join('\n');

/**
 * RFC-4180 CSV parser returning 2D string rows.
 */
export function parseCsvRows(text) {
  const clean = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\r') {
      if (clean[i + 1] === '\n') i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ''));
}

function resolveCategoryId(rawCat) {
  const val = String(rawCat || '').trim().toLowerCase();
  if (!val) return 'home_kitchen';
  if (CATEGORY_BY_ID[val]) return val;
  for (const preset of CATEGORY_PRESETS) {
    if (
      preset.labelEn.toLowerCase() === val ||
      preset.labelZh.toLowerCase() === val ||
      preset.labelEn.toLowerCase().includes(val)
    ) {
      return preset.id;
    }
  }
  return 'home_kitchen';
}

/**
 * Parse a multi-SKU CSV into normalized GPSR Product Records.
 * Missing Manufacturer / EU RP cells fall back to `fallbackOperators` when supplied.
 */
export function parseBatchCsv(csvText, fallbackOperators = {}) {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) {
    return { records: [], errors: ['CSV requires a header row and at least one product row.'] };
  }

  const headers = rows[0].map((h) =>
    String(h || '')
      .trim()
      .toLowerCase()
      .replace(/[\s\-/]+/g, '_'),
  );

  const pick = (obj, aliases) => {
    for (const key of aliases) {
      if (obj[key] !== undefined && String(obj[key]).trim() !== '') {
        return String(obj[key]).trim();
      }
    }
    return '';
  };

  const records = [];
  const errors = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const map = {};
    headers.forEach((h, idx) => {
      map[h] = cells[idx] ?? '';
    });

    const sku = pick(map, ['sku', 'model', 'sku_model', 'model_number']);
    const name = pick(map, ['product_name', 'name', 'title']);
    if (!sku && !name) {
      errors.push(`Row ${r + 1}: missing both sku and product_name; skipped.`);
      continue;
    }

    const category = resolveCategoryId(pick(map, ['category', 'category_preset']));
    const preset = CATEGORY_BY_ID[category];

    const warningsRaw = pick(map, ['warnings', 'warning_ids', 'safety_warnings']);
    const parsedWarnings = warningsRaw
      ? warningsRaw
          .split(/[;|]+/)
          .map((s) => s.trim())
          .filter((id) => Boolean(WARNING_BY_ID[id]))
      : [...preset.defaultWarnings];

    const record = normalizeProductRecord({
      product: {
        name: name || sku,
        sku: sku || `SKU-${String(r).padStart(3, '0')}`,
        batchFormat: pick(map, ['batch_format', 'batch', 'lot', 'serial']) || 'LOT-YYYYMM-001',
        eanGtin: pick(map, ['ean_gtin', 'ean', 'gtin', 'barcode']),
        category,
        materials: pick(map, ['materials', 'material']) || 'Consumer-grade verified materials',
        intendedUse: pick(map, ['intended_use', 'use']) || `Standard consumer use (${preset.labelEn})`,
        targetUsers: pick(map, ['target_users', 'vulnerable_groups', 'users']) || 'General adult consumers',
      },
      manufacturer: {
        name: pick(map, ['manufacturer_name', 'manufacturer']) || fallbackOperators?.manufacturer?.name || '',
        tradeName: pick(map, ['manufacturer_trade_name', 'trade_name', 'brand']) || fallbackOperators?.manufacturer?.tradeName || '',
        postalAddress: pick(map, ['manufacturer_address', 'mfr_address']) || fallbackOperators?.manufacturer?.postalAddress || '',
        electronicAddress: pick(map, ['manufacturer_contact', 'manufacturer_email', 'mfr_contact']) || fallbackOperators?.manufacturer?.electronicAddress || '',
      },
      euResponsiblePerson: {
        name: pick(map, ['eu_rp_name', 'rp_name', 'responsible_person']) || fallbackOperators?.euResponsiblePerson?.name || '',
        euAddress: pick(map, ['eu_rp_address', 'rp_address', 'eu_address']) || fallbackOperators?.euResponsiblePerson?.euAddress || '',
        electronicAddress: pick(map, ['eu_rp_contact', 'rp_contact', 'eu_rp_email']) || fallbackOperators?.euResponsiblePerson?.electronicAddress || '',
      },
      warnings: parsedWarnings.length > 0 ? parsedWarnings : [...preset.defaultWarnings],
      customWarning: pick(map, ['custom_warning', 'extra_note']),
      hazards: createDefaultHazardsForCategory(category),
    });

    records.push(record);
  }

  return { records, errors };
}
