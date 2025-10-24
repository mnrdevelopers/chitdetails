import { 
    db, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    orderBy,
    serverTimestamp
} from './firebase-config.js';
import { auth } from './firebase-config.js';

// DOM Elements
const chitList = document.getElementById('chit-list');
const createChitForm = document.getElementById('create-chit-form');
const userNameElement = document.getElementById('user-name');

// Set current date as default for start date
function setDefaultDate() {
    const currentDateStr = new Date().toISOString().split('T')[0];
    const startDateInput = document.getElementById('start-date');
    if (startDateInput) {
        startDateInput.value = currentDateStr;
        startDateInput.min = currentDateStr;
    }
}

// Update user name in header
function updateUserName(user) {
    if (user && userNameElement) {
        userNameElement.textContent = user.displayName || user.email.split('@')[0];
    }
}

// Check authentication and initialize dashboard
function initializeDashboard() {
    const user = auth.currentUser;
    
    if (!user) {
        console.log('No authenticated user, waiting for auth state...');
        // Auth state change will handle redirect
        return;
    }
    
    console.log('Dashboard initialized for user:', user.email);
    
    // Update user name
    updateUserName(user);
    
    // Set default date
    setDefaultDate();
    
    // Load chits
    loadChitGroups();
}

// Load user's chit groups
async function loadChitGroups() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.log('No user found');
            return;
        }
        
        console.log('Loading chits for user:', user.uid);
        
        // Show loading state
        chitList.innerHTML = '<div class="loading-message">Loading your chit groups...</div>';
        
        // Query chit groups created by current user
        const q = query(
            collection(db, 'chits'),
            where('ownerId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        
        // Clear existing list
        chitList.innerHTML = '';
        
        if (querySnapshot.empty) {
            chitList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">💸</div>
                    <h3>No Chit Groups Yet</h3>
                    <p>You haven't created any chit groups yet.</p>
                    <p>Click "Create New Chit" to get started!</p>
                </div>
            `;
            return;
        }
        
        console.log('Found', querySnapshot.size, 'chits');
        
        // Display chit groups
        querySnapshot.forEach((doc) => {
            const chit = doc.data();
            displayChitCard(doc.id, chit);
        });
        
    } catch (error) {
        console.error('Error loading chit groups:', error);
        chitList.innerHTML = `
            <div class="error-state">
                <div class="error-icon">⚠️</div>
                <h3>Error Loading Chit Groups</h3>
                <p>There was a problem loading your chit groups.</p>
                <button onclick="loadChitGroups()" class="btn-primary">Try Again</button>
            </div>
        `;
    }
}

// Display chit card in the list
function displayChitCard(chitId, chit) {
    if (!chit || !chit.name || !chit.monthlyAmount || !chit.totalMembers || !chit.totalMonths) {
        console.error('Invalid chit data:', chit);
        return;
    }
    
    const totalAmount = chit.monthlyAmount * chit.totalMembers;
    const monthsCompleted = calculateMonthsCompleted(chit.startDate, chit.totalMonths);
    const progressPercentage = (monthsCompleted / chit.totalMonths) * 100;
    
    const chitCard = document.createElement('div');
    chitCard.className = 'chit-card';
    chitCard.innerHTML = `
        <div class="chit-card-header">
            <h3>${chit.name}</h3>
            <span class="chit-status ${monthsCompleted >= chit.totalMonths ? 'completed' : 'active'}">
                ${monthsCompleted >= chit.totalMonths ? 'Completed' : 'Active'}
            </span>
        </div>
        <div class="chit-card-body">
            <div class="chit-info">
                <div class="info-item">
                    <span class="label">Monthly:</span>
                    <span class="value">₹${chit.monthlyAmount.toLocaleString()}</span>
                </div>
                <div class="info-item">
                    <span class="label">Members:</span>
                    <span class="value">${chit.totalMembers}</span>
                </div>
                <div class="info-item">
                    <span class="label">Total Amount:</span>
                    <span class="value">₹${totalAmount.toLocaleString()}</span>
                </div>
            </div>
            <div class="progress-section">
                <div class="progress-info">
                    <span>Progress: ${monthsCompleted}/${chit.totalMonths} months</span>
                    <span>${Math.round(progressPercentage)}%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercentage}%"></div>
                </div>
            </div>
        </div>
        <div class="chit-card-actions">
            <button class="btn-view" data-chit-id="${chitId}">View Details</button>
        </div>
    `;
    
    const viewBtn = chitCard.querySelector('.btn-view');
    viewBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = `chit.html?id=${chitId}`;
    });
    
    chitCard.addEventListener('click', (e) => {
        if (!e.target.classList.contains('btn-view')) {
            window.location.href = `chit.html?id=${chitId}`;
        }
    });
    
    chitList.appendChild(chitCard);
}

// Calculate months completed
function calculateMonthsCompleted(startDate, totalMonths) {
    if (!startDate) return 0;
    
    try {
        const start = new Date(startDate);
        const now = new Date();
        
        let months = (now.getFullYear() - start.getFullYear()) * 12;
        months -= start.getMonth();
        months += now.getMonth();
        
        const monthsCompleted = Math.max(0, months + 1);
        return Math.min(monthsCompleted, totalMonths);
    } catch (error) {
        console.error('Error calculating months completed:', error);
        return 0;
    }
}

// Create new chit group
if (createChitForm) {
    createChitForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const user = auth.currentUser;
        if (!user) {
            alert('Please log in to create a chit group.');
            return;
        }
        
        try {
            const name = document.getElementById('chit-name').value.trim();
            const monthlyAmount = parseInt(document.getElementById('monthly-amount').value);
            const totalMembers = parseInt(document.getElementById('total-members').value);
            const totalMonths = parseInt(document.getElementById('total-months').value);
            const startDate = document.getElementById('start-date').value;
            
            // Validation
            if (!name) throw new Error('Chit name is required');
            if (name.length < 3) throw new Error('Chit name must be at least 3 characters long');
            if (isNaN(monthlyAmount) || monthlyAmount < 1000) throw new Error('Monthly amount must be at least ₹1000');
            if (isNaN(totalMembers) || totalMembers < 5 || totalMembers > 50) throw new Error('Total members must be between 5 and 50');
            if (isNaN(totalMonths) || totalMonths < 5 || totalMonths > 60) throw new Error('Total months must be between 5 and 60');
            if (!startDate) throw new Error('Start date is required');
            
            const selectedDate = new Date(startDate);
            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);
            if (selectedDate < currentDate) throw new Error('Start date cannot be in the past');
            
            const formData = {
                name: name,
                monthlyAmount: monthlyAmount,
                totalMembers: totalMembers,
                totalMonths: totalMonths,
                startDate: startDate,
                ownerId: user.uid,
                ownerEmail: user.email,
                createdAt: serverTimestamp(),
                currentMonth: 1
            };
            
            // Show loading state
            const submitBtn = createChitForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.textContent = 'Creating...';
            submitBtn.disabled = true;
            
            // Add chit to Firestore
            const docRef = await addDoc(collection(db, 'chits'), formData);
            console.log('Chit created with ID:', docRef.id);
            
            // Close modal and reset form
            document.getElementById('create-chit-modal').classList.remove('active');
            createChitForm.reset();
            setDefaultDate();
            
            // Reset button state
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            
            // Show success message
            showTempMessage('Chit group created successfully!', 'success');
            
            // Reload the chit list
            setTimeout(() => {
                loadChitGroups();
            }, 1000);
            
        } catch (error) {
            console.error('Error creating chit:', error);
            
            const submitBtn = createChitForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.textContent = 'Create Chit';
                submitBtn.disabled = false;
            }
            
            alert('Error: ' + error.message);
        }
    });
}

// Show temporary message
function showTempMessage(message, type) {
    const existingMessages = document.querySelectorAll('.temp-message');
    existingMessages.forEach(msg => msg.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message temp-message ${type}`;
    messageDiv.textContent = message;
    messageDiv.style.position = 'fixed';
    messageDiv.style.top = '20px';
    messageDiv.style.left = '50%';
    messageDiv.style.transform = 'translateX(-50%)';
    messageDiv.style.zIndex = '1000';
    messageDiv.style.minWidth = '300px';
    messageDiv.style.textAlign = 'center';
    messageDiv.style.padding = '1rem';
    messageDiv.style.borderRadius = '5px';
    messageDiv.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 3000);
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard DOM loaded');
    // Wait a bit for auth state to settle
    setTimeout(initializeDashboard, 100);
});

// Make loadChitGroups available globally for retry button
window.loadChitGroups = loadChitGroups;
