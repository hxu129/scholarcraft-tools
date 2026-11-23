# ScholarCraft Tools

**Eight 100% local, zero-backend micro-tools for clinical compliance, EU sellers, researchers, and developers.**

No accounts, no cloud manuscript or patient-data uploads, no telemetry, and no recurring subscriptions.

- **Live Hub (All 8 Free Browser Tools):** https://hxu129.github.io/scholarcraft-tools/
- **New — SafeHarbor Studio Pro (Offline HIPAA 18-Identifier CSV De-Identifier):** https://hxu129.github.io/scholarcraft-tools/safeharbor/
- **New — GPSRKit Pro (Offline EU GPSR 2023/988 Risk Matrix & 5-Language Labels):** https://hxu129.github.io/scholarcraft-tools/gpsrkit/
- **Free $0+ SciPlot Starter (3 Runnable Matplotlib Scripts + CSVs):** https://hxucreativity28.gumroad.com/l/sciplot-starter-free
- **Free $0+ Paper Preflight Kit (25-Point Checklist + LaTeX `booktabs` Macros):** https://hxucreativity28.gumroad.com/l/paper-preflight-kit-free
- **Affiliate Partners (40% Commission / 30-Day Cookie):** https://hxu129.github.io/scholarcraft-tools/affiliates.html

---

## 5-Second Visual Walkthroughs

| SafeHarbor Studio (Offline HIPAA CSV + SHA-256 IRB Cert) | GPSRKit Pro (EU 2023/988 Technical File + 5-Lang Labels) |
| :---: | :---: |
| ![SafeHarbor Studio Demo](https://hxu129.github.io/scholarcraft-tools/assets/demo_safeharbor.gif) | ![GPSRKit Pro Demo](https://hxu129.github.io/scholarcraft-tools/assets/demo_gpsrkit.gif) |

| TableForge (CSV -> `booktabs` + Word 3-Line) | PromptShield (Local Mask -> 1-Click Restore) | CiteCheck (`.bib` Retractions + arXiv Upgrade) |
| :---: | :---: | :---: |
| ![TableForge Demo](https://hxu129.github.io/scholarcraft-tools/assets/demo_tableforge.gif) | ![PromptShield Demo](https://hxu129.github.io/scholarcraft-tools/assets/demo_promptshield.gif) | ![CiteCheck Demo](https://hxu129.github.io/scholarcraft-tools/assets/demo_citecheck.gif) |

---

## Live Browser Tools & Workflow Guides

| Tool | What It Solves | Live Free Demo | Interactive Guide |
| :--- | :--- | :--- | :--- |
| **SafeHarbor Studio** | 100% offline HIPAA Safe Harbor (`45 CFR § 164.514(b)(2)`) clinical CSV/TSV de-identifier: auto-zeros all 17 HHS restricted 3-digit ZIPs (`036–893 -> 000`), caps ages `>89 -> 90+`, consistent per-subject date shift, isolated PI Re-ID key map, and WebCrypto SHA-256 IRB Audit Certificate + zero-dep Python CLI. | [Open SafeHarbor Studio](https://hxu129.github.io/scholarcraft-tools/safeharbor/index.html) | [HIPAA CSV De-Identifier Guide](https://hxu129.github.io/scholarcraft-tools/tools/hipaa-safe-harbor-csv-deidentifier/) |
| **GPSRKit Pro** | 100% offline EU GPSR (`Regulation (EU) 2023/988`) Article 9 10-hazard Risk Assessment Technical File, 5-language (`EN/DE/FR/ES/IT`) 50×30mm thermal & A4 2×5 safety label sheets, Amazon EU / Etsy / Shopify listing blocks, and multi-SKU Batch CSV -> ZIP export. | [Open GPSRKit Pro](https://hxu129.github.io/scholarcraft-tools/gpsrkit/index.html) | [EU GPSR Risk Assessment Guide](https://hxu129.github.io/scholarcraft-tools/tools/eu-gpsr-article-9-risk-assessment-generator/) |
| **PromptShield** | Redact API keys, DB URIs, JWTs, PEM keys & PII into deterministic reversible placeholders (`[API_KEY_1]`) before ChatGPT/Claude, then restore replies in 1 click. Zero outbound calls. | [Open PromptShield](https://hxu129.github.io/scholarcraft-tools/promptshield/index.html) | [API Key Redactor Guide](https://hxu129.github.io/scholarcraft-tools/tools/redact-api-keys-chatgpt-claude/) |
| **TableForge** | Convert CSV / TSV / Excel tables into publication-ready LaTeX (`booktabs` + `siunitx`), Word 3-line rich HTML, Typst, and Markdown with auto bold `#1`, underline `#2`, `mean ± std`, and baseline `Δ`. | [Open TableForge](https://hxu129.github.io/scholarcraft-tools/tableforge/index.html) | [CSV to LaTeX Guide](https://hxu129.github.io/scholarcraft-tools/tools/csv-to-latex-booktabs/) |
| **CiteCheck** | Audit `.bib` files or reference lists directly from your browser against OpenAlex, Crossref, and DBLP to flag retracted papers, hallucinated entries, and stale arXiv preprints. | [Open CiteCheck](https://hxu129.github.io/scholarcraft-tools/citecheck/index.html) | [BibTeX Audit Guide](https://hxu129.github.io/scholarcraft-tools/tools/bibtex-retraction-checker/) |
| **PaperPreflight** | 100% offline double-blind auditor for `.tex`, `.bib`, and binary `.pdf` files — catches hidden PDF `/Author` & XMP metadata, clickable GitHub `/URI` links, leaked comments, and broken `\ref`/`\cite` keys. | [Open PaperPreflight](https://hxu129.github.io/scholarcraft-tools/preflight/index.html) | [Double-Blind PDF Guide](https://hxu129.github.io/scholarcraft-tools/tools/double-blind-pdf-metadata-checker/) |
| **CleanClip MD** | Extract clean GFM Markdown from KaTeX, MathJax v2/v3, arXiv LaTeXML, and Wikipedia pages while preserving raw `$...$` / `$$...$$` LaTeX math and live LLM token counts. | [Open CleanClip MD](https://hxu129.github.io/scholarcraft-tools/cleanclip/playground.html) | [KaTeX to Obsidian Guide](https://hxu129.github.io/scholarcraft-tools/tools/katex-mathjax-to-obsidian-markdown/) |
| **SciPlot Studio** | 30 publication-ready Matplotlib scripts (`Nature`, `Science`, `Cell`, `ICML`, `IEEE` column widths, 6 colorblind-safe palettes, Illustrator-editable vector PDFs with `pdf.fonttype = 42`). | [Open SciPlot Gallery](https://hxu129.github.io/scholarcraft-tools/sciplot/gallery.html) | [Nature & ICML Templates](https://hxu129.github.io/scholarcraft-tools/tools/nature-matplotlib-templates-python/) |

---

## Architecture, Privacy & Optional Pro Packs

- **Client-side first**: PromptShield, TableForge, PaperPreflight, and CleanClip MD perform zero backend uploads (verify in Chrome DevTools Network tab).
- **Public scholarly APIs only (CiteCheck)**: Queries public OpenAlex, Crossref, and DBLP endpoints directly from your browser.
- **One-time Pro packs (zero subscriptions)**: Optional Chrome MV3 extensions, batch ZIP exports, zero-dependency Python CLIs, and the full 30-script SciPlot source bundle are available on [Gumroad](https://hxucreativity28.gumroad.com/) (use starter code `STARTER20` for 20% off).
