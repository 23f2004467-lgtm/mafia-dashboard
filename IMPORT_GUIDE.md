# MAFIA Dashboard - Data Import Guide

## Overview
This guide will help you import your Excel file data into the MAFIA Dashboard while filtering out duplicates and maintaining data integrity.

## Files Created
- `importDataFinal.js` - The main import script
- `firestore.rules.backup` - Backup of your original security rules
- `firestore.rules.temp` - Temporary security rules for import (created by script)

## Step-by-Step Instructions

### Step 1: Prepare for Import
1. Make sure your Excel file `Mafia TalentComm WorkComm Recruitments 25-26 Responses (4).xlsx` is in the project directory
2. Ensure you have Node.js and npm installed
3. Install required dependencies: `npm install xlsx`

### Step 2: Run the Import Script
```bash
node importDataFinal.js
```

The script will:
- Create a temporary security rules file (`firestore.rules.temp`)
- Provide instructions for updating Firebase security rules
- Wait for you to update the rules
- Import the data with duplicate checking
- Show detailed results

### Step 3: Update Firebase Security Rules (Temporary)
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `mafia-recruitments`
3. Go to Firestore Database > Rules
4. Replace the current rules with the contents of `firestore.rules.temp`
5. Click "Publish"

**Temporary Rules Content:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### Step 4: Run the Import
After updating the security rules, the script will automatically proceed with the import.

### Step 5: Restore Original Security Rules
**IMPORTANT**: After the import is complete, you MUST restore your original security rules:

1. Go back to Firebase Console > Firestore Database > Rules
2. Replace the temporary rules with your original rules (from `firestore.rules.backup`)
3. Click "Publish"

## What the Script Does

### Data Processing
- Reads the Excel file and validates the structure
- Handles both 1st year and 2nd year students
- Maps preferences correctly based on academic year
- Generates registration numbers if missing
- Filters out empty rows

### Duplicate Detection
- Checks for duplicates based on:
  - Name (case-insensitive)
  - Registration number
  - WhatsApp number
- Skips duplicates automatically

### Data Validation
- Validates academic year format
- Ensures required fields are present
- Handles missing preferences gracefully
- Logs warnings for data issues

### Error Handling
- Continues processing even if some rows fail
- Provides detailed error reports
- Shows progress during import

## Expected Results

The script will show:
- Total candidates found in Excel
- Number of candidates successfully imported
- Number of duplicates skipped
- Number of errors encountered
- Detailed error information

## Troubleshooting

### Permission Denied Errors
If you get permission errors:
1. Make sure you updated the Firebase security rules
2. Wait a few minutes for rule changes to propagate
3. Run the script again

### Data Validation Errors
If many rows fail validation:
1. Check the Excel file structure
2. Ensure column headers match expected format
3. Review the error details for specific issues

### Import Fails
If the import fails completely:
1. Check your internet connection
2. Verify Firebase project settings
3. Ensure the Excel file is accessible

## Security Notes

⚠️ **IMPORTANT SECURITY WARNING**:
- The temporary rules allow ALL reads and writes
- This is only for the import process
- **ALWAYS restore your original security rules after import**
- Never leave the temporary rules active in production

## Data Structure

The imported data will follow this structure:
```javascript
{
  name: String,
  regNo: String,
  year: "1st Year" | "2nd Year",
  college: String,
  branch: String,
  whatsappNumber: String,
  preferences: {
    talentComm: { pref1: String, pref2: String },
    workComm: { pref1: String, pref2: String, pref3: String }
  },
  verdict: { talentComm: [], workComm: [] },
  comments: "",
  paid: false,
  paymentDetails: null,
  lastUpdatedBy: "Final Import Script",
  lastUpdatedAt: ISO timestamp
}
```

## Support

If you encounter issues:
1. Check the console output for error messages
2. Review the error details provided by the script
3. Ensure all steps were followed correctly
4. Verify your Firebase project settings

## Cleanup

After successful import:
1. Delete the temporary files:
   ```bash
   rm firestore.rules.temp
   ```
2. Keep `firestore.rules.backup` for future reference
3. Verify the data in your Firebase console
4. Test your application to ensure everything works correctly


