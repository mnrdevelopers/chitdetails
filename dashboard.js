import { 
    db, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    orderBy,
    serverTimestamp,
    onSnapshot
} from './firebase-config.js';
import { auth } from './firebase-config.js';

// DOM Elements
const chitList = document.getElementById('chit-list');
const createChitForm = document.getElementById('create-chit-form');

// Real-time listener for chit groups
let unsubscribeChits = null;

// Load user's chit groups with real-time updates
function setupChitListener() {
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        // Query chit groups created by current user
        const q = query(
            collection(db, 'chits'),
            where('ownerId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );
        
        // Set up real-time listener
        unsubscribeChits = onSnapshot(q, (querySnapshot) => {
            updateChitList(querySnapshot);
        }, (error) => {
            console.error('Error in chit listener:', error);
            chitList.innerHTML = '<p class="error">Error loading chit groups. Please refresh the page.</p>';
        });
        
    } catch (error) {
        console.error('Error setting up chit listener:', error);
        chitList.innerHTML = '<p class="error">Error loading chit groups. Please try again.</p>';
    }
}

// Update chit list with data from query snapshot
function updateChitList(querySnapshot) {
    // Clear existing list
    chitList.innerHTML = '';
    
    if (querySnapshot.empty) {
        chitList.innerHTML = `
            <div class="text-center">
                <p>You haven't created any chit groups yet.</p>
                <p>Click "Create New Chit" to get started!</p>
            </div>
        `;
        return;
    }
    
    // Display chit groups
    querySnapshot.forEach((doc) => {
        const chit = doc.data();
        displayChitCard(doc.id, chit);
    });
}

// Display chit card in the list
function displayChitCard(chitId, chit) {
    const totalAmount = chit.monthlyAmount * chit.totalMembers;
    const monthsCompleted = calculateMonthsCompleted(chit.startDate, chit.totalMonths);
    
    const chitCard = document.createElement('div');
    chitCard.className = 'chit-card';
    chitCard.innerHTML = `
        <h3>${chit.name}</h3>
        <p>Monthly: ₹${chit.monthlyAmount.toLocaleString()}</p>
        <p>Members: ${chit.totalMembers}</p>
        <div class="chit-meta">
            <span>Months: ${monthsCompleted}/${chit.totalMonths}</span>
            <span>Total: ₹${totalAmount.toLocaleString()}</span>
        </div>
    `;
    
    // Make card clickable to navigate to chit details
    chitCard.style.cursor = 'pointer';
    chitCard.addEventListener('click', () => {
        window.location.href = `chit.html?id=${chitId}`;
    });
    
    chitList.appendChild(chitCard);
}

// Calculate months completed
function calculateMonthsCompleted(startDate, totalMonths) {
    if (!startDate) return 0;
    
    const start = new Date(startDate);
    const now = new Date();
    const monthsDiff = (now.getFullYear() - start.getFullYear()) * 12 + 
                      (now.getMonth() - start.getMonth());
    
    return Math.min(Math.max(0, monthsDiff), totalMonths);
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
        
        // Get form values
        const name = document.getElementById('chit-name').value;
        const monthlyAmount = parseInt(document.getElementById('monthly-amount').value);
        const totalMembers = parseInt(document.getElementById('total-members').value);
        const totalMonths = parseInt(document.getElementById('total-months').value);
        const startDate = document.getElementById('start-date').value;
        
        // Validate form data
        if (!name || !monthlyAmount || !totalMembers || !totalMonths || !startDate) {
            alert('Please fill in all fields.');
            return;
        }
        
        if (totalMembers < 2 || totalMembers > 50) {
            alert('Total members must be between 2 and 50.');
            return;
        }
        
        if (totalMonths < 2 || totalMonths > 60) {
            alert('Total months must be between 2 and 60.');
            return;
        }
        
        const formData = {
            name: name,
            monthlyAmount: monthlyAmount,
            totalMembers: totalMembers,
            totalMonths: totalMonths,
            startDate: startDate,
            ownerId: user.uid,
            createdAt: serverTimestamp(),
            currentMonth: 1
        };
        
        try {
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
            
            // Reset button state
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            
            // Show success message (optional)
            showTempMessage('Chit group created successfully!', 'success');
            
        } catch (error) {
            console.error('Error creating chit:', error);
            
            // Reset button state
            const submitBtn = createChitForm.querySelector('button[type="submit"]');
            submitBtn.textContent = 'Create Chit';
            submitBtn.disabled = false;
            
            alert('Error creating chit group. Please try again. Error: ' + error.message);
        }
    });
}

// Show temporary message
function showTempMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    messageDiv.style.position = 'fixed';
    messageDiv.style.top = '20px';
    messageDiv.style.left = '50%';
    messageDiv.style.transform = 'translateX(-50%)';
    messageDiv.style.zIndex = '1000';
    messageDiv.style.minWidth = '300px';
    messageDiv.style.textAlign = 'center';
    
    document.body.appendChild(messageDiv);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 3000);
}

// Clean up listener when leaving page
function cleanup() {
    if (unsubscribeChits) {
        unsubscribeChits();
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setupChitListener();
});

// Clean up when leaving the page
window.addEventListener('beforeunload', cleanup);
