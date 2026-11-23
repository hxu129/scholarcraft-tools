/**
 * PaperPreflight Pro — Zero-Dependency Binary PDF Metadata & Link Leak Inspector
 *
 * Operates 100% locally on raw Uint8Array bytes (Browser & Node v22).
 * Extracts:
 *  - PDF Info Dictionary fields (/Author, /Creator, /Producer, /Title, /Subject, /Keywords)
 *    supporting literal strings (...), nested parens, octal escapes, UTF-16BE BOM hex strings <FEFF...>,
 *    and indirect object references (N G R).
 *  - Embedded XMP XML metadata (<dc:creator>, <pdf:Producer>, <xmp:CreatorTool>, <dc:title>, etc.)
 *    in both element and attribute forms.
 *  - Clickable hyperlink annotations (/URI (...) and /URI <...>).
 */

const INFO_KEYS = ['Author', 'Creator', 'Producer', 'Title', 'Subject', 'Keywords', 'CreationDate', 'ModDate'];

const ANONYMOUS_VALUE_RE = /^(?:anonymous(?:\s+authors?)?|anonymized|double[\s-]*blind|blind(?:\s+review)?|n\/?a|none|unknown|redacted|-+)$/i;

const ALLOWED_ANONYMOUS_URL_RE = /(?:anonymous\.4open\.science|github\.com\/anonymous(?:[\/?#\-_]|$)|gitlab\.com\/anonymous(?:[\/?#\-_]|$)|huggingface\.co\/anonymous(?:[\/?#\-_]|$)|example\.(?:com|org|edu))/i;

const SENSITIVE_URI_RULES = [
  { label: 'GitHub', re: /^https?:\/\/(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)/i },
  { label: 'GitLab', re: /^https?:\/\/(?:www\.)?gitlab\.com\/([A-Za-z0-9_.-]+)/i },
  { label: 'Hugging Face', re: /^https?:\/\/(?:www\.)?huggingface\.co\/([A-Za-z0-9_.-]+)/i },
  { label: 'Bitbucket', re: /^https?:\/\/(?:www\.)?bitbucket\.org\/([A-Za-z0-9_.-]+)/i },
  { label: 'GitHub Pages', re: /^https?:\/\/([A-Za-z0-9-]+)\.github\.io(?:\/|$)/i },
  { label: 'ORCID', re: /^https?:\/\/(?:www\.)?orcid\.org\/[0-9X-]+/i },
  { label: 'Google Scholar', re: /^https?:\/\/scholar\.google\.[a-z.]+\//i },
  { label: 'ResearchGate', re: /^https?:\/\/(?:www\.)?researchgate\.net\/profile\//i },
  { label: 'LinkedIn', re: /^https?:\/\/(?:www\.)?linkedin\.com\/in\//i },
  { label: 'Personal Homepage (~user)', re: /^https?:\/\/[^/\s]+\/~[A-Za-z0-9._-]+/i },
  { label: 'Email (mailto:)', re: /^mailto:([^\s?]+)/i },
];

const LOCAL_PATH_RE = /(?:\/Users\/[A-Za-z0-9._-]+|\/home\/[A-Za-z0-9._-]+|[A-Za-z]:[\\/]Users[\\/][A-Za-z0-9._-]+|file:\/\/\/Users\/[A-Za-z0-9._-]+)/i;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

function bytesToLatin1(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const chunkSize = 0x8000;
  const parts = [];
  for (let i = 0; i < arr.length; i += chunkSize) {
    const slice = arr.subarray(i, Math.min(i + chunkSize, arr.length));
    let chunk = '';
    for (let j = 0; j < slice.length; j++) {
      chunk += String.fromCharCode(slice[j]);
    }
    parts.push(chunk);
  }
  return parts.join('');
}

function decodeUtf16Bytes(rawBytes) {
  if (rawBytes.length >= 2 && rawBytes[0] === 0xfe && rawBytes[1] === 0xff) {
    // UTF-16BE with BOM
    const units = [];
    for (let i = 2; i + 1 < rawBytes.length; i += 2) {
      units.push((rawBytes[i] << 8) | rawBytes[i + 1]);
    }
    return String.fromCharCode(...units).replace(/\x00/g, '').trim();
  }
  if (rawBytes.length >= 2 && rawBytes[0] === 0xff && rawBytes[1] === 0xfe) {
    // UTF-16LE with BOM
    const units = [];
    for (let i = 2; i + 1 < rawBytes.length; i += 2) {
      units.push(rawBytes[i] | (rawBytes[i + 1] << 8));
    }
    return String.fromCharCode(...units).replace(/\x00/g, '').trim();
  }
  // Try UTF-8 first if valid multibyte, fallback to Latin-1
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(rawBytes).replace(/\x00/g, '').trim();
  } catch {
    let out = '';
    for (let i = 0; i < rawBytes.length; i++) {
      out += String.fromCharCode(rawBytes[i]);
    }
    return out.replace(/\x00/g, '').trim();
  }
}

/**
 * Decode a PDF hex string content (inside `<...>`).
 * Supports UTF-16BE (`<FEFF...>`), UTF-16LE (`<FFFE...>`), UTF-8, and Latin-1.
 */
export function decodePdfHexString(hexContent) {
  let clean = String(hexContent || '').replace(/\s+/g, '');
  if (!clean || !/^[0-9A-Fa-f]+$/.test(clean)) return '';
  if (clean.length % 2 === 1) clean += '0';
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return decodeUtf16Bytes(bytes);
}

/**
 * Decode a PDF literal string content (inside `(...)`).
 * Handles backslash escapes, octal `\ddd`, line continuations, and UTF-16 BOM bytes.
 */
export function decodePdfLiteralString(literalContent) {
  const s = String(literalContent || '');
  const out = [];
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch !== '\\') {
      out.push(s.charCodeAt(i) & 0xff);
      continue;
    }
    if (i + 1 >= s.length) break;
    const next = s[++i];
    if (next === '\r') {
      if (s[i + 1] === '\n') i++;
      continue;
    }
    if (next === '\n') continue;
    if (next === 'n') { out.push(0x0a); continue; }
    if (next === 'r') { out.push(0x0d); continue; }
    if (next === 't') { out.push(0x09); continue; }
    if (next === 'b') { out.push(0x08); continue; }
    if (next === 'f') { out.push(0x0c); continue; }
    if (next === '(' || next === ')' || next === '\\') {
      out.push(next.charCodeAt(0));
      continue;
    }
    if (next >= '0' && next <= '7') {
      let oct = next;
      for (let k = 0; k < 2 && i + 1 < s.length && s[i + 1] >= '0' && s[i + 1] <= '7'; k++) {
        oct += s[++i];
      }
      out.push(parseInt(oct, 8) & 0xff);
      continue;
    }
    out.push(next.charCodeAt(0) & 0xff);
  }
  return decodeUtf16Bytes(new Uint8Array(out));
}

/**
 * Parse a balanced PDF literal `(...)` starting at `startIdx` (pointing to `'('`).
 * Returns `{ raw, endIdx }` or `null`.
 */
function readBalancedLiteral(text, startIdx) {
  if (text[startIdx] !== '(') return null;
  let depth = 0;
  let i = startIdx;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '\\') {
      i += 2;
      continue;
    }
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0) {
        return { raw: text.slice(startIdx + 1, i), endIdx: i + 1 };
      }
    }
    i++;
  }
  return null;
}

/**
 * Parse a PDF hex string `<...>` starting at `startIdx` (pointing to `'<'` and not `'<<'`).
 */
function readHexString(text, startIdx) {
  if (text[startIdx] !== '<' || text[startIdx + 1] === '<') return null;
  const end = text.indexOf('>', startIdx + 1);
  if (end === -1) return null;
  return { raw: text.slice(startIdx + 1, end), endIdx: end + 1 };
}

/**
 * Resolve a simple indirect PDF string object `N G obj (...) endobj` or `N G obj <...> endobj`.
 */
function resolveIndirectString(text, objNum, genNum) {
  const re = new RegExp(`(?:^|[\\r\\n\\s])${objNum}\\s+${genNum}\\s+obj\\b`, 'g');
  const m = re.exec(text);
  if (!m) return null;
  let pos = m.index + m[0].length;
  while (pos < text.length && /\s/.test(text[pos])) pos++;
  if (text[pos] === '(') {
    const lit = readBalancedLiteral(text, pos);
    return lit ? decodePdfLiteralString(lit.raw) : null;
  }
  if (text[pos] === '<' && text[pos + 1] !== '<') {
    const hex = readHexString(text, pos);
    return hex ? decodePdfHexString(hex.raw) : null;
  }
  return null;
}

/**
 * Extract all string values associated with a PDF dictionary key `/KeyName`.
 */
function extractPdfKeyValues(text, keyName) {
  const results = [];
  const keyToken = `/${keyName}`;
  let idx = 0;
  while ((idx = text.indexOf(keyToken, idx)) !== -1) {
    const afterKeyIdx = idx + keyToken.length;
    // Ensure exact PDF name boundary (next char must not be alphanumeric/name char)
    const nextChar = text[afterKeyIdx] || '';
    if (/[A-Za-z0-9_.-]/.test(nextChar)) {
      idx = afterKeyIdx;
      continue;
    }

    let pos = afterKeyIdx;
    while (pos < text.length && /[\s\r\n]/.test(text[pos])) pos++;

    let value = null;
    if (text[pos] === '(') {
      const lit = readBalancedLiteral(text, pos);
      if (lit) {
        value = decodePdfLiteralString(lit.raw);
        idx = lit.endIdx;
      } else {
        idx = afterKeyIdx;
      }
    } else if (text[pos] === '<' && text[pos + 1] !== '<') {
      const hex = readHexString(text, pos);
      if (hex) {
        value = decodePdfHexString(hex.raw);
        idx = hex.endIdx;
      } else {
        idx = afterKeyIdx;
      }
    } else {
      const refMatch = text.slice(pos, pos + 32).match(/^(\d+)\s+(\d+)\s+R\b/);
      if (refMatch) {
        value = resolveIndirectString(text, refMatch[1], refMatch[2]);
        idx = pos + refMatch[0].length;
      } else {
        idx = afterKeyIdx;
      }
    }

    if (value !== null && value !== '') {
      results.push(value);
    }
  }
  return results;
}

function unescapeXml(str) {
  return String(str || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .trim();
}

function extractXmpField(xml, tagName) {
  const values = [];
  const escapedTag = tagName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Element form: <dc:creator>...</dc:creator>
  const elemRe = new RegExp(`<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapedTag}>`, 'gi');
  let m;
  while ((m = elemRe.exec(xml)) !== null) {
    const inner = m[1];
    const liMatches = [...inner.matchAll(/<rdf:li(?:\s[^>]*)?>([\s\S]*?)<\/rdf:li>/gi)];
    if (liMatches.length > 0) {
      for (const li of liMatches) {
        const cleaned = unescapeXml(li[1].replace(/<[^>]+>/g, ''));
        if (cleaned) values.push(cleaned);
      }
    } else {
      const cleaned = unescapeXml(inner.replace(/<[^>]+>/g, ''));
      if (cleaned) values.push(cleaned);
    }
  }
  // Attribute form: pdf:Producer="pdfTeX-1.40.25"
  const attrRe = new RegExp(`\\b${escapedTag}\\s*=\\s*"([^"]+)"`, 'gi');
  while ((m = attrRe.exec(xml)) !== null) {
    const cleaned = unescapeXml(m[1]);
    if (cleaned) values.push(cleaned);
  }
  return [...new Set(values)];
}

/**
 * Extract embedded XMP XML metadata from PDF raw string.
 */
export function extractXmpMetadata(rawText) {
  const xmp = {
    found: false,
    creator: [],
    title: [],
    producer: [],
    creatorTool: [],
    keywords: [],
    description: [],
  };

  const packets = [];
  const xmpRe = /<x:xmpmeta\b[\s\S]*?<\/x:xmpmeta>/gi;
  let m;
  while ((m = xmpRe.exec(rawText)) !== null) {
    packets.push(m[0]);
  }
  if (packets.length === 0) {
    const rdfRe = /<rdf:RDF\b[\s\S]*?<\/rdf:RDF>/gi;
    while ((m = rdfRe.exec(rawText)) !== null) {
      packets.push(m[0]);
    }
  }
  if (packets.length === 0) return xmp;

  xmp.found = true;
  const combined = packets.join('\n');
  xmp.creator = extractXmpField(combined, 'dc:creator');
  xmp.title = extractXmpField(combined, 'dc:title');
  xmp.producer = extractXmpField(combined, 'pdf:Producer');
  xmp.creatorTool = extractXmpField(combined, 'xmp:CreatorTool');
  xmp.keywords = extractXmpField(combined, 'pdf:Keywords');
  xmp.description = extractXmpField(combined, 'dc:description');
  return xmp;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchBlocklistTerms(text, blocklist) {
  if (!text || !Array.isArray(blocklist) || blocklist.length === 0) return [];
  const hits = [];
  for (const rawTerm of blocklist) {
    const term = String(rawTerm || '').trim();
    if (term.length < 2) continue;
    const isAsciiWord = /^[A-Za-z0-9]/.test(term) && /[A-Za-z0-9]$/.test(term);
    const re = isAsciiWord
      ? new RegExp(`(?<![A-Za-z0-9_])${escapeRegex(term)}(?![A-Za-z0-9_])`, 'i')
      : new RegExp(escapeRegex(term), 'i');
    if (re.test(text)) {
      hits.push(term);
    }
  }
  return hits;
}

/**
 * Inspect raw binary bytes of a PDF file for metadata leaks and non-anonymous hyperlinks.
 *
 * @param {Uint8Array|ArrayBuffer} bytes
 * @param {{ filename?: string, blocklist?: string[] }} [options]
 */
export function scanPdfBytes(bytes, options = {}) {
  const filename = options.filename || 'submission.pdf';
  const blocklist = Array.isArray(options.blocklist) ? options.blocklist : [];
  const rawBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const rawText = bytesToLatin1(rawBytes);

  const isPdfHeader = rawText.slice(0, 1024).includes('%PDF-');
  const info = {};
  for (const key of INFO_KEYS) {
    const vals = extractPdfKeyValues(rawText, key);
    if (vals.length > 0) {
      // Take the last occurrence (PDF incremental updates append newer Info dicts later in file)
      info[key] = vals[vals.length - 1];
      if (vals.length > 1) {
        info[`${key}_all`] = [...new Set(vals)];
      }
    }
  }

  const xmp = extractXmpMetadata(rawText);
  const rawUris = extractPdfKeyValues(rawText, 'URI');
  const uris = [...new Set(rawUris.map((u) => u.trim()).filter(Boolean))];

  const issues = [];
  let issueIdx = 0;
  const addIssue = (item) => {
    issues.push({
      id: `pdf-${++issueIdx}`,
      file: filename,
      line: null,
      category: 'pdf',
      ...item,
    });
  };

  if (!isPdfHeader) {
    addIssue({
      ruleId: 'PDF_INVALID_HEADER',
      severity: 'medium',
      titleEn: 'Unrecognized PDF Header',
      titleZh: '未检测到标准 PDF 文件头',
      messageEn: 'File does not start with a standard %PDF- header; metadata extraction may be incomplete.',
      messageZh: '文件未包含标准 %PDF- 文件头，元数据解析可能不完整。',
      excerpt: rawText.slice(0, 32).replace(/[^\x20-\x7e]/g, '.'),
      fixEn: 'Verify the uploaded file is a valid compiled PDF document.',
      fixZh: '请确认上传的是有效编译生成的 PDF 文件。',
    });
  }

  // 1. Check /Author Info field
  const allAuthors = info.Author_all || (info.Author ? [info.Author] : []);
  for (const authorVal of allAuthors) {
    if (authorVal && !ANONYMOUS_VALUE_RE.test(authorVal.trim())) {
      addIssue({
        ruleId: 'PDF_AUTHOR_LEAK',
        severity: 'critical',
        titleEn: 'PDF Info /Author Metadata Leak',
        titleZh: 'PDF 元数据 /Author 泄露作者身份',
        messageEn: `Compiled PDF contains non-anonymous /Author metadata: "${authorVal}".`,
        messageZh: `编译后的 PDF 包含非匿名 /Author 字段：“${authorVal}”。`,
        excerpt: `/Author (${authorVal})`,
        match: authorVal,
        fixEn: 'Add \\hypersetup{pdfauthor={Anonymous}, pdfcreator={}, pdfproducer={}} or strip metadata with exiftool/qpdf before uploading.',
        fixZh: '请在导言区添加 \\hypersetup{pdfauthor={Anonymous}, pdfcreator={}, pdfproducer={}} 或使用 qpdf/exiftool 清除 PDF 元数据。',
      });
    }
  }

  // 2. Check XMP <dc:creator>
  for (const xmpAuthor of xmp.creator) {
    if (xmpAuthor && !ANONYMOUS_VALUE_RE.test(xmpAuthor.trim())) {
      addIssue({
        ruleId: 'PDF_XMP_CREATOR_LEAK',
        severity: 'critical',
        titleEn: 'PDF XMP <dc:creator> Identity Leak',
        titleZh: 'PDF XMP 流 <dc:creator> 泄露作者身份',
        messageEn: `Embedded XMP XML metadata exposes author identity in <dc:creator>: "${xmpAuthor}".`,
        messageZh: `嵌入的 XMP XML 元数据在 <dc:creator> 中泄露了作者信息：“${xmpAuthor}”。`,
        excerpt: `<dc:creator>${xmpAuthor}</dc:creator>`,
        match: xmpAuthor,
        fixEn: 'Strip XMP packets via exiftool -all= submission.pdf && qpdf --linearize, or disable hyperxmp/pdfx author tags.',
        fixZh: '请使用 exiftool -all= 清除 XMP 流并重新线性化，或移除 hyperxmp/pdfx 中的作者标签。',
      });
    }
  }

  // 3. Check local paths, emails, and blocklist across all Info + XMP fields
  const metadataEntries = [];
  for (const key of INFO_KEYS) {
    const vals = info[`${key}_all`] || (info[key] ? [info[key]] : []);
    for (const val of vals) {
      metadataEntries.push({ field: `/${key}`, value: val });
    }
  }
  for (const val of xmp.creator) metadataEntries.push({ field: 'XMP dc:creator', value: val });
  for (const val of xmp.title) metadataEntries.push({ field: 'XMP dc:title', value: val });
  for (const val of xmp.producer) metadataEntries.push({ field: 'XMP pdf:Producer', value: val });
  for (const val of xmp.creatorTool) metadataEntries.push({ field: 'XMP xmp:CreatorTool', value: val });
  for (const val of xmp.keywords) metadataEntries.push({ field: 'XMP pdf:Keywords', value: val });
  for (const val of xmp.description) metadataEntries.push({ field: 'XMP dc:description', value: val });

  const seenBlocklistKeys = new Set();
  for (const entry of metadataEntries) {
    const blHits = matchBlocklistTerms(entry.value, blocklist);
    for (const term of blHits) {
      const dedupKey = `${entry.field}|${term.toLowerCase()}`;
      if (seenBlocklistKeys.has(dedupKey)) continue;
      seenBlocklistKeys.add(dedupKey);
      addIssue({
        ruleId: 'PDF_BLOCKLIST_LEAK',
        severity: 'critical',
        titleEn: `Blocklist Match in PDF ${entry.field}`,
        titleZh: `PDF ${entry.field} 命中自定义敏感词`,
        messageEn: `PDF metadata field ${entry.field} contains blocklisted term "${term}".`,
        messageZh: `PDF 元数据字段 ${entry.field} 包含敏感词 “${term}”。`,
        excerpt: `${entry.field}: ${entry.value}`,
        match: term,
        fixEn: 'Remove identifying metadata from LaTeX hyperref/pdfinfo settings and re-compile.',
        fixZh: '请清除 LaTeX hyperref/pdfinfo 中的敏感元数据并重新编译。',
      });
    }

    const pathMatch = entry.value.match(LOCAL_PATH_RE);
    if (pathMatch) {
      addIssue({
        ruleId: 'PDF_LOCAL_PATH_LEAK',
        severity: 'high',
        titleEn: `Local Username Path in PDF ${entry.field}`,
        titleZh: `PDF ${entry.field} 暴露本地用户名路径`,
        messageEn: `PDF metadata ${entry.field} exposes local filesystem path "${pathMatch[0]}".`,
        messageZh: `PDF 元数据 ${entry.field} 泄露了本地路径 “${pathMatch[0]}”。`,
        excerpt: `${entry.field}: ${entry.value}`,
        match: pathMatch[0],
        fixEn: 'Scrub /Creator and /Producer fields or compile from an anonymous directory path.',
        fixZh: '请清理 /Creator 与 /Producer 字段或在匿名路径下编译 PDF。',
      });
    }

    const emailMatches = entry.value.match(EMAIL_RE) || [];
    for (const email of emailMatches) {
      if (/^(?:anonymous|example)@/i.test(email) || /@example\.(?:com|org|edu)$/i.test(email)) continue;
      addIssue({
        ruleId: 'PDF_EMAIL_LEAK',
        severity: 'critical',
        titleEn: `Email Address in PDF ${entry.field}`,
        titleZh: `PDF ${entry.field} 泄露邮箱地址`,
        messageEn: `PDF metadata ${entry.field} contains email address "${email}".`,
        messageZh: `PDF 元数据 ${entry.field} 包含邮箱地址 “${email}”。`,
        excerpt: `${entry.field}: ${entry.value}`,
        match: email,
        fixEn: 'Remove author emails from PDF metadata properties.',
        fixZh: '请从 PDF 元数据属性中移除作者邮箱。',
      });
    }
  }

  // 4. Inspect embedded clickable /URI hyperlinks
  const uriReports = [];
  for (const uri of uris) {
    const isAllowedAnon = ALLOWED_ANONYMOUS_URL_RE.test(uri);
    const blHits = matchBlocklistTerms(uri, blocklist);
    let flaggedReason = null;

    if (!isAllowedAnon) {
      for (const rule of SENSITIVE_URI_RULES) {
        if (rule.re.test(uri)) {
          // Allow anonymous-like handles on GitHub/GitLab/HF
          if (/^https?:\/\/(?:www\.)?(?:github|gitlab|huggingface)\.(?:com|co)\/(?:anonymous|anon)(?:[\/?#\-_]|$)/i.test(uri)) {
            continue;
          }
          // Allow example/anonymous mailto
          if (/^mailto:(?:anonymous|anon|example)@/i.test(uri) || /^mailto:[^@]+@example\.(?:com|org)$/i.test(uri)) {
            continue;
          }
          flaggedReason = rule.label;
          break;
        }
      }
    }

    const isLeak = Boolean(flaggedReason || blHits.length > 0);
    uriReports.push({
      uri,
      status: isLeak ? 'leak' : isAllowedAnon ? 'anonymous_ok' : 'ok',
      reason: flaggedReason || (blHits.length > 0 ? `Blocklist: ${blHits.join(', ')}` : ''),
    });

    if (flaggedReason) {
      addIssue({
        ruleId: 'PDF_URI_LEAK',
        severity: 'critical',
        titleEn: `Non-Anonymous Clickable PDF Link (${flaggedReason})`,
        titleZh: `PDF 内嵌非匿名超链接（${flaggedReason}）`,
        messageEn: `Compiled PDF contains a clickable ${flaggedReason} hyperlink: ${uri}`,
        messageZh: `编译后的 PDF 包含可点击的 ${flaggedReason} 链接：${uri}`,
        excerpt: `/URI (${uri})`,
        match: uri,
        fixEn: 'Replace with an anonymized repository (e.g., https://anonymous.4open.science/r/...) or remove the hyperlink before double-blind submission.',
        fixZh: '请替换为匿名代码托管链接（如 https://anonymous.4open.science/r/...）或在双盲投稿版中移除该超链接。',
      });
    } else if (blHits.length > 0) {
      addIssue({
        ruleId: 'PDF_BLOCKLIST_LEAK',
        severity: 'critical',
        titleEn: 'Blocklist Match in PDF Hyperlink',
        titleZh: 'PDF 超链接命中自定义敏感词',
        messageEn: `Clickable PDF URI "${uri}" contains blocklisted term(s): ${blHits.join(', ')}.`,
        messageZh: `PDF 超链接 “${uri}” 包含敏感词：${blHits.join(', ')}。`,
        excerpt: `/URI (${uri})`,
        match: blHits[0],
        fixEn: 'Replace or remove this hyperlink before submission.',
        fixZh: '请在投稿前替换或删除此超链接。',
      });
    }
  }

  return {
    file: filename,
    byteLength: rawBytes.length,
    isPdfHeader,
    info,
    xmp,
    uris: uriReports,
    issues,
  };
}

function encodeUtf16BeHex(str) {
  let hex = 'FEFF';
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0');
  }
  return hex;
}

function escapePdfLiteral(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Construct a valid minimal PDF 1.4 binary buffer (Uint8Array) with custom Info dictionary,
 * UTF-16BE hex Title, XMP XML metadata packet, and clickable /URI link annotations.
 * Used both for the instant interactive demo and unit tests.
 */
export function buildSamplePdfBytes(opts = {}) {
  const author = opts.author ?? 'Alice Chen';
  const creator = opts.creator ?? 'LaTeX with hyperref (/Users/alice/projects/neurips26)';
  const producer = opts.producer ?? 'pdfTeX-1.40.25';
  const title = opts.title ?? 'Adaptive Sparse Graph Diffusion';
  const xmpCreator = opts.xmpCreator ?? author;
  const uris = opts.uris ?? [
    'https://anonymous.4open.science/r/asgd-review-9A2F',
    'https://github.com/alicechen-ml/asgd-diffusion',
    'mailto:achen@stanford.edu',
  ];

  const xmpXml = [
    '<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>',
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">',
    '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">',
    '    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:pdf="http://ns.adobe.com/pdf/1.3/" xmlns:xmp="http://ns.adobe.com/xap/1.0/">',
    xmpCreator ? `      <dc:creator><rdf:Seq><rdf:li>${xmpCreator}</rdf:li></rdf:Seq></dc:creator>` : '',
    `      <pdf:Producer>${producer}</pdf:Producer>`,
    `      <xmp:CreatorTool>${creator}</xmp:CreatorTool>`,
    '    </rdf:Description>',
    '  </rdf:RDF>',
    '</x:xmpmeta>',
    '<?xpacket end="w"?>',
  ].filter(Boolean).join('\n');

  const objects = [];
  // Obj 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R /Metadata 5 0 R >>\nendobj\n');
  // Obj 2: Pages
  objects.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  // Annotations start at obj 7
  const annotRefs = uris.map((_, i) => `${7 + i} 0 R`).join(' ');
  // Obj 3: Page
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Annots [${annotRefs}] >>\nendobj\n`);
  // Obj 4: Content stream
  const pageStream = 'BT /F1 12 Tf 72 720 Td (PaperPreflight Demo PDF) Tj ET';
  objects.push(`4 0 obj\n<< /Length ${pageStream.length} >>\nstream\n${pageStream}\nendstream\nendobj\n`);
  // Obj 5: XMP Metadata stream
  const xmpBytesLen = new TextEncoder().encode(xmpXml).length;
  objects.push(`5 0 obj\n<< /Type /Metadata /Subtype /XML /Length ${xmpBytesLen} >>\nstream\n${xmpXml}\nendstream\nendobj\n`);
  // Obj 6: Info Dictionary (uses UTF-16BE hex string for /Title and literal strings for others)
  const infoParts = [];
  if (author) infoParts.push(`/Author (${escapePdfLiteral(author)})`);
  if (creator) infoParts.push(`/Creator (${escapePdfLiteral(creator)})`);
  if (producer) infoParts.push(`/Producer (${escapePdfLiteral(producer)})`);
  if (title) infoParts.push(`/Title <${encodeUtf16BeHex(title)}>`);
  objects.push(`6 0 obj\n<< ${infoParts.join(' ')} >>\nendobj\n`);

  // Obj 7..N: Link annotations
  uris.forEach((uri, idx) => {
    const objId = 7 + idx;
    objects.push(
      `${objId} 0 obj\n<< /Type /Annot /Subtype /Link /Rect [72 ${680 - idx * 20} 400 ${695 - idx * 20}] /A << /S /URI /URI (${escapePdfLiteral(uri)}) >> >>\nendobj\n`,
    );
  });

  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [0];
  let cursor = 0;

  const pushStr = (s) => {
    const b = encoder.encode(s);
    chunks.push(b);
    cursor += b.length;
  };

  pushStr('%PDF-1.4\n');
  for (const objStr of objects) {
    offsets.push(cursor);
    pushStr(objStr);
  }

  const xrefOffset = cursor;
  pushStr(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  for (let i = 1; i < offsets.length; i++) {
    pushStr(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const total = new Uint8Array(cursor);
  let pos = 0;
  for (const c of chunks) {
    total.set(c, pos);
    pos += c.length;
  }
  return total;
}
