# ScholarCraft Tools

**Six 100% local, zero-backend micro-tools for researchers, technical writers, and developers.**

No accounts, no cloud manuscript uploads, no telemetry, and no recurring subscriptions. Try every interactive tool live directly in your browser:

**Live Hub:** https://hxu129.github.io/scholarcraft-tools/

---

## Live Browser Tools

| Tool | What It Solves | Live Demo (Free, Local) |
| :--- | :--- | :--- |
| **PromptShield** | Redact API keys, DB URIs, JWTs, PEM keys & PII into deterministic reversible placeholders (`[API_KEY_1]`) before pasting into ChatGPT/Claude, then restore replies in 1 click. Zero outbound network calls. | [Open PromptShield](https://hxu129.github.io/scholarcraft-tools/promptshield/index.html) |
| **TableForge** | Convert CSV / TSV / Excel tables into publication-ready LaTeX (`booktabs` + `siunitx` S-columns), Word 3-line rich HTML, Typst, and Markdown with automatic bold `#1`, underlined `#2`, `mean ± std`, and baseline `Δ`. | [Open TableForge](https://hxu129.github.io/scholarcraft-tools/tableforge/index.html) |
| **CiteCheck** | Audit `.bib` files or reference lists directly from your browser against OpenAlex, Crossref, and DBLP to flag retracted papers, hallucinated entries, metadata drift, and arXiv preprints that now have formal published venues. | [Open CiteCheck](https://hxu129.github.io/scholarcraft-tools/citecheck/index.html) |
| **PaperPreflight** | 100% offline double-blind pre-submission auditor for `.tex`, `.bib`, and binary `.pdf` files — catches hidden PDF `/Author` & `/Creator` XMP metadata, clickable GitHub `/URI` links, leaked author comments, and broken `\ref` / `\cite` keys. | [Open PaperPreflight](https://hxu129.github.io/scholarcraft-tools/preflight/index.html) |
| **CleanClip MD** | Extract clean GFM Markdown from KaTeX, MathJax v2/v3, arXiv LaTeXML, and Wikipedia pages while preserving raw `$...$` / `$$...$$` LaTeX math and estimating live LLM context token budgets. | [Open CleanClip MD](https://hxu129.github.io/scholarcraft-tools/cleanclip/playground.html) |
| **SciPlot Studio** | Interactive preview gallery for 30 publication-ready Matplotlib scripts (`Nature`, `Science`, `Cell`, `ICML`, `IEEE` column widths, 6 colorblind-safe palettes, Illustrator-editable vector PDFs with `pdf.fonttype = 42`). | [Open SciPlot Gallery](https://hxu129.github.io/scholarcraft-tools/sciplot/gallery.html) |

---

## Architecture & Privacy Principles

- **Client-side first**: PromptShield, TableForge, PaperPreflight, and CleanClip MD perform zero backend uploads. You can inspect the browser DevTools Network tab to confirm.
- **Public scholarly APIs only (CiteCheck)**: CiteCheck queries public OpenAlex, Crossref, and DBLP endpoints directly from your browser; manuscript prose never leaves your machine.
- **Offline Chrome MV3 extensions & zero-dependency CLIs**: Optional one-time Pro packs (Chrome Side Panel extensions, batch ZIP workflows, zero-dep Python CLIs, and full 30-script SciPlot source bundle) are available on [Gumroad](https://hxucreativity28.gumroad.com/) with lifetime offline activation and zero monthly fees.

## Legal & Support

- [Terms of Service](https://hxu129.github.io/scholarcraft-tools/terms.html)
- [Privacy Policy](https://hxu129.github.io/scholarcraft-tools/privacy.html)
- [Refund Policy](https://hxu129.github.io/scholarcraft-tools/refund.html)
