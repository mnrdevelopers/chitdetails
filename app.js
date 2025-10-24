import { 
    auth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from './firebase-config.js';

// Authentication state observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        console.log('User is signed in:', user.email);
        
        // Update UI for logged in user
        const userNameElement = document.getElementById('user-name');
        if (userNameElement) {
            userNameElement.textContent = user.displayName || user.email;
        }
        
        // Redirect from login page if needed
        if (window.location.pathname.endsWith('index.html')) {
            window.location.href = 'dashboard.html';
        }
    } else {
        // User is signed out
        console.log('User is signed out');
        
        // Redirect to login page if not already there
        if (!window.location.pathname.endsWith('index.html')) {
            window.location.href = 'index.html';
        }
    }
});

// Login functionality
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const messageElement = document.getElementById('auth-message');
        
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log('User logged in:', userCredential.user);
            
            // Clear form
            loginForm.reset();
            
            // Show success message
            showMessage(messageElement, 'Login successful! Redirecting...', 'success');
            
            // Redirect to dashboard (handled by auth state change)
        } catch (error) {
            console.error('Login error:', error);
            showMessage(messageElement, getAuthErrorMessage(error), 'error');
        }
    });
}

// Signup functionality
const signupForm = document.getElementById('signup-form');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const messageElement = document.getElementById('auth-message');
        
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            console.log('User created:', userCredential.user);
            
            // Clear form
            signupForm.reset();
            
            // Show success message
            showMessage(messageElement, 'Account created successfully! You can now login.', 'success');
            
            // Switch to login tab
            document.getElementById('login-tab').click();
        } catch (error) {
            console.error('Signup error:', error);
            showMessage(messageElement, getAuthErrorMessage(error), 'error');
        }
    });
}

// Logout functionality
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            console.log('User signed out');
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
}

// Tab switching for auth forms
const loginTab = document.getElementById('login-tab');
const signupTab = document.getElementById('signup-tab');

if (loginTab && signupTab) {
    loginTab.addEventListener('click', () => switchAuthTab('login'));
    signupTab.addEventListener('click', () => switchAuthTab('signup'));
}

// Helper Functions
function switchAuthTab(tab) {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const loginTab = document.getElementById('login-tab');
    const signupTab = document.getElementById('signup-tab');
    const messageElement = document.getElementById('auth-message');
    
    // Clear any existing messages
    if (messageElement) {
        messageElement.textContent = '';
        messageElement.className = 'message';
    }
    
    if (tab === 'login') {
        loginForm.classList.add('active');
        signupForm.classList.remove('active');
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
    } else {
        loginForm.classList.remove('active');
        signupForm.classList.add('active');
        loginTab.classList.remove('active');
        signupTab.classList.add('active');
    }
}

function showMessage(element, message, type) {
    if (!element) return;
    
    element.textContent = message;
    element.className = `message ${type}`;
    
    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
        setTimeout(() => {
            element.textContent = '';
            element.className = 'message';
        }, 3000);
    }
}

function getAuthErrorMessage(error) {
    switch (error.code) {
        case 'auth/email-already-in-use':
            return 'This email is already registered.';
        case 'auth/invalid-email':
            return 'Please enter a valid email address.';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters.';
        case 'auth/user-not-found':
            return 'No account found with this email.';
        case 'auth/wrong-password':
            return 'Incorrect password.';
        case 'auth/too-many-requests':
            return 'Too many failed attempts. Please try again later.';
        default:
            return 'An error occurred. Please try again.';
    }
}

// Modal functionality
function setupModal(modalId, openBtnId, closeBtnClass) {
    const modal = document.getElementById(modalId);
    const openBtn = document.getElementById(openBtnId);
    const closeBtns = document.querySelectorAll(`.${closeBtnClass}`);
    
    if (openBtn && modal) {
        openBtn.addEventListener('click', () => {
            modal.classList.add('active');
        });
    }
    
    if (closeBtns) {
        closeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        });
    }
    
    // Close modal when clicking outside
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    }
}

// Initialize modals if they exist
document.addEventListener('DOMContentLoaded', () => {
    // Create chit modal
    if (document.getElementById('create-chit-modal')) {
        setupModal('create-chit-modal', 'create-chit-btn', 'close-modal');
    }
    
    // Add member modal
    if (document.getElementById('add-member-modal')) {
        setupModal('add-member-modal', 'add-member-btn', 'close-modal');
    }
});
