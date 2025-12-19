# 🔐 Admin Portal Security Setup Guide

## 🎯 **Current Configuration**

✅ **Interviewer Portal**: Open access - anyone with Google account can access  
🔒 **Admin Portal**: Secure access - only authorized admin emails can access

## 🚀 **Setup Steps**

### **Step 1: Create Admin User in Firebase Authentication**

1. **Go to Firebase Console**
   - Visit: [https://console.firebase.google.com](https://console.firebase.google.com)
   - Select your project: `mafia-recruitments`

2. **Navigate to Authentication**
   - Click: **Authentication** in the left sidebar
   - Click: **Users** tab

3. **Add Admin User**
   - Click: **Add User**
   - Enter Email: `dheera1312@gmail.com`
   - Enter Password: `mafiaadmin2025` (or your preferred secure password)
   - Click: **Add user**

### **Step 2: Add Admin to Firestore (Manual)**

1. **Go to Firestore Database**
   - Click: **Firestore Database** in the left sidebar
   - Click: **Start collection** (if no collections exist)

2. **Create Admins Collection**
   - Collection ID: `admins`
   - Click: **Next**

3. **Add Admin Document**
   - Document ID: `dheera1312@gmail.com`
   - Add fields:
     - `email` (string): `dheera1312@gmail.com`
     - `role` (string): `admin`
     - `addedAt` (timestamp): Current time
     - `isActive` (boolean): `true`
     - `permissions` (array): `["read", "write", "delete", "admin"]`
   - Click: **Save**

### **Step 3: Test Admin Access**

1. **Access Admin Portal**
   - Go to your app: [https://mafia-dashboard.netlify.app/](https://mafia-dashboard.netlify.app/)
   - Navigate to admin portal

2. **Login with Admin Credentials**
   - Email: `dheera1312@gmail.com`
   - Password: `mafiaadmin2025` (or your chosen password)

3. **Verify Access**
   - Should see admin dashboard
   - Can view candidates, interviewers, analytics
   - Can export data, manage payments

## 🔒 **Security Features Implemented**

### **Admin Portal Security**
- ✅ **Email-based authentication** - Only authorized emails can log in
- ✅ **Firebase Auth integration** - Secure password-based login
- ✅ **Rate limiting** - Prevents brute force attacks
- ✅ **Session management** - Secure session handling
- ✅ **Audit logging** - Tracks all admin actions
- ✅ **Logout functionality** - Secure logout with session cleanup

### **Interviewer Portal (Open Access)**
- ✅ **Google OAuth** - Anyone with Google account can access
- ✅ **Email verification** - Must have verified email
- ✅ **Session tracking** - Monitors active interviewers
- ✅ **No restrictions** - Open for all interviewers

## 📋 **Admin Portal Features**

### **Dashboard Analytics**
- Total candidates count
- Payment statistics
- Revenue tracking
- Real-time updates

### **Candidate Management**
- View all candidates
- Search and filter
- Export to Excel
- Payment verification

### **Interviewer Management**
- View active interviewers
- Force logout all interviewers
- Session monitoring

### **Payment Management**
- Reverse payment confirmations
- Payment verification
- Transaction history

## 🛡️ **Security Best Practices**

### **For Admin Account**
1. **Use strong password** - Minimum 12 characters with complexity
2. **Enable 2FA** - Add two-factor authentication
3. **Regular password changes** - Update password periodically
4. **Secure access** - Only access from trusted devices
5. **Logout properly** - Always use logout button

### **For System Security**
1. **Monitor admin logs** - Check for suspicious activity
2. **Regular backups** - Backup data regularly
3. **Update credentials** - Change passwords periodically
4. **Access control** - Limit admin access to necessary personnel

## 🔧 **Troubleshooting**

### **Can't Access Admin Portal**
- Verify email is added to Firebase Auth
- Verify email is in Firestore admins collection
- Check password is correct
- Ensure Firebase Auth is enabled

### **Permission Denied Errors**
- Check Firestore security rules are deployed
- Verify admin email is in authorized list
- Check Firebase Auth user exists

### **Login Issues**
- Clear browser cache and cookies
- Try incognito/private browsing
- Check network connection
- Verify Firebase project configuration

## 📞 **Support**
If you encounter any issues, contact: **9591185310**

## 🔄 **Next Steps**
1. ✅ Set up admin account
2. ✅ Test admin access
3. ✅ Configure additional admin emails (if needed)
4. ✅ Train admin users on security practices
5. ✅ Set up monitoring and alerts
