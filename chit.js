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
    serverTimestamp,
    orderBy
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
const monthlyAmount = document.getElementById('monthly-amount');
const currentMonth = document.getElementById('current-month');
const totalCollected = document.getElementById('total-collected');
const totalPending = document.getElementById('total-pending');
const membersList = document.getElementById('members-list');
const receiverSelect = document.getElementById('receiver-select');
const saveReceiverBtn = document.getElementById('save-receiver');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const addMemberBtn = document.getElementById('add-member-btn');
const addMemberForm = document.getElementById('add-member-form');

// Global variables
let currentChit = null;
let currentDisplayMonth = 1;
let members = [];

// Load chit details
async function loadChitDetails() {
    const chitId = getChitIdFromUrl();
    if (!chitId) {
        console.error('No chit ID found in URL');
        window.location.href = 'dashboard.html';
        return;
    }
    
    try {
        console.log('Loading chit details for ID:', chitId);
        
        // Get chit document
        const chitDoc = await getDoc(doc(db, 'chits', chitId));
        if (!chitDoc.exists()) {
            console.error('Chit document does not exist');
            window.location.href = 'dashboard.html';
            return;
        }
        
        currentChit = { 
            id: chitDoc.id, 
            ...chitDoc.data() 
        };
        
        console.log('Loaded chit:', currentChit);
        
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
        console.log('Loading members for chit:', currentChit.id);
        
        const q = query(
            collection(db, 'chits', currentChit.id, 'members'),
            orderBy('createdAt')
        );
        
        const querySnapshot = await getDocs(q);
        members = [];
        
        querySnapshot.forEach((doc) => {
            members.push({ 
                id: doc.id, 
                ...doc.data() 
            });
        });
        
        console.log('Loaded members:', members);
        
        // If no members exist and we have totalMembers info, create placeholder members
        if (members.length === 0 && currentChit.totalMembers) {
            console.log('Creating placeholder members');
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
    if (!currentChit || !currentChit.totalMembers) return;
    
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
        console.log('Loading monthly data for month:', currentDisplayMonth);
        
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
        
        console.log('Payments for month', month, ':', payments);
        
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
        
        console.log('Payment status updated to:', newStatus);
        
        // Reload monthly data to reflect changes
        await loadMonthlyData();
        
    } catch (error) {
        console.error('Error updating payment status:', error);
        alert('Error updating payment status. Please try again.');
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
            console.log('Loaded receiver for month', month, ':', receiver);
        } else {
            receiverSelect.value = '';
            console.log('No receiver found for month', month);
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
        if (!currentChit || !receiverSelect.value) {
            alert('Please select a member');
            return;
        }
        
        try {
            // Check if receiver already exists for this month
            const q = query(
                collection(db, 'chits', currentChit.id, 'receivers'),
                where('month', '==', currentDisplayMonth)
            );
            
            const querySnapshot = await getDocs(q);
            
            const selectedMember = members.find(m => m.id === receiverSelect.value);
            
            if (!querySnapshot.empty) {
                // Update existing receiver
                const receiverDoc = querySnapshot.docs[0];
                await updateDoc(doc(db, 'chits', currentChit.id, 'receivers', receiverDoc.id), {
                    memberId: receiverSelect.value,
                    memberName: selectedMember?.name,
                    updatedAt: serverTimestamp()
                });
                console.log('Updated receiver for month', currentDisplayMonth);
            } else {
                // Create new receiver record
                await addDoc(collection(db, 'chits', currentChit.id, 'receivers'), {
                    month: currentDisplayMonth,
                    memberId: receiverSelect.value,
                    memberName: selectedMember?.name,
                    amount: currentChit.monthlyAmount * members.length,
                    createdAt: serverTimestamp()
                });
                console.log('Created receiver for month', currentDisplayMonth);
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
        if (currentChit && currentDisplayMonth < currentChit.totalMonths) {
            currentDisplayMonth++;
            loadMonthlyData();
        }
    });
}

// Add member functionality
if (addMemberBtn) {
    addMemberBtn.addEventListener('click', () => {
        const modal = document.getElementById('add-member-modal');
        if (modal) {
            modal.classList.add('active');
        }
    });
}

if (addMemberForm) {
    addMemberForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentChit) return;
        
        const name = document.getElementById('member-name').value.trim();
        const phone = document.getElementById('member-phone').value.trim();
        
        if (!name || !phone) {
            alert('Please fill in all fields');
            return;
        }
        
        try {
            await addDoc(collection(db, 'chits', currentChit.id, 'members'), {
                name: name,
                phone: phone,
                createdAt: serverTimestamp()
            });
            
            // Close modal and reset form
            document.getElementById('add-member-modal').classList.remove('active');
            addMemberForm.reset();
            
            // Reload members
            await loadMembers();
            
            alert('Member added successfully!');
            
        } catch (error) {
            console.error('Error adding member:', error);
            alert('Error adding member. Please try again.');
        }
    });
}

// Update chit summary
function updateSummary() {
    if (!currentChit) return;
    
    console.log('Updating summary with chit data:', currentChit);
    
    const totalChitAmount = currentChit.monthlyAmount * currentChit.totalMembers;
    const completedMonths = calculateMonthsCompleted(currentChit.startDate, currentChit.totalMonths);
    
    totalAmount.textContent = `₹${totalChitAmount.toLocaleString()}`;
    monthsCompleted.textContent = `${completedMonths}/${currentChit.totalMonths}`;
    monthlyAmount.textContent = `₹${currentChit.monthlyAmount.toLocaleString()}`;
    
    // Calculate amount circulated (simplified - would need actual receiver data)
    const circulatedAmount = completedMonths * currentChit.monthlyAmount * currentChit.totalMembers;
    amountCirculated.textContent = `₹${circulatedAmount.toLocaleString()}`;
}

// Calculate months completed
function calculateMonthsCompleted(startDate, totalMonths) {
    if (!startDate) return 1;
    
    try {
        const start = new Date(startDate);
        const now = new Date();
        const monthsDiff = (now.getFullYear() - start.getFullYear()) * 12 + 
                          (now.getMonth() - start.getMonth());
        
        return Math.min(Math.max(1, monthsDiff + 1), totalMonths);
    } catch (error) {
        console.error('Error calculating months completed:', error);
        return 1;
    }
}

// Initialize chit page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('Chit page initialized');
    loadChitDetails();
});
