/**
 * PaperPreflight Pro — Deterministic LaTeX, BibTeX & Multi-File Preflight Auditor + Sanitizer
 *
 * 100% local, zero external dependencies, compatible with Browser, Chrome MV3, and Node v22.
 */

import { FREE_MAX_FILES, FREE_MAX_LINES } from './config.js';
import { scanPdfBytes } from './pdf-scanner.js';

const VERBATIM_ENVS = new Set([
  'verbatim',
  'verbatim*',
  'lstlisting',
  'minted',
  'Verbatim',
  'BVerbatim',
  'LVerbatim',
]);

const ALLOWED_ANON_URL_RE = /(?:anonymous\.4open\.science|github\.com\/anonymous(?:[\/?#\-_]|$)|github\.com\/anon(?:[\/?#\-_]|$)|gitlab\.com\/anonymous(?:[\/?#\-_]|$)|huggingface\.co\/anonymous(?:[\/?#\-_]|$)|example\.(?:com|org|edu))/i;

const NON_ANON_URL_RULES = [
  { label: 'GitHub', re: /https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]*)?)/gi },
  { label: 'GitLab', re: /https?:\/\/(?:www\.)?gitlab\.com\/([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]*)?)/gi },
  { label: 'Hugging Face', re: /https?:\/\/(?:www\.)?huggingface\.co\/([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]*)?)/gi },
  { label: 'Bitbucket', re: /https?:\/\/(?:www\.)?bitbucket\.org\/([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]*)?)/gi },
  { label: 'GitHub Pages', re: /https?:\/\/([A-Za-z0-9-]+)\.github\.io(?:\/[^\s{}()<>"]*)?/gi },
  { label: 'ORCID', re: /https?:\/\/(?:www\.)?orcid\.org\/[0-9X-]+/gi },
  { label: 'Google Scholar', re: /https?:\/\/scholar\.google\.[a-z.]+\/[^\s{}()<>"]*/gi },
  { label: 'Personal Homepage (~user)', re: /https?:\/\/[^/\s{}()<>"]+\/~[A-Za-z0-9._-]+(?:\/[^\s{}()<>"]*)?/gi },
  { label: 'Google Colab (GitHub)', re: /https?:\/\/colab\.research\.google\.com\/github\/[A-Za-z0-9_.-]+/gi },
];

const EMAIL_RE = /\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;
const SENSITIVE_EMAIL_DOMAIN_RE = /(?:\.edu(?:\.[a-z]{2})?$|\.ac\.[a-z]{2,}$|^(?:gmail|googlemail|outlook|hotmail|live|icloud|me|proton|protonmail|qq|163|126|foxmail|yahoo|google|meta|fb|microsoft|openai|anthropic|deepmind|nvidia|amazon|apple|bytedance|tencent|alibaba-inc|baidu)\.[a-z.]+$)/i;

const SELF_CITATION_PATTERNS = [
  /\bin\s+our\s+(?:previous|prior|earlier)\s+(?:work|paper|study|publication|article)\b/gi,
  /\bwe\s+(?:previously|earlier)\s+(?:proposed|introduced|developed|showed|demonstrated|presented|designed)\b/gi,
  /\bwe\s+have\s+previously\s+(?:proposed|introduced|developed|showed|demonstrated|presented)\b/gi,
  /\bas\s+(?:shown|demonstrated|introduced|proposed|described)\s+in\s+our\s+(?:prior|previous|earlier)\b/gi,
  /\b(?:building|extending|following)\s+(?:on|upon)\s+our\s+(?:prior|previous|earlier)\s+(?:work|paper|method|study)\b/gi,
  /\bour\s+(?:previous|prior|earlier)\s+(?:work|paper|study)\s*(?:~?\\cite|\(|\[)/gi,
];

const LOCAL_PATH_PATTERNS = [
  /\/Users\/[A-Za-z0-9._-]+\/[^\s{}()<>"]*/g,
  /\/home\/[A-Za-z0-9._-]+\/[^\s{}()<>"]*/g,
  /[A-Za-z]:\\Users\\[A-Za-z0-9._-]+(?:\\[^\s{}()<>"]*)?/g,
  /[A-Za-z]:\/Users\/[A-Za-z0-9._-]+(?:\/[^\s{}()<>"]*)?/g,
  /file:\/\/\/Users\/[A-Za-z0-9._-]+[^\s{}()<>"]*/g,
];

const GRANT_PATTERNS = [
  /\b(?:NSF|NSFC|ERC|NIH|DARPA|EPSRC|JSPS|NSERC|DFG)\b(?=[^.\n]{0,60}(?:grant|award|fund|support|no\.?|#|\d{4,}))/gi,
  /\bGrant\s*(?:No\.?|Number|#)\s*[A-Za-z0-9\-/]+/gi,
  /\b(?:supported|funded)\s+(?:in\s+part\s+)?by\s+(?:the\s+)?(?:NSF|NSFC|ERC|NIH|DARPA|National\s+Science\s+Foundation|Natural\s+Science\s+Foundation|European\s+Research\s+Council|grant)\b/gi,
];

const REPEATED_WORD_RE = /\b(the|a|an|is|are|was|were|be|been|in|on|of|to|for|with|that|this|these|those|we|our|and|or|by|as|at|it|from|can|will|have|has)\s+\1\b/gi;

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countPrecedingBackslashes(line, index) {
  let count = 0;
  let i = index - 1;
  while (i >= 0 && line[i] === '\\') {
    count++;
    i--;
  }
  return count;
}

/**
 * Split a single non-verbatim LaTeX line into `{ code, comment, commentIndex }`
 * while strictly respecting `\verb|...|` and escaped `\%` (counting consecutive backslashes).
 */
export function splitLatexLine(line) {
  const len = line.length;
  let i = 0;
  while (i < len) {
    // Handle \verb<delim>...<delim> and \verb*<delim>...<delim>
    if (line[i] === '\\' && line.startsWith('\\verb', i)) {
      const nextIdx = i + 5;
      const isStar = line[nextIdx] === '*';
      const delimIdx = isStar ? nextIdx + 1 : nextIdx;
      const delim = line[delimIdx];
      // \verb must be followed by a non-letter delimiter (not \verbatim)
      if (delim && !/[A-Za-z]/.test(delim)) {
        const closeIdx = line.indexOf(delim, delimIdx + 1);
        if (closeIdx !== -1) {
          i = closeIdx + 1;
          continue;
        }
        // Unclosed verb on this line — treat rest of line as code
        return { code: line, comment: '', commentIndex: -1 };
      }
    }

    if (line[i] === '%') {
      const bsCount = countPrecedingBackslashes(line, i);
      if (bsCount % 2 === 0) {
        return {
          code: line.slice(0, i),
          comment: line.slice(i),
          commentIndex: i,
        };
      }
    }
    i++;
  }
  return { code: line, comment: '', commentIndex: -1 };
}

/**
 * Compute per-line parsed structure for a `.tex` file, tracking verbatim environments
 * and producing a line-aligned `activeText` where comment segments are replaced with spaces.
 */
function parseTexLines(content) {
  const rawLines = String(content || '').split(/\r?\n/);
  const parsed = [];
  const activeLines = [];
  let inVerbatim = null;

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const lineNo = i + 1;

    if (inVerbatim) {
      parsed.push({ lineNo, raw, code: raw, comment: '', commentIndex: -1, inVerbatim: true });
      activeLines.push(raw);
      const endRe = new RegExp(`\\\\end\\{${escapeRegex(inVerbatim)}\\}`);
      if (endRe.test(raw)) {
        inVerbatim = null;
      }
      continue;
    }

    const { code, comment, commentIndex } = splitLatexLine(raw);
    parsed.push({ lineNo, raw, code, comment, commentIndex, inVerbatim: false });
    activeLines.push(code + ' '.repeat(comment.length));

    const beginMatch = code.match(/\\begin\{([A-Za-z*]+)\}/);
    if (beginMatch && VERBATIM_ENVS.has(beginMatch[1])) {
      const endRe = new RegExp(`\\\\end\\{${escapeRegex(beginMatch[1])}\\}`);
      if (!endRe.test(code.slice(beginMatch.index + beginMatch[0].length))) {
        inVerbatim = beginMatch[1];
      }
    }
  }

  return {
    lines: parsed,
    activeText: activeLines.join('\n'),
  };
}

function indexToLineNumber(text, index) {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line++;
  }
  return line;
}

/**
 * Find all occurrences of `\macroName[opt]{content}` in `text` with full balanced-brace parsing.
 */
function findBalancedMacros(text, macroNames) {
  const results = [];
  const pattern = new RegExp(`\\\\(${macroNames.map(escapeRegex).join('|')})(?![A-Za-z])`, 'g');
  let m;
  while ((m = pattern.exec(text)) !== null) {
    const macro = m[1];
    let pos = m.index + m[0].length;
    const optArgs = [];

    // Skip whitespace & optional [...] arguments
    while (pos < text.length) {
      while (pos < text.length && /\s/.test(text[pos])) pos++;
      if (text[pos] === '[') {
        let depth = 0;
        const optStart = pos + 1;
        while (pos < text.length) {
          if (text[pos] === '\\') { pos += 2; continue; }
          if (text[pos] === '[') depth++;
          else if (text[pos] === ']') {
            depth--;
            if (depth === 0) {
              optArgs.push(text.slice(optStart, pos));
              pos++;
              break;
            }
          }
          pos++;
        }
      } else {
        break;
      }
    }

    while (pos < text.length && /\s/.test(text[pos])) pos++;
    if (text[pos] !== '{') continue;

    const braceStart = pos;
    let depth = 0;
    let foundEnd = -1;
    while (pos < text.length) {
      if (text[pos] === '\\') {
        pos += 2;
        continue;
      }
      if (text[pos] === '{') depth++;
      else if (text[pos] === '}') {
        depth--;
        if (depth === 0) {
          foundEnd = pos;
          break;
        }
      }
      pos++;
    }

    if (foundEnd !== -1) {
      results.push({
        macro,
        start: m.index,
        end: foundEnd + 1,
        line: indexToLineNumber(text, m.index),
        optArgs,
        arg: text.slice(braceStart + 1, foundEnd),
        raw: text.slice(m.index, foundEnd + 1),
      });
    }
  }
  return results;
}

/**
 * Parse BibTeX entries accurately with brace/quote nesting.
 */
export function parseBibtexEntries(bibContent) {
  const text = String(bibContent || '');
  const entries = [];
  const metaBlocks = [];
  const len = text.length;
  let i = 0;

  while (i < len) {
    const atIdx = text.indexOf('@', i);
    if (atIdx === -1) break;

    const headerSlice = text.slice(atIdx);
    const typeMatch = headerSlice.match(/^@([A-Za-z]+)\s*([{(])/);
    if (!typeMatch) {
      i = atIdx + 1;
      continue;
    }

    const entryType = typeMatch[1].toLowerCase();
    const openDelim = typeMatch[2];
    const closeDelim = openDelim === '{' ? '}' : ')';
    const openPos = atIdx + typeMatch[0].length - 1;

    let pos = openPos;
    let depth = 0;
    let inQuote = false;
    let endPos = -1;
    while (pos < len) {
      const ch = text[pos];
      if (ch === '\\') {
        pos += 2;
        continue;
      }
      if (ch === '"' && depth === 1) {
        inQuote = !inQuote;
      } else if (!inQuote) {
        if (ch === openDelim) depth++;
        else if (ch === closeDelim) {
          depth--;
          if (depth === 0) {
            endPos = pos + 1;
            break;
          }
        }
      }
      pos++;
    }

    if (endPos === -1) {
      i = atIdx + 1;
      continue;
    }

    const raw = text.slice(atIdx, endPos);
    const startLine = indexToLineNumber(text, atIdx);

    if (entryType === 'comment') {
      i = endPos;
      continue;
    }
    if (entryType === 'preamble' || entryType === 'string') {
      metaBlocks.push({ type: entryType, start: atIdx, end: endPos, line: startLine, raw });
      i = endPos;
      continue;
    }

    const inner = text.slice(openPos + 1, endPos - 1);
    const commaIdx = inner.indexOf(',');
    const key = commaIdx !== -1 ? inner.slice(0, commaIdx).trim() : '';
    if (key) {
      entries.push({
        type: entryType,
        key,
        keyLower: key.toLowerCase(),
        start: atIdx,
        end: endPos,
        line: startLine,
        raw,
      });
    }
    i = endPos;
  }

  return { entries, metaBlocks };
}

function classifyFileType(file) {
  if (file.type) return file.type;
  const lower = String(file.name || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.bib')) return 'bib';
  if (/\.(?:tex|ltx|sty|cls|bbl)$/.test(lower)) return 'tex';
  return 'tex';
}

function compileBlocklist(blocklist) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(blocklist) ? blocklist : []) {
    const term = String(raw || '').trim();
    if (term.length < 2) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const isAsciiWord = /^[A-Za-z0-9]/.test(term) && /[A-Za-z0-9]$/.test(term);
    const re = isAsciiWord
      ? new RegExp(`(?<![A-Za-z0-9_])${escapeRegex(term)}(?![A-Za-z0-9_])`, 'gi')
      : new RegExp(escapeRegex(term), 'gi');
    out.push({ term, re });
  }
  return out;
}

function trimExcerpt(line, maxLen = 150) {
  const clean = String(line || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1)}…`;
}

/**
 * Main multi-file preflight audit engine.
 *
 * @param {Array<{ name: string, content?: string, bytes?: Uint8Array, type?: string }>} inputFiles
 * @param {{
 *   blocklist?: string[],
 *   venue?: string,
 *   isPro?: boolean,
 *   enforceFreeLimits?: boolean,
 *   freeMaxLines?: number,
 *   freeMaxFiles?: number,
 * }} [options]
 */
export function auditProject(inputFiles, options = {}) {
  const files = Array.isArray(inputFiles) ? inputFiles : [];
  const isPro = Boolean(options.isPro);
  const enforceFreeLimits = Boolean(options.enforceFreeLimits && !isPro);
  const freeMaxFiles = options.freeMaxFiles ?? FREE_MAX_FILES;
  const freeMaxLines = options.freeMaxLines ?? FREE_MAX_LINES;
  const venue = options.venue || 'auto';
  const compiledBlocklist = compileBlocklist(options.blocklist || []);

  const issues = [];
  let issueSeq = 0;
  const pushIssue = (issue) => {
    issues.push({
      id: `pf-${++issueSeq}`,
      ...issue,
    });
  };

  // Free tier scoping (when explicitly enforced for non-Pro custom uploads)
  const skippedFiles = [];
  let truncatedLinesCount = 0;
  const activeFiles = [];

  for (let idx = 0; idx < files.length; idx++) {
    const f = files[idx];
    const fType = classifyFileType(f);
    if (enforceFreeLimits && idx >= freeMaxFiles) {
      skippedFiles.push({ name: f.name, type: fType });
      continue;
    }
    if (fType !== 'pdf') {
      const content = String(f.content ?? '');
      const rawLines = content.split(/\r?\n/);
      if (enforceFreeLimits && rawLines.length > freeMaxLines) {
        truncatedLinesCount += rawLines.length - freeMaxLines;
        activeFiles.push({
          ...f,
          type: fType,
          content: rawLines.slice(0, freeMaxLines).join('\n'),
          originalLineCount: rawLines.length,
          scannedLineCount: freeMaxLines,
          wasTruncated: true,
        });
      } else {
        activeFiles.push({
          ...f,
          type: fType,
          content,
          originalLineCount: rawLines.length,
          scannedLineCount: rawLines.length,
          wasTruncated: false,
        });
      }
    } else {
      activeFiles.push({
        ...f,
        type: 'pdf',
        originalLineCount: 0,
        scannedLineCount: 0,
        wasTruncated: false,
      });
    }
  }

  const texFiles = activeFiles.filter((f) => f.type === 'tex');
  const bibFiles = activeFiles.filter((f) => f.type === 'bib');
  const pdfFiles = activeFiles.filter((f) => f.type === 'pdf');

  // Cross-file index collectors
  const allLabels = new Map(); // label -> { file, line, inFloatEnv }
  const allRefs = []; // { label, file, line, macro, excerpt }
  const allCites = []; // { key, keyLower, file, line, macro, excerpt }
  const allBibEntries = new Map(); // keyLower -> { key, file, line, type, excerpt }
  let hasNociteStar = false;

  // 1. Parse all BibTeX files first
  for (const bf of bibFiles) {
    const { entries } = parseBibtexEntries(bf.content);
    for (const entry of entries) {
      if (!allBibEntries.has(entry.keyLower)) {
        allBibEntries.set(entry.keyLower, {
          key: entry.key,
          file: bf.name,
          line: entry.line,
          type: entry.type,
          excerpt: trimExcerpt(entry.raw.split(/\r?\n/)[0]),
        });
      }
    }

    // Scan .bib lines for blocklist, non-anonymous URLs, emails, local paths
    const bibLines = bf.content.split(/\r?\n/);
    for (let i = 0; i < bibLines.length; i++) {
      const line = bibLines[i];
      const lineNo = i + 1;
      scanTextLineForLeaks(line, lineNo, bf.name, {
        compiledBlocklist,
        pushIssue,
        isBib: true,
      });
    }
  }

  // 2. Scan all TeX files
  for (const tf of texFiles) {
    const { lines, activeText } = parseTexLines(tf.content);

    // Track float environments for unreferenced float detection
    const floatStack = [];
    const lineFloatEnv = new Map();
    for (const ln of lines) {
      if (!ln.inVerbatim) {
        const beginFloat = ln.code.match(/\\begin\{(figure\*?|table\*?|algorithm\*?)\}/);
        if (beginFloat) floatStack.push(beginFloat[1]);
      }
      if (floatStack.length > 0) {
        lineFloatEnv.set(ln.lineNo, floatStack[floatStack.length - 1]);
      }
      if (!ln.inVerbatim) {
        const endFloat = ln.code.match(/\\end\{(figure\*?|table\*?|algorithm\*?)\}/);
        if (endFloat && floatStack.length > 0) {
          floatStack.pop();
        }
      }
    }

    // 2a. Per-line checks (both comments and active code for leaks; active code for hygiene/draft markers)
    for (const ln of lines) {
      // Leak scans run across BOTH active code AND comments (source tarballs often leak via comments!)
      scanTextLineForLeaks(ln.raw, ln.lineNo, tf.name, {
        compiledBlocklist,
        pushIssue,
        isBib: false,
      });

      if (ln.inVerbatim) continue;

      // Active-code only checks
      const active = ln.code;

      // Conference template non-anonymous flags
      scanConferenceFlags(active, ln.lineNo, tf.name, venue, pushIssue);

      // First-person self-citation phrasing
      for (const re of SELF_CITATION_PATTERNS) {
        re.lastIndex = 0;
        const m = re.exec(active);
        if (m) {
          pushIssue({
            ruleId: 'SELF_CITATION_LEAK',
            severity: 'critical',
            category: 'anonymization',
            file: tf.name,
            line: ln.lineNo,
            match: m[0],
            excerpt: trimExcerpt(ln.raw),
            titleEn: 'First-Person Self-Citation Leak',
            titleZh: '第一人称自引泄密',
            messageEn: `Phrase "${m[0]}" reveals author identity through first-person reference to prior work.`,
            messageZh: `措辞 “${m[0]}” 通过第一人称引用前期工作暴露了作者身份。`,
            fixEn: 'Rewrite in neutral third-person form (e.g., "Prior work by Chen et al. [X] showed...").',
            fixZh: '请改写为客观第三人称表述（例如 “Prior work [X] showed...”）。',
          });
          break;
        }
      }

      // Active Acknowledgments sections / environments
      const ackMatch = active.match(/\\(?:begin\{(acks|acknowledgments?|acknowledgements?)\}|(?:sub)?section\*?\{\s*acknowledg(?:e)?ments?\s*\}|paragraph\*?\{\s*acknowledg(?:e)?ments?\s*\})/i);
      if (ackMatch) {
        pushIssue({
          ruleId: 'ACKNOWLEDGMENTS_LEAK',
          severity: 'critical',
          category: 'anonymization',
          file: tf.name,
          line: ln.lineNo,
          match: ackMatch[0],
          excerpt: trimExcerpt(ln.raw),
          titleEn: 'Active Acknowledgments Section in Review Draft',
          titleZh: '评审稿中包含未隐藏的致谢章节',
          messageEn: `Uncommented acknowledgments block (${ackMatch[0]}) typically reveals labs, collaborators, and funding agencies.`,
          messageZh: `未注释的致谢区块（${ackMatch[0]}）通常会直接暴露实验室、合作者与资助基金。`,
          fixEn: 'Remove or wrap inside an anonymous-mode conditional (e.g., \\ifsubmission ... \\fi) until camera-ready.',
          fixZh: '请在双盲评审版中删除致谢章节，或使用匿名模式条件宏包裹，待录用后再恢复。',
        });
      }

      // Grant / funding statements in active prose
      for (const gre of GRANT_PATTERNS) {
        gre.lastIndex = 0;
        const gm = gre.exec(active);
        if (gm) {
          pushIssue({
            ruleId: 'GRANT_FUNDING_LEAK',
            severity: 'critical',
            category: 'anonymization',
            file: tf.name,
            line: ln.lineNo,
            match: gm[0],
            excerpt: trimExcerpt(ln.raw),
            titleEn: 'Grant / Funding Statement Leak',
            titleZh: '基金/资助编号泄密',
            messageEn: `Detected active funding or grant reference "${gm[0]}".`,
            messageZh: `检测到未匿名化的基金或资助信息 “${gm[0]}”。`,
            fixEn: 'Remove all grant numbers and funding agency mentions from the double-blind review draft.',
            fixZh: '请在双盲投稿版本中彻底删除所有基金编号与资助机构说明。',
          });
          break;
        }
      }

      // Stray draft markers (active macros or prose markers)
      const draftMacroMatch = active.match(/\\(?:todo|fixme|note|hl|comment|marginpar)\s*(?:\[[^\]]*\])?\{|\\textcolor\{red\}|\{\\color\{red\}/i);
      if (draftMacroMatch) {
        pushIssue({
          ruleId: 'STRAY_DRAFT_MARKER',
          severity: 'high',
          category: 'structure',
          file: tf.name,
          line: ln.lineNo,
          match: draftMacroMatch[0],
          excerpt: trimExcerpt(ln.raw),
          titleEn: 'Active Draft / Review Macro Left in Manuscript',
          titleZh: '正文残留草稿批注宏或标红文本',
          messageEn: `Found active draft macro "${draftMacroMatch[0]}" that may render visibly in the compiled PDF.`,
          messageZh: `正文中残留了未移除的批注/标红宏 “${draftMacroMatch[0]}”，可能直接渲染进投稿 PDF。`,
          fixEn: 'Resolve the note and remove the macro, or run PaperPreflight Sanitizer to strip \\todo macros.',
          fixZh: '请处理该批注并移除对应宏，或使用一键净化导出自动剥离 \\todo 宏。',
        });
      } else {
        const activeTodoMatch = active.match(/\b(?:TODO|FIXME|XXX|TBD)\b|\?\?\?/);
        if (activeTodoMatch) {
          pushIssue({
            ruleId: 'STRAY_DRAFT_MARKER',
            severity: 'high',
            category: 'structure',
            file: tf.name,
            line: ln.lineNo,
            match: activeTodoMatch[0],
            excerpt: trimExcerpt(ln.raw),
            titleEn: 'Unfinished Placeholder Marker in Active Prose',
            titleZh: '正文残留未完成占位符',
            messageEn: `Found unfinished marker "${activeTodoMatch[0]}" in active text.`,
            messageZh: `正文包含未完成占位标记 “${activeTodoMatch[0]}”。`,
            fixEn: 'Replace placeholder with finalized text/numbers before submission.',
            fixZh: '请在投稿前补全对应内容并删除占位符。',
          });
        } else if (ln.comment) {
          const commentTodoMatch = ln.comment.match(/\b(?:TODO|FIXME|XXX|TBD)\b|\?\?\?/);
          if (commentTodoMatch) {
            pushIssue({
              ruleId: 'STRAY_COMMENT_TODO',
              severity: 'medium',
              category: 'structure',
              file: tf.name,
              line: ln.lineNo,
              match: commentTodoMatch[0],
              excerpt: trimExcerpt(ln.raw),
              titleEn: 'Stray Draft Marker in LaTeX Comment',
              titleZh: 'LaTeX 注释中残留 TODO/草稿标记',
              messageEn: `Comment contains "${commentTodoMatch[0]}". Unstripped comments can embarrass authors or leak internal notes in source submissions.`,
              messageZh: `注释中包含 “${commentTodoMatch[0]}”，源码投稿（如 arXiv / 补充材料）可能泄露内部讨论。`,
              fixEn: 'Verify the task is complete and strip comments using PaperPreflight Sanitizer.',
              fixZh: '请确认该事项已闭环，并在打包投稿源码前使用一键去注释净化。',
            });
          }
        }
      }

      // Prose hygiene: unescaped % immediately after a digit followed by prose/punctuation
      if (ln.commentIndex > 0) {
        const beforeChar = ln.raw[ln.commentIndex - 1];
        const afterPercent = ln.raw.slice(ln.commentIndex + 1);
        if (
          /[0-9]/.test(beforeChar) &&
          /^(?:[.,;:!?)]|\s+\S)/.test(afterPercent) &&
          !/^\s*(?:TODO|FIXME|XXX|NOTE|HACK|%)/i.test(afterPercent)
        ) {
          pushIssue({
            ruleId: 'UNESCAPED_PERCENT_RISK',
            severity: 'high',
            category: 'hygiene',
            file: tf.name,
            line: ln.lineNo,
            match: ln.raw.slice(Math.max(0, ln.commentIndex - 5), ln.commentIndex + 16).trim(),
            excerpt: trimExcerpt(ln.raw),
            titleEn: 'Unescaped "%" Silently Truncates Sentence',
            titleZh: '未转义的百分号 "%" 会静默吞掉后半句文本',
            messageEn: 'Detected a number followed by an unescaped "%". LaTeX treats everything after "%" on this line as a comment!',
            messageZh: '检测到数字后紧跟未转义的 "%"：LaTeX 会将本行 "%" 之后的全部内容当作注释直接截断丢失！',
            fixEn: 'Escape the percentage sign as "\\%" (e.g., "14.2\\% over").',
            fixZh: '请立即将百分号转义为 "\\%"（例如 "14.2\\% over"）。',
          });
        }
      }

      // Prose hygiene: repeated consecutive words (strip math $...$ and TeX commands first)
      const proseOnly = active
        .replace(/\$[^$]*\$/g, ' ')
        .replace(/\\[A-Za-z@]+\*?(?:\[[^\]]*\])?(?:\{[^}]*\})?/g, ' ');
      REPEATED_WORD_RE.lastIndex = 0;
      const repMatch = REPEATED_WORD_RE.exec(proseOnly);
      if (repMatch) {
        pushIssue({
          ruleId: 'REPEATED_WORD',
          severity: 'low',
          category: 'hygiene',
          file: tf.name,
          line: ln.lineNo,
          match: repMatch[0],
          excerpt: trimExcerpt(ln.raw),
          titleEn: 'Accidental Repeated Word',
          titleZh: '疑似重复输入单词',
          messageEn: `Detected consecutive repeated word "${repMatch[0]}".`,
          messageZh: `检测到连续重复单词 “${repMatch[0]}”。`,
          fixEn: `Remove the duplicated word "${repMatch[1]}".`,
          fixZh: `请删除多余的重复词 “${repMatch[1]}”。`,
        });
      }

      // Prose hygiene: missing non-breaking space (~) before \ref / \eqref / \cite / \citep
      const nbspMatch = active.match(/\b(?:Figure|Fig\.|Table|Tab\.|Section|Sec\.|Equation|Eq\.|Algorithm|Alg\.|Appendix|Theorem|Lemma|Proposition|[A-Za-z]{3,}) +(\\(?:ref|eqref|autoref|cref|cite|citep)\{)/);
      if (nbspMatch && !active.trim().startsWith('\\')) {
        pushIssue({
          ruleId: 'MISSING_NBSP',
          severity: 'low',
          category: 'hygiene',
          file: tf.name,
          line: ln.lineNo,
          match: nbspMatch[0],
          excerpt: trimExcerpt(ln.raw),
          titleEn: 'Missing Non-Breaking Space (~) Before Reference/Citation',
          titleZh: '引用或交叉引用前缺少不换行空格 (~)',
          messageEn: `Ordinary space before ${nbspMatch[1]} can cause awkward line breaks (e.g., orphan numbers or brackets at line start).`,
          messageZh: `${nbspMatch[1]} 前使用了普通空格，排版时可能导致编号或方括号孤立换行。`,
          fixEn: 'Use a tie "~" instead of a space (e.g., Figure~\\ref{...}, method~\\cite{...}).',
          fixZh: '建议改用波浪号不换行空格 "~"（如 Figure~\\ref{...}、method~\\cite{...}）。',
        });
      }
    }

    // 2b. Multi-line balanced macro checks on activeText (comments masked out!)
    const authorMacros = findBalancedMacros(activeText, [
      'author',
      'icmlauthor',
      'icmlaffiliation',
      'icmlcorrespondingauthor',
      'affil',
      'institute',
      'email',
    ]);
    for (const am of authorMacros) {
      const cleaned = am.arg
        .replace(/\\thanks\{[\s\S]*?\}/g, '')
        .replace(/\\[A-Za-z@]+\*?/g, ' ')
        .replace(/[{}~\\&]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!cleaned) continue;
      if (/(?:anonymous|anonymized|double[\s-]*blind|paper\s*id|blind\s*review)/i.test(cleaned)) {
        continue;
      }
      pushIssue({
        ruleId: 'ACTIVE_AUTHOR_LEAK',
        severity: 'critical',
        category: 'anonymization',
        file: tf.name,
        line: am.line,
        match: `\\${am.macro}{${trimExcerpt(cleaned, 60)}}`,
        excerpt: trimExcerpt(am.raw, 130),
        titleEn: `Active Non-Anonymous \\${am.macro}{...} Block`,
        titleZh: `检测到未匿名的 \\${am.macro}{...} 作者/单位声明`,
        messageEn: `Active \\${am.macro}{...} does not appear anonymized ("${trimExcerpt(cleaned, 70)}").`,
        messageZh: `未注释的 \\${am.macro}{...} 包含非匿名信息（“${trimExcerpt(cleaned, 70)}”）。`,
        fixEn: 'Replace with \\author{Anonymous Author(s)} or verify your venue style automatically hides author blocks in review mode.',
        fixZh: '请替换为 \\author{Anonymous Author(s)}，并确认会议模板处于双盲评审模式。',
      });
    }

    const thanksMacros = findBalancedMacros(activeText, ['thanks', 'acks']);
    for (const tm of thanksMacros) {
      const cleaned = tm.arg.replace(/\s+/g, ' ').trim();
      if (!cleaned || /^(?:anonymous|anonymized|equal contribution\.?)$/i.test(cleaned)) continue;
      pushIssue({
        ruleId: 'THANKS_LEAK',
        severity: 'critical',
        category: 'anonymization',
        file: tf.name,
        line: tm.line,
        match: `\\${tm.macro}{...}`,
        excerpt: trimExcerpt(tm.raw, 130),
        titleEn: `Active \\${tm.macro}{...} Footnote / Funding Leak`,
        titleZh: `未隐藏的 \\${tm.macro}{...} 脚注可能泄露身份或基金`,
        messageEn: `Active \\${tm.macro} contains "${trimExcerpt(cleaned, 80)}".`,
        messageZh: `正文中存在未注释的 \\${tm.macro} 内容：“${trimExcerpt(cleaned, 80)}”。`,
        fixEn: 'Remove \\thanks funding/affiliation footnotes during double-blind review.',
        fixZh: '请在双盲审稿版中移除包含单位、致谢或基金编号的 \\thanks 脚注。',
      });
    }

    // 2c. Collect \label, \ref, and \cite across this file
    const labelMacros = findBalancedMacros(activeText, ['label']);
    for (const lm of labelMacros) {
      const key = lm.arg.trim();
      if (key && !allLabels.has(key)) {
        allLabels.set(key, {
          file: tf.name,
          line: lm.line,
          inFloatEnv: lineFloatEnv.get(lm.line) || null,
          excerpt: trimExcerpt(lines[lm.line - 1]?.raw || lm.raw),
        });
      }
    }

    const refMacros = findBalancedMacros(activeText, ['ref', 'eqref', 'autoref', 'cref', 'Cref', 'pageref', 'vref', 'nameref']);
    for (const rm of refMacros) {
      const keys = rm.arg.split(',').map((k) => k.trim()).filter(Boolean);
      for (const key of keys) {
        allRefs.push({
          label: key,
          file: tf.name,
          line: rm.line,
          macro: rm.macro,
          excerpt: trimExcerpt(lines[rm.line - 1]?.raw || rm.raw),
        });
      }
    }

    const citeMacros = findBalancedMacros(activeText, [
      'cite',
      'citep',
      'citet',
      'citealt',
      'citealp',
      'citeauthor',
      'citeyear',
      'citeyearpar',
      'autocite',
      'textcite',
      'parencite',
      'nocite',
      'cites',
    ]);
    for (const cm of citeMacros) {
      const keys = cm.arg.split(',').map((k) => k.trim()).filter(Boolean);
      for (const key of keys) {
        if (cm.macro === 'nocite' && key === '*') {
          hasNociteStar = true;
          continue;
        }
        allCites.push({
          key,
          keyLower: key.toLowerCase(),
          file: tf.name,
          line: cm.line,
          macro: cm.macro,
          excerpt: trimExcerpt(lines[cm.line - 1]?.raw || cm.raw),
        });
      }
    }
  }

  // 3. Cross-file Structural Checks
  const referencedLabels = new Set();
  for (const ref of allRefs) {
    referencedLabels.add(ref.label);
    if (!allLabels.has(ref.label)) {
      pushIssue({
        ruleId: 'UNDEFINED_REF',
        severity: 'high',
        category: 'structure',
        file: ref.file,
        line: ref.line,
        match: `\\${ref.macro}{${ref.label}}`,
        excerpt: ref.excerpt,
        titleEn: `Undefined Cross-Reference: "${ref.label}"`,
        titleZh: `未定义的交叉引用：“${ref.label}”`,
        messageEn: `\\${ref.macro}{${ref.label}} does not match any \\label{${ref.label}} across all loaded .tex files (renders as "??").`,
        messageZh: `\\${ref.macro}{${ref.label}} 在所有已加载的 .tex 文件中找不到对应的 \\label{${ref.label}}（编译将显示 "??"）。`,
        fixEn: `Add \\label{${ref.label}} to the target section/figure/table or fix the typo in the reference key.`,
        fixZh: `请在对应章节/图表添加 \\label{${ref.label}}，或修正引用键名拼写。`,
      });
    }
  }

  // Unreferenced figures/tables/algorithms
  for (const [label, meta] of allLabels.entries()) {
    const looksLikeFloat = Boolean(meta.inFloatEnv) || /^(?:fig|tab|tbl|alg|figure|table|algo)[:_-]/i.test(label);
    if (looksLikeFloat && !referencedLabels.has(label)) {
      pushIssue({
        ruleId: 'UNREFERENCED_FLOAT',
        severity: 'medium',
        category: 'structure',
        file: meta.file,
        line: meta.line,
        match: `\\label{${label}}`,
        excerpt: meta.excerpt,
        titleEn: `Unreferenced Figure/Table: "${label}"`,
        titleZh: `图表未在正文中被引用：“${label}”`,
        messageEn: `Label "${label}" (${meta.inFloatEnv || 'float'}) is defined but never referenced via \\ref/\\cref in prose.`,
        messageZh: `标签 “${label}”（${meta.inFloatEnv || '浮动体'}）已定义，但在正文中从未被 \\ref/\\cref 引用。`,
        fixEn: `Cite it in the text (e.g., Table~\\ref{${label}} or Figure~\\ref{${label}}), or move unused floats to the appendix.`,
        fixZh: `请在正文中显式讨论并引用（如 Table~\\ref{${label}} / Figure~\\ref{${label}}），或移除多余图表。`,
      });
    }
  }

  // Cross-file BibTeX citation verification
  const citedKeysLower = new Set(allCites.map((c) => c.keyLower));
  if (bibFiles.length > 0) {
    for (const cite of allCites) {
      if (!allBibEntries.has(cite.keyLower)) {
        pushIssue({
          ruleId: 'UNDEFINED_CITE',
          severity: 'high',
          category: 'structure',
          file: cite.file,
          line: cite.line,
          match: `\\${cite.macro}{${cite.key}}`,
          excerpt: cite.excerpt,
          titleEn: `Undefined BibTeX Citation: "${cite.key}"`,
          titleZh: `缺失的参考文献条目：“${cite.key}”`,
          messageEn: `Citation key "${cite.key}" was not found in any loaded .bib file (renders as "[?]").`,
          messageZh: `引用键 “${cite.key}” 在已加载的 .bib 文件中不存在（编译将显示 "[?]"）。`,
          fixEn: `Add "@article{${cite.key}, ...}" to your .bib file or correct the citation key.`,
          fixZh: `请在 .bib 文件中补全条目 “${cite.key}”，或检查拼写错误。`,
        });
      }
    }

    if (!hasNociteStar && texFiles.length > 0) {
      for (const [keyLower, entry] of allBibEntries.entries()) {
        if (!citedKeysLower.has(keyLower)) {
          pushIssue({
            ruleId: 'UNUSED_BIB_ENTRY',
            severity: 'medium',
            category: 'structure',
            file: entry.file,
            line: entry.line,
            match: entry.key,
            excerpt: entry.excerpt,
            titleEn: `Unused BibTeX Entry: "${entry.key}"`,
            titleZh: `未被引用的冗余 BibTeX 条目：“${entry.key}”`,
            messageEn: `Entry "${entry.key}" in ${entry.file} is never cited in any loaded .tex file.`,
            messageZh: `${entry.file} 中的文献 “${entry.key}” 未被任何已加载的 .tex 正文引用。`,
            fixEn: 'Use PaperPreflight Sanitizer to prune unused entries into a minimal clean .bib file.',
            fixZh: '可使用一键净化导出自动裁剪未引用条目，生成精简干净的参考文献库。',
          });
        }
      }
    }
  } else if (allCites.length > 0 && texFiles.length > 0) {
    pushIssue({
      ruleId: 'MISSING_BIB_FILE_NOTICE',
      severity: 'low',
      category: 'structure',
      file: texFiles[0].name,
      line: allCites[0].line,
      match: `${allCites.length} citations`,
      excerpt: allCites[0].excerpt,
      titleEn: 'No .bib File Loaded — Citation Cross-Check Skipped',
      titleZh: '尚未加载 .bib 文件 — 已跳过文献引用交叉核对',
      messageEn: `Found ${allCites.length} \\cite call(s) across .tex files, but no .bib file was provided to verify them against.`,
      messageZh: `检测到 ${allCites.length} 处文献引用，但未上传 .bib 文件，暂无法核对缺失或冗余引用。`,
      fixEn: 'Drop your references.bib alongside your .tex files to enable full citation verification and pruning.',
      fixZh: '请同时拖入 references.bib 文件，即可启用完整的缺失引用检查与冗余文献清理。',
    });
  }

  // 4. Scan Binary PDFs
  const pdfReports = [];
  for (const pf of pdfFiles) {
    const report = scanPdfBytes(pf.bytes || new Uint8Array(), {
      filename: pf.name,
      blocklist: options.blocklist || [],
    });
    pdfReports.push(report);
    for (const pdfIssue of report.issues) {
      pushIssue(pdfIssue);
    }
  }

  // Sort issues by severity (critical -> high -> medium -> low), then file, then line
  const sevRank = { critical: 0, high: 1, medium: 2, low: 3 };
  issues.sort((a, b) => {
    const sr = (sevRank[a.severity] ?? 9) - (sevRank[b.severity] ?? 9);
    if (sr !== 0) return sr;
    const fc = String(a.file || '').localeCompare(String(b.file || ''));
    if (fc !== 0) return fc;
    return (a.line ?? 0) - (b.line ?? 0);
  });

  const counts = {
    critical: issues.filter((i) => i.severity === 'critical').length,
    high: issues.filter((i) => i.severity === 'high').length,
    medium: issues.filter((i) => i.severity === 'medium').length,
    low: issues.filter((i) => i.severity === 'low').length,
    total: issues.length,
  };

  let status = 'pass';
  if (counts.critical > 0) status = 'critical';
  else if (counts.high > 0 || counts.medium > 0) status = 'warning';

  const totalLinesScanned = activeFiles.reduce((sum, f) => sum + (f.scannedLineCount || 0), 0);
  const totalLinesOriginal = files.reduce((sum, f) => {
    if (classifyFileType(f) === 'pdf') return sum;
    return sum + String(f.content ?? '').split(/\r?\n/).length;
  }, 0);

  return {
    status,
    venue,
    counts,
    issues,
    pdfReports,
    stats: {
      filesUploaded: files.length,
      filesScanned: activeFiles.length,
      texFiles: texFiles.length,
      bibFiles: bibFiles.length,
      pdfFiles: pdfFiles.length,
      linesScanned: totalLinesScanned,
      linesTotal: totalLinesOriginal,
      labelsDefined: allLabels.size,
      refsFound: allRefs.length,
      bibEntriesFound: allBibEntries.size,
      citesFound: allCites.length,
      hasNociteStar,
    },
    citedKeysLower: [...citedKeysLower],
    freeTierLimitHit: {
      limited: skippedFiles.length > 0 || truncatedLinesCount > 0,
      skippedFiles,
      truncatedLinesCount,
      maxFiles: freeMaxFiles,
      maxLines: freeMaxLines,
    },
  };
}

function scanTextLineForLeaks(line, lineNo, filename, { compiledBlocklist, pushIssue, isBib }) {
  // 1. User-defined blocklist
  for (const bl of compiledBlocklist) {
    bl.re.lastIndex = 0;
    const m = bl.re.exec(line);
    if (m) {
      pushIssue({
        ruleId: 'BLOCKLIST_MATCH',
        severity: 'critical',
        category: 'anonymization',
        file: filename,
        line: lineNo,
        match: m[0],
        excerpt: trimExcerpt(line),
        titleEn: `Blocklist Match: "${bl.term}"`,
        titleZh: `命中敏感词黑名单：“${bl.term}”`,
        messageEn: `Sensitive identity term "${bl.term}" found in ${filename}:${lineNo}.`,
        messageZh: `在 ${filename}:${lineNo} 检测到自定义敏感词 “${bl.term}”。`,
        fixEn: 'Redact or replace this identifier before double-blind submission (including inside comments and .bib notes).',
        fixZh: '请在双盲投稿前删除或匿名替换该敏感词（包括注释和 .bib 备注字段）。',
      });
    }
  }

  // 2. Non-anonymous URLs (explicitly allowing anonymous.4open.science & github.com/anonymous)
  const seenUrls = new Set();
  for (const rule of NON_ANON_URL_RULES) {
    rule.re.lastIndex = 0;
    let m;
    while ((m = rule.re.exec(line)) !== null) {
      const url = m[0].replace(/[.,;:'")}\]]+$/, '');
      if (seenUrls.has(url)) continue;
      if (ALLOWED_ANON_URL_RE.test(url)) continue;
      seenUrls.add(url);
      pushIssue({
        ruleId: 'NON_ANONYMOUS_URL',
        severity: 'critical',
        category: 'anonymization',
        file: filename,
        line: lineNo,
        match: url,
        excerpt: trimExcerpt(line),
        titleEn: `Non-Anonymous URL (${rule.label})`,
        titleZh: `非匿名链接泄露（${rule.label}）`,
        messageEn: `Detected potentially de-anonymizing ${rule.label} link: ${url}`,
        messageZh: `检测到可能暴露作者身份的 ${rule.label} 链接：${url}`,
        fixEn: 'Host anonymized review code on https://anonymous.4open.science/ or github.com/anonymous, or remove until camera-ready.',
        fixZh: '请改用 https://anonymous.4open.science/ 等匿名代码托管，或在审稿版中暂时移除该链接。',
      });
    }
  }

  // 3. Institutional / personal emails
  EMAIL_RE.lastIndex = 0;
  let em;
  while ((em = EMAIL_RE.exec(line)) !== null) {
    const full = em[0];
    const localPart = em[1];
    const domain = em[2];
    if (/^(?:anonymous|anon|example|noreply|reviewer)$/i.test(localPart)) continue;
    if (/^example\.(?:com|org|edu)$/i.test(domain)) continue;
    if (!SENSITIVE_EMAIL_DOMAIN_RE.test(domain) && isBib) continue;
    pushIssue({
      ruleId: 'INSTITUTIONAL_EMAIL',
      severity: 'critical',
      category: 'anonymization',
      file: filename,
      line: lineNo,
      match: full,
      excerpt: trimExcerpt(line),
      titleEn: 'Identifying Email Address Exposed',
      titleZh: '暴露机构或个人邮箱地址',
      messageEn: `Email address "${full}" exposes author identity or institutional affiliation.`,
      messageZh: `邮箱地址 “${full}” 会直接暴露作者个人身份或所属机构。`,
      fixEn: 'Remove email addresses or replace with anonymous@anonymous.org for review.',
      fixZh: '请删除作者邮箱，或在审稿版中替换为 anonymous@anonymous.org。',
    });
  }

  // 4. Local filesystem paths
  for (const pre of LOCAL_PATH_PATTERNS) {
    pre.lastIndex = 0;
    const pm = pre.exec(line);
    if (pm) {
      pushIssue({
        ruleId: 'LOCAL_PATH_LEAK',
        severity: 'critical',
        category: 'anonymization',
        file: filename,
        line: lineNo,
        match: pm[0],
        excerpt: trimExcerpt(line),
        titleEn: 'Local Filesystem Path Reveals Username',
        titleZh: '绝对路径暴露本机用户名',
        messageEn: `Absolute local path "${pm[0]}" leaks workstation username and breaks compilation on other machines.`,
        messageZh: `绝对路径 “${pm[0]}” 不仅会泄露作者电脑用户名，还会导致他人编译失败。`,
        fixEn: 'Switch to a relative project path such as figures/overview.pdf.',
        fixZh: '请改为项目相对路径（例如 figures/overview.pdf）。',
      });
      break;
    }
  }
}

function scanConferenceFlags(activeCode, lineNo, filename, venue, pushIssue) {
  // NeurIPS: \usepackage[final]{neurips_2026} or [preprint]
  const neurips = activeCode.match(/\\usepackage\s*\[([^\]]*)\]\s*\{([^}]*neurips[^}]*)\}/i);
  if (neurips) {
    const opts = neurips[1].toLowerCase();
    if (/\b(?:final|preprint)\b/.test(opts)) {
      pushIssue({
        ruleId: 'CONFERENCE_FLAG_LEAK',
        severity: 'critical',
        category: 'anonymization',
        file: filename,
        line: lineNo,
        match: neurips[0],
        excerpt: trimExcerpt(activeCode),
        titleEn: 'NeurIPS Non-Anonymous Template Option Detected',
        titleZh: 'NeurIPS 模板启用了非匿名编译选项',
        messageEn: `Detected "${neurips[0]}" — [final] or [preprint] unmasks author names and removes submission line numbers!`,
        messageZh: `检测到 “${neurips[0]}” —— [final] 或 [preprint] 会显示作者姓名并取消行号，极易导致 Desk Reject！`,
        fixEn: `Use \\usepackage{${neurips[2]}} (without [final] or [preprint]) for double-blind submission.`,
        fixZh: `双盲投稿请务必改为 \\usepackage{${neurips[2]}}（移除 [final] / [preprint]）。`,
      });
    }
  }

  // ICML: \usepackage[accepted]{icml2026}
  const icml = activeCode.match(/\\usepackage\s*\[([^\]]*)\]\s*\{([^}]*icml[^}]*)\}/i);
  if (icml && /\baccepted\b/i.test(icml[1])) {
    pushIssue({
      ruleId: 'CONFERENCE_FLAG_LEAK',
      severity: 'critical',
      category: 'anonymization',
      file: filename,
      line: lineNo,
      match: icml[0],
      excerpt: trimExcerpt(activeCode),
      titleEn: 'ICML [accepted] Option Unmasks Authors',
      titleZh: 'ICML 模板启用了 [accepted] 终稿选项',
      messageEn: `Detected "${icml[0]}" — remove [accepted] for double-blind review.`,
      messageZh: `检测到 “${icml[0]}” —— 双盲投稿阶段必须去掉 [accepted] 选项。`,
      fixEn: `Change to \\usepackage{${icml[2]}} so author names remain hidden.`,
      fixZh: `请改为 \\usepackage{${icml[2]}} 以开启双盲匿名模式。`,
    });
  }

  // ICLR / CVPR / ICCV finalcopy macros
  const finalCopy = activeCode.match(/\\(?:iclr|cvpr|iccv|eccv)finalcopy\b/i);
  if (finalCopy) {
    pushIssue({
      ruleId: 'CONFERENCE_FLAG_LEAK',
      severity: 'critical',
      category: 'anonymization',
      file: filename,
      line: lineNo,
      match: finalCopy[0],
      excerpt: trimExcerpt(activeCode),
      titleEn: `Active ${finalCopy[0]} Disables Anonymity`,
      titleZh: `未注释的 ${finalCopy[0]} 会取消双盲匿名`,
      messageEn: `Command ${finalCopy[0]} switches the template to camera-ready mode and prints author identities.`,
      messageZh: `命令 ${finalCopy[0]} 会将论文切换为录用终稿模式并打印真实作者信息。`,
      fixEn: `Comment out or delete ${finalCopy[0]} before submitting for review.`,
      fixZh: `请在双盲投稿前注释或删除 ${finalCopy[0]}。`,
    });
  }

  // CVPR / ACL / EMNLP / NAACL \usepackage[final]{...}
  const pkgFinal = activeCode.match(/\\usepackage\s*\[([^\]]*)\]\s*\{([^}]*(?:cvpr|iccv|eccv|acl|emnlp|naacl)[^}]*)\}/i);
  if (pkgFinal && /\b(?:final|camera|preprint)\b/i.test(pkgFinal[1])) {
    pushIssue({
      ruleId: 'CONFERENCE_FLAG_LEAK',
      severity: 'critical',
      category: 'anonymization',
      file: filename,
      line: lineNo,
      match: pkgFinal[0],
      excerpt: trimExcerpt(activeCode),
      titleEn: 'Conference Package Uses Camera-Ready / Non-Review Flag',
      titleZh: '会议宏包使用了非双盲审稿选项',
      messageEn: `Detected "${pkgFinal[0]}" instead of [review] mode.`,
      messageZh: `检测到 “${pkgFinal[0]}”，当前并非双盲 [review] 模式。`,
      fixEn: `Switch option to [review], e.g., \\usepackage[review]{${pkgFinal[2]}}.`,
      fixZh: `请将选项切换为 [review]，例如 \\usepackage[review]{${pkgFinal[2]}}。`,
    });
  }

  // AAAI missing [submission] option
  const aaai = activeCode.match(/\\usepackage(?:\s*\[([^\]]*)\])?\s*\{(aaai\d+)\}/i);
  if (aaai && !/\bsubmission\b/i.test(aaai[1] || '')) {
    pushIssue({
      ruleId: 'CONFERENCE_FLAG_LEAK',
      severity: 'critical',
      category: 'anonymization',
      file: filename,
      line: lineNo,
      match: aaai[0],
      excerpt: trimExcerpt(activeCode),
      titleEn: 'AAAI Package Missing [submission] Flag',
      titleZh: 'AAAI 宏包缺少 [submission] 匿名选项',
      messageEn: `Detected "${aaai[0]}" without [submission]; AAAI requires \\usepackage[submission]{${aaai[2]}} for anonymous review.`,
      messageZh: `检测到 “${aaai[0]}” 未携带 [submission] 选项；AAAI 双盲投稿要求使用 \\usepackage[submission]{${aaai[2]}}。`,
      fixEn: `Update to \\usepackage[submission]{${aaai[2]}}.`,
      fixZh: `请修改为 \\usepackage[submission]{${aaai[2]}}。`,
    });
  }

  // Venue-aware hint for ACM acmart if user selected double-blind
  if (venue !== 'nature') {
    const acm = activeCode.match(/\\documentclass\s*\[([^\]]*)\]\s*\{acmart\}/i);
    if (acm && /\breview\b/i.test(acm[1]) && !/\banonymous\b/i.test(acm[1])) {
      pushIssue({
        ruleId: 'CONFERENCE_FLAG_LEAK',
        severity: 'critical',
        category: 'anonymization',
        file: filename,
        line: lineNo,
        match: acm[0],
        excerpt: trimExcerpt(activeCode),
        titleEn: 'ACM acmart [review] Missing [anonymous] Option',
        titleZh: 'ACM acmart 模板缺少 anonymous 选项',
        messageEn: `Detected "${acm[0]}" with [review] but without [anonymous].`,
        messageZh: `检测到 acmart 使用了 [review] 但未添加 [anonymous]。`,
        fixEn: 'Add anonymous to \\documentclass[sigconf,review,anonymous]{acmart}.',
        fixZh: '请在 \\documentclass 选项中添加 anonymous。',
      });
    }
  }
}

/* ============================================================================
 * 1-Click Submission Sanitizer (Pro)
 * ============================================================================ */

/**
 * Strip LaTeX `%` comments and optional `\todo{...}` macros safely while strictly
 * preserving escaped `\%`, `\\` line breaks, `\verb|...|`, and verbatim environments.
 */
export function stripLatexComments(texContent, options = {}) {
  const stripTodoMacros = options.stripTodoMacros !== false;
  const rawLines = String(texContent || '').split(/\r?\n/);
  const outputLines = [];
  let inVerbatim = null;
  let commentsStripped = 0;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (inVerbatim) {
      outputLines.push(line);
      const endRe = new RegExp(`\\\\end\\{${escapeRegex(inVerbatim)}\\}`);
      if (endRe.test(line)) {
        inVerbatim = null;
      }
      continue;
    }

    const { code, comment, commentIndex } = splitLatexLine(line);
    if (commentIndex !== -1) {
      // Full-line comment -> remove the whole line to avoid spurious empty paragraph lines
      if (code.trim() === '') {
        commentsStripped++;
        continue;
      }
      // Preserve bare trailing "%" used purely as a line-joiner with zero comment text (e.g. `\macro{%`)
      if (comment === '%' && !/\s$/.test(code)) {
        outputLines.push(line);
      } else {
        commentsStripped++;
        outputLines.push(code.replace(/[ \t]+$/, ''));
      }
    } else {
      outputLines.push(line);
    }

    const beginMatch = code.match(/\\begin\{([A-Za-z*]+)\}/);
    if (beginMatch && VERBATIM_ENVS.has(beginMatch[1])) {
      const endRe = new RegExp(`\\\\end\\{${escapeRegex(beginMatch[1])}\\}`);
      if (!endRe.test(code.slice(beginMatch.index + beginMatch[0].length))) {
        inVerbatim = beginMatch[1];
      }
    }
  }

  let result = outputLines.join('\n');
  let todosRemoved = 0;

  if (stripTodoMacros) {
    const removed = stripBalancedMacrosOutsideVerbatim(result, ['todo', 'fixme']);
    result = removed.content;
    todosRemoved = removed.removedCount;
  }

  // Collapse runs of 3+ empty lines left by stripping consecutive comment/todo blocks
  result = result.replace(/\n{3,}/g, '\n\n');

  return {
    content: result,
    commentsStripped,
    todosRemoved,
  };
}

function stripBalancedMacrosOutsideVerbatim(text, macroNames) {
  // Split text into verbatim vs non-verbatim chunks so verbatim blocks are never touched
  const verbEnvNames = [...VERBATIM_ENVS].map(escapeRegex).join('|');
  const verbRe = new RegExp(`(\\\\begin\\{(?:${verbEnvNames})\\}[\\s\\S]*?\\\\end\\{(?:${verbEnvNames})\\})`, 'g');
  const segments = text.split(verbRe);
  let removedCount = 0;

  const processed = segments.map((seg, idx) => {
    if (idx % 2 === 1) return seg; // verbatim segment untouched
    const matches = findBalancedMacros(seg, macroNames);
    if (matches.length === 0) return seg;

    // Remove from end to start so indices remain valid
    let out = seg;
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      let start = m.start;
      let end = m.end;
      // If the macro occupied an entire line by itself, remove its trailing newline too
      const lineStart = out.lastIndexOf('\n', start - 1) + 1;
      const lineEndIdx = out.indexOf('\n', end);
      const lineEnd = lineEndIdx === -1 ? out.length : lineEndIdx;
      const beforeOnLine = out.slice(lineStart, start);
      const afterOnLine = out.slice(end, lineEnd);
      if (beforeOnLine.trim() === '' && afterOnLine.trim() === '') {
        start = lineStart;
        end = lineEndIdx === -1 ? lineEnd : lineEndIdx + 1;
      }
      out = out.slice(0, start) + out.slice(end);
      removedCount++;
    }
    return out;
  });

  return { content: processed.join(''), removedCount };
}

/**
 * Prune unused BibTeX entries while preserving `@preamble` and `@string` declarations.
 */
export function pruneBibtex(bibContent, citedKeysLowerIterable, keepAll = false) {
  const { entries, metaBlocks } = parseBibtexEntries(bibContent);
  if (keepAll) {
    return {
      content: String(bibContent || ''),
      totalEntries: entries.length,
      keptEntries: entries.length,
      removedKeys: [],
    };
  }

  const citedSet = new Set(Array.from(citedKeysLowerIterable || []).map((k) => String(k).toLowerCase()));
  const keptBlocks = [];
  const removedKeys = [];

  // Preserve original order of meta blocks and kept entries
  const allBlocks = [
    ...metaBlocks.map((b) => ({ kind: 'meta', start: b.start, raw: b.raw })),
    ...entries.map((e) => ({ kind: 'entry', start: e.start, raw: e.raw, key: e.key, keyLower: e.keyLower })),
  ].sort((a, b) => a.start - b.start);

  for (const blk of allBlocks) {
    if (blk.kind === 'meta' || citedSet.has(blk.keyLower)) {
      keptBlocks.push(blk.raw.trim());
    } else {
      removedKeys.push(blk.key);
    }
  }

  return {
    content: keptBlocks.length > 0 ? `${keptBlocks.join('\n\n')}\n` : '',
    totalEntries: entries.length,
    keptEntries: entries.length - removedKeys.length,
    removedKeys,
  };
}

/**
 * Produce sanitized copies of all `.tex` and `.bib` files (never mutating originals).
 */
export function sanitizeProject(inputFiles, auditResult, options = {}) {
  const files = Array.isArray(inputFiles) ? inputFiles : [];
  const citedKeysLower = new Set(auditResult?.citedKeysLower || []);
  const keepAllBib = Boolean(auditResult?.stats?.hasNociteStar) || (auditResult?.stats?.texFiles ?? 0) === 0;
  const sanitizedFiles = [];

  let totalCommentsStripped = 0;
  let totalTodosRemoved = 0;
  let totalBibPruned = 0;

  for (const f of files) {
    const fType = classifyFileType(f);
    if (fType === 'tex') {
      const res = stripLatexComments(f.content || '', options);
      totalCommentsStripped += res.commentsStripped;
      totalTodosRemoved += res.todosRemoved;
      sanitizedFiles.push({
        name: f.name,
        outputName: f.name,
        type: 'tex',
        content: res.content,
        commentsStripped: res.commentsStripped,
        todosRemoved: res.todosRemoved,
      });
    } else if (fType === 'bib') {
      const res = pruneBibtex(f.content || '', citedKeysLower, keepAllBib);
      totalBibPruned += res.removedKeys.length;
      const cleanName = f.name.replace(/\.bib$/i, '_clean.bib');
      sanitizedFiles.push({
        name: f.name,
        outputName: options.preserveBibNames ? f.name : cleanName,
        type: 'bib',
        content: res.content,
        totalEntries: res.totalEntries,
        keptEntries: res.keptEntries,
        removedKeys: res.removedKeys,
      });
    }
  }

  return {
    files: sanitizedFiles,
    summary: {
      totalCommentsStripped,
      totalTodosRemoved,
      totalBibPruned,
    },
  };
}

/* ============================================================================
 * Printable Pre-Submission Audit Report Generators (Markdown & Standalone HTML)
 * ============================================================================ */

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generateMarkdownReport(auditResult, lang = 'en') {
  const zh = lang === 'zh';
  const now = new Date().toISOString();
  const verdict = auditResult.status === 'critical'
    ? (zh ? '未通过 — 检测到高危双盲泄密 (NO-GO)' : 'PREFLIGHT HOLD — Critical Leaks Detected (NO-GO)')
    : auditResult.status === 'warning'
      ? (zh ? '需复核 — 检测到结构或格式告警 (CAUTION)' : 'CAUTION — Structural / Hygiene Warnings')
      : (zh ? '通过 — 未检测到泄密与结构阻断项 (GO)' : 'PREFLIGHT PASS — Cleared for Submission (GO)');

  const lines = [
    `# ${zh ? 'PaperPreflight Pro 论文投稿前体检报告' : 'PaperPreflight Pro — Pre-Submission Audit Report'}`,
    '',
    `- **${zh ? '体检结论' : 'Preflight Verdict'}**: ${verdict}`,
    `- **${zh ? '生成时间' : 'Generated'}**: ${now}`,
    `- **${zh ? '隐私保障' : 'Privacy'}**: ${zh ? '100% 本地浏览器/CLI 离线完成，零文件上传' : '100% Local Offline Inspection — Zero Cloud Uploads'}`,
    `- **${zh ? '统计摘要' : 'Summary'}**: Critical: ${auditResult.counts.critical} | High: ${auditResult.counts.high} | Medium: ${auditResult.counts.medium} | Low: ${auditResult.counts.low}`,
    `- **${zh ? '扫描范围' : 'Scope'}**: ${auditResult.stats.filesScanned} file(s), ${auditResult.stats.linesScanned} lines, ${auditResult.stats.pdfFiles} PDF(s)`,
    '',
  ];

  if (auditResult.pdfReports?.length > 0) {
    lines.push(`## ${zh ? 'PDF 元数据与内嵌超链接核查' : 'PDF Metadata & Embedded Hyperlink Inspection'}`, '');
    for (const pr of auditResult.pdfReports) {
      lines.push(`### ${pr.file} (${pr.byteLength} bytes)`, '');
      const infoEntries = Object.entries(pr.info).filter(([k]) => !k.endsWith('_all'));
      if (infoEntries.length > 0) {
        lines.push('| Field | Value |', '| :--- | :--- |');
        for (const [k, v] of infoEntries) {
          lines.push(`| \`/${k}\` | ${String(v).replace(/\|/g, '\\|')} |`);
        }
        lines.push('');
      }
      if (pr.xmp?.found) {
        lines.push(`- **XMP \`dc:creator\`**: ${pr.xmp.creator.join(', ') || '(empty)'}`);
        lines.push(`- **XMP \`xmp:CreatorTool\`**: ${pr.xmp.creatorTool.join(', ') || '(empty)'}`);
        lines.push(`- **XMP \`pdf:Producer\`**: ${pr.xmp.producer.join(', ') || '(empty)'}`, '');
      }
      if (pr.uris?.length > 0) {
        lines.push('| Embedded `/URI` | Status |', '| :--- | :--- |');
        for (const u of pr.uris) {
          lines.push(`| \`${u.uri}\` | ${u.status.toUpperCase()}${u.reason ? ` (${u.reason})` : ''} |`);
        }
        lines.push('');
      }
    }
  }

  lines.push(`## ${zh ? '检测问题明细' : 'Detailed Findings'} (${auditResult.issues.length})`, '');
  if (auditResult.issues.length === 0) {
    lines.push(zh ? '未发现任何双盲泄密或 LaTeX 结构错误。祝投稿顺利！' : 'No anonymization leaks or structural defects detected. Ready for submission!');
  } else {
    lines.push(
      zh
        ? '| 级别 | 规则 | 位置 | 说明 | 修复建议 |'
        : '| Severity | Rule | Location | Finding | Recommended Fix |',
      '| :---: | :--- | :--- | :--- | :--- |',
    );
    for (const iss of auditResult.issues) {
      const loc = iss.line ? `\`${iss.file}:${iss.line}\`` : `\`${iss.file}\``;
      const msg = (zh ? iss.messageZh : iss.messageEn).replace(/\|/g, '\\|');
      const fix = (zh ? iss.fixZh : iss.fixEn).replace(/\|/g, '\\|');
      lines.push(`| **${iss.severity.toUpperCase()}** | \`${iss.ruleId}\` | ${loc} | ${msg} | ${fix} |`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

export function generateHtmlReport(auditResult, lang = 'en') {
  const zh = lang === 'zh';
  const badgeColor = auditResult.status === 'critical' ? '#dc2626' : auditResult.status === 'warning' ? '#d97706' : '#059669';
  const verdict = auditResult.status === 'critical'
    ? (zh ? 'PREFLIGHT HOLD — 检测到严重双盲泄密' : 'PREFLIGHT HOLD — Critical Leaks Detected')
    : auditResult.status === 'warning'
      ? (zh ? 'CAUTION — 存在结构或格式告警' : 'CAUTION — Warnings Detected')
      : (zh ? 'PREFLIGHT PASS — 通过投稿前体检' : 'PREFLIGHT PASS — Cleared for Submission');

  const rowsHtml = auditResult.issues.map((iss) => {
    const loc = iss.line ? `${iss.file}:${iss.line}` : iss.file;
    const title = zh ? iss.titleZh : iss.titleEn;
    const msg = zh ? iss.messageZh : iss.messageEn;
    const fix = zh ? iss.fixZh : iss.fixEn;
    return `<tr>
      <td><span class="sev sev-${escapeHtml(iss.severity)}">${escapeHtml(iss.severity.toUpperCase())}</span></td>
      <td><code>${escapeHtml(iss.ruleId)}</code></td>
      <td><code>${escapeHtml(loc)}</code></td>
      <td><strong>${escapeHtml(title)}</strong><div class="desc">${escapeHtml(msg)}</div>${iss.excerpt ? `<pre>${escapeHtml(iss.excerpt)}</pre>` : ''}</td>
      <td>${escapeHtml(fix)}</td>
    </tr>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="${zh ? 'zh-CN' : 'en'}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(zh ? 'PaperPreflight Pro 体检报告' : 'PaperPreflight Pro Audit Report')}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; background: #fff; max-width: 1080px; margin: 32px auto; padding: 0 24px; line-height: 1.5; }
  .banner { border-left: 6px solid ${badgeColor}; background: #f8fafc; padding: 18px 22px; border-radius: 8px; margin-bottom: 24px; }
  .banner h1 { margin: 0 0 6px; font-size: 20px; color: ${badgeColor}; }
  .meta { color: #475569; font-size: 13px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
  .card .num { font-size: 24px; font-weight: 700; }
  .card .lbl { font-size: 12px; color: #64748b; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #e2e8f0; padding: 10px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-weight: 600; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; background: #f1f5f9; padding: 2px 5px; border-radius: 4px; }
  pre { margin: 6px 0 0; padding: 8px; background: #0f172a; color: #e2e8f0; border-radius: 6px; font-size: 11px; white-space: pre-wrap; word-break: break-all; }
  .sev { display: inline-block; padding: 2px 8px; border-radius: 999px; font-weight: 700; font-size: 11px; }
  .sev-critical { background: #fee2e2; color: #b91c1c; }
  .sev-high { background: #ffedd5; color: #c2410c; }
  .sev-medium { background: #fef3c7; color: #b45309; }
  .sev-low { background: #e0f2fe; color: #0369a1; }
  .desc { margin-top: 4px; color: #334155; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <div class="banner">
    <h1>${escapeHtml(verdict)}</h1>
    <div class="meta">PaperPreflight Pro · 100% Local Offline Audit · ${escapeHtml(new Date().toISOString())}</div>
  </div>
  <div class="grid">
    <div class="card"><div class="num" style="color:#dc2626">${auditResult.counts.critical}</div><div class="lbl">Critical Leaks</div></div>
    <div class="card"><div class="num" style="color:#ea580c">${auditResult.counts.high}</div><div class="lbl">High / Structural</div></div>
    <div class="card"><div class="num" style="color:#d97706">${auditResult.counts.medium}</div><div class="lbl">Medium Warnings</div></div>
    <div class="card"><div class="num" style="color:#0284c7">${auditResult.counts.low}</div><div class="lbl">Prose Hygiene</div></div>
  </div>
  ${auditResult.issues.length === 0
    ? `<p>${escapeHtml(zh ? '未检测到任何泄密或结构缺陷，已通过起飞前核查！' : 'No issues detected. Manuscript passed preflight inspection.')}</p>`
    : `<table>
      <thead><tr><th>Severity</th><th>Rule</th><th>Location</th><th>Finding</th><th>Fix</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>`}
</body>
</html>`;
}
