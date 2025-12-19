// Secure Admin Authentication System
import { auth, db } from './firebaseConfig';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// Admin email addresses - hardcoded for production
const AUTHORIZED_ADMIN_EMAILS = [
  'dheera1312@gmail.com',
  '23f2004467@ds.study.iitm.ac.in',
  'admin@mafia.com',
  'mafiahr2024@gmail.com',
  'yuktibhatia2005@gmail.com'
];

export const SecureAdminAuth = {
  // Check if user is authorized admin
  async isAuthorizedAdmin(email) {
    if (!email) {
      return false;
    }
    
    try {
      // First check if email is in authorized list (fast check)
      if (AUTHORIZED_ADMIN_EMAILS.includes(email)) {
        return true;
      }
      
      // If not in authorized list, try to check Firestore
      try {
        const adminDoc = await getDoc(doc(db, 'admins', email));
        if (adminDoc.exists()) {
          const adminData = adminDoc.data();
          return adminData.isActive === true;
        }
      } catch (firestoreError) {
        // Could not check Firestore admin document
        // If we can't access Firestore, fall back to authorized list
        return AUTHORIZED_ADMIN_EMAILS.includes(email);
      }
      
      return false;
    } catch (error) {
      console.error('Error checking admin authorization:', error);
      // Fall back to authorized list check
      return AUTHORIZED_ADMIN_EMAILS.includes(email);
    }
  },

  // Secure admin login
  async adminLogin(email, password) {
    try {
      // Attempt Firebase Auth login first
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Verify admin status
      const isAdmin = await this.isAuthorizedAdmin(user.email);
      if (!isAdmin) {
        await signOut(auth);
        throw new Error('User is not authorized as admin. Please ensure admin document exists in Firestore.');
      }

      // Try to log admin login (but don't fail if it doesn't work)
      try {
        await setDoc(doc(db, 'adminLogs', `${Date.now()}_${user.email}`), {
          email: user.email,
          action: 'admin_login',
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          ip: 'client-side'
        });
      } catch (logError) {
        // Could not log admin login
        // Don't fail the login if logging fails
      }

      return user;
    } catch (error) {
      console.error('Admin login failed:', error);
      throw error;
    }
  },

  // Secure admin logout
  async adminLogout() {
    try {
      const user = auth.currentUser;
      
      // Log admin logout
      if (user) {
        await setDoc(doc(db, 'adminLogs', `${Date.now()}_${user.email}`), {
          email: user.email,
          action: 'admin_logout',
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent
        });
      }
      
      await signOut(auth);
    } catch (error) {
      console.error('Admin logout failed:', error);
      // Still sign out even if logging fails
      await signOut(auth);
    }
  },

  // Get current admin user
  getCurrentAdmin() {
    return auth.currentUser;
  },

  // Check if user is currently authenticated as admin
  async isAuthenticatedAdmin() {
    const user = auth.currentUser;
    if (!user) return false;
    
    return await this.isAuthorizedAdmin(user.email);
  }
};
