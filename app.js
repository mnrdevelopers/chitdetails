// Firebase configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs, 
    doc, 
    getDoc, 
    updateDoc,
    setDoc,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// Your web app's Firebase configuration
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
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Authentication state observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        const userEmailElement = document.getElementById('user-email');
        if (userEmailElement) {
            userEmailElement.textContent = user.email;
        }
        
        // If on login page, redirect to dashboard
        if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
            window.location.href = 'dashboard.html';
        }
    } else {
        // User is signed out
        // If not on login page, redirect to index
        if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
            window.location.href = 'index.html';
        }
    }
});

// Login/Signup functionality for index.html
if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
    const authForm = document.getElementById('auth-form');
    const authTitle = document.getElementById('auth-title');
    const authButton = document.getElementById('auth-button');
    const authSwitchText = document.getElementById('auth-switch-text');
    const authSwitchLink = document.getElementById('auth-switch-link');
    const authMessage = document.getElementById('auth-message');
    
    let isLoginMode = true;
    
    // Toggle between login and signup
    authSwitchLink.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        
        if (isLoginMode) {
            authTitle.textContent = 'Login';
            authButton.textContent = 'Login';
            authSwitchText.innerHTML = 'Don\'t have an account? <a href="#" id="auth-switch-link">Sign Up</a>';
        } else {
            authTitle.textContent = 'Sign Up';
            authButton.textContent = 'Sign Up';
            authSwitchText.innerHTML = 'Already have an account? <a href="#" id="auth-switch-link">Login</a>';
        }
        
        // Re-attach event listener to the new link
        document.getElementById('auth-switch-link').addEventListener('click', arguments.callee);
    });
    
    // Handle form submission
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        try {
            if (isLoginMode) {
                // Login
                await signInWithEmailAndPassword(auth, email, password);
                showMessage('Login successful!', 'success');
            } else {
                // Sign up
                await createUserWithEmailAndPassword(auth, email, password);
                showMessage('Account created successfully!', 'success');
            }
        } catch (error) {
            console.error('Authentication error:', error);
            showMessage(error.message, 'error');
        }
    });
    
    function showMessage(message, type) {
        authMessage.textContent = message;
        authMessage.className = `message ${type}`;
    }
}

// Logout functionality
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
}

// Export Firebase services for use in other modules
export { auth, db, collection, addDoc, query, where, getDocs, doc, getDoc, updateDoc, setDoc, orderBy, serverTimestamp };
