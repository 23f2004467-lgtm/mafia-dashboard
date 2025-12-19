const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDocs, updateDoc, collection } = require('firebase/firestore');
const XLSX = require('xlsx');

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

class SecondYearPreferenceFixer {
  constructor() {
    this.updated = 0;
    this.errors = [];
    this.excelData = new Map();
  }

  // Load Excel data for 2nd year students
  loadExcelData() {
    console.log('Loading Excel data...');
    const workbook = XLSX.readFile('Mafia TalentComm WorkComm Recruitments 25-26 Responses (4).xlsx');
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // Get headers from first row
    const headers = jsonData[0];
    
    // Process rows starting from index 1
    jsonData.slice(1).forEach((row, index) => {
      const obj = {};
      headers.forEach((header, colIndex) => {
        if (header && row[colIndex] !== undefined) {
          obj[header] = row[colIndex];
        }
      });
      
      // Check if this is a 2nd year student
      const academicYear = obj['Academic Year'];
      if (academicYear && academicYear.toString().toLowerCase().includes('2nd year')) {
        const regNo = obj['Reg No.']?.toString().trim();
        if (regNo) {
          // Store the correct preferences for 2nd year students
          this.excelData.set(regNo, {
            name: obj['Name'],
            regNo: regNo,
            talentCommPref1: row[12] || '', // Column 13
            talentCommPref2: row[13] || '', // Column 14
            workCommPref1: '', // Empty for 2nd year
            workCommPref2: '', // Empty for 2nd year
            workCommPref3: ''  // Empty for 2nd year
          });
        }
      }
    });
    
    console.log(`Found ${this.excelData.size} 2nd year students in Excel`);
  }

  // Update Firebase data
  async updateFirebaseData() {
    console.log('Loading existing candidates from Firebase...');
    
    try {
      const querySnapshot = await getDocs(collection(db, 'candidates'));
      const candidates = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log(`Loaded ${candidates.length} candidates from Firebase`);
      
      // Find 2nd year students that need updating
      const secondYearCandidates = candidates.filter(cand => 
        cand.year && cand.year.toString().toLowerCase().includes('2nd year')
      );
      
      console.log(`Found ${secondYearCandidates.length} 2nd year students in Firebase`);
      
      // Update each 2nd year student
      for (const candidate of secondYearCandidates) {
        const excelData = this.excelData.get(candidate.regNo);
        
        if (excelData) {
          try {
            const ref = doc(db, 'candidates', candidate.id);
            await updateDoc(ref, {
              preferences: {
                talentComm: {
                  pref1: excelData.talentCommPref1,
                  pref2: excelData.talentCommPref2
                },
                workComm: {
                  pref1: excelData.workCommPref1,
                  pref2: excelData.workCommPref2,
                  pref3: excelData.workCommPref3
                }
              },
              lastUpdatedBy: 'Second Year Preference Fixer',
              lastUpdatedAt: new Date().toISOString()
            });
            
            this.updated++;
            console.log(`✅ Updated ${candidate.name} (${candidate.regNo}): TalentComm = "${excelData.talentCommPref1}", "${excelData.talentCommPref2}"`);
            
          } catch (error) {
            this.errors.push({
              candidate: candidate.name,
              regNo: candidate.regNo,
              error: error.message
            });
            console.error(`❌ Failed to update ${candidate.name}:`, error.message);
          }
        } else {
          console.log(`⚠️  No Excel data found for ${candidate.name} (${candidate.regNo})`);
        }
      }
      
    } catch (error) {
      console.error('Error loading candidates:', error);
      throw error;
    }
  }

  // Main function
  async fixSecondYearPreferences() {
    console.log('🚀 Fixing 2nd Year Students TalentComm Preferences');
    console.log('================================================');
    
    try {
      // Step 1: Load Excel data
      this.loadExcelData();
      
      // Step 2: Update Firebase data
      await this.updateFirebaseData();
      
      // Step 3: Report results
      console.log('\n✅ Update completed!');
      console.log(`📊 Results:`);
      console.log(`• Updated: ${this.updated} 2nd year students`);
      console.log(`• Errors: ${this.errors.length}`);
      
      if (this.errors.length > 0) {
        console.log('\n❌ Error details:');
        this.errors.slice(0, 5).forEach(error => {
          console.log(`• ${error.candidate} (${error.regNo}): ${error.error}`);
        });
        if (this.errors.length > 5) {
          console.log(`... and ${this.errors.length - 5} more errors`);
        }
      }
      
      console.log('\n🎯 Fix completed! 2nd year students should now show correct TalentComm preferences.');
      
    } catch (error) {
      console.error('❌ Script failed:', error);
    }
  }
}

// Run the script
const fixer = new SecondYearPreferenceFixer();
fixer.fixSecondYearPreferences();


