/**
 * PaperPreflight Pro — Core Configuration & Curated Demo Submission
 * 100% local zero-backend ES module compatible with Chrome MV3, modern browsers, and Node v22.
 */

export const APP_NAME = 'PaperPreflight Pro';
export const APP_VERSION = '1.0.0';
export const PRODUCT_ID = 'pre';
export const LICENSE_PREFIX = 'PRE1';

/** Free tier limits for custom user submissions (demo submission runs unlocked). */
export const FREE_MAX_LINES = 200;
export const FREE_MAX_FILES = 1;

/**
 * Embedded ECDSA P-256 Public JWK for 100% offline verification of
 * signed `PRE1.<base64url(payload)>.<base64url(sig)>` license keys.
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
 * Storefront purchase links (international + China domestic).
 */
export const PURCHASE_URLS = Object.freeze({
  gumroad: 'https://hxucreativity28.gumroad.com/l/paperpreflight-pro',
  mianbaoduo: 'https://mbd.pub/o/bread/YZaWmJ5vaw==',
});

/**
 * Optional online UUID license verification config (disabled until live Gumroad product_id is wired).
 * Offline `PRE1.*` ECDSA keys always work immediately with zero network calls.
 */
export const ONLINE_LICENSE_PROVIDERS = Object.freeze({
  gumroad: Object.freeze({
    enabled: true,
    productId: '9I2if3OYyIQOLWNjEFj30Q==',
    productPermalink: 'paperpreflight-pro',
    validateUrl: 'https://api.gumroad.com/v2/licenses/verify',
  }),
  lemonSqueezy: Object.freeze({
    enabled: false,
    storeId: '',
    productId: '',
    validateUrl: 'https://api.lemonsqueezy.com/v1/licenses/validate',
  }),
});

export const STORAGE_KEYS = Object.freeze({
  license: 'paperpreflight_pro_license_v1',
  lang: 'paperpreflight_pro_lang_v1',
  blocklist: 'paperpreflight_pro_blocklist_v1',
  venue: 'paperpreflight_pro_venue_v1',
});

export const VENUE_PRESETS = Object.freeze([
  { id: 'auto', labelEn: 'Auto-Detect Venue', labelZh: '自动识别会议/期刊' },
  { id: 'neurips', labelEn: 'NeurIPS (Double-Blind)', labelZh: 'NeurIPS（双盲评审）' },
  { id: 'icml', labelEn: 'ICML (Double-Blind)', labelZh: 'ICML（双盲评审）' },
  { id: 'iclr', labelEn: 'ICLR (Double-Blind)', labelZh: 'ICLR（双盲评审）' },
  { id: 'cvpr', labelEn: 'CVPR / ICCV / ECCV', labelZh: 'CVPR / ICCV / ECCV' },
  { id: 'acl', labelEn: 'ACL / EMNLP / NAACL (ARR)', labelZh: 'ACL / EMNLP / ARR' },
  { id: 'nature', labelEn: 'Nature / Science / General', labelZh: 'Nature / 通用期刊' },
]);

/**
 * Curated realistic NeurIPS submission with deliberate double-blind leaks,
 * structural errors, draft markers, prose hygiene issues, and an allowed anonymous URL
 * so users experience full diagnostic value in 2 seconds.
 */
export const DEMO_BLOCKLIST = Object.freeze([
  'Alice Chen',
  'Bob Zhang',
  'NeuralFlow Lab',
  'Stanford AI Lab',
  'alicechen-ml',
  'NSF-2418902',
]);

export const DEMO_MAIN_TEX = String.raw`\documentclass{article}
% Submission template — watch the [final] option below!
\usepackage[final]{neurips_2026}
\usepackage[utf8]{inputenc}
\usepackage{graphicx}
\usepackage{hyperref}

\title{Adaptive Sparse Graph Diffusion for Molecular Equivariance}

\author{
  Alice Chen\thanks{Work conducted at Stanford AI Lab and supported by NSF Grant No. NSF-2418902.} \\
  Department of Computer Science \\
  \texttt{achen@stanford.edu}
  \And
  Bob Zhang \\
  NeuralFlow Lab \\
  \texttt{bzhang@gmail.com}
}

\begin{document}
\maketitle

\begin{abstract}
We introduce Adaptive Sparse Graph Diffusion (ASGD) for 3D molecular generation.
ASGD maintains 98.5\% chemical stability across all QM9 benchmarks.
Our method improves validity by 14.2% over strong baselines.
Anonymous review code is provided at \url{https://anonymous.4open.science/r/asgd-review-9A2F}.
\end{abstract}

\section{Introduction}
\label{sec:intro}

In our previous work~\cite{chen2025prior}, we demonstrated that sparse attention kernels accelerate equivariant message passing.
Building on the the transformer backbone \cite{vaswani2017attention}, ASGD introduces dynamic routing shown in Figure \ref{fig:overview}.
% TODO: double-check whether reviewer 2 requested variance bars on QM9
Our reference implementation is also mirrored at \url{https://github.com/alicechen-ml/asgd-diffusion}.
\todo{Re-run Seed 42 ablation before submission deadline!}

\section{Method and Experiments}
\label{sec:method}

We compare against the recent latent baseline~\cite{ghost2026missing} and summarize extended ablations in Figure~\ref{fig:ablation_missing}.

\begin{figure}[t]
  \centering
  \includegraphics[width=0.92\linewidth]{/Users/alice/projects/neurips26/figures/asgd_overview.pdf}
  \caption{Overview of the ASGD sparse diffusion trajectory.}
  \label{fig:overview}
\end{figure}

\begin{table}[t]
  \centering
  \caption{Default training hyperparameters (never referenced in prose).}
  \label{tab:hyperparams}
  \begin{tabular}{lc}
    Learning rate & $3 \times 10^{-4}$ \\
    Diffusion steps & 1000 \\
  \end{tabular}
\end{table}

\section*{Acknowledgments}
We thank colleagues at NeuralFlow Lab for compute access under Grant No. NSF-2418902.

\bibliographystyle{plainnat}
\bibliography{references}
\end{document}
`;

export const DEMO_REFERENCES_BIB = `@inproceedings{vaswani2017attention,
  title={Attention Is All You Need},
  author={Vaswani, Ashish and Shazeer, Noam and Parmar, Niki and Uszkoreit, Jakob},
  booktitle={Advances in Neural Information Processing Systems (NeurIPS)},
  year={2017}
}

@inproceedings{chen2025prior,
  title={Fast Equivariant Kernels for Molecular Dynamics},
  author={Chen, Alice and Zhang, Bob},
  booktitle={International Conference on Machine Learning (ICML)},
  year={2025},
  note={Code at https://github.com/alicechen-ml/fast-eq}
}

@article{unused2023bloated,
  title={An Uncited Survey Left Over in the Bibliography File},
  author={Doe, Jane and Smith, John},
  journal={Journal of Unused References},
  year={2023}
}
`;
