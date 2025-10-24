import { 
    db, 
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
    serverTimestamp,
    auth 
} from './app.js';

// DOM elements
const chitList = document.getElementById('chit-list');
const createChitBtn = document.getElementById('create-chit-btn');
const createChitModal = document.getElementById('create-chit-modal');
const createChitForm = document.getElementById('create-chit-form');
const closeButtons = document.querySelectorAll('.close, .close-modal');

// Open create chit modal
createChitBtn.addEventListener('click', () => {
    createChitModal.style.display = 'block';
});

// Close modal when clicking on X or cancel button
closeButtons.forEach(button => {
    button.addEventListener('click', () => {
        createChitModal.style.display = 'none';
    });
});

// Close modal when clicking outside of it
window.addEventListener('click', (e) => {
    if (e.target === createChitModal) {
        createChitModal.style.display = 'none';
    }
});

// Handle chit creation
createChitForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const user = auth.currentUser;
    if (!user) return;
    
    const chitName = document.getElementById('chit-name').value;
    const monthlyAmount = parseInt(document.getElementById('monthly-amount').value);
    const totalMembers = parseInt(document.getElementById('total-members').value);
    const totalMonths = parseInt(document.getElementById('total-months').value);
    const startDate = document.getElementById('start-date').value;
    
    try {
        // Create chit document
        const chitRef = await addDoc(collection(db, 'chits'), {
            name: chitName,
            monthlyAmount: monthlyAmount,
            totalMembers: totalMembers,
            totalMonths: totalMonths,
            startDate: startDate,
            ownerId: user.uid,
            createdAt: serverTimestamp(),
            currentMonth: 1,
            totalCollected: 0
        });
        
        // Redirect to chit details page to add members
        window.location.href = `chit.html?chitId=${chitRef.id}`;
        
    } catch (error) {
        console.error('Error creating chit:', error);
        alert('Error creating chit fund. Please try again.');
    }
});

// Load user's chit funds
async function loadChitFunds() {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        const q = query(
            collection(db, 'chits'), 
            where('ownerId', '==', user.uid),
            orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            chitList.innerHTML = `
                <div class="empty-state">
                    <p>You haven't created any chit funds yet.</p>
                    <p>Click "Create New Chit Fund" to get started!</p>
                </div>
            `;
            return;
        }
        
        chitList.innerHTML = '';
        
        querySnapshot.forEach((doc) => {
            const chit = doc.data();
            const chitCard = createChitCard(doc.id, chit);
            chitList.appendChild(chitCard);
        });
        
    } catch (error) {
        console.error('Error loading chit funds:', error);
        chitList.innerHTML = '<p>Error loading chit funds. Please try again.</p>';
    }
}

// Create chit card element
function createChitCard(chitId, chit) {
    const card = document.createElement('div');
    card.className = 'chit-card';
    card.addEventListener('click', () => {
        window.location.href = `chit.html?chitId=${chitId}`;
    });
    
    const totalAmount = chit.monthlyAmount * chit.totalMembers;
    const monthsCompleted = chit.currentMonth - 1;
    
    card.innerHTML = `
        <h3>${chit.name}</h3>
        <div class="chit-details">
            <div class="chit-detail">
                <span>Monthly Contribution:</span> ₹${chit.monthlyAmount}
            </div>
            <div class="chit-detail">
                <span>Total Members:</span> ${chit.totalMembers}
            </div>
            <div class="chit-detail">
                <span>Total Amount:</span> ₹${totalAmount}
            </div>
            <div class="chit-detail">
                <span>Months Completed:</span> ${monthsCompleted}/${chit.totalMonths}
            </div>
        </div>
    `;
    
    return card;
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    loadChitFunds();
});
