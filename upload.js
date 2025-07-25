const admin = require("firebase-admin");
const fs = require("fs");

// Load your Firebase service account key
const serviceAccount = require("./serviceAccountKey.json"); // Replace with your actual file name

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 🔥 Load and convert the test data from object to array
const rawData = require("./testData.json");
const testData = Object.values(rawData); // Convert object to array

async function uploadData() {
  const collectionRef = db.collection("candidates");

  for (const candidate of testData) {
    const docRef = collectionRef.doc(candidate.regNo);
    try {
      await docRef.set(candidate);
      console.log(`✅ Uploaded: ${candidate.name} (${candidate.regNo})`);
    } catch (err) {
      console.error(`❌ Error uploading ${candidate.regNo}:`, err);
    }
  }

  console.log("🚀 Upload complete.");
}

uploadData();
