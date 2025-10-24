// Wait for DOM and Firebase to be loaded
document.addEventListener('DOMContentLoaded', function() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
        console.error('Firebase not loaded');
        window.location.href = 'auth.html';
        return;
    }

    const auth = firebase.auth();
    const db = firebase.firestore();

    // DOM Elements
    const userNameElement = document.getElementById('userName');
    const myChitsCountElement = document.getElementById('myChitsCount');
    const totalPaidElement = document.getElementById('totalPaid');
    const duePaymentsElement = document.getElementById('duePayments');
    const auctionsWonElement = document.getElementById('auctionsWon');
    
    const myChitsList = document.getElementById('myChitsList');
    const paymentsHistory = document.getElementById('paymentsHistory');
    const myAuctionsList = document.getElementById('myAuctionsList');
    
    const joinChitBtn = document.getElementById('joinChitBtn');
    const joinNewChitBtn = document.getElementById('joinNewChitBtn');
    const verifyChitBtn = document.getElementById('verifyChitBtn');
    const joinChitConfirmBtn = document.getElementById('joinChitConfirmBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    const editProfileBtn = document.getElementById('editProfileBtn');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const submitBidBtn = document.getElementById('submitBidBtn');

    // Modal instance
    const joinChitModal = new bootstrap.Modal(document.getElementById('joinChitModal'));
    const paymentHistoryModal = new bootstrap.Modal(document.getElementById('paymentHistoryModal'));
    const chitDetailsModal = new bootstrap.Modal(document.getElementById('chitDetailsModal'));
    const auctionModal = new bootstrap.Modal(document.getElementById('auctionModal'));
    const editProfileModal = new bootstrap.Modal(document.getElementById('editProfileModal'));


    let currentUser = null;
    let userData = null;
    let currentChitToJoin = null;

    // Check authentication and role
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            await loadUserData();
            await checkMemberRole();
            await loadMemberDashboard();
            updateUI();
        } else {
            window.location.href = 'auth.html';
        }
    });

   // Enhanced loadUserData function
async function loadUserData() {
    try {
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            userData = userDoc.data();
            // Ensure user has member role
            if (userData.role !== 'member') {
                await db.collection('users').doc(currentUser.uid).update({
                    role: 'member'
                });
                userData.role = 'member';
            }
        } else {
            // Create member profile with enhanced fields
            userData = {
                name: currentUser.displayName || currentUser.email.split('@')[0],
                email: currentUser.email,
                role: 'member',
                memberSince: new Date(),
                activeChits: 0,
                totalInvestment: 0,
                returnsReceived: 0,
                creditScore: 'Good',
                phone: '',
                address: '',
                emergencyContact: '',
                pendingPayments: 0
            };
            await db.collection('users').doc(currentUser.uid).set(userData);
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

    // Check and set member role
    async function checkMemberRole() {
        try {
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            if (userDoc.exists && userDoc.data().role !== 'member') {
                // Redirect managers to manager dashboard
                window.location.href = 'dashboard-manager.html';
            }
        } catch (error) {
            console.error('Error checking role:', error);
        }
    }

    // Load member dashboard data
    async function loadMemberDashboard() {
        await loadMyChitFunds();
        await loadPaymentHistory();
        await loadMyAuctions();
        await updateMemberStats();
        updateProfileInfo();
    }

    // Load member's chit funds with enhanced error handling
    async function loadMyChitFunds() {
        try {
            // Get chit funds where member is participating
            const membershipsSnapshot = await db.collection('chitMemberships')
                .where('memberId', '==', currentUser.uid)
                .get();
            
            myChitsList.innerHTML = '';
            
            if (membershipsSnapshot.empty) {
                myChitsList.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-file-contract fa-3x text-muted mb-3"></i>
                        <h5 class="text-muted">No Chit Funds Joined</h5>
                        <p class="text-muted">Join a chit fund to start investing</p>
                        <button class="btn btn-primary mt-3" onclick="openJoinChitModal()">
                            <i class="fas fa-plus me-2"></i>Join Your First Chit Fund
                        </button>
                    </div>
                `;
                return;
            }
            
            const chitIds = membershipsSnapshot.docs.map(doc => doc.data().chitId);
            
            // Get chit details
            for (const chitId of chitIds) {
                try {
                    const chitDoc = await db.collection('chits').doc(chitId).get();
                    if (chitDoc.exists) {
                        const chit = { id: chitDoc.id, ...chitDoc.data() };
                        const membership = membershipsSnapshot.docs.find(doc => doc.data().chitId === chitId).data();
                        renderMyChitFund(chit, membership);
                    }
                } catch (chitError) {
                    console.warn(`Error loading chit ${chitId}:`, chitError);
                    // Render with basic info even if chit details fail
                    const membership = membershipsSnapshot.docs.find(doc => doc.data().chitId === chitId).data();
                    renderMyChitFundWithBasicInfo(membership);
                }
            }
            
        } catch (error) {
            console.error('Error loading my chit funds:', error);
            myChitsList.innerHTML = `
                <div class="alert alert-danger">
                    Error loading chit funds: ${error.message}
                    <br><small>Please refresh the page or try again later.</small>
                </div>
            `;
        }
    }

    // Render member's chit fund
    function renderMyChitFund(chit, membership) {
        const progress = calculateChitProgress(chit);
        const nextPayment = calculateNextPayment(chit, membership);
        
        const chitElement = document.createElement('div');
        chitElement.className = 'chit-item';
        chitElement.innerHTML = `
            <div class="chit-header">
                <div>
                    <h4 class="chit-name">${chit.name}</h4>
                    <p class="chit-code">Code: <strong>${chit.chitCode}</strong></p>
                </div>
                <div class="chit-status-indicator">
                    <span class="badge ${membership.status === 'active' ? 'bg-success' : 'bg-secondary'}">
                        ${membership.status}
                    </span>
                    ${membership.lifted ? '<span class="badge bg-warning ms-1">Lifted</span>' : ''}
                </div>
            </div>
            
            <div class="chit-details-grid">
                <div class="detail-item">
                    <label>Total Amount:</label>
                    <span>₹${chit.totalAmount?.toLocaleString()}</span>
                </div>
                <div class="detail-item">
                    <label>Monthly Payment:</label>
                    <span>₹${membership.currentMonthlyAmount?.toLocaleString() || chit.monthlyAmount?.toLocaleString()}</span>
                </div>
                <div class="detail-item">
                    <label>Progress:</label>
                    <span>${progress.monthsPassed}/${chit.duration} months</span>
                </div>
                <div class="detail-item">
                    <label>Next Payment:</label>
                    <span class="${nextPayment.overdue ? 'text-danger' : ''}">${nextPayment.date}</span>
                </div>
            </div>
            
            <div class="progress mb-2" style="height: 8px;">
                <div class="progress-bar" style="width: ${progress.percentage}%"></div>
            </div>
            
            <div class="payment-summary">
                <div class="payment-item">
                    <span>Paid:</span>
                    <strong>₹${membership.totalPaid?.toLocaleString() || 0}</strong>
                </div>
                <div class="payment-item">
                    <span>Due:</span>
                    <strong class="${nextPayment.amountDue > 0 ? 'text-danger' : ''}">
                        ₹${nextPayment.amountDue?.toLocaleString() || 0}
                    </strong>
                </div>
            </div>
            
            <div class="chit-actions">
                <button class="btn btn-sm btn-outline-primary view-payments-btn" data-chit-id="${chit.id}">
                    <i class="fas fa-list me-1"></i>Payment History
                </button>
                <button class="btn btn-sm btn-outline-info chit-details-btn" data-chit-id="${chit.id}">
                    <i class="fas fa-info-circle me-1"></i>Details
                </button>
                ${!membership.lifted ? `
                    <button class="btn btn-sm btn-outline-warning bid-btn" data-chit-id="${chit.id}">
                        <i class="fas fa-gavel me-1"></i>Bid in Auction
                    </button>
                ` : ''}
            </div>
        `;
        
        myChitsList.appendChild(chitElement);
        
        // Add event listeners
        attachMyChitEventListeners(chitElement, chit, membership);
    }

    // Enhanced payment history loading
    async function loadPaymentHistory() {
        try {
            const paymentsSnapshot = await db.collection('payments')
                .where('memberId', '==', currentUser.uid)
                .orderBy('paymentDate', 'desc')
                .get();
            
            paymentsHistory.innerHTML = '';
            
            if (paymentsSnapshot.empty) {
                paymentsHistory.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-receipt fa-3x text-muted mb-3"></i>
                        <h5 class="text-muted">No Payment History</h5>
                        <p class="text-muted">Your payment history will appear here</p>
                    </div>
                `;
                return;
            }
            
            let totalPaid = 0;
            let totalPending = 0;
            let totalOverdue = 0;
            
            paymentsSnapshot.forEach(doc => {
                const payment = { id: doc.id, ...doc.data() };
                renderPayment(payment);
                
                if (payment.status === 'paid') {
                    totalPaid += payment.amount;
                } else if (payment.status === 'pending') {
                    totalPending += payment.amount;
                } else if (payment.status === 'overdue') {
                    totalOverdue += payment.amount;
                }
            });
            
            // Update summary with null checks
            const totalPaidAmount = document.getElementById('totalPaidAmount');
            const totalPendingAmount = document.getElementById('totalPendingAmount');
            const totalOverdueAmount = document.getElementById('totalOverdueAmount');
            
            if (totalPaidAmount) totalPaidAmount.textContent = `₹${totalPaid.toLocaleString()}`;
            if (totalPendingAmount) totalPendingAmount.textContent = `₹${totalPending.toLocaleString()}`;
            if (totalOverdueAmount) totalOverdueAmount.textContent = `₹${totalOverdue.toLocaleString()}`;
            
        } catch (error) {
            console.error('Error loading payment history:', error);
            paymentsHistory.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Unable to load payment history: ${error.message}
                </div>
            `;
        }
    }

    // Render payment
    function renderPayment(payment) {
        const paymentElement = document.createElement('div');
        paymentElement.className = 'payment-item';
        paymentElement.innerHTML = `
            <div class="payment-header">
                <div class="payment-info">
                    <h6 class="payment-chit">${payment.chitName}</h6>
                    <small class="text-muted">${payment.paymentDate}</small>
                </div>
                <div class="payment-amount ${payment.status === 'paid' ? 'text-success' : payment.status === 'overdue' ? 'text-danger' : 'text-warning'}">
                    <strong>₹${payment.amount?.toLocaleString()}</strong>
                    <span class="badge ${payment.status === 'paid' ? 'bg-success' : payment.status === 'overdue' ? 'bg-danger' : 'bg-warning'}">
                        ${payment.status}
                    </span>
                </div>
            </div>
            <div class="payment-details">
                <span>Month: ${payment.month}</span>
                ${payment.paidDate ? `<span>Paid on: ${payment.paidDate}</span>` : ''}
            </div>
        `;
        
        paymentsHistory.appendChild(paymentElement);
    }

   // Enhanced loadMyAuctions function
async function loadMyAuctions() {
    try {
        const bidsSnapshot = await db.collection('auctionBids')
            .where('memberId', '==', currentUser.uid)
            .orderBy('bidDate', 'desc')
            .get();
        
        myAuctionsList.innerHTML = '';
        
        if (bidsSnapshot.empty) {
            myAuctionsList.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-gavel fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No Auction History</h5>
                    <p class="text-muted">Your auction participation will appear here</p>
                </div>
            `;
            return;
        }
        
        bidsSnapshot.forEach(doc => {
            const bid = { id: doc.id, ...doc.data() };
            renderAuctionBid(bid);
        });
        
    } catch (error) {
        console.error('Error loading auctions:', error);
        myAuctionsList.innerHTML = `
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Unable to load auction history: ${error.message}
            </div>
        `;
    }
}

    // Render auction bid
function renderAuctionBid(bid) {
    const bidElement = document.createElement('div');
    bidElement.className = 'auction-item';
    bidElement.innerHTML = `
        <div class="auction-header">
            <div>
                <h5 class="auction-chit-name">${bid.chitName}</h5>
                <p class="auction-date text-muted">
                    Bid on: ${new Date(bid.bidDate?.seconds * 1000).toLocaleDateString()}
                </p>
            </div>
            <div class="auction-status">
                <span class="badge ${bid.status === 'won' ? 'bg-success' : bid.status === 'lost' ? 'bg-danger' : 'bg-warning'}">
                    ${bid.status}
                </span>
            </div>
        </div>
        
        <div class="auction-details">
            <div class="bid-amount">
                <strong>Your Bid: ₹${bid.bidAmount?.toLocaleString()}</strong>
            </div>
            ${bid.bidReason ? `
            <div class="bid-reason">
                <small class="text-muted">Reason: ${bid.bidReason}</small>
            </div>
            ` : ''}
        </div>
        
        ${bid.status === 'won' ? `
        <div class="auction-result bg-success text-white p-2 rounded mt-2">
            <i class="fas fa-trophy me-2"></i>
            Congratulations! You won this auction.
        </div>
        ` : bid.status === 'lost' ? `
        <div class="auction-result bg-light p-2 rounded mt-2">
            <i class="fas fa-info-circle me-2"></i>
            Another member won this auction.
        </div>
        ` : ''}
    `;
    
    myAuctionsList.appendChild(bidElement);
}

    // Enhanced member stats with error handling
    async function updateMemberStats() {
        try {
            // Count member's chit funds
            let activeChitsCount = 0;
            try {
                const membershipsSnapshot = await db.collection('chitMemberships')
                    .where('memberId', '==', currentUser.uid)
                    .where('status', '==', 'active')
                    .get();
                activeChitsCount = membershipsSnapshot.size;
            } catch (error) {
                console.warn('Error counting active chits:', error);
            }
            myChitsCountElement.textContent = activeChitsCount;

            // Calculate total paid
            let totalPaid = 0;
            try {
                const paymentsSnapshot = await db.collection('payments')
                    .where('memberId', '==', currentUser.uid)
                    .where('status', '==', 'paid')
                    .get();
                
                paymentsSnapshot.forEach(doc => {
                    totalPaid += doc.data().amount;
                });
            } catch (error) {
                console.warn('Error calculating total paid:', error);
            }
            totalPaidElement.textContent = `₹${totalPaid.toLocaleString()}`;

            // Count due payments
            let duePaymentsCount = 0;
            try {
                const duePaymentsSnapshot = await db.collection('payments')
                    .where('memberId', '==', currentUser.uid)
                    .where('status', 'in', ['pending', 'overdue'])
                    .get();
                duePaymentsCount = duePaymentsSnapshot.size;
            } catch (error) {
                console.warn('Error counting due payments:', error);
            }
            duePaymentsElement.textContent = duePaymentsCount;

            // Count auctions won
            let auctionsWonCount = 0;
            try {
                const auctionsSnapshot = await db.collection('auctions')
                    .where('winnerId', '==', currentUser.uid)
                    .get();
                auctionsWonCount = auctionsSnapshot.size;
            } catch (error) {
                console.warn('Error counting auctions won:', error);
            }
            auctionsWonElement.textContent = auctionsWonCount;

        } catch (error) {
            console.error('Error updating member stats:', error);
            // Set safe defaults
            myChitsCountElement.textContent = '0';
            totalPaidElement.textContent = '₹0';
            duePaymentsElement.textContent = '0';
            auctionsWonElement.textContent = '0';
        }
    }
    
   // Enhanced updateProfileInfo function
function updateProfileInfo() {
    if (userData) {
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');
        const profilePhone = document.getElementById('profilePhone');
        const profileAddress = document.getElementById('profileAddress');
        const profileEmergencyContact = document.getElementById('profileEmergencyContact');
        const profileSince = document.getElementById('profileSince');
        const profileActiveChits = document.getElementById('profileActiveChits');
        const profileTotalInvestment = document.getElementById('profileTotalInvestment');
        const profileReturns = document.getElementById('profileReturns');
        const profilePendingPayments = document.getElementById('profilePendingPayments');
        const creditScoreElement = document.getElementById('profileCreditScore');

        if (profileName) profileName.textContent = userData.name || '-';
        if (profileEmail) profileEmail.textContent = userData.email || '-';
        if (profilePhone) profilePhone.textContent = userData.phone || 'Not provided';
        if (profileAddress) profileAddress.textContent = userData.address || 'Not provided';
        if (profileEmergencyContact) profileEmergencyContact.textContent = userData.emergencyContact || 'Not provided';
        if (profileSince) profileSince.textContent = userData.memberSince ? 
            new Date(userData.memberSince.seconds * 1000).toLocaleDateString() : '-';
        
        if (profileActiveChits) profileActiveChits.textContent = userData.activeChits || 0;
        if (profileTotalInvestment) profileTotalInvestment.textContent = `₹${(userData.totalInvestment || 0).toLocaleString()}`;
        if (profileReturns) profileReturns.textContent = `₹${(userData.returnsReceived || 0).toLocaleString()}`;
        if (profilePendingPayments) profilePendingPayments.textContent = userData.pendingPayments || 0;
        
        if (creditScoreElement) {
            creditScoreElement.textContent = userData.creditScore || 'Good';
            creditScoreElement.className = `badge bg-${getCreditScoreColor(userData.creditScore)}`;
        }
    }
}

    // Helper function for credit score colors
function getCreditScoreColor(score) {
    switch(score) {
        case 'Excellent': return 'success';
        case 'Good': return 'info';
        case 'Fair': return 'warning';
        case 'Poor': return 'danger';
        default: return 'secondary';
    }
}

    // Calculate chit progress
    function calculateChitProgress(chit) {
        const startDate = new Date(chit.startDate);
        const currentDate = new Date();
        const monthsPassed = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24 * 30));
        const percentage = Math.min((monthsPassed / chit.duration) * 100, 100);
        
        return {
            monthsPassed: Math.min(monthsPassed, chit.duration),
            totalMonths: chit.duration,
            percentage: percentage
        };
    }

    // Calculate next payment
    function calculateNextPayment(chit, membership) {
        const startDate = new Date(chit.startDate);
        const currentDate = new Date();
        const monthsPassed = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24 * 30));
        const nextPaymentMonth = monthsPassed + 1;
        
        if (nextPaymentMonth > chit.duration) {
            return { date: 'Completed', amountDue: 0, overdue: false };
        }
        
        const nextPaymentDate = new Date(startDate);
        nextPaymentDate.setMonth(startDate.getMonth() + nextPaymentMonth);
        
        const isOverdue = currentDate > nextPaymentDate;
        const amountDue = membership.lifted ? membership.currentMonthlyAmount : chit.monthlyAmount;
        
        return {
            date: nextPaymentDate.toLocaleDateString(),
            amountDue: amountDue,
            overdue: isOverdue
        };
    }

    // Event Listeners
    joinChitBtn.addEventListener('click', () => {
        joinChitModal.show();
    });

    joinNewChitBtn.addEventListener('click', () => {
        joinChitModal.show();
    });

    verifyChitBtn.addEventListener('click', async () => {
        await verifyChitCode();
    });

    joinChitConfirmBtn.addEventListener('click', async () => {
        await joinChitFund();
    });

    editProfileBtn.addEventListener('click', () => {
    openEditProfileModal();
});

saveProfileBtn.addEventListener('click', async () => {
    await saveProfileChanges();
});

submitBidBtn.addEventListener('click', async () => {
    await submitBid();
});

    logoutBtn.addEventListener('click', async () => {
        try {
            await auth.signOut();
            window.location.href = 'auth.html';
        } catch (error) {
            console.error('Logout error:', error);
        }
    });

    // Render chit fund with basic info when details fail
    function renderMyChitFundWithBasicInfo(membership) {
        const chitElement = document.createElement('div');
        chitElement.className = 'chit-item';
        chitElement.innerHTML = `
            <div class="chit-header">
                <div>
                    <h4 class="chit-name">Chit Fund (Details Unavailable)</h4>
                    <p class="chit-code">Membership ID: <strong>${membership.id}</strong></p>
                </div>
                <div class="chit-status-indicator">
                    <span class="badge ${membership.status === 'active' ? 'bg-success' : 'bg-secondary'}">
                        ${membership.status}
                    </span>
                    ${membership.lifted ? '<span class="badge bg-warning ms-1">Lifted</span>' : ''}
                </div>
            </div>
            
            <div class="alert alert-warning">
                <i class="fas fa-exclamation-triangle me-2"></i>
                Chit fund details are temporarily unavailable
            </div>
            
            <div class="payment-summary">
                <div class="payment-item">
                    <span>Total Paid:</span>
                    <strong>₹${membership.totalPaid?.toLocaleString() || 0}</strong>
            </div>
        </div>
    `;
    
    myChitsList.appendChild(chitElement);
}

// Enhanced verify chit code with approval process and null checks
async function verifyChitCode() {
    const chitCode = document.getElementById('chitCode').value.trim().toUpperCase();
    
    if (!chitCode) {
        alert('Please enter a chit code');
        return;
    }

    try {
        setLoading(verifyChitBtn, true);

        const chitsSnapshot = await db.collection('chits')
            .where('chitCode', '==', chitCode)
            .where('status', '==', 'active')
            .get();

        if (chitsSnapshot.empty) {
            alert('Invalid chit code or chit fund is not active');
            return;
        }

        const chitDoc = chitsSnapshot.docs[0];
        currentChitToJoin = { id: chitDoc.id, ...chitDoc.data() };

        // Check if member is already joined or pending
        const membershipSnapshot = await db.collection('chitMemberships')
            .where('chitId', '==', currentChitToJoin.id)
            .where('memberId', '==', currentUser.uid)
            .get();

        if (!membershipSnapshot.empty) {
            const existingMembership = membershipSnapshot.docs[0].data();
            if (existingMembership.status === 'pending') {
                alert('Your request is pending approval from the manager.');
            } else if (existingMembership.status === 'approved') {
                alert('You have already joined this chit fund.');
            } else if (existingMembership.status === 'rejected') {
                alert('Your request was rejected by the manager.');
            }
            return;
        }

        // Check if chit has available slots
        const approvedMembersSnapshot = await db.collection('chitMemberships')
            .where('chitId', '==', currentChitToJoin.id)
            .where('status', '==', 'approved')
            .get();

        if (approvedMembersSnapshot.size >= currentChitToJoin.maxMembers) {
            alert('This chit fund is already full. Please contact the manager.');
            return;
        }

        // Show chit preview with null checks
        const previewChitName = document.getElementById('previewChitName');
        const previewChitAmount = document.getElementById('previewChitAmount');
        const previewChitDuration = document.getElementById('previewChitDuration');
        const previewChitMembers = document.getElementById('previewChitMembers');
        const chitPreview = document.getElementById('chitPreview');

        if (previewChitName) previewChitName.textContent = `Name: ${currentChitToJoin.name}`;
        if (previewChitAmount) previewChitAmount.textContent = `Total Amount: ₹${currentChitToJoin.totalAmount?.toLocaleString()}`;
        if (previewChitDuration) previewChitDuration.textContent = `Duration: ${currentChitToJoin.duration} months`;
        if (previewChitMembers) previewChitMembers.textContent = `Members: ${approvedMembersSnapshot.size}/${currentChitToJoin.maxMembers} (Approved)`;
        
        if (chitPreview) chitPreview.classList.remove('d-none');
        verifyChitBtn.classList.add('d-none');
        joinChitConfirmBtn.classList.remove('d-none');

    } catch (error) {
        console.error('Error verifying chit code:', error);
        alert('Error verifying chit code: ' + error.message);
    } finally {
        setLoading(verifyChitBtn, false);
    }
}

    // Enhanced join chit fund with approval process
    async function joinChitFund() {
        if (!currentChitToJoin) {
            alert('Please verify chit code first');
            return;
        }

        try {
            setLoading(joinChitConfirmBtn, true);

            // Create membership with pending status
            const membershipData = {
                chitId: currentChitToJoin.id,
                memberId: currentUser.uid,
                chitName: currentChitToJoin.name,
                chitCode: currentChitToJoin.chitCode,
                managerId: currentChitToJoin.managerId,
                joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'pending', // Requires manager approval
                lifted: false,
                totalPaid: 0,
                currentMonthlyAmount: currentChitToJoin.monthlyAmount,
                requestedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('chitMemberships').add(membershipData);

            // Show success message with approval info
            showSuccess(`Join request sent for ${currentChitToJoin.name}! Waiting for manager approval.`);
            
            // Close modal and reset
            joinChitModal.hide();
            resetJoinForm();
            
            // Reload dashboard to show pending status
            await loadMemberDashboard();

        } catch (error) {
            console.error('Error joining chit fund:', error);
            alert('Error joining chit fund: ' + error.message);
        } finally {
            setLoading(joinChitConfirmBtn, false);
        }
    }

    // Attach event listeners to chit actions
    function attachMyChitEventListeners(element, chit, membership) {
        const viewPaymentsBtn = element.querySelector('.view-payments-btn');
        const chitDetailsBtn = element.querySelector('.chit-details-btn');
        const bidBtn = element.querySelector('.bid-btn');

        viewPaymentsBtn.addEventListener('click', () => viewChitPayments(chit.id));
        chitDetailsBtn.addEventListener('click', () => viewChitDetails(chit.id));
        if (bidBtn) {
            bidBtn.addEventListener('click', () => participateInAuction(chit.id));
        }
    }

   // Enhanced viewChitPayments function
async function viewChitPayments(chitId) {
    try {
        // Get chit details
        const chitDoc = await db.collection('chits').doc(chitId).get();
        if (!chitDoc.exists) {
            alert('Chit fund not found');
            return;
        }
        
        const chit = chitDoc.data();
        document.getElementById('paymentChitName').textContent = chit.name;
        
        // Load chit-specific payments
        const paymentsSnapshot = await db.collection('payments')
            .where('memberId', '==', currentUser.uid)
            .where('chitId', '==', chitId)
            .orderBy('paymentDate', 'desc')
            .get();
        
        const paymentHistory = document.getElementById('chitPaymentHistory');
        paymentHistory.innerHTML = '';
        
        if (paymentsSnapshot.empty) {
            paymentHistory.innerHTML = `
                <div class="text-center py-4">
                    <i class="fas fa-receipt fa-2x text-muted mb-3"></i>
                    <p class="text-muted">No payment history for this chit fund</p>
                </div>
            `;
        } else {
            paymentsSnapshot.forEach(doc => {
                const payment = { id: doc.id, ...doc.data() };
                renderChitPayment(payment, paymentHistory);
            });
        }
        
        paymentHistoryModal.show();
        
    } catch (error) {
        console.error('Error loading chit payments:', error);
        alert('Error loading payment history: ' + error.message);
    }
}

    // Render chit-specific payment
function renderChitPayment(payment, container) {
    const paymentElement = document.createElement('div');
    paymentElement.className = 'payment-item';
    paymentElement.innerHTML = `
        <div class="payment-header">
            <div class="payment-info">
                <h6 class="payment-month">${payment.month}</h6>
                <small class="text-muted">Due: ${payment.paymentDate}</small>
            </div>
            <div class="payment-amount ${payment.status === 'paid' ? 'text-success' : payment.status === 'overdue' ? 'text-danger' : 'text-warning'}">
                <strong>₹${payment.amount?.toLocaleString()}</strong>
                <span class="badge ${payment.status === 'paid' ? 'bg-success' : payment.status === 'overdue' ? 'bg-danger' : 'bg-warning'}">
                    ${payment.status}
                </span>
            </div>
        </div>
        <div class="payment-details">
            ${payment.paidDate ? `<span>Paid on: ${payment.paidDate}</span>` : ''}
            ${payment.method ? `<span>Method: ${payment.method}</span>` : ''}
            ${payment.transactionId ? `<span>Transaction ID: ${payment.transactionId}</span>` : ''}
        </div>
    `;
    
    container.appendChild(paymentElement);
}

   // Enhanced viewChitDetails function
async function viewChitDetails(chitId) {
    try {
        const chitDoc = await db.collection('chits').doc(chitId).get();
        if (!chitDoc.exists) {
            alert('Chit fund not found');
            return;
        }
        
        const chit = { id: chitDoc.id, ...chitDoc.data() };
        
        // Get membership details
        const membershipSnapshot = await db.collection('chitMemberships')
            .where('chitId', '==', chitId)
            .where('memberId', '==', currentUser.uid)
            .get();
        
        const membership = membershipSnapshot.empty ? null : membershipSnapshot.docs[0].data();
        
        // Get total members
        const membersSnapshot = await db.collection('chitMemberships')
            .where('chitId', '==', chitId)
            .where('status', '==', 'approved')
            .get();
        
        const chitInfo = document.getElementById('chitDetailedInfo');
        chitInfo.innerHTML = `
            <div class="chit-detailed-header mb-4">
                <h4 class="text-accent">${chit.name}</h4>
                <p class="text-muted mb-0">Code: ${chit.chitCode}</p>
            </div>
            
            <div class="row mb-4">
                <div class="col-md-6">
                    <div class="detail-card">
                        <h6>Basic Information</h6>
                        <div class="detail-item">
                            <label>Total Amount:</label>
                            <span>₹${chit.totalAmount?.toLocaleString()}</span>
                        </div>
                        <div class="detail-item">
                            <label>Monthly Payment:</label>
                            <span>₹${chit.monthlyAmount?.toLocaleString()}</span>
                        </div>
                        <div class="detail-item">
                            <label>Duration:</label>
                            <span>${chit.duration} months</span>
                        </div>
                        <div class="detail-item">
                            <label>Start Date:</label>
                            <span>${new Date(chit.startDate).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="detail-card">
                        <h6>Membership Information</h6>
                        <div class="detail-item">
                            <label>Your Status:</label>
                            <span class="badge ${membership?.status === 'approved' ? 'bg-success' : membership?.status === 'pending' ? 'bg-warning' : 'bg-secondary'}">
                                ${membership?.status || 'Not a member'}
                            </span>
                        </div>
                        <div class="detail-item">
                            <label>Total Members:</label>
                            <span>${membersSnapshot.size}/${chit.maxMembers}</span>
                        </div>
                        <div class="detail-item">
                            <label>Your Total Paid:</label>
                            <span>₹${membership?.totalPaid?.toLocaleString() || 0}</span>
                        </div>
                        <div class="detail-item">
                            <label>Fund Status:</label>
                            <span class="badge ${chit.status === 'active' ? 'bg-success' : 'bg-secondary'}">
                                ${chit.status}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="detail-card">
                <h6>Progress</h6>
                <div class="progress mb-3" style="height: 12px;">
                    <div class="progress-bar" style="width: ${calculateChitProgress(chit).percentage}%"></div>
                </div>
                <div class="text-center">
                    <small class="text-muted">
                        ${calculateChitProgress(chit).monthsPassed} of ${chit.duration} months completed
                    </small>
                </div>
            </div>
            
            ${membership ? `
            <div class="detail-card mt-3">
                <h6>Next Payment</h6>
                <div class="next-payment-info">
                    ${calculateNextPayment(chit, membership).overdue ? 
                        '<div class="alert alert-warning mb-0"><i class="fas fa-exclamation-triangle me-2"></i>Payment is overdue!</div>' :
                        '<p class="mb-0">Your next payment is scheduled as per the chit fund timeline.</p>'
                    }
                </div>
            </div>
            ` : ''}
        `;
        
        chitDetailsModal.show();
        
    } catch (error) {
        console.error('Error loading chit details:', error);
        alert('Error loading chit details: ' + error.message);
    }
}

   // Enhanced participateInAuction function
async function participateInAuction(chitId) {
    try {
        const chitDoc = await db.collection('chits').doc(chitId).get();
        if (!chitDoc.exists) {
            alert('Chit fund not found');
            return;
        }
        
        const chit = { id: chitDoc.id, ...chitDoc.data() };
        
        // Check if auction is active
        const currentDate = new Date();
        const auctionDate = new Date(chit.nextAuctionDate);
        
        if (currentDate < auctionDate) {
            alert(`Auction for this chit fund will start on ${auctionDate.toLocaleDateString()}`);
            return;
        }
        
        // Check if member has already bid
        const existingBidSnapshot = await db.collection('auctionBids')
            .where('chitId', '==', chitId)
            .where('memberId', '==', currentUser.uid)
            .get();
        
        if (!existingBidSnapshot.empty) {
            alert('You have already placed a bid for this auction');
            return;
        }
        
        // Set up auction modal
        document.getElementById('chitAuctionName').value = chit.name;
        document.getElementById('bidAmount').value = '';
        document.getElementById('bidReason').value = '';
        document.getElementById('bidPreview').classList.add('d-none');
        
        // Add event listener for bid amount changes
        const bidAmountInput = document.getElementById('bidAmount');
        bidAmountInput.addEventListener('input', updateBidPreview);
        
        currentAuctionChit = chit;
        auctionModal.show();
        
    } catch (error) {
        console.error('Error setting up auction:', error);
        alert('Error setting up auction: ' + error.message);
    }
}

    // Update bid preview
function updateBidPreview() {
    const bidAmount = parseFloat(document.getElementById('bidAmount').value);
    const chit = currentAuctionChit;
    
    if (!bidAmount || !chit) return;
    
    const minBid = chit.totalAmount * 0.6; // Minimum 60% of total amount
    const discount = chit.totalAmount - bidAmount;
    const monthlySavings = discount / (chit.duration - calculateChitProgress(chit).monthsPassed);
    
    const preview = document.getElementById('bidPreview');
    const previewBidAmount = document.getElementById('previewBidAmount');
    const previewDiscount = document.getElementById('previewDiscount');
    const previewMonthlySavings = document.getElementById('previewMonthlySavings');
    
    if (bidAmount < minBid) {
        preview.classList.add('d-none');
        document.getElementById('bidAmount').setCustomValidity(`Minimum bid amount is ₹${minBid.toLocaleString()}`);
        return;
    }
    
    document.getElementById('bidAmount').setCustomValidity('');
    
    previewBidAmount.textContent = `Bid Amount: ₹${bidAmount.toLocaleString()}`;
    previewDiscount.textContent = `Discount: ₹${discount.toLocaleString()}`;
    previewMonthlySavings.textContent = `Monthly Savings: ₹${monthlySavings.toFixed(2)}`;
    
    preview.classList.remove('d-none');
}

// Submit bid
async function submitBid() {
    try {
        const bidAmount = parseFloat(document.getElementById('bidAmount').value);
        const bidReason = document.getElementById('bidReason').value;
        
        if (!bidAmount || !currentAuctionChit) {
            alert('Please enter a valid bid amount');
            return;
        }
        
        const minBid = currentAuctionChit.totalAmount * 0.6;
        if (bidAmount < minBid) {
            alert(`Minimum bid amount is ₹${minBid.toLocaleString()}`);
            return;
        }
        
        setLoading(submitBidBtn, true);
        
        // Create bid record
        const bidData = {
            chitId: currentAuctionChit.id,
            chitName: currentAuctionChit.name,
            memberId: currentUser.uid,
            memberName: userData.name,
            bidAmount: bidAmount,
            bidReason: bidReason,
            bidDate: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'submitted'
        };
        
        await db.collection('auctionBids').add(bidData);
        
        showSuccess('Bid submitted successfully! The winner will be announced after the auction.');
        auctionModal.hide();
        
    } catch (error) {
        console.error('Error submitting bid:', error);
        alert('Error submitting bid: ' + error.message);
    } finally {
        setLoading(submitBidBtn, false);
    }
}

    // Update UI
    function updateUI() {
        if (userData && userNameElement) {
            userNameElement.textContent = userData.name || 'Member';
        }
    }

    // Set loading state
    function setLoading(button, isLoading) {
        if (!button) return;
        
        if (isLoading) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';
        } else {
            button.disabled = false;
            button.innerHTML = button === verifyChitBtn ? 'Verify Code' : 'Join Chit Fund';
        }
    }

    // Reset join form
    function resetJoinForm() {
        const joinChitForm = document.getElementById('joinChitForm');
        const chitPreview = document.getElementById('chitPreview');
        
        if (joinChitForm) joinChitForm.reset();
        if (chitPreview) chitPreview.classList.add('d-none');
        verifyChitBtn.classList.remove('d-none');
        joinChitConfirmBtn.classList.add('d-none');
        currentChitToJoin = null;
    }

    // Show success message
    function showSuccess(message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-success alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
        alertDiv.style.zIndex = '9999';
        alertDiv.innerHTML = `
            <i class="fas fa-check-circle me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alertDiv);
        
        setTimeout(() => {
            alertDiv.remove();
        }, 5000);
    }

    // Global function for opening join modal
    window.openJoinChitModal = function() {
        joinChitModal.show();
    };
});

// Open Edit Profile Modal
function openEditProfileModal() {
    if (userData) {
        document.getElementById('editName').value = userData.name || '';
        document.getElementById('editPhone').value = userData.phone || '';
        document.getElementById('editAddress').value = userData.address || '';
        document.getElementById('editEmergencyContact').value = userData.emergencyContact || '';
        editProfileModal.show();
    }
}

// Save Profile Changes
async function saveProfileChanges() {
    try {
        setLoading(saveProfileBtn, true);

        const updatedData = {
            name: document.getElementById('editName').value.trim(),
            phone: document.getElementById('editPhone').value.trim(),
            address: document.getElementById('editAddress').value.trim(),
            emergencyContact: document.getElementById('editEmergencyContact').value.trim(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('users').doc(currentUser.uid).update(updatedData);
        
        // Update local userData
        userData = { ...userData, ...updatedData };
        
        // Update UI
        updateProfileInfo();
        
        showSuccess('Profile updated successfully!');
        editProfileModal.hide();
        
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Error updating profile: ' + error.message);
    } finally {
        setLoading(saveProfileBtn, false);
    }
}

