// Comprehensive Security System for MAFIA Recruitment
import { db } from './firebaseConfig';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Security configuration
const SECURITY_CONFIG = {
  maxLoginAttempts: 5, // Restored to secure setting
  lockoutDuration: 15 * 60 * 1000, // Restored to 15 minutes
  sessionTimeout: 60 * 60 * 1000, // 1 hour
  maxRequestsPerMinute: 60,
  suspiciousActivityThreshold: 10
};

// Security utilities
export const SecurityUtils = {
  // Generate secure random string
  generateSecureRandom(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      result += chars.charAt(array[i] % chars.length);
    }
    return result;
  },

  // Hash sensitive data
  async hashData(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // Validate email format
  validateEmail(email) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email) && email.length <= 254;
  },

  // Validate phone number
  validatePhone(phone) {
    const phoneRegex = /^[6-9]\d{9}$/;
    return phoneRegex.test(phone.replace(/\D/g, ''));
  },

  // Validate registration number
  validateRegNo(regNo) {
    const regNoRegex = /^[A-Z0-9]{5,20}$/;
    return regNoRegex.test(regNo);
  },

  // Sanitize HTML input
  sanitizeHTML(input) {
    if (typeof input !== 'string') return '';
    
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
  },

  // Get client IP (approximate)
  getClientIP() {
    // This is a client-side approximation
    return 'client-side';
  },

  // Get user agent
  getUserAgent() {
    return navigator.userAgent;
  },

  // Get session ID
  getSessionId() {
    let sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
      sessionId = this.generateSecureRandom(32);
      sessionStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  }
};

// Rate limiting system
class RateLimiter {
  constructor() {
    this.attempts = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Clean up every minute
  }

  checkLimit(key, maxAttempts, windowMs) {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Remove old attempts
    const validAttempts = attempts.filter(timestamp => now - timestamp < windowMs);
    
    if (validAttempts.length >= maxAttempts) {
      return false;
    }
    
    validAttempts.push(now);
    this.attempts.set(key, validAttempts);
    return true;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, attempts] of this.attempts.entries()) {
      const validAttempts = attempts.filter(timestamp => now - timestamp < 300000); // 5 minutes
      if (validAttempts.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, validAttempts);
      }
    }
  }
}

// Session management
class SessionManager {
  constructor() {
    this.sessionTimeout = SECURITY_CONFIG.sessionTimeout;
    this.maxLoginAttempts = SECURITY_CONFIG.maxLoginAttempts;
    this.lockoutDuration = SECURITY_CONFIG.lockoutDuration;
    this.failedAttempts = new Map();
  }

  recordLoginAttempt(userId, success) {
    const attempts = this.failedAttempts.get(userId) || { count: 0, lastAttempt: 0 };
    
    if (success) {
      this.failedAttempts.delete(userId);
    } else {
      attempts.count++;
      attempts.lastAttempt = Date.now();
      this.failedAttempts.set(userId, attempts);
    }
  }

  isLockedOut(userId) {
    const attempts = this.failedAttempts.get(userId);
    if (!attempts) return false;
    
    if (attempts.count >= this.maxLoginAttempts) {
      const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
      if (timeSinceLastAttempt < this.lockoutDuration) {
        return true;
      } else {
        this.failedAttempts.delete(userId);
      }
    }
    return false;
  }

  clearSession() {
    sessionStorage.clear();
    localStorage.removeItem('userSession');
  }
}

// Audit logging
class AuditLogger {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000;
  }

  async logEvent(event, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details,
      userAgent: SecurityUtils.getUserAgent(),
      sessionId: SecurityUtils.getSessionId(),
      url: window.location.href,
      ip: SecurityUtils.getClientIP()
    };

    this.logs.push(logEntry);
    
    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Store in localStorage for debugging
    localStorage.setItem('auditLogs', JSON.stringify(this.logs));

    // Send to Firestore if user is authenticated
    try {
      const user = JSON.parse(localStorage.getItem('userSession') || '{}');
      if (user.email) {
        await setDoc(doc(db, 'securityLogs', `${Date.now()}_${user.email}`), {
          ...logEntry,
          userEmail: user.email
        });
      }
    } catch (error) {
      console.error('Failed to log to Firestore:', error);
    }

    console.warn('Security audit:', logEntry);
  }
}

// Input validation
class InputValidator {
  static validateCandidateData(data) {
    const errors = [];

    if (!data.name || data.name.length < 2 || data.name.length > 100) {
      errors.push('Invalid name');
    }

    if (!SecurityUtils.validateRegNo(data.regNo)) {
      errors.push('Invalid registration number');
    }

    if (!['1st year', '2nd year', '1st Year', '2nd Year'].includes(data.year)) {
      errors.push('Invalid year');
    }

    if (data.whatsappNumber && !SecurityUtils.validatePhone(data.whatsappNumber)) {
      errors.push('Invalid phone number');
    }

    if (data.college && data.college.length > 200) {
      errors.push('College name too long');
    }

    if (data.branch && data.branch.length > 100) {
      errors.push('Branch name too long');
    }

    if (data.comments && data.comments.length > 500) {
      errors.push('Comments too long');
    }

    return errors;
  }

  static validatePaymentData(data) {
    const errors = [];

    if (!data.amount || data.amount !== 300) {
      errors.push('Invalid payment amount (must be ₹300)');
    }

    if (!['pending', 'completed', 'cancelled'].includes(data.status)) {
      errors.push('Invalid payment status');
    }

    return errors;
  }

  static sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return SecurityUtils.sanitizeHTML(input);
  }
}

// Initialize security instances
const rateLimiter = new RateLimiter();
const sessionManager = new SessionManager();
const auditLogger = new AuditLogger();

// Export security system
export const FirebaseSecurity = {
  rateLimiter,
  sessionManager,
  auditLogger,
  validator: InputValidator,
  utils: SecurityUtils,
  config: SECURITY_CONFIG
}; 