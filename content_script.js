/**
 * Content Script
 * Injected into every page to detect and capture prompts in real-time
 */

console.log('Prompt Keeper content script loaded');

let aiSource = null; // Will be initialized later
let trackedTextareas = new Map(); // Track all monitored textareas

// ==================== Floating Button ====================

/**
 * Create and inject floating button
 */
function initializeFloatingButton() {
  // Don't initialize if already exists
  if (document.getElementById('prompt-keeper-floating-container')) {
    console.log('[Floating Button] Already initialized');
    return;
  }

  // Create container
  const container = document.createElement('div');
  container.id = 'prompt-keeper-floating-container';
  container.style.cssText = `
    position: fixed;
    bottom: 30px;
    right: 30px;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  // Create main button
  const button = document.createElement('button');
  button.id = 'prompt-keeper-floating-btn';
  button.innerHTML = '★';
  button.style.cssText = `
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: none;
    background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
    color: white;
    font-size: 28px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  button.addEventListener('mouseenter', () => {
    button.style.transform = 'scale(1.1)';
    button.style.boxShadow = '0 8px 24px rgba(99, 102, 241, 0.6)';
  });

  button.addEventListener('mouseleave', () => {
    button.style.transform = 'scale(1)';
    button.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.4)';
  });

  button.addEventListener('click', () => {
    console.log('[Floating Button] Clicked, sending message to background');
    chrome.runtime.sendMessage({ action: 'openPopup' }, (response) => {
      console.log('[Floating Button] Response:', response);
    });
  });

  // Create tooltip
  const tooltip = document.createElement('div');
  tooltip.style.cssText = `
    position: absolute;
    bottom: 70px;
    right: 0;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease;
  `;
  tooltip.textContent = 'Prompt Keeper (Ctrl+Shift+P)';

  button.addEventListener('mouseenter', () => {
    tooltip.style.opacity = '1';
  });

  button.addEventListener('mouseleave', () => {
    tooltip.style.opacity = '0';
  });

  container.appendChild(button);
  container.appendChild(tooltip);
  document.body.appendChild(container);

  console.log('[Floating Button] Initialized successfully');
}

// Initialize on page load
function initializeFloatingButtonIfReady() {
  if (document.body && document.documentElement) {
    initializeFloatingButton();
  } else {
    setTimeout(initializeFloatingButtonIfReady, 100);
  }
}

// Start initialization immediately
initializeFloatingButtonIfReady();

// Also try on DOMContentLoaded as backup
document.addEventListener('DOMContentLoaded', initializeFloatingButton);

// ==================== Real-time Auto-Save ====================

/**
 * Monitor all textareas and input fields for auto-save
 */
function initializeAutoSave() {
  console.log('[Auto-Save] Initializing auto-save monitoring...');
  
  // Wait for document.body to be available
  function startMonitoring() {
    if (!document.body) {
      console.log('[Auto-Save] Document.body not ready, waiting...');
      setTimeout(startMonitoring, 100);
      return;
    }

    console.log('[Auto-Save] Document.body is ready, starting monitoring');
    
    // Monitor existing textareas
    const initialTextareas = document.querySelectorAll('textarea');
    console.log('[Auto-Save] Found', initialTextareas.length, 'textareas on page load');
    
    initialTextareas.forEach(textarea => {
      attachAutoSaveListener(textarea);
    });

    // Also monitor contenteditable divs (ChatGPT uses these)
    const editableDivs = document.querySelectorAll('[contenteditable="true"]');
    console.log('[Auto-Save] Found', editableDivs.length, 'contenteditable divs');
    editableDivs.forEach(div => {
      attachAutoSaveListenerToContentEditable(div);
    });
    
    // For ChatGPT specifically - monitor any large contenteditable divs (fallback)
    if (window.location.href.includes('chatgpt.com') || window.location.href.includes('chat.openai.com')) {
      console.log('[Auto-Save] ChatGPT detected - enabling aggressive input monitoring');
      const allDivs = document.querySelectorAll('div[role="textbox"], div[contenteditable], textarea[data-id]');
      allDivs.forEach(el => {
        if (el.contentEditable === 'true') {
          console.log('[Auto-Save] Found ChatGPT input field:', { role: el.getAttribute('role'), class: el.className });
          if (!trackedTextareas.has(el)) {
            attachAutoSaveListenerToContentEditable(el);
          }
        } else if (el.tagName === 'TEXTAREA') {
          if (!trackedTextareas.has(el)) {
            attachAutoSaveListener(el);
          }
        }
      });
    }

    // Monitor newly added elements via mutation observer
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            // Check for new textareas
            if (node.tagName === 'TEXTAREA') {
              console.log('[Auto-Save] New textarea detected:', {
                id: node.id,
                class: node.className,
                placeholder: node.placeholder
              });
              attachAutoSaveListener(node);
            }
            
            // Check for new contenteditable divs
            if (node.contentEditable === 'true') {
              console.log('[Auto-Save] New contenteditable div detected');
              attachAutoSaveListenerToContentEditable(node);
            }
            
            // Check inside added nodes
            if (node.querySelectorAll) {
              const newTextareas = node.querySelectorAll('textarea');
              if (newTextareas.length > 0) {
                console.log('[Auto-Save] Found', newTextareas.length, 'new textareas in added nodes');
                newTextareas.forEach(textarea => {
                  if (!trackedTextareas.has(textarea)) {
                    attachAutoSaveListener(textarea);
                  }
                });
              }
              
              // Also check for contenteditable divs
              const newEditables = node.querySelectorAll('[contenteditable="true"]');
              if (newEditables.length > 0) {
                console.log('[Auto-Save] Found', newEditables.length, 'new contenteditable divs');
                newEditables.forEach(div => {
                  if (!trackedTextareas.has(div)) {
                    attachAutoSaveListenerToContentEditable(div);
                  }
                });
              }
            }
          });
        }
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('[Auto-Save] Mutation observer initialized');
  }

  startMonitoring();
}

/**
 * Attach auto-save listener to a contenteditable div (for ChatGPT, etc.)
 */
function attachAutoSaveListenerToContentEditable(element) {
  if (trackedTextareas.has(element)) return;
  
  // Detect if this is a prompt input field
  const isPromptField = isPromptInputField(element);
  
  console.log('[Auto-Save] Checking contenteditable:', {
    tracked: trackedTextareas.has(element),
    isPromptField: isPromptField,
    id: element.id,
    class: element.className,
    role: element.getAttribute('role'),
    ariaLabel: element.getAttribute('aria-label'),
    size: { width: element.offsetWidth, height: element.offsetHeight }
  });
  
  if (!isPromptField) {
    console.log('[Auto-Save] ⚠️ Contenteditable is NOT a prompt field, skipping...');
    return;
  }

  trackedTextareas.set(element, {
    lastValue: element.textContent,
    saveTimeout: null
  });

  // Add visual indicator
  element.style.outline = '2px solid #6366F1';
  element.style.outlineOffset = '-2px';
  console.log('[Auto-Save] ✅ Contenteditable registered for auto-save monitoring');

  // Listen for input
  element.addEventListener('input', (e) => {
    const tracked = trackedTextareas.get(element);
    if (!tracked) return;

    // Clear previous timeout
    if (tracked.saveTimeout) {
      clearTimeout(tracked.saveTimeout);
    }

    // Debounce: save after 2 seconds of inactivity
    tracked.saveTimeout = setTimeout(() => {
      const currentValue = element.textContent.trim();
      
      console.log('[Auto-Save] Input detected, saving in 2s. Content:', currentValue.substring(0, 50) + '...');
      
      if (currentValue && currentValue !== tracked.lastValue) {
        savePromptInRealtime(currentValue, element);
        tracked.lastValue = currentValue;
      }
    }, 2000);
  });

  // Listen for paste events too
  element.addEventListener('paste', (e) => {
    const tracked = trackedTextareas.get(element);
    if (!tracked) return;

    setTimeout(() => {
      const currentValue = element.textContent.trim();
      if (currentValue && currentValue !== tracked.lastValue) {
        console.log('[Auto-Save] Paste detected, saving...');
        savePromptInRealtime(currentValue, element);
        tracked.lastValue = currentValue;
      }
    }, 500);
  });

  // Save on blur
  element.addEventListener('blur', () => {
    const tracked = trackedTextareas.get(element);
    if (!tracked) return;

    if (tracked.saveTimeout) {
      clearTimeout(tracked.saveTimeout);
    }

    const currentValue = element.textContent.trim();
    if (currentValue && currentValue !== tracked.lastValue) {
      console.log('[Auto-Save] Blur detected, saving immediately...');
      savePromptInRealtime(currentValue, element);
      tracked.lastValue = currentValue;
    }
  });
}
function attachAutoSaveListener(textarea) {
  if (trackedTextareas.has(textarea)) return;
  
  // Detect if this is a prompt input field
  const isPromptField = isPromptInputField(textarea);
  
  console.log('[Auto-Save] Textarea detected:', {
    tracked: trackedTextareas.has(textarea),
    isPromptField: isPromptField,
    id: textarea.id,
    class: textarea.className,
    placeholder: textarea.placeholder,
    ariaLabel: textarea.getAttribute('aria-label'),
    size: { width: textarea.offsetWidth, height: textarea.offsetHeight }
  });
  
  if (!isPromptField) {
    console.log('[Auto-Save] ⚠️ Textarea is NOT a prompt field, skipping...');
    return;
  }

  trackedTextareas.set(textarea, {
    lastValue: textarea.value,
    saveTimeout: null
  });

  // Add visual indicator
  textarea.style.borderColor = '#6366F1';
  textarea.title = 'Auto-saving to Prompt Keeper...';
  console.log('[Auto-Save] ✅ Textarea registered for auto-save monitoring');

  // Listen for input
  textarea.addEventListener('input', (e) => {
    const tracked = trackedTextareas.get(textarea);
    if (!tracked) return;

    // Clear previous timeout
    if (tracked.saveTimeout) {
      clearTimeout(tracked.saveTimeout);
    }

    // Debounce: save after 2 seconds of inactivity
    tracked.saveTimeout = setTimeout(() => {
      const currentValue = textarea.value.trim();
      
      console.log('[Auto-Save] Input detected, saving in 2s. Content:', currentValue.substring(0, 50) + '...');
      
      if (currentValue && currentValue !== tracked.lastValue) {
        savePromptInRealtime(currentValue, textarea);
        tracked.lastValue = currentValue;
      }
    }, 2000);
  });

  // Save on blur
  textarea.addEventListener('blur', () => {
    const tracked = trackedTextareas.get(textarea);
    if (!tracked) return;

    if (tracked.saveTimeout) {
      clearTimeout(tracked.saveTimeout);
    }

    const currentValue = textarea.value.trim();
    if (currentValue && currentValue !== tracked.lastValue) {
      console.log('[Auto-Save] Blur detected, saving immediately...');
      savePromptInRealtime(currentValue, textarea);
      tracked.lastValue = currentValue;
    }
  });
}

/**
 * Detect if a textarea or contenteditable element is a prompt input field
 */
function isPromptInputField(element) {
  // Check various attributes that indicate a prompt field
  const classNames = element.className.toLowerCase();
  const id = element.id.toLowerCase();
  const placeholder = (element.placeholder || '').toLowerCase();
  const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase();
  const name = (element.getAttribute('name') || '').toLowerCase();
  const dataTestId = (element.getAttribute('data-testid') || '').toLowerCase();
  const role = (element.getAttribute('role') || '').toLowerCase();

  // More specific indicators based on actual platform usage
  const promptIndicators = [
    'prompt', 'message', 'chat', 'input', 'compose',
    'editor', 'content', 'text', 'query', 'search',
    'send', 'type', 'write', 'ask', 'assistant',
    'textbox', 'searchbox', 'textarea'
  ];

  // Check parent elements for role/aria-label
  let parentElement = element.parentElement;
  let parentInfo = '';
  let currentLevel = element;
  for (let i = 0; i < 3 && currentLevel; i++) {
    const parentClass = (currentLevel.className || '').toLowerCase();
    const parentAria = (currentLevel.getAttribute('aria-label') || '').toLowerCase();
    const parentRole = (currentLevel.getAttribute('role') || '').toLowerCase();
    parentInfo += ' ' + parentClass + ' ' + parentAria + ' ' + parentRole;
    currentLevel = currentLevel.parentElement;
  }

  const hasPromptIndicator = 
    promptIndicators.some(word => classNames.includes(word)) ||
    promptIndicators.some(word => id.includes(word)) ||
    promptIndicators.some(word => placeholder.includes(word)) ||
    promptIndicators.some(word => ariaLabel.includes(word)) ||
    promptIndicators.some(word => name.includes(word)) ||
    promptIndicators.some(word => dataTestId.includes(word)) ||
    promptIndicators.some(word => role.includes(word)) ||
    promptIndicators.some(word => parentInfo.includes(word));

  // Check if it's visible and reasonable size
  const isVisible = element.offsetHeight > 0 && element.offsetWidth > 0;
  const isReasonableSize = element.offsetHeight >= 30; // At least 30px height

  // For contenteditable divs without clear indicators, be more lenient
  // If it's contenteditable, visible, and reasonably sized, monitor it
  if (element.contentEditable === 'true') {
    const lenientSize = element.offsetHeight >= 40 && element.offsetWidth >= 200;
    const hasResult = hasPromptIndicator || lenientSize;
    
    if (!hasPromptIndicator && lenientSize) {
      console.log('[Detection] Lenient match for contenteditable (large & visible):', {
        height: element.offsetHeight,
        width: element.offsetWidth
      });
    }
    
    return hasResult;
  }

  const result = hasPromptIndicator && isVisible && isReasonableSize;
  
  console.log('[Detection] Checking element:', {
    result,
    hasPromptIndicator,
    isVisible,
    isReasonableSize,
    tagName: element.tagName,
    indicators: { classNames, id, placeholder, ariaLabel, name, dataTestId, role }
  });

  return result;
}

/**
 * Save prompt in real-time with visual feedback
 */
function savePromptInRealtime(promptText, sourceElement) {
  if (!promptText || promptText.length < 5) {
    console.log('[Auto-Save] ⚠️ Prompt too short, skipping...');
    return;
  }

  const promptData = {
    content: promptText,
    source: detectAISource(),
    timestamp: Date.now(),
    url: window.location.href,
    title: generatePromptTitle(promptText)
  };

  console.log('[Auto-Save] 📤 Sending prompt to background script:', {
    title: promptData.title,
    source: promptData.source,
    length: promptData.content.length
  });

  // Send to background script
  chrome.runtime.sendMessage({
    action: 'capturePrompt',
    prompt: promptData.content,
    source: promptData.source,
    url: promptData.url
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('[Auto-Save] ❌ Message error:', chrome.runtime.lastError);
      return;
    }
    
    if (response && response.success) {
      console.log('[Auto-Save] ✅ Prompt saved successfully!');
      // Visual feedback
      addSaveIndicator(sourceElement, 'Auto-saved! ✓');
    } else {
      console.error('[Auto-Save] ❌ Save failed:', response);
    }
  });
}

/**
 * Generate a title from prompt text
 */
function generatePromptTitle(text) {
  const words = text.split(' ').slice(0, 6).join(' ');
  return words.length > 50 ? words.substring(0, 50) + '...' : words;
}

/**
 * Add visual save indicator
 */
function addSaveIndicator(element, message = 'Saved! ✓') {
  // Remove existing indicator
  const existing = element.parentElement.querySelector('.prompt-keeper-save-indicator');
  if (existing) existing.remove();

  const indicator = document.createElement('div');
  indicator.className = 'prompt-keeper-save-indicator';
  indicator.textContent = message;
  indicator.style.cssText = `
    position: absolute;
    top: 5px;
    right: 5px;
    background: linear-gradient(135deg, #10B981 0%, #059669 100%);
    color: white;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
    animation: slideInRight 0.3s ease;
    z-index: 10000;
    pointer-events: none;
  `;

  // Add animation keyframes if not exists
  if (!document.querySelector('style[data-prompt-keeper]')) {
    const style = document.createElement('style');
    style.setAttribute('data-prompt-keeper', 'true');
    style.textContent = `
      @keyframes slideInRight {
        from {
          opacity: 0;
          transform: translateX(20px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }
    `;
    document.head.appendChild(style);
  }

  const wrapper = element.parentElement;
  if (wrapper.style.position === '' || wrapper.style.position === 'static') {
    wrapper.style.position = 'relative';
  }

  wrapper.appendChild(indicator);

  // Remove after 3 seconds
  setTimeout(() => {
    indicator.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => indicator.remove(), 300);
  }, 3000);
}

/**
 * Detect the AI source
 */
function detectAISource() {
  const url = window.location.href;
  
  if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) {
    return 'ChatGPT';
  } else if (url.includes('gemini.google.com')) {
    return 'Google Gemini';
  } else if (url.includes('claude.ai')) {
    return 'Claude';
  } else if (url.includes('perplexity.ai')) {
    return 'Perplexity AI';
  } else if (url.includes('bing.com')) {
    return 'Bing Chat';
  } else if (url.includes('huggingface.co')) {
    return 'HuggingFace';
  }
  
  return 'Unknown AI';
}

/**
 * Extract prompt from various AI interfaces
 */
function extractPrompt() {
  const source = detectAISource();
  
  switch (source) {
    case 'ChatGPT':
      return extractFromChatGPT();
    case 'Google Gemini':
      return extractFromGemini();
    case 'Claude':
      return extractFromClaude();
    case 'Perplexity AI':
      return extractFromPerplexity();
    default:
      return extractGenericPrompt();
  }
}

function extractFromChatGPT() {
  // Try to find the message input area
  const textarea = document.querySelector('textarea[placeholder*="message"]');
  if (textarea && textarea.value) {
    return textarea.value;
  }

  // Look for sent messages
  const messages = document.querySelectorAll('[data-message-id], [role="user"]');
  if (messages.length > 0) {
    const lastUserMessage = messages[messages.length - 1];
    return lastUserMessage.innerText || '';
  }

  return '';
}

function extractFromGemini() {
  const textarea = document.querySelector('textarea[aria-label*="Message"], textarea[placeholder*="Message"]');
  if (textarea && textarea.value) {
    return textarea.value;
  }

  return extractGenericPrompt();
}

function extractFromClaude() {
  const textarea = document.querySelector('textarea[placeholder*="message"], textarea[placeholder*="Message"]');
  if (textarea && textarea.value) {
    return textarea.value;
  }

  return extractGenericPrompt();
}

function extractFromPerplexity() {
  const textarea = document.querySelector('textarea[class*="input"]');
  if (textarea && textarea.value) {
    return textarea.value;
  }

  return extractGenericPrompt();
}

function extractGenericPrompt() {
  // Try textareas
  const textareas = document.querySelectorAll('textarea');
  for (let i = textareas.length - 1; i >= 0; i--) {
    if (textareas[i].value && textareas[i].value.trim()) {
      return textareas[i].value;
    }
  }

  // Try content editable elements
  const editables = document.querySelectorAll('[contenteditable="true"]');
  for (let i = editables.length - 1; i >= 0; i--) {
    if (editables[i].innerText && editables[i].innerText.trim()) {
      return editables[i].innerText;
    }
  }

  return '';
}

// ==================== Send & Submit Detection ====================

/**
 * Detect when user sends a prompt (monitors for send button clicks)
 */
function monitorPromptSubmission() {
  // Monitor for click events that might be sending
  document.addEventListener('click', (e) => {
    const target = e.target.closest('button, [role="button"]');
    
    if (!target) return;

    // Check if it looks like a send button
    const isSendButton = 
      target.innerText.toLowerCase().includes('send') ||
      target.aria-label?.toLowerCase().includes('send') ||
      target.className?.includes('send') ||
      target.id?.includes('send');

    if (isSendButton) {
      const prompt = extractPrompt();
      if (prompt && prompt.trim()) {
        // Wait a moment for the message to be processed
        setTimeout(() => {
          capturePrompt(prompt);
        }, 500);
      }
    }
  }, true);

  // Also monitor for Enter key in textareas
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' && e.ctrlKey) || (e.key === 'Enter' && e.metaKey)) {
      const target = e.target.closest('textarea');
      if (target && target.value) {
        setTimeout(() => {
          capturePrompt(target.value);
        }, 500);
      }
    }
  }, true);
}

/**
 * Capture prompt and send to background script
 */
function capturePrompt(promptText) {
  if (!promptText || !promptText.trim()) return;

  const promptData = {
    content: promptText,
    source: detectAISource(),
    timestamp: Date.now(),
    url: window.location.href
  };

  // Send message to background script
  chrome.runtime.sendMessage({
    action: 'capturePrompt',
    prompt: promptData.content,
    source: promptData.source,
    url: promptData.url
  }, (response) => {
    if (response && response.success) {
      console.log('Prompt saved:', response.promptId);
      showSaveNotification('Prompt saved to Prompt Keeper! ✓');
    }
  });
}

/**
 * Show visual notification to user
 */
function showSaveNotification(message) {
  const notification = document.createElement('div');
  notification.id = 'prompt-keeper-notification';
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-size: 14px;
    font-weight: 500;
    z-index: 999999;
    animation: slideIn 0.3s ease-out;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  `;
  notification.textContent = message;

  // Add animation keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(notification);

  // Remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ==================== Message Listeners ====================

/**
 * Listen for messages from background script
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Content Script] Message received:', request.action);

  switch (request.action) {
    case 'captureSelectedText':
      handleCaptureSelectedText(sendResponse);
      break;
    
    case 'extractCurrentPrompt':
      sendResponse({ prompt: extractPrompt() });
      break;
    
    case 'saveCurrentInput':
      handleSaveCurrentInput(sendResponse);
      break;
    
    case 'ping':
      console.log('[Content Script] ✅ Ping received, responding...');
      sendResponse({ pong: true });
      break;
    
    case 'debugDOMState':
      debugDOMState(sendResponse);
      break;
    
    default:
      console.warn('Unknown action:', request.action);
      sendResponse({ error: 'Unknown action' });
  }

  return true;
});

/**
 * Debug DOM state for troubleshooting
 */
function debugDOMState(sendResponse) {
  const textareas = document.querySelectorAll('textarea');
  const editables = document.querySelectorAll('[contenteditable="true"]');
  
  const debug = {
    url: window.location.href,
    textareaCount: textareas.length,
    editableCount: editables.length,
    textareas: [],
    editables: []
  };
  
  textareas.forEach((ta, i) => {
    debug.textareas.push({
      index: i,
      id: ta.id,
      class: ta.className,
      placeholder: ta.placeholder,
      visible: ta.offsetHeight > 0,
      value: ta.value.substring(0, 30)
    });
  });
  
  editables.forEach((el, i) => {
    debug.editables.push({
      index: i,
      tagName: el.tagName,
      id: el.id,
      class: el.className,
      role: el.getAttribute('role'),
      visible: el.offsetHeight > 0,
      text: el.textContent.substring(0, 30)
    });
  });
  
  console.log('[Debug] DOM State:', debug);
  sendResponse(debug);
}

/**
 * Handle capturing selected text
 */
function handleCaptureSelectedText(sendResponse) {
  const selected = window.getSelection().toString();
  if (selected) {
    capturePrompt(selected);
    sendResponse({ success: true });
  } else {
    sendResponse({ success: false, error: 'No text selected' });
  }
}

/**
 * Handle save current input from keyboard shortcut
 */
function handleSaveCurrentInput(sendResponse) {
  const currentInput = extractPrompt();
  if (currentInput) {
    capturePrompt(currentInput);
    sendResponse({ success: true, saved: currentInput });
  } else {
    sendResponse({ success: false, error: 'No input found' });
  }
}

// ==================== Initialize ====================

// Wait for DOM to be ready before initializing
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Content Script] DOM loaded, initializing...');
    // Initialize AI source detection
    aiSource = detectAISource();
    // Start monitoring for prompt submissions
    monitorPromptSubmission();
    // Start real-time auto-save monitoring
    initializeAutoSave();
    console.log('Prompt Keeper is monitoring:', aiSource);
  });
} else {
  // DOM is already loaded
  console.log('[Content Script] DOM already loaded, initializing...');
  // Initialize AI source detection
  aiSource = detectAISource();
  // Start monitoring for prompt submissions
  monitorPromptSubmission();
  // Start real-time auto-save monitoring
  initializeAutoSave();
  console.log('Prompt Keeper is monitoring:', aiSource);
}

