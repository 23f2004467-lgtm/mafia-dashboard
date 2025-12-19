const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDocs, collection } = require('firebase/firestore');
const XLSX = require('xlsx');
const fs = require('fs');

// Use the same Firebase config as your app
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

// Temporary rules for import (allows all writes)
const temporaryRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;

class FinalDataImporter {
  constructor() {
    this.processedCount = 0;
    this.errorCount = 0;
    this.duplicateCount = 0;
    this.errors = [];
    this.existingCandidates = new Set();
  }

  // Load existing candidates to check for duplicates
  async loadExistingCandidates() {
    try {
      console.log('Loading existing candidates for duplicate checking...');
      const snapshot = await getDocs(collection(db, 'candidates'));
      
      snapshot.forEach(doc => {
        const data = doc.data();
        // Create unique identifiers for duplicate checking
        const nameKey = data.name?.toString().toLowerCase().trim();
        const regNoKey = data.regNo?.toString().trim();
        const whatsappKey = data.whatsappNumber?.toString().trim();
        
        if (nameKey) this.existingCandidates.add(`name:${nameKey}`);
        if (regNoKey) this.existingCandidates.add(`regno:${regNoKey}`);
        if (whatsappKey) this.existingCandidates.add(`whatsapp:${whatsappKey}`);
      });
      
      console.log(`Loaded ${snapshot.size} existing candidates for duplicate checking`);
    } catch (error) {
      console.error('Error loading existing candidates:', error);
      console.log('Continuing without duplicate checking...');
    }
  }

  // Check for duplicates
  isDuplicate(candidateData) {
    const nameKey = candidateData.name?.toString().toLowerCase().trim();
    const regNoKey = candidateData.regNo?.toString().trim();
    const whatsappKey = candidateData.whatsappNumber?.toString().trim();
    
    return (
      (nameKey && this.existingCandidates.has(`name:${nameKey}`)) ||
      (regNoKey && this.existingCandidates.has(`regno:${regNoKey}`)) ||
      (whatsappKey && this.existingCandidates.has(`whatsapp:${whatsappKey}`))
    );
  }

  // Generate a unique registration number if not provided
  generateRegNo(index) {
    return `MAFIA${String(index + 1).padStart(4, '0')}`;
  }

  // Validate and clean data with better error handling
  validateAndCleanData(row, index) {
    try {
      // Check academic year from the data
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

      // Generate a safe document ID
      const safeRegNo = row['Reg No.'] || this.generateRegNo(index);
      const documentId = safeRegNo.toString().replace(/[^a-zA-Z0-9]/g, '_');

      // Extract data based on year
      const candidateData = {
        name: row['Name']?.toString() || `Candidate ${index + 1}`,
        regNo: safeRegNo.toString(),
        year: isFirstYear ? "1st Year" : "2nd Year",
        college: row['College']?.toString() || 'N/A',
        branch: row['Branch']?.toString() || 'N/A',
        whatsappNumber: row['Whatsapp No.']?.toString() || 'N/A',
        preferences: {
          talentComm: {
            pref1: '',
            pref2: ''
          },
          workComm: {
            pref1: '',
            pref2: '',
            pref3: ''
          }
        },
        verdict: {
          talentComm: [],
          workComm: []
        },
        comments: '',
        paid: false,
        paymentDetails: null,
        lastUpdatedBy: 'Final Import Script',
        lastUpdatedAt: new Date().toISOString()
      };

      // Handle 1st year students - use standard preference columns
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
      
      // Handle 2nd year students - use the LAST two columns for TalentComm only
      if (isSecondYear) {
        // For 2nd year students, we need to access the duplicate column names
        // Since XLSX uses the first occurrence, we need to access by index
        const allValues = Object.values(row);
        candidateData.preferences.talentComm = {
          pref1: allValues[12]?.toString() || '', // Column 13 (index 12)
          pref2: allValues[13]?.toString() || ''  // Column 14 (index 13)
        };
        // WorkComm preferences remain empty for 2nd year students
        candidateData.preferences.workComm = {
          pref1: '',
          pref2: '',
          pref3: ''
        };
        
        // Debug output for first few 2nd year students
        if (index < 3) {
          console.log(`Processing 2nd year row ${index + 1}:`, {
            name: row['Name'],
            academicYear: row['Academic Year'],
            talentComm1: allValues[12], // Column 13
            talentComm2: allValues[13], // Column 14
            workComm1: row['WorkComm Preference 1'],
            workComm2: row['WorkComm Preference 2'],
            workComm3: row['WorkComm Preference 3 (optional)']
          });
        }
      }

      // More lenient validation - allow candidates without TalentComm preferences
      // but log them for review
      if (!candidateData.preferences.talentComm.pref1 && !candidateData.preferences.talentComm.pref2) {
        console.log(`⚠️  Warning: Row ${index + 1} (${candidateData.name}) has no TalentComm preferences`);
        // Don't throw error, just continue with empty preferences
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

  // Save candidate to Firebase
  async saveCandidate(candidateData, documentId) {
    try {
      const ref = doc(db, "candidates", documentId);
      await setDoc(ref, candidateData);
      return true;
    } catch (error) {
      console.error('Error saving candidate:', error);
      return false;
    }
  }

  // Import data from Excel file
  async importFromExcel(filePath) {
    try {
      console.log('Reading Excel file...');
      
      // Read the Excel file
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) {
        throw new Error('Excel file must have at least a header row and one data row');
      }

      // Get headers from first row
      const headers = jsonData[0];
      
      // Convert rows to objects with headers as keys
      const rows = jsonData.slice(1).map(row => {
        const obj = {};
        headers.forEach((header, index) => {
          if (header && row[index] !== undefined) {
            obj[header] = row[index];
          }
        });
        return obj;
      });

      // Filter out empty rows
      const validRows = rows.filter(row => 
        Object.values(row).some(value => value !== null && value !== undefined && value !== '')
      );

      console.log(`Found ${validRows.length} valid rows to process`);

      // Load existing candidates for duplicate checking
      await this.loadExistingCandidates();

      // Process each row
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        
        // Debug: Log first few rows
        if (i < 3) {
          const isFirstYear = row['Academic Year']?.toString().toLowerCase().includes('1st year') || 
                             row['Academic Year']?.toString().toLowerCase().includes('first year') ||
                             row['Academic Year']?.toString().toLowerCase().includes('1');
          const isSecondYear = row['Academic Year']?.toString().toLowerCase().includes('2nd year') || 
                              row['Academic Year']?.toString().toLowerCase().includes('second year') ||
                              row['Academic Year']?.toString().toLowerCase().includes('2');
          
          console.log(`Processing row ${i + 1}:`, {
            name: row['Name'],
            academicYear: row['Academic Year'],
            studentType: isFirstYear ? '1st Year' : isSecondYear ? '2nd Year' : 'Unknown',
            talentComm1: row['TalentComm Preference 1'],
            talentComm2: row['TalentComm Preference 2'],
            talentComm1_1: row['TalentComm Preference 1.1'],
            talentComm2_1: row['TalentComm Preference 2.1'],
            workComm1: row['WorkComm Preference 1'],
            workComm2: row['WorkComm Preference 2'],
            workComm3: row['WorkComm Preference 3 (optional)']
          });
        }
        
        const result = this.validateAndCleanData(row, i);
        
        if (result) {
          const { candidateData, documentId } = result;
          
          // Check for duplicates
          if (this.isDuplicate(candidateData)) {
            this.duplicateCount++;
            console.log(`Skipping duplicate: ${candidateData.name} (${candidateData.regNo})`);
            continue;
          }
          
          const success = await this.saveCandidate(candidateData, documentId);
          if (success) {
            this.processedCount++;
            if (i % 50 === 0) {
              console.log(`Processed ${this.processedCount} candidates...`);
            }
          } else {
            this.errorCount++;
          }
        } else {
          this.errorCount++;
          // Debug: Log validation errors for first few rows
          if (i < 3) {
            console.log(`Validation failed for row ${i + 1}:`, this.errors[this.errors.length - 1]);
          }
        }
      }

      return {
        total: validRows.length,
        processed: this.processedCount,
        duplicates: this.duplicateCount,
        errors: this.errorCount,
        errorDetails: this.errors
      };
    } catch (error) {
      console.error('Import error:', error);
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
    console.log('🚀 MAFIA Dashboard - Final Data Import Script');
    console.log('==============================================');
    console.log('');
    console.log('📋 INSTRUCTIONS:');
    console.log('1. This script will import your Excel data into Firebase');
    console.log('2. You need to temporarily modify Firebase security rules');
    console.log('3. The script will create a temporary rules file for you');
    console.log('4. After import, you must restore your original security rules');
    console.log('');
    
    const importer = new FinalDataImporter();
    
    // Create temporary rules file
    if (!importer.createTemporaryRulesFile()) {
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
    console.log('📊 STEP 2: Importing Data...');
    console.log('');
    
    const results = await importer.importFromExcel('Mafia TalentComm WorkComm Recruitments 25-26 Responses (4).xlsx');
    
    console.log('');
    console.log('✅ Import completed!');
    console.log(`📊 Results:`);
    console.log(`• Total: ${results.total} candidates`);
    console.log(`• Processed: ${results.processed} candidates`);
    console.log(`• Duplicates skipped: ${results.duplicates}`);
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
    console.log('🎯 Import finished! Check your Firebase console to verify the data.');
    console.log('');
    console.log('⚠️  IMPORTANT: Remember to restore your original security rules!');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    console.log('');
    console.log('💡 If you got permission errors:');
    console.log('   1. Make sure you updated the Firebase security rules');
    console.log('   2. The temporary rules should allow all reads and writes');
    console.log('   3. Try running the script again after updating the rules');
  } finally {
    process.exit(0);
  }
}

main();
