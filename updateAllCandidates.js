const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, doc, setDoc, updateDoc } = require('firebase/firestore');
const XLSX = require('xlsx');
const fs = require('fs');

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

// Temporary security rules for import
const temporaryRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;

class CandidateUpdater {
  constructor() {
    this.processed = 0;
    this.updated = 0;
    this.added = 0;
    this.errors = [];
    this.existingCandidates = new Map();
  }

  // Load existing candidates from Firebase
  async loadExistingCandidates() {
    try {
      console.log('Loading existing candidates from Firebase...');
      const candidatesRef = collection(db, 'candidates');
      const snapshot = await getDocs(candidatesRef);
      
      snapshot.forEach(doc => {
        const data = doc.data();
        const nameKey = data.name?.toString().toLowerCase().trim();
        const regNoKey = data.regNo?.toString().trim();
        const whatsappKey = data.whatsappNumber?.toString().trim();
        
        if (nameKey) this.existingCandidates.set(`name:${nameKey}`, doc.id);
        if (regNoKey) this.existingCandidates.set(`regno:${regNoKey}`, doc.id);
        if (whatsappKey && whatsappKey !== 'N/A') {
          this.existingCandidates.set(`whatsapp:${whatsappKey}`, doc.id);
        }
      });
      
      console.log(`Loaded ${this.existingCandidates.size / 3} existing candidates`);
    } catch (error) {
      console.error('Error loading existing candidates:', error);
    }
  }

  // Generate registration number if missing
  generateRegNo(index) {
    return `IMPORT_${String(index + 1).padStart(4, '0')}`;
  }

  // Validate and clean data
  validateAndCleanData(row, index) {
    try {
      const academicYear = row['Academic Year'];
      if (!academicYear) {
        throw new Error('Academic Year not specified');
      }

      const isFirstYear = academicYear.toString().toLowerCase().includes('1st year') || 
                         academicYear.toString().toLowerCase().includes('first year') ||
                         academicYear.toString().toLowerCase().includes('1');
      const isSecondYear = academicYear.toString().toLowerCase().includes('2nd year') || 
                          academicYear.toString().toLowerCase().includes('second year') ||
                          academicYear.toString().toLowerCase().includes('2');
      
      if (!isFirstYear && !isSecondYear) {
        throw new Error('Invalid Academic Year format');
      }

      const safeRegNo = row['Reg No.'] || this.generateRegNo(index);
      const documentId = safeRegNo.toString().replace(/[^a-zA-Z0-9]/g, '_');

      const candidateData = {
        name: row['Name']?.toString() || `Candidate ${index + 1}`,
        regNo: safeRegNo.toString(),
        year: isFirstYear ? "1st Year" : "2nd Year",
        college: row['College']?.toString() || 'N/A',
        branch: row['Branch']?.toString() || 'N/A',
        whatsappNumber: row['Whatsapp No.']?.toString() || 'N/A',
        preferences: {
          talentComm: { pref1: '', pref2: '' },
          workComm: { pref1: '', pref2: '', pref3: '' }
        },
        verdict: { talentComm: [], workComm: [] },
        comments: '',
        paid: false,
        paymentDetails: null,
        lastUpdatedBy: 'Update All Script',
        lastUpdatedAt: new Date().toISOString()
      };

      // Handle 1st year students - use standard preference columns (8-12)
      if (isFirstYear) {
        candidateData.preferences.talentComm = {
          pref1: row['TalentComm Preference 1']?.toString() || '',
          pref2: row['TalentComm Preference 2']?.toString() || ''
        };
        candidateData.preferences.workComm = {
          pref1: row['WorkComm Preference 1']?.toString() || '',
          pref2: row['WorkComm Preference 2']?.toString() || '',
          pref3: row['WorkComm Preference 3 (optional)']?.toString() || ''
        };
      }
      
      // Handle 2nd year students - use the LAST two columns for TalentComm only (13-14)
      if (isSecondYear) {
        // For 2nd year students, we need to access the duplicate column names
        // Since XLSX uses the first occurrence, we need to access by index
        const allValues = Object.values(row);
        candidateData.preferences.talentComm = {
          pref1: allValues[12]?.toString() || '', // Column 13 (index 12)
          pref2: allValues[13]?.toString() || ''  // Column 14 (index 13)
        };
        candidateData.preferences.workComm = {
          pref1: '',
          pref2: '',
          pref3: ''
        };
      }

      return { candidateData, documentId };
    } catch (error) {
      this.errors.push({
        row: index + 1,
        error: error.message,
        data: row
      });
      return null;
    }
  }

  // Check if candidate exists
  findExistingCandidate(candidateData) {
    const nameKey = candidateData.name?.toString().toLowerCase().trim();
    const regNoKey = candidateData.regNo?.toString().trim();
    const whatsappKey = candidateData.whatsappNumber?.toString().trim();
    
    // Check by registration number first (most reliable)
    if (regNoKey && this.existingCandidates.has(`regno:${regNoKey}`)) {
      return this.existingCandidates.get(`regno:${regNoKey}`);
    }
    
    // Check by name
    if (nameKey && this.existingCandidates.has(`name:${nameKey}`)) {
      return this.existingCandidates.get(`name:${nameKey}`);
    }
    
    // Check by WhatsApp number
    if (whatsappKey && whatsappKey !== 'N/A' && this.existingCandidates.has(`whatsapp:${whatsappKey}`)) {
      return this.existingCandidates.get(`whatsapp:${whatsappKey}`);
    }
    
    return null;
  }

  // Save or update candidate
  async saveOrUpdateCandidate(candidateData, documentId, existingDocId = null) {
    try {
      if (existingDocId) {
        // Update existing candidate
        const ref = doc(db, "candidates", existingDocId);
        await updateDoc(ref, {
          ...candidateData,
          lastUpdatedBy: 'Update All Script',
          lastUpdatedAt: new Date().toISOString()
        });
        this.updated++;
        return true;
      } else {
        // Add new candidate
        const ref = doc(db, "candidates", documentId);
        await setDoc(ref, candidateData);
        this.added++;
        return true;
      }
    } catch (error) {
      console.error('Error saving/updating candidate:', error);
      return false;
    }
  }

  // Process Excel file
  async updateFromExcel(filePath) {
    try {
      console.log('Reading Excel file...');
      
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        throw new Error('Excel file must have at least a header row and one data row');
      }

      const headers = jsonData[0];
      const rows = jsonData.slice(1).map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          if (header && row[index] !== undefined) {
            obj[header] = row[index];
          }
        });
        return obj;
      });

      const validRows = rows.filter(row => 
        Object.values(row).some(value => value !== null && value !== undefined && value !== '')
      );

      console.log(`Found ${validRows.length} valid rows to process`);

      // Load existing candidates
      await this.loadExistingCandidates();

      // Process each row
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        
        const result = this.validateAndCleanData(row, i);
        
        if (result) {
          const { candidateData, documentId } = result;
          
          // Check if candidate already exists
          const existingDocId = this.findExistingCandidate(candidateData);
          
          const success = await this.saveOrUpdateCandidate(candidateData, documentId, existingDocId);
          if (success) {
            this.processed++;
            if (i % 50 === 0) {
              console.log(`Processed ${this.processed} candidates... (${this.added} added, ${this.updated} updated)`);
            }
          }
        }
      }

      return {
        total: validRows.length,
        processed: this.processed,
        added: this.added,
        updated: this.updated,
        errors: this.errors.length,
        errorDetails: this.errors
      };
    } catch (error) {
      console.error('Update error:', error);
      throw error;
    }
  }

  // Create temporary rules file
  createTemporaryRulesFile() {
    try {
      fs.writeFileSync('firestore.rules.temp', temporaryRules);
      console.log('✅ Created temporary security rules file: firestore.rules.temp');
      return true;
    } catch (error) {
      console.error('Error creating temporary rules file:', error);
      return false;
    }
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 MAFIA Dashboard - Update All Candidates Script');
    console.log('================================================');
    console.log('');
    console.log('📋 INSTRUCTIONS:');
    console.log('1. This script will update/add all candidates from Excel to Firebase');
    console.log('2. You need to temporarily modify Firebase security rules');
    console.log('3. The script will create a temporary rules file for you');
    console.log('4. After update, you must restore your original security rules');
    console.log('');
    
    const updater = new CandidateUpdater();
    
    // Create temporary rules file
    if (!updater.createTemporaryRulesFile()) {
      console.log('❌ Failed to create temporary rules file');
      return;
    }
    
    console.log('');
    console.log('🔧 STEP 1: Update Firebase Security Rules');
    console.log('   - Go to Firebase Console > Firestore Database > Rules');
    console.log('   - Replace the current rules with the contents of firestore.rules.temp');
    console.log('   - Click "Publish"');
    console.log('');
    console.log('⏳ Waiting 10 seconds for you to update the rules...');
    console.log('   (You can skip this wait by pressing Ctrl+C and running the script again)');
    
    // Wait for user to update rules
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('');
    console.log('📊 STEP 2: Updating All Candidates...');
    console.log('');
    
    const results = await updater.updateFromExcel('Mafia TalentComm WorkComm Recruitments 25-26 Responses (4).xlsx');
    
    console.log('');
    console.log('✅ Update completed!');
    console.log(`📊 Results:`);
    console.log(`• Total: ${results.total} candidates`);
    console.log(`• Processed: ${results.processed} candidates`);
    console.log(`• Added: ${results.added} new candidates`);
    console.log(`• Updated: ${results.updated} existing candidates`);
    console.log(`• Errors: ${results.errors}`);
    
    if (results.errorDetails.length > 0) {
      console.log('');
      console.log('❌ Error details:');
      results.errorDetails.slice(0, 10).forEach(error => {
        console.log(`Row ${error.row}: ${error.error}`);
      });
      if (results.errorDetails.length > 10) {
        console.log(`... and ${results.errorDetails.length - 10} more errors`);
      }
    }
    
    console.log('');
    console.log('🔧 STEP 3: Restore Original Security Rules');
    console.log('   - Go to Firebase Console > Firestore Database > Rules');
    console.log('   - Replace the current rules with your original security rules');
    console.log('   - Click "Publish"');
    console.log('');
    console.log('🎯 Update finished! Check your Firebase console to verify the data.');
    console.log('');
    console.log('⚠️  IMPORTANT: Remember to restore your original security rules!');
    
  } catch (error) {
    console.error('❌ Script error:', error);
  }
}

// Run the script
main();
