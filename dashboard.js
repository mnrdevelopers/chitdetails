// DOM Elements
const userNameElement = document.getElementById('userName');
const totalFundsElement = document.getElementById('totalFunds');
const activeChitsElement = document.getElementById('activeChits');
const duePaymentsElement = document.getElementById('duePayments');
const totalReturnsElement = document.getElementById('totalReturns');
const chitFundsList = document.getElementById('chitFundsList');
const addChitBtn = document.getElementById('addChitBtn');
const logoutBtn = document.getElementById('logoutBtn');
const saveChitBtn = document.getElementById('saveChitBtn');

// Modal elements
const addChitModal = new bootstrap.Modal(document.getElementById('addChitModal'));

// Current user data
let currentUser = null;
let userData = null;

// Check authentication state
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        await loadUserData();
        await loadChitFunds();
        updateUI();
    } else {
        // User is not logged in, redirect to auth page
        window.location.href = 'auth.html';
    }
});

// Load user data from Firestore
async function loadUserData() {
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            userData = userDoc.data();
        } else {
            console.error('No user data found');
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

// Load chit funds from Firestore
async function loadChitFunds() {
    try {
        const chitsSnapshot = await db.collection('chits')
            .where('userId', '==', currentUser.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        chitFundsList.innerHTML = '';
        
        if (chitsSnapshot.empty) {
            chitFundsList.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-piggy-bank fa-3x text-muted mb-3"></i>
                    <p class="text-muted">No chit funds found. Add your first chit fund to get started.</p>
                </div>
            `;
            return;
        }
        
        let totalFunds = 0;
        let activeChits = 0;
        let duePayments = 0;
        let totalReturns = 0;
        
        chitsSnapshot.forEach(doc => {
            const chit = { id: doc.id, ...doc.data() };
            totalFunds += chit.totalAmount || 0;
            activeChits++;
            
            // Calculate due payments (simplified logic)
            const today = new Date();
            const createdDate = chit.createdAt?.toDate() || today;
            const monthsPassed = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24 * 30));
            
            if (monthsPassed < chit.duration && monthsPassed > 0) {
                duePayments++;
            }
            
            // Calculate returns (simplified logic)
            if (chit.completed) {
                totalReturns += chit.returns || 0;
            }
            
            renderChitFund(chit);
        });
        
        // Update dashboard stats
        totalFundsElement.textContent = `₹${totalFunds.toLocaleString()}`;
        activeChitsElement.textContent = activeChits;
        duePaymentsElement.textContent = duePayments;
        totalReturnsElement.textContent = `₹${totalReturns.toLocaleString()}`;
        
    } catch (error) {
        console.error('Error loading chit funds:', error);
        chitFundsList.innerHTML = `
            <div class="alert alert-danger">
                Error loading chit funds. Please try again.
            </div>
        `;
    }
}

// Render a single chit fund item
function renderChitFund(chit) {
    const progress = calculateProgress(chit);
    const progressPercentage = Math.min((progress.current / progress.total) * 100, 100);
    
    const chitElement = document.createElement('div');
    chitElement.className = 'chit-item fade-in';
    chitElement.innerHTML = `
        <div class="chit-header">
            <h3 class="chit-name">${chit.name}</h3>
            <div class="chit-amount">₹${chit.totalAmount?.toLocaleString()}</div>
        </div>
        
        <div class="progress mb-3" style="height: 8px;">
            <div class="progress-bar" role="progressbar" 
                 style="width: ${progressPercentage}%; background-color: var(--accent);"
                 aria-valuenow="${progressPercentage}" aria-valuemin="0" aria-valuemax="100">
            </div>
        </div>
        
        <div class="chit-details">
            <div class="chit-detail">
                <label>Duration</label>
                <span>${chit.duration} months</span>
            </div>
            <div class="chit-detail">
                <label>Monthly</label>
                <span>₹${chit.monthlyPayment?.toLocaleString()}</span>
            </div>
            <div class="chit-detail">
                <label>Progress</label>
                <span>${progress.current}/${progress.total}</span>
            </div>
            <div class="chit-detail">
                <label>Status</label>
                <span class="badge ${chit.completed ? 'bg-success' : 'bg-warning'}">
                    ${chit.completed ? 'Completed' : 'Active'}
                </span>
            </div>
        </div>
    `;
    
    chitFundsList.appendChild(chitElement);
}

// Calculate chit fund progress
function calculateProgress(chit) {
    const today = new Date();
    const createdDate = chit.createdAt?.toDate() || today;
    const monthsPassed = Math.floor((today - createdDate) / (1000 * 60 * 60 * 24 * 30));
    
    return {
        current: Math.min(monthsPassed + 1, chit.duration),
        total: chit.duration
    };
}

// Update UI with user data
function updateUI() {
    if (userData) {
        userNameElement.textContent = userData.name || 'User';
    }
}

// Add new chit fund
addChitBtn.addEventListener('click', () => {
    addChitModal.show();
});

// Save chit fund
saveChitBtn.addEventListener('click', async () => {
    const name = document.getElementById('chitName').value;
    const totalAmount = parseFloat(document.getElementById('chitAmount').value);
    const duration = parseInt(document.getElementById('chitDuration').value);
    const monthlyPayment = parseFloat(document.getElementById('monthlyPayment').value);
    
    if (!name || !totalAmount || !duration || !monthlyPayment) {
        alert('Please fill all fields');
        return;
    }
    
    try {
        setLoading(saveChitBtn, true);
        
        await db.collection('chits').add({
            userId: currentUser.uid,
            name: name,
            totalAmount: totalAmount,
            duration: duration,
            monthlyPayment: monthlyPayment,
            completed: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Reset form and close modal
        document.getElementById('addChitForm').reset();
        addChitModal.hide();
        
        // Reload chit funds
        await loadChitFunds();
        
    } catch (error) {
        console.error('Error adding chit fund:', error);
        alert('Error adding chit fund. Please try again.');
    } finally {
        setLoading(saveChitBtn, false);
    }
});

// Logout
logoutBtn.addEventListener('click', async () => {
    try {
        await auth.signOut();
        window.location.href = 'auth.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// Set loading state for button
function setLoading(button, isLoading) {
    if (isLoading) {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
    } else {
        button.disabled = false;
        button.innerHTML = 'Save Chit Fund';
    }
}

// Add some sample data for demo (remove in production)
async function addSampleData() {
    const chitsSnapshot = await db.collection('chits')
        .where('userId', '==', currentUser.uid)
        .get();
    
    if (chitsSnapshot.empty) {
        // Add sample chit funds
        const sampleChits = [
            {
                name: "Family Chit Fund",
                totalAmount: 100000,
                duration: 20,
                monthlyPayment: 5000,
                completed: false
            },
            {
                name: "Office Savings",
                totalAmount: 50000,
                duration: 10,
                monthlyPayment: 5000,
                completed: true,
                returns: 55000
            }
        ];
        
        for (const chit of sampleChits) {
            await db.collection('chits').add({
                userId: currentUser.uid,
                ...chit,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        await loadChitFunds();
    }
}

// Uncomment the line below to enable sample data (for demo purposes)
// addSampleData();
