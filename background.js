/**
 * Background Service Worker
 * Handles message passing, prompt detection, and background tasks
 */

let storageManager = null;

// Initialize storage manager when service worker loads
async function initializeStorage() {
  // Note: In production, you'd use a more robust storage module
  // This is a simplified version that works with IndexedDB
  console.log('Prompt Keeper background service worker initialized');
}

initializeStorage();

// ==================== Message Listeners ====================

/**
 * Listen for messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request.action);

  switch (request.action) {
    case 'capturePrompt':
      handlePromptCapture(request, sender, sendResponse);
      break;
    
    case 'savePrompt':
      handleSavePrompt(request, sendResponse);
      break;
    
    case 'getPrompt':
      handleGetPrompt(request, sendResponse);
      break;
    
    case 'getAllPrompts':
      handleGetAllPrompts(sendResponse);
      break;
    
    case 'updatePrompt':
      handleUpdatePrompt(request, sendResponse);
      break;
    
    case 'deletePrompt':
      handleDeletePrompt(request, sendResponse);
      break;
    
    case 'searchPrompts':
      handleSearchPrompts(request, sendResponse);
      break;
    
    case 'filterPrompts':
      handleFilterPrompts(request, sendResponse);
      break;
    
    case 'exportPrompts':
      handleExportPrompts(sendResponse);
      break;
    
    case 'importPrompts':
      handleImportPrompts(request, sendResponse);
      break;
    
    case 'toggleFavorite':
      handleToggleFavorite(request, sendResponse);
      break;
    
    case 'updateTags':
      handleUpdateTags(request, sendResponse);
      break;
    
    case 'getVersions':
      handleGetVersions(request, sendResponse);
      break;
    
    case 'restoreVersion':
      handleRestoreVersion(request, sendResponse);
      break;
    
    case 'clearAllData':
      handleClearAllData(sendResponse);
      break;
    
    default:
      console.warn('Unknown action:', request.action);
      sendResponse({ error: 'Unknown action' });
  }

  // Return true to indicate we'll send response asynchronously
  return true;
});

// ==================== Handler Functions ====================

/**
 * Handle prompt capture from content script
 */
async function handlePromptCapture(request, sender, sendResponse) {
  try {
    const promptData = {
      content: request.prompt,
      source: request.source || 'Unknown',
      url: sender.url,
      timestamp: Date.now()
    };

    // Store the prompt
    const savedPrompt = await storePromptLocally(promptData);
    
    // Notify user
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'images/icon-128.png',
      title: 'Prompt Saved',
      message: `"${truncateText(request.prompt)}" saved to Prompt Keeper`
    });

    sendResponse({ success: true, promptId: savedPrompt.id });
  } catch (error) {
    console.error('Error capturing prompt:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle save prompt request
 */
async function handleSavePrompt(request, sendResponse) {
  try {
    const prompt = await storePromptLocally(request.prompt);
    sendResponse({ success: true, prompt });
  } catch (error) {
    console.error('Error saving prompt:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle get single prompt
 */
async function handleGetPrompt(request, sendResponse) {
  try {
    const prompt = await getPromptLocally(request.promptId);
    sendResponse({ success: true, prompt });
  } catch (error) {
    console.error('Error getting prompt:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle get all prompts
 */
async function handleGetAllPrompts(sendResponse) {
  try {
    const prompts = await getAllPromptsLocally();
    sendResponse({ success: true, prompts });
  } catch (error) {
    console.error('Error getting all prompts:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle update prompt
 */
async function handleUpdatePrompt(request, sendResponse) {
  try {
    const prompt = await updatePromptLocally(request.promptId, request.updates);
    sendResponse({ success: true, prompt });
  } catch (error) {
    console.error('Error updating prompt:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle delete prompt
 */
async function handleDeletePrompt(request, sendResponse) {
  try {
    await deletePromptLocally(request.promptId);
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error deleting prompt:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle search prompts
 */
async function handleSearchPrompts(request, sendResponse) {
  try {
    const prompts = await searchPromptsLocally(request.query);
    sendResponse({ success: true, prompts });
  } catch (error) {
    console.error('Error searching prompts:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle filter prompts
 */
async function handleFilterPrompts(request, sendResponse) {
  try {
    const prompts = await filterPromptsLocally(request.filters);
    sendResponse({ success: true, prompts });
  } catch (error) {
    console.error('Error filtering prompts:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle export prompts
 */
async function handleExportPrompts(sendResponse) {
  try {
    const data = await exportPromptsLocally();
    sendResponse({ success: true, data });
  } catch (error) {
    console.error('Error exporting prompts:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle import prompts
 */
async function handleImportPrompts(request, sendResponse) {
  try {
    const result = await importPromptsLocally(request.data);
    sendResponse({ success: true, result });
  } catch (error) {
    console.error('Error importing prompts:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle toggle favorite
 */
async function handleToggleFavorite(request, sendResponse) {
  try {
    const prompt = await toggleFavoriteLocally(request.promptId);
    sendResponse({ success: true, prompt });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle update tags
 */
async function handleUpdateTags(request, sendResponse) {
  try {
    const prompt = await updateTagsLocally(request.promptId, request.tags);
    sendResponse({ success: true, prompt });
  } catch (error) {
    console.error('Error updating tags:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle get versions
 */
async function handleGetVersions(request, sendResponse) {
  try {
    const versions = await getVersionsLocally(request.promptId);
    sendResponse({ success: true, versions });
  } catch (error) {
    console.error('Error getting versions:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle restore version
 */
async function handleRestoreVersion(request, sendResponse) {
  try {
    const prompt = await restoreVersionLocally(request.promptId, request.versionId);
    sendResponse({ success: true, prompt });
  } catch (error) {
    console.error('Error restoring version:', error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle clear all data
 */
async function handleClearAllData(sendResponse) {
  try {
    await clearAllDataLocally();
    sendResponse({ success: true });
  } catch (error) {
    console.error('Error clearing data:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// ==================== Local Storage Functions ====================

/**
 * Store prompt using chrome.storage.local
 * (In production, this would integrate with StorageManager class)
 */
async function storePromptLocally(promptData) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('prompts', (result) => {
      try {
        const prompts = result.prompts || [];
        const prompt = {
          id: `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: promptData.title || 'Untitled',
          content: promptData.content,
          output: promptData.output || '',
          source: promptData.source || 'Unknown',
          category: promptData.category || 'General',
          tags: promptData.tags || [],
          timestamp: Date.now(),
          url: promptData.url || '',
          notes: promptData.notes || '',
          isFavorite: false,
          versions: []
        };

        prompts.push(prompt);
        chrome.storage.local.set({ prompts }, () => {
          resolve(prompt);
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Get single prompt
 */
async function getPromptLocally(promptId) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('prompts', (result) => {
      const prompts = result.prompts || [];
      const prompt = prompts.find(p => p.id === promptId);
      resolve(prompt || null);
    });
  });
}

/**
 * Get all prompts
 */
async function getAllPromptsLocally() {
  return new Promise((resolve) => {
    chrome.storage.local.get('prompts', (result) => {
      resolve(result.prompts || []);
    });
  });
}

/**
 * Update prompt
 */
async function updatePromptLocally(promptId, updates) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('prompts', (result) => {
      try {
        const prompts = result.prompts || [];
        const index = prompts.findIndex(p => p.id === promptId);
        
        if (index === -1) {
          reject(new Error('Prompt not found'));
          return;
        }

        prompts[index] = { ...prompts[index], ...updates, lastModified: Date.now() };
        chrome.storage.local.set({ prompts }, () => {
          resolve(prompts[index]);
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Delete prompt
 */
async function deletePromptLocally(promptId) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('prompts', (result) => {
      try {
        const prompts = result.prompts || [];
        const filtered = prompts.filter(p => p.id !== promptId);
        chrome.storage.local.set({ prompts: filtered }, () => {
          resolve(true);
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Search prompts
 */
async function searchPromptsLocally(query) {
  return new Promise((resolve) => {
    chrome.storage.local.get('prompts', (result) => {
      const prompts = result.prompts || [];
      const lowerQuery = query.toLowerCase();
      
      const filtered = prompts.filter(p =>
        p.title.toLowerCase().includes(lowerQuery) ||
        p.content.toLowerCase().includes(lowerQuery) ||
        p.output.toLowerCase().includes(lowerQuery)
      );
      
      resolve(filtered);
    });
  });
}

/**
 * Filter prompts
 */
async function filterPromptsLocally(filters) {
  return new Promise((resolve) => {
    chrome.storage.local.get('prompts', (result) => {
      const prompts = result.prompts || [];
      
      const filtered = prompts.filter(p => {
        if (filters.source && p.source !== filters.source) return false;
        if (filters.category && p.category !== filters.category) return false;
        if (filters.tag && !p.tags.includes(filters.tag)) return false;
        if (filters.isFavorite && p.isFavorite !== filters.isFavorite) return false;
        return true;
      });
      
      resolve(filtered);
    });
  });
}

/**
 * Export prompts
 */
async function exportPromptsLocally() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['prompts', 'versions'], (result) => {
      resolve({
        version: '1.0',
        exportDate: new Date().toISOString(),
        prompts: result.prompts || [],
        versions: result.versions || []
      });
    });
  });
}

/**
 * Import prompts
 */
async function importPromptsLocally(data) {
  return new Promise((resolve, reject) => {
    if (!data.prompts || !Array.isArray(data.prompts)) {
      reject(new Error('Invalid import format'));
      return;
    }

    chrome.storage.local.get('prompts', (result) => {
      try {
        const prompts = result.prompts || [];
        prompts.push(...data.prompts);
        chrome.storage.local.set({ prompts }, () => {
          resolve({ imported: data.prompts.length });
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Toggle favorite
 */
async function toggleFavoriteLocally(promptId) {
  return new Promise((resolve, reject) => {
    getPromptLocally(promptId).then(prompt => {
      if (!prompt) {
        reject(new Error('Prompt not found'));
        return;
      }

      updatePromptLocally(promptId, { isFavorite: !prompt.isFavorite }).then(resolve).catch(reject);
    });
  });
}

/**
 * Update tags
 */
async function updateTagsLocally(promptId, tags) {
  return updatePromptLocally(promptId, { tags });
}

/**
 * Get versions (placeholder for future enhancement)
 */
async function getVersionsLocally(promptId) {
  return new Promise((resolve) => {
    chrome.storage.local.get('versions', (result) => {
      const versions = result.versions || [];
      const filtered = versions.filter(v => v.promptId === promptId);
      resolve(filtered);
    });
  });
}

/**
 * Restore version (placeholder for future enhancement)
 */
async function restoreVersionLocally(promptId, versionId) {
  return Promise.resolve(null);
}

/**
 * Clear all data
 */
async function clearAllDataLocally() {
  return new Promise((resolve) => {
    chrome.storage.local.clear(() => {
      resolve(true);
    });
  });
}

// ==================== Helper Functions ====================

/**
 * Truncate text
 */
function truncateText(text, length = 50) {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

// ==================== Context Menu ====================

/**
 * Create context menu for right-click prompt capture
 */
if (chrome.runtime && chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener(() => {
    try {
      if (chrome.contextMenus) {
        chrome.contextMenus.create({
          id: 'savePrompt',
          title: 'Save to Prompt Keeper',
          contexts: ['editable']
        });
      }
    } catch (error) {
      console.log('Context menus not available:', error);
    }
  });
}

/**
 * Handle context menu clicks
 */
if (chrome.contextMenus && chrome.contextMenus.onClicked) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'savePrompt') {
      chrome.tabs.sendMessage(tab.id, { action: 'captureSelectedText' });
    }
  });
}
