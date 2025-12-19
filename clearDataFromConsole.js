// Script to clear all candidate data from browser console
// Copy and paste this into your browser console when on the admin portal

async function clearAllDataFromConsole() {
  try {
    console.log("🚀 Starting data cleanup from console...");
    
    // Get Firebase instance from the page
    const { db } = window.firebase || {};
    if (!db) {
      console.error("❌ Firebase not found. Make sure you're on the admin portal page.");
      return;
    }
    
    // Import Firebase functions
    const { collection, getDocs, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    
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
    
    // Refresh the page to update the UI
    alert(`✅ Successfully deleted ${candidatesSnapshot.docs.length} candidates and ${paymentSnapshot.docs.length} payment sessions!`);
    window.location.reload();
    
  } catch (error) {
    console.error("❌ Error during data cleanup:", error);
    alert("❌ Error clearing data: " + error.message);
  }
}

// Alternative simpler approach using the existing admin portal function
function clearDataUsingAdminPortal() {
  // This will trigger the existing clearAllCandidateData function
  if (window.clearAllCandidateData) {
    window.clearAllCandidateData();
  } else {
    console.log("❌ Admin portal function not found. Use clearAllDataFromConsole() instead.");
  }
}

console.log("📋 Data clearing functions available:");
console.log("- clearAllDataFromConsole() - Direct Firebase clearing");
console.log("- clearDataUsingAdminPortal() - Use existing admin portal function");

