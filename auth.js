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
    const roleSelectionMessage = document.getElementById('roleSelectionMessage');
    
    // Role selection elements
    const roleCards = document.querySelectorAll('.role-card');
    const confirmRoleBtn = document.getElementById('confirmRoleBtn');
    
    // Registration progress
    const registrationProgress = document.getElementById('registrationProgress');
    const step1Indicator = document.getElementById('step1Indicator');
    const step2Indicator = document.getElementById('step2Indicator');
    const step1Label = document.getElementById('step1Label');
    const step2Label = document.getElementById('step2Label');
    const step1Connector = document.getElementById('step1Connector');

    let selectedRole = null;
    let tempUserData = null;

    // Initialize password toggles
    initPasswordToggles();

    // Initialize registration progress
    function initializeProgress() {
        registrationProgress.classList.remove('d-none');
        updateProgress(1); // Start at step 1 (registration)
    }

    // Hide registration progress
    function hideProgress() {
        registrationProgress.classList.add('d-none');
    }

    // Update progress steps
    function updateProgress(step) {
        // Reset all steps
        step1Indicator.classList.remove('active', 'completed');
        step2Indicator.classList.remove('active', 'completed');
        step1Label.classList.remove('active');
        step2Label.classList.remove('active');
        step1Connector.classList.remove('completed');

        if (step === 1) {
            // Step 1 active
            step1Indicator.classList.add('active');
            step1Label.classList.add('active');
        } else if (step === 2) {
            // Step 1 completed, Step 2 active
            step1Indicator.classList.add('completed');
            step2Indicator.classList.add('active');
            step1Label.classList.add('active');
            step2Label.classList.add('active');
            step1Connector.classList.add('completed');
        }
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
        hideProgress();
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

    // Initialize password visibility toggles
    function initPasswordToggles() {
        // Login password toggle
        document.getElementById('loginPasswordToggle').addEventListener('click', () => {
            togglePasswordVisibility('loginPassword', 'loginPasswordToggle');
        });

        // Register password toggle
        document.getElementById('registerPasswordToggle').addEventListener('click', () => {
            togglePasswordVisibility('registerPassword', 'registerPasswordToggle');
        });

        // Register confirm password toggle
        document.getElementById('registerConfirmPasswordToggle').addEventListener('click', () => {
            togglePasswordVisibility('registerConfirmPassword', 'registerConfirmPasswordToggle');
        });
    }

    // Toggle password visibility
    function togglePasswordVisibility(inputId, toggleButtonId) {
        const input = document.getElementById(inputId);
        const toggleButton = document.getElementById(toggleButtonId);
        const icon = toggleButton.querySelector('i');
        
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    }

    // Clear message alerts
    function clearMessages() {
        loginMessage.classList.add('d-none');
        registerMessage.classList.add('d-none');
        roleSelectionMessage.classList.add('d-none');
        loginMessage.className = 'alert-message d-none';
        registerMessage.className = 'alert-message d-none';
        roleSelectionMessage.className = 'alert-message d-none';
    }

    // Reset form fields
    function resetForms() {
        loginFormElement.reset();
        registerFormElement.reset();
        roleSelectionForm.reset();
        
        // Reset role selection
        roleCards.forEach(card => card.classList.remove('selected'));
        selectedRole = null;
        confirmRoleBtn.disabled = true;
        tempUserData = null;
    }

    // Show message alert
    function showMessage(element, message, type) {
        element.textContent = message;
        element.className = `alert-message ${type}`;
        element.classList.remove('d-none');
        
        // Auto hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                element.classList.add('d-none');
            }, 5000);
        }
    }

    // Show global error message
    function showGlobalError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'alert alert-danger position-fixed top-0 start-50 translate-middle-x mt-3';
        errorDiv.style.zIndex = '9999';
        errorDiv.innerHTML = `
            <i class="fas fa-exclamation-triangle me-2"></i>
            ${message}
            <button type="button" class="btn-close ms-2" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(errorDiv);
    }

    // Set loading state for button
    function setLoading(button, isLoading) {
        const btnText = button.querySelector('.btn-text');
        const btnLoader = button.querySelector('.btn-loader');
        
        if (isLoading) {
            button.disabled = true;
            btnText.classList.add('d-none');
            btnLoader.classList.remove('d-none');
        } else {
            button.disabled = false;
            btnText.classList.remove('d-none');
            btnLoader.classList.add('d-none');
        }
    }

    // Validate email format
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Validate password strength
    function isStrongPassword(password) {
        return password.length >= 6;
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
            showMessage(roleSelectionMessage, 'Please select a role to continue.', 'error');
            return;
        }

        try {
            setLoading(confirmRoleBtn, true);

            // Complete user registration with role
            const userData = {
                uid: tempUserData.uid,
                name: tempUserData.name,
                email: tempUserData.email,
                role: selectedRole,
                memberSince: selectedRole === 'member' ? firebase.firestore.FieldValue.serverTimestamp() : null,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                activeChits: 0,
                totalInvestment: 0,
                returnsReceived: 0,
                creditScore: 'Good',
                phone: '',
                address: ''
            };

            await db.collection('users').doc(tempUserData.uid).set(userData);

            showMessage(roleSelectionMessage, `Registration successful! Welcome as ${selectedRole === 'manager' ? 'Manager' : 'Member'}.`, 'success');

            // Redirect based on role
            setTimeout(() => {
                const redirectUrl = selectedRole === 'manager' ? 'dashboard-manager.html' : 'dashboard-member.html';
                window.location.href = redirectUrl;
            }, 2000);

        } catch (error) {
            console.error('Error completing registration:', error);
            showMessage(roleSelectionMessage, 'Error completing registration: ' + error.message, 'error');
        } finally {
            setLoading(confirmRoleBtn, false);
        }
    });

    // Register form submission
    registerFormElement.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('registerConfirmPassword').value;
        const acceptTerms = document.getElementById('acceptTerms').checked;
        const submitButton = registerFormElement.querySelector('.btn-auth');
        
        // Validation
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
                email: email
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

    // Login form submission
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
                    memberSince: firebase.firestore.FieldValue.serverTimestamp(),
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

    // Check if user is already logged in
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

    // Add input animations
    document.querySelectorAll('.form-control').forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', function() {
            if (!this.value) {
                this.parentElement.classList.remove('focused');
            }
        });
    });

    console.log('Auth page initialized successfully with role selection');
});
