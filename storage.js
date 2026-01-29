/**
 * IndexedDB Storage Module
 * Manages all prompt data persistence
 */

class StorageManager {
  constructor() {
    this.dbName = 'PromptKeeperDB';
    this.version = 1;
    this.db = null;
    this.init();
  }

  /**
   * Initialize IndexedDB
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create prompts object store
        if (!db.objectStoreNames.contains('prompts')) {
          const promptStore = db.createObjectStore('prompts', { keyPath: 'id' });
          promptStore.createIndex('timestamp', 'timestamp', { unique: false });
          promptStore.createIndex('source', 'source', { unique: false });
          promptStore.createIndex('category', 'category', { unique: false });
        }

        // Create versions object store (tracks prompt versions)
        if (!db.objectStoreNames.contains('versions')) {
          const versionStore = db.createObjectStore('versions', { keyPath: 'id', autoIncrement: true });
          versionStore.createIndex('promptId', 'promptId', { unique: false });
          versionStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Create tags object store
        if (!db.objectStoreNames.contains('tags')) {
          db.createObjectStore('tags', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  /**
   * Save a new prompt
   */
  async savePrompt(promptData) {
    const prompt = {
      id: this.generateId(),
      title: promptData.title || 'Untitled Prompt',
      content: promptData.content,
      output: promptData.output || '',
      source: promptData.source || 'Unknown', // ChatGPT, Gemini, Claude, etc.
      category: promptData.category || 'General',
      tags: promptData.tags || [],
      timestamp: Date.now(),
      url: promptData.url || '',
      notes: promptData.notes || '',
      isFavorite: false,
      versions: []
    };

    return this.addToStore('prompts', prompt);
  }

  /**
   * Update an existing prompt
   */
  async updatePrompt(promptId, updates) {
    const prompt = await this.getPrompt(promptId);
    if (!prompt) throw new Error('Prompt not found');

    // Create a version before updating
    await this.createVersion(promptId, prompt);

    const updated = { ...prompt, ...updates, lastModified: Date.now() };
    return this.updateInStore('prompts', updated);
  }

  /**
   * Create a version snapshot of a prompt
   */
  async createVersion(promptId, promptData) {
    const version = {
      promptId,
      content: promptData.content,
      output: promptData.output,
      timestamp: Date.now(),
      note: 'Version snapshot'
    };

    return this.addToStore('versions', version);
  }

  /**
   * Get all versions of a prompt
   */
  async getVersions(promptId) {
    return this.queryStore('versions', 'promptId', promptId);
  }

  /**
   * Get a specific version
   */
  async getVersion(versionId) {
    return this.getFromStore('versions', versionId);
  }

  /**
   * Restore a prompt to a previous version
   */
  async restoreVersion(promptId, versionId) {
    const version = await this.getVersion(versionId);
    if (!version) throw new Error('Version not found');

    return this.updatePrompt(promptId, {
      content: version.content,
      output: version.output
    });
  }

  /**
   * Get a single prompt by ID
   */
  async getPrompt(promptId) {
    return this.getFromStore('prompts', promptId);
  }

  /**
   * Get all prompts
   */
  async getAllPrompts() {
    return this.getAllFromStore('prompts');
  }

  /**
   * Delete a prompt and its versions
   */
  async deletePrompt(promptId) {
    const versions = await this.getVersions(promptId);
    
    // Delete all versions
    for (const version of versions) {
      await this.deleteFromStore('versions', version.id);
    }

    // Delete prompt
    return this.deleteFromStore('prompts', promptId);
  }

  /**
   * Search prompts by title or content
   */
  async searchPrompts(query) {
    const prompts = await this.getAllPrompts();
    const lowerQuery = query.toLowerCase();

    return prompts.filter(p =>
      p.title.toLowerCase().includes(lowerQuery) ||
      p.content.toLowerCase().includes(lowerQuery) ||
      p.output.toLowerCase().includes(lowerQuery) ||
      (p.notes && p.notes.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Filter prompts by various criteria
   */
  async filterPrompts(filters) {
    const prompts = await this.getAllPrompts();

    return prompts.filter(p => {
      if (filters.source && p.source !== filters.source) return false;
      if (filters.category && p.category !== filters.category) return false;
      if (filters.tag && !p.tags.includes(filters.tag)) return false;
      if (filters.isFavorite && p.isFavorite !== filters.isFavorite) return false;
      if (filters.dateFrom && p.timestamp < filters.dateFrom) return false;
      if (filters.dateTo && p.timestamp > filters.dateTo) return false;
      return true;
    });
  }

  /**
   * Toggle favorite status
   */
  async toggleFavorite(promptId) {
    const prompt = await this.getPrompt(promptId);
    if (!prompt) throw new Error('Prompt not found');

    prompt.isFavorite = !prompt.isFavorite;
    return this.updateInStore('prompts', prompt);
  }

  /**
   * Add or remove tags
   */
  async updateTags(promptId, tags) {
    const prompt = await this.getPrompt(promptId);
    if (!prompt) throw new Error('Prompt not found');

    prompt.tags = tags;
    return this.updateInStore('prompts', prompt);
  }

  /**
   * Export all prompts as JSON
   */
  async exportPrompts() {
    const prompts = await this.getAllPrompts();
    const versions = await this.getAllFromStore('versions');
    
    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      prompts,
      versions
    };
  }

  /**
   * Import prompts from JSON
   */
  async importPrompts(data) {
    if (!data.prompts || !Array.isArray(data.prompts)) {
      throw new Error('Invalid import format');
    }

    for (const prompt of data.prompts) {
      // Generate new ID to avoid conflicts
      const newId = this.generateId();
      prompt.id = newId;
      await this.addToStore('prompts', prompt);
    }

    if (data.versions && Array.isArray(data.versions)) {
      for (const version of data.versions) {
        await this.addToStore('versions', version);
      }
    }

    return { imported: data.prompts.length };
  }

  // ==================== Helper Methods ====================

  /**
   * Generate unique ID
   */
  generateId() {
    return `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Add item to object store
   */
  async addToStore(storeName, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add(data);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(data);
    });
  }

  /**
   * Update item in object store
   */
  async updateInStore(storeName, data) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(data);
    });
  }

  /**
   * Get item from store
   */
  async getFromStore(storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Get all items from store
   */
  async getAllFromStore(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Query store by index
   */
  async queryStore(storeName, indexName, value) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Delete item from store
   */
  async deleteFromStore(storeName, key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(true);
    });
  }

  /**
   * Clear all data
   */
  async clearAllData() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['prompts', 'versions', 'tags'], 'readwrite');
      
      transaction.objectStore('prompts').clear();
      transaction.objectStore('versions').clear();
      transaction.objectStore('tags').clear();

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve(true);
    });
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StorageManager;
}
