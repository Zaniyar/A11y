# About the Project

## The Spark: When "Disabled" Becomes a Universal Experience

We started with a simple question: **What if accessibility isn't a minority issue, but a human one?**

The moment of inspiration came from an accessibility matrix that changed everything we thought we knew. It showed us that disabilities aren't just permanent conditions—they're **permanent, temporary, and situational**. The parent juggling a baby with one hand. The driver who can't look at their phone. The bartender working in a noisy environment. The person reading in a quiet library. **The person with their arm in a sling, fighting a migraine, or simply distracted.**

Suddenly, we realized: **accessibility isn't about a small group of people. It's about ALL of us, at different moments in our lives.**

## The Vision: AI as a Bridge, Not a Barrier

The modern web is drowning in information. For many, this abundance is empowering. But for others—and that's more people than we realize—it's overwhelming. A complex article becomes impenetrable. A verbose legal document becomes a wall. A video without captions becomes silence. A page in a foreign language becomes exclusion.

**What if AI could act as a universal translator, not just between languages, but between humans and information itself?**

We envisioned a Chrome extension that would:
- **Simplify** complex text for those with cognitive disabilities, language barriers, or simply limited time
- **Summarize** long articles for those who need the essence, not the verbosity
- **Translate** content into the user's language, automatically detecting and adapting
- **Answer questions** about page content, making information interactive rather than static
- **Speak aloud** responses for those who can't read, are busy, or simply learn better auditorily

But we didn't want it to be obvious. We didn't want it to scream "I'm an accessibility tool." We wanted it to feel like **magic**—seamless, natural, and empowering.

## The Journey: Learning to Build Across Worlds

Building this wasn't just about writing code. It was about **bridging impossible gaps.**

### The Technical Challenge: Three Worlds, One Vision

Chrome extensions exist in **isolated worlds**. Content scripts can't access Origin Trial APIs. Page scripts can't directly communicate with React components. We needed a bridge, but bridges don't exist in isolation.

**We learned that sometimes, innovation means building the infrastructure others take for granted.**

We architected a **three-layer system**:
1. **Page Script Bridge**: Running in the page context, directly accessing Chrome's experimental AI APIs
2. **Content Script Layer**: Communicating via `window.postMessage`, orchestrating requests and responses
3. **React UI Layer**: Beautiful, intuitive interfaces that users actually want to interact with

Each layer had to work perfectly with the others. One missed message source, one incorrect ID, and the entire system would fail silently. We debugged for days, learning that **communication protocols aren't just code—they're promises between systems.**

### The Language Challenge: When "Supported" Means "Limited"

Chrome's AI APIs support three languages: English, Spanish, and Japanese. But our users speak **dozens** of languages. We had to build a fallback system that gracefully degraded, always finding a way to help, even when the "perfect" solution wasn't available.

We learned that **accessibility isn't about perfection—it's about inclusion**. When an API doesn't support a language, we don't give up. We try the Prompt API instead. When voice recognition fails, we don't abandon the feature—we improve it. When content extraction hits a wall, we make the wall higher.

### The Extraction Challenge: When "Visible" Isn't Enough

Initially, we extracted content from `<main>` or `<article>` tags. But real websites don't follow rules. Content lives in `<div>`s, hidden behind JavaScript, scattered across the DOM. **We learned that making content accessible means understanding that "accessible" content isn't always where we expect it.**

We rebuilt our extraction to:
- Traverse the entire `document.body`
- Filter out hidden elements (display: none, visibility: hidden)
- Deduplicate repetitive text
- Preserve structure (headings, paragraphs, lists)
- Handle pages with 50,000+ characters of content
- Intelligently truncate when necessary

**The challenge wasn't technical—it was philosophical. What does "visible" mean? What does "content" mean? Who decides what matters?**

### The Voice Challenge: When Speech Becomes Interface

Voice control wasn't just a feature—it was a **statement**. We wanted to prove that accessibility isn't a checkbox. It's a fundamental shift in how humans interact with machines.

We integrated Web Speech API for speech-to-text, allowing users to ask questions naturally. But more importantly, we added text-to-speech so that **responses could be heard, not just read**. The user could close their eyes, busy their hands, focus elsewhere—and still receive information.

We learned that **true accessibility doesn't ask users to adapt to the interface. It adapts the interface to the user.**

### The Eye Control Challenge: When Movement Becomes Interaction

But we didn't stop at voice. We asked: **What about users who can't use their hands at all?**

We integrated **TrackyMouse**, a head-tracking library that turns head movements into mouse control. But integration wasn't straightforward:

**The Problem**: Chrome extensions run in isolated contexts. TrackyMouse needed to run in the page context to access the camera. Web Workers couldn't load from `chrome-extension://` URLs. Content Security Policy blocked inline scripts. Functions couldn't be sent via `postMessage`.

**The Solution**: We built another bridge. We created a bridge script that:
- Loads TrackyMouse into the page context (bypassing extension isolation)
- Creates Blob URLs for Workers (bypassing cross-origin restrictions)
- Monkey-patches the Worker constructor (replacing extension URLs with Blob URLs)
- Fixes `importScripts` paths (making relative URLs absolute)
- Handles click callbacks in the page context (avoiding DataCloneError)

**The Result**: A minimal, elegant interface. Just a small circular video bubble in the bottom-right corner. No bulky controls. No UI clutter. Move your head, control the cursor. Hover over buttons, they click automatically (dwell clicking). Get near the screen edge, the page scrolls automatically.

**We learned that true accessibility means removing barriers we didn't even know existed.**

## What We Built: A Tool That Makes the Invisible, Visible

### Quick Ask AI: The Invisible Helper

Select text. A subtle widget appears. Five buttons: **Ask**, **Summarize**, **Simplify**, **Translate**, **Camera**. 

- **Ask**: Opens a chat interface. Ask anything about the selected text. The AI understands context, speaks the page's language, responds intelligently. Responses are rendered in beautiful markdown with syntax highlighting, code blocks, lists, and proper formatting.
- **Summarize**: Condenses long text into digestible summaries. Perfect for cognitive overload, time constraints, or simply scanning.
- **Simplify**: Rewrites complex language into simple, clear text. For learning disabilities, language barriers, or anyone who prefers clarity.
- **Translate**: Instantly translates content. Automatically detects source language, responds in user's preferred language.
- **Voice Control**: Speak your question. Hear the response. Hands-free, eyes-free, barrier-free.
- **Camera (Eye Control)**: Enables head-tracking mouse control. A small circular video feed appears in the bottom-right corner. Move your head to control the cursor. Hover to click (dwell clicking). Move near screen edges to auto-scroll. Completely hands-free navigation.

#### UI Innovation: Draggable, Adaptable, Accessible

The response dialog isn't just functional—it's **thoughtful**:
- **Draggable**: Sometimes the dialog covers what you need to see. Grab the header, drag it anywhere. The dialog stays within viewport bounds, never getting lost off-screen.
- **Markdown Rendering**: AI responses aren't plain text. They're properly formatted with headings, code blocks, lists, emphasis, and links. Code gets syntax highlighting. Technical responses become readable.
- **Persistent Chat History**: Ask follow-up questions. The AI remembers context. Build a conversation, not just isolated queries.

### The Technical Achievement

We're not just using AI APIs—we're **pioneering their integration** in Chrome extensions. We documented everything, built reusable patterns, solved problems that others will face. This isn't just a project—**it's a foundation for the future of accessible web applications.**

## The Challenges We Faced: When Problems Became Teachers

### Challenge 1: Origin Trial Tokens and Timing

**The Problem**: Chrome's AI APIs require Origin Trial tokens injected into the page `<head>`. But Chrome extensions inject content scripts **after** pages load. The token existed, but the API didn't activate.

**The Learning**: Sometimes, infrastructure matters more than features. We had to understand the **timing** of web page lifecycles, browser APIs, and extension injection points. We learned that **being first isn't always enough—you have to be first at the right moment.**

### Challenge 2: Message Passing Hell

**The Problem**: Three layers communicating via `window.postMessage`. Requests and responses had to match perfectly. One typo in `source` ("ai-content-script" vs "ai-page-script"), and silence.

**The Learning**: We built a debugging system that logged every message, tracked every ID, visualized the communication flow. We learned that **transparency isn't a feature—it's a necessity for complex systems.**

### Challenge 3: Streaming Responses

**The Problem**: AI responses stream in chunks. We had to accumulate, deduplicate, and update the UI in real-time—all while handling errors, timeouts, and edge cases.

**The Learning**: Async generators, `for await` loops, promise queues. We didn't just solve streaming—**we mastered it**. We learned that **complexity isn't the enemy—it's the teacher.**

### Challenge 4: Page Content Extraction at Scale

**The Problem**: A simple `textContent` call on `document.body` returns everything—scripts, hidden elements, navigation menus, ads. Real content is buried.

**The Learning**: We built a TreeWalker-based extraction system that understands the DOM structure, respects visibility, preserves context, and handles massive pages. We learned that **parsing isn't extraction—understanding is extraction.**

### Challenge 5: TrackyMouse and the Isolated World Problem

**The Problem**: TrackyMouse is a third-party library that expects to run in the page's global context with camera access and Web Workers. But Chrome extensions run in isolated contexts. Content scripts can't access the page's `window.TrackyMouse`. Workers can't load from `chrome-extension://` URLs. CSP blocks inline scripts. The `postMessage` API can't clone functions.

**The Learning**: We built a complete bridge architecture:
- Created a dedicated bridge script (`tracky-mouse-bridge.js`) that runs in page context
- Fetched Worker code as text, injected it as Blob URLs to bypass cross-origin restrictions
- Monkey-patched the `Worker` constructor to intercept and replace extension URLs
- Fixed `importScripts` relative paths by replacing them with absolute URLs
- Moved click callbacks into the bridge script to avoid DataCloneError
- Implemented auto-scroll by monitoring pointer position and triggering smooth scrolling near screen edges
- Added intelligent edge detection (20px threshold) with dynamic scroll speed (100-150px/s based on proximity)

**We learned that sometimes you have to rewrite the rules to make the impossible possible.**

### Challenge 6: Markdown Rendering and User Experience

**The Problem**: AI responses often include markdown formatting—code blocks, lists, headings, emphasis. Displaying them as plain text loses all structure and readability.

**The Learning**: We integrated `react-markdown` with custom Tailwind-styled components for every element. Code blocks get monospace fonts and background. Lists get proper indentation. Headings get hierarchy. Links get proper styling. The result: AI responses that are as beautiful as they are functional.

**We learned that accessibility isn't just about making things work—it's about making them delightful.**

## What We Learned: Beyond Code

### Accessibility is Universal

We started thinking about "disabled users." We ended thinking about **all users**. The matrix showed us that we're all temporarily or situationally disabled. A parent. A driver. A tired reader. A language learner. **Accessibility isn't charity—it's empathy.**

### AI is a Bridge, Not a Replacement

We didn't build this to replace human understanding. We built it to **augment** it. AI simplifies, summarizes, translates—but humans still make the decisions, ask the questions, create the meaning. **Technology should amplify humanity, not replace it.**

### Complexity is Invisible, Simplicity is Visible

Users see five buttons and a circular camera bubble. They don't see:
- Three-layer architecture for AI API integration
- Two-layer bridge for TrackyMouse integration
- Message passing protocols with source verification
- Origin Trial token management and timing
- Streaming response handling with async generators
- Content extraction algorithms with TreeWalker traversal
- Language detection and mapping with 75+ language support
- Fallback systems and error handling at every layer
- Blob URL creation for Workers
- Worker constructor monkey-patching
- `importScripts` path rewriting
- Click callback handling in page context
- Auto-scroll with edge detection and dynamic speed
- Markdown rendering with custom styled components
- Drag-and-drop with viewport clamping
- Dwell clicking with configurable targets

**The best engineering is invisible. The best accessibility is seamless.**

### Documentation is Empathy

We documented everything—not for ourselves, but for others. Future developers. Future users. Future accessibility advocates. **Sharing knowledge isn't optional—it's a responsibility.**

## The Impact: More Than an Extension

This isn't just a Chrome extension. It's a **statement**:

- That accessibility matters, always
- That technology should adapt to humans, not the reverse
- That "disabled" is a word we should retire
- That AI can be a force for inclusion, not exclusion
- That complexity can be beautiful when it serves simplicity
- That **hands-free doesn't mean helpless**
- That **barriers exist to be broken**
- That **we can all win when we design for everyone**

### Real Impact: Who This Helps

This extension isn't theoretical. It helps real people:

- **Motor Disabilities**: Quadriplegia, cerebral palsy, ALS, muscular dystrophy—anyone with limited hand mobility can now browse the web using only head movements.
- **Temporary Injuries**: Broken arms, carpal tunnel surgery, RSI—situations we all might face.
- **Situational Constraints**: Holding a baby, carrying groceries, eating lunch—moments when hands aren't free.
- **Cognitive Challenges**: ADHD, dyslexia, autism—when text simplification and summarization become necessary, not nice-to-have.
- **Language Barriers**: Non-native speakers, travelers, immigrants—when translation becomes access.
- **Visual Fatigue**: Long reading sessions, late-night research—when text-to-speech becomes relief.

**Every feature solves a real problem for real people.**

## The Future: Where We're Going

We see a web where:
- Every page can be simplified, summarized, translated, and queried
- Voice control isn't a feature—it's a standard
- AI doesn't replace human connection—it facilitates it
- Accessibility isn't a section in a design doc—it's the foundation

We're building toward a future where **"I can't use this"** becomes **"How can I make this work for me?"**

And that future starts now.

---

## Technical Stack

- **Frontend**: React + TypeScript + Tailwind CSS
- **Chrome Extension**: Manifest V3, Content Scripts, Page Scripts
- **AI APIs**: Chrome Built-in AI (LanguageModel, Summarizer, Translator, Rewriter)
- **Speech**: Web Speech API (Speech Recognition + Speech Synthesis)
- **Eye Control**: TrackyMouse (head tracking + dwell clicking)
- **Markdown**: react-markdown with custom Tailwind components
- **Architecture**: 
  - 3-layer message passing system for AI integration
  - 2-layer bridge system for TrackyMouse integration
  - Blob URL creation for Workers
  - Worker constructor monkey-patching
- **Build**: Vite + Turborepo + pnpm
- **Language**: TypeScript with strict typing
- **Advanced Features**:
  - Streaming responses with async generators
  - Drag-and-drop with viewport clamping
  - Auto-scroll with edge detection
  - Content Security Policy compliance
  - Cross-origin Worker loading

---

*Built with ❤️ for everyone, everywhere, always.*

