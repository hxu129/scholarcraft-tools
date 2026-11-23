/**
 * Bilingual Token Estimator for English / Code / LaTeX + CJK content.
 *
 * Heuristics:
 *  - CJK characters (Hanzi, Kana, Hangul): ~1.5 tokens per character
 *  - CJK fullwidth punctuation: ~1.0 token per character
 *  - English / Latin / code / LaTeX: ~4 characters per token (wordpiece average)
 */

import { CONTEXT_WINDOWS } from './config.js';

const CJK_SCRIPT_RE = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/g;
const CJK_PUNCT_RE = /[\u3000-\u303f\uff00-\uffef]/g;
const LATIN_WORD_RE = /[A-Za-z0-9]+(?:['_-][A-Za-z0-9]+)*/g;

/**
 * Estimate token metrics for arbitrary bilingual text/Markdown.
 * @param {string} text
 * @returns {{
 *   tokens: number,
 *   chars: number,
 *   words: number,
 *   cjkChars: number,
 *   contextShare128k: number,
 *   contextShare200k: number
 * }}
 */
export function estimateTokens(text) {
  const input = String(text || '');
  const chars = input.length;

  if (!input.trim()) {
    return {
      tokens: 0,
      chars,
      words: 0,
      cjkChars: 0,
      contextShare128k: 0,
      contextShare200k: 0,
    };
  }

  const cjkMatches = input.match(CJK_SCRIPT_RE);
  const cjkChars = cjkMatches ? cjkMatches.length : 0;

  const cjkPunctMatches = input.match(CJK_PUNCT_RE);
  const cjkPunct = cjkPunctMatches ? cjkPunctMatches.length : 0;

  // Strip CJK characters & punctuation without introducing synthetic length inflation
  const nonCjkText = input
    .replace(CJK_SCRIPT_RE, '')
    .replace(CJK_PUNCT_RE, '');

  // Collapse runs of whitespace in non-CJK segment so formatting padding doesn't inflate count
  const normalizedNonCjk = nonCjkText.replace(/\s+/g, ' ').trim();
  const nonCjkChars = normalizedNonCjk.length;

  const latinWords = (nonCjkText.match(LATIN_WORD_RE) || []).length;
  const words = latinWords + cjkChars;

  const rawTokens = cjkChars * 1.5 + cjkPunct * 1.0 + nonCjkChars / 4;
  const tokens = Math.max(1, Math.round(rawTokens));

  const contextShare128k = Number((tokens / CONTEXT_WINDOWS.k128).toFixed(6));
  const contextShare200k = Number((tokens / CONTEXT_WINDOWS.k200).toFixed(6));

  return {
    tokens,
    chars,
    words,
    cjkChars,
    contextShare128k,
    contextShare200k,
  };
}

/**
 * Format a context share ratio (0..1+) as a clean percentage string, e.g. "1.2%".
 * @param {number} share
 * @returns {string}
 */
export function formatContextPercent(share) {
  const pct = Number(share || 0) * 100;
  if (pct === 0) return '0%';
  if (pct < 0.1) return '<0.1%';
  if (pct < 10) return `${pct.toFixed(1)}%`;
  return `${Math.round(pct)}%`;
}
