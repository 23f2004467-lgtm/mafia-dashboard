// Content Security Policy Configuration
// This file defines the CSP headers for the MAFIA Dashboard

const cspConfig = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'", // Required for React
    "'unsafe-eval'",   // Required for React development
    "https://www.gstatic.com",
    "https://www.googleapis.com",
    "https://firebaseapp.com",
    "https://firebase.googleapis.com"
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'", // Required for React
    "https://fonts.googleapis.com"
  ],
  'font-src': [
    "'self'",
    "https://fonts.gstatic.com",
    "data:"
  ],
  'img-src': [
    "'self'",
    "data:",
    "https:",
    "blob:"
  ],
  'connect-src': [
    "'self'",
    "https://firebaseapp.com",
    "https://firebase.googleapis.com",
    "https://identitytoolkit.googleapis.com",
    "https://securetoken.googleapis.com",
    "https://www.googleapis.com"
  ],
  'frame-src': [
    "'self'",
    "https://firebaseapp.com"
  ],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'upgrade-insecure-requests': [],
  'block-all-mixed-content': [],
  'referrer-policy': ["strict-origin-when-cross-origin"]
};

// Convert CSP config to header string
const generateCSPHeader = () => {
  return Object.entries(cspConfig)
    .map(([directive, sources]) => {
      if (sources.length === 0) {
        return directive;
      }
      return `${directive} ${sources.join(' ')}`;
    })
    .join('; ');
};

// Export CSP header
export const CSP_HEADER = generateCSPHeader();

// Development CSP (more permissive)
export const DEV_CSP_HEADER = generateCSPHeader().replace(
  "'unsafe-eval'",
  "'unsafe-eval' 'unsafe-inline'"
);

export default cspConfig;


