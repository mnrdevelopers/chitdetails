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

// Load user's chit groups
async function loadChitGroups() {
    try {
        const user = auth.currentUser;
        if (!user) return;
        
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
        
        // Display chit groups
        querySnapshot.forEach((doc) => {
            const chit = doc.data();
            displayChitCard(doc.id, chit);
        });
        
    } catch (error) {
        console.error('Error loading chit groups:', error);
        chitList.innerHTML = '<p class="error">Error loading chit groups. Please try again.</p>';
    }
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
        if (!user) return;
        
        const formData = {
            name: document.getElementById('chit-name').value,
            monthlyAmount: parseInt(document.getElementById('monthly-amount').value),
            totalMembers: parseInt(document.getElementById('total-members').value),
            totalMonths: parseInt(document.getElementById('total-months').value),
            startDate: document.getElementById('start-date').value,
            ownerId: user.uid,
            createdAt: serverTimestamp(),
            currentMonth: 1
        };
        
        try {
            // Add chit to Firestore
            const docRef = await addDoc(collection(db, 'chits'), formData);
            console.log('Chit created with ID:', docRef.id);
            
            // Close modal and reset form
            document.getElementById('create-chit-modal').classList.remove('active');
            createChitForm.reset();
            
            // Reload chit groups
            loadChitGroups();
            
        } catch (error) {
            console.error('Error creating chit:', error);
            alert('Error creating chit group. Please try again.');
        }
    });
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadChitGroups();
});
