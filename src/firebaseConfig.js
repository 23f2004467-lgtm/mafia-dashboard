// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
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

// ✅ Export Firebase features you'll use
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const db = getFirestore(app);
