import {
  checkAISupport,
  streamPromptResponse,
  summarizeText,
  simplifyText,
  translateText,
  getPageContext,
} from './ai-services';
import { injectPageScript } from './inject-page-script';
import { useEffect, useState, useRef, useCallback } from 'react';

// Origin Trial Token for Chrome Built-in AI
const ORIGIN_TRIAL_TOKEN =
  'Avx1/iJQWBB3vPOqqyBcVBTk1L7svMNhUNQEtdn5W3/wPH7ss0bRMgPmcqd17btwBiVNM/jQhTRqa7d/41G0vwQAAABueyJvcmlnaW4iOiJodHRwczovL3poYXcuY2g6NDQzIiwiZmVhdHVyZSI6IkFJUHJvbXB0QVBJTXVsdGltb2RhbElucHV0IiwiZXhwaXJ5IjoxNzc0MzEwNDAwLCJpc1N1YmRvbWFpbiI6dHJ1ZX0=';

type ActionType = 'ask' | 'summarize' | 'simplify' | 'translate';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function App() {
  const [selectedText, setSelectedText] = useState<string>('');
  const [showUI, setShowUI] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string>('');
  const [activeAction, setActiveAction] = useState<ActionType | null>(null);
  const [error, setError] = useState<string>('');
  const [aiSupport, setAISupport] = useState<{
    hasLanguageModel: boolean;
    hasSummarizer: boolean;
    hasWriter: boolean;
    hasRewriter: boolean;
    hasTranslator: boolean;
    hasLanguageDetector: boolean;
  } | null>(null);
  const [showResponse, setShowResponse] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<string>('en');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [followUpInput, setFollowUpInput] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Inject Origin Trial token if not already present
    if (ORIGIN_TRIAL_TOKEN && !document.querySelector('meta[http-equiv="origin-trial"]')) {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'origin-trial';
      meta.content = ORIGIN_TRIAL_TOKEN;
      document.head.appendChild(meta);
      console.log('[A11y Extension] Origin Trial token injected');
    }

    // Inject page script to access AI APIs from page context
    injectPageScript();

    // Check AI support - now async since it communicates with page script
    const checkSupport = async () => {
      try {
        const support = await checkAISupport();
        setAISupport(support);

        // Log detailed diagnostics
        console.log('[A11y Extension] AI Support check:', {
          hasLanguageModel: support.hasLanguageModel,
          hasSummarizer: support.hasSummarizer,
          hasRewriter: support.hasRewriter,
          hasTranslator: support.hasTranslator,
          tokenPresent: !!document.querySelector('meta[http-equiv="origin-trial"]'),
          secureContext: window.isSecureContext,
        });

        if (!support.hasLanguageModel && document.querySelector('meta[http-equiv="origin-trial"]')) {
          console.warn(
            '[A11y Extension] Origin Trial token is present but LanguageModel API is not available yet. The API may become available after a page reload.',
          );
        }
      } catch (error) {
        console.error('[A11y Extension] Failed to check AI support:', error);
      }
    };

    // Check immediately after a small delay to allow page script to initialize
    const timeoutId = setTimeout(() => {
      checkSupport();
    }, 200);

    // Retry after another delay in case the token just got injected
    const retryTimeoutId = setTimeout(() => {
      checkSupport();
    }, 500);

    // Handle text selection
    const handleSelection = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setShowUI(false);
        setShowResponse(false);
        return;
      }

      const text = selection.toString().trim();
      if (!text || text.length < 3) {
        setShowUI(false);
        setShowResponse(false);
        return;
      }

      setSelectedText(text);

      // Get selection position
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      });

      setShowUI(true);
      setShowResponse(false);
      setResponse('');
      setError('');
    };

    // Handle click outside to hide UI
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node) &&
        responseRef.current &&
        !responseRef.current.contains(e.target as Node)
      ) {
        setShowUI(false);
        setShowResponse(false);
        window.getSelection()?.removeAllRanges();
      }
    };

    document.addEventListener('selectionchange', handleSelection);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(retryTimeoutId);
      document.removeEventListener('selectionchange', handleSelection);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleAction = useCallback(
    async (action: ActionType) => {
      if (!selectedText || isLoading) return;
      if (action === 'translate' && !targetLanguage) return;

      setIsLoading(true);
      setActiveAction(action);
      setError('');
      setResponse('');
      setShowResponse(true);
      setShowUI(false);

      try {
        const pageContext = getPageContext();

        switch (action) {
          case 'ask': {
            // Initialize chat with the selected text context
            const initialUserMessage = `Explain this text: "${selectedText.slice(0, 200)}${selectedText.length > 200 ? '...' : ''}"`;

            setChatMessages([{ role: 'user', content: initialUserMessage }]);

            const prompt = `You are an accessibility assistant helping users understand web content. The user has selected this text on a webpage:

"${selectedText}"

Context about the page:
${pageContext}

Please provide a clear, helpful explanation or summary of what this selected text means, in plain language.`;

            let fullResponse = '';
            for await (const chunk of streamPromptResponse(prompt)) {
              fullResponse += chunk;
              setResponse(fullResponse);
            }

            // Add assistant response to chat
            setChatMessages(prev => [...prev, { role: 'assistant', content: fullResponse }]);
            break;
          }

          case 'summarize': {
            if (!aiSupport?.hasSummarizer) {
              // Fallback to Prompt API
              const prompt = `Summarize the following text in a clear, concise way:

"${selectedText}"`;

              let fullResponse = '';
              for await (const chunk of streamPromptResponse(prompt)) {
                fullResponse += chunk;
                setResponse(fullResponse);
              }
            } else {
              const summary = await summarizeText(selectedText, {
                type: 'tldr',
                format: 'plain-text',
                length: 'medium',
              });
              setResponse(summary);
            }
            break;
          }

          case 'simplify': {
            if (!aiSupport?.hasRewriter) {
              // Fallback to Prompt API
              const prompt = `Rewrite the following text in simpler, more accessible language that's easier to understand. Keep the meaning the same but use plain language:

"${selectedText}"`;

              let fullResponse = '';
              for await (const chunk of streamPromptResponse(prompt)) {
                fullResponse += chunk;
                setResponse(fullResponse);
              }
            } else {
              let fullResponse = '';
              for await (const chunk of simplifyText(selectedText, {
                tone: 'friendly',
                length: 'as-is',
                format: 'as-is',
              })) {
                fullResponse = chunk;
                setResponse(fullResponse);
              }
            }
            break;
          }

          case 'translate': {
            if (!aiSupport?.hasTranslator) {
              setError('Translator API is not available');
              break;
            }

            try {
              // Detect language and translate to target language
              const translated = await translateText(selectedText, targetLanguage);
              setResponse(translated);
            } catch (err: unknown) {
              setError(err instanceof Error ? err.message : 'Translation failed');
            }
            break;
          }
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred. Please try again.';
        setError(errorMessage);

        // Check if it's an API availability error and update support status
        if (errorMessage.includes('not available') || errorMessage.includes('not supported')) {
          checkAISupport().then(support => setAISupport(support));
        }
      } finally {
        setIsLoading(false);
      }
    },
    [selectedText, isLoading, aiSupport, targetLanguage],
  );

  const handleCopy = useCallback(async () => {
    if (!response) return;
    try {
      await navigator.clipboard.writeText(response);
      // Show temporary feedback
      const button = document.querySelector('[data-copy-button]') as HTMLButtonElement;
      if (button) {
        const originalText = button.textContent;
        button.textContent = 'Copied!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    } catch {
      setError('Failed to copy to clipboard');
    }
  }, [response]);

  const handleClose = useCallback(() => {
    setShowResponse(false);
    setResponse('');
    setError('');
    setActiveAction(null);
    setChatMessages([]);
    setFollowUpInput('');
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleFollowUpQuestion = useCallback(async () => {
    if (!followUpInput.trim() || isLoading) return;

    const question = followUpInput.trim();
    setFollowUpInput('');

    // Add user message to chat
    setChatMessages(prev => [...prev, { role: 'user', content: question }]);

    setIsLoading(true);
    setError('');

    try {
      const pageContext = getPageContext();
      const prompt = `You are an accessibility assistant helping users understand web content.

Selected text from the webpage:
"${selectedText}"

Context about the page:
${pageContext}

Previous conversation:
${chatMessages.map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`).join('\n\n')}

User's follow-up question: ${question}

Please provide a helpful answer that considers the selected text, page context, and previous conversation.`;

      let fullResponse = '';
      for await (const chunk of streamPromptResponse(prompt)) {
        fullResponse += chunk;
        setResponse(fullResponse);
      }

      // Add assistant response to chat
      setChatMessages(prev => [...prev, { role: 'assistant', content: fullResponse }]);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [followUpInput, selectedText, chatMessages, isLoading]);

  // Scroll to bottom when new messages are added
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, response]);

  // Calculate response box position
  const responsePosition = showResponse
    ? {
        top: `${Math.min(position.y + 40, window.innerHeight - 400)}px`,
        left: `${Math.min(Math.max(position.x - 200, 20), window.innerWidth - 420)}px`,
      }
    : {};

  return (
    <>
      {/* Quick Ask UI - appears on text selection */}
      {showUI && !showResponse && (
        <div
          ref={containerRef}
          className="quick-ask-ui fixed z-[999999] flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
          style={{
            left: `${Math.min(Math.max(position.x - 150, 20), window.innerWidth - 320)}px`,
            top: `${Math.max(position.y - 50, 10)}px`,
          }}
          role="toolbar"
          aria-label="Quick Ask Actions">
          <button
            onClick={() => handleAction('ask')}
            disabled={isLoading}
            className="rounded px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50"
            title="Ask about this text">
            Ask
          </button>
          <button
            onClick={() => handleAction('summarize')}
            disabled={isLoading || !aiSupport?.hasSummarizer}
            className="rounded px-3 py-1.5 text-sm font-medium text-purple-600 transition-colors hover:bg-purple-50 disabled:opacity-50"
            title="Summarize this text">
            Summarize
          </button>
          <button
            onClick={() => handleAction('simplify')}
            disabled={isLoading || !aiSupport?.hasRewriter}
            className="rounded px-3 py-1.5 text-sm font-medium text-green-600 transition-colors hover:bg-green-50 disabled:opacity-50"
            title="Simplify this text">
            Simplify
          </button>
          <button
            onClick={() => handleAction('translate')}
            disabled={isLoading || !aiSupport?.hasTranslator}
            className="rounded px-3 py-1.5 text-sm font-medium text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-50"
            title="Translate this text">
            Translate
          </button>
        </div>
      )}

      {/* Response UI - shows AI response */}
      {showResponse && (
        <div
          ref={responseRef}
          className="fixed z-[999998] flex max-h-[500px] w-96 max-w-[calc(100vw-40px)] flex-col rounded-lg border border-gray-200 bg-white shadow-xl"
          style={responsePosition}
          role="dialog"
          aria-label="AI Response">
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-lg border-b border-gray-200 bg-gray-50 p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-700">
                {activeAction === 'ask' && '💬 Quick Ask'}
                {activeAction === 'summarize' && '📝 Summary'}
                {activeAction === 'simplify' && '✨ Simplified'}
                {activeAction === 'translate' && '🌐 Translation'}
              </span>
              {activeAction === 'translate' && (
                <select
                  value={targetLanguage}
                  onChange={e => setTargetLanguage(e.target.value)}
                  className="rounded border border-gray-300 px-2 py-1 text-xs"
                  disabled={isLoading}>
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                  <option value="zh">Chinese</option>
                  <option value="ja">Japanese</option>
                  <option value="ko">Korean</option>
                </select>
              )}
            </div>
            <button
              onClick={handleClose}
              className="text-gray-400 transition-colors hover:text-gray-600"
              aria-label="Close">
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {error && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Chat mode for "Ask" action */}
            {activeAction === 'ask' && chatMessages.length > 0 ? (
              <div className="space-y-3">
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg p-3 ${
                      msg.role === 'user'
                        ? 'ml-8 border border-blue-200 bg-blue-50'
                        : 'mr-8 border border-gray-200 bg-gray-50'
                    }`}>
                    <div className="mb-1 text-xs font-semibold text-gray-500">
                      {msg.role === 'user' ? 'You' : 'AI Assistant'}
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{msg.content}</div>
                  </div>
                ))}

                {/* Show streaming response if loading */}
                {isLoading && response && (
                  <div className="mr-8 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-1 text-xs font-semibold text-gray-500">AI Assistant</div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{response}</div>
                  </div>
                )}

                {/* Show loading indicator */}
                {isLoading && !response && (
                  <div className="mr-8 rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center gap-2 text-gray-500">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            ) : (
              <>
                {/* Non-chat mode (Summarize, Simplify, Translate) */}
                {isLoading && !response && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"></div>
                    <span className="text-sm">Generating response...</span>
                  </div>
                )}

                {response && (
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{response}</div>
                  </div>
                )}

                {!isLoading && !response && !error && <p className="text-sm text-gray-500">No response yet...</p>}
              </>
            )}
          </div>

          {/* Footer */}
          {(response || error || chatMessages.length > 0) && (
            <div className="border-t border-gray-200 bg-gray-50">
              {/* Follow-up input for "Ask" action */}
              {activeAction === 'ask' && chatMessages.length > 0 && (
                <div className="border-b border-gray-200 p-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={followUpInput}
                      onChange={e => setFollowUpInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleFollowUpQuestion();
                        }
                      }}
                      placeholder="Ask a follow-up question..."
                      disabled={isLoading}
                      className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <button
                      onClick={handleFollowUpQuestion}
                      disabled={!followUpInput.trim() || isLoading}
                      className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                      Send
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Press Enter to send</p>
                </div>
              )}

              {/* Copy and attribution */}
              <div className="flex items-center justify-between p-3">
                <button
                  onClick={handleCopy}
                  disabled={!response}
                  data-copy-button
                  className="rounded px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50">
                  Copy
                </button>
                <p className="text-xs text-gray-400">Powered by Chrome Built-in AI</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Only show error when actually trying to use the API, not upfront */}
    </>
  );
}
