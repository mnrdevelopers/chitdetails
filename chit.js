import { 
    db, 
    collection, 
    addDoc, 
    getDocs, 
    getDoc, 
    updateDoc, 
    doc, 
    query, 
    where,
    serverTimestamp 
} from './firebase-config.js';

// Get chit ID from URL parameters
function getChitIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// DOM Elements
const chitTitle = document.getElementById('chit-title');
const totalAmount = document.getElementById('total-amount');
const monthsCompleted = document.getElementById('months-completed');
const amountCirculated = document.getElementById('amount-circulated');
const currentMonth = document.getElementById('current-month');
const totalCollected = document.getElementById('total-collected');
const totalPending = document.getElementById('total-pending');
const membersList = document.getElementById('members-list');
const receiverSelect = document.getElementById('receiver-select');
const saveReceiverBtn = document.getElementById('save-receiver');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');

// Global variables
let currentChit = null;
let currentDisplayMonth = 1;
let members = [];

// Load chit details
async function loadChitDetails() {
    const chitId = getChitIdFromUrl();
    if (!chitId) {
        window.location.href = 'dashboard.html';
        return;
    }
    
    try {
        // Get chit document
        const chitDoc = await getDoc(doc(db, 'chits', chitId));
        if (!chitDoc.exists()) {
            window.location.href = 'dashboard.html';
            return;
        }
        
        currentChit = { id: chitDoc.id, ...chitDoc.data() };
        
        // Update UI with chit info
        chitTitle.textContent = currentChit.name;
        document.title = `ChitFund - ${currentChit.name}`;
        
        // Load members
        await loadMembers();
        
        // Load monthly data
        await loadMonthlyData();
        
        // Update summary
        updateSummary();
        
    } catch (error) {
        console.error('Error loading chit details:', error);
        alert('Error loading chit details. Please try again.');
    }
}

// Load members for this chit
async function loadMembers() {
    if (!currentChit) return;
    
    try {
        const q = query(
            collection(db, 'chits', currentChit.id, 'members'),
            orderBy('createdAt')
        );
        
        const querySnapshot = await getDocs(q);
        members = [];
        
        querySnapshot.forEach((doc) => {
            members.push({ id: doc.id, ...doc.data() });
        });
        
        // If no members exist, create placeholder members
        if (members.length === 0) {
            await createPlaceholderMembers();
            await loadMembers(); // Reload members
        }
        
        updateReceiverSelect();
        
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

// Create placeholder members based on total members count
async function createPlaceholderMembers() {
    if (!currentChit) return;
    
    try {
        for (let i = 1; i <= currentChit.totalMembers; i++) {
            await addDoc(collection(db, 'chits', currentChit.id, 'members'), {
                name: `Member ${i}`,
                phone: `+91XXXXXXXX${i.toString().padStart(2, '0')}`,
                createdAt: serverTimestamp()
            });
        }
        console.log('Placeholder members created');
    } catch (error) {
        console.error('Error creating placeholder members:', error);
    }
}

// Load monthly collection data
async function loadMonthlyData() {
    if (!currentChit) return;
    
    try {
        // Update current month display
        currentMonth.textContent = `Month ${currentDisplayMonth}`;
        
        // Load payments for current month
        await loadPaymentsForMonth(currentDisplayMonth);
        
        // Load receiver for current month
        await loadReceiverForMonth(currentDisplayMonth);
        
    } catch (error) {
        console.error('Error loading monthly data:', error);
    }
}

// Load payments for specific month
async function loadPaymentsForMonth(month) {
    if (!currentChit) return;
    
    try {
        const q = query(
            collection(db, 'chits', currentChit.id, 'payments'),
            where('month', '==', month)
        );
        
        const querySnapshot = await getDocs(q);
        const payments = {};
        
        querySnapshot.forEach((doc) => {
            const payment = doc.data();
            payments[payment.memberId] = payment.status;
        });
        
        // Update members list with payment status
        displayMembersWithPayments(payments);
        
        // Update collection stats
        updateCollectionStats(payments);
        
    } catch (error) {
        console.error('Error loading payments:', error);
    }
}

// Display members with their payment status
function displayMembersWithPayments(payments) {
    membersList.innerHTML = '';
    
    if (members.length === 0) {
        membersList.innerHTML = '<p class="text-center">No members found.</p>';
        return;
    }
    
    members.forEach(member => {
        const paymentStatus = payments[member.id] || 'pending';
        
        const memberItem = document.createElement('div');
        memberItem.className = 'member-item';
        memberItem.innerHTML = `
            <div class="member-info">
                <div class="member-name">${member.name}</div>
                <div class="member-phone">${member.phone}</div>
            </div>
            <div class="payment-status status-${paymentStatus}" data-member-id="${member.id}">
                ${paymentStatus === 'paid' ? 'Paid' : 'Pending'}
            </div>
        `;
        
        // Add click event to toggle payment status
        const statusElement = memberItem.querySelector('.payment-status');
        statusElement.addEventListener('click', () => {
            togglePaymentStatus(member.id, paymentStatus);
        });
        
        membersList.appendChild(memberItem);
    });
}

// Toggle payment status between paid/pending
async function togglePaymentStatus(memberId, currentStatus) {
    if (!currentChit) return;
    
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    
    try {
        // Check if payment record exists
        const q = query(
            collection(db, 'chits', currentChit.id, 'payments'),
            where('month', '==', currentDisplayMonth),
            where('memberId', '==', memberId)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            // Update existing payment
            const paymentDoc = querySnapshot.docs[0];
            await updateDoc(doc(db, 'chits', currentChit.id, 'payments', paymentDoc.id), {
                status: newStatus,
                updatedAt: serverTimestamp()
            });
        } else {
            // Create new payment record
            await addDoc(collection(db, 'chits', currentChit.id, 'payments'), {
                month: currentDisplayMonth,
                memberId: memberId,
                status: newStatus,
                amount: currentChit.monthlyAmount,
                createdAt: serverTimestamp()
            });
        }
        
        // Reload monthly data to reflect changes
        await loadMonthlyData();
        
    } catch (error) {
        console.error('Error updating payment status:', error);
    }
}

// Update collection statistics
function updateCollectionStats(payments) {
    if (!currentChit) return;
    
    let paidCount = 0;
    Object.values(payments).forEach(status => {
        if (status === 'paid') paidCount++;
    });
    
    const totalCollectedAmount = paidCount * currentChit.monthlyAmount;
    const totalPendingAmount = (members.length - paidCount) * currentChit.monthlyAmount;
    
    totalCollected.textContent = `₹${totalCollectedAmount.toLocaleString()}`;
    totalPending.textContent = `₹${totalPendingAmount.toLocaleString()}`;
}

// Load receiver for specific month
async function loadReceiverForMonth(month) {
    if (!currentChit) return;
    
    try {
        const q = query(
            collection(db, 'chits', currentChit.id, 'receivers'),
            where('month', '==', month)
        );
        
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
            const receiverDoc = querySnapshot.docs[0];
            const receiver = receiverDoc.data();
            receiverSelect.value = receiver.memberId;
        } else {
            receiverSelect.value = '';
        }
        
    } catch (error) {
        console.error('Error loading receiver:', error);
    }
}

// Update receiver select options
function updateReceiverSelect() {
    receiverSelect.innerHTML = '<option value="">Select a member</option>';
    
    members.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = member.name;
        receiverSelect.appendChild(option);
    });
}

// Save receiver for current month
if (saveReceiverBtn) {
    saveReceiverBtn.addEventListener('click', async () => {
        if (!currentChit || !receiverSelect.value) return;
        
        try {
            // Check if receiver already exists for this month
            const q = query(
                collection(db, 'chits', currentChit.id, 'receivers'),
                where('month', '==', currentDisplayMonth)
            );
            
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                // Update existing receiver
                const receiverDoc = querySnapshot.docs[0];
                await updateDoc(doc(db, 'chits', currentChit.id, 'receivers', receiverDoc.id), {
                    memberId: receiverSelect.value,
                    memberName: members.find(m => m.id === receiverSelect.value)?.name,
                    updatedAt: serverTimestamp()
                });
            } else {
                // Create new receiver record
                await addDoc(collection(db, 'chits', currentChit.id, 'receivers'), {
                    month: currentDisplayMonth,
                    memberId: receiverSelect.value,
                    memberName: members.find(m => m.id === receiverSelect.value)?.name,
                    amount: currentChit.monthlyAmount * currentChit.totalMembers,
                    createdAt: serverTimestamp()
                });
            }
            
            alert('Receiver saved successfully!');
            
        } catch (error) {
            console.error('Error saving receiver:', error);
            alert('Error saving receiver. Please try again.');
        }
    });
}

// Month navigation
if (prevMonthBtn) {
    prevMonthBtn.addEventListener('click', () => {
        if (currentDisplayMonth > 1) {
            currentDisplayMonth--;
            loadMonthlyData();
        }
    });
}

if (nextMonthBtn) {
    nextMonthBtn.addEventListener('click', () => {
        if (currentDisplayMonth < currentChit.totalMonths) {
            currentDisplayMonth++;
            loadMonthlyData();
        }
    });
}

// Update chit summary
function updateSummary() {
    if (!currentChit) return;
    
    const totalChitAmount = currentChit.monthlyAmount * currentChit.totalMembers;
    const completedMonths = calculateMonthsCompleted(currentChit.startDate, currentChit.totalMonths);
    
    totalAmount.textContent = `₹${totalChitAmount.toLocaleString()}`;
    monthsCompleted.textContent = `${completedMonths}/${currentChit.totalMonths}`;
    
    // Calculate amount circulated (simplified - would need actual receiver data)
    const circulatedAmount = completedMonths * currentChit.monthlyAmount * currentChit.totalMembers;
    amountCirculated.textContent = `₹${circulatedAmount.toLocaleString()}`;
}

// Calculate months completed
function calculateMonthsCompleted(startDate, totalMonths) {
    const start = new Date(startDate);
    const now = new Date();
    const monthsDiff = (now.getFullYear() - start.getFullYear()) * 12 + 
                      (now.getMonth() - start.getMonth());
    
    return Math.min(Math.max(0, monthsDiff + 1), totalMonths);
}

// Initialize chit page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadChitDetails();
});
