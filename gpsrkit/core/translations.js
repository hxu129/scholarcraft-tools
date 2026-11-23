/**
 * GPSRKit Pro — Verified 5-Language Safety Warning Phrasebook & Bilingual (EN/ZH) UI Copy
 *
 * Covers Regulation (EU) 2023/988 (GPSR) standard label headings and safety warnings in:
 *   - English (en)
 *   - German (de)
 *   - French (fr)
 *   - Spanish (es)
 *   - Italian (it)
 */

export const LABEL_LANGUAGES = Object.freeze([
  Object.freeze({ code: 'en', label: 'EN', nativeName: 'English', nameEn: 'English', nameZh: '英语 (EN)' }),
  Object.freeze({ code: 'de', label: 'DE', nativeName: 'Deutsch', nameEn: 'German', nameZh: '德语 (DE)' }),
  Object.freeze({ code: 'fr', label: 'FR', nativeName: 'Français', nameEn: 'French', nameZh: '法语 (FR)' }),
  Object.freeze({ code: 'es', label: 'ES', nativeName: 'Español', nameEn: 'Spanish', nameZh: '西班牙语 (ES)' }),
  Object.freeze({ code: 'it', label: 'IT', nativeName: 'Italiano', nameEn: 'Italian', nameZh: '意大利语 (IT)' }),
]);

export const LABEL_LANGUAGE_CODES = Object.freeze(LABEL_LANGUAGES.map((l) => l.code));

/**
 * Standard EU GPSR Article 9 & Article 16 label headings in 5 languages.
 */
export const LABEL_HEADINGS = Object.freeze({
  manufacturer: Object.freeze({
    en: 'Manufacturer',
    de: 'Hersteller',
    fr: 'Fabricant',
    es: 'Fabricante',
    it: 'Fabbricante',
  }),
  eu_rp: Object.freeze({
    en: 'EU Responsible Person',
    de: 'EU-Verantwortliche Person',
    fr: 'Personne responsable UE',
    es: 'Persona responsable UE',
    it: 'Persona responsabile UE',
  }),
  batch: Object.freeze({
    en: 'Batch / Lot',
    de: 'Chargennummer',
    fr: 'Numéro de lot',
    es: 'Número de lote',
    it: 'Numero di lotto',
  }),
  sku: Object.freeze({
    en: 'Model / SKU',
    de: 'Modell / Art.-Nr.',
    fr: 'Modèle / Réf.',
    es: 'Modelo / Ref.',
    it: 'Modello / Cod.',
  }),
  contact: Object.freeze({
    en: 'Electronic Contact',
    de: 'Elektronischer Kontakt',
    fr: 'Contact électronique',
    es: 'Contacto electrónico',
    it: 'Contatto elettronico',
  }),
  safety_info: Object.freeze({
    en: 'Safety Warnings & Instructions',
    de: 'Sicherheitshinweise & Anweisungen',
    fr: 'Avertissements et consignes de sécurité',
    es: 'Advertencias e instrucciones de seguridad',
    it: 'Avvertenze e istruzioni di sicurezza',
  }),
  warning_prefix: Object.freeze({
    en: 'WARNING',
    de: 'ACHTUNG',
    fr: 'AVERTISSEMENT',
    es: 'ADVERTENCIA',
    it: 'AVVERTENZA',
  }),
  caution_prefix: Object.freeze({
    en: 'CAUTION',
    de: 'VORSICHT',
    fr: 'ATTENTION',
    es: 'PRECAUCIÓN',
    it: 'ATTENZIONE',
  }),
});

/**
 * Verified built-in 5-language safety warning library.
 * Each entry contains full print/listing wording (`text`) and compact 50x30mm thermal wording (`shortText`).
 */
export const WARNING_PHRASES = Object.freeze([
  Object.freeze({
    id: 'choking_under_3',
    severity: 'warning',
    symbol: '0-3',
    hazardIds: ['small_parts_choking'],
    titleEn: 'Choking Hazard (<3 Years)',
    titleZh: '小零件窒息风险（3岁以下儿童禁用）',
    text: Object.freeze({
      en: 'WARNING: Choking hazard — small parts. Not suitable for children under 3 years.',
      de: 'ACHTUNG: Erstickungsgefahr durch verschluckbare Kleinteile. Nicht geeignet für Kinder unter 3 Jahren.',
      fr: 'AVERTISSEMENT : Risque d’étouffement — petites pièces. Ne convient pas aux enfants de moins de 3 ans.',
      es: 'ADVERTENCIA: Peligro de asfixia — piezas pequeñas. No apto para niños menores de 3 años.',
      it: 'AVVERTENZA: Pericolo di soffocamento — piccole parti. Non adatto a bambini di età inferiore a 3 anni.',
    }),
    shortText: Object.freeze({
      en: 'Small parts — choking hazard (<3 yrs).',
      de: 'Kleinteile — Erstickungsgefahr (<3 J.).',
      fr: 'Petites pièces — étouffement (<3 ans).',
      es: 'Piezas pequeñas — asfixia (<3 años).',
      it: 'Piccole parti — soffocamento (<3 anni).',
    }),
  }),
  Object.freeze({
    id: 'keep_away_from_fire',
    severity: 'warning',
    symbol: 'FLAME',
    hazardIds: ['flammability_thermal'],
    titleEn: 'Keep Away From Fire & Heat',
    titleZh: '远离火源、明火及高温热源',
    text: Object.freeze({
      en: 'WARNING: Keep away from fire, open flames, and high heat sources.',
      de: 'ACHTUNG: Von Feuer, offenen Flammen und starken Wärmequellen fernhalten.',
      fr: 'AVERTISSEMENT : Tenir éloigné du feu, des flammes nues et des sources de forte chaleur.',
      es: 'ADVERTENCIA: Mantener alejado del fuego, llamas abiertas y fuentes de calor intenso.',
      it: 'AVVERTENZA: Tenere lontano dal fuoco, da fiamme libere e da fonti di calore intenso.',
    }),
    shortText: Object.freeze({
      en: 'Keep away from fire & flames.',
      de: 'Von Feuer und Flammen fernhalten.',
      fr: 'Tenir éloigné du feu et flammes.',
      es: 'Mantener alejado del fuego.',
      it: 'Tenere lontano dal fuoco.',
    }),
  }),
  Object.freeze({
    id: 'plastic_bag_suffocation',
    severity: 'warning',
    symbol: 'BAG',
    hazardIds: ['suffocation_packaging'],
    titleEn: 'Plastic Bag Suffocation Warning',
    titleZh: '塑料包装袋窒息警示（远离婴幼儿）',
    text: Object.freeze({
      en: 'WARNING: Danger of suffocation. Keep plastic bags and packaging film away from babies and children.',
      de: 'ACHTUNG: Erstickungsgefahr. Plastiktüten und Verpackungsfolien von Babys und Kindern fernhalten.',
      fr: 'AVERTISSEMENT : Risque de suffocation. Tenir les sacs en plastique et films d’emballage hors de portée des bébés et des enfants.',
      es: 'ADVERTENCIA: Peligro de asfixia. Mantener las bolsas de plástico y el film de embalaje fuera del alcance de bebés y niños.',
      it: 'AVVERTENZA: Pericolo di soffocamento. Tenere i sacchetti di plastica e le pellicole di imballaggio lontano da neonati e bambini.',
    }),
    shortText: Object.freeze({
      en: 'Suffocation hazard — keep bag away from children.',
      de: 'Erstickungsgefahr — Folie von Kindern fernhalten.',
      fr: 'Suffocation — éloigner le sac des enfants.',
      es: 'Asfixia — alejar bolsa de niños.',
      it: 'Soffocamento — sacchetto lontano dai bambini.',
    }),
  }),
  Object.freeze({
    id: 'indoor_electrical_safety',
    severity: 'warning',
    symbol: 'ELEC',
    hazardIds: ['electrical_battery_usb'],
    titleEn: 'Indoor Electrical & USB Safety',
    titleZh: '室内干燥环境电气与 USB 电源安全',
    text: Object.freeze({
      en: 'WARNING: For indoor dry-location use only. Use a certified 5V USB power source; do not immerse in water or disassemble.',
      de: 'ACHTUNG: Nur für den trockenen Innenbereich geeignet. Geprüftes 5V-USB-Netzteil verwenden; nicht in Wasser tauchen oder öffnen.',
      fr: 'AVERTISSEMENT : Usage intérieur en milieu sec uniquement. Utiliser une alimentation USB 5 V certifiée ; ne pas immerger ni démonter.',
      es: 'ADVERTENCIA: Solo para uso en interiores secos. Utilizar una fuente USB de 5 V certificada; no sumergir en agua ni desmontar.',
      it: 'AVVERTENZA: Solo per uso interno in ambienti asciutti. Utilizzare un alimentatore USB 5 V certificato; non immergere in acqua né smontare.',
    }),
    shortText: Object.freeze({
      en: 'Indoor dry use only (5V USB); do not open.',
      de: 'Nur Innenbereich (5V USB); nicht öffnen.',
      fr: 'Usage intérieur sec (USB 5V) ; ne pas ouvrir.',
      es: 'Solo interior seco (USB 5V); no abrir.',
      it: 'Solo interno asciutto (USB 5V); non aprire.',
    }),
  }),
  Object.freeze({
    id: 'not_a_toy',
    severity: 'caution',
    symbol: 'NO-TOY',
    hazardIds: ['foreseeable_misuse'],
    titleEn: 'Not a Toy (Adult Use Only)',
    titleZh: '非玩具声明（仅供成人日常/装饰使用）',
    text: Object.freeze({
      en: 'CAUTION: This product is not a toy. Functional or decorative adult item only.',
      de: 'VORSICHT: Dieses Produkt ist kein Spielzeug. Nur als Gebrauchs- oder Dekorationsartikel für Erwachsene bestimmt.',
      fr: 'ATTENTION : Ce produit n’est pas un jouet. Article utilitaire ou décoratif réservé aux adultes.',
      es: 'PRECAUCIÓN: Este producto no es un juguete. Artículo funcional o decorativo solo para adultos.',
      it: 'ATTENZIONE: Questo prodotto non è un giocattolo. Articolo funzionale o decorativo riservato agli adulti.',
    }),
    shortText: Object.freeze({
      en: 'Not a toy — adult item only.',
      de: 'Kein Spielzeug — nur für Erwachsene.',
      fr: 'Pas un jouet — réservé aux adultes.',
      es: 'No es un juguete — solo adultos.',
      it: 'Non è un giocattolo — solo adulti.',
    }),
  }),
  Object.freeze({
    id: 'keep_out_of_reach_children',
    severity: 'warning',
    symbol: 'CHILD',
    hazardIds: ['small_parts_choking', 'foreseeable_misuse'],
    titleEn: 'Keep Out of Reach of Children',
    titleZh: '请置于儿童及宠物接触不到的地方',
    text: Object.freeze({
      en: 'WARNING: Keep out of reach of children and pets.',
      de: 'ACHTUNG: Außerhalb der Reichweite von Kindern und Haustieren aufbewahren.',
      fr: 'AVERTISSEMENT : Tenir hors de portée des enfants et des animaux domestiques.',
      es: 'ADVERTENCIA: Mantener fuera del alcance de niños y mascotas.',
      it: 'AVVERTENZA: Tenere fuori dalla portata di bambini e animali domestici.',
    }),
    shortText: Object.freeze({
      en: 'Keep out of reach of children & pets.',
      de: 'Von Kindern & Haustieren fernhalten.',
      fr: 'Hors de portée des enfants/animaux.',
      es: 'Fuera del alcance de niños/mascotas.',
      it: 'Fuori portata di bambini/animali.',
    }),
  }),
  Object.freeze({
    id: 'allergen_nickel_magnet',
    severity: 'warning',
    symbol: 'ALLERGEN',
    hazardIds: ['chemical_skin_reach', 'small_parts_choking'],
    titleEn: 'Allergen / Metal Alloy / Small Magnet Warning',
    titleZh: '过敏原、金属接触与小磁铁吞咽警示',
    text: Object.freeze({
      en: 'WARNING: Contains metal alloys or small magnets. Discontinue use if skin irritation occurs; seek immediate medical care if magnets are swallowed.',
      de: 'ACHTUNG: Enthält Metalllegierungen oder kleine Magnete. Bei Hautreizungen nicht weiterverwenden; bei Verschlucken von Magneten sofort ärztliche Hilfe rufen.',
      fr: 'AVERTISSEMENT : Contient des alliages métalliques ou de petits aimants. Cesser l’utilisation en cas d’irritation cutanée ; consulter immédiatement un médecin en cas d’ingestion d’aimants.',
      es: 'ADVERTENCIA: Contiene aleaciones metálicas o imanes pequeños. Suspender el uso si aparece irritación cutánea; acudir de inmediato al médico si se ingieren imanes.',
      it: 'AVVERTENZA: Contiene leghe metalliche o piccoli magneti. Interrompere l’uso in caso di irritazione cutanea; consultare immediatamente un medico in caso di ingestione di magneti.',
    }),
    shortText: Object.freeze({
      en: 'Metal/magnet warning; stop if skin reacts.',
      de: 'Metall-/Magnetwarnung; bei Reizung absetzen.',
      fr: 'Métal/aimants ; cesser si irritation.',
      es: 'Metal/imanes; suspender si irrita.',
      it: 'Metalli/magneti; sospendere se irrita.',
    }),
  }),
  Object.freeze({
    id: 'care_and_disposal',
    severity: 'notice',
    symbol: 'CARE',
    hazardIds: ['labeling_traceability'],
    titleEn: 'Inspection, Care & Disposal Notice',
    titleZh: '使用前检查、养护与本地回收处置说明',
    text: Object.freeze({
      en: 'NOTICE: Inspect before use and discard if damaged. Dispose of product and packaging in accordance with local recycling regulations.',
      de: 'HINWEIS: Vor Gebrauch prüfen und bei Beschädigung entsorgen. Produkt und Verpackung gemäß den örtlichen Recyclingvorschriften entsorgen.',
      fr: 'REMARQUE : Inspecter avant utilisation et jeter en cas de dommage. Éliminer le produit et l’emballage conformément aux règles locales de recyclage.',
      es: 'AVISO: Inspeccionar antes de usar y desechar si está dañado. Eliminar el producto y el embalaje según las normas locales de reciclaje.',
      it: 'AVVISO: Ispezionare prima dell’uso e smaltire se danneggiato. Smaltire prodotto e imballaggio secondo le norme locali sul riciclaggio.',
    }),
    shortText: Object.freeze({
      en: 'Inspect before use; recycle per local rules.',
      de: 'Vor Gebrauch prüfen; lokal recyceln.',
      fr: 'Vérifier avant usage ; recycler localement.',
      es: 'Revisar antes de usar; reciclar localmente.',
      it: 'Controllare prima dell’uso; riciclare.',
    }),
  }),
  Object.freeze({
    id: 'fragile_breakage',
    severity: 'caution',
    symbol: 'FRAGILE',
    hazardIds: ['fragile_breakage', 'flammability_thermal'],
    titleEn: 'Fragile Glass/Ceramic & Hot Liquid Caution',
    titleZh: '易碎防裂与防热饮烫伤提醒',
    text: Object.freeze({
      en: 'CAUTION: Fragile item — handle with care to avoid breakage and sharp shards. Hot liquids may cause scalding.',
      de: 'VORSICHT: Zerbrechlicher Artikel — vorsichtig handhaben, um Bruch und scharfe Scherben zu vermeiden. Heiße Flüssigkeiten können Verbrühungen verursachen.',
      fr: 'ATTENTION : Article fragile — manipuler avec soin pour éviter la casse et les éclats coupants. Les liquides chauds peuvent provoquer des brûlures.',
      es: 'PRECAUCIÓN: Artículo frágil — manipular con cuidado para evitar roturas y fragmentos cortantes. Los líquidos calientes pueden causar quemaduras.',
      it: 'ATTENZIONE: Articolo fragile — maneggiare con cura per evitare rotture e schegge taglienti. I liquidi caldi possono causare ustioni.',
    }),
    shortText: Object.freeze({
      en: 'Fragile — avoid impact; hot liquid scald risk.',
      de: 'Zerbrechlich; Verbrühungsgefahr bei Heißgetränken.',
      fr: 'Fragile — éviter chocs ; risque brûlure.',
      es: 'Frágil — evitar golpes; líquidos calientes.',
      it: 'Fragile — evitare urti; liquidi caldi.',
    }),
  }),
  Object.freeze({
    id: 'sharp_edges_splinters',
    severity: 'caution',
    symbol: 'EDGE',
    hazardIds: ['sharp_edges_pinch'],
    titleEn: 'Sharp Edges, Pinch & Splinter Check',
    titleZh: '边缘毛刺、夹伤与木刺检查提示',
    text: Object.freeze({
      en: 'CAUTION: Inspect edges and joints before use. Handle carefully to avoid cuts, pinching, or splinters.',
      de: 'VORSICHT: Kanten und Verbindungen vor Gebrauch prüfen. Vorsichtig handhaben, um Schnitte, Quetschungen oder Splitter zu vermeiden.',
      fr: 'ATTENTION : Vérifier les bords et assemblages avant utilisation. Manipuler avec précaution pour éviter coupures, pincements ou échardes.',
      es: 'PRECAUCIÓN: Revisar bordes y uniones antes de usar. Manipular con cuidado para evitar cortes, pellizcos o astillas.',
      it: 'ATTENZIONE: Controllare bordi e giunzioni prima dell’uso. Maneggiare con cautela per evitare tagli, schiacciamenti o schegge.',
    }),
    shortText: Object.freeze({
      en: 'Check edges before use; avoid cuts/splinters.',
      de: 'Kanten prüfen; Schnitte/Splitter vermeiden.',
      fr: 'Vérifier bords ; éviter coupures/échardes.',
      es: 'Revisar bordes; evitar cortes/astillas.',
      it: 'Controllare bordi; evitare tagli/schegge.',
    }),
  }),
  Object.freeze({
    id: 'strangulation_cord',
    severity: 'warning',
    symbol: 'CORD',
    hazardIds: ['strangulation_cords'],
    titleEn: 'Strangulation Hazard (Cords / Cables)',
    titleZh: '线缆与绳索缠绕窒息警示',
    text: Object.freeze({
      en: 'WARNING: Strangulation hazard — keep cords, cables, and drawstrings out of reach of young children.',
      de: 'ACHTUNG: Strangulationsgefahr — Schnüre, Kabel und Kordeln außer Reichweite von Kleinkindern halten.',
      fr: 'AVERTISSEMENT : Risque de strangulation — tenir les cordons, câbles et liens hors de portée des jeunes enfants.',
      es: 'ADVERTENCIA: Peligro de estrangulamiento — mantener cordones, cables y cintas fuera del alcance de niños pequeños.',
      it: 'AVVERTENZA: Pericolo di strangolamento — tenere corde, cavi e laccetti fuori dalla portata dei bambini piccoli.',
    }),
    shortText: Object.freeze({
      en: 'Strangulation risk — keep cords from children.',
      de: 'Strangulationsgefahr — Kabel fernhalten.',
      fr: 'Strangulation — éloigner les câbles.',
      es: 'Estrangulamiento — alejar cables.',
      it: 'Strangolamento — cavi lontani dai bambini.',
    }),
  }),
  Object.freeze({
    id: 'adult_supervision',
    severity: 'warning',
    symbol: 'ADULT',
    hazardIds: ['foreseeable_misuse', 'small_parts_choking'],
    titleEn: 'Use Under Adult Supervision',
    titleZh: '需在成人直接监护下使用',
    text: Object.freeze({
      en: 'WARNING: Use only under direct adult supervision. Follow all assembly and usage instructions.',
      de: 'ACHTUNG: Nur unter unmittelbarer Aufsicht von Erwachsenen verwenden. Alle Montage- und Gebrauchshinweise beachten.',
      fr: 'AVERTISSEMENT : Utiliser uniquement sous la surveillance directe d’un adulte. Respecter toutes les instructions de montage et d’utilisation.',
      es: 'ADVERTENCIA: Utilizar únicamente bajo la supervisión directa de un adulto. Seguir todas las instrucciones de montaje y uso.',
      it: 'AVVERTENZA: Utilizzare solo sotto la diretta supervisione di un adulto. Seguire tutte le istruzioni de montaggio e utilizzo.',
    }),
    shortText: Object.freeze({
      en: 'Use only under direct adult supervision.',
      de: 'Nur unter Aufsicht von Erwachsenen nutzen.',
      fr: 'Utiliser sous surveillance d’un adulte.',
      es: 'Usar bajo supervisión directa de adultos.',
      it: 'Usare sotto supervisione di un adulto.',
    }),
  }),
]);

export const WARNING_BY_ID = Object.freeze(
  Object.fromEntries(WARNING_PHRASES.map((w) => [w.id, w])),
);

export function getWarningPhrase(id) {
  return WARNING_BY_ID[id] || null;
}

export function getHeading(key, lang = 'en') {
  const entry = LABEL_HEADINGS[key];
  if (!entry) return key;
  return entry[lang] || entry.en;
}

export const DISCLAIMER_TEXT = Object.freeze({
  en: 'IMPORTANT LEGAL NOTICE: GPSRKit Pro is an offline structured documentation and label formatting utility designed to assist economic operators in organizing internal risk analyses and product information under Regulation (EU) 2023/988 (GPSR). It does NOT constitute legal advice, formal conformity assessment, accredited laboratory testing, or an Article 16 EU Responsible Person agency service. The manufacturer, importer, or appointed EU Responsible Person remains solely responsible for verifying product safety, applicable harmonized standards, and regulatory compliance before placing products on the EU market.',
  zh: '重要合规边界声明：GPSRKit Pro 是一款 100% 本地离线运行的结构化技术文档与多语种标签排版工具，用于协助制造商与跨境卖家整理《欧盟通用产品安全法规 (EU) 2023/988 (GPSR)》第 9 条内部风险评估记录与产品标签信息。本工具不构成法律意见、律师代理、认证实验室检测报告，也不提供欧盟第 16 条欧代（EU Responsible Person）代理服务。产品投放欧盟市场前，制造商、进口商及签约欧代须自行核验产品安全性、适用协调标准与最终合规责任。',
});

/**
 * Bilingual EN/ZH UI Copy Dictionary
 */
export const UI_STRINGS = Object.freeze({
  en: Object.freeze({
    appSubtitle: 'EU GPSR (2023/988) Article 9 Technical File, 5-Language Label & Marketplace Studio',
    badgeFree: 'FREE',
    badgePro: 'PRO',
    btnLicenseFree: 'Unlock Pro ($29)',
    btnLicensePro: 'Pro License',
    btnLangToggle: '中文',
    offlinePill: '100% Offline · Zero Upload',
    sampleLabel: 'Load Sample:',
    sampleCeramicMug: 'Ceramic Mug',
    sampleWoodenCraft: 'Wooden Craft',
    sampleUsbLamp: 'USB Desk Lamp',

    tabProduct: '1. Product & Operators',
    tabRisk: '2. Risk Matrix (10)',
    tabWarnings: '3. 5-Lang Warnings',
    tabBatch: '4. Batch CSV → ZIP',

    outTabLabels: 'Multilingual Labels',
    outTabTechFile: 'Article 9 Technical File',
    outTabMarketplace: 'Amazon / Etsy / Shopify',

    secProduct: 'Product Identification & Traceability (Art. 9(5))',
    secManufacturer: 'Manufacturer Details (Art. 9(6))',
    secEuRp: 'EU Responsible Person (Article 16 RP)',
    secProfiles: 'Saved Manufacturer / EU RP Profiles',
    profileSelectPlaceholder: '— Select saved profile —',
    btnSaveProfile: 'Save Current Operators',
    btnDeleteProfile: 'Delete',
    profileProNote: 'Pro feature: save reusable Manufacturer & EU RP profiles locally.',

    lblProductName: 'Product Name',
    lblSku: 'SKU / Model Number',
    lblBatchFormat: 'Batch / Lot / Serial Format',
    lblEan: 'EAN / GTIN (Optional)',
    lblCategory: 'Product Category Preset',
    lblMaterials: 'Materials & Components',
    lblIntendedUse: 'Intended Use',
    lblTargetUsers: 'Target Users & Vulnerable Groups',
    lblMfrName: 'Legal Name',
    lblMfrTrade: 'Registered Trade Name / Brand',
    lblMfrAddress: 'Postal Street Address',
    lblMfrContact: 'Electronic Address (Email or URL)',
    lblRpName: 'EU RP Name / Entity',
    lblRpAddress: 'EU Street Address (Must be in EU/EEA)',
    lblRpContact: 'EU RP Electronic Address (Email or URL)',
    lblApplyPresetHint: 'Changing category offers to refresh default risk baselines & warnings.',
    btnApplyPreset: 'Apply Category Risk Defaults',

    riskMatrixTitle: 'EU GPSR Article 9(2) Internal Risk Analysis Matrix',
    riskMatrixSub: 'Rate Likelihood (1–4) × Severity (1–4) across all 10 hazard dimensions. High (8–11) & Critical (12–16) hazards require concrete mitigation steps.',
    colHazard: 'Hazard Dimension',
    colApplicable: 'Active',
    colLikelihood: 'Likelihood',
    colSeverity: 'Severity',
    colScore: 'Risk',
    lblMitigation: 'Mitigation Measures & Control Plan',
    lblStandards: 'Relevant Harmonized Standards Hints',
    likelihoodOpts: ['1 · Rare', '2 · Unlikely', '3 · Possible', '4 · Likely'],
    severityOpts: ['1 · Minor', '2 · Moderate', '3 · Serious', '4 · Severe'],
    levelNa: 'N/A',
    levelLow: 'Low',
    levelMedium: 'Medium',
    levelHigh: 'High',
    levelCritical: 'Critical',

    warningsTitle: 'Verified 5-Language Safety Warning Phrasebook',
    warningsSub: 'Select applicable warnings. Free tier previews EN + DE; Pro unlocks full 5-language (EN / DE / FR / ES / IT) print-ready sheets.',
    lblCustomWarning: 'Additional Product-Specific Note (Optional, EN)',
    customWarningPh: 'e.g., Hand wash recommended. Do not microwave metallic rim.',

    batchTitle: 'Batch Multi-SKU CSV → ZIP Generator',
    batchSub: 'Import a catalog CSV to generate complete Article 9 Technical Files (HTML + JSON), Thermal & A4 Label Sheets, and Marketplace Copy for every SKU in one offline UTF-8 .zip archive.',
    btnLoadSampleCsv: 'Load 3-SKU Sample CSV',
    btnUploadCsv: 'Upload CSV File',
    btnExportZip: 'Generate & Download All SKUs (.zip)',
    batchEmptyHint: 'Paste CSV rows or click "Load 3-SKU Sample CSV" to inspect per-SKU readiness.',
    batchProBanner: 'Batch Multi-SKU CSV → ZIP export is a Pro feature. Preview parsed SKUs for free, or unlock Pro ($29 one-time) to download the complete archive.',
    batchColSku: 'SKU',
    batchColName: 'Product Name',
    batchColCat: 'Category',
    batchColReadiness: 'Readiness',
    batchColAlerts: 'Blocking Alerts',
    batchParsedCount: '{count} SKU(s) parsed',

    readinessTitle: 'GPSR Completeness Readiness',
    readinessReady: 'Submission-Ready',
    readinessAttention: 'Needs Fixes',
    readinessIncomplete: 'Incomplete',
    readinessPassed: 'Passed',
    readinessMissing: 'Action Required',
    readinessSha: 'Document SHA-256:',

    labelLayoutThermal: '50×30mm Thermal Roll',
    labelLayoutA4: 'A4 Cut Grid (2×5)',
    labelLangTitle: 'Languages:',
    btnExportLabelHtml: 'Download Printable Label HTML',
    btnPrintLabel: 'Open Print View',
    freeLabelBanner: 'Free tier includes 2-language (EN + DE) live preview. Unlock Pro ($29) for full 5-language (EN / DE / FR / ES / IT) print-ready Thermal & A4 exports.',
    thermalOverflowHint: 'Tip: 50×30mm thermal labels automatically use compact phrasing (top 2–3 warnings) to prevent text overflow.',

    techFileBannerFree: 'Free tier shows an interactive summary preview. Unlock Pro ($29) to export & print the full 10-year Archivable Article 9 Technical File (HTML/PDF-ready + JSON backup).',
    btnPrintTechFile: 'Print / Save PDF (10-Yr Archive)',
    btnDownloadTechHtml: 'Download HTML Dossier',
    btnDownloadTechJson: 'Download JSON Backup',

    mpAmazon: 'Amazon Seller Central',
    mpEtsy: 'Etsy Listing Safety',
    mpShopify: 'Shopify Compliance Block',
    btnCopy: 'Copy to Clipboard',
    btnCopied: 'Copied!',
    mpFreeIncluded: 'Included free — copy directly into your EU storefront.',

    modalLicenseTitle: 'Activate GPSRKit Pro',
    modalLicenseSub: 'Unlock 10-Year Printable Article 9 Technical Files, 5-Language Thermal/A4 Label Sheets, Batch CSV→ZIP Export, and Saved Operator Profiles.',
    lblLicenseKey: 'License Key (`GPSR1.*` Offline Key or Gumroad Key)',
    phLicenseKey: 'GPSR1.R1BTUjEuZ3Bzci5wcm8u... or XXXXXXXX-XXXXXXXX-...',
    btnActivate: 'Verify & Activate',
    btnClearLicense: 'Deactivate Key',
    btnClose: 'Close',
    btnBuyGumroad: 'Buy Pro on Gumroad ($29)',
    btnBuyMbd: '国内购买 · 面包多',
    licenseActiveStatus: 'Pro license active ({mode}) · Serial: {serial}',
    licenseInvalidPrefix: 'Activation failed: ',
    licenseSuccess: 'Pro unlocked! All 5-language exports, Technical Files, Batch ZIP, and Profiles are now active.',

    toastSampleLoaded: 'Loaded sample product: {name}',
    toastPresetApplied: 'Applied category risk defaults for {cat}',
    toastProfileSaved: 'Saved operator profile "{name}"',
    toastProfileLoaded: 'Loaded operator profile "{name}"',
    toastProfileDeleted: 'Deleted operator profile',
    toastZipDone: 'Generated ZIP archive ({files} files for {skus} SKUs)',
    toastExportDone: 'Downloaded {file}',
    toastProRequired: 'This export requires GPSRKit Pro ($29 one-time).',
    promptProfileName: 'Enter a name for this Manufacturer + EU RP profile:',
  }),

  zh: Object.freeze({
    appSubtitle: '欧盟 GPSR (2023/988) 第 9 条技术文档、五语安全标签与跨境平台合规文案工作室',
    badgeFree: '免费版',
    badgePro: '专业版',
    btnLicenseFree: '解锁 Pro ($29)',
    btnLicensePro: '管理授权',
    btnLangToggle: 'EN',
    offlinePill: '100% 本地离线 · 零数据上传',
    sampleLabel: '一键示例：',
    sampleCeramicMug: '陶瓷马克杯',
    sampleWoodenCraft: '木质工艺品',
    sampleUsbLamp: 'USB 台灯',

    tabProduct: '1. 产品与欧代信息',
    tabRisk: '2. 风险评估矩阵 (10项)',
    tabWarnings: '3. 五语安全警示',
    tabBatch: '4. 批量 CSV → ZIP',

    outTabLabels: '多语种打印标签',
    outTabTechFile: '第 9 条技术文档',
    outTabMarketplace: 'Amazon / Etsy / Shopify 文案',

    secProduct: '产品身份与可追溯性（GPSR 第 9(5) 条）',
    secManufacturer: '制造商信息（GPSR 第 9(6) 条）',
    secEuRp: '欧盟负责人 / 欧代信息（GPSR 第 16 条）',
    secProfiles: '常用制造商与欧代档案库',
    profileSelectPlaceholder: '— 选择已保存的欧代/制造商档案 —',
    btnSaveProfile: '保存当前主体档案',
    btnDeleteProfile: '删除',
    profileProNote: 'Pro 专属：本地一键保存并复用常用制造商与欧代组合。',

    lblProductName: '产品名称（英文/欧盟报备名）',
    lblSku: 'SKU / 型号编码',
    lblBatchFormat: '批次 / 序列号格式（Batch / Lot / Serial）',
    lblEan: 'EAN / GTIN 条码（选填）',
    lblCategory: '类目合规预设',
    lblMaterials: '主要材质与组件构成',
    lblIntendedUse: '预期用途（Intended Use）',
    lblTargetUsers: '目标人群与易感群体（儿童/老人/过敏等）',
    lblMfrName: '制造商法定名称',
    lblMfrTrade: '注册商标 / 品牌名',
    lblMfrAddress: '制造商邮寄街道地址',
    lblMfrContact: '电子联系方式（邮箱或官网 URL）',
    lblRpName: '欧代公司/个人名称',
    lblRpAddress: '欧盟境内街道地址（EU/EEA 实体地址）',
    lblRpContact: '欧代电子联系方式（邮箱或官网 URL）',
    lblApplyPresetHint: '切换类目后，可一键载入该类目的默认风险基线与推荐警示语。',
    btnApplyPreset: '载入该类目风险基线',

    riskMatrixTitle: '欧盟 GPSR 第 9(2) 条内部风险评估矩阵',
    riskMatrixSub: '针对 10 个核心风险维度评估「发生概率 (1–4) × 严重程度 (1–4)」。高风险 (8–11) 与严重风险 (12–16) 必须填写具体缓解措施。',
    colHazard: '风险维度',
    colApplicable: '适用',
    colLikelihood: '发生概率',
    colSeverity: '严重程度',
    colScore: '风险等级',
    lblMitigation: '风险缓解与控制措施',
    lblStandards: '参考欧盟协调标准提示',
    likelihoodOpts: ['1 · 罕见', '2 · 较低', '3 · 可能', '4 · 较高'],
    severityOpts: ['1 · 轻微', '2 · 中等', '3 · 严重', '4 · 极严重'],
    levelNa: '不适用',
    levelLow: '低风险',
    levelMedium: '中风险',
    levelHigh: '高风险',
    levelCritical: '严重风险',

    warningsTitle: '已校验 5 语种欧盟安全警示语库（EN / DE / FR / ES / IT）',
    warningsSub: '勾选产品适用的安全警示。免费版支持英德双语预览；Pro 解锁完整英/德/法/西/意五语种可打印标签页。',
    lblCustomWarning: '补充产品专属安全说明（选填，建议英文）',
    customWarningPh: '例如：Hand wash recommended. Do not microwave metallic rim.',

    batchTitle: '批量多 SKU CSV 导入 → 一键打包 ZIP',
    batchSub: '导入多款产品 CSV，离线批量为每个 SKU 生成完整第 9 条技术文档（HTML + JSON）、热敏/A4 五语标签页与平台合规文案，打包为 UTF-8 .zip 文件。',
    btnLoadSampleCsv: '载入 3 SKU 示例 CSV',
    btnUploadCsv: '上传本地 CSV',
    btnExportZip: '批量生成并下载全套 ZIP',
    batchEmptyHint: '粘贴 CSV 内容或点击「载入 3 SKU 示例 CSV」，即时查看逐款 SKU 的合规就绪度。',
    batchProBanner: '批量多 SKU CSV → ZIP 导出为 Pro 功能。免费版可预览解析结果与各 SKU 合规度，解锁 Pro ($29 一次买断) 即可一键导出全套文档包。',
    batchColSku: 'SKU 型号',
    batchColName: '产品名称',
    batchColCat: '类目',
    batchColReadiness: '就绪度',
    batchColAlerts: '阻断项提示',
    batchParsedCount: '已解析 {count} 个 SKU',

    readinessTitle: 'GPSR 合规完整度评分',
    readinessReady: '可归档 / 可上架',
    readinessAttention: '需补全项',
    readinessIncomplete: '存在阻断缺失',
    readinessPassed: '已达标',
    readinessMissing: '待补齐',
    readinessSha: '文档 SHA-256 指纹：',

    labelLayoutThermal: '50×30mm 热敏卷标',
    labelLayoutA4: 'A4 排版页 (2×5)',
    labelLangTitle: '标签语种：',
    btnExportLabelHtml: '下载可打印标签 HTML',
    btnPrintLabel: '打开打印预览',
    freeLabelBanner: '免费版支持英德双语 (EN + DE) 标签实时预览。升级 Pro ($29) 解锁完整五语种 (EN/DE/FR/ES/IT) 热敏与 A4 可打印标签导出。',
    thermalOverflowHint: '排版提示：50×30mm 热敏标签自动启用精简版五语警示（优先显示前 2–3 条），确保零文字溢出。',

    techFileBannerFree: '免费版可实时查看技术文档结构摘要。升级 Pro ($29) 解锁完整 10 年可归档第 9 条技术文档（Print-to-PDF HTML 与 JSON 备份）导出。',
    btnPrintTechFile: '打印 / 另存 PDF（10 年留档）',
    btnDownloadTechHtml: '下载 HTML 技术文档',
    btnDownloadTechJson: '下载 JSON 结构备份',

    mpAmazon: 'Amazon 卖家后台',
    mpEtsy: 'Etsy 商品安全区',
    mpShopify: 'Shopify 独立站合规模块',
    btnCopy: '一键复制文案',
    btnCopied: '已复制！',
    mpFreeIncluded: '免费版直接可用 — 一键粘贴至欧盟店铺后台。',

    modalLicenseTitle: '激活 GPSRKit Pro 专业版',
    modalLicenseSub: '一次买断解锁：10 年留档第 9 条技术文档（PDF/HTML/JSON）、完整五语种热敏/A4 标签导出、多 SKU 批量 CSV→ZIP 打包与欧代档案保存。',
    lblLicenseKey: '输入授权码（`GPSR1.*` 离线签名密钥或 Gumroad 授权码）',
    phLicenseKey: 'GPSR1.R1BTUjEuZ3Bzci5wcm8u... 或 XXXXXXXX-XXXXXXXX-...',
    btnActivate: '验证并激活',
    btnClearLicense: '清除本地授权',
    btnClose: '关闭',
    btnBuyGumroad: 'Gumroad 购买 Pro ($29)',
    btnBuyMbd: '国内购买 · 面包多',
    licenseActiveStatus: 'Pro 授权已激活（{mode}）· 编号：{serial}',
    licenseInvalidPrefix: '激活失败：',
    licenseSuccess: 'Pro 专业版已解锁！完整五语种标签、10 年技术文档、批量 ZIP 与欧代档案库现已全部开放。',

    toastSampleLoaded: '已载入示例产品：{name}',
    toastPresetApplied: '已应用「{cat}」类目的默认风险基线与警示语',
    toastProfileSaved: '已保存主体档案「{name}」',
    toastProfileLoaded: '已套用主体档案「{name}」',
    toastProfileDeleted: '已删除主体档案',
    toastZipDone: '已生成离线 ZIP 文档包（共 {skus} 个 SKU，{files} 个文件）',
    toastExportDone: '已下载文件：{file}',
    toastProRequired: '该导出功能需要 GPSRKit Pro 专业版（$29 一次买断）。',
    promptProfileName: '请为当前制造商 + 欧代组合输入档案名称：',
  }),
});

export function t(lang, key, vars = null) {
  const dict = UI_STRINGS[lang === 'zh' ? 'zh' : 'en'] || UI_STRINGS.en;
  let value = dict[key];
  if (value === undefined) {
    value = UI_STRINGS.en[key] ?? key;
  }
  if (typeof value !== 'string' || !vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, name) => (vars[name] !== undefined ? String(vars[name]) : `{${name}}`));
}
