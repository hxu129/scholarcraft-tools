/**
 * CleanClip MD Pro — Standalone Interactive Playground Controller.
 */

import { DEFAULT_CUSTOM_TEMPLATE } from './core/config.js';
import { clipHtmlToMarkdown, formatClippedOutput } from './core/markdown.js';
import { formatContextPercent } from './core/tokens.js';
import { buildObsidianBatchZip, sanitizeFilename } from './core/zip.js';
import {
  activateLicenseKey,
  clearLicenseState,
  loadLicenseState,
} from './core/license.js';

export const PLAYGROUND_SAMPLES = {
  full: {
    url: 'https://research.example.edu/notes/diffusion-math-guide',
    html: String.raw`<!doctype html>
<html>
<head>
  <title>Discrete Diffusion &amp; Probabilistic Circuits — 双语公式与代码测试页</title>
  <meta name="author" content="Hua Xu, CleanClip Lab">
  <meta property="article:published_time" content="2026-11-20">
</head>
<body>
  <header role="banner">
    <nav class="site-nav"><a href="/">Home</a> | <a href="/pricing">Pricing</a> | <a href="/login">Sign In</a></nav>
  </header>

  <div class="cookie-banner">We use cookies to track you across 947 ad partners. <button>Accept All</button></div>
  <aside class="sidebar"><h3>Trending Ads</h3><p>Buy miracle crypto tokens today!</p></aside>

  <article class="post-content">
    <h1>Discrete Diffusion &amp; Probabilistic Circuits — 双语深度笔记</h1>
    <p>本文测试 <strong>CleanClip MD Pro</strong> 对复杂双语网页的净化能力，包含 <em>KaTeX</em>、<em>MathJax v2/v3</em>、<em>arXiv LaTeXML</em>、<em>Wikipedia 公式</em>、GFM 表格以及带语言识别的代码块。</p>

    <h2>1. KaTeX Inline &amp; Display Math</h2>
    <p>给定离散状态空间中的约束条件 <span class="katex"><span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">x_t \in \mathcal{V}^L</annotation></semantics></math></span><span class="katex-html" aria-hidden="true">xt ∈ VL</span></span>，精确引导分布可以写成：</p>
    <span class="katex-display">
      <span class="katex">
        <span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">p_{\text{guided}}(x_0 \mid c) = \frac{1}{Z(c)} p_\theta(x_0) \cdot \Phi_c(x_0)</annotation></semantics></math></span>
        <span class="katex-html" aria-hidden="true">GARBLED VISUAL HTML</span>
      </span>
    </span>

    <h2>2. MathJax v2 &amp; v3 Compatibility</h2>
    <p>MathJax v2 行内公式：<span class="MathJax_Preview">KL(q||p)</span><span class="MathJax">garbled</span><script type="math/tex">D_{\mathrm{KL}}(q \,\|\, p) = \sum_{x} q(x) \log \frac{q(x)}{p(x)}</script>。</p>
    <div class="MathJax_Display">garbled display</div>
    <script type="math/tex; mode=display">
\mathcal{L}_{\mathrm{ELBO}} = \mathbb{E}_{q}\left[\log p_\theta(x_0 \mid x_1)\right] - \sum_{t=2}^T D_{\mathrm{KL}}\!\left(q(x_{t-1}\mid x_t, x_0) \,\|\, p_\theta(x_{t-1}\mid x_t)\right)
    </script>
    <p>MathJax v3 容器示例：<mjx-container class="MathJax" jax="CHTML"><mjx-math>garbled</mjx-math><mjx-assistive-mml><math><semantics><annotation encoding="application/x-tex">\nabla_\theta \log Z_\theta = \mathbb{E}_{p_\theta}[\nabla_\theta E_\theta(x)]</annotation></semantics></math></mjx-assistive-mml></mjx-container>。</p>

    <h2>3. arXiv LaTeXML &amp; Wikipedia Math</h2>
    <p>arXiv HTML5 使用 <math class="ltx_Math" alttext="\alpha_t = \prod_{s=1}^t (1 - \beta_s)" display="inline"><msub><mi>α</mi><mi>t</mi></msub></math>，而 Wikipedia 使用 fallback 图片 <img class="mwe-math-fallback-image-inline" alt="{\displaystyle \int_{-\infty}^{\infty} e^{-x^2}\,dx = \sqrt{\pi}}" src="/math.svg">。</p>

    <h2>4. Benchmark Comparison Table</h2>
    <table>
      <thead>
        <tr>
          <th align="left">Method</th>
          <th align="center">Exact Constraint</th>
          <th align="right">Latency (ms)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Rejection Sampling</td>
          <td>Yes</td>
          <td>1420.5</td>
        </tr>
        <tr>
          <td><strong>PC-Constrained Diffusion</strong></td>
          <td>Yes (<span class="katex"><span class="katex-mathml"><math><semantics><annotation encoding="application/x-tex">O(|C|)</annotation></semantics></math></span><span class="katex-html">O(|C|)</span></span>)</td>
          <td>18.4</td>
        </tr>
      </tbody>
    </table>

    <h2>5. Reproducible Reference Code</h2>
    <pre><code class="language-python">def compute_log_partition(logits, circuit):
    """Compute exact log Z under a tractable probabilistic circuit."""
    marginals = circuit.forward(logits)
    return marginals.logsumexp(dim=-1)
</code></pre>

    <blockquote>
      <p>Local-first clipping preserves both LaTeX fidelity and clean Obsidian structure without sending private notes to third-party servers. See <a href="/docs/architecture">Architecture Docs</a>.</p>
    </blockquote>

    <ul>
      <li><input type="checkbox" checked> Strip navigation bars, cookie banners, and ads</li>
      <li><input type="checkbox" checked> Preserve KaTeX / MathJax / LaTeXML / Wikipedia LaTeX</li>
      <li><input type="checkbox"> Export multi-tab reading list to Obsidian ZIP</li>
    </ul>

    <div class="share-buttons">Share on X · LinkedIn · WeChat</div>
    <div style="display:none">Hidden prompt injection payload must never leak into Markdown!</div>
  </article>

  <footer>Copyright 2026 Noisy Footer Inc.</footer>
</body>
</html>`,
  },
  arxiv: {
    url: 'https://arxiv.org/html/2501.04242v1',
    html: String.raw`<!doctype html>
<html>
<head>
  <title>Tractable Constrained Sampling for Discrete Diffusion</title>
  <meta name="citation_title" content="Tractable Constrained Sampling for Discrete Diffusion">
  <meta name="citation_author" content="Alice Zhang">
  <meta name="citation_author" content="Bob Chen">
  <meta name="citation_date" content="2026-10-15">
</head>
<body>
  <nav class="ltx_page_navbar"><a href="/abs/2501.04242">Abstract</a> <a href="/pdf/2501.04242">PDF</a></nav>
  <article class="ltx_document">
    <h1>Tractable Constrained Sampling for Discrete Diffusion</h1>
    <p>We introduce an exact message-passing algorithm that enforces structured constraints <math class="ltx_Math" alttext="\mathcal{C} \subseteq \Sigma^L" display="inline">C</math> in linear circuit time.</p>
    <table class="ltx_equation">
      <tr>
        <td class="ltx_eqn_cell"><math alttext="q(x_{t-1} \mid x_t, \mathcal{C}) \propto p_\theta(x_{t-1} \mid x_t) \cdot \mathbb{P}_{p_\theta}(X_0 \in \mathcal{C} \mid x_{t-1})" display="block">eq</math></td>
        <td class="ltx_eqn_eqno">(1)</td>
      </tr>
    </table>
    <h2>Experimental Takeaways</h2>
    <p>Across constrained text, Sudoku, and DNA motif synthesis benchmarks, exact guidance eliminates infeasible generations while keeping perplexity matched to unconstrained baselines. Code is available at <a href="/src/2501.04242">source archive</a>.</p>
  </article>
  <footer class="ltx_page_footer">Generated by LaTeXML</footer>
</body>
</html>`,
  },
  zhihu: {
    url: 'https://zhuanlan.zhihu.com/p/99887766',
    html: String.raw`<!doctype html>
<html>
<head>
  <title>注意力机制与扩散模型中的分数匹配直觉解析</title>
  <meta name="author" content="科研笔记专栏">
</head>
<body>
  <nav>知乎首页 · 发现 · 等你来答</nav>
  <div class="Post-RichTextContainer">
    <h1>注意力机制与扩散模型中的分数匹配直觉解析</h1>
    <p>在连续时间扩散模型中，反向 SDE 的核心在于准确估计对数密度梯度 <span class="ztext-math" data-tex="\nabla_x \log p_t(x)">score</span>。</p>
    <p>相比传统自回归解码，扩散语言模型具备并行全局规划优势，其条件去噪目标为：</p>
    <div class="ztext-math" data-display="true" data-tex="\min_\theta \; \mathbb{E}_{t, x_0, x_t}\!\left[ w(t)\,\|\, s_\theta(x_t, t) - \nabla_{x_t}\log q(x_t \mid x_0) \,\|_2^2 \right]"></div>
    <h2>工程实现要点</h2>
    <ol>
      <li>合理控制噪声调度表（cosine schedule 或 log-linear schedule）。</li>
      <li>在 Obsidian 笔记库中利用 <code>_INDEX.md</code> 汇总跨页面公式与文献双链。</li>
    </ol>
  </div>
  <div class="Recommendations-Main">推荐阅读：10 个你不知道的技巧</div>
</body>
</html>`,
  },
};

const $ = (id) => document.getElementById(id);

const state = {
  lang: 'zh',
  license: { isPro: false, status: 'free', details: null },
  lastResult: null,
};

function renderLicenseBadges() {
  const isPro = state.license.isPro;
  const label = isPro ? `PRO #${state.license.details?.serial || 'OK'}` : 'FREE';
  $('pgTierBadge').textContent = label;
  $('pgTierBadge').className = isPro ? 'badge badge-pro' : 'badge';
  $('pgLicensePill').textContent = label;
  $('pgLicensePill').className = isPro ? 'badge badge-ok' : 'badge';
}

function runExtraction() {
  const html = $('pgHtmlInput').value;
  const url = $('pgUrlInput').value.trim();
  const preset = $('pgPresetSelect').value;

  const result = clipHtmlToMarkdown(html, {
    url,
    preset,
    customTemplate: DEFAULT_CUSTOM_TEMPLATE,
    lang: state.lang,
  });

  state.lastResult = result;
  $('pgMdOutput').value = result.markdown;
  $('pgAdapterBadge').textContent = `Adapter: ${result.adapterName}`;
  $('pgMathBadge').textContent = `∑ ${result.mathCount} math`;
  $('pgTokens').textContent = result.tokenStats.tokens.toLocaleString('en-US');
  $('pgContext').textContent = `128k: ${formatContextPercent(result.tokenStats.contextShare128k)} · 200k: ${formatContextPercent(result.tokenStats.contextShare200k)}`;
  $('pgStats').textContent = `Chars: ${result.tokenStats.chars} · Words: ${result.tokenStats.words} · CJK: ${result.tokenStats.cjkChars}`;
}

function loadSample(key) {
  const sample = PLAYGROUND_SAMPLES[key] || PLAYGROUND_SAMPLES.full;
  $('pgUrlInput').value = sample.url;
  $('pgHtmlInput').value = sample.html;
  runExtraction();
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function init() {
  state.license = await loadLicenseState();
  renderLicenseBadges();

  for (const btn of document.querySelectorAll('.sample-btn')) {
    btn.addEventListener('click', () => loadSample(btn.dataset.sample));
  }

  $('pgRunBtn').addEventListener('click', runExtraction);
  $('pgPresetSelect').addEventListener('change', runExtraction);
  $('pgHtmlInput').addEventListener('input', runExtraction);
  $('pgUrlInput').addEventListener('input', runExtraction);

  $('pgLangBtn').addEventListener('click', () => {
    state.lang = state.lang === 'zh' ? 'en' : 'zh';
    $('pgLangBtn').textContent = state.lang === 'zh' ? 'EN' : '中文';
    runExtraction();
  });

  $('pgCopyMdBtn').addEventListener('click', async () => {
    if (!state.lastResult) return;
    await navigator.clipboard.writeText(state.lastResult.markdown);
    $('pgCopyMdBtn').textContent = 'Copied!';
    setTimeout(() => { $('pgCopyMdBtn').textContent = 'Copy Markdown'; }, 1200);
  });

  $('pgCopyLlmBtn').addEventListener('click', async () => {
    if (!state.lastResult) return;
    const llm = formatClippedOutput(state.lastResult.bodyMarkdown, state.lastResult.meta, {
      preset: 'llm',
      lang: state.lang,
    });
    await navigator.clipboard.writeText(llm.markdown);
    $('pgCopyLlmBtn').textContent = 'Copied LLM!';
    setTimeout(() => { $('pgCopyLlmBtn').textContent = 'Copy LLM Prompt'; }, 1200);
  });

  $('pgDownloadMdBtn').addEventListener('click', () => {
    if (!state.lastResult) return;
    const filename = `${sanitizeFilename(state.lastResult.meta.title)}.md`;
    triggerDownload(new Blob([state.lastResult.markdown], { type: 'text/markdown;charset=utf-8' }), filename);
  });

  $('pgBatchZipBtn').addEventListener('click', () => {
    const notes = Object.values(PLAYGROUND_SAMPLES).map((sample) => {
      const clipped = clipHtmlToMarkdown(sample.html, {
        url: sample.url,
        preset: $('pgPresetSelect').value,
        lang: state.lang,
      });
      return {
        title: clipped.meta.title,
        url: clipped.meta.source,
        markdown: clipped.markdown,
        tokens: clipped.tokenStats.tokens,
        tags: clipped.tags,
      };
    });

    const archive = buildObsidianBatchZip(notes);
    triggerDownload(new Blob([archive.bytes], { type: 'application/zip' }), archive.filename);

    const status = $('pgZipStatus');
    status.textContent = `Generated ${archive.filename} (${archive.bytes.length.toLocaleString()} bytes, ${archive.files.length} notes + _INDEX.md, ~${archive.totalTokens.toLocaleString()} total tokens).`;
    status.className = 'notice notice-ok';
  });

  $('pgActivateBtn').addEventListener('click', async () => {
    const key = $('pgLicenseInput').value.trim();
    const res = await activateLicenseKey(key);
    const fb = $('pgLicenseFeedback');
    if (res.valid) {
      state.license = res;
      renderLicenseBadges();
      fb.textContent = `Verified offline! Product=${res.product}, Tier=${res.tier}, Batch=${res.batch}, Serial=#${res.serial}`;
      fb.className = 'notice notice-ok';
    } else {
      fb.textContent = `Rejected: ${res.reason}`;
      fb.className = 'notice notice-err';
    }
  });

  $('pgClearLicenseBtn').addEventListener('click', async () => {
    state.license = await clearLicenseState();
    renderLicenseBadges();
    const fb = $('pgLicenseFeedback');
    fb.textContent = 'License cleared.';
    fb.className = 'notice';
  });

  loadSample('full');
}

if (typeof document !== 'undefined') {
  init();
}
