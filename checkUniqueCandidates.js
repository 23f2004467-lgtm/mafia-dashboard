const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDb6LRxf9RDfQIa9l6ge5ZWl5ITTPjs4dk",
  authDomain: "mafia-recruitments.firebaseapp.com",
  projectId: "mafia-recruitments",
  storageBucket: "mafia-recruitments.firebasestorage.app",
  messagingSenderId: "316736328372",
  appId: "1:316736328372:web:ab968ccc772dc74018fde1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkUniqueCandidates() {
  try {
    console.log('🔍 Checking unique candidates in Firebase database...');
    
    const candidatesRef = collection(db, 'candidates');
    const snapshot = await getDocs(candidatesRef);
    
    const candidates = [];
    const uniqueNames = new Set();
    const uniqueRegNos = new Set();
    const uniqueWhatsApp = new Set();
    const yearCounts = { '1st Year': 0, '2nd Year': 0 };
    
    snapshot.forEach(doc => {
      const data = doc.data();
      candidates.push(data);
      
      if (data.name) uniqueNames.add(data.name.toLowerCase().trim());
      if (data.regNo) uniqueRegNos.add(data.regNo.toString().trim());
      if (data.whatsappNumber && data.whatsappNumber !== 'N/A') {
        uniqueWhatsApp.add(data.whatsappNumber.toString().trim());
      }
      
      if (data.year) {
        yearCounts[data.year] = (yearCounts[data.year] || 0) + 1;
      }
    });
    
    console.log('\n📊 Firebase Database Analysis:');
    console.log(`Total candidates: ${candidates.length}`);
    console.log(`Unique names: ${uniqueNames.size}`);
    console.log(`Unique registration numbers: ${uniqueRegNos.size}`);
    console.log(`Unique WhatsApp numbers: ${uniqueWhatsApp.size}`);
    console.log(`\nBy Academic Year:`);
    console.log(`1st Year: ${yearCounts['1st Year'] || 0}`);
    console.log(`2nd Year: ${yearCounts['2nd Year'] || 0}`);
    
    // Check for potential duplicates
    const nameCounts = {};
    const regNoCounts = {};
    
    candidates.forEach(candidate => {
      const name = candidate.name?.toLowerCase().trim();
      const regNo = candidate.regNo?.toString().trim();
      
      if (name) nameCounts[name] = (nameCounts[name] || 0) + 1;
      if (regNo) regNoCounts[regNo] = (regNoCounts[regNo] || 0) + 1;
    });
    
    const duplicateNames = Object.entries(nameCounts).filter(([name, count]) => count > 1);
    const duplicateRegNos = Object.entries(regNoCounts).filter(([regNo, count]) => count > 1);
    
    console.log(`\n🔍 Duplicate Analysis:`);
    console.log(`Names with duplicates: ${duplicateNames.length}`);
    console.log(`Registration numbers with duplicates: ${duplicateRegNos.length}`);
    
    if (duplicateNames.length > 0) {
      console.log('\n📝 Sample duplicate names:');
      duplicateNames.slice(0, 5).forEach(([name, count]) => {
        console.log(`  "${name}": ${count} times`);
      });
    }
    
    if (duplicateRegNos.length > 0) {
      console.log('\n📝 Sample duplicate registration numbers:');
      duplicateRegNos.slice(0, 5).forEach(([regNo, count]) => {
        console.log(`  "${regNo}": ${count} times`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking candidates:', error);
  }
}

// Run the check
checkUniqueCandidates();
