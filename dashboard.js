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

// Load user's chit groups
async function loadChitGroups() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.log('No user found');
            return;
        }
        
        console.log('Loading chits for user:', user.uid);
        
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
                <div class="text-center">
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
            console.log('Displaying chit:', doc.id, chit);
            displayChitCard(doc.id, chit);
        });
        
    } catch (error) {
        console.error('Error loading chit groups:', error);
        chitList.innerHTML = '<p class="error">Error loading chit groups. Please try again.</p>';
    }
}

// Display chit card in the list
function displayChitCard(chitId, chit) {
    // Ensure we have valid data
    if (!chit || !chit.name || !chit.monthlyAmount || !chit.totalMembers || !chit.totalMonths) {
        console.error('Invalid chit data:', chit);
        return;
    }
    
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
    
    try {
        const start = new Date(startDate);
        const now = new Date();
        const monthsDiff = (now.getFullYear() - start.getFullYear()) * 12 + 
                          (now.getMonth() - start.getMonth());
        
        return Math.min(Math.max(0, monthsDiff), totalMonths);
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
            // Get and validate form values
            const name = document.getElementById('chit-name').value.trim();
            const monthlyAmount = parseInt(document.getElementById('monthly-amount').value);
            const totalMembers = parseInt(document.getElementById('total-members').value);
            const totalMonths = parseInt(document.getElementById('total-months').value);
            const startDate = document.getElementById('start-date').value;
            
            console.log('Form values:', { name, monthlyAmount, totalMembers, totalMonths, startDate });
            
            // Validation
            if (!name) {
                throw new Error('Chit name is required');
            }
            if (isNaN(monthlyAmount) || monthlyAmount < 1) {
                throw new Error('Monthly amount must be a positive number');
            }
            if (isNaN(totalMembers) || totalMembers < 2 || totalMembers > 50) {
                throw new Error('Total members must be between 2 and 50');
            }
            if (isNaN(totalMonths) || totalMonths < 2 || totalMonths > 60) {
                throw new Error('Total months must be between 2 and 60');
            }
            if (!startDate) {
                throw new Error('Start date is required');
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
            
            console.log('Creating chit with data:', formData);
            
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
            
            // Show success message
            showTempMessage('Chit group created successfully!', 'success');
            
            // Reload the chit list to show the new chit
            setTimeout(() => {
                loadChitGroups();
            }, 1000);
            
        } catch (error) {
            console.error('Error creating chit:', error);
            
            // Reset button state
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
    // Remove any existing messages first
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
    
    document.body.appendChild(messageDiv);
    
    // Remove after 3 seconds
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 3000);
}

// Setup real-time listener (optional - for automatic updates)
function setupRealTimeListener() {
    try {
        const user = auth.currentUser;
        if (!user) return;
        
        const q = query(
            collection(db, 'chits'),
            where('ownerId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );
        
        // Set up real-time listener
        return onSnapshot(q, (querySnapshot) => {
            console.log('Real-time update received');
            updateChitList(querySnapshot);
        }, (error) => {
            console.error('Error in real-time listener:', error);
        });
        
    } catch (error) {
        console.error('Error setting up real-time listener:', error);
    }
}

// Update chit list with real-time data
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
    
    console.log('Real-time: Found', querySnapshot.size, 'chits');
    
    // Display chit groups
    querySnapshot.forEach((doc) => {
        const chit = doc.data();
        displayChitCard(doc.id, chit);
    });
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Dashboard initialized');
    
    // Load chits immediately
    loadChitGroups();
    
    // Also set up real-time listener for future updates
    setupRealTimeListener();
});
