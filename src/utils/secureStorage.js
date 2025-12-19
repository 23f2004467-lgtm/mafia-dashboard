// Secure Storage Utility
// Provides safe localStorage operations with encryption and validation

import secureLogger from './secureLogger.js';

class SecureStorage {
  constructor() {
    this.encryptionKey = process.env.REACT_APP_STORAGE_KEY || 'mafia-dashboard-2025';
    this.maxAge = 24 * 60 * 60 * 1000; // 24 hours
  }

  // Simple encryption for sensitive data
  encrypt(data) {
    try {
      const jsonString = JSON.stringify(data);
      // In production, use a proper encryption library
      // This is a basic obfuscation for development
      return btoa(jsonString);
    } catch (error) {
      secureLogger.error('Encryption failed', error);
      return null;
    }
  }

  // Decrypt data
  decrypt(encryptedData) {
    try {
      const jsonString = atob(encryptedData);
      return JSON.parse(jsonString);
    } catch (error) {
      secureLogger.error('Decryption failed', error);
      return null;
    }
  }

  // Set item with expiration and encryption
  setItem(key, value, options = {}) {
    try {
      const data = {
        value: value,
        timestamp: Date.now(),
        expires: options.expires || this.maxAge
      };

      const encrypted = this.encrypt(data);
      if (encrypted) {
        localStorage.setItem(key, encrypted);
        secureLogger.audit('Storage set', { key, hasValue: !!value });
        return true;
      }
      return false;
    } catch (error) {
      secureLogger.error('Failed to set storage item', { key, error });
      return false;
    }
  }

  // Get item with decryption and expiration check
  getItem(key) {
    try {
      const encrypted = localStorage.getItem(key);
      if (!encrypted) return null;

      const data = this.decrypt(encrypted);
      if (!data) return null;

      // Check expiration
      if (Date.now() - data.timestamp > data.expires) {
        this.removeItem(key);
        return null;
      }

      secureLogger.audit('Storage get', { key, hasValue: !!data.value });
      return data.value;
    } catch (error) {
      secureLogger.error('Failed to get storage item', { key, error });
      return null;
    }
  }

  // Remove item
  removeItem(key) {
    try {
      localStorage.removeItem(key);
      secureLogger.audit('Storage remove', { key });
      return true;
    } catch (error) {
      secureLogger.error('Failed to remove storage item', { key, error });
      return false;
    }
  }

  // Clear all items
  clear() {
    try {
      localStorage.clear();
      secureLogger.audit('Storage cleared');
      return true;
    } catch (error) {
      secureLogger.error('Failed to clear storage', error);
      return false;
    }
  }

  // Get all keys
  keys() {
    try {
      return Object.keys(localStorage);
    } catch (error) {
      secureLogger.error('Failed to get storage keys', error);
      return [];
    }
  }

  // Check if key exists
  hasItem(key) {
    try {
      return localStorage.getItem(key) !== null;
    } catch (error) {
      secureLogger.error('Failed to check storage item', { key, error });
      return false;
    }
  }

  // Get storage size
  getSize() {
    try {
      let size = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          size += localStorage[key].length;
        }
      }
      return size;
    } catch (error) {
      secureLogger.error('Failed to get storage size', error);
      return 0;
    }
  }

  // Clean expired items
  cleanup() {
    try {
      const keys = this.keys();
      let cleaned = 0;

      keys.forEach(key => {
        const item = this.getItem(key);
        if (item === null) {
          // Item was expired and removed
          cleaned++;
        }
      });

      if (cleaned > 0) {
        secureLogger.audit('Storage cleanup', { cleaned });
      }

      return cleaned;
    } catch (error) {
      secureLogger.error('Failed to cleanup storage', error);
      return 0;
    }
  }
}

// Create singleton instance
const secureStorage = new SecureStorage();

// Auto-cleanup on page load
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    secureStorage.cleanup();
  });
}

export default secureStorage;


