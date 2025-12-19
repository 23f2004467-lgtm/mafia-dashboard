// Script to clear all candidate data from Firebase
// Run this script to remove all existing candidate data before importing new data

import { db } from "./src/firebaseConfig.js";
import { collection, getDocs, deleteDoc } from "firebase/firestore";

async function clearAllCandidateData() {
  try {
    console.log("🚀 Starting data cleanup...");
    
    // Clear candidates collection
    console.log("📋 Clearing candidates collection...");
    const candidatesRef = collection(db, "candidates");
    const candidatesSnapshot = await getDocs(candidatesRef);
    
    if (candidatesSnapshot.empty) {
      console.log("ℹ️ No candidates found to delete.");
    } else {
      const candidateDeletePromises = candidatesSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(candidateDeletePromises);
      console.log(`✅ Deleted ${candidatesSnapshot.docs.length} candidate records`);
    }
    
    // Clear payment sessions collection
    console.log("💳 Clearing payment sessions collection...");
    const paymentSessionsRef = collection(db, "paymentSessions");
    const paymentSnapshot = await getDocs(paymentSessionsRef);
    
    if (paymentSnapshot.empty) {
      console.log("ℹ️ No payment sessions found to delete.");
    } else {
      const paymentDeletePromises = paymentSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(paymentDeletePromises);
      console.log(`✅ Deleted ${paymentSnapshot.docs.length} payment session records`);
    }
    
    console.log("🎉 Data cleanup completed successfully!");
    console.log(`📊 Summary:`);
    console.log(`   - Candidates deleted: ${candidatesSnapshot.docs.length}`);
    console.log(`   - Payment sessions deleted: ${paymentSnapshot.docs.length}`);
    
  } catch (error) {
    console.error("❌ Error during data cleanup:", error);
    throw error;
  }
}

// Export the function for use in other modules
export { clearAllCandidateData };

// If running this script directly
if (import.meta.url === `file://${process.argv[1]}`) {
  clearAllCandidateData()
    .then(() => {
      console.log("✅ Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Script failed:", error);
      process.exit(1);
    });
}

