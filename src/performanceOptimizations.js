// Performance Optimizations for High Traffic
// This module contains optimizations to handle increased user load

// Debounce function to limit frequent operations
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle function to limit operation frequency
export const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Cache management for frequently accessed data
export class DataCache {
  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  set(key, value, ttl = 5 * 60 * 1000) { // 5 minutes default TTL
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  clear() {
    this.cache.clear();
  }
}

// Performance monitoring
export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      pageLoadTime: 0,
      apiResponseTime: 0,
      memoryUsage: 0,
      activeConnections: 0
    };
    this.startTime = Date.now();
  }

  startTimer() {
    return Date.now();
  }

  endTimer(startTime) {
    return Date.now() - startTime;
  }

  logMetric(name, value) {
    this.metrics[name] = value;
    console.log(`Performance Metric - ${name}: ${value}ms`);
  }

  getMetrics() {
    return this.metrics;
  }
}

// Connection pooling for Firebase operations
export class ConnectionPool {
  constructor() {
    this.activeConnections = 0;
    this.maxConnections = 10;
    this.queue = [];
  }

  async execute(operation) {
    if (this.activeConnections >= this.maxConnections) {
      return new Promise((resolve, reject) => {
        this.queue.push({ operation, resolve, reject });
      });
    }

    this.activeConnections++;
    try {
      const result = await operation();
      this.activeConnections--;
      this.processQueue();
      return result;
    } catch (error) {
      this.activeConnections--;
      this.processQueue();
      throw error;
    }
  }

  processQueue() {
    if (this.queue.length > 0 && this.activeConnections < this.maxConnections) {
      const { operation, resolve, reject } = this.queue.shift();
      this.execute(operation).then(resolve).catch(reject);
    }
  }
}

// Lazy loading utilities
export const lazyLoad = (importFunc) => {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      importFunc().then(resolve);
    }, 100);
    return () => clearTimeout(timer);
  });
};

// Memory management
export class MemoryManager {
  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 30000); // Cleanup every 30 seconds
  }

  cleanup() {
    // Clear unused event listeners
    if (typeof window !== 'undefined' && window.gc) {
      window.gc();
    }
    
    // Clear localStorage if it's getting too large
    try {
      const keys = Object.keys(localStorage);
      if (keys.length > 50) {
        // Keep only essential data
        const essentialKeys = ['formData', 'userSession'];
        keys.forEach(key => {
          if (!essentialKeys.includes(key)) {
            localStorage.removeItem(key);
          }
        });
      }
    } catch (error) {
      console.warn('Memory cleanup error:', error);
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Rate limiting for high traffic
export class AdvancedRateLimiter {
  constructor() {
    this.requests = new Map();
    this.maxRequests = 100; // Max requests per minute
    this.windowMs = 60000; // 1 minute window
  }

  isAllowed(identifier) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    if (!this.requests.has(identifier)) {
      this.requests.set(identifier, []);
    }
    
    const userRequests = this.requests.get(identifier);
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(time => time > windowStart);
    this.requests.set(identifier, validRequests);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    return true;
  }

  cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    for (const [identifier, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => time > windowStart);
      if (validRequests.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, validRequests);
      }
    }
  }
}

// Export performance utilities
export const performanceUtils = {
  debounce,
  throttle,
  DataCache,
  PerformanceMonitor,
  ConnectionPool,
  lazyLoad,
  MemoryManager,
  AdvancedRateLimiter
};





