import { auth, db } from './firebaseConfig';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export const AdminSetup = {
  // Create admin user in Firebase Authentication
  async createAdminUser(email, password) {
    try {
      console.log('Creating admin user...');
      
      // Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('Admin user created in Authentication:', user.email);
      
      // Add admin document to Firestore
      await setDoc(doc(db, 'admins', email), {
        email: email,
        role: 'admin',
        addedAt: new Date().toISOString(),
        isActive: true,
        permissions: ['read', 'write', 'delete', 'admin'],
        createdBy: 'setup_script'
      }, { merge: true });
      
      // Also add to authorized emails list in secureAdminAuth
      console.log('Admin document created in Firestore');
      
      // Wait a moment for Firestore to sync
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Admin document created in Firestore');
      
      // Sign out after creation
      await auth.signOut();
      
      return { success: true, message: 'Admin user created successfully!' };
    } catch (error) {
      console.error('Error creating admin user:', error);
      
      if (error.code === 'auth/email-already-in-use') {
        // User already exists, try to sign in to verify
        try {
          await signInWithEmailAndPassword(auth, email, password);
          
          // Try to create admin document while signed in
          try {
            await setDoc(doc(db, 'admins', email), {
              email: email,
              role: 'admin',
              addedAt: new Date().toISOString(),
              isActive: true,
              permissions: ['read', 'write', 'delete', 'admin'],
              createdBy: 'setup_script'
            }, { merge: true });
            console.log('Admin document created/updated in Firestore');
          } catch (firestoreError) {
            console.log('Could not create admin document:', firestoreError.message);
          }
          
          await auth.signOut();
          return { success: true, message: 'Admin user already exists and credentials are correct!' };
        } catch (signInError) {
          return { success: false, message: 'Admin user exists but password is incorrect. Please reset password in Firebase Console.' };
        }
      }
      
      return { success: false, message: `Error: ${error.message}` };
    }
  },

  // Test admin login
  async testAdminLogin(email, password) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await auth.signOut();
      return { success: true, message: 'Admin login test successful!' };
    } catch (error) {
      return { success: false, message: `Login test failed: ${error.message}` };
    }
  },

  // Verify admin setup
  async verifyAdminSetup(email) {
    try {
      // Sign in to get proper permissions for reading admin document
      const userCredential = await signInWithEmailAndPassword(auth, email, 'mafiaadmin2025');
      const user = userCredential.user;
      
      // Check if admin document exists in Firestore
      const adminDoc = await getDoc(doc(db, 'admins', email));
      if (!adminDoc.exists()) {
        await auth.signOut();
        return { success: false, message: 'Admin document not found in Firestore' };
      }
      
      const adminData = adminDoc.data();
      await auth.signOut();
      
      return { 
        success: true, 
        message: `Admin setup verified! Role: ${adminData.role}, Active: ${adminData.isActive}` 
      };
    } catch (error) {
      return { success: false, message: `Verification failed: ${error.message}` };
    }
  }
};
