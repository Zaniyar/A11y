# Chrome Built-in AI Prompt API Integration Guide

This document explains how the Prompt API (LanguageModel) is integrated into this Chrome extension. Use this as a reference to fix similar integrations in other projects.

## Architecture Overview

The integration follows a **3-layer architecture** because Chrome extensions run content scripts in an **isolated world** that cannot directly access Origin Trial APIs:

```
┌─────────────────────────────────────────────────────────────┐
│  Page Context (ai-page-bridge.js)                            │
│  - Has access to LanguageModel API                            │
│  - Listens to window.postMessage                              │
│  - Calls self.LanguageModel.create() and promptStreaming()    │
└─────────────────────────────────────────────────────────────┘
                          ↕ window.postMessage
┌─────────────────────────────────────────────────────────────┐
│  Content Script (ai-services.ts)                              │
│  - Cannot access LanguageModel API directly                   │
│  - Sends messages via window.postMessage                       │
│  - Handles streaming responses                                │
└─────────────────────────────────────────────────────────────┘
                          ↕ Props/State
┌─────────────────────────────────────────────────────────────┐
│  React Component (App.tsx)                                    │
│  - UI layer                                                   │
│  - Calls ai-services functions                                │
│  - Displays streaming responses                               │
└─────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. Page Script Bridge (`chrome-extension/public/ai-page-bridge.js`)

**Purpose**: Runs in the page's context where it CAN access `self.LanguageModel`.

**Key Features**:
- Checks API availability: `'LanguageModel' in self && typeof self.LanguageModel?.create === 'function'`
- Creates sessions and stores them in a Map
- Listens to `window.postMessage` events from content script
- Calls the actual Chrome API: `self.LanguageModel.create()` and `session.promptStreaming()`
- Streams responses back via `window.postMessage`

**Important Code**:
```javascript
// Check if API exists
const checkAPI = name => {
  try {
    return name in self && typeof self[name]?.create === 'function';
  } catch {
    return false;
  }
};

// Create LanguageModel session
const session = await self.LanguageModel.create({
  temperature: params.temperature ?? defaultTemperature,
  topK: params.topK ?? defaultTopK,
  initialPrompts: params.initialPrompts ?? [],
});

// Stream prompt response
const stream = params.outputLanguage
  ? await session.promptStreaming(params.prompt, { outputLanguage: params.outputLanguage })
  : await session.promptStreaming(params.prompt);

for await (const chunk of stream) {
  window.postMessage({
    source: 'ai-page-script',
    id,
    type: 'stream-chunk',
    chunk: newChunk, // Only send the NEW part of the chunk
  }, '*');
}
```

### 2. Script Injection (`pages/content-ui/src/matches/all/inject-page-script.ts`)

**Purpose**: Injects the page script bridge into the page context.

**Critical Points**:
- Must use an **external script file** (not inline code) to avoid CSP (Content Security Policy) issues
- Must use `chrome.runtime.getURL()` to get the extension URL
- Should check if already injected to avoid duplicates

**Code**:
```typescript
export const injectPageScript = () => {
  if (document.querySelector('script[data-ai-bridge="true"]')) {
    return; // Already injected
  }

  const script = document.createElement('script');
  script.setAttribute('data-ai-bridge', 'true');
  script.src = chrome.runtime.getURL('ai-page-bridge.js'); // External file!

  (document.head || document.documentElement).appendChild(script);
};
```

### 3. Message Passing (`pages/content-ui/src/matches/all/ai-services.ts`)

**Purpose**: Content script layer that communicates with the page script via `window.postMessage`.

**Key Functions**:

#### `sendMessageToPageScript<T>(method, params)`
- Sends a one-time message and waits for response
- Uses unique IDs to match request/response
- Has 30-second timeout
- Listens to `window.postMessage` events

#### `sendStreamingMessageToPageScript(method, params)`
- Handles streaming responses
- Uses async generator to yield chunks as they arrive
- Manages promise-based chunk queue

**Code Pattern**:
```typescript
const sendMessageToPageScript = <T = unknown>(method: string, params: MessageParams = {}): Promise<T> =>
  new Promise((resolve, reject) => {
    const id = ++messageIdCounter;

    const handleResponse = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (!event.data || event.data.source !== 'ai-page-script') return;
      if (event.data.id !== id) return; // Match request ID

      window.removeEventListener('message', handleResponse);

      if (event.data.type === 'error') {
        reject(new Error(event.data.error));
      } else if (event.data.type === 'response') {
        resolve(event.data.result);
      }
    };

    window.addEventListener('message', handleResponse);

    // Send request
    window.postMessage({
      source: 'ai-content-script', // Must match!
      id,
      method,
      params,
    }, '*');

    // Timeout
    setTimeout(() => {
      window.removeEventListener('message', handleResponse);
      reject(new Error('Request timeout'));
    }, 30000);
  });
```

### 4. Prompt Function (`streamPromptResponse`)

**Purpose**: High-level function to stream prompt responses.

**Steps**:
1. Get language (from options or page)
2. Create LanguageModel session via `createLanguageModel()`
3. Stream prompt via `sendStreamingMessageToPageScript('promptStreaming', ...)`
4. Clean up session after streaming completes

**Code**:
```typescript
export const streamPromptResponse = async function* (
  prompt: string,
  systemPrompt?: string,
  options?: { temperature?: number; topK?: number; outputLanguage?: string },
): AsyncGenerator<string, void, unknown> {
  try {
    const requestedLang = options?.outputLanguage || getPageLanguage();
    const outputLang = getSupportedLanguageModelLanguage(requestedLang);

    // Create session (sends message to page script)
    const { sessionId } = await createLanguageModel({
      temperature: options?.temperature,
      topK: options?.topK,
      initialPrompts: systemPrompt ? [{ role: 'system', content: systemPrompt }] : [],
    });

    // Stream response (sends message to page script)
    yield* sendStreamingMessageToPageScript('promptStreaming', {
      sessionId,
      prompt,
      outputLanguage: outputLang,
    });

    // Cleanup
    await sendMessageToPageScript('destroySession', { sessionId });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Prompt API error: ${errorMessage}`);
  }
};
```

## Communication Protocol

### Message Format

**Content Script → Page Script**:
```javascript
{
  source: 'ai-content-script',  // Must match!
  id: 123,                       // Unique ID for this request
  method: 'promptStreaming',     // Method name
  params: {
    sessionId: 1,
    prompt: '...',
    outputLanguage: 'en'
  }
}
```

**Page Script → Content Script (Stream Chunk)**:
```javascript
{
  source: 'ai-page-script',      // Must match!
  id: 123,                       // Same ID as request
  type: 'stream-chunk',          // or 'stream-end', 'response', 'error'
  chunk: 'text chunk...'
}
```

### Message Types

1. **`response`**: One-time response (e.g., session creation)
2. **`stream-chunk`**: Streaming text chunk
3. **`stream-end`**: Streaming completed
4. **`error`**: Error occurred

## Origin Trial Token

**Required**: The Origin Trial token must be injected into the page's `<head>` for the API to be available.

```typescript
const ORIGIN_TRIAL_TOKEN = 'your-token-here';

useEffect(() => {
  if (ORIGIN_TRIAL_TOKEN && !document.querySelector('meta[http-equiv="origin-trial"]')) {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'origin-trial';
    meta.content = ORIGIN_TRIAL_TOKEN;
    document.head.appendChild(meta);
  }
}, []);
```

## Common Issues & Solutions

### Issue 1: API Not Available

**Symptoms**: `hasLanguageModel: false`

**Solutions**:
- Ensure Origin Trial token is injected before checking availability
- Wait for token to activate (may require page reload)
- Check if page is in secure context: `window.isSecureContext === true`
- Verify token is valid and not expired

**Debug**:
```javascript
console.log({
  tokenPresent: !!document.querySelector('meta[http-equiv="origin-trial"]'),
  secureContext: window.isSecureContext,
  apiExists: 'LanguageModel' in self,
  canCreate: typeof self.LanguageModel?.create === 'function'
});
```

### Issue 2: Messages Not Received

**Symptoms**: Timeout errors, no responses

**Solutions**:
- Ensure `source` matches exactly: `'ai-content-script'` vs `'ai-page-script'`
- Check that page script is injected and listening
- Verify `event.source === window` check in both directions
- Check browser console for errors in page script

### Issue 3: Streaming Not Working

**Symptoms**: Only first chunk received, or no chunks

**Solutions**:
- Ensure you're using `for await` to iterate async generator
- Check that page script sends `stream-chunk` events correctly
- Verify chunk deduplication logic (only send new parts)
- Make sure `stream-end` event is sent when done

### Issue 4: CSP (Content Security Policy) Errors

**Symptoms**: Script injection blocked

**Solutions**:
- Use external script file, NOT inline code
- Use `chrome.runtime.getURL()` for script src
- Add script to `web_accessible_resources` in manifest.json

**manifest.json** (or manifest.ts):
```json
{
  "web_accessible_resources": [
    {
      "resources": ["*.js", "*.css", "*.svg", "icon-128.png", "icon-34.png"],
      "matches": ["*://*/*"]
    }
  ]
}
```

**Note**: The `*.js` pattern includes `ai-page-bridge.js`. Make sure your script file is in the `public` folder (or wherever your extension's public files are).

### Issue 5: Session Not Found

**Symptoms**: "Session not found" error

**Solutions**:
- Ensure session is created before calling `promptStreaming`
- Store sessions in a Map with unique IDs
- Don't destroy session before streaming completes
- Handle cleanup properly after streaming ends

## Complete Flow Example

```typescript
// 1. Inject page script (do this once on component mount)
useEffect(() => {
  injectPageScript();
}, []);

// 2. Check availability
const support = await checkAISupport();
// Returns: { hasLanguageModel: true, ... }

// 3. Stream a prompt
async function askQuestion(prompt: string) {
  let fullResponse = '';
  
  for await (const chunk of streamPromptResponse(prompt, undefined, {
    outputLanguage: 'en',
  })) {
    fullResponse += chunk;
    console.log('Chunk:', chunk);
    // Update UI with fullResponse
  }
  
  console.log('Complete response:', fullResponse);
}
```

## Debugging Checklist

- [ ] Origin Trial token is injected in page `<head>`
- [ ] Page script bridge is injected (`script[data-ai-bridge="true"]` exists)
- [ ] API is available: `'LanguageModel' in self && typeof self.LanguageModel?.create === 'function'`
- [ ] Page is in secure context (`window.isSecureContext === true`)
- [ ] Messages have matching `source` values
- [ ] Message IDs match between request and response
- [ ] Streaming uses `for await` pattern
- [ ] Session is created before calling `promptStreaming`
- [ ] Session is cleaned up after streaming completes
- [ ] Script is in `web_accessible_resources` in manifest

## Testing

**Quick Test**:
```typescript
// In browser console (page context):
await self.LanguageModel.create().then(session => {
  return session.promptStreaming('Hello, world!');
}).then(async stream => {
  for await (const chunk of stream) {
    console.log(chunk);
  }
});
```

If this works, the API is available. If not, check token and secure context.

---

## Summary

The key insight: **Chrome content scripts cannot directly access Origin Trial APIs**. You must:

1. Inject a script into the page context (external file, not inline)
2. Use `window.postMessage` for communication
3. Create sessions in the page script, use them from content script
4. Handle streaming with async generators
5. Always include Origin Trial token
6. Match message sources exactly (`'ai-content-script'` vs `'ai-page-script'`)

If your integration isn't working, check each of these steps methodically.

