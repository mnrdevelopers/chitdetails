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

// Get chit ID from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const chitId = urlParams.get('chitId');

// DOM elements
const chitNameHeader = document.getElementById('chit-name-header');
const totalAmountElement = document.getElementById('total-amount');
const monthsCompletedElement = document.getElementById('months-completed');
const amountCirculatedElement = document.getElementById('amount-circulated');
const currentMonthElement = document.getElementById('current-month');
const totalCollectedElement = document.getElementById('total-collected');
const totalPendingElement = document.getElementById('total-pending');
const nextReceiverElement = document.getElementById('next-receiver');
const membersList = document.getElementById('members-list');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const receiverSelect = document.getElementById('receiver-select');
const markReceiverBtn = document.getElementById('mark-receiver-btn');
const receiverHistory = document.getElementById('receiver-history');
const addMembersModal = document.getElementById('add-members-modal');
const membersFormContainer = document.getElementById('members-form-container');
const saveMembersBtn = document.getElementById('save-members-btn');
const closeButtons = document.querySelectorAll('.close, .close-modal');

let currentChit = null;
let currentMonth = 1;
let members = [];
let monthlyPayments = {};

// Load chit details
async function loadChitDetails() {
    if (!chitId) {
        alert('Invalid chit fund ID');
        window.location.href = 'dashboard.html';
        return;
    }
    
    try {
        const chitDoc = await getDoc(doc(db, 'chits', chitId));
        
        if (!chitDoc.exists()) {
            alert('Chit fund not found');
            window.location.href = 'dashboard.html';
            return;
        }
        
        currentChit = chitDoc.data();
        currentChit.id = chitDoc.id;
        currentMonth = currentChit.currentMonth || 1;
        
        // Update UI with chit details
        chitNameHeader.textContent = currentChit.name;
        updateSummary();
        updateCurrentMonthDisplay();
        
        // Load members and payments
        await loadMembers();
        await loadMonthlyPayments();
        await loadReceiverHistory();
        
        // Check if members need to be added
        if (members.length === 0) {
            showAddMembersModal();
        }
        
    } catch (error) {
        console.error('Error loading chit details:', error);
        alert('Error loading chit fund details');
    }
}

// Update summary section
function updateSummary() {
    const totalAmount = currentChit.monthlyAmount * currentChit.totalMembers;
    const monthsCompleted = currentMonth - 1;
    const amountCirculated = monthsCompleted * currentChit.monthlyAmount * currentChit.totalMembers;
    
    totalAmountElement.textContent = `₹${totalAmount}`;
    monthsCompletedElement.textContent = `${monthsCompleted}/${currentChit.totalMonths}`;
    amountCirculatedElement.textContent = `₹${amountCirculated}`;
}

// Update current month display
function updateCurrentMonthDisplay() {
    currentMonthElement.textContent = `Month ${currentMonth}`;
    updateCollectionStats();
}

// Load members
async function loadMembers() {
    try {
        const q = query(collection(db, 'chits', chitId, 'members'), orderBy('name'));
        const querySnapshot = await getDocs(q);
        
        members = [];
        querySnapshot.forEach((doc) => {
            members.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        updateReceiverSelect();
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

// Load monthly payments
async function loadMonthlyPayments() {
    try {
        const paymentsDoc = await getDoc(doc(db, 'chits', chitId, 'payments', `month_${currentMonth}`));
        
        if (paymentsDoc.exists()) {
            monthlyPayments = paymentsDoc.data();
        } else {
            // Initialize empty payments for this month
            monthlyPayments = {};
            members.forEach(member => {
                monthlyPayments[member.id] = {
                    paid: false,
                    amount: currentChit.monthlyAmount
                };
            });
        }
        
        renderMembersList();
    } catch (error) {
        console.error('Error loading payments:', error);
    }
}

// Render members list
function renderMembersList() {
    membersList.innerHTML = '';
    
    if (members.length === 0) {
        membersList.innerHTML = `
            <div class="empty-state">
                <p>No members added yet.</p>
                <button id="add-members-btn" class="btn-primary">Add Members</button>
            </div>
        `;
        
        document.getElementById('add-members-btn').addEventListener('click', showAddMembersModal);
        return;
    }
    
    let totalCollected = 0;
    let totalPending = 0;
    
    members.forEach(member => {
        const payment = monthlyPayments[member.id] || { paid: false, amount: currentChit.monthlyAmount };
        
        const memberItem = document.createElement('div');
        memberItem.className = `member-item ${payment.paid ? 'paid' : 'pending'}`;
        
        memberItem.innerHTML = `
            <div class="member-info">
                <div class="member-name">${member.name}</div>
                <div class="member-phone">${member.phone || 'No phone'}</div>
            </div>
            <div class="payment-status">
                <span class="status-badge ${payment.paid ? 'status-paid' : 'status-pending'}">
                    ${payment.paid ? 'Paid' : 'Pending'}
                </span>
                <button class="toggle-payment" data-member-id="${member.id}">
                    ${payment.paid ? '❌' : '✅'}
                </button>
            </div>
        `;
        
        membersList.appendChild(memberItem);
        
        if (payment.paid) {
            totalCollected += payment.amount;
        } else {
            totalPending += payment.amount;
        }
    });
    
    // Add event listeners to toggle buttons
    document.querySelectorAll('.toggle-payment').forEach(button => {
        button.addEventListener('click', (e) => {
            const memberId = e.target.getAttribute('data-member-id');
            togglePaymentStatus(memberId);
        });
    });
    
    // Update collection stats
    monthlyPayments.totalCollected = totalCollected;
    monthlyPayments.totalPending = totalPending;
    updateCollectionStats();
}

// Update collection stats
function updateCollectionStats() {
    totalCollectedElement.textContent = `₹${monthlyPayments.totalCollected || 0}`;
    totalPendingElement.textContent = `₹${monthlyPayments.totalPending || 0}`;
    
    // Determine next receiver (someone who hasn't received yet and has paid)
    const receivedMembers = Object.keys(monthlyPayments.receivers || {});
    const eligibleMembers = members.filter(member => 
        !receivedMembers.includes(member.id) && 
        (monthlyPayments[member.id]?.paid || false)
    );
    
    if (eligibleMembers.length > 0) {
        nextReceiverElement.textContent = eligibleMembers[0].name;
    } else {
        nextReceiverElement.textContent = '-';
    }
}

// Toggle payment status
async function togglePaymentStatus(memberId) {
    try {
        const paymentRef = doc(db, 'chits', chitId, 'payments', `month_${currentMonth}`);
        
        // Toggle payment status
        monthlyPayments[memberId].paid = !monthlyPayments[memberId].paid;
        
        // Update in Firestore
        await setDoc(paymentRef, monthlyPayments, { merge: true });
        
        // Re-render the list
        renderMembersList();
        
    } catch (error) {
        console.error('Error updating payment status:', error);
        alert('Error updating payment status');
    }
}

// Update receiver select dropdown
function updateReceiverSelect() {
    receiverSelect.innerHTML = '<option value="">Select Receiver</option>';
    
    // Get members who haven't received yet
    const receivedMembers = Object.keys(monthlyPayments.receivers || {});
    const eligibleMembers = members.filter(member => !receivedMembers.includes(member.id));
    
    eligibleMembers.forEach(member => {
        const option = document.createElement('option');
        option.value = member.id;
        option.textContent = member.name;
        receiverSelect.appendChild(option);
    });
}

// Mark receiver
markReceiverBtn.addEventListener('click', async () => {
    const receiverId = receiverSelect.value;
    
    if (!receiverId) {
        alert('Please select a receiver');
        return;
    }
    
    try {
        const paymentRef = doc(db, 'chits', chitId, 'payments', `month_${currentMonth}`);
        
        // Add receiver to payments
        if (!monthlyPayments.receivers) {
            monthlyPayments.receivers = {};
        }
        
        const receiver = members.find(m => m.id === receiverId);
        monthlyPayments.receivers[receiverId] = {
            name: receiver.name,
            timestamp: serverTimestamp()
        };
        
        // Update in Firestore
        await setDoc(paymentRef, monthlyPayments, { merge: true });
        
        // Move to next month if all payments are collected
        const allPaid = members.every(member => monthlyPayments[member.id]?.paid);
        if (allPaid && currentMonth < currentChit.totalMonths) {
            currentMonth++;
            currentChit.currentMonth = currentMonth;
            
            // Update chit document
            await updateDoc(doc(db, 'chits', chitId), {
                currentMonth: currentMonth
            });
            
            updateCurrentMonthDisplay();
            await loadMonthlyPayments();
        }
        
        await loadReceiverHistory();
        updateReceiverSelect();
        
        alert(`Marked ${receiver.name} as receiver for Month ${currentMonth}`);
        
    } catch (error) {
        console.error('Error marking receiver:', error);
        alert('Error marking receiver');
    }
});

// Load receiver history
async function loadReceiverHistory() {
    try {
        receiverHistory.innerHTML = '';
        
        // Get all payment documents to extract receiver history
        const paymentsQuery = query(collection(db, 'chits', chitId, 'payments'));
        const querySnapshot = await getDocs(paymentsQuery);
        
        const receivers = [];
        
        querySnapshot.forEach((doc) => {
            const monthData = doc.data();
            if (monthData.receivers) {
                Object.keys(monthData.receivers).forEach(memberId => {
                    const monthNum = parseInt(doc.id.replace('month_', ''));
                    receivers.push({
                        month: monthNum,
                        memberId: memberId,
                        name: monthData.receivers[memberId].name
                    });
                });
            }
        });
        
        // Sort by month
        receivers.sort((a, b) => a.month - b.month);
        
        if (receivers.length === 0) {
            receiverHistory.innerHTML = '<p>No receivers recorded yet.</p>';
            return;
        }
        
        receivers.forEach(receiver => {
            const receiverItem = document.createElement('div');
            receiverItem.className = 'receiver-item';
            
            receiverItem.innerHTML = `
                <div class="receiver-month">Month ${receiver.month}</div>
                <div class="receiver-name">${receiver.name}</div>
            `;
            
            receiverHistory.appendChild(receiverItem);
        });
        
    } catch (error) {
        console.error('Error loading receiver history:', error);
    }
}

// Show add members modal
function showAddMembersModal() {
    membersFormContainer.innerHTML = '';
    
    for (let i = 0; i < currentChit.totalMembers; i++) {
        const memberForm = document.createElement('div');
        memberForm.className = 'member-form';
        memberForm.innerHTML = `
            <h4>Member ${i + 1}</h4>
            <div class="form-group">
                <label for="member-name-${i}">Name</label>
                <input type="text" id="member-name-${i}" required>
            </div>
            <div class="form-group">
                <label for="member-phone-${i}">Phone Number</label>
                <input type="tel" id="member-phone-${i}">
            </div>
        `;
        membersFormContainer.appendChild(memberForm);
    }
    
    addMembersModal.style.display = 'block';
}

// Save members
saveMembersBtn.addEventListener('click', async () => {
    try {
        const membersData = [];
        
        for (let i = 0; i < currentChit.totalMembers; i++) {
            const name = document.getElementById(`member-name-${i}`).value;
            const phone = document.getElementById(`member-phone-${i}`).value;
            
            if (!name) {
                alert(`Please enter name for Member ${i + 1}`);
                return;
            }
            
            membersData.push({
                name: name,
                phone: phone,
                createdAt: serverTimestamp()
            });
        }
        
        // Save members to Firestore
        for (const memberData of membersData) {
            await addDoc(collection(db, 'chits', chitId, 'members'), memberData);
        }
        
        addMembersModal.style.display = 'none';
        await loadMembers();
        await loadMonthlyPayments();
        
    } catch (error) {
        console.error('Error saving members:', error);
        alert('Error saving members');
    }
});

// Month navigation
prevMonthBtn.addEventListener('click', () => {
    if (currentMonth > 1) {
        currentMonth--;
        updateCurrentMonthDisplay();
        loadMonthlyPayments();
    }
});

nextMonthBtn.addEventListener('click', () => {
    if (currentMonth < currentChit.totalMonths) {
        currentMonth++;
        updateCurrentMonthDisplay();
        loadMonthlyPayments();
    }
});

// Close modal when clicking on X or cancel button
closeButtons.forEach(button => {
    button.addEventListener('click', () => {
        addMembersModal.style.display = 'none';
    });
});

// Close modal when clicking outside of it
window.addEventListener('click', (e) => {
    if (e.target === addMembersModal) {
        addMembersModal.style.display = 'none';
    }
});

// Initialize chit details page
document.addEventListener('DOMContentLoaded', () => {
    loadChitDetails();
});
