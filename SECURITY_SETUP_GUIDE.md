# 🔒 MAFIA Dashboard - Security Setup Guide

## 🚨 **CRITICAL: Immediate Security Actions Required**

### 1. **Set Up Environment Variables** ⚠️ URGENT

Create a `.env` file in your project root with the following variables:

```bash
# Copy env.example to .env and fill in your actual values
cp env.example .env
```

**Required Environment Variables:**
```bash
# Firebase Configuration (Get these from Firebase Console)
REACT_APP_FIREBASE_API_KEY=your_actual_api_key_here
REACT_APP_FIREBASE_AUTH_DOMAIN=mafia-recruitments.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=mafia-recruitments
REACT_APP_FIREBASE_STORAGE_BUCKET=mafia-recruitments.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=316736328372
REACT_APP_FIREBASE_APP_ID=1:316736328372:web:ab968ccc772dc74018fde1

# Admin Configuration
REACT_APP_ADMIN_EMAILS=dheera1312@gmail.com,admin@mafia.com

# Security Configuration
REACT_APP_MAX_LOGIN_ATTEMPTS=5
REACT_APP_SESSION_TIMEOUT=3600000
REACT_APP_RATE_LIMIT_WINDOW=60000
REACT_APP_LOCKOUT_DURATION=900000

# Application Configuration
REACT_APP_ENVIRONMENT=production
REACT_APP_DEBUG_MODE=false
REACT_APP_ENABLE_CONSOLE_LOGS=false
```

### 2. **Update Firebase Security Rules** ⚠️ URGENT

Ensure your `firestore.rules` file is properly configured and deployed:

```bash
# Deploy updated security rules
firebase deploy --only firestore:rules
```

### 3. **Remove Console Logging** ⚠️ URGENT

The application now uses secure logging. Console logs will only appear in development mode.

## 🛡️ **Security Features Implemented**

### **Authentication & Authorization**
- ✅ Firebase Authentication with email verification
- ✅ Admin email whitelist from environment variables
- ✅ Rate limiting on login attempts
- ✅ Account lockout after failed attempts
- ✅ Secure session management

### **Data Protection**
- ✅ Input validation and sanitization
- ✅ XSS protection
- ✅ SQL injection prevention
- ✅ Secure data transmission (HTTPS)

### **Access Control**
- ✅ Role-based access control
- ✅ Firebase Security Rules
- ✅ Admin-only sections protected
- ✅ Session timeout and cleanup

### **Monitoring & Logging**
- ✅ Secure logging utility
- ✅ Audit trail for all actions
- ✅ Security event tracking
- ✅ Failed login monitoring

## 🔧 **Configuration Steps**

### **Step 1: Environment Setup**
1. Create `.env` file from `env.example`
2. Fill in your Firebase configuration
3. Set admin email addresses
4. Configure security parameters

### **Step 2: Firebase Configuration**
1. Go to Firebase Console
2. Navigate to Project Settings
3. Copy your web app configuration
4. Update your `.env` file

### **Step 3: Security Rules Deployment**
1. Verify `firestore.rules` file
2. Deploy rules to Firebase
3. Test access permissions

### **Step 4: Production Deployment**
1. Set `REACT_APP_ENVIRONMENT=production`
2. Set `REACT_APP_DEBUG_MODE=false`
3. Set `REACT_APP_ENABLE_CONSOLE_LOGS=false`
4. Build and deploy application

## 📋 **Security Checklist**

### **✅ Environment Variables**
- [ ] Firebase API key configured
- [ ] Admin emails set
- [ ] Security parameters configured
- [ ] Debug mode disabled in production

### **✅ Firebase Security**
- [ ] Security rules deployed
- [ ] Authentication enabled
- [ ] Email verification required
- [ ] Admin access restricted

### **✅ Application Security**
- [ ] Input validation active
- [ ] XSS protection enabled
- [ ] Rate limiting configured
- [ ] Session management active

### **✅ Monitoring**
- [ ] Audit logging enabled
- [ ] Security events tracked
- [ ] Failed login monitoring
- [ ] Console logging disabled in production

## 🚨 **Security Best Practices**

### **For Administrators**
1. **Regular Security Reviews**: Monthly security audits
2. **Password Policy**: Use strong passwords
3. **Access Monitoring**: Review admin access logs
4. **Backup Strategy**: Regular data backups
5. **Incident Response**: Document response procedures

### **For Users**
1. **Secure Login**: Use strong Google account passwords
2. **Session Management**: Logout when finished
3. **Data Validation**: Verify data before submission
4. **Suspicious Activity**: Report unusual behavior

## 🔍 **Security Testing**

### **Test Authentication**
```bash
# Test admin login
# Test rate limiting
# Test account lockout
# Test session timeout
```

### **Test Data Validation**
```bash
# Test input sanitization
# Test XSS prevention
# Test SQL injection prevention
# Test file upload validation
```

### **Test Access Control**
```bash
# Test admin-only sections
# Test interviewer permissions
# Test database access rules
# Test API endpoint protection
```

## 📞 **Security Contact**

For security concerns or incidents:
- **Emergency**: 9591185310
- **Email**: security@mafia.com
- **Response Time**: Within 1 hour

## 🔄 **Regular Security Maintenance**

### **Weekly**
- Review security logs
- Check for failed login attempts
- Monitor suspicious activities

### **Monthly**
- Security audit review
- Update dependencies
- Review access permissions

### **Quarterly**
- Penetration testing
- Security rule review
- Incident response drill

---

**⚠️ IMPORTANT**: This guide must be followed completely before deploying to production. Failure to implement these security measures may result in data breaches or unauthorized access.

**Last Updated**: ${new Date().toISOString()}
**Security Level**: Confidential


