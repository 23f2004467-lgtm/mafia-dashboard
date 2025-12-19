const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, getDocs, collection } = require('firebase/firestore');
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

// Original security rules (to restore later)
const originalRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isEmailVerified() {
      return request.auth.token.email_verified == true;
    }
    
    function isAdmin() {
      return isAuthenticated() && 
             isEmailVerified() &&
             request.auth.token.email in ['dheera1312@gmail.com'] &&
             request.auth.token.email_verified == true;
    }
    
    function isInterviewer() {
      return isAuthenticated() && 
             isEmailVerified() &&
             request.auth.token.email_verified == true;
    }
    
    function isValidEmail(email) {
      return email.matches('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$');
    }
    
    function isValidRegNo(regNo) {
      return regNo.matches('^[A-Z0-9]{5,20}$');
    }
    
    function isValidPhone(phone) {
      return phone.matches('^[6-9]\\d{9}$');
    }
    
    function isValidAmount(amount) {
      return amount is number && amount >= 100 && amount <= 10000;
    }
    
    function isValidYear(year) {
      return year in ['1st Year', '2nd Year', '1st year', '2nd year'];
    }
    
    function isValidVerdict(verdict) {
      return verdict in ['Selected', 'Rejected', 'Waitlisted', 'Not Interviewed'];
    }
    
    function isValidCandidateData(data) {
      return data.keys().hasAll(['name', 'regNo', 'year']) &&
             data.name is string && data.name.size() > 0 && data.name.size() <= 100 &&
             isValidRegNo(data.regNo) &&
             isValidYear(data.year) &&
             (data.whatsappNumber == null || isValidPhone(data.whatsappNumber)) &&
             (data.college == null || data.college is string && data.college.size() <= 200) &&
             (data.branch == null || data.branch is string && data.branch.size() <= 100) &&
             (data.comments == null || data.comments is string && data.comments.size() <= 500);
    }
    
    function isValidPaymentSession(data) {
      return data.keys().hasAll(['paymentId', 'candidateId', 'amount', 'status']) &&
             isValidAmount(data.amount) &&
             data.status in ['pending', 'completed', 'cancelled'] &&
             data.paymentId is string && data.paymentId.size() > 0 &&
             data.candidateId is string && data.candidateId.size() > 0;
    }
    
    function isValidInterviewerSession(data) {
      return data.keys().hasAll(['email', 'lastActive']) &&
             isValidEmail(data.email) &&
             data.lastActive is timestamp;
    }
    
    // Candidates collection - Interviewer and Admin access with strict validation
    match /candidates/{candidateId} {
      allow read: if isInterviewer() || isAdmin();
      allow create: if isInterviewer() && 
                       isValidCandidateData(request.resource.data) &&
                       request.resource.data.regNo == candidateId;
      allow update: if isInterviewer() && 
                       (isValidCandidateData(request.resource.data) || 
                        (request.resource.data.keys().hasAll(['paid', 'paymentDetails', 'lastUpdatedBy', 'lastUpdatedAt']) &&
                         isValidAmount(request.resource.data.paymentDetails.amount)));
      allow delete: if isAdmin();
    }
    
    // Payment sessions collection - Restricted access
    match /paymentSessions/{sessionId} {
      allow read: if isInterviewer() && 
                     resource.data.interviewerId == request.auth.token.email;
      allow create: if isInterviewer() && 
                       isValidPaymentSession(request.resource.data) &&
                       request.resource.data.interviewerId == request.auth.token.email;
      allow update: if isInterviewer() && 
                       resource.data.interviewerId == request.auth.token.email &&
                       (resource.data.status in ['completed', 'cancelled'] ||
                        resource.data.keys().hasAll(['lastChecked']));
      allow delete: if isAdmin();
    }
    
    // Interviewers collection - Admin read/write, Interviewer can update their own session
    match /interviewers/{interviewerId} {
      allow read, write: if isAdmin();
      allow read, write: if isInterviewer() && 
                           interviewerId == request.auth.token.email &&
                           isValidInterviewerSession(request.resource.data);
    }
    
    // Audit logs collection - Admin only
    match /auditLogs/{logId} {
      allow read, write: if isAdmin();
    }
    
    // Admin settings collection - Admin only
    match /adminSettings/{settingId} {
      allow read, write: if isAdmin();
    }
    
    // Admin logs collection - Admin only
    match /adminLogs/{logId} {
      allow read, write: if isAdmin();
    }
    
    // Admins collection - Allow creation and reading during setup, then admin only
    match /admins/{adminId} {
      allow create: if isAuthenticated() && 
                       request.auth.token.email == adminId &&
                       request.resource.data.keys().hasAll(['email', 'role', 'isActive']) &&
                       request.resource.data.role == 'admin' &&
                       request.resource.data.isActive == true;
      allow read: if isAuthenticated() && request.auth.token.email == adminId;
      allow write: if isAdmin();
    }
    
    // Rate limiting and abuse prevention
    match /rateLimits/{userId} {
      allow read, write: if isAuthenticated() && 
                           request.auth.uid == userId;
    }
    
    // Security logs collection - Admin only
    match /securityLogs/{logId} {
      allow read, write: if isAdmin();
    }
    
    // Failed login attempts collection - Admin only
    match /failedLogins/{attemptId} {
      allow read, write: if isAdmin();
    }
    
    // IP blocking collection - Admin only
    match /blockedIPs/{ipAddress} {
      allow read, write: if isAdmin();
    }
    
    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}`;

// Temporary rules for import (allows all writes)
const temporaryRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;

class DataImporterWithRuleModification {
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
        const nameKey = data.name?.toLowerCase().trim();
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
    const nameKey = candidateData.name?.toLowerCase().trim();
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

  // Validate and clean data
  validateAndCleanData(row, index) {
    try {
      // Check academic year from the data
      const academicYear = row['Academic Year'];
      if (!academicYear) {
        throw new Error('Academic Year not specified');
      }

      const isFirstYear = academicYear.toLowerCase().includes('1st year') || 
                         academicYear.toLowerCase().includes('first year') ||
                         academicYear.toLowerCase().includes('1');
      const isSecondYear = academicYear.toLowerCase().includes('2nd year') || 
                          academicYear.toLowerCase().includes('second year') ||
                          academicYear.toLowerCase().includes('2');
      
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
        lastUpdatedBy: 'Import Script',
        lastUpdatedAt: new Date().toISOString()
      };

      // Handle 1st year students - use standard preference columns
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
      
      // Handle 2nd year students - use the .1 suffix columns for TalentComm only
      if (isSecondYear) {
        candidateData.preferences.talentComm = {
          pref1: row['TalentComm Preference 1.1'] || '',
          pref2: row['TalentComm Preference 2.1'] || ''
        };
        // WorkComm preferences remain empty for 2nd year students
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

      // Load existing candidates for duplicate checking
      await this.loadExistingCandidates();

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
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting data import with temporary rule modification...');
    console.log('⚠️  This will temporarily allow all writes to Firestore.');
    console.log('   The original security rules will be restored after import.');
    
    const importer = new DataImporterWithRuleModification();
    const results = await importer.importFromExcel('Mafia TalentComm WorkComm Recruitments 25-26 Responses (4).xlsx');
    
    console.log('\n✅ Import completed!');
    console.log(`📊 Results:`);
    console.log(`• Total: ${results.total} candidates`);
    console.log(`• Processed: ${results.processed} candidates`);
    console.log(`• Duplicates skipped: ${results.duplicates}`);
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
    console.log('⚠️  Remember to restore your original security rules in the Firebase console.');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
    console.log('\n💡 If you got permission errors, you may need to:');
    console.log('   1. Temporarily modify Firebase security rules to allow writes');
    console.log('   2. Or use the Admin Portal to import data manually');
  } finally {
    process.exit(0);
  }
}

main();


