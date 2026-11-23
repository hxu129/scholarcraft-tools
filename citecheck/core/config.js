/**
 * CiteCheck Pro — Core Configuration
 * Zero-dependency ES module compatible with Chrome MV3, modern browsers, and Node v22.
 */

export const APP_NAME = 'CiteCheck Pro';
export const APP_VERSION = '1.0.0';
export const PRODUCT_ID = 'cite';
export const LICENSE_PREFIX = 'CITE1';

/** Number of references included per audit in the Free tier. */
export const FREE_LIMIT = 8;

/**
 * Embedded ECDSA P-256 Public JWK used for 100% offline verification of
 * signed `CITE1.<payload>.<sig>` license keys.
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
 * Replace placeholder slugs with your live storefront checkout URLs before release.
 */
export const PURCHASE_URLS = Object.freeze({
  mianbaoduo: 'https://mbd.pub/o/bread/citecheck-pro',
  gumroad: 'https://hxucreativity28.gumroad.com/l/citecheck-pro',
  lemonsqueezy: 'https://hxucreativity28.gumroad.com/l/citecheck-pro',
});

/**
 * Optional online UUID license validation for Lemon Squeezy / Gumroad buyers.
 * Offline `CITE1.*` keys work immediately with zero backend or network calls.
 */
export const ONLINE_LICENSE_PROVIDERS = Object.freeze({
  lemonSqueezy: Object.freeze({
    enabled: false,
    storeId: '', // e.g. '123456'
    productId: '', // optional product ID filter
    validateUrl: 'https://api.lemonsqueezy.com/v1/licenses/validate',
  }),
  gumroad: Object.freeze({
    enabled: true,
    productId: '3mJaU7kwhoHvd-WwTgjKNQ==',
    productPermalink: 'citecheck-pro',
    validateUrl: 'https://api.gumroad.com/v2/licenses/verify',
  }),
});

/**
 * Scholarly API settings (zero-auth public endpoints).
 */
export const API_CONFIG = Object.freeze({
  concurrency: 3,
  timeoutMs: 10000,
  maxRetries: 2,
  retryBaseDelayMs: 600,
  openalexBaseUrl: 'https://api.openalex.org',
  crossrefBaseUrl: 'https://api.crossref.org',
  dblpBaseUrl: 'https://dblp.org/search/publ/api',
  politeEmail: '',
});

export const STORAGE_KEYS = Object.freeze({
  license: 'citecheck_pro_license_v1',
  lang: 'citecheck_pro_lang_v1',
});

/**
 * Curated 5-case live demo covering every core CiteCheck Pro verdict:
 * 1. VERIFIED classic (NeurIPS 2017)
 * 2. ARXIV_PUBLISHED (cited as arXiv:1512.03385, published at CVPR 2016)
 * 3. RETRACTED (Wakefield et al., The Lancet 1998)
 * 4. METADATA_MISMATCH (wrong publication year for LeCun et al., Nature 2015)
 * 5. SUSPECT_HALLUCINATION (fabricated LLM-style citation)
 */
export const DEMO_BIBTEX = `@inproceedings{vaswani2017attention,
  title={Attention Is All You Need},
  author={Vaswani, Ashish and Shazeer, Noam and Parmar, Niki and Uszkoreit, Jakob and Jones, Llion and Gomez, Aidan N. and Kaiser, {\\L}ukasz and Polosukhin, Illia},
  booktitle={Advances in Neural Information Processing Systems},
  year={2017}
}

@article{he2015resnet_arxiv,
  title={Deep Residual Learning for Image Recognition},
  author={He, Kaiming and Zhang, Xiangyu and Ren, Shaoqing and Sun, Jian},
  journal={arXiv preprint arXiv:1512.03385},
  year={2015}
}

@article{wakefield1998ileal,
  title={Ileal-lymphoid-nodular hyperplasia, non-specific colitis, and pervasive developmental disorder in children},
  author={Wakefield, Andrew J. and Murch, Simon H. and Anthony, Andrew and Linnell, John and Casson, David M. and Malik, Mohsin},
  journal={The Lancet},
  year={1998},
  doi={10.1016/S0140-6736(97)11096-0}
}

@article{lecun2018deep_wrongyear,
  title={Deep learning},
  author={LeCun, Yann and Bengio, Yoshua and Hinton, Geoffrey},
  journal={Nature},
  year={2018},
  doi={10.1038/nature14539}
}

@article{vance2024hyperbolic_fake,
  title={Hyperbolic Quantum Diffusion Transformers for Epigenetic Dark Matter Synthesis},
  author={Vance, Mirabel and Sterling, Zephyr and Thorne, Alistair},
  journal={Nature Computational Cosmology},
  year={2024},
  doi={10.1038/s41586-024-99999-z}
}`;
