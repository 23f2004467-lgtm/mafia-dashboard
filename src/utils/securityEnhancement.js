// Security Enhancement Utility
// Implements additional security measures for the MAFIA Dashboard

import secureLogger from './secureLogger.js';

class SecurityEnhancement {
  constructor() {
    this.encryptionKey = process.env.REACT_APP_ENCRYPTION_KEY || 'mafia-dashboard-secure-key-2025';
    this.algorithm = 'AES-GCM';
    this.keyLength = 256;
  }

  // Generate a secure encryption key
  async generateEncryptionKey() {
    try {
      const key = await crypto.subtle.generateKey(
        {
          name: this.algorithm,
          length: this.keyLength
        },
        true,
        ['encrypt', 'decrypt']
      );
      return key;
    } catch (error) {
      secureLogger.error('Failed to generate encryption key', error);
      throw new Error('Encryption key generation failed');
    }
  }

  // Encrypt sensitive data
  async encryptData(data) {
    try {
      const key = await this.generateEncryptionKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encodedData = new TextEncoder().encode(JSON.stringify(data));
      
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: this.algorithm,
          iv: iv
        },
        key,
        encodedData
      );

      return {
        data: Array.from(new Uint8Array(encryptedData)),
        iv: Array.from(iv),
        algorithm: this.algorithm
      };
    } catch (error) {
      secureLogger.error('Encryption failed', error);
      throw new Error('Data encryption failed');
    }
  }

  // Decrypt sensitive data
  async decryptData(encryptedData) {
    try {
      const key = await this.generateEncryptionKey();
      const data = new Uint8Array(encryptedData.data);
      const iv = new Uint8Array(encryptedData.iv);
      
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: this.algorithm,
          iv: iv
        },
        key,
        data
      );

      const decodedData = new TextDecoder().decode(decryptedData);
      return JSON.parse(decodedData);
    } catch (error) {
      secureLogger.error('Decryption failed', error);
      throw new Error('Data decryption failed');
    }
  }

  // Validate session integrity
  validateSession(sessionData) {
    try {
      if (!sessionData || !sessionData.timestamp) {
        return false;
      }

      const sessionAge = Date.now() - sessionData.timestamp;
      const maxSessionAge = 60 * 60 * 1000; // 1 hour

      if (sessionAge > maxSessionAge) {
        secureLogger.security('Session expired', { sessionAge, maxSessionAge });
        return false;
      }

      return true;
    } catch (error) {
      secureLogger.error('Session validation failed', error);
      return false;
    }
  }

  // Sanitize user input for XSS prevention
  sanitizeInput(input) {
    if (typeof input !== 'string') {
      return input;
    }

    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .trim();
  }

  // Validate file upload security
  validateFileUpload(file) {
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];

    const maxSize = 5 * 1024 * 1024; // 5MB

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Only Excel and CSV files are allowed.');
    }

    if (file.size > maxSize) {
      throw new Error('File size too large. Maximum size is 5MB.');
    }

    return true;
  }

  // Generate secure random string
  generateSecureString(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      result += chars.charAt(array[i] % chars.length);
    }
    return result;
  }

  // Validate email format securely
  validateEmail(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  // Validate phone number (Indian format)
  validatePhone(phone) {
    if (!phone || typeof phone !== 'string') {
      return false;
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
  }

  // Check for suspicious activity
  detectSuspiciousActivity(activityLog) {
    const suspiciousPatterns = [
      { type: 'rapid_requests', threshold: 10, window: 60000 }, // 10 requests per minute
      { type: 'failed_logins', threshold: 5, window: 300000 }, // 5 failed logins per 5 minutes
      { type: 'data_access', threshold: 100, window: 60000 } // 100 data accesses per minute
    ];

    const now = Date.now();
    const suspiciousActivities = [];

    suspiciousPatterns.forEach(pattern => {
      const recentActivities = activityLog.filter(activity => 
        activity.type === pattern.type && 
        (now - activity.timestamp) < pattern.window
      );

      if (recentActivities.length >= pattern.threshold) {
        suspiciousActivities.push({
          type: pattern.type,
          count: recentActivities.length,
          threshold: pattern.threshold,
          window: pattern.window
        });
      }
    });

    return suspiciousActivities;
  }

  // Log security event
  logSecurityEvent(event, details = {}) {
    const securityEvent = {
      timestamp: new Date().toISOString(),
      event,
      details,
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: this.getSessionId()
    };

    secureLogger.security(event, details);
    
    // Store in localStorage for audit purposes
    try {
      const existingLogs = JSON.parse(localStorage.getItem('securityLogs') || '[]');
      existingLogs.push(securityEvent);
      
      // Keep only last 1000 events
      if (existingLogs.length > 1000) {
        existingLogs.splice(0, existingLogs.length - 1000);
      }
      
      localStorage.setItem('securityLogs', JSON.stringify(existingLogs));
    } catch (error) {
      secureLogger.error('Failed to store security log', error);
    }
  }

  // Get session ID
  getSessionId() {
    let sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = this.generateSecureString(32);
      sessionStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  }

  // Clear sensitive data
  clearSensitiveData() {
    try {
      sessionStorage.clear();
      localStorage.removeItem('userSession');
      localStorage.removeItem('formData');
      localStorage.removeItem('auditLogs');
      secureLogger.audit('Sensitive data cleared');
    } catch (error) {
      secureLogger.error('Failed to clear sensitive data', error);
    }
  }
}

// Create singleton instance
const securityEnhancement = new SecurityEnhancement();

export default securityEnhancement;





