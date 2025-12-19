import { db } from "./firebaseConfig";
import { doc, setDoc, collection, getDocs } from "firebase/firestore";
import * as ExcelJS from "exceljs";

class DataImporter {
  constructor() {
    this.processedCount = 0;
    this.errorCount = 0;
    this.errors = [];
    this.duplicates = [];
    this.existingCandidates = new Map(); // Store existing candidates for duplicate checking
  }

  // Generate a unique registration number if not provided
  generateRegNo(index) {
    return `MAFIA${String(index + 1).padStart(4, '0')}`;
  }

  // Load existing candidates from Firebase for duplicate checking
  async loadExistingCandidates() {
    try {
      const candidatesRef = collection(db, "candidates");
      const snapshot = await getDocs(candidatesRef);
      
      this.existingCandidates.clear();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        // Create multiple keys for different duplicate checking strategies
        const nameKey = data.name?.toLowerCase().trim();
        const regNoKey = data.regNo?.toLowerCase().trim();
        const whatsappKey = data.whatsappNumber?.replace(/\D/g, ''); // Remove non-digits
        
        if (nameKey) this.existingCandidates.set(`name:${nameKey}`, data);
        if (regNoKey) this.existingCandidates.set(`regno:${regNoKey}`, data);
        if (whatsappKey) this.existingCandidates.set(`whatsapp:${whatsappKey}`, data);
      });
      
      console.log(`Loaded ${this.existingCandidates.size / 3} existing candidates for duplicate checking`);
      return this.existingCandidates.size / 3;
    } catch (error) {
      console.error('Error loading existing candidates:', error);
      return 0;
    }
  }

  // Check for duplicates using multiple strategies
  checkForDuplicates(candidateData) {
    const duplicates = [];
    
    // Strategy 1: Exact name match
    const nameKey = candidateData.name?.toLowerCase().trim();
    if (nameKey && this.existingCandidates.has(`name:${nameKey}`)) {
      const existing = this.existingCandidates.get(`name:${nameKey}`);
      duplicates.push({
        type: 'exact_name',
        existing: existing,
        new: candidateData,
        confidence: 'high'
      });
    }
    
    // Strategy 2: Registration number match
    const regNoKey = candidateData.regNo?.toLowerCase().trim();
    if (regNoKey && this.existingCandidates.has(`regno:${regNoKey}`)) {
      const existing = this.existingCandidates.get(`regno:${regNoKey}`);
      duplicates.push({
        type: 'registration_number',
        existing: existing,
        new: candidateData,
        confidence: 'very_high'
      });
    }
    
    // Strategy 3: WhatsApp number match (normalized)
    const whatsappKey = candidateData.whatsappNumber?.replace(/\D/g, '');
    if (whatsappKey && whatsappKey.length >= 10 && this.existingCandidates.has(`whatsapp:${whatsappKey}`)) {
      const existing = this.existingCandidates.get(`whatsapp:${whatsappKey}`);
      duplicates.push({
        type: 'whatsapp_number',
        existing: existing,
        new: candidateData,
        confidence: 'high'
      });
    }
    
    // Strategy 4: Fuzzy name matching (similar names)
    if (nameKey) {
      const similarNames = this.findSimilarNames(nameKey);
      if (similarNames.length > 0) {
        similarNames.forEach(similar => {
          duplicates.push({
            type: 'similar_name',
            existing: similar,
            new: candidateData,
            confidence: 'medium'
          });
        });
      }
    }
    
    return duplicates;
  }

  // Find similar names using fuzzy matching
  findSimilarNames(nameKey) {
    const similar = [];
    const nameWords = nameKey.split(' ').filter(word => word.length > 2);
    
    for (const [key, existing] of this.existingCandidates.entries()) {
      if (key.startsWith('name:')) {
        const existingName = key.replace('name:', '').toLowerCase();
        const existingWords = existingName.split(' ').filter(word => word.length > 2);
        
        // Check for common words
        const commonWords = nameWords.filter(word => 
          existingWords.some(existingWord => 
            existingWord.includes(word) || word.includes(existingWord)
          )
        );
        
        // If more than 50% of words match, consider it similar
        if (commonWords.length > 0 && 
            (commonWords.length / Math.max(nameWords.length, existingWords.length)) > 0.5) {
          similar.push(existing);
        }
      }
    }
    
    return similar;
  }

  // Smart duplicate resolution
  async resolveDuplicates(candidateData, duplicates) {
    if (duplicates.length === 0) return { action: 'import', reason: 'no_duplicates' };
    
    // Sort duplicates by confidence
    duplicates.sort((a, b) => {
      const confidenceOrder = { 'very_high': 4, 'high': 3, 'medium': 2, 'low': 1 };
      return confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
    });
    
    const bestMatch = duplicates[0];
    
    // Very high confidence duplicates (registration number match)
    if (bestMatch.confidence === 'very_high') {
      return { action: 'skip', reason: 'exact_registration_match', existing: bestMatch.existing };
    }
    
    // High confidence duplicates (exact name or WhatsApp)
    if (bestMatch.confidence === 'high') {
      // Check if the existing record is more recent
      const existingDate = new Date(bestMatch.existing.lastUpdatedAt || 0);
      const newDate = new Date();
      
      if (existingDate > newDate - (24 * 60 * 60 * 1000)) { // Within 24 hours
        return { action: 'skip', reason: 'recent_duplicate', existing: bestMatch.existing };
      }
      
      // Ask user or auto-resolve based on data completeness
      const existingScore = this.calculateDataCompleteness(bestMatch.existing);
      const newScore = this.calculateDataCompleteness(candidateData);
      
      if (newScore > existingScore) {
        return { action: 'update', reason: 'more_complete_data', existing: bestMatch.existing };
      } else {
        return { action: 'skip', reason: 'existing_more_complete', existing: bestMatch.existing };
      }
    }
    
    // Medium confidence duplicates (similar names)
    if (bestMatch.confidence === 'medium') {
      return { action: 'flag', reason: 'similar_name_detected', existing: bestMatch.existing };
    }
    
    return { action: 'import', reason: 'low_confidence_duplicate' };
  }

  // Calculate data completeness score
  calculateDataCompleteness(candidate) {
    let score = 0;
    const maxScore = 10;
    
    if (candidate.name) score += 2;
    if (candidate.regNo) score += 2;
    if (candidate.college && candidate.college !== 'N/A') score += 1;
    if (candidate.branch && candidate.branch !== 'N/A') score += 1;
    if (candidate.whatsappNumber && candidate.whatsappNumber !== 'N/A') score += 1;
    if (candidate.preferences?.talentComm?.pref1) score += 1;
    if (candidate.preferences?.talentComm?.pref2) score += 1;
    if (candidate.preferences?.workComm?.pref1) score += 1;
    
    return score / maxScore;
  }

  // Validate and clean data
  validateAndCleanData(row, index) {
    try {
      // Check academic year from the data
      const academicYear = row['Academic Year'];
      if (!academicYear) {
        throw new Error('Academic Year not specified');
      }

      // More flexible year detection
      const academicYearStr = String(academicYear).toLowerCase().trim();
      const isFirstYear = academicYearStr.includes('1st') || academicYearStr.includes('first') || academicYearStr.includes('1');
      const isSecondYear = academicYearStr.includes('2nd') || academicYearStr.includes('second') || academicYearStr.includes('2');
      
      if (!isFirstYear && !isSecondYear) {
        throw new Error(`Invalid Academic Year format: "${academicYear}"`);
      }

      // Extract data based on year
      const candidateData = {
        name: row['Name'] || `Candidate ${index + 1}`,
        regNo: row['Reg No.'] || this.generateRegNo(index),
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
        lastUpdatedBy: 'Data Import',
        lastUpdatedAt: new Date().toISOString()
      };

      // Handle 1st year students - use first 5 columns for TalentComm and WorkComm
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
      
      // Handle 2nd year students - use the last 2 columns for TalentComm only
      if (isSecondYear) {
        candidateData.preferences.talentComm = {
          pref1: row['TalentComm Preference 1.1'] || '',
          pref2: row['TalentComm Preference 2.1'] || ''
        };
        // WorkComm preferences remain empty for 2nd year students
      }

      // More flexible validation - check if we have any preferences at all
      const hasTalentCommPrefs = candidateData.preferences.talentComm.pref1 || candidateData.preferences.talentComm.pref2;
      const hasWorkCommPrefs = candidateData.preferences.workComm.pref1 || candidateData.preferences.workComm.pref2 || candidateData.preferences.workComm.pref3;
      
      if (!hasTalentCommPrefs && !hasWorkCommPrefs) {
        throw new Error('No preferences found in any column');
      }

      return candidateData;
    } catch (error) {
      this.errors.push({
        row: index + 1,
        error: error.message,
        data: row
      });
      return null;
    }
  }

  // Import data from Excel file
  async importFromExcel(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(data);
          
          // Get the first worksheet
          const worksheet = workbook.getWorksheet(1);
          
          // Convert to JSON
          const jsonData = [];
          worksheet.eachRow((row, rowNumber) => {
            const rowData = [];
            row.eachCell((cell, colNumber) => {
              rowData.push(cell.value);
            });
            jsonData.push(rowData);
          });
          
          // Process the data
          const results = await this.processData(jsonData);
          resolve(results);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  // Process the JSON data
  async processData(jsonData) {
    if (jsonData.length < 2) {
      throw new Error('Excel file must have at least a header row and one data row');
    }

    // Load existing candidates for duplicate checking
    console.log('Loading existing candidates for duplicate checking...');
    await this.loadExistingCandidates();

    // Get headers from first row
    const headers = jsonData[0];
    console.log('Excel headers found:', headers);
    
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

    // Process each row with duplicate checking
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      
      // Debug: Log first few rows with more details
      if (i < 3) {
        console.log(`Processing row ${i + 1}:`, {
          name: row['Name'],
          academicYear: row['Academic Year'],
          talentComm1: row['TalentComm Preference 1'],
          talentComm2: row['TalentComm Preference 2'],
          talentComm1_1: row['TalentComm Preference 1.1'],
          talentComm2_1: row['TalentComm Preference 2.1'],
          workComm1: row['WorkComm Preference 1'],
          workComm2: row['WorkComm Preference 2'],
          workComm3: row['WorkComm Preference 3 (optional)'],
          allKeys: Object.keys(row)
        });
      }
      
      const candidateData = this.validateAndCleanData(row, i);
      
      if (candidateData) {
        try {
          // Check for duplicates
          const duplicates = this.checkForDuplicates(candidateData);
          const resolution = await this.resolveDuplicates(candidateData, duplicates);
          
          if (resolution.action === 'skip') {
            console.log(`Skipping duplicate: ${candidateData.name} - ${resolution.reason}`);
            this.duplicates.push({
              row: i + 1,
              candidate: candidateData,
              reason: resolution.reason,
              existing: resolution.existing
            });
            continue;
          } else if (resolution.action === 'update') {
            console.log(`Updating existing record: ${candidateData.name} - ${resolution.reason}`);
            // Merge data and update
            const mergedData = { ...resolution.existing, ...candidateData };
            mergedData.lastUpdatedBy = 'Data Import (Update)';
            mergedData.lastUpdatedAt = new Date().toISOString();
            await this.saveCandidate(mergedData);
            this.processedCount++;
          } else if (resolution.action === 'flag') {
            console.log(`Flagging potential duplicate: ${candidateData.name} - ${resolution.reason}`);
            this.duplicates.push({
              row: i + 1,
              candidate: candidateData,
              reason: resolution.reason,
              existing: resolution.existing,
              flagged: true
            });
            // Still import but flag it
            await this.saveCandidate(candidateData);
            this.processedCount++;
          } else {
            // Import new record
            await this.saveCandidate(candidateData);
            this.processedCount++;
          }
        } catch (error) {
          this.errorCount++;
          this.errors.push({
            row: i + 1,
            error: error.message,
            data: row
          });
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
      duplicates: this.duplicates.length,
      errorDetails: this.errors,
      duplicateDetails: this.duplicates
    };
  }

  // Save candidate to Firebase
  async saveCandidate(candidateData) {
    const ref = doc(db, "candidates", candidateData.regNo);
    await setDoc(ref, candidateData);
  }

  // Get import statistics
  getStats() {
    return {
      processed: this.processedCount,
      errors: this.errorCount,
      duplicates: this.duplicates.length,
      errorDetails: this.errors,
      duplicateDetails: this.duplicates
    };
  }

  // Reset counters
  reset() {
    this.processedCount = 0;
    this.errorCount = 0;
    this.errors = [];
    this.duplicates = [];
    this.existingCandidates.clear();
  }
}

export default DataImporter;
