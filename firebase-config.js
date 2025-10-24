// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCHmN3ChQm8HLMQ1bxzwtd7dEaJJZDPts4",
  authDomain: "graminchits.firebaseapp.com",
  projectId: "graminchits",
  storageBucket: "graminchits.firebasestorage.app",
  messagingSenderId: "775668330555",
  appId: "1:775668330555:web:8585a06c781ae856ceac1e",
  measurementId: "G-9KWY7YMSBQ"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Authentication and Firestore
const auth = firebase.auth();
const db = firebase.firestore();

// For demo purposes - replace with your actual Firebase config
// You can get this from Firebase Console > Project Settings > General
console.log("Firebase initialized successfully");
