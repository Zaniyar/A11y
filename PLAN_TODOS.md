# A11y Chrome Extension - Features and TODOs

## Goals
- Make pages more accessible using Chrome built-in AI (Prompt API) with optional cloud fallback.
- Apply non-destructive fixes via CSS/ARIA overlays that are easy to revert.

## Architecture
- Content script: scans DOM, injects UI, quick checks/fixes, posts work to background.
- Page script: runs Prompt API session in page context.
- Background: AI session manager, rate limiting, permissions, storage sync.
- Options: user profile (Visual/Motor/Cognitive/Hearing), feature toggles, fallback API key.

## Phase 1 - MVP Features
- Quick Ask on selection (summarize/explain; streaming)
- Simplify text (plain-language rewrite)
- Translate selection (auto-detect -> target language)
- Generate alt text for images (single + batch)
- Contrast checker with auto-fix (WCAG AA)
- Page outline (landmarks/headings) + navigate
- Form label/description helper

## Phase 2 - Enhancements
- Dyslexia-friendly mode (fonts/spacing)
- Keyboard focus ring enhancer + tab path hints
- Media caption/summary helper
- Table explainer (structure + summary)

## References (web-ai-demos)
- Prompt/session: prompt-api-playground, ai-session-management
- Summarization/streaming: summarization-api-playground, ai-streaming-parser
- Translation/detection: translation-language-detection-api-playground, document-translator
- Context menu patterns: right-click-for-superpowers
- Canvas/image capture: canvas-image-prompt

---

## TODOs - Phase 1 (ship first)

### Core plumbing
- [x] Create AI service wrapper (local Prompt API first, cloud fallback) - **FIXED: Added page context bridge via postMessage**
- [x] Add language detection helper and auto-respond in page language (completed)
- [ ] Persist user profile and feature toggles (options page)
- [ ] Side panel scaffold with tabs: Outline | Contrast | Images | Forms

### Quick Ask / Chat
- [x] Quick Ask on selection with page context (completed)
- [x] Streamed responses working (completed)
- [x] Add actions: Simplify, Translate (buttons next to Ask) (completed)
- [x] Copy button; small footer disclosure (completed)
- [ ] Truncate prompts safely; preserve citations/inline code formatting

### Translation
- [x] Auto-detect selection language; translate to preferred language (completed)
- [x] Option to replace selection visually (non-destructive overlay) (completed)

### Simplify
- [x] Plain-language rewrite at user's reading level (options controlled) (completed)
- [x] Replace-in-place overlay + revert (completed)

### Alt-text generator
- [ ] Scan page for images without good alt
- [ ] Per-image "Generate alt" action (context menu and hover chip)
- [ ] Side panel batch mode; apply to alt or aria-label overlay

### Contrast checker
- [ ] Scan visible text nodes and compute contrast
- [ ] Suggest AA color pairs; preview per element
- [ ] Apply CSS overrides via style tag; global revert toggle

### Page outline
- [ ] Build headings/landmarks tree; detect skipped levels
- [ ] Click to scroll/focus; keyboard navigable list

### Forms helper
- [ ] Detect unlabeled inputs; propose label text with AI
- [ ] Apply ARIA attributes (aria-label, aria-describedby) as overlays

### Privacy & safety
- [ ] "Local only" mode; per-feature opt-out of cloud
- [ ] Limit prompt sizes; redact obvious secrets (emails, tokens)

---

## Milestone checkpoints
- [ ] M1: Core wrapper + Quick Ask actions working end-to-end
- [ ] M2: Alt-text generator (single + batch) shipped
- [ ] M3: Contrast checker AA shipped
- [ ] M4: Outline + Forms helper shipped

---

## Nice-to-haves
- [ ] Theming (light/dark/system)
- [ ] Export applied fixes (JSON) and shareable link
- [ ] Import per-site preferences

---

## Hackathon focus (Google Chrome Built‑in AI Challenge 2025)

### API mapping (judging: Technological Execution)
- Prompt API: core session management for all AI features; multimodal later (image input for alt-text context).
- Summarizer API: Quick Ask summaries; page/section TL;DR in side panel.
- Translator API: selection/page translation.
- Writer / Rewriter APIs: Simplify text to plain language; rewrite labels and tooltips.
- Proofreader API: fix grammar for generated alt text and rewritten content.

### 1‑day sprint timeline
- T0–2h: Core AI wrapper (local-first, fallback), Options storage, language detection.
- T2–6h: Quick Ask actions (Summarize, Simplify, Translate) with streaming + UX polish.
- T6–10h: Alt-text generator (single + batch), minimal side panel.
- T10–14h: Contrast checker scan + per-node preview + apply CSS override.
- T14–20h: Demo script, sample pages, screenshots, short video recording.
- T20–24h: README, usage instructions, publishable build, final QA.

### Submission checklist
- [ ] Uses at least one Chrome Built-in AI API (list exactly which and where in README).
- [ ] Public GitHub repo with open-source license and build/run instructions.
- [ ] Working demo: load unpacked extension or hosted demo with instructions.
- [ ] 3‑minute video (YouTube/Vimeo): shows extension working on-device.
- [ ] Text description: problem, features, used APIs, privacy approach.
- [ ] English README and submission text.
- [ ] If private demo pages are needed, include credentials or local HTML.
- [ ] Note Early Preview/flags/origin‑trial steps if required, plus fallback.
