// Secure Logging Utility
// This utility provides secure logging that respects environment variables
// and doesn't expose sensitive data in production

const isDevelopment = process.env.NODE_ENV === 'development';
const isDebugMode = process.env.REACT_APP_DEBUG_MODE === 'true';
const enableConsoleLogs = process.env.REACT_APP_ENABLE_CONSOLE_LOGS === 'true';

class SecureLogger {
  constructor() {
    this.shouldLog = isDevelopment || isDebugMode || enableConsoleLogs;
  }

  // Secure info logging
  info(message, data = null) {
    if (this.shouldLog) {
      console.log(`[INFO] ${message}`, data ? this.sanitizeData(data) : '');
    }
  }

  // Secure warning logging
  warn(message, data = null) {
    if (this.shouldLog) {
      console.warn(`[WARN] ${message}`, data ? this.sanitizeData(data) : '');
    }
  }

  // Secure error logging (always logs errors)
  error(message, error = null) {
    console.error(`[ERROR] ${message}`, error ? this.sanitizeError(error) : '');
  }

  // Secure debug logging (only in development)
  debug(message, data = null) {
    if (isDevelopment) {
      console.log(`[DEBUG] ${message}`, data ? this.sanitizeData(data) : '');
    }
  }

  // Sanitize sensitive data before logging
  sanitizeData(data) {
    if (!data) return data;
    
    const sensitiveFields = [
      'password', 'token', 'apiKey', 'secret', 'key',
      'auth', 'authorization', 'session', 'cookie',
      'credit', 'card', 'payment', 'bank', 'ssn'
    ];

    if (typeof data === 'object') {
      const sanitized = { ...data };
      
      // Remove sensitive fields
      sensitiveFields.forEach(field => {
        if (sanitized[field]) {
          sanitized[field] = '[REDACTED]';
        }
      });

      // Sanitize nested objects
      Object.keys(sanitized).forEach(key => {
        if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
          sanitized[key] = this.sanitizeData(sanitized[key]);
        }
      });

      return sanitized;
    }

    return data;
  }

  // Sanitize error objects
  sanitizeError(error) {
    if (!error) return error;

    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: isDevelopment ? error.stack : '[REDACTED]'
      };
    }

    return this.sanitizeData(error);
  }

  // Log security events (always logged)
  security(event, details = {}) {
    console.warn(`[SECURITY] ${event}`, this.sanitizeData(details));
  }

  // Log audit events (always logged)
  audit(event, details = {}) {
    console.info(`[AUDIT] ${event}`, this.sanitizeData(details));
  }
}

// Create singleton instance
const secureLogger = new SecureLogger();

export default secureLogger;


