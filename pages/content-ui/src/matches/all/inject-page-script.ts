/**
 * Inject a script into the page context to access Chrome Built-in AI APIs
 * Content scripts run in an isolated world and cannot access Origin Trial APIs directly
 *
 * This loads an external script file to avoid CSP (Content Security Policy) issues
 */

export const injectPageScript = () => {
  // Check if already injected
  if (document.querySelector('script[data-ai-bridge="true"]')) {
    console.log('[A11y Extension] AI bridge script already injected');
    return;
  }

  const script = document.createElement('script');
  script.setAttribute('data-ai-bridge', 'true');

  // Use chrome.runtime.getURL to get the extension URL for the page bridge script
  // This avoids CSP issues by loading an external script instead of inline code
  script.src = chrome.runtime.getURL('ai-page-bridge.js');

  script.onload = () => {
    console.log('[A11y Extension] AI bridge script loaded successfully');
  };

  script.onerror = error => {
    console.error('[A11y Extension] Failed to load AI bridge script:', error);
  };

  (document.head || document.documentElement).appendChild(script);
  console.log('[A11y Extension] AI bridge script injection initiated');
};
