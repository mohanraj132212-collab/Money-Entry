// ===========================================================
// firebase-config.js
//
// This is the ONLY file you need to edit to point Money Entry
// at a different Firebase project. Replace the values in
// `firebaseConfig` with your own project's web app config
// (Firebase console → Project settings → General → Your apps).
// ===========================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB3-OhLPS70v9KFFF1nNj8tInDo_9wo7wI",
  authDomain: "moin-bd378.firebaseapp.com",
  projectId: "moin-bd378",
  storageBucket: "moin-bd378.firebasestorage.app",
  messagingSenderId: "505629490484",
  appId: "1:505629490484:web:94ee6c7300fc0fa4a33961"
};

// Initialize Firebase app + Firestore once, and export the
// Firestore instance for the rest of the app to use.
export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);

// Name of the Firestore collection that stores every money entry.
export const ENTRIES_COLLECTION = "moneyEntries";
