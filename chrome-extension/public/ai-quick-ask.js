/* eslint-env browser */
(() => {
  // ---------------------- CONFIG ----------------------
  const ORIGIN_TRIAL_TOKEN =
    'Avx1/iJQWBB3vPOqqyBcVBTk1L7svMNhUNQEtdn5W3/wPH7ss0bRMgPmcqd17btwBiVNM/jQhTRqa7d/41G0vwQAAABueyJvcmlnaW4iOiJodHRwczovL3poYXcuY2g6NDQzIiwiZmVhdHVyZSI6IkFJUHJvbXB0QVBJTXVsdGltb2RhbElucHV0IiwiZXhwaXJ5IjoxNzc0MzEwNDAwLCJpc1N1YmRvbWFpbiI6dHJ1ZX0=';
  const SYSTEM_PROMPT =
    "You are a helpful accessibility assistant integrated into web pages. When answering questions, consider both the user's selected text and the broader context of the webpage (title, content, structure). Keep answers brief (≤4 sentences), accurate, and grounded in the provided context. If information is missing, clearly state what is needed.";

  const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

  // ----------------- CLEAN UP PRIOR RUN ----------------
  if (window.__aiQuickAsk?.destroy) window.__aiQuickAsk.destroy();

  // --------------- DETECT PAGE LANGUAGE ----------------
  function getPageLanguage() {
    const htmlLang = document.documentElement.lang;
    const metaLang = document.querySelector('meta[http-equiv="content-language"]')?.content;
    const metaLang2 = document.querySelector('meta[name="language"]')?.content;
    return htmlLang || metaLang || metaLang2 || 'en';
  }

  const PAGE_LANG = getPageLanguage();

  // Short, safe preview of selection for UI elements
  function selectionPreviewText(text, max = 120) {
    if (!text) return 'Selection';
    const compact = String(text).replace(/\s+/g, ' ').trim();
    if (compact.length <= max) return compact;
    return compact.slice(0, max) + '…';
  }

  // --------------- ORIGIN-TRIAL INJECTION -------------
  function decodeTokenInfo(tok) {
    try {
      const tail = tok.split('.').pop();
      const raw = atob(tail);
      const origin = /"origin"\s*:\s*"([^"]+)"/.exec(raw)?.[1] || 'unknown';
      const feature = /"feature"\s*:\s*"([^"]+)"/.exec(raw)?.[1] || 'unknown';
      const exp = /"expiry"\s*:\s*(\d+)/.exec(raw)?.[1];
      return { origin, feature, expiry: exp ? new Date(+exp).toISOString() : 'unknown' };
    } catch {
      return null;
    }
  }

  const tokenInfo = decodeTokenInfo(ORIGIN_TRIAL_TOKEN);
  const here = location.origin;
  const tokenMatches = tokenInfo?.origin ? tokenInfo.origin.replace(':443', '') === here : false;

  if (ORIGIN_TRIAL_TOKEN && !document.querySelector('meta[http-equiv="origin-trial"]')) {
    const m = document.createElement('meta');
    m.httpEquiv = 'origin-trial';
    m.content = ORIGIN_TRIAL_TOKEN;
    document.head.appendChild(m);
  }

  // ----------------- DIAGNOSTICS UI -------------------
  const diag = document.createElement('div');
  Object.assign(diag.style, {
    position: 'fixed',
    right: '12px',
    bottom: '12px',
    zIndex: '2147483646',
    background: '#0f1116',
    color: '#eaecef',
    padding: '10px 12px',
    border: '1px solid #2a2d33',
    borderRadius: '10px',
    font: '12px/1.4 system-ui',
    boxShadow: '0 12px 30px rgba(0,0,0,.35)',
    maxWidth: '360px',
    pointerEvents: 'auto',
  });

  // Create a container for log messages to avoid innerHTML issues
  const logContainer = document.createElement('div');
  diag.appendChild(logContainer);

  const log = (...a) => {
    const entry = document.createElement('div');
    entry.innerHTML = a.join(' ');
    logContainer.appendChild(entry);
  };

  const title = document.createElement('div');
  title.innerHTML = `<b>AI Quick Ask · Diagnostics</b>`;
  logContainer.appendChild(title);

  log(`Origin: <code>${here}</code>`);
  log(`Page language: <code>${PAGE_LANG}</code>`);
  if (tokenInfo) {
    log(`Token origin: <code>${tokenInfo.origin}</code>`);
    log(`Feature: <code>${tokenInfo.feature}</code>`);
    log(`Expiry: ${tokenInfo.expiry}`);
    if (!tokenMatches) log(`⚠️ Token origin ≠ this page. Use a token for <code>${here}</code>.`);
  } else {
    log(`ℹ️ Couldn't parse token metadata (ok if signature-hardened).`);
  }
  log(`Secure context: ${isSecureContext ? '✅' : '❌'} (must be HTTPS)`);
  log(`LanguageModel in window: ${'LanguageModel' in self ? '✅' : '❌'}`);

  if (!tokenMatches) {
    log(
      `👉 Fix: run this on the correct origin (e.g., <code>https://zhaw.ch</code>), or generate a token for this origin.`,
    );
  }
  if (!('LanguageModel' in self)) {
    log(`👉 After injecting an Origin-Trial meta, <b>reload the page</b> so Chrome applies it.`);
    log(`👉 Ensure Chrome has the Prompt API enabled (Settings → Experimental AI / Early Preview).`);
  }

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  Object.assign(closeBtn.style, {
    marginTop: '8px',
    background: 'cyan',
    color: '#fff',
    border: '0',
    borderRadius: '6px',
    padding: '6px 10px',
    cursor: 'pointer',
    width: '100%',
    pointerEvents: 'auto',
  });

  // Use addEventListener with proper event handling
  closeBtn.addEventListener(
    'click',
    e => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      diag.remove();
    },
    true,
  ); // Use capture phase to fire early

  closeBtn.addEventListener(
    'pointerdown',
    e => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      diag.remove();
    },
    true,
  );

  diag.appendChild(closeBtn);

  document.body.appendChild(diag);

  // --------------- CORE WIDGET ---------------
  const STATE = { session: null, selectionText: '', rect: null, streamAbort: null };

  // Shadow UI
  const host = document.createElement('div');
  host.style.all = 'initial';
  host.style.position = 'fixed';
  host.style.inset = '0';
  host.style.pointerEvents = 'none';
  host.style.zIndex = '2147483647';
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });

  const css = document.createElement('style');
  css.textContent = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    .btn {
      position: fixed;
      display: none;
      pointer-events: auto;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 0;
      background: rgba(44, 126, 248, 0.95);
      color: #fff;
      font-size: 18px;
      transform: translate(-50%, -100%);
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
      cursor: pointer;
      transition: transform 0.15s ease, background 0.15s ease;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
    
    .btn:hover {
      background: rgba(44, 126, 248, 1);
      transform: translate(-50%, -100%) scale(1.08);
    }
    
    .chat {
      position: fixed;
      display: none;
      pointer-events: auto;
      min-width: 320px;
      width: min(520px, calc(100vw - 20px));
      max-width: min(520px, calc(100vw - 20px));
      max-height: 60vh;
      background: rgba(16, 17, 20, 0.95);
      color: #eaecef;
      border: 1px solid #2a2d33;
      border-radius: 12px;
      box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
      overflow: hidden;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, Cantarell, Arial, sans-serif;
      font-size: 13px;
      line-height: 1.45;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }
    
    .chat.visible {
      display: grid;
      grid-template-rows: auto 1fr auto;
    }
    
    .hdr {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 10px 12px;
      background: linear-gradient(180deg, #15171c, #101114);
      border-bottom: 1px solid #2a2d33;
    }
    
    .pill {
      font-size: 11px;
      color: #a6adbb;
      background: #1a1d24;
      padding: 3px 8px;
      border-radius: 999px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
      min-width: 0;
    }
    
    .close {
      margin-left: auto;
      background: transparent;
      border: 0;
      color: #a6adbb;
      cursor: pointer;
      font-size: 16px;
      padding: 4px;
      flex-shrink: 0;
    }
    
    .close:hover {
      color: #fff;
    }
    
    .msgs {
      padding: 12px;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 0;
    }
    
    .msg {
      border-radius: 8px;
      padding: 9px 11px;
      word-wrap: break-word;
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    
    .user {
      background: #2c7ef8;
      color: #fff;
      align-self: flex-end;
      max-width: 82%;
    }
    
    .assistant {
      background: #0c0d10;
      border: 1px solid #2a2d33;
      color: #eaecef;
      align-self: flex-start;
      max-width: 92%;
    }
    
    .assistant a {
      color: #58a6ff;
      text-decoration: none;
    }
    
    .assistant a:hover {
      text-decoration: underline;
    }
    
    .assistant code {
      background: #1a1d24;
      padding: 2px 4px;
      border-radius: 3px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      font-size: 12px;
    }
    
    .assistant pre {
      background: #1a1d24;
      border: 1px solid #2a2d33;
      padding: 10px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 4px 0;
    }
    
    .assistant pre code {
      background: none;
      padding: 0;
    }
    
    .assistant p {
      margin: 0;
    }
    
    .assistant p + p {
      margin-top: 8px;
    }
    
    .input {
      border-top: 1px solid #2a2d33;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    
    .ta {
      resize: none;
      width: 100%;
      min-height: 56px;
      max-height: 140px;
      color: #eaecef;
      background: #0c0d10;
      border: 1px solid #2a2d33;
      border-radius: 8px;
      padding: 8px 10px;
      outline: none;
      font-family: inherit;
      font-size: 13px;
      line-height: 1.45;
    }
    
    .ta:focus {
      border-color: #2c7ef8;
    }
    
    .row {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      min-width: 0;
    }
    
    .ask {
      background: #2c7ef8;
      color: #fff;
      border: 0;
      border-radius: 8px;
      padding: 8px 12px;
      cursor: pointer;
      font-weight: 500;
      font-size: 13px;
      transition: background 0.15s ease;
    }
    
    .ask:hover:not([disabled]) {
      background: #1e6edb;
    }
    
    .ask[disabled] {
      opacity: 0.6;
      cursor: not-allowed;
    }
    
    .action-btn {
      background: #1a1d24;
      color: #eaecef;
      border: 1px solid #2a2d33;
      border-radius: 8px;
      padding: 8px 12px;
      cursor: pointer;
      font-weight: 500;
      font-size: 12px;
      transition: background 0.15s ease, border-color 0.15s ease;
      white-space: nowrap;
    }
    
    .action-btn:hover:not([disabled]) {
      background: #25282f;
      border-color: #3a3d45;
    }
    
    .action-btn[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .hint {
      font-size: 11px;
      color: #8a93a4;
      margin-left: auto;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
    
    .spin {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(255, 255, 255, 0.25);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      vertical-align: -2px;
      margin-right: 6px;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
  shadow.appendChild(css);

  const button = document.createElement('button');
  button.className = 'btn';
  button.textContent = '🙋';
  button.title = 'Ask about selection';
  shadow.appendChild(button);

  const chat = document.createElement('div');
  chat.className = 'chat';
  chat.innerHTML = `
    <div class="hdr">
      <span class="pill" id="pill"></span>
      <button class="close" title="Close">×</button>
    </div>
    <div class="msgs" id="msgs"></div>
    <div class="input">
      <textarea class="ta" id="ta" placeholder="Ask a question about the selected text…" spellcheck="true"></textarea>
      <div class="row">
        <button class="ask" id="ask">Ask AI</button>
        <button class="action-btn" id="simplify" title="Simplify text to plain language">Simplify</button>
        <button class="action-btn" id="translate" title="Translate selection">Translate</button>
        <span class="hint">Shift+Enter → newline</span>
      </div>
    </div>
  `;
  shadow.appendChild(chat);

  const $ = {
    pill: chat.querySelector('#pill'),
    msgs: chat.querySelector('#msgs'),
    ta: chat.querySelector('#ta'),
    ask: chat.querySelector('#ask'),
    simplify: chat.querySelector('#simplify'),
    translate: chat.querySelector('#translate'),
    close: chat.querySelector('.close'),
  };

  // Safe markdown
  function mdSafe(txt) {
    const esc = s => {
      const d = document.createElement('div');
      d.textContent = s;
      return d.innerHTML;
    };
    let s = esc(String(txt ?? ''));
    s = s
      .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, l, b) => `<pre><code>${esc(b)}</code></pre>`)
      .replace(/`([^`]+?)`/g, '<code>$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(
        /\[([^\]]+?)\]\((https?:\/\/[^\s)]+)\)/g,
        `<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>`,
      )
      .replace(/\n{2,}/g, '</p><p>')
      .replace(/\n/g, '<br>');
    return `<p>${s}</p>`;
  }

  // Prompt API session or fallback
  async function getSession() {
    if (STATE.session) return STATE.session;
    if ('LanguageModel' in self && typeof self.LanguageModel?.create === 'function') {
      STATE.session = await self.LanguageModel.create({
        temperature: 0.6,
        topK: 3,
        initialPrompts: [{ role: 'system', content: SYSTEM_PROMPT }],
      });
      return STATE.session;
    }
    if (window.OPENAI_API_KEY) {
      STATE.session = {
        async prompt(content) {
          return openAICall(content);
        },
      };
      return STATE.session;
    }
    throw new Error(
      'Prompt API not available. If you just added an Origin-Trial, reload. Otherwise set window.OPENAI_API_KEY for cloud fallback.',
    );
  }

  async function openAICall(content) {
    const key = window.OPENAI_API_KEY;
    const model = window.OPENAI_MODEL || 'gpt-4.1-mini';
    const r = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content },
        ],
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || r.statusText);
    return j.choices?.[0]?.message?.content || '';
  }

  // Gather page context for richer prompts
  function getPageContext() {
    const title = document.title || '';
    const url = location.href;
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .slice(0, 10)
      .map(h => `${h.tagName.toLowerCase()}${h.id ? '#' + h.id : ''}: ${h.textContent.trim()}`)
      .join('\n');

    // Get main content areas (articles, main, or body text)
    const mainContent = document.querySelector('main, article, [role="main"]') || document.body;
    const paragraphs = Array.from(mainContent.querySelectorAll('p'))
      .slice(0, 5)
      .map(p => p.textContent.trim())
      .filter(t => t.length > 20)
      .join('\n\n');

    const metaDesc = document.querySelector('meta[name="description"]')?.content || '';

    return {
      title,
      url,
      headings: headings || '(no headings found)',
      summary: metaDesc || paragraphs.slice(0, 500) || '(no page summary available)',
      language: PAGE_LANG,
    };
  }

  async function askModel(question, selection) {
    const session = await getSession();
    const pageContext = getPageContext();

    const langNote =
      pageContext.language !== 'en'
        ? `\nNote: The page language is "${pageContext.language}". Consider responding in that language if appropriate.`
        : '';

    const prompt = `You are helping a user on this webpage:

**Page Context:**
- Title: ${pageContext.title}
- URL: ${pageContext.url}
- Language: ${pageContext.language}
- Page Structure:
${pageContext.headings}

- Page Summary:
${pageContext.summary}

**Selected Text:**
"""
${selection}
"""

**User Question:**
${question}

Provide a helpful answer that considers:
1. The selected text (primary focus)
2. The broader context of the webpage (title, content, structure)
3. How the selection relates to the overall page topic

Answer directly and concisely (≤4 sentences). If the answer requires information not in the selection or page context, say what is missing.${langNote}

Answer:`;

    const u = document.createElement('div');
    u.className = 'msg user';
    u.textContent = question;
    $.msgs.appendChild(u);

    const a = document.createElement('div');
    a.className = 'msg assistant';
    a.innerHTML = `<span class="spin"></span>Thinking…`;
    $.msgs.appendChild(a);
    $.msgs.scrollTop = $.msgs.scrollHeight;
    $.ask.disabled = true;

    try {
      if (typeof session.promptStreaming === 'function') {
        const stream = await session.promptStreaming(prompt);
        let acc = '',
          prev = '';
        for await (const chunk of stream) {
          const add = chunk.startsWith(prev) ? chunk.slice(prev.length) : chunk;
          prev = chunk;
          acc += add;
          a.innerHTML = mdSafe(acc);
          $.msgs.scrollTop = $.msgs.scrollHeight;
        }
      } else {
        const result = await session.prompt(prompt);
        a.innerHTML = mdSafe(result || 'No response.');
      }
    } catch (e) {
      a.textContent = `⚠️ ${e?.message || e}`;
    } finally {
      $.ask.disabled = false;
      $.msgs.scrollTop = $.msgs.scrollHeight;
    }
  }

  function getSelectionInfo() {
    const sel = document.getSelection?.();
    if (!sel || sel.isCollapsed) return null;
    const t = sel.toString().trim();
    if (!t) return null;
    const r = sel.getRangeAt(0).cloneRange();
    const rects = Array.from(r.getClientRects?.() || []);
    const b = rects.length ? rects[rects.length - 1] : r.getBoundingClientRect();
    if (!b || (b.width === 0 && b.height === 0)) return null;
    return {
      text: t.slice(0, 4000),
      rect: {
        top: b.top,
        left: b.left,
        right: b.right,
        bottom: b.bottom,
        width: b.width,
        height: b.height,
      },
    };
  }

  function positionButton(rect) {
    const pad = 8;
    let x = rect.left + rect.width / 2;
    let y = rect.top - pad;
    const bw = 36,
      bh = 36;
    if (y - bh < 0) y = rect.bottom + bh + pad;
    x = Math.max(bw / 2 + 6, Math.min(innerWidth - bw / 2 - 6, x));
    y = Math.max(bh + 6, Math.min(innerHeight - 6, y));
    button.style.left = `${x}px`;
    button.style.top = `${y}px`;
  }

  function showButtonForSelection() {
    const info = getSelectionInfo();
    if (!info) {
      button.style.display = 'none';
      return;
    }
    STATE.selectionText = info.text;
    STATE.rect = info.rect;
    positionButton(info.rect);
    button.style.display = 'inline-block';
  }

  function openChat() {
    if (!STATE.rect) return;
    const r = STATE.rect;
    const CHAT_W = Math.min(520, Math.max(320, Math.floor(innerWidth * 0.38)));
    const CHAT_H = Math.min(Math.max(240, Math.floor(innerHeight * 0.5)), Math.floor(innerHeight * 0.6));
    let left = r.right + 10;
    let top = r.top;
    if (left + CHAT_W > innerWidth - 10) left = Math.max(10, r.left - CHAT_W - 10);
    if (top + CHAT_H > innerHeight - 10) top = Math.max(10, innerHeight - CHAT_H - 10);
    if (top < 10) top = 10;
    chat.style.width = `${CHAT_W}px`;
    chat.style.maxHeight = `${CHAT_H}px`;
    chat.style.left = `${left}px`;
    chat.style.top = `${top}px`;
    chat.classList.add('visible');
    const pageTitle = document.title || location.hostname;
    const preview = selectionPreviewText(STATE.selectionText, 100);
    $.pill.textContent = `${pageTitle.length > 30 ? pageTitle.slice(0, 27) + '…' : pageTitle} • ${preview}`;
    $.msgs.innerHTML = '';
    $.ta.value = '';
    setTimeout(() => $.ta.focus(), 30);
  }

  function hideAll() {
    button.style.display = 'none';
    chat.classList.remove('visible');
  }

  button.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    openChat();
  });

  $.close.addEventListener('click', hideAll);

  async function simplifyText(selection) {
    const session = await getSession();
    const pageContext = getPageContext();

    const prompt = `Simplify the following text to plain language, making it easier to understand for people with cognitive disabilities or those who prefer simpler language. Keep the core meaning and important information, but use simpler words, shorter sentences, and clearer structure.

**Context:**
- Page: ${pageContext.title}
- Language: ${pageContext.language}

**Text to simplify:**
"""
${selection}
"""

Provide a simplified version that:
1. Uses simpler, everyday words
2. Uses shorter sentences (preferably under 15-20 words)
3. Is clear and direct
4. Maintains the original meaning
5. Is appropriate for an 8th-grade reading level

Simplified text:`;

    const a = document.createElement('div');
    a.className = 'msg assistant';
    a.innerHTML = `<span class="spin"></span>Simplifying…`;
    $.msgs.appendChild(a);
    $.msgs.scrollTop = $.msgs.scrollHeight;

    const userMsg = document.createElement('div');
    userMsg.className = 'msg user';
    userMsg.textContent = 'Simplify this text';
    $.msgs.insertBefore(userMsg, a);

    $.ask.disabled = true;
    $.simplify.disabled = true;
    $.translate.disabled = true;

    try {
      let result = '';
      if (typeof session.promptStreaming === 'function') {
        const stream = await session.promptStreaming(prompt);
        for await (const chunk of stream) {
          result = chunk;
          a.innerHTML = mdSafe(result);
          $.msgs.scrollTop = $.msgs.scrollHeight;
        }
      } else {
        result = await session.prompt(prompt);
        a.innerHTML = mdSafe(result || 'No response.');
      }

      // Add "Replace" button to apply the simplified text
      const replaceBtn = document.createElement('button');
      replaceBtn.textContent = 'Replace text on page';
      replaceBtn.className = 'action-btn';
      Object.assign(replaceBtn.style, { marginTop: '8px', width: '100%' });
      replaceBtn.onclick = () => {
        const sel = document.getSelection();
        if (sel && !sel.isCollapsed) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(result.trim()));
          sel.removeAllRanges();
        }
        console.log('✅ Simplified text replaced on page');
      };
      a.appendChild(replaceBtn);
    } catch (e) {
      a.textContent = `⚠️ ${e?.message || e}`;
    } finally {
      $.ask.disabled = false;
      $.simplify.disabled = false;
      $.translate.disabled = false;
      $.msgs.scrollTop = $.msgs.scrollHeight;
    }
  }

  async function translateText(selection, targetLang = 'English') {
    const session = await getSession();
    const pageContext = getPageContext();

    // If page language is not English, translate to English; otherwise translate to user's preferred language
    const defaultTarget = pageContext.language !== 'en' ? 'English' : targetLang;

    const prompt = `Translate the following text to ${defaultTarget}. Maintain the tone and meaning of the original text.

**Context:**
- Page: ${pageContext.title}
- Source language: ${pageContext.language}
- Target language: ${defaultTarget}

**Text to translate:**
"""
${selection}
"""

Provide a clear, natural translation in ${defaultTarget}:`;

    const a = document.createElement('div');
    a.className = 'msg assistant';
    a.innerHTML = `<span class="spin"></span>Translating…`;
    $.msgs.appendChild(a);
    $.msgs.scrollTop = $.msgs.scrollHeight;

    const userMsg = document.createElement('div');
    userMsg.className = 'msg user';
    userMsg.textContent = `Translate to ${defaultTarget}`;
    $.msgs.insertBefore(userMsg, a);

    $.ask.disabled = true;
    $.simplify.disabled = true;
    $.translate.disabled = true;

    try {
      let result = '';
      if (typeof session.promptStreaming === 'function') {
        const stream = await session.promptStreaming(prompt);
        for await (const chunk of stream) {
          result = chunk;
          a.innerHTML = mdSafe(result);
          $.msgs.scrollTop = $.msgs.scrollHeight;
        }
      } else {
        result = await session.prompt(prompt);
        a.innerHTML = mdSafe(result || 'No response.');
      }

      // Add "Replace" button to apply the translation
      const replaceBtn = document.createElement('button');
      replaceBtn.textContent = 'Replace text on page';
      replaceBtn.className = 'action-btn';
      Object.assign(replaceBtn.style, { marginTop: '8px', width: '100%' });
      replaceBtn.onclick = () => {
        const sel = document.getSelection();
        if (sel && !sel.isCollapsed) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(result.trim()));
          sel.removeAllRanges();
        }
        console.log('✅ Translated text replaced on page');
      };
      a.appendChild(replaceBtn);
    } catch (e) {
      a.textContent = `⚠️ ${e?.message || e}`;
    } finally {
      $.ask.disabled = false;
      $.simplify.disabled = false;
      $.translate.disabled = false;
      $.msgs.scrollTop = $.msgs.scrollHeight;
    }
  }

  $.ask.addEventListener('click', () => {
    const q = $.ta.value.trim();
    if (!q || $.ask.disabled) return;
    $.ta.value = '';
    askModel(q, STATE.selectionText);
  });

  $.simplify.addEventListener('click', () => {
    if (!STATE.selectionText || $.simplify.disabled) return;
    simplifyText(STATE.selectionText);
  });

  $.translate.addEventListener('click', () => {
    if (!STATE.selectionText || $.translate.disabled) return;
    translateText(STATE.selectionText);
  });

  $.ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      $.ask.click();
    }
  });

  document.addEventListener(
    'pointerdown',
    e => {
      const p = e.composedPath?.() || [];
      // Don't hide if click is inside shadow DOM host or diagnostics window
      if (p.includes(host) || p.includes(diag)) return;
      hideAll();
    },
    { capture: true },
  );

  let t = null;
  const onSel = () => {
    clearTimeout(t);
    t = setTimeout(showButtonForSelection, 80);
  };

  document.addEventListener('selectionchange', onSel);
  document.addEventListener('mouseup', onSel);
  document.addEventListener('keyup', onSel);

  const onSR = () => {
    if (button.style.display !== 'none' && STATE.rect) {
      const info = getSelectionInfo();
      if (info) {
        STATE.rect = info.rect;
        positionButton(info.rect);
      } else {
        button.style.display = 'none';
      }
    }
  };

  addEventListener('scroll', onSR, { passive: true });
  addEventListener('resize', onSR);

  // Export destroy
  window.__aiQuickAsk = {
    destroy() {
      try {
        document.removeEventListener('selectionchange', onSel);
        document.removeEventListener('mouseup', onSel);
        document.removeEventListener('keyup', onSel);
        removeEventListener('scroll', onSR);
        removeEventListener('resize', onSR);
      } catch {
        // Ignore errors during cleanup
      }
      try {
        STATE.session?.destroy?.();
      } catch {
        // Ignore errors during cleanup
      }
      try {
        host.remove();
      } catch {
        // Ignore errors during cleanup
      }
      try {
        diag.remove();
      } catch {
        // Ignore errors during cleanup
      }
      delete window.__aiQuickAsk;
      console.log('🧹 AI Quick Ask destroyed.');
    },
  };

  console.log(
    `✨ AI Quick Ask loaded (page language: ${PAGE_LANG}). If you just injected an Origin-Trial, reload this page, then run again. Select text to see the 🙋 button.`,
  );
})();
