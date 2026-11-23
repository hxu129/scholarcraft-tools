/**
 * CleanClip MD Pro — DOM-agnostic HTML/DOM -> clean GFM Markdown + LaTeX engine.
 *
 * Key capabilities:
 *  - Noise stripping (scripts, styles, nav, aside, footer, cookie/share/ad/hidden nodes)
 *  - Site-aware content extraction (arXiv HTML/ar5iv, GitHub, Wikipedia, WeChat MP,
 *    Zhihu, Reddit, Substack) + generic <article>/<main>/text-density heuristic fallback
 *  - High-fidelity LaTeX preservation (KaTeX, MathJax v2 & v3, LaTeXML/arXiv HTML5,
 *    Wikipedia math fallbacks, Zhihu data-tex)
 *  - Clean GFM conversion (headings, emphasis, fenced code with language detection,
 *    nested/task lists, blockquotes, pipe tables, resolved absolute links & images)
 *  - Customizable YAML Frontmatter & output presets (Obsidian, LLM Prompt, Academic, Custom)
 */

import { DEFAULT_CUSTOM_TEMPLATE } from './config.js';
import { parseHtmlDocument } from './dom-parser.js';
import { estimateTokens, formatContextPercent } from './tokens.js';
import { formatAiSummaryCallout } from './byok.js';

const NOISE_CLASS_ID_RE = /(?:^|[\s_-])(cookie|cookies|consent|gdpr|cc-banner|banner-ad|ad-container|ad-slot|ad-wrapper|adsbox|advert|advertisement|sponsored|sponsor-banner|promo-banner|newsletter-signup|subscribe-box|subscription-widget|share-buttons|share-widget|social-share|sidebar|side-bar|breadcrumb|breadcrumbs|related-posts|recommended-posts|cookie-notice|popup-overlay|modal-backdrop|paywall-banner|navbox|vertical-navbox|mw-editsection|editsection|noprint|printfooter|catlinks|floating-bar|toolbar-actions)(?:$|[\s_-])/i;

const POSITIVE_CONTENT_RE = /(?:^|[\s_-])(article|content|entry|post|markdown|prose|main|paper|ltx_document|mw-parser-output|rich_media_content|post-richtext|body)(?:$|[\s_-])/i;

const NEGATIVE_CONTENT_RE = /(?:^|[\s_-])(nav|navbar|header|footer|sidebar|aside|comment|comments|menu|banner|promo|ad|ads|share|social|cookie|modal|popup|related|recommend|widget|toolbar)(?:$|[\s_-])/i;

const SITE_ADAPTERS = [
  {
    name: 'arXiv HTML',
    test: (host, pathname, doc) => (
      (host.includes('arxiv.org') && pathname.startsWith('/html')) ||
      host.includes('ar5iv.labs.arxiv.org') ||
      Boolean(doc.querySelector('article.ltx_document'))
    ),
    mainSelectors: ['article.ltx_document', '.ltx_page_main', 'article', 'main'],
    stripSelectors: [
      'nav.ltx_page_navbar',
      'footer.ltx_page_footer',
      '.ar5iv-footer',
      '.ltx_page_logo',
      '.ltx_page_header',
      '.ltx_ERROR',
    ],
  },
  {
    name: 'GitHub',
    test: (host) => host === 'github.com' || host.endsWith('.github.com'),
    mainSelectors: ['article.markdown-body', '#readme .markdown-body', '.markdown-body', '.comment-body', 'main'],
    stripSelectors: ['.octicon-link', 'a.anchor', '.zeroclipboard-container', 'clipboard-copy', '.markdown-heading a.anchor'],
  },
  {
    name: 'Wikipedia',
    test: (host) => host.endsWith('wikipedia.org'),
    mainSelectors: ['#mw-content-text .mw-parser-output', '#mw-content-text', '#bodyContent'],
    stripSelectors: [
      '.mw-editsection',
      '.navbox',
      '.vertical-navbox',
      '.sistersitebox',
      '.ambox',
      '.mbox-small',
      '#toc',
      '.toc',
      '.mw-jump-link',
      '.printfooter',
      '.catlinks',
      '.noprint',
      '.mw-empty-elt',
    ],
  },
  {
    name: 'WeChat MP',
    test: (host) => host === 'mp.weixin.qq.com',
    mainSelectors: ['#js_content', '.rich_media_content'],
    stripSelectors: ['#js_pc_qr_code', '.qr_code_pc', '.rich_media_tool', '.reward_area'],
  },
  {
    name: 'Zhihu',
    test: (host) => host.endsWith('zhihu.com'),
    mainSelectors: ['.Post-RichTextContainer', '.RichContent-inner', '.RichText', 'article'],
    stripSelectors: ['.ContentItem-actions', '.Post-SideActions', '.Recommendations-Main', '.Comments-container'],
  },
  {
    name: 'Reddit',
    test: (host) => host.endsWith('reddit.com'),
    mainSelectors: ['shreddit-post [slot="text-body"]', '[data-test-id="post-content"]', '.Post', 'main'],
    stripSelectors: ['shreddit-post-overflow-menu', '[slot="credit-bar"]'],
  },
  {
    name: 'Substack',
    test: (host, _pathname, doc) => (
      host.endsWith('substack.com') || Boolean(doc.querySelector('.available-content .body.markup'))
    ),
    mainSelectors: ['.available-content .body.markup', '.body.markup', '.available-content', 'article.post', 'article'],
    stripSelectors: ['.subscription-widget-wrap', '.subscribe-widget', '.post-ufi', '.like-button-container'],
  },
];

/* ------------------ URL & String Utilities ------------------ */

function parseUrlSafe(rawUrl) {
  if (!rawUrl) return null;
  try {
    return new URL(String(rawUrl));
  } catch {
    return null;
  }
}

export function resolveAbsoluteUrl(href, baseUrl) {
  const raw = String(href || '').trim();
  if (!raw) return '';
  if (/^(javascript|vbscript):/i.test(raw)) return '';
  if (/^(https?:|mailto:|tel:|data:)/i.test(raw)) return raw;
  if (raw.startsWith('#')) {
    if (!baseUrl) return raw;
    try {
      return new URL(raw, baseUrl).href;
    } catch {
      return raw;
    }
  }
  if (!baseUrl) return raw;
  try {
    return new URL(raw, baseUrl).href;
  } catch {
    return raw;
  }
}

function collapseInlineSpaces(str) {
  return String(str || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/ {2,}/g, ' ');
}

function yamlEscape(value) {
  const s = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function xmlAttrEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/* ------------------ LaTeX Normalization & Math Detection ------------------ */

/**
 * Unwrap a balanced outer `{\displaystyle ...}` or `{\textstyle ...}` wrapper
 * commonly produced by Wikipedia / MediaWiki Mathoid.
 */
function unwrapStyleBraces(tex) {
  let s = tex.trim();
  const prefixMatch = s.match(/^\{\s*\\(?:displaystyle|textstyle|scriptstyle)\s+/);
  if (!prefixMatch || !s.endsWith('}')) return s;

  // Verify the opening `{` at index 0 matches the final `}` at s.length - 1
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '\\') { i++; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0 && i < s.length - 1) {
        return s; // Closed before end; do not strip
      }
    }
  }
  if (depth === 0) {
    s = s.slice(prefixMatch[0].length, -1).trim();
  }
  return s;
}

/**
 * Clean extracted LaTeX source without mangling math commands.
 */
export function normalizeLatex(rawTex, isDisplay = false) {
  let tex = String(rawTex || '').trim();
  if (!tex) return '';

  tex = unwrapStyleBraces(tex);

  // Strip redundant outer math delimiters if the whole expression is wrapped
  if (tex.startsWith('$$') && tex.endsWith('$$') && tex.length > 4) {
    tex = tex.slice(2, -2).trim();
  } else if (tex.startsWith('\\[') && tex.endsWith('\\]') && tex.length > 4) {
    tex = tex.slice(2, -2).trim();
  } else if (tex.startsWith('\\(') && tex.endsWith('\\)') && tex.length > 4) {
    tex = tex.slice(2, -2).trim();
  } else if (
    tex.startsWith('$') && tex.endsWith('$') && tex.length > 2 &&
    !tex.slice(1, -1).includes('$')
  ) {
    tex = tex.slice(1, -1).trim();
  }

  tex = unwrapStyleBraces(tex);

  if (!isDisplay) {
    // Obsidian & Pandoc require single-line inline math with no leading/trailing spaces inside $...$
    tex = tex.replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  } else {
    tex = tex.replace(/\r\n/g, '\n').trim();
  }
  return tex;
}

function isMathScript(el) {
  if (!el || el.tagName !== 'SCRIPT') return false;
  const type = (el.getAttribute('type') || '').toLowerCase();
  return type.startsWith('math/tex') || type.startsWith('math/asciimath');
}

function isMathElement(el) {
  if (!el || el.nodeType !== 1) return false;
  const tag = el.tagName;
  if (tag === 'MATH' || tag === 'MJX-CONTAINER') return true;
  if (isMathScript(el)) return true;
  if (
    el.classList.contains('katex') ||
    el.classList.contains('katex-display') ||
    el.classList.contains('mwe-math-element') ||
    el.classList.contains('mwe-math-fallback-image-inline') ||
    el.classList.contains('mwe-math-fallback-image-display') ||
    el.classList.contains('ztext-math') ||
    el.classList.contains('MathJax') ||
    el.classList.contains('MathJax_Display') ||
    el.classList.contains('MathJax_CHTML') ||
    el.classList.contains('MathJax_SVG') ||
    el.classList.contains('ltx_equation') ||
    el.classList.contains('ltx_equationgroup')
  ) {
    return true;
  }
  if (el.hasAttribute('data-tex') || el.hasAttribute('data-formula')) return true;
  return false;
}

function isInsideMath(el) {
  let cur = el?.parentNode;
  while (cur && cur.nodeType === 1) {
    if (isMathElement(cur)) return true;
    cur = cur.parentNode;
  }
  return false;
}

function hasAdjacentMathScript(el) {
  const next = el.nextElementSibling;
  if (isMathScript(next)) return true;
  const prev = el.previousElementSibling;
  if (isMathScript(prev)) return true;
  // MathJax v2 often outputs: .MathJax_Preview + .MathJax + script[type="math/tex"]
  if (next && isMathScript(next.nextElementSibling)) return true;
  if (el.parentNode && el.parentNode.nodeType === 1) {
    const pNext = el.parentNode.nextElementSibling;
    if (isMathScript(pNext) && (el.classList.contains('MathJax') || el.classList.contains('MathJax_Preview'))) {
      return true;
    }
  }
  return false;
}

function extractTexFromMathNode(el) {
  // 1. Explicit data attributes (Zhihu / MathJax hooks)
  const dataTex = el.getAttribute('data-tex') || el.getAttribute('data-latex') || el.getAttribute('data-formula');
  if (dataTex && dataTex.trim()) return dataTex;

  // 2. MathML <annotation encoding="application/x-tex"> (KaTeX, MathJax v3 assistive, LaTeXML)
  const annTex = el.querySelector('annotation[encoding="application/x-tex"], annotation[encoding="application/x-latex"]');
  if (annTex && annTex.textContent.trim()) return annTex.textContent;

  // 3. Direct alttext on <math> or child <math alttext="..."> (arXiv LaTeXML, Wikipedia)
  if (el.tagName === 'MATH' && el.getAttribute('alttext')) {
    return el.getAttribute('alttext');
  }
  const mathWithAlt = el.querySelector('math[alttext]');
  if (mathWithAlt && mathWithAlt.getAttribute('alttext')) {
    return mathWithAlt.getAttribute('alttext');
  }

  // 4. Generic <annotation>
  const anyAnn = el.querySelector('annotation');
  if (anyAnn && anyAnn.textContent.trim()) return anyAnn.textContent;

  // 5. Wikipedia fallback <img> alt
  const wikiImg = el.tagName === 'IMG'
    ? el
    : el.querySelector('img.mwe-math-fallback-image-inline, img.mwe-math-fallback-image-display, img[alt]');
  if (wikiImg && wikiImg.getAttribute('alt')) {
    return wikiImg.getAttribute('alt');
  }

  // 6. Embedded <script type="math/tex...">
  const innerScript = el.querySelector('script[type^="math/"]');
  if (innerScript && innerScript.textContent.trim()) {
    return innerScript.textContent;
  }

  // 7. aria-label fallback (common on MathJax v3 mjx-container when assistive MML is absent)
  const aria = el.getAttribute('aria-label');
  if (aria && aria.trim()) return aria;

  // 8. Fallback text
  return el.textContent || '';
}

/* ------------------ Noise Removal & Main Content Detection ------------------ */

function isHiddenStyle(styleStr) {
  if (!styleStr) return false;
  return /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\b/i.test(styleStr);
}

function shouldStripAsNoise(el, root) {
  if (!el || el.nodeType !== 1 || el === root) return false;
  if (isMathElement(el) || isInsideMath(el)) return false;

  const tag = el.tagName;
  if (tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEMPLATE' || tag === 'IFRAME' ||
      tag === 'CANVAS' || tag === 'AUDIO' || tag === 'VIDEO' || tag === 'OBJECT' ||
      tag === 'EMBED' || tag === 'BUTTON' || tag === 'INPUT' || tag === 'SELECT' ||
      tag === 'TEXTAREA' || tag === 'SVG') {
    // Keep checkboxes inside task list items!
    if (tag === 'INPUT' && (el.getAttribute('type') || '').toLowerCase() === 'checkbox' && el.closest('li')) {
      return false;
    }
    return true;
  }

  if (tag === 'SCRIPT') {
    return !isMathScript(el);
  }

  if (tag === 'NAV' || tag === 'ASIDE' || tag === 'FOOTER') {
    return true;
  }

  if (tag === 'HEADER') {
    // Remove site nav headers, but keep article headers containing <h1>
    const role = (el.getAttribute('role') || '').toLowerCase();
    if (role === 'banner' || el.querySelector('nav')) return true;
    if (!el.querySelector('h1')) return true;
  }

  if (tag === 'FORM') {
    // Only remove forms that look like search/subscribe/login widgets, never page-wrapping forms
    if (!el.querySelector('article, main') && el.textContent.trim().length < 500) {
      return true;
    }
  }

  if (el.hasAttribute('hidden') || el.getAttribute('data-clipmd-hidden') === '1') {
    return true;
  }
  if (isHiddenStyle(el.getAttribute('style'))) {
    return true;
  }
  if (el.getAttribute('aria-hidden') === 'true') {
    return true;
  }

  const role = (el.getAttribute('role') || '').toLowerCase();
  if (role === 'navigation' || role === 'banner' || role === 'contentinfo' ||
      role === 'complementary' || role === 'dialog' || role === 'alertdialog' ||
      role === 'search') {
    return true;
  }

  const classAndId = `${el.className || ''} ${el.id || ''}`.trim();
  if (classAndId && NOISE_CLASS_ID_RE.test(classAndId)) {
    // Never accidentally strip a primary content wrapper
    if (!POSITIVE_CONTENT_RE.test(classAndId) && !el.querySelector('article, main, .ltx_document, .markdown-body')) {
      return true;
    }
  }

  return false;
}

function stripNoiseInPlace(root, extraSelectors = []) {
  for (const sel of extraSelectors) {
    try {
      for (const node of root.querySelectorAll(sel)) {
        if (node !== root && !isMathElement(node)) node.remove();
      }
    } catch {
      // Ignore unsupported selector gracefully
    }
  }

  const prune = (node) => {
    const children = [...node.childNodes];
    for (const child of children) {
      if (child.nodeType !== 1) continue;
      if (shouldStripAsNoise(child, root)) {
        child.remove();
      } else if (!isMathElement(child)) {
        prune(child);
      }
    }
  };
  prune(root);
}

function scoreContentCandidate(el) {
  const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
  const textLen = text.length;
  if (textLen < 60 && !el.querySelector('math, .katex, mjx-container, pre, table')) {
    return -1000;
  }

  const links = el.querySelectorAll('a');
  let linkTextLen = 0;
  for (const a of links) {
    linkTextLen += (a.textContent || '').trim().length;
  }
  const linkDensity = textLen > 0 ? Math.min(1, linkTextLen / textLen) : 0;

  const pCount = el.querySelectorAll('p').length;
  const hCount = el.querySelectorAll('h1, h2, h3, h4').length;
  const richCount = el.querySelectorAll('pre, table, math, .katex, mjx-container, script[type^="math/"]').length;

  let score = textLen * (1 - linkDensity * 0.75) + pCount * 45 + hCount * 25 + richCount * 80;

  const tag = el.tagName;
  if (tag === 'ARTICLE') score += 350;
  else if (tag === 'MAIN') score += 250;

  const sig = `${el.className || ''} ${el.id || ''}`;
  if (POSITIVE_CONTENT_RE.test(sig)) score += 200;
  if (NEGATIVE_CONTENT_RE.test(sig)) score -= 300;

  return score;
}

function selectMainContent(doc, url, isSelection = false) {
  if (isSelection) {
    return { container: doc.body || doc.documentElement || doc, adapterName: 'Selection', extraStrip: [] };
  }

  const parsed = parseUrlSafe(url);
  const host = parsed ? parsed.hostname.toLowerCase() : '';
  const pathname = parsed ? parsed.pathname : '';

  for (const adapter of SITE_ADAPTERS) {
    if (adapter.test(host, pathname, doc)) {
      for (const sel of adapter.mainSelectors) {
        const hit = doc.querySelector(sel);
        if (hit) {
          return { container: hit, adapterName: adapter.name, extraStrip: adapter.stripSelectors || [] };
        }
      }
    }
  }

  // Generic semantic containers first
  for (const sel of ['article', 'main', '[role="main"]']) {
    const hit = doc.querySelector(sel);
    if (hit) {
      const len = (hit.textContent || '').trim().length;
      const hasRich = Boolean(hit.querySelector('math, .katex, mjx-container, script[type^="math/"], pre, table'));
      if (len >= 80 || hasRich) {
        return { container: hit, adapterName: 'Generic Semantic', extraStrip: [] };
      }
    }
  }

  // Readability-style text-density fallback
  const body = doc.body || doc.documentElement || doc;
  const candidates = body.querySelectorAll('article, main, section, div');
  let best = body;
  let bestScore = scoreContentCandidate(body) * 0.6; // Slight preference for more focused inner wrapper

  for (const cand of candidates) {
    const score = scoreContentCandidate(cand);
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }

  return { container: best, adapterName: 'Density Heuristic', extraStrip: [] };
}

/* ------------------ Metadata Extraction ------------------ */

export function extractMetadata(doc, options = {}) {
  const getMeta = (selector) => {
    const el = doc.querySelector(selector);
    return el ? (el.getAttribute('content') || el.textContent || '').trim() : '';
  };

  const h1Title = (doc.querySelector('article h1, main h1, h1')?.textContent || '')
    .replace(/\s*[¶#🔗]\s*$/, '')
    .trim();

  const rawTitle =
    options.title ||
    getMeta('meta[name="citation_title"]') ||
    getMeta('meta[property="og:title"]') ||
    getMeta('meta[name="twitter:title"]') ||
    h1Title ||
    doc.title ||
    'Untitled Note';

  const citationAuthors = doc.querySelectorAll('meta[name="citation_author"]')
    .map((m) => (m.getAttribute('content') || '').trim())
    .filter(Boolean);

  const author =
    options.author ||
    (citationAuthors.length > 0 ? citationAuthors.join(', ') : '') ||
    getMeta('meta[name="author"]') ||
    getMeta('meta[property="article:author"]') ||
    (doc.querySelector('.ltx_personname, .AuthorInfo-name, #js_name, [rel="author"]')?.textContent || '').trim() ||
    '';

  const canonical = doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '';
  const source = options.url || canonical || getMeta('meta[property="og:url"]') || '';
  const parsedUrl = parseUrlSafe(source);
  const siteName =
    options.siteName ||
    getMeta('meta[property="og:site_name"]') ||
    (parsedUrl ? parsedUrl.hostname.replace(/^www\./, '') : '');

  const publishedAt =
    options.publishedAt ||
    getMeta('meta[property="article:published_time"]') ||
    getMeta('meta[name="citation_date"]') ||
    doc.querySelector('time[datetime]')?.getAttribute('datetime') ||
    '';

  return {
    title: collapseInlineSpaces(rawTitle).trim() || 'Untitled Note',
    author: collapseInlineSpaces(author).trim(),
    source: source.trim(),
    siteName: siteName.trim(),
    publishedAt: publishedAt.trim(),
    clippedAt: options.clippedAt || new Date().toISOString(),
  };
}

/* ------------------ Code Language & GFM Table Helpers ------------------ */

function detectCodeLanguage(preEl, codeEl) {
  const candidates = [
    codeEl?.getAttribute('data-lang'),
    codeEl?.getAttribute('data-language'),
    preEl?.getAttribute('data-lang'),
    preEl?.getAttribute('data-language'),
    codeEl?.className,
    preEl?.className,
    preEl?.parentNode?.nodeType === 1 ? preEl.parentNode.className : '',
  ].filter(Boolean);

  for (const raw of candidates) {
    const s = String(raw);
    const m = s.match(/(?:language-|lang-|highlight-source-|brush:\s*)([a-zA-Z0-9_+#.-]+)/i);
    if (m) return m[1].toLowerCase().replace(/^text$/, '');
  }

  // Direct bare data-lang values like data-lang="python"
  const direct = (codeEl?.getAttribute('data-lang') || preEl?.getAttribute('data-lang') || '').trim();
  if (direct && /^[a-zA-Z0-9_+#.-]+$/.test(direct)) return direct.toLowerCase();

  return '';
}

function extractCleanCodeText(preEl) {
  const clone = preEl.cloneNode(true);
  // Strip line-number gutters & copy buttons inside code blocks
  const gutters = clone.querySelectorAll('.hljs-ln-numbers, .line-numbers-rows, .lineno, .gutter, button, .copy-code');
  for (const g of gutters) g.remove();

  // Convert <br> inside <pre> into real newlines
  for (const br of clone.querySelectorAll('br')) {
    br.textContent = '\n';
  }

  return clone.textContent.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '');
}

function extractImageUrl(imgEl, baseUrl) {
  const candidates = [
    imgEl.getAttribute('data-actualsrc'),
    imgEl.getAttribute('data-original'),
    imgEl.getAttribute('data-src'),
    imgEl.getAttribute('data-lazy-src'),
    imgEl.getAttribute('src'),
  ].filter(Boolean);

  for (const src of candidates) {
    const trimmed = src.trim();
    if (!trimmed) continue;
    // Skip placeholder inline SVGs when a real URL is available
    if (trimmed.startsWith('data:image/svg+xml') && candidates.length > 1) continue;
    return resolveAbsoluteUrl(trimmed, baseUrl);
  }
  return '';
}

/* ------------------ DOM -> GFM Markdown Serializer ------------------ */

function wrapEmphasis(content, marker) {
  if (!content || !content.trim()) return content;
  const leading = content.match(/^\s*/)[0];
  const trailing = content.match(/\s*$/)[0];
  const core = content.trim();
  if (!core) return content;
  return `${leading}${marker}${core}${marker}${trailing}`;
}

function formatInlineCode(text) {
  const raw = String(text || '').replace(/\r?\n/g, ' ');
  if (!raw) return '';
  const runs = raw.match(/`+/g) || [];
  let maxTicks = 0;
  for (const r of runs) if (r.length > maxTicks) maxTicks = r.length;
  const fence = '`'.repeat(maxTicks + 1);
  const needsPad = raw.startsWith('`') || raw.endsWith('`') || (raw.startsWith(' ') && raw.endsWith(' ') && raw.trim());
  return needsPad ? `${fence} ${raw} ${fence}` : `${fence}${raw}${fence}`;
}

function renderMarkdownTree(root, context) {
  function renderChildren(node, opts = {}) {
    let out = '';
    for (const child of node.childNodes) {
      out += renderNode(child, opts);
    }
    return out;
  }

  function renderMathOutput(rawTex, isDisplay) {
    const tex = normalizeLatex(rawTex, isDisplay);
    if (!tex) return '';
    context.mathCount += 1;
    if (isDisplay) {
      return `\n\n$$\n${tex}\n$$\n\n`;
    }
    return `$${tex}$`;
  }

  function renderArxivEquationTable(tableEl) {
    const mathNodes = tableEl.querySelectorAll('math');
    if (mathNodes.length === 0) return null;
    const equations = [];
    for (const m of mathNodes) {
      const tex = normalizeLatex(extractTexFromMathNode(m), true);
      if (tex) {
        context.mathCount += 1;
        equations.push(`$$\n${tex}\n$$`);
      }
    }
    if (equations.length === 0) return null;
    return `\n\n${equations.join('\n\n')}\n\n`;
  }

  function renderTable(tableEl) {
    // Special case: arXiv / LaTeXML equation layout tables -> clean display math!
    if (
      tableEl.classList.contains('ltx_equation') ||
      tableEl.classList.contains('ltx_equationgroup') ||
      tableEl.classList.contains('ltx_eqn_table')
    ) {
      const mathOut = renderArxivEquationTable(tableEl);
      if (mathOut) return mathOut;
    }

    const rows = [];
    const trNodes = tableEl.querySelectorAll('tr');
    for (const tr of trNodes) {
      // Skip rows belonging to nested tables
      if (tr.closest('table') !== tableEl) continue;
      const cells = tr.children.filter((c) => c.tagName === 'TH' || c.tagName === 'TD');
      if (cells.length === 0) continue;
      rows.push({
        isHeader: cells.every((c) => c.tagName === 'TH') || Boolean(tr.closest('thead')),
        cells: cells.map((cell) => {
          const alignAttr = (cell.getAttribute('align') || '').toLowerCase();
          const styleAttr = (cell.getAttribute('style') || '').toLowerCase();
          let align = 'left';
          if (alignAttr === 'center' || /text-align\s*:\s*center/.test(styleAttr)) align = 'center';
          else if (alignAttr === 'right' || /text-align\s*:\s*right/.test(styleAttr)) align = 'right';

          const text = renderChildren(cell, { inTable: true })
            .replace(/\n+/g, '<br>')
            .replace(/\s{2,}/g, ' ')
            .replace(/\|/g, '\\|')
            .trim();
          return { text, align };
        }),
      });
    }

    if (rows.length === 0) return '';

    const colCount = Math.max(...rows.map((r) => r.cells.length));
    if (colCount === 0) return '';

    // Single-column 1-row layout wrapper -> just render content directly
    if (rows.length === 1 && colCount === 1 && !rows[0].isHeader) {
      return `\n\n${rows[0].cells[0].text}\n\n`;
    }

    const headerRow = rows[0];
    const bodyRows = rows.slice(1);

    const padRow = (row) => {
      const padded = [...row.cells];
      while (padded.length < colCount) padded.push({ text: '', align: 'left' });
      return padded;
    };

    const hCells = padRow(headerRow);
    const headerLine = `| ${hCells.map((c) => c.text || ' ').join(' | ')} |`;
    const sepLine = `| ${hCells.map((c) => {
      if (c.align === 'center') return ':---:';
      if (c.align === 'right') return '---:';
      return '---';
    }).join(' | ')} |`;

    const bodyLines = bodyRows.map((r) => {
      const cells = padRow(r);
      return `| ${cells.map((c) => c.text).join(' | ')} |`;
    });

    return `\n\n${[headerLine, sepLine, ...bodyLines].join('\n')}\n\n`;
  }

  function renderList(listEl, depth = 0) {
    const isOrdered = listEl.tagName === 'OL';
    let counter = parseInt(listEl.getAttribute('start') || '1', 10);
    if (!Number.isFinite(counter)) counter = 1;

    const lines = [];
    const indent = '  '.repeat(depth);

    for (const child of listEl.children) {
      if (child.tagName !== 'LI') continue;

      const marker = isOrdered ? `${counter++}. ` : '- ';
      let taskPrefix = '';
      let contentParts = [];
      const nestedBlocks = [];

      for (const liChild of child.childNodes) {
        if (liChild.nodeType === 1 && (liChild.tagName === 'UL' || liChild.tagName === 'OL')) {
          const nested = renderList(liChild, depth + 1);
          if (nested.trim()) nestedBlocks.push(nested.replace(/^\n+|\n+$/g, ''));
          continue;
        }
        if (
          liChild.nodeType === 1 &&
          liChild.tagName === 'INPUT' &&
          (liChild.getAttribute('type') || '').toLowerCase() === 'checkbox'
        ) {
          taskPrefix = liChild.hasAttribute('checked') ? '[x] ' : '[ ] ';
          continue;
        }
        contentParts.push(renderNode(liChild, { listDepth: depth + 1 }));
      }

      const rawText = contentParts.join('')
        .replace(/^\s+|\s+$/g, '')
        .replace(/\n{3,}/g, '\n\n');

      // Indent multiline item body so blockquotes/fenced code stay inside the list item
      const contIndent = ' '.repeat(indent.length + marker.length);
      const formattedBody = rawText.replace(/\n/g, `\n${contIndent}`);
      lines.push(`${indent}${marker}${taskPrefix}${formattedBody}`);

      for (const nb of nestedBlocks) {
        lines.push(nb);
      }
    }

    if (lines.length === 0) return '';
    return depth === 0 ? `\n\n${lines.join('\n')}\n\n` : `\n${lines.join('\n')}`;
  }

  function renderNode(node, opts = {}) {
    if (!node) return '';

    // Text node
    if (node.nodeType === 3) {
      return collapseInlineSpaces(node.nodeValue || '');
    }

    if (node.nodeType !== 1) return '';
    const tag = node.tagName;

    /* ---- 1. High-Fidelity LaTeX Math Handling ---- */

    // KaTeX display
    if (node.classList.contains('katex-display')) {
      return renderMathOutput(extractTexFromMathNode(node), true);
    }

    // KaTeX inline
    if (node.classList.contains('katex')) {
      return renderMathOutput(extractTexFromMathNode(node), false);
    }

    // MathJax v3 <mjx-container>
    if (tag === 'MJX-CONTAINER') {
      const dispAttr = (node.getAttribute('display') || '').toLowerCase();
      const isDisplay =
        dispAttr === 'true' ||
        dispAttr === 'block' ||
        (node.hasAttribute('display') && dispAttr !== 'false' && dispAttr !== 'inline') ||
        node.classList.contains('MathJax_Display');

      let tex = extractTexFromMathNode(node);
      if (!tex && isMathScript(node.nextElementSibling)) {
        tex = node.nextElementSibling.textContent;
      }
      return renderMathOutput(tex, isDisplay);
    }

    // MathJax v2 <script type="math/tex"> & <script type="math/tex; mode=display">
    if (isMathScript(node)) {
      const type = (node.getAttribute('type') || '').toLowerCase();
      const isDisplay = /mode\s*=\s*display/.test(type);
      return renderMathOutput(node.textContent || '', isDisplay);
    }

    // MathJax v2 visual wrappers (skip if adjacent <script type="math/tex"> handles it)
    if (
      node.classList.contains('MathJax_Preview') ||
      node.classList.contains('MathJax') ||
      node.classList.contains('MathJax_Display') ||
      node.classList.contains('MathJax_CHTML') ||
      node.classList.contains('MathJax_SVG') ||
      node.classList.contains('MJX_Assistive_MathML')
    ) {
      const innerScript = node.querySelector('script[type^="math/"]');
      if (innerScript) {
        return renderNode(innerScript, opts);
      }
      if (hasAdjacentMathScript(node)) {
        return ''; // Adjacent script[type="math/tex"] will emit clean LaTeX
      }
      const fallbackTex = extractTexFromMathNode(node);
      if (fallbackTex && fallbackTex.trim()) {
        return renderMathOutput(fallbackTex, node.classList.contains('MathJax_Display'));
      }
      return '';
    }

    // Wikipedia math wrapper span.mwe-math-element
    if (node.classList.contains('mwe-math-element')) {
      const isDisplay = Boolean(
        node.querySelector('.mwe-math-fallback-image-display, math[display="block"]'),
      ) || (
        node.parentNode?.tagName === 'DD' &&
        (node.parentNode.textContent || '').trim() === (node.textContent || '').trim()
      );
      return renderMathOutput(extractTexFromMathNode(node), isDisplay);
    }

    // Wikipedia standalone fallback image
    if (
      tag === 'IMG' &&
      (node.classList.contains('mwe-math-fallback-image-inline') ||
        node.classList.contains('mwe-math-fallback-image-display'))
    ) {
      const isDisplay = node.classList.contains('mwe-math-fallback-image-display');
      return renderMathOutput(node.getAttribute('alt') || '', isDisplay);
    }

    // LaTeXML / arXiv HTML5 / Standard MathML <math>
    if (tag === 'MATH') {
      const dispAttr = (node.getAttribute('display') || '').toLowerCase();
      const isDisplay = dispAttr === 'block' || node.classList.contains('ltx_display');
      return renderMathOutput(extractTexFromMathNode(node), isDisplay);
    }

    // Zhihu / generic data-tex or data-formula nodes
    if (
      node.classList.contains('ztext-math') ||
      node.hasAttribute('data-tex') ||
      node.hasAttribute('data-formula')
    ) {
      const tex = extractTexFromMathNode(node);
      const isDisplay =
        node.getAttribute('data-display') === 'true' ||
        tag === 'DIV' ||
        /^\s*\\begin\{/.test(tex);
      return renderMathOutput(tex, isDisplay);
    }

    /* ---- 2. Standard HTML -> Clean GFM Elements ---- */

    switch (tag) {
      case 'H1':
      case 'H2':
      case 'H3':
      case 'H4':
      case 'H5':
      case 'H6': {
        const level = Number(tag[1]);
        const text = renderChildren(node, opts)
          .replace(/\s+/g, ' ')
          .replace(/\s*[¶#🔗]\s*$/, '')
          .trim();
        if (!text) return '';
        return `\n\n${'#'.repeat(level)} ${text}\n\n`;
      }

      case 'P': {
        const inner = renderChildren(node, opts).trim();
        if (!inner) return '';
        return opts.inTable ? `${inner}<br>` : `\n\n${inner}\n\n`;
      }

      case 'BR':
        return opts.inTable ? '<br>' : '  \n';

      case 'HR':
        return '\n\n---\n\n';

      case 'STRONG':
      case 'B':
        return wrapEmphasis(renderChildren(node, opts), '**');

      case 'EM':
      case 'I':
        return wrapEmphasis(renderChildren(node, opts), '*');

      case 'DEL':
      case 'S':
      case 'STRIKE':
        return wrapEmphasis(renderChildren(node, opts), '~~');

      case 'MARK':
        return wrapEmphasis(renderChildren(node, opts), '==');

      case 'CODE':
      case 'KBD':
      case 'SAMP':
        if (node.closest('pre')) {
          return node.textContent || '';
        }
        return formatInlineCode(node.textContent || '');

      case 'PRE': {
        const codeEl = node.querySelector('code');
        const lang = detectCodeLanguage(node, codeEl);
        const rawCode = extractCleanCodeText(codeEl || node);
        if (!rawCode) return '';
        const fenceRuns = rawCode.match(/`{3,}/g) || [];
        let maxLen = 2;
        for (const r of fenceRuns) if (r.length > maxLen) maxLen = r.length;
        const fence = '`'.repeat(maxLen + 1);
        return `\n\n${fence}${lang}\n${rawCode}\n${fence}\n\n`;
      }

      case 'BLOCKQUOTE': {
        const inner = renderChildren(node, opts).trim();
        if (!inner) return '';
        const quoted = inner
          .split('\n')
          .map((line) => (line.trim() ? `> ${line}` : '>'))
          .join('\n');
        return `\n\n${quoted}\n\n`;
      }

      case 'UL':
      case 'OL':
        return renderList(node, opts.listDepth || 0);

      case 'DL': {
        const parts = [];
        for (const child of node.children) {
          if (child.tagName === 'DT') {
            const t = renderChildren(child, opts).trim();
            if (t) parts.push(`**${t}**`);
          } else if (child.tagName === 'DD') {
            const d = renderChildren(child, opts).trim();
            if (d) parts.push(`: ${d}`);
          }
        }
        return parts.length ? `\n\n${parts.join('\n')}\n\n` : '';
      }

      case 'TABLE':
        return renderTable(node);

      case 'A': {
        const rawHref = (node.getAttribute('href') || '').trim();
        if (
          rawHref.startsWith('#') &&
          /^[#¶§🔗\s]*$/.test(node.textContent || '') &&
          node.closest('h1, h2, h3, h4, h5, h6')
        ) {
          return '';
        }
        const href = resolveAbsoluteUrl(rawHref, context.baseUrl);
        const inner = renderChildren(node, opts).trim();
        if (!href) return inner;
        if (!inner) return '';
        // If link text is already the exact URL, keep clean bare link
        if (inner === href) return `<${href}>`;
        // Avoid nested markdown link brackets breaking syntax
        return `[${inner.replace(/\r?\n/g, ' ')}](${href})`;
      }

      case 'IMG': {
        const w = Number(node.getAttribute('width') || 0);
        const h = Number(node.getAttribute('height') || 0);
        if ((w === 1 && h === 1) || (w > 0 && w <= 2 && h > 0 && h <= 2)) {
          return ''; // Skip 1x1 tracking pixel
        }
        const src = extractImageUrl(node, context.baseUrl);
        if (!src) return '';
        const alt = collapseInlineSpaces(node.getAttribute('alt') || '').trim().replace(/[\[\]]/g, '');
        return `![${alt}](${src})`;
      }

      case 'FIGURE': {
        const captionEl = node.querySelector('figcaption');
        const caption = captionEl ? renderChildren(captionEl, opts).trim() : '';
        let body = '';
        for (const child of node.childNodes) {
          if (child === captionEl) continue;
          body += renderNode(child, opts);
        }
        body = body.trim();
        if (!body && !caption) return '';
        return caption ? `\n\n${body}\n\n*${caption}*\n\n` : `\n\n${body}\n\n`;
      }

      case 'FIGCAPTION': {
        const text = renderChildren(node, opts).trim();
        return text ? `\n*${text}*\n` : '';
      }

      case 'SUP': {
        const inner = renderChildren(node, opts).trim();
        if (!inner) return '';
        // Citation links look cleaner without <sup> tags cluttering Markdown
        if (inner.startsWith('[') && inner.endsWith(')')) return inner;
        return `<sup>${inner}</sup>`;
      }

      case 'SUB': {
        const inner = renderChildren(node, opts).trim();
        return inner ? `<sub>${inner}</sub>` : '';
      }

      case 'DIV':
      case 'SECTION':
      case 'ARTICLE':
      case 'MAIN':
      case 'HEADER':
      case 'DETAILS': {
        const inner = renderChildren(node, opts);
        if (!inner.trim()) return '';
        // Preserve block separation for block containers that directly hold text/inline children
        const hasBlockChild = node.children.some((c) =>
          /^(P|DIV|SECTION|ARTICLE|H[1-6]|UL|OL|PRE|TABLE|BLOCKQUOTE|FIGURE|HR)$/.test(c.tagName),
        );
        return hasBlockChild ? `\n\n${inner.trim()}\n\n` : `\n\n${inner.trim()}\n\n`;
      }

      case 'SUMMARY': {
        const inner = renderChildren(node, opts).trim();
        return inner ? `\n\n**${inner}**\n\n` : '';
      }

      default:
        return renderChildren(node, opts);
    }
  }

  const raw = renderNode(root, {});
  return cleanupMarkdown(raw);
}

function cleanupMarkdown(raw) {
  const lines = String(raw || '')
    .replace(/\r\n/g, '\n')
    .split('\n');

  let inFence = false;
  let inDisplayMath = false;
  const cleaned = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^`{3,}/.test(trimmed)) {
      inFence = !inFence;
      cleaned.push(line.replace(/[ \t]+$/, ''));
      continue;
    }
    if (!inFence && trimmed === '$$') {
      inDisplayMath = !inDisplayMath;
      cleaned.push('$$');
      continue;
    }

    if (inFence || inDisplayMath) {
      cleaned.push(line.replace(/[ \t]+$/, ''));
    } else {
      // Preserve intentional two-space line breaks, strip stray trailing tabs/spaces
      const out = /  $/.test(line) ? line : line.replace(/[ \t]+$/, '');
      cleaned.push(out);
    }
  }

  return cleaned
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripDuplicateLeadingTitle(bodyMarkdown, title) {
  if (!bodyMarkdown || !title) return bodyMarkdown;
  const match = bodyMarkdown.match(/^#\s+(.+?)(?:\n+|$)/);
  if (!match) return bodyMarkdown;
  const norm = (s) => s.toLowerCase().replace(/[\s\p{P}]+/gu, '');
  if (norm(match[1]) && norm(match[1]) === norm(title)) {
    return bodyMarkdown.slice(match[0].length).trimStart();
  }
  return bodyMarkdown;
}

/* ------------------ Frontmatter & Output Presets ------------------ */

export function formatClippedOutput(bodyMarkdown, meta, options = {}) {
  const preset = options.preset || 'obsidian';
  const lang = options.lang || 'en';
  const aiSummary = options.aiSummary || null;
  const baseTags = Array.isArray(options.tags) ? options.tags : [];

  const mergedTags = [
    ...new Set([
      ...(preset === 'academic' ? ['academic', 'paper-note'] : ['web-clip']),
      ...baseTags,
      ...(Array.isArray(aiSummary?.tags) ? aiSummary.tags : []),
    ].filter(Boolean)),
  ];

  const dedupedBody = stripDuplicateLeadingTitle(bodyMarkdown, meta.title);
  const summaryCallout = formatAiSummaryCallout(aiSummary, lang);
  const stats = estimateTokens(dedupedBody);
  const dateOnly = (meta.clippedAt || new Date().toISOString()).slice(0, 10);

  if (preset === 'llm') {
    const attrs = [
      `title="${xmlAttrEscape(meta.title)}"`,
      meta.source ? `source="${xmlAttrEscape(meta.source)}"` : '',
      meta.author ? `author="${xmlAttrEscape(meta.author)}"` : '',
      `estimated_tokens="${stats.tokens}"`,
    ].filter(Boolean).join(' ');

    const doc = [
      `<document ${attrs}>`,
      `# ${meta.title}`,
      '',
      `${summaryCallout}${dedupedBody}`,
      '</document>',
      '',
    ].join('\n');

    return {
      markdown: doc,
      tokenStats: estimateTokens(doc),
      tags: mergedTags,
    };
  }

  if (preset === 'academic') {
    const fmLines = [
      '---',
      'type: academic-note',
      `title: ${yamlEscape(meta.title)}`,
      `source: ${yamlEscape(meta.source)}`,
      `author: ${yamlEscape(meta.author || 'Unknown')}`,
      meta.publishedAt ? `published: ${yamlEscape(meta.publishedAt)}` : null,
      `clipped_at: ${yamlEscape(meta.clippedAt)}`,
      `estimated_tokens: ${stats.tokens}`,
      'status: to-read',
      'tags:',
      ...mergedTags.map((t) => `  - ${t}`),
      '---',
    ].filter(Boolean);

    const share128k = formatContextPercent(stats.contextShare128k);
    const metaBox = [
      meta.source ? `> **Source**: ${meta.source}` : null,
      meta.author ? `> **Authors**: ${meta.author}` : null,
      `> **Estimated Tokens**: ${stats.tokens.toLocaleString('en-US')} (~${share128k} of 128k context)`,
    ].filter(Boolean).join('\n');

    const doc = [
      ...fmLines,
      '',
      `# ${meta.title}`,
      '',
      metaBox,
      '',
      `${summaryCallout}${dedupedBody}`,
      '',
    ].join('\n');

    return {
      markdown: doc,
      tokenStats: estimateTokens(doc),
      tags: mergedTags,
    };
  }

  if (preset === 'custom') {
    const tpl = String(options.customTemplate || DEFAULT_CUSTOM_TEMPLATE);
    const tagsYaml = mergedTags.map((t) => `  - ${t}`).join('\n');
    const replacements = {
      '{{title}}': meta.title,
      '{{title_yaml}}': yamlEscape(meta.title),
      '{{source}}': meta.source,
      '{{source_yaml}}': yamlEscape(meta.source),
      '{{author}}': meta.author,
      '{{author_yaml}}': yamlEscape(meta.author),
      '{{site}}': meta.siteName,
      '{{site_yaml}}': yamlEscape(meta.siteName),
      '{{clipped_at}}': meta.clippedAt,
      '{{clipped_at_yaml}}': yamlEscape(meta.clippedAt),
      '{{date}}': dateOnly,
      '{{estimated_tokens}}': String(stats.tokens),
      '{{tags_yaml}}': tagsYaml,
      '{{tags_inline}}': mergedTags.map((t) => `#${t}`).join(' '),
      '{{summary_callout}}': summaryCallout,
      '{{content}}': dedupedBody,
    };

    let rendered = tpl;
    for (const [token, value] of Object.entries(replacements)) {
      rendered = rendered.split(token).join(value);
    }
    const finalDoc = `${rendered.trimEnd()}\n`;
    return {
      markdown: finalDoc,
      tokenStats: estimateTokens(finalDoc),
      tags: mergedTags,
    };
  }

  // Default: 'obsidian' (Obsidian Standard)
  const fmLines = [
    '---',
    `title: ${yamlEscape(meta.title)}`,
    `source: ${yamlEscape(meta.source)}`,
    `author: ${yamlEscape(meta.author)}`,
    `clipped_at: ${yamlEscape(meta.clippedAt)}`,
    `estimated_tokens: ${stats.tokens}`,
    'tags:',
    ...mergedTags.map((t) => `  - ${t}`),
    '---',
  ];

  const doc = [
    ...fmLines,
    '',
    `# ${meta.title}`,
    '',
    `${summaryCallout}${dedupedBody}`,
    '',
  ].join('\n');

  return {
    markdown: doc,
    tokenStats: estimateTokens(doc),
    tags: mergedTags,
  };
}

/* ------------------ Public High-Level Entry Point ------------------ */

/**
 * Convert raw HTML string, browser Document, or DOM Element into clean Obsidian / LLM Markdown.
 *
 * @param {string | Document | Element} input
 * @param {{
 *   url?: string,
 *   title?: string,
 *   author?: string,
 *   siteName?: string,
 *   publishedAt?: string,
 *   clippedAt?: string,
 *   preset?: 'obsidian' | 'llm' | 'academic' | 'custom',
 *   customTemplate?: string,
 *   tags?: string[],
 *   aiSummary?: { bullets: string[], tags?: string[] } | null,
 *   isSelection?: boolean,
 *   lang?: 'zh' | 'en',
 *   forceMiniDom?: boolean
 * }} [options]
 */
export function clipHtmlToMarkdown(input, options = {}) {
  let doc;
  let workingRoot = null;

  if (typeof input === 'string') {
    doc = parseHtmlDocument(input, { forceMiniDom: options.forceMiniDom });
  } else if (input && input.nodeType === 9) {
    doc = input.cloneNode(true);
  } else if (input && input.nodeType === 1) {
    // Wrap cloned element so metadata + selectors work uniformly
    const wrapper = parseHtmlDocument('<html><body></body></html>', {
      forceMiniDom: options.forceMiniDom,
    });
    workingRoot = input.cloneNode(true);
    wrapper.body.appendChild(workingRoot);
    doc = wrapper;
  } else {
    throw new Error('clipHtmlToMarkdown expects an HTML string, Document, or Element');
  }

  const meta = extractMetadata(doc, options);
  const baseUrl = meta.source || options.url || '';

  let container;
  let adapterName;
  let extraStrip;

  if (workingRoot) {
    container = workingRoot;
    adapterName = 'Element';
    extraStrip = [];
  } else {
    const selected = selectMainContent(doc, baseUrl, Boolean(options.isSelection));
    container = selected.container;
    adapterName = selected.adapterName;
    extraStrip = selected.extraStrip;
  }

  stripNoiseInPlace(container, extraStrip);

  const context = {
    baseUrl,
    mathCount: 0,
  };

  const bodyMarkdown = renderMarkdownTree(container, context);
  const formatted = formatClippedOutput(bodyMarkdown, meta, options);

  return {
    markdown: formatted.markdown,
    bodyMarkdown,
    meta,
    adapterName,
    mathCount: context.mathCount,
    tokenStats: formatted.tokenStats,
    tags: formatted.tags,
  };
}
