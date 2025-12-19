#!/usr/bin/env node

/**
 * MAFIA Dashboard Security Setup Script
 * This script helps configure and validate the security setup
 */

const fs = require('fs');
const path = require('path');

console.log('🔒 MAFIA Dashboard Security Setup');
console.log('==================================\n');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, 'env.example');

if (!fs.existsSync(envPath)) {
  console.log('❌ .env file not found!');
  
  if (fs.existsSync(envExamplePath)) {
    console.log('📋 Creating .env file from env.example...');
    try {
      fs.copyFileSync(envExamplePath, envPath);
      console.log('✅ .env file created successfully!');
      console.log('⚠️  Please edit .env file with your actual values before proceeding.');
    } catch (error) {
      console.error('❌ Failed to create .env file:', error.message);
      process.exit(1);
    }
  } else {
    console.error('❌ env.example file not found!');
    process.exit(1);
  }
} else {
  console.log('✅ .env file found');
}

// Validate environment variables
console.log('\n🔍 Validating environment variables...');

const requiredVars = [
  'REACT_APP_FIREBASE_API_KEY',
  'REACT_APP_FIREBASE_AUTH_DOMAIN',
  'REACT_APP_FIREBASE_PROJECT_ID',
  'REACT_APP_FIREBASE_STORAGE_BUCKET',
  'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  'REACT_APP_FIREBASE_APP_ID',
  'REACT_APP_ADMIN_EMAILS'
];

const envContent = fs.readFileSync(envPath, 'utf8');
const missingVars = [];

requiredVars.forEach(varName => {
  if (!envContent.includes(`${varName}=`)) {
    missingVars.push(varName);
  }
});

if (missingVars.length > 0) {
  console.log('❌ Missing required environment variables:');
  missingVars.forEach(varName => {
    console.log(`   - ${varName}`);
  });
  console.log('\n⚠️  Please add these variables to your .env file');
} else {
  console.log('✅ All required environment variables are configured');
}

// Check for hardcoded values
console.log('\n🔍 Checking for hardcoded sensitive values...');

const filesToCheck = [
  'src/firebaseConfig.js',
  'src/secureAdminAuth.js'
];

let foundHardcoded = false;

filesToCheck.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Check for hardcoded API keys
    if (content.includes('AIzaSyDb6LRxf9RDfQIa9l6ge5ZWl5ITTPjs4dk')) {
      console.log(`❌ Hardcoded Firebase API key found in ${filePath}`);
      foundHardcoded = true;
    }
    
    // Check for hardcoded admin emails
    if (content.includes('dheera1312@gmail.com') && !content.includes('process.env')) {
      console.log(`❌ Hardcoded admin email found in ${filePath}`);
      foundHardcoded = true;
    }
  }
});

if (!foundHardcoded) {
  console.log('✅ No hardcoded sensitive values found');
}

// Check Firebase security rules
console.log('\n🔍 Checking Firebase security rules...');

const rulesPath = path.join(__dirname, 'firestore.rules');
if (fs.existsSync(rulesPath)) {
  console.log('✅ firestore.rules file found');
  
  const rulesContent = fs.readFileSync(rulesPath, 'utf8');
  
  // Check for basic security patterns
  const securityChecks = [
    { pattern: 'allow read, write: if false', name: 'Deny by default' },
    { pattern: 'isAuthenticated()', name: 'Authentication check' },
    { pattern: 'isAdmin()', name: 'Admin authorization' },
    { pattern: 'isInterviewer()', name: 'Interviewer authorization' }
  ];
  
  securityChecks.forEach(check => {
    if (rulesContent.includes(check.pattern)) {
      console.log(`✅ ${check.name} found in security rules`);
    } else {
      console.log(`⚠️  ${check.name} not found in security rules`);
    }
  });
} else {
  console.log('❌ firestore.rules file not found!');
}

// Check for console.log statements
console.log('\n🔍 Checking for console.log statements...');

const jsFiles = getAllJsFiles(__dirname);
let consoleLogCount = 0;

jsFiles.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const matches = content.match(/console\.log/g);
    if (matches) {
      consoleLogCount += matches.length;
    }
  }
});

if (consoleLogCount > 0) {
  console.log(`⚠️  Found ${consoleLogCount} console.log statements`);
  console.log('   Consider using the secure logging utility in production');
} else {
  console.log('✅ No console.log statements found');
}

// Security recommendations
console.log('\n📋 Security Recommendations:');
console.log('1. ✅ Set up environment variables');
console.log('2. ✅ Deploy Firebase security rules');
console.log('3. ✅ Configure admin email addresses');
console.log('4. ✅ Set REACT_APP_ENVIRONMENT=production');
console.log('5. ✅ Set REACT_APP_DEBUG_MODE=false');
console.log('6. ✅ Set REACT_APP_ENABLE_CONSOLE_LOGS=false');
console.log('7. ✅ Enable HTTPS in production');
console.log('8. ✅ Regular security audits');
console.log('9. ✅ Monitor access logs');
console.log('10. ✅ Keep dependencies updated');

console.log('\n🎯 Next Steps:');
console.log('1. Edit .env file with your actual Firebase configuration');
console.log('2. Deploy Firebase security rules: firebase deploy --only firestore:rules');
console.log('3. Test the application in development mode');
console.log('4. Deploy to production with security settings enabled');

console.log('\n🔒 Security setup complete!');
console.log('For detailed instructions, see SECURITY_SETUP_GUIDE.md');

// Helper function to get all JS files
function getAllJsFiles(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      getAllJsFiles(fullPath, files);
    } else if (item.endsWith('.js') || item.endsWith('.jsx')) {
      files.push(fullPath);
    }
  });
  
  return files;
}


