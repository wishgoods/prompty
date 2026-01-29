/**
 * Content Script
 * Injected into every page to detect and capture prompts
 */

// ==================== Initialization ====================

console.log('Prompt Keeper content script loaded');

let aiSource = detectAISource();

// ==================== Prompt Detection & Capture ====================

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
  console.log('Content script received message:', request.action);

  switch (request.action) {
    case 'captureSelectedText':
      handleCaptureSelectedText(sendResponse);
      break;
    
    case 'extractCurrentPrompt':
      sendResponse({ prompt: extractPrompt() });
      break;
    
    case 'ping':
      sendResponse({ pong: true });
      break;
    
    default:
      console.warn('Unknown action:', request.action);
      sendResponse({ error: 'Unknown action' });
  }

  return true;
});

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

// ==================== Initialize ====================

// Start monitoring for prompt submissions
monitorPromptSubmission();

console.log('Prompt Keeper is monitoring:', aiSource);
