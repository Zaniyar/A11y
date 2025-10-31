/**
 * Chrome Built-in AI API Service Utilities
 * Communicates with page script via postMessage to access Origin Trial APIs
 */

// Message ID counter for request/response matching
let messageIdCounter = 0;

type MessageParams = Record<string, unknown>;

/**
 * Send a message to the page script and wait for response
 */
const sendMessageToPageScript = <T = unknown>(method: string, params: MessageParams = {}): Promise<T> =>
  new Promise((resolve, reject) => {
    const id = ++messageIdCounter;

    const handleResponse = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (!event.data || event.data.source !== 'ai-page-script') return;
      if (event.data.id !== id) return;

      window.removeEventListener('message', handleResponse);

      if (event.data.type === 'error') {
        reject(new Error(event.data.error));
      } else if (event.data.type === 'response') {
        resolve(event.data.result);
      }
    };

    window.addEventListener('message', handleResponse);

    // Send message to page script
    window.postMessage(
      {
        source: 'ai-content-script',
        id,
        method,
        params,
      },
      '*',
    );

    // Timeout after 30 seconds
    setTimeout(() => {
      window.removeEventListener('message', handleResponse);
      reject(new Error('Request timeout'));
    }, 30000);
  });

/**
 * Send a message to the page script and handle streaming response
 */
const sendStreamingMessageToPageScript = async function* (
  method: string,
  params: MessageParams = {},
): AsyncGenerator<string, void, unknown> {
  const id = ++messageIdCounter;
  let resolver: ((value: IteratorResult<string>) => void) | null = null;
  let rejecter: ((error: Error) => void) | null = null;
  const chunks: string[] = [];
  let isDone = false;
  let error: Error | null = null;

  const handleResponse = (event: MessageEvent) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== 'ai-page-script') return;
    if (event.data.id !== id) return;

    if (event.data.type === 'error') {
      error = new Error(event.data.error);
      isDone = true;
      if (rejecter) rejecter(error);
    } else if (event.data.type === 'stream-chunk') {
      chunks.push(event.data.chunk);
      if (resolver) resolver({ value: event.data.chunk, done: false });
    } else if (event.data.type === 'stream-end') {
      isDone = true;
      window.removeEventListener('message', handleResponse);
      if (resolver) resolver({ value: '', done: true });
    }
  };

  window.addEventListener('message', handleResponse);

  // Send message to page script
  window.postMessage(
    {
      source: 'ai-content-script',
      id,
      method,
      params,
    },
    '*',
  );

  // Yield chunks as they arrive
  try {
    while (!isDone) {
      if (error) throw error;

      if (chunks.length > 0) {
        yield chunks.shift()!;
      } else {
        // Wait for next chunk
        await new Promise<void>((resolve, reject) => {
          resolver = result => {
            resolver = null;
            if (result.done) {
              resolve();
            } else {
              resolve();
            }
          };
          rejecter = err => {
            rejecter = null;
            reject(err);
          };
        });
      }
    }

    // Yield any remaining chunks
    while (chunks.length > 0) {
      yield chunks.shift()!;
    }
  } finally {
    window.removeEventListener('message', handleResponse);
  }
};

/**
 * Check if Chrome Built-in AI APIs are available
 */
export const checkAISupport = async () => {
  try {
    const availability = await sendMessageToPageScript<{
      LanguageModel: boolean;
      Summarizer: boolean;
      Writer: boolean;
      Rewriter: boolean;
      Translator: boolean;
      LanguageDetector: boolean;
    }>('checkAvailability');

    return {
      hasLanguageModel: availability.LanguageModel,
      hasSummarizer: availability.Summarizer,
      hasWriter: availability.Writer,
      hasRewriter: availability.Rewriter,
      hasTranslator: availability.Translator,
      hasLanguageDetector: availability.LanguageDetector,
    };
  } catch (error) {
    console.error('[A11y Extension] Failed to check AI availability:', error);
    return {
      hasLanguageModel: false,
      hasSummarizer: false,
      hasWriter: false,
      hasRewriter: false,
      hasTranslator: false,
      hasLanguageDetector: false,
    };
  }
};

/**
 * Create a LanguageModel session for Prompt API
 */
export const createLanguageModel = async (options?: {
  temperature?: number;
  topK?: number;
  initialPrompts?: Array<{ role: string; content: string }>;
}): Promise<{ sessionId: number }> => sendMessageToPageScript('createLanguageModel', options || {});

/**
 * Stream prompt response using Prompt API
 */
export const streamPromptResponse = async function* (
  prompt: string,
  systemPrompt?: string,
  options?: { temperature?: number; topK?: number },
): AsyncGenerator<string, void, unknown> {
  try {
    const { sessionId } = await createLanguageModel({
      temperature: options?.temperature,
      topK: options?.topK,
      initialPrompts: systemPrompt ? [{ role: 'system', content: systemPrompt }] : [],
    });

    yield* sendStreamingMessageToPageScript('promptStreaming', {
      sessionId,
      prompt,
    });

    // Cleanup session after streaming is done
    await sendMessageToPageScript('destroySession', { sessionId });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Prompt API error: ${errorMessage}`);
  }
};

/**
 * Summarize text using Summarizer API
 */
export const summarizeText = async (
  text: string,
  options?: {
    type?: 'tldr' | 'explain' | 'define';
    format?: 'plain-text' | 'bullets' | 'steps';
    length?: 'short' | 'medium' | 'long';
    outputLanguage?: string;
  },
): Promise<string> => {
  // Get page language or default to English
  const pageLang = document.documentElement.lang || 'en';
  const outputLang = options?.outputLanguage || (['en', 'es', 'ja'].includes(pageLang) ? pageLang : 'en');

  return sendMessageToPageScript('summarize', {
    text,
    type: options?.type ?? 'tldr',
    format: options?.format ?? 'plain-text',
    length: options?.length ?? 'medium',
    outputLanguage: outputLang,
  });
};

/**
 * Simplify/rewrite text using Rewriter API
 */
export const simplifyText = async function* (
  text: string,
  options?: {
    tone?: 'professional' | 'casual' | 'friendly' | 'as-is';
    length?: 'shorter' | 'longer' | 'as-is';
    format?: 'paragraph' | 'bullets' | 'steps' | 'as-is';
  },
): AsyncGenerator<string, void, unknown> {
  yield* sendStreamingMessageToPageScript('rewriteStreaming', {
    text,
    tone: options?.tone ?? 'friendly',
    length: options?.length ?? 'as-is',
    format: options?.format ?? 'as-is',
  });
};

/**
 * Detect language of text
 */
export const detectLanguage = async (
  text: string,
): Promise<{
  detectedLanguage: string;
  confidence: number;
}> => sendMessageToPageScript('detectLanguage', { text: text.trim() });

/**
 * Translate text using Translator API
 */
export const translateText = async (text: string, targetLanguage: string, sourceLanguage?: string): Promise<string> => {
  try {
    // Auto-detect source language if not provided
    let detectedSourceLanguage = sourceLanguage;
    if (!detectedSourceLanguage) {
      const detection = await detectLanguage(text);
      detectedSourceLanguage = detection.detectedLanguage;
    }

    if (!detectedSourceLanguage) {
      throw new Error('Could not detect source language');
    }

    return await sendMessageToPageScript('translate', {
      text,
      sourceLanguage: detectedSourceLanguage,
      targetLanguage,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Translator error: ${errorMessage}`);
  }
};

/**
 * Get page language from HTML lang attribute
 */
export const getPageLanguage = (): string => {
  // Try documentElement.lang first (most common)
  const lang = document.documentElement.lang || document.documentElement.getAttribute('lang');

  if (lang) {
    // Extract just the language code (e.g., "en" from "en-US")
    return lang.split('-')[0].toLowerCase();
  }

  // Fallback to meta tag
  const metaLang =
    document.querySelector('meta[http-equiv="content-language"]')?.getAttribute('content') ||
    document.querySelector('meta[property="og:locale"]')?.getAttribute('content');

  if (metaLang) {
    return metaLang.split('-')[0].toLowerCase();
  }

  // Default to English
  return 'en';
};

/**
 * Get page context (for AI prompts)
 */
export const getPageContext = (): string => {
  const title = document.title;
  const url = window.location.href;
  const language = getPageLanguage();
  const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
    .slice(0, 5)
    .map(h => h.textContent?.trim())
    .filter(Boolean)
    .join(' | ');

  return `Page: ${title}\nURL: ${url}\nLanguage: ${language}\nMain headings: ${headings || 'N/A'}`;
};

export interface AIResponse {
  text: string;
  error?: string;
}
