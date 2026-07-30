// Content Script for Visual AI Agent Extension

function getCoarseSelector(el: HTMLElement | null): string {
  if (!el || el === document.body || el === document.documentElement) {
    return el ? el.tagName.toLowerCase() : '';
  }

  const parts: string[] = [];
  let current: HTMLElement | null = el;
  let depth = 0;

  while (current && current !== document.body && depth < 3) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector += `#${current.id}`;
      parts.unshift(selector);
      break;
    } else if (current.className && typeof current.className === 'string') {
      const classes = current.className.trim().split(/\s+/).filter(Boolean).slice(0, 2);
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`;
      }
    }
    parts.unshift(selector);
    current = current.parentElement;
    depth++;
  }

  return parts.join(' > ');
}

function sendEventToBackground(eventType: string, metadata: Record<string, any> = {}): void {
  try {
    chrome.runtime.sendMessage({
      type: 'EVENT_CAPTURED',
      payload: {
        eventType,
        url: window.location.href,
        metadata,
        tabId: null
      }
    });
  } catch (err) {
    // Ignore context invalidated error on extension reload
  }
}

let lastScrollPercentage = 0;
let scrollTimeout: number | null = null;

function handleScroll(): void {
  if (scrollTimeout) return;

  scrollTimeout = window.setTimeout(() => {
    scrollTimeout = null;
    const docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight
    );
    const winHeight = window.innerHeight;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;

    if (docHeight <= winHeight) return;

    const scrollPercent = Math.round((scrollTop / (docHeight - winHeight)) * 100);
    
    const milestone = Math.floor(scrollPercent / 25) * 25;
    if (milestone > 0 && milestone !== lastScrollPercentage) {
      lastScrollPercentage = milestone;
      sendEventToBackground('scroll', { scroll_percentage: milestone });
    }
  }, 300);
}

/**
 * DOM Mutation Burst Detector.
 * Notifies background worker when significant DOM layout changes occur.
 */
function initMutationObserver(): void {
  let mutationCount = 0;
  let resetTimeout: number | null = null;

  const observer = new MutationObserver((mutations) => {
    mutationCount += mutations.length;

    if (!resetTimeout) {
      resetTimeout = window.setTimeout(() => {
        if (mutationCount >= 10) {
          try {
            chrome.runtime.sendMessage({ type: 'DOM_MUTATION_BURST' });
          } catch (e) {
            // Ignore context error
          }
        }
        mutationCount = 0;
        resetTimeout = null;
      }, 2000);
    }
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true,
    attributes: false
  });
}

/**
 * Main Content Script Initialization.
 * MUST strictly await domain blocklist check before attaching ANY DOM listeners.
 */
async function initContentScript(): Promise<void> {
  const isBlocked = await new Promise<boolean>((resolve) => {
    try {
      chrome.runtime.sendMessage(
        { type: 'CHECK_DOMAIN_BLOCKED', url: window.location.href },
        (response) => {
          if (chrome.runtime.lastError || !response) {
            resolve(true); // Fail closed on error for privacy
          } else {
            resolve(response.blocked === true);
          }
        }
      );
    } catch (e) {
      resolve(true); // Fail closed
    }
  });

  if (isBlocked) {
    console.log('[Visual AI Agent Privacy] Domain is blocklisted. Content script inactive on:', window.location.hostname);
    return;
  }

  console.log('[Visual AI Agent] Domain allowed. Initializing DOM event listeners on:', window.location.hostname);

  // Click Event Listener
  document.addEventListener('click', (evt: MouseEvent) => {
    const target = evt.target as HTMLElement | null;
    if (!target) return;

    const tag = target.tagName.toUpperCase();
    const selector = getCoarseSelector(target);

    const metadata: Record<string, any> = {
      tag,
      selector
    };

    if (tag === 'INPUT') {
      const inputEl = target as HTMLInputElement;
      metadata.input_type = inputEl.type || 'text';
    } else if (tag === 'A') {
      const linkEl = target as HTMLAnchorElement;
      if (linkEl.href) {
        metadata.target_href = linkEl.href;
      }
    }

    sendEventToBackground('click', metadata);
  }, { capture: true, passive: true });

  // Scroll Listener
  window.addEventListener('scroll', handleScroll, { passive: true });

  // Focus Listener
  document.addEventListener('focusin', (evt: FocusEvent) => {
    const target = evt.target as HTMLElement | null;
    if (!target) return;

    const tag = target.tagName.toUpperCase();
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
      const inputEl = target as HTMLInputElement;
      sendEventToBackground('focus', {
        tag,
        input_type: inputEl.type || 'text',
        selector: getCoarseSelector(target)
      });
    }
  }, { capture: true, passive: true });

  // Page Visibility Listener
  document.addEventListener('visibilitychange', () => {
    sendEventToBackground('visibilitychange', {
      state: document.visibilityState
    });
  });

  // DOM Mutation Observer Trigger
  initMutationObserver();
}

initContentScript();
