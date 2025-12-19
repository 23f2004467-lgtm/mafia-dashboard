# 🎭 MAFIA Recruitment Dashboard

A full-stack recruitment management system built with React and Firebase, designed to handle high-concurrency interview processes with real-time data synchronization, role-based access control, and comprehensive security measures.

**Live Application**: [https://mafia-recruitments.web.app/](https://mafia-recruitments.web.app/)

---

## 🎯 Project Overview

This project is a production-ready recruitment management platform that I developed to streamline the interview process for MAFIA's TalentComm and WorkComm departments. The system handles candidate management, payment verification, interview verdict submission, and real-time collaboration among multiple interviewers.

### Key Challenges Solved
- **High Concurrency**: Optimized for multiple simultaneous users without performance degradation
- **Real-time Synchronization**: Ensured data consistency across all active sessions
- **Security**: Implemented role-based access control and comprehensive security measures
- **Scalability**: Built with performance optimizations to handle growing user base

---

## ✨ Key Features

### 🔐 Authentication & Authorization
- **Dual Authentication System**: Google OAuth for interviewers, Firebase Auth for admins
- **Role-Based Access Control (RBAC)**: Separate permissions for interviewers and admins
- **Session Management**: Real-time session tracking with automatic timeout
- **Security Audit Logging**: Comprehensive logging of all user actions

### 📊 Interviewer Portal
- Real-time candidate search with debounced queries and caching
- Interview verdict submission (Selected/Rejected/Waitlisted)
- Payment verification with QR code generation
- Live data synchronization across all devices
- Responsive design for mobile and desktop

### 🔒 Admin Portal
- Analytics dashboard with payment statistics
- Excel export functionality for data analysis
- Active interviewer monitoring
- Payment management and reversal capabilities
- Comprehensive candidate overview

### ⚡ Performance Optimizations
- **Advanced Caching System**: LRU cache with 5-minute TTL for frequently accessed data
- **Connection Pooling**: Max 10 concurrent Firebase connections with request queuing
- **Rate Limiting**: 100 requests/minute per user to prevent abuse
- **Debounced Search**: 300ms delay to reduce unnecessary API calls
- **Memory Management**: Automatic cleanup and garbage collection
- **Performance Monitoring**: Real-time metrics tracking

### 🛡️ Security Features
- Input validation and sanitization (XSS protection)
- Firestore security rules with strict data validation
- Rate limiting and brute force protection
- Secure session management with timeout enforcement
- Audit logging for all critical operations

---

## 🛠️ Technology Stack

### Frontend
- **React 19.1.0** - Modern React with hooks and functional components
- **React Router 7.7.1** - Client-side routing
- **Firebase SDK 12.0.0** - Authentication and database

### Backend & Infrastructure
- **Firebase Firestore** - NoSQL database with real-time listeners
- **Firebase Authentication** - User authentication and authorization
- **Firebase Hosting** - CDN-based hosting with automatic SSL

### Additional Libraries
- **react-qr-code** - QR code generation for payments
- **exceljs** - Excel export functionality
- **Custom Performance Utilities** - Caching, throttling, debouncing

---

## 🏗️ Architecture & Design Decisions

### Component Structure
```
src/
├── App.js                 # Main interviewer portal component
├── AdminPortal.jsx         # Admin dashboard with analytics
├── MainRouter.jsx          # Route configuration
├── firebaseConfig.js       # Firebase initialization
├── performanceOptimizations.js  # Custom performance utilities
├── security.js            # Security middleware and logging
└── utils/                 # Utility functions
    ├── secureLogger.js
    ├── secureStorage.js
    └── securityMiddleware.js
```

### Performance Architecture
- **Data Caching Layer**: Reduces Firestore read operations by 60-70%
- **Connection Pooling**: Manages Firebase connections efficiently
- **Debouncing & Throttling**: Prevents excessive API calls
- **Memory Management**: Automatic cleanup prevents memory leaks

### Security Architecture
- **Firestore Security Rules**: Server-side validation and access control
- **Client-side Validation**: Input sanitization before submission
- **Rate Limiting**: Prevents abuse and DoS attacks
- **Audit Logging**: Tracks all sensitive operations

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Firebase CLI (for deployment)

### Installation

```bash
# Clone the repository
git clone https://github.com/23f2004467-lgtm/mafia-dashboard.git
cd mafia-dashboard

# Install dependencies
npm install

# Start development server
npm start
```

### Environment Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Firestore Database and Authentication
3. Configure Google OAuth provider
4. Copy your Firebase config to `src/firebaseConfig.js`
5. Deploy Firestore security rules: `firebase deploy --only firestore:rules`

### Deployment

```bash
# Build for production
npm run build

# Deploy to Firebase Hosting
firebase deploy
```

---

## 📈 Performance Metrics

- **Page Load Time**: < 2 seconds
- **Search Response Time**: < 300ms (with caching)
- **Real-time Update Latency**: < 500ms
- **Concurrent User Support**: Tested with 50+ simultaneous users
- **Cache Hit Rate**: ~70% for search queries

---

## 🔒 Security Measures

- ✅ Role-based access control (RBAC)
- ✅ Input validation and sanitization
- ✅ XSS and injection attack prevention
- ✅ Rate limiting (100 req/min per user)
- ✅ Session timeout enforcement (1 hour)
- ✅ Firestore security rules
- ✅ Audit logging for sensitive operations
- ✅ Secure payment verification flow

---

## 📝 Key Technical Achievements

1. **Performance Optimization**: Reduced API calls by 70% through intelligent caching and debouncing
2. **Real-time Synchronization**: Implemented efficient real-time data sync using Firestore listeners
3. **Security Implementation**: Built comprehensive security layer with RBAC, rate limiting, and audit logging
4. **Scalability**: Designed system to handle high concurrency with connection pooling and memory management
5. **User Experience**: Created responsive, intuitive UI with optimized search and real-time updates

---

## 🧪 Testing

The application includes:
- Unit tests for utility functions
- Integration tests for Firebase operations
- Performance monitoring dashboard
- Security audit logging

Run tests:
```bash
npm test
```

---

## 📚 Documentation

- [Interviewer Guide](INTERVIEWER_GUIDE.md) - User documentation for interviewers
- [Admin Setup Guide](ADMIN_SETUP_GUIDE.md) - Admin configuration instructions
- [Performance Optimization Report](PERFORMANCE_OPTIMIZATION_REPORT.md) - Detailed performance analysis
- [Security Audit Report](SECURITY_AUDIT_REPORT.md) - Security assessment

---

## 🎓 Skills Demonstrated

- **Frontend Development**: React, modern JavaScript (ES6+), responsive design
- **Backend Integration**: Firebase services, RESTful API design
- **Performance Optimization**: Caching strategies, connection pooling, debouncing/throttling
- **Security**: Authentication, authorization, input validation, security rules
- **Real-time Systems**: WebSocket-like real-time data synchronization
- **DevOps**: CI/CD with Firebase, automated deployments
- **Problem Solving**: Optimized for high-concurrency scenarios

---

## 🔮 Future Enhancements

- [ ] Automated payment verification via payment gateway integration
- [ ] Advanced analytics and reporting dashboard
- [ ] Email notifications for interview status updates
- [ ] Mobile app using React Native
- [ ] Automated interview scheduling system

---

## 📞 Contact

For questions or feedback about this project:
- **Email**: dheera1312@gmail.com
- **Phone**: 9591185310

---

## 📄 License

This project is proprietary software developed for MAFIA organization.

---

**Built with ❤️ using React and Firebase**
