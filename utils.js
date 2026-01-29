/**
 * Utility Functions for Prompt Keeper
 * Helpers for prompt detection, formatting, and general utilities
 */

// ==================== Prompt Detection ====================

/**
 * Detect the source of the AI tool (ChatGPT, Gemini, etc.)
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
 * Extract text from various AI chat interfaces
 */
function extractPromptFromPage(source) {
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
  // Look for the user message in ChatGPT's DOM
  const messages = document.querySelectorAll('[data-message-id]');
  if (messages.length > 0) {
    const lastMessage = messages[messages.length - 1];
    return lastMessage.innerText || '';
  }
  
  // Fallback: look for text in specific ChatGPT classes
  const chatMessages = document.querySelectorAll('[class*="message"]');
  if (chatMessages.length > 0) {
    return chatMessages[chatMessages.length - 1].innerText || '';
  }
  
  return '';
}

function extractFromGemini() {
  const inputArea = document.querySelector('textarea[placeholder*="Message"]');
  if (inputArea) {
    return inputArea.value;
  }
  
  const messages = document.querySelectorAll('[data-messages]');
  if (messages.length > 0) {
    return messages[messages.length - 1].innerText || '';
  }
  
  return '';
}

function extractFromClaude() {
  const inputArea = document.querySelector('textarea');
  if (inputArea) {
    return inputArea.value;
  }
  
  const messages = document.querySelectorAll('[class*="message"]');
  if (messages.length > 0) {
    return messages[messages.length - 1].innerText || '';
  }
  
  return '';
}

function extractFromPerplexity() {
  const inputArea = document.querySelector('textarea[class*="input"]');
  if (inputArea) {
    return inputArea.value;
  }
  
  return extractGenericPrompt();
}

function extractGenericPrompt() {
  // Try common textarea selectors
  const textareas = document.querySelectorAll('textarea');
  if (textareas.length > 0) {
    return textareas[textareas.length - 1].value;
  }
  
  // Try to find input-like elements with text
  const inputs = document.querySelectorAll('input[type="text"], [contenteditable="true"]');
  if (inputs.length > 0) {
    return inputs[inputs.length - 1].innerText || inputs[inputs.length - 1].value || '';
  }
  
  return '';
}

// ==================== Text Formatting ====================

/**
 * Truncate text to specified length
 */
function truncateText(text, length = 100) {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

/**
 * Format timestamp to readable date
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString();
}

/**
 * Format file size for download
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// ==================== JSON/Export Utilities ====================

/**
 * Download data as JSON file
 */
function downloadJSON(data, filename = 'export.json') {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parse JSON file
 */
function parseJSONFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        resolve(data);
      } catch (err) {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}

// ==================== Array/Object Utilities ====================

/**
 * Deduplicate array of objects by key
 */
function deduplicateByKey(arr, key) {
  const seen = new Set();
  return arr.filter(item => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

/**
 * Group array by key
 */
function groupByKey(arr, key) {
  return arr.reduce((acc, item) => {
    const group = item[key];
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});
}

/**
 * Sort array by key
 */
function sortByKey(arr, key, ascending = true) {
  return [...arr].sort((a, b) => {
    if (ascending) {
      return a[key] > b[key] ? 1 : -1;
    }
    return a[key] < b[key] ? 1 : -1;
  });
}

// ==================== Validation ====================

/**
 * Validate prompt data
 */
function validatePrompt(prompt) {
  const errors = [];
  
  if (!prompt.content || prompt.content.trim() === '') {
    errors.push('Prompt content is required');
  }
  
  if (prompt.content.length > 50000) {
    errors.push('Prompt content is too long (max 50000 characters)');
  }
  
  if (prompt.title && prompt.title.length > 500) {
    errors.push('Title is too long (max 500 characters)');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// ==================== Storage Utilities ====================

/**
 * Get data from chrome storage
 */
function getChromeStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, (data) => {
      resolve(data[key]);
    });
  });
}

/**
 * Set data in chrome storage
 */
function setChromeStorage(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, () => {
      resolve(true);
    });
  });
}

/**
 * Remove data from chrome storage
 */
function removeChromeStorage(key) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(key, () => {
      resolve(true);
    });
  });
}

// ==================== Generate Unique ID ====================

/**
 * Generate unique ID
 */
function generateUniqueId() {
  return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    detectAISource,
    extractPromptFromPage,
    truncateText,
    formatDate,
    formatFileSize,
    downloadJSON,
    parseJSONFile,
    copyToClipboard,
    deduplicateByKey,
    groupByKey,
    sortByKey,
    validatePrompt,
    getChromeStorage,
    setChromeStorage,
    removeChromeStorage,
    generateUniqueId
  };
}
