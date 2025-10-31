import {
  checkAISupport,
  streamPromptResponse,
  summarizeText,
  simplifyText,
  translateText,
  getPageContext,
  getPageLanguage,
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

// Helper function to get language name from language code
const getLanguageName = (langCode: string): string => {
  const languageNames: Record<string, string> = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    ru: 'Russian',
    ar: 'Arabic',
    hi: 'Hindi',
    nl: 'Dutch',
    pl: 'Polish',
    sv: 'Swedish',
    da: 'Danish',
    fi: 'Finnish',
    no: 'Norwegian',
    tr: 'Turkish',
    cs: 'Czech',
    el: 'Greek',
    he: 'Hebrew',
    th: 'Thai',
    vi: 'Vietnamese',
    id: 'Indonesian',
    ms: 'Malay',
    uk: 'Ukrainian',
    ro: 'Romanian',
    hu: 'Hungarian',
  };

  return languageNames[langCode.toLowerCase()] || langCode.toUpperCase();
};

// Extend Window interface for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
    SpeechSynthesis: typeof SpeechSynthesis;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    abort(): void;
    onstart: ((this: SpeechRecognition, ev: Event) => unknown) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => unknown) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => unknown) | null;
    onend: ((this: SpeechRecognition, ev: Event) => unknown) | null;
  }

  interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message: string;
  }

  interface SpeechRecognitionResultList {
    length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
    isFinal: boolean;
  }

  interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
  }

  interface SpeechSynthesisErrorEvent extends Event {
    error: string;
  }
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
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const showResponseRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesis | null>(null);

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
        // Only hide the quick action buttons if response popup is not showing
        // Don't close the response popup - let users interact with it
        setShowUI(false);
        return;
      }

      const text = selection.toString().trim();
      if (!text || text.length < 3) {
        // Only hide the quick action buttons if response popup is not showing
        setShowUI(false);
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

      // Only show quick action buttons if response popup is not showing
      // If response popup is open, don't show quick actions (user is interacting with response)
      if (!showResponseRef.current) {
        setShowUI(true);
        setResponse('');
        setError('');
      }
    };

    // Handle click outside to hide only the quick action buttons, not the response popup
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;

      // Don't close if clicking inside the response popup
      if (responseRef.current?.contains(target)) {
        return; // User is interacting with the response popup
      }

      // Don't close if clicking inside the quick action buttons
      if (containerRef.current?.contains(target)) {
        return; // User is clicking the action buttons
      }

      // Check if there's an active text selection - if so, don't hide the widget
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
        const selectedText = selection.toString().trim();
        if (selectedText.length >= 3) {
          // There's a valid selection, don't hide the widget
          return;
        }
      }

      // Only hide the quick action buttons if there's no active selection
      // and response popup is not showing
      if (!showResponseRef.current) {
        setShowUI(false);
      }
      // Don't close the response popup - let users interact with it
      // Never call setShowResponse(false) here
    };

    document.addEventListener('selectionchange', handleSelection);

    // Store the click handler reference for cleanup
    // Use mousedown but with a delay to allow selection to complete first
    const clickOutsideHandler = (e: MouseEvent) => {
      // Use a small delay to allow selectionchange to fire first
      setTimeout(() => {
        handleClickOutside(e);
      }, 10);
    };

    document.addEventListener('mousedown', clickOutsideHandler);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(retryTimeoutId);
      document.removeEventListener('selectionchange', handleSelection);
      document.removeEventListener('mousedown', clickOutsideHandler);
    };
  }, []);

  const handleAction = useCallback(
    async (action: ActionType, e?: React.MouseEvent) => {
      // Prevent event propagation to avoid triggering click-outside handlers
      if (e) {
        e.preventDefault();
        e.stopPropagation();
        // stopImmediatePropagation may not be available on all event types
        if (typeof e.stopImmediatePropagation === 'function') {
          e.stopImmediatePropagation();
        }
        // Also try native event if available
        if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
          e.nativeEvent.stopImmediatePropagation();
        }
      }

      if (!selectedText || isLoading) return;
      if (action === 'translate' && !targetLanguage) return;

      // For "Ask" action, just show the UI and wait for user's question
      if (action === 'ask') {
        console.log('[A11y Extension] Ask button clicked, showing chat popup');
        setActiveAction(action);
        setError('');
        setResponse('');
        setShowResponse(true);
        setShowUI(false);
        setChatMessages([]); // Start fresh
        setFollowUpInput(''); // Clear any previous input
        // Update ref immediately so click-outside handler knows popup is open
        showResponseRef.current = true;
        console.log('[A11y Extension] Chat popup state set, showResponse:', true);
        return; // Don't send prompt yet, wait for user to type question
      }

      setIsLoading(true);
      setActiveAction(action);
      setError('');
      setResponse('');
      setShowResponse(true);
      setShowUI(false);

      try {
        switch (action) {
          case 'summarize': {
            const pageLanguage = getPageLanguage();
            const languageName = getLanguageName(pageLanguage);

            if (!aiSupport?.hasSummarizer) {
              // Fallback to Prompt API
              const prompt = `Summarize the following text in a clear, concise way.

Text to summarize:
"${selectedText}"

IMPORTANT: The page language is ${languageName} (${pageLanguage}). Please provide the summary in ${languageName}.`;

              let fullResponse = '';
              for await (const chunk of streamPromptResponse(prompt, undefined, {
                outputLanguage: pageLanguage,
              })) {
                fullResponse += chunk;
                setResponse(fullResponse);
              }
            } else {
              try {
                const summary = await summarizeText(selectedText, {
                  type: 'tldr',
                  format: 'plain-text',
                  length: 'medium',
                  outputLanguage: pageLanguage,
                });
                setResponse(summary);
              } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                // If Summarizer API fails due to language, fallback to Prompt API
                if (errorMessage.includes('language') || errorMessage.includes('not supported')) {
                  console.warn('[A11y Extension] Summarizer API language not supported, using Prompt API fallback');
                  const prompt = `Summarize the following text in a clear, concise way.

Text to summarize:
"${selectedText}"

IMPORTANT: The page language is ${languageName} (${pageLanguage}). Please provide the summary in ${languageName}.`;

                  let fullResponse = '';
                  for await (const chunk of streamPromptResponse(prompt, undefined, {
                    outputLanguage: pageLanguage,
                  })) {
                    fullResponse += chunk;
                    setResponse(fullResponse);
                  }
                } else {
                  throw err;
                }
              }
            }
            break;
          }

          case 'simplify': {
            const pageLanguage = getPageLanguage();
            const languageName = getLanguageName(pageLanguage);

            if (!aiSupport?.hasRewriter) {
              // Fallback to Prompt API
              const prompt = `Rewrite the following text in simpler, more accessible language that's easier to understand. Keep the meaning the same but use plain language.

Text to simplify:
"${selectedText}"

IMPORTANT: The page language is ${languageName} (${pageLanguage}). Please provide the simplified text in ${languageName}.`;

              let fullResponse = '';
              for await (const chunk of streamPromptResponse(prompt, undefined, {
                outputLanguage: pageLanguage,
              })) {
                fullResponse += chunk;
                setResponse(fullResponse);
              }
            } else {
              try {
                let fullResponse = '';
                for await (const chunk of simplifyText(selectedText, {
                  tone: 'friendly',
                  length: 'as-is',
                  format: 'as-is',
                })) {
                  fullResponse += chunk; // Accumulate chunks, don't overwrite
                  setResponse(fullResponse);
                }
              } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                // If Rewriter API fails, fallback to Prompt API
                console.warn('[A11y Extension] Rewriter API failed, using Prompt API fallback:', errorMessage);
                const prompt = `Rewrite the following text in simpler, more accessible language that's easier to understand. Keep the meaning the same but use plain language.

Text to simplify:
"${selectedText}"

IMPORTANT: The page language is ${languageName} (${pageLanguage}). Please provide the simplified text in ${languageName}.`;

                let fullResponse = '';
                for await (const chunk of streamPromptResponse(prompt, undefined, {
                  outputLanguage: pageLanguage,
                })) {
                  fullResponse += chunk;
                  setResponse(fullResponse);
                }
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
    // Copy the last assistant message or the streaming response
    const textToCopy = response || chatMessages.filter(msg => msg.role === 'assistant').pop()?.content || '';
    if (!textToCopy) return;

    try {
      await navigator.clipboard.writeText(textToCopy);
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
  }, [response, chatMessages]);

  const handleClose = useCallback(() => {
    setShowResponse(false);
    setResponse('');
    setError('');
    setActiveAction(null);
    setChatMessages([]);
    setFollowUpInput('');
    window.getSelection()?.removeAllRanges();
    // Stop any ongoing speech recognition or synthesis
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsListening(false);
    }
    if (synthesisRef.current) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  /**
   * Extract all visible text from the page
   */
  const extractPageContent = useCallback((): string => {
    // Start from body to get ALL visible content, not just main/article
    const rootElement = document.body;

    // Get all visible text nodes from the entire page
    const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, {
      acceptNode: (node: Node) => {
        // Skip script and style elements
        if (node.parentElement?.tagName === 'SCRIPT' || node.parentElement?.tagName === 'STYLE') {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip hidden elements
        const parent = node.parentElement;
        if (parent) {
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip common non-content elements
          const tagName = parent.tagName.toLowerCase();
          const role = parent.getAttribute('role');
          const className = parent.className || '';

          if (
            tagName === 'nav' ||
            tagName === 'header' ||
            tagName === 'footer' ||
            role === 'navigation' ||
            role === 'banner' ||
            role === 'contentinfo' ||
            role === 'complementary' ||
            className.includes('navigation') ||
            className.includes('menu') ||
            className.includes('sidebar') ||
            className.includes('ad') ||
            className.includes('advertisement') ||
            className.includes('cookie') ||
            className.includes('popup') ||
            className.includes('modal')
          ) {
            // But still include if it's visible and has meaningful content
            const text = node.textContent?.trim();
            if (!text || text.length < 3) {
              return NodeFilter.FILTER_REJECT;
            }
            // Allow navigation if it contains substantial content
            if (text.length > 20) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_REJECT;
          }
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const textNodes: string[] = [];
    const seenText = new Set<string>(); // Avoid duplicates
    let node;

    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim();

      // Only include meaningful text (at least 3 characters, no pure whitespace)
      if (text && text.length >= 3 && /\S/.test(text)) {
        // Skip duplicate text
        const normalizedText = text.toLowerCase().slice(0, 50); // Use first 50 chars as key
        if (!seenText.has(normalizedText)) {
          seenText.add(normalizedText);

          // Get parent element to preserve context
          const parent = node.parentElement;
          if (parent) {
            const tagName = parent.tagName.toLowerCase();
            const context =
              tagName === 'h1' ||
              tagName === 'h2' ||
              tagName === 'h3' ||
              tagName === 'h4' ||
              tagName === 'h5' ||
              tagName === 'h6'
                ? `\n## ${text}\n`
                : tagName === 'p' || tagName === 'li'
                  ? `${text}\n`
                  : tagName === 'strong' || tagName === 'b'
                    ? `**${text}** `
                    : `${text} `;

            textNodes.push(context);
          } else {
            textNodes.push(`${text} `);
          }
        }
      }
    }

    // Combine all text with proper spacing
    let fullText = textNodes.join(' ').replace(/\s+/g, ' ').replace(/\n\s+/g, '\n').trim();

    // Log extraction for debugging
    console.log('[A11y Extension] Extracted page content:', {
      totalLength: fullText.length,
      characterCount: fullText.length,
      wordCount: fullText.split(/\s+/).length,
      preview: fullText.slice(0, 200) + '...',
    });

    // For very long pages, we might need to chunk, but let's increase the limit significantly
    // Most LLMs can handle 50k+ characters in context
    // Limit to 50000 characters (approximately 10k words) to ensure we don't hit token limits
    // This should capture most pages while still being reasonable
    const MAX_LENGTH = 50000;

    if (fullText.length > MAX_LENGTH) {
      console.warn(
        `[A11y Extension] Page content is very long (${fullText.length} chars), truncating to ${MAX_LENGTH} chars`,
      );
      // Prioritize: keep beginning and end (often most relevant)
      const firstPart = fullText.slice(0, MAX_LENGTH * 0.6); // First 60%
      const lastPart = fullText.slice(-MAX_LENGTH * 0.4); // Last 40%
      fullText = firstPart + '\n\n[... content truncated ...]\n\n' + lastPart;
    }

    return fullText;
  }, []);

  /**
   * Speak text using Web Speech API
   */
  const speakText = useCallback((text: string) => {
    if (!text.trim()) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const pageLanguage = getPageLanguage();
    utterance.lang = pageLanguage;
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      console.log('[A11y Extension] Speech synthesis started');
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      console.log('[A11y Extension] Speech synthesis ended');
    };

    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      setIsSpeaking(false);
      console.error('[A11y Extension] Speech synthesis error:', event.error);
      setError(`Speech synthesis error: ${event.error}`);
    };

    synthesisRef.current = window.speechSynthesis;
    window.speechSynthesis.speak(utterance);
  }, []);

  /**
   * Handle voice question - extract page content and send to LLM
   */
  const handleVoiceQuestion = useCallback(
    async (question: string) => {
      if (!question.trim() || isLoading) return;

      setIsLoading(true);
      setError('');
      setResponse('');
      setShowResponse(true);
      setShowUI(false);
      setActiveAction('ask');
      setChatMessages([]);

      try {
        // Extract all visible page content
        const pageContent = extractPageContent();
        const pageContext = getPageContext();
        const pageLanguage = getPageLanguage();
        const languageName = getLanguageName(pageLanguage);

        console.log('[A11y Extension] Extracted page content:', {
          length: pageContent.length,
          wordCount: pageContent.split(/\s+/).length,
          preview: pageContent.slice(0, 300) + '...',
        });

        // Log the full content being sent (for debugging - can be removed in production)
        console.log('[A11y Extension] Full page content being sent to LLM:', pageContent);

        // Build prompt with page content - make it clear this is ALL visible content
        const prompt = `You are an accessibility assistant helping users understand web content through voice interaction.

The user is asking a question about a webpage. I have extracted ALL the visible text content from the webpage for you. Please read through it carefully to find the answer.

Here is the complete visible content from the webpage:

${pageContent}

Additional context about the page:
${pageContext}

User's voice question: ${question}

IMPORTANT: 
- The page language is ${languageName} (${pageLanguage}). Please respond in ${languageName}.
- The content above contains ALL visible text from the page. Please search through it carefully to find the answer.
- If you find the answer, provide a clear, concise response (2-3 sentences maximum for voice output).
- If the information is not in the content above, clearly state "I could not find this information on the page."
- Be specific and mention where you found the information if relevant (e.g., "According to the page content..." or "The page mentions...").`;

        let fullResponse = '';
        for await (const chunk of streamPromptResponse(prompt, undefined, {
          outputLanguage: pageLanguage,
        })) {
          fullResponse += chunk;
          setResponse(fullResponse);
        }

        // Speak the response using text-to-speech
        if (fullResponse.trim()) {
          speakText(fullResponse);
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred. Please try again.';
        setError(errorMessage);
        console.error('[A11y Extension] Voice question error:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, extractPageContent, speakText],
  );

  /**
   * Handle voice control - start listening for user question
   */
  const handleVoiceControl = useCallback(() => {
    if (isListening) {
      // Stop listening
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
        setIsListening(false);
      }
      return;
    }

    // Check if Speech Recognition is available
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError('Speech Recognition is not supported in this browser');
      return;
    }

    // Initialize speech recognition
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = getPageLanguage();

    setIsListening(true);
    setError('');

    recognition.onstart = () => {
      console.log('[A11y Extension] Speech recognition started');
    };

    recognition.onresult = async (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      console.log('[A11y Extension] Recognized speech:', transcript);

      setIsListening(false);
      recognitionRef.current = null;

      // Process the voice question
      await handleVoiceQuestion(transcript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('[A11y Extension] Speech recognition error:', event.error);
      setIsListening(false);
      recognitionRef.current = null;

      if (event.error === 'no-speech') {
        setError('No speech detected. Please try again.');
      } else if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access.');
      } else {
        setError(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening, handleVoiceQuestion]);

  const handleSendQuestion = useCallback(async () => {
    if (!followUpInput.trim() || isLoading) return;

    const question = followUpInput.trim();
    setFollowUpInput('');

    // Add user message to chat
    setChatMessages(prev => [...prev, { role: 'user', content: question }]);

    setIsLoading(true);
    setError('');

    try {
      const pageContext = getPageContext();
      const pageLanguage = getPageLanguage();
      const languageName = getLanguageName(pageLanguage);

      // Build prompt with selected text context
      // Only include previous messages (excluding the current question which we'll add separately)
      const previousMessages = chatMessages
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n\n');

      const prompt = `You are an accessibility assistant helping users understand web content.

The user has selected this text on a webpage:
"${selectedText}"

Context about the page:
${pageContext}
${previousMessages ? `\nPrevious conversation:\n${previousMessages}\n\n` : ''}User's question: ${question}

IMPORTANT: The page language is ${languageName} (${pageLanguage}). Please respond in ${languageName} unless the user explicitly asks you to respond in a different language.

Please provide a helpful answer that considers the selected text and page context.`;

      let fullResponse = '';
      for await (const chunk of streamPromptResponse(prompt, undefined, {
        outputLanguage: pageLanguage,
      })) {
        fullResponse += chunk;
        setResponse(fullResponse);
      }

      // Add assistant response to chat
      setChatMessages(prev => [...prev, { role: 'assistant', content: fullResponse }]);
      setResponse(''); // Clear streaming response as it's now in chatMessages
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [followUpInput, selectedText, chatMessages, isLoading]);

  // Update ref when showResponse changes
  useEffect(() => {
    showResponseRef.current = showResponse;
  }, [showResponse]);

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
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              // stopImmediatePropagation may not be available on all event types
              if (typeof e.stopImmediatePropagation === 'function') {
                e.stopImmediatePropagation();
              }
              // Also try native event if available
              if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
                e.nativeEvent.stopImmediatePropagation();
              }
              handleAction('ask', e);
            }}
            onMouseDown={e => {
              // Prevent mousedown from clearing selection or interfering
              e.preventDefault();
              e.stopPropagation();
            }}
            disabled={isLoading}
            className="rounded px-3 py-1.5 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50"
            title="Ask about this text">
            Ask
          </button>
          <button
            onClick={e => handleAction('summarize', e)}
            disabled={isLoading}
            className="rounded px-3 py-1.5 text-sm font-medium text-purple-600 transition-colors hover:bg-purple-50 disabled:opacity-50"
            title="Summarize this text (uses Prompt API if Summarizer not available)">
            Summarize
          </button>
          <button
            onClick={e => handleAction('simplify', e)}
            disabled={isLoading}
            className="rounded px-3 py-1.5 text-sm font-medium text-green-600 transition-colors hover:bg-green-50 disabled:opacity-50"
            title="Simplify this text (uses Prompt API if Rewriter not available)">
            Simplify
          </button>
          <button
            onClick={e => handleAction('translate', e)}
            disabled={isLoading || !aiSupport?.hasTranslator}
            className="rounded px-3 py-1.5 text-sm font-medium text-orange-600 transition-colors hover:bg-orange-50 disabled:opacity-50"
            title="Translate this text">
            Translate
          </button>
          <button
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              if (typeof e.stopImmediatePropagation === 'function') {
                e.stopImmediatePropagation();
              }
              if (e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function') {
                e.nativeEvent.stopImmediatePropagation();
              }
              handleVoiceControl();
            }}
            disabled={isLoading || isSpeaking}
            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
              isListening
                ? 'animate-pulse bg-red-600 text-white hover:bg-red-700'
                : 'text-indigo-600 hover:bg-indigo-50'
            }`}
            title={isListening ? 'Listening... Click to stop' : 'Voice control - Ask questions about the page'}>
            {isListening ? '🎤 Listening...' : '🎤 Voice'}
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
                {activeAction === 'ask' && (isSpeaking ? '🔊 Speaking...' : '💬 Quick Ask')}
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
            <div className="flex items-center gap-2">
              {isSpeaking && (
                <button
                  onClick={() => {
                    window.speechSynthesis.cancel();
                    setIsSpeaking(false);
                  }}
                  className="text-gray-400 transition-colors hover:text-gray-600"
                  aria-label="Stop speaking"
                  title="Stop speaking">
                  ⏸️
                </button>
              )}
              <button
                onClick={handleClose}
                className="text-gray-400 transition-colors hover:text-gray-600"
                aria-label="Close">
                ✕
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4">
            {error && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {/* Chat mode for "Ask" action */}
            {activeAction === 'ask' ? (
              <div className="space-y-3">
                {/* Show voice question if from voice control */}
                {chatMessages.length === 0 && !selectedText && isSpeaking && (
                  <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                    <div className="mb-2 text-xs font-semibold text-indigo-700">🎤 Voice Question:</div>
                    <div className="text-sm text-indigo-900">
                      {response ? 'Listening...' : 'Processing your voice question...'}
                    </div>
                  </div>
                )}

                {/* Show selected text context when no messages yet */}
                {chatMessages.length === 0 && selectedText && !isSpeaking && (
                  <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <div className="mb-2 text-xs font-semibold text-blue-700">Selected text:</div>
                    <div className="text-sm text-blue-900">
                      {selectedText.slice(0, 300)}
                      {selectedText.length > 300 ? '...' : ''}
                    </div>
                  </div>
                )}

                {/* Show chat messages */}
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
          {(response || error || chatMessages.length > 0 || activeAction === 'ask') && (
            <div className="border-t border-gray-200 bg-gray-50">
              {/* Input for "Ask" action - show always, not just for follow-ups */}
              {activeAction === 'ask' && (
                <div className="border-b border-gray-200 p-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={followUpInput}
                      onChange={e => setFollowUpInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendQuestion();
                        }
                      }}
                      placeholder={
                        chatMessages.length === 0
                          ? 'Ask a question about the selected text...'
                          : 'Ask a follow-up question...'
                      }
                      disabled={isLoading}
                      className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    />
                    <button
                      onClick={handleSendQuestion}
                      disabled={!followUpInput.trim() || isLoading}
                      className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                      Send
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Press Enter to send</p>
                </div>
              )}

              {/* Copy and attribution - show only if there's content to copy */}
              {(response || chatMessages.length > 0) && (
                <div className="flex items-center justify-between p-3">
                  <button
                    onClick={handleCopy}
                    disabled={!response && chatMessages.length === 0}
                    data-copy-button
                    className="rounded px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50">
                    Copy
                  </button>
                  <p className="text-xs text-gray-400">Powered by Chrome Built-in AI</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Only show error when actually trying to use the API, not upfront */}
    </>
  );
}
