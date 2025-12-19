const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');
const XLSX = require('xlsx');

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

class DirectDataImporter {
  constructor() {
    this.processedCount = 0;
    this.errorCount = 0;
    this.errors = [];
  }

  // Generate a unique registration number if not provided
  generateRegNo(index) {
    return `MAFIA${String(index + 1).padStart(4, '0')}`;
  }

  // Validate and clean data
  validateAndCleanData(row, index) {
    try {
      // Check academic year from the data
      const academicYear = row['Academic Year'];
      if (!academicYear) {
        throw new Error('Academic Year not specified');
      }

      const isFirstYear = academicYear.toLowerCase().includes('1st year');
      const isSecondYear = academicYear.toLowerCase().includes('2nd year');
      
      if (!isFirstYear && !isSecondYear) {
        throw new Error('Invalid Academic Year format');
      }

      // Generate a safe document ID
      const safeRegNo = row['Reg No.'] || this.generateRegNo(index);
      const documentId = safeRegNo.toString().replace(/[^a-zA-Z0-9]/g, '_');

      // Extract data based on year
      const candidateData = {
        name: row['Name'] || `Candidate ${index + 1}`,
        regNo: safeRegNo,
        year: isFirstYear ? "1st Year" : "2nd Year",
        college: row['College'] || 'N/A',
        branch: row['Branch'] || 'N/A',
        whatsappNumber: row['Whatsapp No.'] || 'N/A',
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
        lastUpdatedBy: 'Direct Import Script',
        lastUpdatedAt: new Date().toISOString()
      };

      // Handle 1st year students - use columns 8-12 for TalentComm and WorkComm
      if (isFirstYear) {
        candidateData.preferences.talentComm = {
          pref1: row['TalentComm Preference 1'] || '',
          pref2: row['TalentComm Preference 2'] || ''
        };
        candidateData.preferences.workComm = {
          pref1: row['WorkComm Preference 1'] || '',
          pref2: row['WorkComm Preference 2'] || '',
          pref3: row['WorkComm Preference 3 (optional)'] || ''
        };
      }
      
      // Handle 2nd year students - use columns 13-14 for TalentComm only
      if (isSecondYear) {
        // For 2nd year students, we need to access the duplicate column names
        // Since XLSX uses the first occurrence, we need to access by index
        const allValues = Object.values(row);
        candidateData.preferences.talentComm = {
          pref1: allValues[12] || '', // Column 13 (index 12)
          pref2: allValues[13] || ''  // Column 14 (index 13)
        };
        // WorkComm preferences remain empty for 2nd year students
        candidateData.preferences.workComm = {
          pref1: '',
          pref2: '',
          pref3: ''
        };
      }

      // Validate that we have at least one TalentComm preference
      if (!candidateData.preferences.talentComm.pref1 && !candidateData.preferences.talentComm.pref2) {
        throw new Error('No TalentComm preferences found');
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

      // Process each row
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        
        // Debug: Log first few rows
        if (i < 3) {
          console.log(`Processing row ${i + 1}:`, {
            name: row['Name'],
            academicYear: row['Academic Year'],
            talentComm1: row['TalentComm Preference 1'],
            talentComm1_1: row['TalentComm Preference 1.1']
          });
        }
        
        const result = this.validateAndCleanData(row, i);
        
        if (result) {
          const { candidateData, documentId } = result;
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
        errors: this.errorCount,
        errorDetails: this.errors
      };
    } catch (error) {
      console.error('Import error:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting direct data import...');
    
    const importer = new DirectDataImporter();
    const results = await importer.importFromExcel('Mafia TalentComm WorkComm Recruitments 25-26 Responses (4).xlsx');
    
    console.log('\n✅ Import completed!');
    console.log(`📊 Results:`);
    console.log(`• Total: ${results.total} candidates`);
    console.log(`• Processed: ${results.processed} candidates`);
    console.log(`• Errors: ${results.errors}`);
    
    if (results.errorDetails.length > 0) {
      console.log('\n❌ Error details:');
      results.errorDetails.slice(0, 5).forEach(error => {
        console.log(`Row ${error.row}: ${error.error}`);
      });
      if (results.errorDetails.length > 5) {
        console.log(`... and ${results.errorDetails.length - 5} more errors`);
      }
    }
    
    console.log('\n🎯 Import finished! Check your Firebase console to verify the data.');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    process.exit(0);
  }
}

main();
