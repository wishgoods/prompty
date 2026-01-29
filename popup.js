/**
 * Popup Script
 * Handles UI interactions and communication with background script
 */

// ==================== Global State ====================

let currentPrompts = [];
let currentEditingPrompt = null;
let currentTab = 'prompts';

// ==================== DOM Elements ====================

const promptsList = document.getElementById('promptsList');
const favoritesList = document.getElementById('favoritesList');
const searchInput = document.getElementById('searchInput');
const sourceFilter = document.getElementById('sourceFilter');
const categoryFilter = document.getElementById('categoryFilter');
const favoritesBtn = document.getElementById('favoritesBtn');
const newPromptBtn = document.getElementById('newPromptBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const settingsBtn = document.getElementById('settingsBtn');

const promptModal = document.getElementById('promptModal');
const modalTitle = document.getElementById('modalTitle');
const promptTitle = document.getElementById('promptTitle');
const promptContent = document.getElementById('promptContent');
const promptOutput = document.getElementById('promptOutput');
const promptCategory = document.getElementById('promptCategory');
const promptSource = document.getElementById('promptSource');
const promptTags = document.getElementById('promptTags');
const promptNotes = document.getElementById('promptNotes');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const deleteBtn = document.getElementById('deleteBtn');
const modalCloseBtn = document.querySelector('.modal-close');

const exportAllBtn = document.getElementById('exportAllBtn');
const importDataBtn = document.getElementById('importDataBtn');
const clearDataBtn = document.getElementById('clearDataBtn');
const importFile = document.getElementById('importFile');

const totalCountEl = document.getElementById('totalCount');
const favoritesCountEl = document.getElementById('favoritesCount');

const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// ==================== Event Listeners ====================

// Tab Navigation
tabButtons.forEach(btn => {
  btn.addEventListener('click', (e) => {
    currentTab = e.target.dataset.tab;
    switchTab(currentTab);
  });
});

// New Prompt Button
newPromptBtn.addEventListener('click', openNewPromptModal);

// Export/Import
exportBtn.addEventListener('click', exportPrompts);
importBtn.addEventListener('click', () => importFile.click());
exportAllBtn.addEventListener('click', exportAllData);
importDataBtn.addEventListener('click', () => importFile.click());
importFile.addEventListener('change', handleFileImport);

// Settings
settingsBtn.addEventListener('click', () => switchTab('settings'));
clearDataBtn.addEventListener('click', clearAllData);

// Modal Controls
cancelBtn.addEventListener('click', closeModal);
modalCloseBtn.addEventListener('click', closeModal);
saveBtn.addEventListener('click', savePrompt);
deleteBtn.addEventListener('click', deletePrompt);

// Search & Filter
searchInput.addEventListener('input', debounce(filterAndSearch, 300));
sourceFilter.addEventListener('change', debounce(filterAndSearch, 300));
categoryFilter.addEventListener('change', debounce(filterAndSearch, 300));
favoritesBtn.addEventListener('click', filterByFavorites);

// Close modal when clicking outside
promptModal.addEventListener('click', (e) => {
  if (e.target === promptModal) {
    closeModal();
  }
});

// ==================== Initialization ====================

document.addEventListener('DOMContentLoaded', () => {
  loadAllPrompts();
  updateStatistics();
});

// ==================== Load Data ====================

/**
 * Load all prompts from storage
 */
async function loadAllPrompts() {
  try {
    chrome.runtime.sendMessage({ action: 'getAllPrompts' }, (response) => {
      if (response.success) {
        currentPrompts = response.prompts || [];
        renderPrompts(currentPrompts);
        updateStatistics();
      } else {
        console.error('Error loading prompts:', response.error);
      }
    });
  } catch (error) {
    console.error('Error loading prompts:', error);
  }
}

/**
 * Render prompts to the UI
 */
function renderPrompts(prompts) {
  const container = currentTab === 'prompts' ? promptsList : favoritesList;
  
  if (prompts.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <p>📭 No prompts found</p>
        <p class="empty-hint">Try adjusting your search or filters</p>
      </div>
    `;
    return;
  }

  container.innerHTML = prompts.map(prompt => `
    <div class="prompt-card" data-id="${prompt.id}">
      <div class="prompt-header">
        <h3 class="prompt-title">${escapeHtml(prompt.title)}</h3>
        <div class="prompt-actions">
          <button class="icon-btn favorite-btn" title="Add to favorites" data-id="${prompt.id}">
            ${prompt.isFavorite ? '⭐' : '☆'}
          </button>
          <button class="icon-btn edit-btn" title="Edit" data-id="${prompt.id}">
            ✏️
          </button>
          <button class="icon-btn copy-btn" title="Copy prompt" data-id="${prompt.id}">
            📋
          </button>
        </div>
      </div>

      <p class="prompt-preview">${escapeHtml(truncateText(prompt.content, 150))}</p>

      <div class="prompt-meta">
        <span class="badge badge-source">${prompt.source}</span>
        <span class="badge badge-category">${prompt.category}</span>
        <span class="badge badge-date">${formatDate(prompt.timestamp)}</span>
      </div>

      ${prompt.tags && prompt.tags.length > 0 ? `
        <div class="prompt-tags">
          ${prompt.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');

  // Attach event listeners to buttons
  attachPromptCardListeners();
}

/**
 * Attach event listeners to prompt cards
 */
function attachPromptCardListeners() {
  document.querySelectorAll('.favorite-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(btn.dataset.id);
    });
  });

  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditPromptModal(btn.dataset.id);
    });
  });

  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyPromptToClipboard(btn.dataset.id);
    });
  });

  document.querySelectorAll('.prompt-card').forEach(card => {
    card.addEventListener('click', () => {
      openEditPromptModal(card.dataset.id);
    });
  });
}

// ==================== Modal Functions ====================

/**
 * Open modal for new prompt
 */
function openNewPromptModal() {
  currentEditingPrompt = null;
  modalTitle.textContent = 'Create New Prompt';
  deleteBtn.style.display = 'none';

  // Clear form
  promptTitle.value = '';
  promptContent.value = '';
  promptOutput.value = '';
  promptCategory.value = 'General';
  promptSource.value = 'ChatGPT';
  promptTags.value = '';
  promptNotes.value = '';

  promptModal.style.display = 'flex';
  promptTitle.focus();
}

/**
 * Open modal to edit existing prompt
 */
function openEditPromptModal(promptId) {
  const prompt = currentPrompts.find(p => p.id === promptId);
  if (!prompt) return;

  currentEditingPrompt = prompt;
  modalTitle.textContent = 'Edit Prompt';
  deleteBtn.style.display = 'inline-block';

  // Populate form
  promptTitle.value = prompt.title;
  promptContent.value = prompt.content;
  promptOutput.value = prompt.output || '';
  promptCategory.value = prompt.category;
  promptSource.value = prompt.source;
  promptTags.value = (prompt.tags || []).join(', ');
  promptNotes.value = prompt.notes || '';

  promptModal.style.display = 'flex';
  promptTitle.focus();
}

/**
 * Close modal
 */
function closeModal() {
  promptModal.style.display = 'none';
  currentEditingPrompt = null;
}

// ==================== Save & Delete ====================

/**
 * Save prompt
 */
async function savePrompt() {
  const title = promptTitle.value.trim();
  const content = promptContent.value.trim();

  if (!title || !content) {
    alert('Title and content are required');
    return;
  }

  const promptData = {
    title,
    content,
    output: promptOutput.value,
    category: promptCategory.value,
    source: promptSource.value,
    tags: promptTags.value
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag),
    notes: promptNotes.value
  };

  if (currentEditingPrompt) {
    // Update existing
    chrome.runtime.sendMessage({
      action: 'updatePrompt',
      promptId: currentEditingPrompt.id,
      updates: promptData
    }, (response) => {
      if (response.success) {
        loadAllPrompts();
        closeModal();
      } else {
        alert('Error saving prompt: ' + response.error);
      }
    });
  } else {
    // Create new
    chrome.runtime.sendMessage({
      action: 'savePrompt',
      prompt: promptData
    }, (response) => {
      if (response.success) {
        loadAllPrompts();
        closeModal();
      } else {
        alert('Error saving prompt: ' + response.error);
      }
    });
  }
}

/**
 * Delete prompt
 */
function deletePrompt() {
  if (!currentEditingPrompt) return;

  if (confirm('Are you sure you want to delete this prompt?')) {
    chrome.runtime.sendMessage({
      action: 'deletePrompt',
      promptId: currentEditingPrompt.id
    }, (response) => {
      if (response.success) {
        loadAllPrompts();
        closeModal();
      } else {
        alert('Error deleting prompt: ' + response.error);
      }
    });
  }
}

// ==================== Favorites & Toggle ====================

/**
 * Toggle favorite status
 */
function toggleFavorite(promptId) {
  chrome.runtime.sendMessage({
    action: 'toggleFavorite',
    promptId
  }, (response) => {
    if (response.success) {
      loadAllPrompts();
    }
  });
}

/**
 * Filter by favorites
 */
function filterByFavorites() {
  const filtered = currentPrompts.filter(p => p.isFavorite);
  renderPrompts(filtered);
}

// ==================== Copy to Clipboard ====================

/**
 * Copy prompt content to clipboard
 */
async function copyPromptToClipboard(promptId) {
  const prompt = currentPrompts.find(p => p.id === promptId);
  if (!prompt) return;

  try {
    await navigator.clipboard.writeText(prompt.content);
    showNotification('Copied to clipboard! ✓');
  } catch (error) {
    console.error('Error copying to clipboard:', error);
  }
}

/**
 * Show notification toast
 */
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-size: 13px;
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
  `;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 2500);
}

// ==================== Search & Filter ====================

/**
 * Filter and search prompts
 */
function filterAndSearch() {
  const query = searchInput.value.toLowerCase();
  const source = sourceFilter.value;
  const category = categoryFilter.value;

  let filtered = currentPrompts;

  // Search by query
  if (query) {
    filtered = filtered.filter(p =>
      p.title.toLowerCase().includes(query) ||
      p.content.toLowerCase().includes(query) ||
      (p.notes && p.notes.toLowerCase().includes(query))
    );
  }

  // Filter by source
  if (source) {
    filtered = filtered.filter(p => p.source === source);
  }

  // Filter by category
  if (category) {
    filtered = filtered.filter(p => p.category === category);
  }

  renderPrompts(filtered);
}

// ==================== Export/Import ====================

/**
 * Export prompts as JSON
 */
function exportPrompts() {
  const filtered = currentTab === 'prompts' ? currentPrompts : currentPrompts.filter(p => p.isFavorite);
  
  if (filtered.length === 0) {
    alert('No prompts to export');
    return;
  }

  exportData(filtered);
}

/**
 * Export all prompts
 */
function exportAllData() {
  chrome.runtime.sendMessage({ action: 'exportPrompts' }, (response) => {
    if (response.success) {
      exportData(response.data);
    }
  });
}

/**
 * Download data as JSON
 */
function exportData(data) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `prompt-keeper-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showNotification('Prompts exported successfully! ✓');
}

/**
 * Handle file import
 */
async function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (confirm(`Import ${data.prompts?.length || 0} prompts?`)) {
      chrome.runtime.sendMessage({
        action: 'importPrompts',
        data
      }, (response) => {
        if (response.success) {
          loadAllPrompts();
          showNotification(`Imported ${response.result.imported} prompts! ✓`);
        }
      });
    }
  } catch (error) {
    alert('Error importing file: ' + error.message);
  }

  // Reset file input
  importFile.value = '';
}

/**
 * Clear all data
 */
function clearAllData() {
  if (confirm('Are you sure? This will delete all your prompts permanently.')) {
    if (confirm('This action cannot be undone. Continue?')) {
      chrome.runtime.sendMessage({ action: 'clearAllData' }, (response) => {
        if (response.success) {
          loadAllPrompts();
          showNotification('All data cleared');
        }
      });
    }
  }
}

// ==================== Tab Switching ====================

/**
 * Switch active tab
 */
function switchTab(tabName) {
  tabButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  tabContents.forEach(content => {
    content.classList.toggle('active', content.id === tabName);
  });

  currentTab = tabName;

  if (tabName === 'favorites') {
    const favorites = currentPrompts.filter(p => p.isFavorite);
    renderPrompts(favorites);
  } else if (tabName === 'prompts') {
    renderPrompts(currentPrompts);
  }
}

// ==================== Statistics ====================

/**
 * Update statistics display
 */
function updateStatistics() {
  totalCountEl.textContent = currentPrompts.length;
  favoritesCountEl.textContent = currentPrompts.filter(p => p.isFavorite).length;
}

// ==================== Utility Functions ====================

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Truncate text
 */
function truncateText(text, length = 150) {
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

/**
 * Format date
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
 * Debounce function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
