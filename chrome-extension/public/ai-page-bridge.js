/* eslint-env browser */
/**
 * AI Page Bridge - Runs in page context to access Chrome Built-in AI APIs
 * Communicates with content script via window.postMessage
 */
(function () {
  console.log('[AI Bridge] Initializing in page context...');

  // Helper to check if API is available
  const checkAPI = name => {
    try {
      return name in self && typeof self[name]?.create === 'function';
    } catch {
      return false;
    }
  };

  // Check what's available
  const availability = {
    LanguageModel: checkAPI('LanguageModel'),
    Summarizer: checkAPI('Summarizer'),
    Writer: checkAPI('Writer'),
    Rewriter: checkAPI('Rewriter'),
    Translator: checkAPI('Translator'),
    LanguageDetector: checkAPI('LanguageDetector'),
  };

  console.log('[AI Bridge] API availability:', availability);

  // Store active sessions
  const sessions = new Map();
  let sessionIdCounter = 0;

  // Message handler
  window.addEventListener('message', async event => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== 'ai-content-script') return;

    const { id, method, params } = event.data;

    try {
      let result;

      switch (method) {
        case 'checkAvailability':
          result = availability;
          break;

        case 'createLanguageModel': {
          if (!availability.LanguageModel) {
            throw new Error('LanguageModel API not available');
          }

          const { defaultTopK = 3, defaultTemperature = 1.0 } =
            typeof self.LanguageModel.params === 'function'
              ? await self.LanguageModel.params()
              : { defaultTopK: 3, defaultTemperature: 1.0 };

          const session = await self.LanguageModel.create({
            temperature: params.temperature ?? defaultTemperature,
            topK: params.topK ?? defaultTopK,
            initialPrompts: params.initialPrompts ?? [],
          });

          const sessionId = ++sessionIdCounter;
          sessions.set(sessionId, session);
          result = { sessionId };
          break;
        }

        case 'promptStreaming': {
          const session = sessions.get(params.sessionId);
          if (!session) {
            throw new Error('Session not found');
          }

          const stream = await session.promptStreaming(params.prompt);
          let previousChunk = '';

          for await (const chunk of stream) {
            const newChunk = chunk.startsWith(previousChunk) ? chunk.slice(previousChunk.length) : chunk;

            window.postMessage(
              {
                source: 'ai-page-script',
                id,
                type: 'stream-chunk',
                chunk: newChunk,
              },
              '*',
            );

            previousChunk = chunk;
          }

          window.postMessage(
            {
              source: 'ai-page-script',
              id,
              type: 'stream-end',
            },
            '*',
          );

          return; // Don't send regular response
        }

        case 'destroySession': {
          const session = sessions.get(params.sessionId);
          if (session) {
            session.destroy();
            sessions.delete(params.sessionId);
          }
          result = { success: true };
          break;
        }

        case 'summarize': {
          if (!availability.Summarizer) {
            throw new Error('Summarizer API not available');
          }

          const summarizer = await self.Summarizer.create({
            type: params.type ?? 'tldr',
            format: params.format ?? 'plain-text',
            length: params.length ?? 'medium',
            outputLanguage: params.outputLanguage ?? 'en',
          });

          result = await summarizer.summarize(params.text);
          summarizer.destroy();
          break;
        }

        case 'rewriteStreaming': {
          if (!availability.Rewriter) {
            throw new Error('Rewriter API not available');
          }

          const rewriter = await self.Rewriter.create({
            tone: params.tone ?? 'friendly',
            length: params.length ?? 'as-is',
            format: params.format ?? 'as-is',
          });

          const stream = await rewriter.rewriteStreaming(params.text);

          for await (const chunk of stream) {
            window.postMessage(
              {
                source: 'ai-page-script',
                id,
                type: 'stream-chunk',
                chunk: chunk,
              },
              '*',
            );
          }

          rewriter.destroy();

          window.postMessage(
            {
              source: 'ai-page-script',
              id,
              type: 'stream-end',
            },
            '*',
          );

          return; // Don't send regular response
        }

        case 'detectLanguage': {
          if (!availability.LanguageDetector) {
            throw new Error('LanguageDetector API not available');
          }

          const detector = await self.LanguageDetector.create();
          const detections = await detector.detect(params.text);
          result = detections[0];
          break;
        }

        case 'translate': {
          if (!availability.Translator) {
            throw new Error('Translator API not available');
          }

          const translator = await self.Translator.create({
            sourceLanguage: params.sourceLanguage,
            targetLanguage: params.targetLanguage,
          });

          result = await translator.translate(params.text);
          translator.destroy();
          break;
        }

        default:
          throw new Error(`Unknown method: ${method}`);
      }

      // Send success response
      window.postMessage(
        {
          source: 'ai-page-script',
          id,
          type: 'response',
          result,
        },
        '*',
      );
    } catch (error) {
      // Send error response
      window.postMessage(
        {
          source: 'ai-page-script',
          id,
          type: 'error',
          error: error.message,
        },
        '*',
      );
    }
  });

  console.log('[AI Bridge] Ready to receive messages');
})();
