# 📊 Data Import Guide

## 🎯 **Excel File Structure Requirements**

Your Excel file should have the following columns:

### **For 1st Year Students:**
- `Name` - Candidate's full name
- `Reg No.` - Registration number (optional, will auto-generate if missing)
- `College` - College name
- `Branch` - Branch/Department
- `Whatsapp No.` - WhatsApp number
- `Academic Year` - Must be "1st year"
- `TalentComm Preference 1` - First TalentComm preference
- `TalentComm Preference 2` - Second TalentComm preference
- `WorkComm Preference 1` - First WorkComm preference
- `WorkComm Preference 2` - Second WorkComm preference  
- `WorkComm Preference 3 (optional)` - Third WorkComm preference (optional)

### **For 2nd Year Students:**
- `Name` - Candidate's full name
- `Reg No.` - Registration number (optional, will auto-generate if missing)
- `College` - College name
- `Branch` - Branch/Department
- `Whatsapp No.` - WhatsApp number
- `Academic Year` - Must be "2nd year"
- `TalentComm Preference 1.1` - First TalentComm preference
- `TalentComm Preference 2.1` - Second TalentComm preference

## 🔄 **How to Import Data**

### **Step 1: Access Admin Portal**
1. Go to your app URL + `/admin`
2. Login with admin credentials: `dheera1312@gmail.com`

### **Step 2: Import Data**
1. Look for the "📊 Import Candidate Data" section
2. Click "Choose File" and select your Excel file
3. Click "📤 Import Data" button
4. Confirm the import when prompted

### **Step 3: Verify Import**
1. Check the import progress and results
2. View the candidates table to see imported data
3. Check console for any error details

## ⚠️ **Important Notes**

- **Year Detection**: The system automatically detects if a student is 1st year or 2nd year based on the "Academic Year" column
- **Auto-Registration**: If Reg No is missing, the system will generate unique registration numbers (MAFIA0001, MAFIA0002, etc.)
- **Data Validation**: The system validates and cleans the data before importing
- **Smart Duplicate Detection**: The system checks for duplicates using multiple strategies:
  - **Exact Registration Number Match**: Very high confidence - skips automatically
  - **Exact Name Match**: High confidence - compares data completeness
  - **WhatsApp Number Match**: High confidence - compares data completeness
  - **Similar Name Detection**: Medium confidence - flags for review
- **Data Completeness Scoring**: System compares existing vs new data and keeps the more complete record
- **Error Handling**: Any import errors will be logged and displayed

## 📋 **Expected Column Headers**

Make sure your Excel file has these exact column headers:

```
Timestamp | Name | Reg No. | College | Branch | Whatsapp No. | Academic Year | TalentComm Preference 1 | TalentComm Preference 2 | WorkComm Preference 1 | WorkComm Preference 2 | WorkComm Preference 3 (optional) | TalentComm Preference 1.1 | TalentComm Preference 2.1
```

## 🎨 **Data Mapping**

- **1st Year Students**: Uses columns 7-11 (TalentComm Preference 1&2 + WorkComm Preference 1,2,3)
- **2nd Year Students**: Uses columns 12-13 (TalentComm Preference 1.1 & 2.1)
- **Academic Year Detection**: System automatically detects year from "Academic Year" column

## 🔄 **Duplicate Handling**

The system automatically handles duplicates with smart logic:

### **Duplicate Detection Strategies:**
1. **Registration Number Match** (Very High Confidence)
   - Automatically skips if exact registration number exists
   - Prevents duplicate entries for same student

2. **Exact Name Match** (High Confidence)
   - Compares data completeness scores
   - Keeps the record with more complete information
   - Updates existing record if new data is more complete

3. **WhatsApp Number Match** (High Confidence)
   - Normalizes phone numbers for comparison
   - Compares data completeness scores
   - Handles different phone number formats

4. **Similar Name Detection** (Medium Confidence)
   - Uses fuzzy matching for similar names
   - Flags potential duplicates for review
   - Still imports but marks for manual verification

### **Data Completeness Scoring:**
The system scores records based on:
- Name completeness (2 points)
- Registration number (2 points)
- College information (1 point)
- Branch information (1 point)
- WhatsApp number (1 point)
- TalentComm preferences (2 points)
- WorkComm preferences (1 point)

## 🔧 **Troubleshooting**

If import fails:
1. Check that your Excel file has the correct column headers
2. Ensure the file is in .xlsx format
3. Check the browser console for detailed error messages
4. Verify that at least one row has TalentComm data
5. Review duplicate detection results in the import summary

## 📞 **Support**

If you encounter issues, contact: **📱 9591185310**
