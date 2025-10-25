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
    const payoutsReceivedElement = document.getElementById('auctionsWon'); // Renamed ID in HTML to auctionsWon, keeping JS reference consistent
    
    const myChitsList = document.getElementById('myChitsList');
    const paymentsHistory = document.getElementById('paymentsHistory');
    
    const joinChitBtn = document.getElementById('joinChitBtn');
    const joinNewChitBtn = document.getElementById('joinNewChitBtn');
    const verifyChitBtn = document.getElementById('verifyChitBtn');
    const joinChitConfirmBtn = document.getElementById('joinChitConfirmBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const myProfileNavBtn = document.getElementById('myProfileNavBtn'); // NAV BAR LINK
    const saveProfileBtn = document.getElementById('saveProfileBtn'); // MODAL BUTTON

    // Profile Modal Inputs
    const editProfileNameInput = document.getElementById('editProfileName');
    const editProfilePhoneInput = document.getElementById('editProfilePhone');
    const editProfileEmailInput = document.getElementById('editProfileEmail');
    const editProfileRoleInput = document.getElementById('editProfileRole');

    // Modal instances
    const joinChitModal = new bootstrap.Modal(document.getElementById('joinChitModal'));
    const editProfileModal = new bootstrap.Modal(document.getElementById('editProfileModal')); // NEW

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
            setupEventListeners(); 
        } else {
            window.location.href = 'auth.html';
        }
    });

    // Setup Event Listeners
    function setupEventListeners() {
        myProfileNavBtn?.addEventListener('click', showEditProfileModal);
        saveProfileBtn?.addEventListener('click', updateProfile);

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
    }

    // Show Edit Profile Modal
    function showEditProfileModal() {
        if (!userData) {
            alert('User data not loaded. Please try again.');
            return;
        }
        
        // Populate modal inputs
        editProfileNameInput.value = userData.name || '';
        editProfilePhoneInput.value = userData.phone || '';
        editProfileEmailInput.value = userData.email || currentUser.email || '';
        editProfileRoleInput.value = (userData.role || 'Member').charAt(0).toUpperCase() + (userData.role || 'Member').slice(1);

        editProfileModal.show();
    }
    
    // Update Profile Function
    async function updateProfile() {
        const name = editProfileNameInput.value.trim();
        const phone = editProfilePhoneInput.value.trim();
        
        if (!name) {
            alert('Full Name is required.');
            return;
        }
        
        try {
            setLoading(saveProfileBtn, true, 'Save Changes');
            
            const updateData = {
                name: name,
                phone: phone,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // 1. Update the main user document
            await db.collection('users').doc(currentUser.uid).update(updateData);
            
            // 2. Update the member's specific record (used for manager tracking if it exists)
            const memberDoc = await db.collection('members').doc(currentUser.uid).get();
            if (memberDoc.exists) {
                await db.collection('members').doc(currentUser.uid).update(updateData);
            }
            
            // 3. Reload data and UI
            await loadUserData(); // Refresh local userData object
            updateUI(); // Refresh UI elements
            
            editProfileModal.hide();
            showSuccess('Profile updated successfully!');
            
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Error updating profile: ' + error.message);
        } finally {
            setLoading(saveProfileBtn, false, 'Save Changes');
        }
    }

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
                        <button class="btn btn-primary mt-3" onclick="window.joinChitModal.show()">
                            <i class="fas fa-plus me-2"></i>Join Your First Chit Fund
                        </button>
                    </div>
                `;
                return;
            }
            
            const chitPromises = membershipsSnapshot.docs.map(async doc => {
                const membership = { id: doc.id, ...doc.data() };
                try {
                    const chitDoc = await db.collection('chits').doc(membership.chitId).get();
                    if (chitDoc.exists) {
                        return { chit: { id: chitDoc.id, ...chitDoc.data() }, membership };
                    }
                } catch (error) {
                    console.warn('Error loading chit details:', error);
                }
                return null;
            });
            
            const results = await Promise.all(chitPromises);
            
            results.filter(r => r !== null).forEach(r => {
                renderMyChitFund(r.chit, r.membership);
            });
            
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
        const chitElement = document.createElement('div');
        chitElement.className = 'chit-item';
        
        const chitType = chit.chitType || 'auction';
        const typeLabel = chitType === 'friendship' ? 'Friendship (Fixed Payout)' : 'Auction (Bidding)';
        const typeIcon = chitType === 'friendship' ? 'fas fa-handshake' : 'fas fa-gavel';


        chitElement.innerHTML = `
            <div class="chit-header">
                <div>
                    <h4 class="chit-name">${chit.name}</h4>
                    <p class="chit-amount">Total: ₹${chit.totalAmount?.toLocaleString()}</p>
                </div>
                <div class="chit-status-indicator">
                    <span class="badge bg-info me-2">
                        <i class="${typeIcon} me-1"></i>${typeLabel}
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
                totalPaid += doc.data().amount || 0;
            });
            totalPaidElement.textContent = `₹${totalPaid.toLocaleString()}`;

            // Count due payments (simplified - next month payment for active chits)
            duePaymentsElement.textContent = membershipsSnapshot.size;

            // Count payouts received (auctions won for auction chits, or fixed payouts for friendship chits)
            const auctionsSnapshot = await db.collection('auctions')
                .where('memberId', '==', currentUser.uid)
                .get();
            payoutsReceivedElement.textContent = auctionsSnapshot.size;

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

    // Verify chit code
    async function verifyChitCode() {
        const chitCode = document.getElementById('chitCode').value.trim().toUpperCase();
        const verifyBtn = document.getElementById('verifyChitBtn');
        
        if (!chitCode) {
            alert('Please enter a chit code');
            return;
        }

        try {
            setLoading(verifyBtn, true);

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
            document.getElementById('previewChitName').textContent = `Name: ${currentChitToJoin.name}`;
            document.getElementById('previewChitAmount').textContent = `Total Amount: ₹${currentChitToJoin.totalAmount?.toLocaleString()}`;
            document.getElementById('previewMonthlyAmount').textContent = `Monthly: ₹${currentChitToJoin.monthlyAmount?.toLocaleString()}`;
            document.getElementById('previewChitType').textContent = `Type: ${(currentChitToJoin.chitType || 'auction').charAt(0).toUpperCase() + (currentChitToJoin.chitType || 'auction').slice(1)}`;
            
            document.getElementById('chitPreview').classList.remove('d-none');
            verifyBtn.classList.add('d-none');
            joinChitConfirmBtn.classList.remove('d-none');

        } catch (error) {
            console.error('Error verifying chit code:', error);
            alert('Error verifying chit code: ' + error.message);
        } finally {
            setLoading(verifyBtn, false);
        }
    }

    // Join chit fund
    async function joinChitFund() {
        if (!currentChitToJoin) {
            alert('Please verify chit code first');
            return;
        }
        const joinBtn = document.getElementById('joinChitConfirmBtn');

        try {
            setLoading(joinBtn, true);

            // Fetch the user's latest data to ensure name is correct in the membership
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            const memberName = userDoc.data()?.name || currentUser.email.split('@')[0];
            
            // Check if the member has a 'members' record managed by the chit manager.
            // If they don't, create one for easier manager tracking.
            const managerId = currentChitToJoin.managerId;
            const memberRecordRef = db.collection('members').doc(currentUser.uid);
            const memberRecordDoc = await memberRecordRef.get();
            
            if (!memberRecordDoc.exists) {
                const newMemberData = {
                    name: memberName,
                    email: currentUser.email,
                    phone: userDoc.data()?.phone || 'N/A (Self Registered)',
                    managerId: managerId,
                    activeChits: 1,
                    totalPaid: 0,
                    status: 'active',
                    joinedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await memberRecordRef.set(newMemberData, { merge: true });
            } else {
                 // Update existing member record active chits count
                 const memberData = memberRecordDoc.data();
                 await memberRecordRef.update({
                    activeChits: (memberData.activeChits || 0) + 1
                 });
            }


            const membershipData = {
                chitId: currentChitToJoin.id,
                memberId: currentUser.uid,
                chitName: currentChitToJoin.name,
                chitCode: currentChitToJoin.chitCode,
                memberName: memberName,
                managerId: managerId,
                joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'approved', // Auto-approve for simplicity
                totalPaid: 0
            };

            await db.collection('chitMemberships').add(membershipData);

            // Update chit member count
            await db.collection('chits').doc(currentChitToJoin.id).update({
                currentMembers: (currentChitToJoin.currentMembers || 0) + 1
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
            setLoading(joinBtn, false);
        }
    }

    // Update UI
    function updateUI() {
        if (userData && userNameElement) {
            userNameElement.textContent = userData.name || 'Member';
        }
    }

    // Set loading state
    function setLoading(button, isLoading, originalText = 'Button') {
        if (!button) return;
        
        if (isLoading) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';
        } else {
            button.disabled = false;
            // Restore original text based on button ID, or use originalText if provided
            const restoreText = originalText === 'Button' ? ({
                'verifyChitBtn': 'Verify Code',
                'joinChitConfirmBtn': 'Join Chit Fund',
                'saveProfileBtn': 'Save Changes'
            }[button.id] || 'Button') : originalText;
            
            button.innerHTML = restoreText;
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
