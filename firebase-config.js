// Firebase configuration with enhanced error handling
const firebaseConfig = {
    apiKey: "AIzaSyCHmN3ChQm8HLMQ1bxzwtd7dEaJJZDPts4",
    authDomain: "graminchits.firebaseapp.com",
    projectId: "graminchits",
    storageBucket: "graminchits.firebasestorage.app",
    messagingSenderId: "775668330555",
    appId: "1:775668330555:web:8585a06c781ae856ceac1e",
    measurementId: "G-9KWY7YMSBQ"
};

try {
    // Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    // Initialize Firebase Authentication and Firestore
    const auth = firebase.auth();
    const db = firebase.firestore();
    
    // Enable offline persistence
    db.enablePersistence()
        .catch((err) => {
            console.warn('Firebase persistence failed: ', err);
        });
        
    console.log("Firebase initialized successfully");
} catch (error) {
    console.error("Firebase initialization error:", error);
}
