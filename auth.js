// Wait for DOM and Firebase to be loaded
document.addEventListener('DOMContentLoaded', function() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
        console.error('Firebase Auth not loaded');
        showGlobalError('Firebase not loaded. Please refresh the page.');
        return;
    }

    const auth = firebase.auth();
    const db = firebase.firestore();

    // DOM Elements
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const roleSelectionForm = document.getElementById('roleSelectionForm');
    const loginFormElement = document.getElementById('loginFormElement');
    const registerFormElement = document.getElementById('registerFormElement');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const loginMessage = document.getElementById('loginMessage');
    const registerMessage = document.getElementById('registerMessage');
    
    // Role selection elements
    const roleCards = document.querySelectorAll('.role-card');
    const confirmRoleBtn = document.getElementById('confirmRoleBtn');
    
    // Registration progress
    const progressSteps = document.querySelectorAll('.progress-step');
    const stepIndicators = document.querySelectorAll('.step-indicator');
    const stepLabels = document.querySelectorAll('.step-label');
    const progressConnectors = document.querySelectorAll('.progress-connector');

    let selectedRole = null;
    let tempUserData = null;

    // Initialize registration progress
    function initializeProgress() {
        updateProgress(1); // Start at step 1 (registration)
    }

    // Update progress steps
    function updateProgress(step) {
        progressSteps.forEach((progressStep, index) => {
            const indicator = stepIndicators[index];
            const label = stepLabels[index];
            const connector = progressConnectors[index - 1];

            if (index + 1 < step) {
                // Completed steps
                indicator.classList.add('completed');
                indicator.classList.remove('active');
                label.classList.add('active');
                if (connector) connector.classList.add('completed');
            } else if (index + 1 === step) {
                // Current step
                indicator.classList.add('active');
                indicator.classList.remove('completed');
                label.classList.add('active');
            } else {
                // Future steps
                indicator.classList.remove('active', 'completed');
                label.classList.remove('active');
                if (connector) connector.classList.remove('completed');
            }
        });
    }

    // Switch between login and register forms
    showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        switchToForm('register');
        initializeProgress();
    });

    showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        switchToForm('login');
    });

    // Switch form with animation
    function switchToForm(formType) {
        const forms = [loginForm, registerForm, roleSelectionForm];
        forms.forEach(form => {
            form.classList.remove('active');
            form.style.opacity = '0';
            form.style.transform = 'translateX(30px)';
        });

        setTimeout(() => {
            const targetForm = formType === 'login' ? loginForm : 
                             formType === 'register' ? registerForm : roleSelectionForm;
            targetForm.classList.add('active');
            targetForm.style.opacity = '1';
            targetForm.style.transform = 'translateX(0)';
        }, 300);
        
        clearMessages();
        if (formType === 'register') {
            resetForms();
        }
    }

    // Role selection
    roleCards.forEach(card => {
        card.addEventListener('click', () => {
            // Remove selected class from all cards
            roleCards.forEach(c => c.classList.remove('selected'));
            // Add selected class to clicked card
            card.classList.add('selected');
            selectedRole = card.getAttribute('data-role');
            confirmRoleBtn.disabled = false;
        });
    });

    // Confirm role and complete registration
    confirmRoleBtn.addEventListener('click', async () => {
        if (!selectedRole || !tempUserData) {
            showMessage(registerMessage, 'Please complete all registration steps.', 'error');
            return;
        }

        try {
            setLoading(confirmRoleBtn, true);

            // Complete user registration with role
            const userData = {
                ...tempUserData,
                role: selectedRole,
                memberSince: selectedRole === 'member' ? new Date() : null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                activeChits: 0,
                totalInvestment: 0,
                returnsReceived: 0,
                creditScore: 'Good'
            };

            await db.collection('users').doc(tempUserData.uid).set(userData);

            showMessage(registerMessage, `Registration successful! Welcome as ${selectedRole === 'manager' ? 'Manager' : 'Member'}.`, 'success');

            // Redirect based on role
            setTimeout(() => {
                const redirectUrl = selectedRole === 'manager' ? 'dashboard-manager.html' : 'dashboard-member.html';
                window.location.href = redirectUrl;
            }, 2000);

        } catch (error) {
            console.error('Error completing registration:', error);
            showMessage(registerMessage, 'Error completing registration: ' + error.message, 'error');
        } finally {
            setLoading(confirmRoleBtn, false);
        }
    });

    // [Keep all the existing functions like clearMessages, showMessage, setLoading, etc.]

    // Register form submission (Updated)
    registerFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;
        const acceptTerms = document.getElementById('acceptTerms').checked;
        const submitButton = registerFormElement.querySelector('.btn-auth');
        
        // Validation (keep existing validation code)
        if (!name || !email || !password || !confirmPassword) {
            showMessage(registerMessage, 'Please fill in all fields.', 'error');
            return;
        }
        
        if (!isValidEmail(email)) {
            showMessage(registerMessage, 'Please enter a valid email address.', 'error');
            return;
        }
        
        if (!isStrongPassword(password)) {
            showMessage(registerMessage, 'Password should be at least 6 characters long.', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            showMessage(registerMessage, 'Passwords do not match.', 'error');
            return;
        }
        
        if (!acceptTerms) {
            showMessage(registerMessage, 'Please accept the Terms of Service and Privacy Policy.', 'error');
            return;
        }
        
        setLoading(submitButton, true);
        
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Store temporary user data for role selection
            tempUserData = {
                uid: user.uid,
                name: name,
                email: email,
                phone: '', // Will be updated later
                address: '' // Will be updated later
            };

            // Move to role selection step
            updateProgress(2);
            switchToForm('roleSelection');

        } catch (error) {
            console.error('Registration error:', error);
            let errorMessage = 'An error occurred during registration. Please try again.';
            
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'An account with this email already exists.';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Password is too weak. Please choose a stronger password.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address format.';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = 'Email/password accounts are not enabled. Please contact support.';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Network error. Please check your internet connection.';
                    break;
            }
            
            showMessage(registerMessage, errorMessage, 'error');
        } finally {
            setLoading(submitButton, false);
        }
    });

    // Login form submission (Enhanced with role-based redirect)
    loginFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const submitButton = loginFormElement.querySelector('.btn-auth');
        
        // Basic validation
        if (!email || !password) {
            showMessage(loginMessage, 'Please fill in all fields.', 'error');
            return;
        }
        
        if (!isValidEmail(email)) {
            showMessage(loginMessage, 'Please enter a valid email address.', 'error');
            return;
        }
        
        setLoading(submitButton, true);
        
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Get user role from Firestore
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (userDoc.exists) {
                const userData = userDoc.data();
                const userRole = userData.role || 'member';
                
                showMessage(loginMessage, `Login successful! Redirecting to ${userRole} dashboard...`, 'success');
                
                // Redirect based on role
                setTimeout(() => {
                    const redirectUrl = userRole === 'manager' ? 'dashboard-manager.html' : 'dashboard-member.html';
                    window.location.href = redirectUrl;
                }, 1500);
            } else {
                // User document doesn't exist, create one with member role
                await db.collection('users').doc(user.uid).set({
                    name: user.displayName || user.email.split('@')[0],
                    email: user.email,
                    role: 'member',
                    memberSince: new Date(),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    activeChits: 0,
                    totalInvestment: 0,
                    returnsReceived: 0,
                    creditScore: 'Good'
                });
                
                showMessage(loginMessage, 'Login successful! Redirecting to member dashboard...', 'success');
                setTimeout(() => {
                    window.location.href = 'dashboard-member.html';
                }, 1500);
            }
            
        } catch (error) {
            console.error('Login error:', error);
            let errorMessage = 'An error occurred during login. Please try again.';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'No account found with this email address.';
                    break;
                case 'auth/wrong-password':
                    errorMessage = 'Incorrect password. Please try again.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address format.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many failed attempts. Please try again later.';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'This account has been disabled.';
                    break;
            }
            
            showMessage(loginMessage, errorMessage, 'error');
        } finally {
            setLoading(submitButton, false);
        }
    });

    // Check if user is already logged in (Enhanced)
    auth.onAuthStateChanged(async (user) => {
        if (user && window.location.pathname.includes('auth.html')) {
            // User is logged in and on auth page, redirect based on role
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const redirectUrl = userData.role === 'manager' ? 'dashboard-manager.html' : 'dashboard-member.html';
                    window.location.href = redirectUrl;
                } else {
                    // User document doesn't exist, redirect to member dashboard
                    window.location.href = 'dashboard-member.html';
                }
            } catch (error) {
                console.error('Error checking user role:', error);
                window.location.href = 'dashboard-member.html';
            }
        }
    });

    // Initialize the auth page
    initializeProgress();
    console.log('Auth page initialized successfully with role selection');
});
