// Security Middleware for MAFIA Dashboard
// This utility provides security functions and validation

import secureLogger from './secureLogger.js';

// Security configuration
const SECURITY_CONFIG = {
  maxLoginAttempts: parseInt(process.env.REACT_APP_MAX_LOGIN_ATTEMPTS) || 5,
  sessionTimeout: parseInt(process.env.REACT_APP_SESSION_TIMEOUT) || 3600000,
  rateLimitWindow: parseInt(process.env.REACT_APP_RATE_LIMIT_WINDOW) || 60000,
  lockoutDuration: parseInt(process.env.REACT_APP_LOCKOUT_DURATION) || 900000,
  minPaymentAmount: parseInt(process.env.REACT_APP_MIN_PAYMENT_AMOUNT) || 100,
  maxPaymentAmount: parseInt(process.env.REACT_APP_MAX_PAYMENT_AMOUNT) || 10000,
  maxFileSize: parseInt(process.env.REACT_APP_MAX_FILE_SIZE) || 5242880
};

// Input validation patterns
const VALIDATION_PATTERNS = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  phone: /^[6-9]\d{9}$/,
  regNo: /^[A-Z0-9]{5,20}$/,
  name: /^[a-zA-Z\s]{2,100}$/,
  amount: /^\d+(\.\d{1,2})?$/,
  verificationCode: /^[A-Z0-9]{6}$/
};

// Security validation functions
export const SecurityValidator = {
  // Validate email format
  validateEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return VALIDATION_PATTERNS.email.test(email) && email.length <= 254;
  },

  // Validate phone number
  validatePhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    const cleanPhone = phone.replace(/\D/g, '');
    return VALIDATION_PATTERNS.phone.test(cleanPhone);
  },

  // Validate registration number
  validateRegNo(regNo) {
    if (!regNo || typeof regNo !== 'string') return false;
    return VALIDATION_PATTERNS.regNo.test(regNo);
  },

  // Validate name
  validateName(name) {
    if (!name || typeof name !== 'string') return false;
    return VALIDATION_PATTERNS.name.test(name.trim());
  },

  // Validate payment amount
  validateAmount(amount) {
    if (!amount || isNaN(amount)) return false;
    const numAmount = parseFloat(amount);
    return numAmount === 300;
  },

  // Validate verification code
  validateVerificationCode(code) {
    if (!code || typeof code !== 'string') return false;
    return VALIDATION_PATTERNS.verificationCode.test(code);
  },

  // Validate file size
  validateFileSize(size) {
    return size <= SECURITY_CONFIG.maxFileSize;
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

  // Validate candidate data
  validateCandidateData(data) {
    const errors = [];

    if (!this.validateName(data.name)) {
      errors.push('Invalid name format');
    }

    if (!this.validateRegNo(data.regNo)) {
      errors.push('Invalid registration number format');
    }

    if (!['1st year', '2nd year', '1st Year', '2nd Year'].includes(data.year)) {
      errors.push('Invalid academic year');
    }

    if (data.whatsappNumber && !this.validatePhone(data.whatsappNumber)) {
      errors.push('Invalid phone number format');
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
  },

  // Validate payment data
  validatePaymentData(data) {
    const errors = [];

    if (!this.validateAmount(data.amount)) {
      errors.push('Invalid payment amount');
    }

    if (!['pending', 'completed', 'cancelled'].includes(data.status)) {
      errors.push('Invalid payment status');
    }

    if (data.verificationCode && !this.validateVerificationCode(data.verificationCode)) {
      errors.push('Invalid verification code format');
    }

    return errors;
  }
};

// Rate limiting utility
export class RateLimiter {
  constructor() {
    this.attempts = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  checkLimit(key, maxAttempts = SECURITY_CONFIG.maxLoginAttempts, windowMs = SECURITY_CONFIG.rateLimitWindow) {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Remove old attempts
    const validAttempts = attempts.filter(timestamp => now - timestamp < windowMs);
    
    if (validAttempts.length >= maxAttempts) {
      secureLogger.security('Rate limit exceeded', { key, attempts: validAttempts.length });
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

// Session management utility
export class SessionManager {
  constructor() {
    this.sessionTimeout = SECURITY_CONFIG.sessionTimeout;
    this.lockoutDuration = SECURITY_CONFIG.lockoutDuration;
    this.failedAttempts = new Map();
  }

  recordLoginAttempt(userId, success) {
    const attempts = this.failedAttempts.get(userId) || { count: 0, lastAttempt: 0 };
    
    if (success) {
      this.failedAttempts.delete(userId);
      secureLogger.audit('Login successful', { userId });
    } else {
      attempts.count++;
      attempts.lastAttempt = Date.now();
      this.failedAttempts.set(userId, attempts);
      secureLogger.security('Login failed', { userId, attempts: attempts.count });
    }
  }

  isLockedOut(userId) {
    const attempts = this.failedAttempts.get(userId);
    if (!attempts) return false;
    
    if (attempts.count >= SECURITY_CONFIG.maxLoginAttempts) {
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
    secureLogger.audit('Session cleared');
  }
}

// Security headers utility
export const SecurityHeaders = {
  // Get security headers for the application
  getHeaders() {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      'Strict-Transport-Security': `max-age=${process.env.REACT_APP_HSTS_MAX_AGE || 31536000}; includeSubDomains`
    };
  },

  // Apply security headers to document
  applyHeaders() {
    // Note: In a real application, these headers would be set by the server
    // This is for demonstration purposes
    secureLogger.info('Security headers would be applied here');
  }
};

// Export security configuration
export { SECURITY_CONFIG, VALIDATION_PATTERNS };
