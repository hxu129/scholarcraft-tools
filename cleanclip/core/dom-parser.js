/**
 * Zero-dependency HTML5-tolerant parser & MiniDOM implementation.
 *
 * Allows `core/markdown.js` to run identically against real browser DOMs
 * (`Document`/`Element` via DOMParser or live tab) AND in Node v22 tests
 * with zero npm dependencies.
 */

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const RAW_TEXT_TAGS = new Set(['script', 'style']);
const RCDATA_TAGS = new Set(['textarea', 'title']);

const BLOCK_CLOSES_P = new Set([
  'address', 'article', 'aside', 'blockquote', 'details', 'div', 'dl',
  'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3',
  'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'main', 'menu', 'nav',
  'ol', 'p', 'pre', 'section', 'table', 'ul',
]);

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
  nbsp: '\u00a0',
  ensp: '\u2002',
  emsp: '\u2003',
  thinsp: '\u2009',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  copy: '©',
  reg: '®',
  trade: '™',
  times: '×',
  divide: '÷',
  plusmn: '±',
  minus: '−',
  middot: '·',
  bull: '•',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  larr: '←',
  rarr: '→',
  uarr: '↑',
  darr: '↓',
  harr: '↔',
  rArr: '⇒',
  lArr: '⇐',
  hArr: '⇔',
  le: '≤',
  ge: '≥',
  ne: '≠',
  asymp: '≈',
  equiv: '≡',
  infin: '∞',
  sum: '∑',
  prod: '∏',
  int: '∫',
  part: '∂',
  nabla: '∇',
  radic: '√',
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  theta: 'θ',
  lambda: 'λ',
  mu: 'μ',
  pi: 'π',
  sigma: 'σ',
  tau: 'τ',
  phi: 'φ',
  omega: 'ω',
  Gamma: 'Γ',
  Delta: 'Δ',
  Theta: 'Θ',
  Lambda: 'Λ',
  Pi: 'Π',
  Sigma: 'Σ',
  Phi: 'Φ',
  Omega: 'Ω',
  sect: '§',
  para: '¶',
  deg: '°',
};

export function decodeHtmlEntities(str) {
  if (!str || !str.includes('&')) return str || '';
  return str.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z][A-Za-z0-9]+);/g, (match, code) => {
    if (code.startsWith('#x') || code.startsWith('#X')) {
      const cp = parseInt(code.slice(2), 16);
      if (Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff) {
        try { return String.fromCodePoint(cp); } catch { return match; }
      }
      return match;
    }
    if (code.startsWith('#')) {
      const cp = parseInt(code.slice(1), 10);
      if (Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff) {
        try { return String.fromCodePoint(cp); } catch { return match; }
      }
      return match;
    }
    return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, code)
      ? NAMED_ENTITIES[code]
      : match;
  });
}

class MiniNode {
  constructor(nodeType) {
    this.nodeType = nodeType;
    this.parentNode = null;
    this.childNodes = [];
  }

  get previousSibling() {
    if (!this.parentNode) return null;
    const idx = this.parentNode.childNodes.indexOf(this);
    return idx > 0 ? this.parentNode.childNodes[idx - 1] : null;
  }

  get nextSibling() {
    if (!this.parentNode) return null;
    const idx = this.parentNode.childNodes.indexOf(this);
    return idx >= 0 && idx < this.parentNode.childNodes.length - 1
      ? this.parentNode.childNodes[idx + 1]
      : null;
  }

  get previousElementSibling() {
    let cur = this.previousSibling;
    while (cur) {
      if (cur.nodeType === 1) return cur;
      cur = cur.previousSibling;
    }
    return null;
  }

  get nextElementSibling() {
    let cur = this.nextSibling;
    while (cur) {
      if (cur.nodeType === 1) return cur;
      cur = cur.nextSibling;
    }
    return null;
  }

  get firstChild() {
    return this.childNodes[0] || null;
  }

  get firstElementChild() {
    return this.childNodes.find((c) => c.nodeType === 1) || null;
  }

  get children() {
    return this.childNodes.filter((c) => c.nodeType === 1);
  }

  appendChild(child) {
    if (child.parentNode) child.remove();
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  remove() {
    if (!this.parentNode) return;
    const idx = this.parentNode.childNodes.indexOf(this);
    if (idx !== -1) this.parentNode.childNodes.splice(idx, 1);
    this.parentNode = null;
  }
}

export class MiniText extends MiniNode {
  constructor(value) {
    super(3);
    this.nodeValue = String(value ?? '');
  }

  get textContent() {
    return this.nodeValue;
  }

  set textContent(v) {
    this.nodeValue = String(v ?? '');
  }

  cloneNode() {
    return new MiniText(this.nodeValue);
  }
}

export class MiniElement extends MiniNode {
  constructor(tagName) {
    super(1);
    this.tagName = String(tagName || '').toUpperCase();
    this.nodeName = this.tagName;
    this._attrs = new Map();
  }

  getAttribute(name) {
    const key = String(name || '').toLowerCase();
    return this._attrs.has(key) ? this._attrs.get(key) : null;
  }

  setAttribute(name, value) {
    this._attrs.set(String(name || '').toLowerCase(), String(value ?? ''));
  }

  hasAttribute(name) {
    return this._attrs.has(String(name || '').toLowerCase());
  }

  removeAttribute(name) {
    this._attrs.delete(String(name || '').toLowerCase());
  }

  get id() {
    return this.getAttribute('id') || '';
  }

  get className() {
    return this.getAttribute('class') || '';
  }

  get classList() {
    const self = this;
    const getList = () => self.className.trim().split(/\s+/).filter(Boolean);
    return {
      contains(cls) {
        return getList().includes(cls);
      },
      add(cls) {
        const list = getList();
        if (!list.includes(cls)) {
          list.push(cls);
          self.setAttribute('class', list.join(' '));
        }
      },
      remove(cls) {
        const next = getList().filter((c) => c !== cls);
        self.setAttribute('class', next.join(' '));
      },
      [Symbol.iterator]() {
        return getList()[Symbol.iterator]();
      },
    };
  }

  get textContent() {
    let out = '';
    for (const child of this.childNodes) {
      out += child.textContent;
    }
    return out;
  }

  set textContent(v) {
    this.childNodes = [];
    if (v !== null && v !== undefined && String(v).length > 0) {
      this.appendChild(new MiniText(String(v)));
    }
  }

  cloneNode(deep = false) {
    const copy = new MiniElement(this.tagName);
    for (const [k, v] of this._attrs.entries()) {
      copy._attrs.set(k, v);
    }
    if (deep) {
      for (const child of this.childNodes) {
        copy.appendChild(child.cloneNode(true));
      }
    }
    return copy;
  }

  matches(selector) {
    return matchesSelectorList(this, selector);
  }

  closest(selector) {
    let cur = this;
    while (cur && cur.nodeType === 1) {
      if (matchesSelectorList(cur, selector)) return cur;
      cur = cur.parentNode;
    }
    return null;
  }

  querySelectorAll(selector) {
    const results = [];
    walkElements(this, (el) => {
      if (matchesSelectorList(el, selector)) results.push(el);
    }, false);
    return results;
  }

  querySelector(selector) {
    let found = null;
    walkElements(this, (el) => {
      if (!found && matchesSelectorList(el, selector)) {
        found = el;
        return false;
      }
      return true;
    }, false);
    return found;
  }
}

export class MiniDocument extends MiniNode {
  constructor() {
    super(9);
    this.nodeName = '#document';
  }

  get documentElement() {
    return this.children.find((c) => c.tagName === 'HTML') || this.firstElementChild || null;
  }

  get head() {
    return this.querySelector('head');
  }

  get body() {
    return this.querySelector('body') || this.documentElement || this;
  }

  get title() {
    const el = this.querySelector('title');
    return el ? el.textContent.trim() : '';
  }

  cloneNode(deep = true) {
    const doc = new MiniDocument();
    if (deep) {
      for (const child of this.childNodes) {
        doc.appendChild(child.cloneNode(true));
      }
    }
    return doc;
  }

  querySelectorAll(selector) {
    const results = [];
    walkElements(this, (el) => {
      if (matchesSelectorList(el, selector)) results.push(el);
    }, false);
    return results;
  }

  querySelector(selector) {
    let found = null;
    walkElements(this, (el) => {
      if (!found && matchesSelectorList(el, selector)) {
        found = el;
        return false;
      }
      return true;
    }, false);
    return found;
  }
}

function walkElements(root, visitor, includeSelf = false) {
  if (includeSelf && root.nodeType === 1) {
    if (visitor(root) === false) return false;
  }
  for (const child of root.childNodes) {
    if (child.nodeType === 1) {
      if (visitor(child) === false) return false;
      if (walkElements(child, visitor, false) === false) return false;
    }
  }
  return true;
}

/* ------------------ Lightweight CSS Selector Engine ------------------ */

function splitTopLevel(str, delimiter) {
  const parts = [];
  let cur = '';
  let depthBracket = 0;
  let depthParen = 0;
  let quote = '';

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (quote) {
      cur += ch;
      if (ch === '\\' && i + 1 < str.length) {
        cur += str[++i];
      } else if (ch === quote) {
        quote = '';
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      cur += ch;
    } else if (ch === '[') {
      depthBracket++;
      cur += ch;
    } else if (ch === ']') {
      depthBracket = Math.max(0, depthBracket - 1);
      cur += ch;
    } else if (ch === '(') {
      depthParen++;
      cur += ch;
    } else if (ch === ')') {
      depthParen = Math.max(0, depthParen - 1);
      cur += ch;
    } else if (ch === delimiter && depthBracket === 0 && depthParen === 0) {
      if (cur.trim()) parts.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function tokenizeComplexSelector(selector) {
  const tokens = [];
  let cur = '';
  let depthBracket = 0;
  let depthParen = 0;
  let quote = '';
  let pendingSpace = false;

  const flushCur = () => {
    if (cur) {
      tokens.push({ type: 'compound', value: cur });
      cur = '';
    }
  };

  for (let i = 0; i < selector.length; i++) {
    const ch = selector[i];
    if (quote) {
      cur += ch;
      if (ch === '\\' && i + 1 < selector.length) cur += selector[++i];
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      if (pendingSpace && cur === '' && tokens.length && tokens[tokens.length - 1].type === 'compound') {
        tokens.push({ type: 'combinator', value: ' ' });
      }
      pendingSpace = false;
      quote = ch;
      cur += ch;
      continue;
    }
    if (ch === '[') { depthBracket++; cur += ch; continue; }
    if (ch === ']') { depthBracket = Math.max(0, depthBracket - 1); cur += ch; continue; }
    if (ch === '(') { depthParen++; cur += ch; continue; }
    if (ch === ')') { depthParen = Math.max(0, depthParen - 1); cur += ch; continue; }

    if (depthBracket === 0 && depthParen === 0) {
      if (ch === '>' || ch === '+' || ch === '~') {
        flushCur();
        pendingSpace = false;
        tokens.push({ type: 'combinator', value: ch });
        continue;
      }
      if (/\s/.test(ch)) {
        flushCur();
        pendingSpace = true;
        continue;
      }
    }

    if (pendingSpace && tokens.length && tokens[tokens.length - 1].type === 'compound') {
      tokens.push({ type: 'combinator', value: ' ' });
    }
    pendingSpace = false;
    cur += ch;
  }
  flushCur();
  return tokens;
}

function matchesCompound(el, compound) {
  if (!el || el.nodeType !== 1) return false;
  let i = 0;
  const len = compound.length;

  while (i < len) {
    const ch = compound[i];
    if (ch === '*') {
      i++;
      continue;
    }
    if (ch === '#') {
      i++;
      const start = i;
      while (i < len && /[A-Za-z0-9_-]/.test(compound[i])) i++;
      const id = compound.slice(start, i);
      if (el.id !== id) return false;
      continue;
    }
    if (ch === '.') {
      i++;
      const start = i;
      while (i < len && /[A-Za-z0-9_-]/.test(compound[i])) i++;
      const cls = compound.slice(start, i);
      if (!el.classList.contains(cls)) return false;
      continue;
    }
    if (ch === '[') {
      let depth = 1;
      let q = '';
      const start = i + 1;
      i++;
      while (i < len && depth > 0) {
        const c = compound[i];
        if (q) {
          if (c === '\\') i++;
          else if (c === q) q = '';
        } else if (c === '"' || c === "'") {
          q = c;
        } else if (c === '[') {
          depth++;
        } else if (c === ']') {
          depth--;
        }
        i++;
      }
      const expr = compound.slice(start, i - 1).trim();
      if (!matchesAttrExpr(el, expr)) return false;
      continue;
    }
    if (ch === ':') {
      i++;
      const start = i;
      while (i < len && /[A-Za-z-]/.test(compound[i])) i++;
      const pseudo = compound.slice(start, i).toLowerCase();
      let arg = '';
      if (compound[i] === '(') {
        let depth = 1;
        let q = '';
        const aStart = i + 1;
        i++;
        while (i < len && depth > 0) {
          const c = compound[i];
          if (q) {
            if (c === '\\') i++;
            else if (c === q) q = '';
          } else if (c === '"' || c === "'") {
            q = c;
          } else if (c === '(') {
            depth++;
          } else if (c === ')') {
            depth--;
          }
          i++;
        }
        arg = compound.slice(aStart, i - 1).trim();
      }
      if (pseudo === 'not') {
        if (matchesSelectorList(el, arg)) return false;
      } else if (pseudo === 'first-child') {
        if (el.previousElementSibling !== null) return false;
      } else if (pseudo === 'last-child') {
        if (el.nextElementSibling !== null) return false;
      } else if (pseudo === 'empty') {
        if (el.childNodes.length > 0) return false;
      }
      continue;
    }

    // Tag name
    const start = i;
    while (i < len && /[A-Za-z0-9_-]/.test(compound[i])) i++;
    const tag = compound.slice(start, i).toUpperCase();
    if (!tag || el.tagName !== tag) return false;
  }

  return true;
}

function matchesAttrExpr(el, expr) {
  const m = expr.match(/^([A-Za-z0-9_:-]+)(?:\s*([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))(?:\s+([iI]))?)?$/);
  if (!m) return false;
  const attrName = m[1].toLowerCase();
  const op = m[2];
  if (!op) return el.hasAttribute(attrName);

  const actualRaw = el.getAttribute(attrName);
  if (actualRaw === null) return false;

  const expectedRaw = m[3] ?? m[4] ?? m[5] ?? '';
  const ci = Boolean(m[6]);
  const actual = ci ? actualRaw.toLowerCase() : actualRaw;
  const expected = ci ? expectedRaw.toLowerCase() : expectedRaw;

  switch (op) {
    case '=': return actual === expected;
    case '*=': return expected !== '' && actual.includes(expected);
    case '^=': return expected !== '' && actual.startsWith(expected);
    case '$=': return expected !== '' && actual.endsWith(expected);
    case '~=': return expected !== '' && actual.trim().split(/\s+/).includes(expected);
    case '|=': return actual === expected || actual.startsWith(`${expected}-`);
    default: return false;
  }
}

function matchesComplexTokens(el, tokens, idx) {
  const tok = tokens[idx];
  if (!tok || tok.type !== 'compound') return false;
  if (!matchesCompound(el, tok.value)) return false;
  if (idx === 0) return true;

  const comb = tokens[idx - 1];
  const prevIdx = idx - 2;
  if (!comb || comb.type !== 'combinator') return false;

  if (comb.value === '>') {
    return el.parentNode && el.parentNode.nodeType === 1
      ? matchesComplexTokens(el.parentNode, tokens, prevIdx)
      : false;
  }
  if (comb.value === ' ') {
    let anc = el.parentNode;
    while (anc && anc.nodeType === 1) {
      if (matchesComplexTokens(anc, tokens, prevIdx)) return true;
      anc = anc.parentNode;
    }
    return false;
  }
  if (comb.value === '+') {
    return el.previousElementSibling
      ? matchesComplexTokens(el.previousElementSibling, tokens, prevIdx)
      : false;
  }
  if (comb.value === '~') {
    let sib = el.previousElementSibling;
    while (sib) {
      if (matchesComplexTokens(sib, tokens, prevIdx)) return true;
      sib = sib.previousElementSibling;
    }
    return false;
  }
  return false;
}

function matchesSelectorList(el, selector) {
  if (!el || el.nodeType !== 1 || !selector) return false;
  const selectors = splitTopLevel(String(selector), ',');
  for (const sel of selectors) {
    const tokens = tokenizeComplexSelector(sel);
    if (tokens.length > 0 && matchesComplexTokens(el, tokens, tokens.length - 1)) {
      return true;
    }
  }
  return false;
}

/* ------------------ HTML5-Tolerant Tokenizer & Tree Builder ------------------ */

function parseAttributes(attrString, el) {
  let i = 0;
  const len = attrString.length;
  while (i < len) {
    while (i < len && /[\s/]/.test(attrString[i])) i++;
    if (i >= len) break;

    const nameStart = i;
    while (i < len && !/[\s=/>]/.test(attrString[i])) i++;
    const name = attrString.slice(nameStart, i).toLowerCase();
    if (!name) { i++; continue; }

    while (i < len && /\s/.test(attrString[i])) i++;
    if (attrString[i] === '=') {
      i++;
      while (i < len && /\s/.test(attrString[i])) i++;
      let value = '';
      if (attrString[i] === '"' || attrString[i] === "'") {
        const q = attrString[i++];
        const valStart = i;
        while (i < len && attrString[i] !== q) i++;
        value = attrString.slice(valStart, i);
        if (i < len && attrString[i] === q) i++;
      } else {
        const valStart = i;
        while (i < len && !/[\s>]/.test(attrString[i])) i++;
        value = attrString.slice(valStart, i);
      }
      el.setAttribute(name, decodeHtmlEntities(value));
    } else {
      el.setAttribute(name, '');
    }
  }
}

function autoCloseBeforeOpen(stack, tagLower) {
  const topTag = () => (stack.length > 1 ? stack[stack.length - 1].tagName.toLowerCase() : '');

  if (BLOCK_CLOSES_P.has(tagLower) && topTag() === 'p') {
    stack.pop();
  }
  if (tagLower === 'li') {
    for (let i = stack.length - 1; i >= 1; i--) {
      const t = stack[i].tagName.toLowerCase();
      if (t === 'li') { stack.length = i; break; }
      if (t === 'ul' || t === 'ol') break;
    }
  }
  if (tagLower === 'td' || tagLower === 'th') {
    for (let i = stack.length - 1; i >= 1; i--) {
      const t = stack[i].tagName.toLowerCase();
      if (t === 'td' || t === 'th') { stack.length = i; break; }
      if (t === 'tr' || t === 'table') break;
    }
  }
  if (tagLower === 'tr') {
    for (let i = stack.length - 1; i >= 1; i--) {
      const t = stack[i].tagName.toLowerCase();
      if (t === 'tr') { stack.length = i; break; }
      if (t === 'table' || t === 'thead' || t === 'tbody' || t === 'tfoot') break;
    }
  }
  if (tagLower === 'dt' || tagLower === 'dd') {
    for (let i = stack.length - 1; i >= 1; i--) {
      const t = stack[i].tagName.toLowerCase();
      if (t === 'dt' || t === 'dd') { stack.length = i; break; }
      if (t === 'dl') break;
    }
  }
}

/**
 * Parse an HTML string into a lightweight DOM tree (`MiniDocument`).
 * @param {string} html
 * @returns {MiniDocument}
 */
export function parseHtmlToMiniDom(html) {
  const src = String(html || '');
  const doc = new MiniDocument();
  const stack = [doc];

  let i = 0;
  const len = src.length;

  const appendText = (raw, decode = true) => {
    if (!raw) return;
    const text = decode ? decodeHtmlEntities(raw) : raw;
    if (!text) return;
    const parent = stack[stack.length - 1];
    const last = parent.childNodes[parent.childNodes.length - 1];
    if (last && last.nodeType === 3) {
      last.nodeValue += text;
    } else {
      parent.appendChild(new MiniText(text));
    }
  };

  while (i < len) {
    const lt = src.indexOf('<', i);
    if (lt === -1) {
      appendText(src.slice(i));
      break;
    }
    if (lt > i) {
      appendText(src.slice(i, lt));
    }

    // Comment <!-- ... -->
    if (src.startsWith('<!--', lt)) {
      const end = src.indexOf('-->', lt + 4);
      i = end === -1 ? len : end + 3;
      continue;
    }

    // DOCTYPE / XML declaration / CDATA
    if (src.startsWith('<![CDATA[', lt)) {
      const end = src.indexOf(']]>', lt + 9);
      const data = end === -1 ? src.slice(lt + 9) : src.slice(lt + 9, end);
      appendText(data, false);
      i = end === -1 ? len : end + 3;
      continue;
    }
    if (src[lt + 1] === '!' || src[lt + 1] === '?') {
      const end = src.indexOf('>', lt + 2);
      i = end === -1 ? len : end + 1;
      continue;
    }

    // Closing tag </tag>
    if (src[lt + 1] === '/') {
      const end = src.indexOf('>', lt + 2);
      if (end === -1) {
        appendText(src.slice(lt));
        break;
      }
      const closeName = src.slice(lt + 2, end).trim().toLowerCase().split(/\s+/)[0];
      if (closeName) {
        for (let k = stack.length - 1; k >= 1; k--) {
          if (stack[k].tagName.toLowerCase() === closeName) {
            stack.length = k;
            break;
          }
        }
      }
      i = end + 1;
      continue;
    }

    // Opening tag: must start with ASCII letter
    if (!/[A-Za-z]/.test(src[lt + 1] || '')) {
      // Stray `<` in math or prose (e.g. "x < 5") — preserve as text!
      appendText('<', false);
      i = lt + 1;
      continue;
    }

    let j = lt + 1;
    while (j < len && /[A-Za-z0-9:_-]/.test(src[j])) j++;
    const tagLower = src.slice(lt + 1, j).toLowerCase();

    // Scan to closing `>` respecting quoted attribute values
    let quote = '';
    while (j < len) {
      const c = src[j];
      if (quote) {
        if (c === quote) quote = '';
      } else if (c === '"' || c === "'") {
        quote = c;
      } else if (c === '>') {
        break;
      }
      j++;
    }
    if (j >= len) {
      appendText(src.slice(lt));
      break;
    }

    const rawAttrs = src.slice(lt + 1 + tagLower.length, j);
    const selfClosing = /\/\s*$/.test(rawAttrs);
    const attrBody = selfClosing ? rawAttrs.replace(/\/\s*$/, '') : rawAttrs;

    autoCloseBeforeOpen(stack, tagLower);

    const el = new MiniElement(tagLower);
    parseAttributes(attrBody, el);
    stack[stack.length - 1].appendChild(el);
    i = j + 1;

    if (RAW_TEXT_TAGS.has(tagLower) || RCDATA_TAGS.has(tagLower)) {
      if (!selfClosing) {
        const closeRe = new RegExp(`</${tagLower}\\s*>`, 'i');
        const rest = src.slice(i);
        const match = closeRe.exec(rest);
        const rawInner = match ? rest.slice(0, match.index) : rest;
        if (rawInner) {
          el.appendChild(new MiniText(
            RCDATA_TAGS.has(tagLower) ? decodeHtmlEntities(rawInner) : rawInner,
          ));
        }
        i = match ? i + match.index + match[0].length : len;
      }
      continue;
    }

    if (!VOID_TAGS.has(tagLower) && !selfClosing) {
      stack.push(el);
    }
  }

  // Ensure document has <html><body> wrapper when fragment passed (mirrors DOMParser)
  if (!doc.querySelector('body')) {
    const htmlEl = new MiniElement('html');
    const bodyEl = new MiniElement('body');
    const existing = [...doc.childNodes];
    for (const node of existing) {
      bodyEl.appendChild(node);
    }
    htmlEl.appendChild(bodyEl);
    doc.appendChild(htmlEl);
  }

  return doc;
}

/**
 * Parse an HTML string into a DOM Document using native browser DOMParser when available,
 * or our zero-dependency MiniDOM parser in Node 22.
 *
 * @param {string} html
 * @param {{ forceMiniDom?: boolean }} [options]
 */
export function parseHtmlDocument(html, options = {}) {
  if (!options.forceMiniDom && typeof globalThis.DOMParser === 'function') {
    return new globalThis.DOMParser().parseFromString(String(html || ''), 'text/html');
  }
  return parseHtmlToMiniDom(html);
}
