/**
 * Tracky Mouse Bridge Script
 * Injected into page context to load and expose TrackyMouse
 */

(function () {
  'use strict';

  // Listen for status check events
  window.addEventListener('check-trackymouse-status', function () {
    if (window.TrackyMouse) {
      window.dispatchEvent(new CustomEvent('trackymouse-loaded'));
    }
  });

  // Check if already loaded
  if (window.__TrackyMouseBridgeLoaded__) {
    console.log('[A11y Extension] Tracky Mouse bridge already loaded');
    // Check if TrackyMouse is already available
    if (window.TrackyMouse) {
      window.dispatchEvent(new CustomEvent('trackymouse-loaded'));
    }
    return;
  }

  window.__TrackyMouseBridgeLoaded__ = true;

  // Get the extension ID from the script src
  const scripts = document.getElementsByTagName('script');
  let extensionUrl = '';
  for (let i = 0; i < scripts.length; i++) {
    const src = scripts[i].src;
    if (src && src.includes('tracky-mouse-bridge.js')) {
      extensionUrl = src.substring(0, src.lastIndexOf('/') + 1) + 'tracky-mouse/';
      break;
    }
  }

  if (!extensionUrl) {
    console.error('[A11y Extension] Could not determine extension URL for Tracky Mouse');
    window.dispatchEvent(new CustomEvent('trackymouse-error', { detail: 'Could not determine extension URL' }));
    return;
  }

  console.log('[A11y Extension] Loading Tracky Mouse from:', extensionUrl);

  // Load CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = extensionUrl + 'tracky-mouse.css';
  if (!document.querySelector('link[href="' + link.href + '"]')) {
    document.head.appendChild(link);
  }

  // Fetch and create Blob URL for Worker (Workers can't load from chrome-extension:// in page context)
  fetch(extensionUrl + 'facemesh.worker.js')
    .then(function (response) {
      return response.text();
    })
    .then(function (workerCode) {
      // Replace relative URLs in importScripts with absolute URLs
      workerCode = workerCode.replace(/importScripts\('lib\//g, "importScripts('" + extensionUrl + 'lib/');

      // Create blob URL for worker with fixed paths
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerBlobURL = URL.createObjectURL(blob);
      console.log('[A11y Extension] Created Worker Blob URL:', workerBlobURL);

      // Monkey-patch Worker constructor to replace chrome-extension:// URLs with blob URL
      const OriginalWorker = window.Worker;
      window.Worker = function (scriptURL, options) {
        // If the URL is for facemesh.worker.js, use the blob URL instead
        if (typeof scriptURL === 'string' && scriptURL.includes('facemesh.worker.js')) {
          console.log('[A11y Extension] Intercepting Worker creation, using blob URL');
          return new OriginalWorker(workerBlobURL, options);
        }
        return new OriginalWorker(scriptURL, options);
      };
      // Copy static properties
      window.Worker.prototype = OriginalWorker.prototype;

      // Now load the main Tracky Mouse script
      const script = document.createElement('script');
      script.src = extensionUrl + 'tracky-mouse.js';
      script.onload = function () {
        // Keep Worker monkey-patch in place (Worker is created during init(), not load)

        // Attach TrackyMouse to window if it exists
        if (typeof TrackyMouse !== 'undefined') {
          window.TrackyMouse = TrackyMouse;
          window.TrackyMouse.dependenciesRoot = extensionUrl;
          window.__TrackyMouseLoaded__ = true;

          // Set up pointer move simulation
          const getEventOptions = ({ x, y }) => {
            return {
              view: window,
              clientX: x,
              clientY: y,
              pointerId: 1234567890,
              pointerType: 'mouse',
              isPrimary: true,
            };
          };

          let lastElOver = null;

          window.TrackyMouse.onPointerMove = function (x, y) {
            const target = document.elementFromPoint(x, y) || document.body;
            if (target !== lastElOver) {
              if (lastElOver) {
                const event = new PointerEvent(
                  'pointerleave',
                  Object.assign(getEventOptions({ x, y }), {
                    button: 0,
                    buttons: 1,
                    bubbles: false,
                    cancelable: false,
                  }),
                );
                lastElOver.dispatchEvent(event);
              }
              const event = new PointerEvent(
                'pointerenter',
                Object.assign(getEventOptions({ x, y }), {
                  button: 0,
                  buttons: 1,
                  bubbles: false,
                  cancelable: false,
                }),
              );
              target.dispatchEvent(event);
              lastElOver = target;
            }
            const event = new PointerEvent(
              'pointermove',
              Object.assign(getEventOptions({ x, y }), {
                button: 0,
                buttons: 1,
                bubbles: true,
                cancelable: true,
              }),
            );
            target.dispatchEvent(event);
          };

          // Listen for messages from content script
          window.addEventListener('message', function (event) {
            // Only accept messages from the same window (from content script)
            if (event.source !== window || event.data?.source !== 'ai-content-script') {
              return;
            }

            if (event.data.type === 'trackymouse-load-dependencies') {
              // Load dependencies and signal when done
              if (window.TrackyMouse && window.TrackyMouse.loadDependencies) {
                window.TrackyMouse.loadDependencies()
                  .then(function () {
                    window.dispatchEvent(new CustomEvent('trackymouse-deps-loaded'));
                  })
                  .catch(function (err) {
                    window.dispatchEvent(new CustomEvent('trackymouse-deps-error', { detail: err.message }));
                  });
              }
            } else if (event.data.type === 'trackymouse-init') {
              // Initialize head tracking with custom options
              if (window.TrackyMouse && window.TrackyMouse.init) {
                // Configure TrackyMouse to show minimal UI
                const trackyInstance = window.TrackyMouse.init();
                window.__TrackyMouseInstance__ = trackyInstance;

                // Hide all UI elements except canvas, auto-start tracking
                setTimeout(function () {
                  // Hide the entire control panel with all sliders/buttons
                  var controlsPanel = document.querySelector('.tracky-mouse-controls');
                  if (controlsPanel) {
                    controlsPanel.style.display = 'none';
                  }

                  // Hide download message
                  var downloadMsg = document.querySelector('.tracky-mouse-desktop-app-download-message');
                  if (downloadMsg) {
                    downloadMsg.style.display = 'none';
                  }

                  // Style canvas as circular bubble in bottom-right
                  var canvas = document.querySelector('.tracky-mouse-canvas');
                  if (canvas) {
                    canvas.style.position = 'fixed';
                    canvas.style.bottom = '10px';
                    canvas.style.right = '10px';
                    canvas.style.width = '140px';
                    canvas.style.height = '140px';
                    canvas.style.borderRadius = '50%';
                    canvas.style.objectFit = 'cover';
                    canvas.style.zIndex = '999999';
                    canvas.style.border = '3px solid #8b5cf6';
                    canvas.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
                  }

                  // Remove canvas container that wraps it (we want canvas to escape)
                  var canvasContainer = document.querySelector('.tracky-mouse-canvas-container');
                  if (canvasContainer && canvas) {
                    // Move canvas out of container
                    document.body.appendChild(canvas);
                  }

                  // Hide the canvas container wrapper
                  var canvasContainerWrapper = document.querySelector('.tracky-mouse-canvas-container-container');
                  if (canvasContainerWrapper) {
                    canvasContainerWrapper.style.display = 'none';
                  }

                  // Auto-start tracking (simulate F9 / Start button click)
                  var startButton = document.querySelector('.tracky-mouse-start-stop-button');
                  if (startButton && startButton.getAttribute('aria-pressed') === 'false') {
                    console.log('[A11y Extension] Auto-starting TrackyMouse tracking...');
                    startButton.click();
                  }
                }, 800);

                window.dispatchEvent(new CustomEvent('trackymouse-init-complete'));
              }
            } else if (event.data.type === 'trackymouse-dispose') {
              // Dispose head tracking and clean up UI elements
              if (window.__TrackyMouseInstance__ && window.__TrackyMouseInstance__.dispose) {
                window.__TrackyMouseInstance__.dispose();
                window.__TrackyMouseInstance__ = null;
              }

              // Remove the entire TrackyMouse UI container
              var trackyUI = document.querySelector('.tracky-mouse-ui');
              if (trackyUI && trackyUI.parentNode) {
                trackyUI.parentNode.removeChild(trackyUI);
              }

              // Also clean up video element if it exists separately
              var videoEl = document.getElementById('video');
              if (videoEl && videoEl.parentNode) {
                videoEl.parentNode.removeChild(videoEl);
              }
            } else if (event.data.type === 'trackymouse-init-dwell-clicking') {
              try {
                const config = event.data.config;
                if (window.TrackyMouse && window.TrackyMouse.initDwellClicking) {
                  // Add click callback that can't be sent via postMessage
                  const configWithClick = Object.assign({}, config, {
                    click: function ({ target }) {
                      if (target instanceof HTMLElement) {
                        target.click();
                        if (target.matches('input, textarea')) {
                          target.focus();
                        }
                      }
                    },
                  });
                  window.__DwellClicker__ = window.TrackyMouse.initDwellClicking(configWithClick);
                  window.postMessage(
                    {
                      source: 'ai-page-script',
                      type: 'trackymouse-dwell-clicking-init',
                      success: true,
                    },
                    '*',
                  );
                }
              } catch (error) {
                window.postMessage(
                  {
                    source: 'ai-page-script',
                    type: 'trackymouse-dwell-clicking-init',
                    success: false,
                    error: error.message,
                  },
                  '*',
                );
              }
            } else if (event.data.type === 'trackymouse-dispose-dwell-clicking') {
              if (window.__DwellClicker__ && window.__DwellClicker__.dispose) {
                window.__DwellClicker__.dispose();
                window.__DwellClicker__ = null;
              }
            } else if (event.data.type === 'trackymouse-use-camera') {
              // Request camera access
              if (window.TrackyMouse && window.TrackyMouse.useCamera) {
                window.TrackyMouse.useCamera();
              }
            }
          });

          console.log('[A11y Extension] Tracky Mouse loaded and attached to window');
          // Signal that it's ready
          window.dispatchEvent(new CustomEvent('trackymouse-loaded'));
        } else {
          console.error('[A11y Extension] TrackyMouse not found after script load');
          window.dispatchEvent(new CustomEvent('trackymouse-error', { detail: 'TrackyMouse not found' }));
        }
      };
      script.onerror = function () {
        console.error('[A11y Extension] Failed to load Tracky Mouse script');
        window.dispatchEvent(new CustomEvent('trackymouse-error', { detail: 'Failed to load script file' }));
      };
      document.head.appendChild(script);
    })
    .catch(function (error) {
      console.error('[A11y Extension] Failed to load Worker file:', error);
      window.dispatchEvent(new CustomEvent('trackymouse-error', { detail: 'Failed to load Worker file' }));
    });
})();
