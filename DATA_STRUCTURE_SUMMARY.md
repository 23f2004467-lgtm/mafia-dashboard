# MAFIA Dashboard - Data Structure Summary

## Current Database Collections

### 1. `candidates` Collection
Stores all candidate information with the following structure:

```javascript
{
  name: String,                    // Candidate's full name
  regNo: String,                   // Registration number (e.g., "MAFIA0001")
  year: String,                    // "1st Year" or "2nd Year"
  college: String,                 // College name
  branch: String,                  // Branch/Department
  whatsappNumber: String,          // WhatsApp contact number
  preferences: {
    talentComm: {
      pref1: String,               // First preference for TalentComm
      pref2: String                // Second preference for TalentComm
    },
    workComm: {
      pref1: String,               // First preference for WorkComm
      pref2: String,               // Second preference for WorkComm
      pref3: String                // Third preference for WorkComm (optional)
    }
  },
  verdict: {
    talentComm: Array,             // Interview verdicts for TalentComm
    workComm: Array                // Interview verdicts for WorkComm
  },
  comments: String,                // Additional comments
  paid: Boolean,                   // Payment status
  paymentDetails: Object,          // Payment information
  lastUpdatedBy: String,           // Email of last person who updated
  lastUpdatedAt: String            // ISO timestamp of last update
}
```

### 2. `paymentSessions` Collection
Stores payment session information for candidates.

## Field Mapping for Data Import

### For 1st Year Students:
- **Name**: `Name`
- **Registration Number**: `Reg No.`
- **Academic Year**: `Academic Year` (should contain "1st", "first", or "1")
- **College**: `College`
- **Branch**: `Branch`
- **WhatsApp Number**: `Whatsapp No.`
- **TalentComm Preferences**:
  - `TalentComm Preference 1`
  - `TalentComm Preference 2`
- **WorkComm Preferences**:
  - `WorkComm Preference 1`
  - `WorkComm Preference 2`
  - `WorkComm Preference 3 (optional)`

### For 2nd Year Students:
- **Name**: `Name`
- **Registration Number**: `Reg No.`
- **Academic Year**: `Academic Year` (should contain "2nd", "second", or "2")
- **College**: `College`
- **Branch**: `Branch`
- **WhatsApp Number**: `Whatsapp No.`
- **TalentComm Preferences**:
  - `TalentComm Preference 1.1`
  - `TalentComm Preference 2.1`
- **WorkComm Preferences**: Empty (2nd year students only apply for TalentComm)

## Key Differences Between Years

1. **1st Year Students**:
   - Can apply for both TalentComm and WorkComm
   - Use standard preference column names
   - Have 3 WorkComm preferences (3rd is optional)

2. **2nd Year Students**:
   - Can only apply for TalentComm
   - Use different column names (with ".1" suffix)
   - WorkComm preferences remain empty

## Data Clearing Process

The system includes a comprehensive data clearing function in the Admin Portal that:
- Deletes all documents from the `candidates` collection
- Deletes all documents from the `paymentSessions` collection
- Requires double confirmation for safety
- Logs the action for security auditing

## Next Steps for New Data Import

1. **Clear existing data** using the Admin Portal's "Clear All Candidate Data" button
2. **Prepare new Excel file** with the correct column headers
3. **Import new data** using the Admin Portal's import functionality
4. **Verify data** by checking the dashboard displays correctly

## Important Notes

- The system automatically generates registration numbers if not provided
- Duplicate checking is performed on name, registration number, and WhatsApp number
- All data is sanitized and validated before storage
- Payment status starts as `false` for all new candidates
- Interview verdicts start as empty arrays

