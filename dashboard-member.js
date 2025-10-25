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
    const payoutsReceivedElement = document.getElementById('payoutsReceived'); // Renamed
    
    const myChitsList = document.getElementById('myChitsList');
    const paymentsHistory = document.getElementById('paymentsHistory');
    
    const joinChitBtn = document.getElementById('joinChitBtn');
    const joinNewChitBtn = document.getElementById('joinNewChitBtn');
    const verifyChitBtn = document.getElementById('verifyChitBtn');
    const joinChitConfirmBtn = document.getElementById('joinChitConfirmBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    // Modal instance
    const joinChitModal = new bootstrap.Modal(document.getElementById('joinChitModal'));

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

    // Load user data
    async function loadUserData() {
        try {
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            if (userDoc.exists) {
                userData = userDoc.data();
            } else {
                userData = {
                    name: currentUser.displayName || currentUser.email.split('@')[0],
                    email: currentUser.email,
                    role: 'member',
                    memberSince: new Date(),
                    phone: '',
                    totalPaid: 0
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
        await updateMemberStats();
    }

    // Load member's chit funds
    async function loadMyChitFunds() {
        try {
            // Get chit memberships
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
                        <button class="btn btn-primary mt-3" onclick="joinChitModal.show()">
                            <i class="fas fa-plus me-2"></i>Join Your First Chit Fund
                        </button>
                    </div>
                `;
                return;
            }
            
            for (const doc of membershipsSnapshot.docs) {
                const membership = { id: doc.id, ...doc.data() };
                try {
                    const chitDoc = await db.collection('chits').doc(membership.chitId).get();
                    if (chitDoc.exists) {
                        const chit = { id: chitDoc.id, ...chitDoc.data() };
                        renderMyChitFund(chit, membership);
                    }
                } catch (error) {
                    console.warn('Error loading chit details:', error);
                }
            }
            
        } catch (error) {
            console.error('Error loading my chit funds:', error);
            myChitsList.innerHTML = `
                <div class="alert alert-danger">
                    Error loading chit funds: ${error.message}
                </div>
            `;
        }
    }

    // Render member's chit fund
    function renderMyChitFund(chit, membership) {
        const progress = calculateChitProgress(chit);
        
        // Determine type display
        const chitType = chit.chitType || 'auction';
        const typeLabel = chitType === 'friendship' ? 'Friendship (Fixed Payout)' : 'Auction (Bidding)';

        const chitElement = document.createElement('div');
        chitElement.className = 'chit-item';
        chitElement.innerHTML = `
            <div class="chit-header">
                <div>
                    <h4 class="chit-name">${chit.name}</h4>
                    <p class="chit-amount">Total: ₹${chit.totalAmount?.toLocaleString()}</p>
                </div>
                <div class="chit-status-indicator">
                    <span class="badge bg-info me-2">
                        ${typeLabel}
                    </span>
                    <span class="badge ${membership.status === 'approved' ? 'bg-success' : 'bg-warning'}">
                        ${membership.status}
                    </span>
                </div>
            </div>
            
            <div class="chit-details-grid">
                <div class="detail-item">
                    <label>Monthly Payment:</label>
                    <span>₹${chit.monthlyAmount?.toLocaleString()}</span>
                </div>
                <div class="detail-item">
                    <label>Progress:</label>
                    <span>${progress.monthsPassed}/${chit.duration} months</span>
                </div>
                <div class="detail-item">
                    <label>Your Total Paid:</label>
                    <span>₹${membership.totalPaid?.toLocaleString() || 0}</span>
                </div>
                <div class="detail-item">
                    <label>Next Payment:</label>
                    <span>Month ${progress.monthsPassed + 1}</span>
                </div>
            </div>
            
            <div class="progress mb-2" style="height: 8px;">
                <div class="progress-bar" style="width: ${progress.percentage}%"></div>
            </div>
            
            <div class="chit-footer">
                <span class="chit-date">Started: ${chit.startDate}</span>
                <span class="chit-code">Code: ${chit.chitCode}</span>
            </div>
        `;
        
        myChitsList.appendChild(chitElement);
    }

    // Load payment history
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
            
            paymentsSnapshot.forEach(doc => {
                const payment = { id: doc.id, ...doc.data() };
                renderPayment(payment);
            });
            
        } catch (error) {
            console.error('Error loading payment history:', error);
            paymentsHistory.innerHTML = `
                <div class="alert alert-danger">
                    Error loading payment history: ${error.message}
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
                    <small class="text-muted">Month ${payment.month} • ${payment.paymentDate}</small>
                </div>
                <div class="payment-amount text-success">
                    <strong>₹${payment.amount?.toLocaleString()}</strong>
                </div>
            </div>
        `;
        
        paymentsHistory.appendChild(paymentElement);
    }

    // Update member stats
    async function updateMemberStats() {
        try {
            // Count member's chit funds
            const membershipsSnapshot = await db.collection('chitMemberships')
                .where('memberId', '==', currentUser.uid)
                .where('status', '==', 'approved')
                .get();
            myChitsCountElement.textContent = membershipsSnapshot.size;

            // Calculate total paid
            const paymentsSnapshot = await db.collection('payments')
                .where('memberId', '==', currentUser.uid)
                .get();
            
            let totalPaid = 0;
            paymentsSnapshot.forEach(doc => {
                totalPaid += doc.data().amount;
            });
            totalPaidElement.textContent = `₹${totalPaid.toLocaleString()}`;

            // Count due payments (simplified - next month payment)
            // This is a rough calculation based on active chits
            duePaymentsElement.textContent = membershipsSnapshot.size;

            // Count payouts received (from Auctions collection)
            const auctionsSnapshot = await db.collection('auctions')
                .where('memberId', '==', currentUser.uid)
                .get();
            payoutsReceivedElement.textContent = auctionsSnapshot.size; // Updated Element

        } catch (error) {
            console.error('Error updating member stats:', error);
        }
    }

    // Calculate chit progress
    function calculateChitProgress(chit) {
        if (!chit.startDate) {
            return { monthsPassed: 0, percentage: 0 };
        }

        try {
            const startDate = new Date(chit.startDate);
            const currentDate = new Date();
             // Calculate months passed accurately
            const yearDiff = currentDate.getFullYear() - startDate.getFullYear();
            const monthDiff = currentDate.getMonth() - startDate.getMonth();
            const monthsPassed = Math.max(0, yearDiff * 12 + monthDiff + 1); // +1 for the current month being active

            const percentage = Math.min((monthsPassed / chit.duration) * 100, 100);
            
            return {
                monthsPassed: Math.min(monthsPassed, chit.duration),
                percentage: Math.round(percentage)
            };
        } catch (error) {
            return { monthsPassed: 0, percentage: 0 };
        }
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

    logoutBtn.addEventListener('click', async () => {
        try {
            await auth.signOut();
            window.location.href = 'auth.html';
        } catch (error) {
            console.error('Logout error:', error);
        }
    });

    // Verify chit code
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

            // Check if member is already joined
            const membershipSnapshot = await db.collection('chitMemberships')
                .where('chitId', '==', currentChitToJoin.id)
                .where('memberId', '==', currentUser.uid)
                .get();

            if (!membershipSnapshot.empty) {
                alert('You have already joined this chit fund.');
                return;
            }

            // Show chit preview
            const chitType = currentChitToJoin.chitType || 'auction';
            const typeLabel = chitType === 'friendship' ? 'Friendship (Fixed Payout)' : 'Auction (Bidding)';
            
            document.getElementById('previewChitType').textContent = `Type: ${typeLabel}`;
            document.getElementById('previewChitName').textContent = `Name: ${currentChitToJoin.name}`;
            document.getElementById('previewChitAmount').textContent = `Total Amount: ₹${currentChitToJoin.totalAmount?.toLocaleString()}`;
            document.getElementById('previewMonthlyAmount').textContent = `Monthly: ₹${currentChitToJoin.monthlyAmount?.toLocaleString()}`;
            
            document.getElementById('chitPreview').classList.remove('d-none');
            verifyChitBtn.classList.add('d-none');
            joinChitConfirmBtn.classList.remove('d-none');

        } catch (error) {
            console.error('Error verifying chit code:', error);
            alert('Error verifying chit code: ' + error.message);
        } finally {
            setLoading(verifyChitBtn, false);
        }
    }

    // Join chit fund
    async function joinChitFund() {
        if (!currentChitToJoin) {
            alert('Please verify chit code first');
            return;
        }

        try {
            setLoading(joinChitConfirmBtn, true);

            // Fetch member details (ensuring a 'member' record exists)
            let memberDoc = await db.collection('members').doc(currentUser.uid).get();
            let memberData;
            
            if (!memberDoc.exists) {
                // Member might be a self-registered user who hasn't been managed by a manager yet.
                // Create a basic member record for consistency.
                 memberData = {
                    name: userData.name || currentUser.email.split('@')[0],
                    phone: userData.phone || 'N/A',
                    managerId: currentChitToJoin.managerId, // Link to the chit's manager
                    activeChits: 0,
                    totalPaid: 0,
                    status: 'active',
                    joinedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await db.collection('members').doc(currentUser.uid).set(memberData);
            } else {
                memberData = memberDoc.data();
            }


            // Generate a simple member code (optional, but harmless)
            const memberCode = 'MEM' + Math.random().toString(36).substr(2, 5).toUpperCase();

            const membershipData = {
                chitId: currentChitToJoin.id,
                memberId: currentUser.uid,
                chitName: currentChitToJoin.name,
                chitCode: currentChitToJoin.chitCode,
                memberCode: memberCode,
                managerId: currentChitToJoin.managerId,
                joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'approved', // Auto-approve for simplicity
                totalPaid: 0
            };

            await db.collection('chitMemberships').add(membershipData);

            // Update chit member count
            await db.collection('chits').doc(currentChitToJoin.id).update({
                currentMembers: (currentChitToJoin.currentMembers || 0) + 1
            });
            
            // Update member's active chits count
            await db.collection('members').doc(currentUser.uid).update({
                activeChits: (memberData.activeChits || 0) + 1
            });


            showSuccess(`Successfully joined ${currentChitToJoin.name}!`);
            
            // Close modal and reset
            joinChitModal.hide();
            resetJoinForm();
            
            // Reload dashboard
            await loadMemberDashboard();

        } catch (error) {
            console.error('Error joining chit fund:', error);
            alert('Error joining chit fund: ' + error.message);
        } finally {
            setLoading(joinChitConfirmBtn, false);
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
            if (button === verifyChitBtn) {
                 button.innerHTML = 'Verify Code';
            } else if (button === joinChitConfirmBtn) {
                 button.innerHTML = 'Join Chit Fund';
            }
        }
    }

    // Reset join form
    function resetJoinForm() {
        document.getElementById('joinChitForm').reset();
        document.getElementById('chitPreview').classList.add('d-none');
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
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

    // Global function for opening join modal
    window.joinChitModal = {
        show: () => joinChitModal.show()
    };
});
