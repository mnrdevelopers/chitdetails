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
    const totalMembersElement = document.getElementById('totalMembers');
    const activeChitsElement = document.getElementById('activeChits');
    const totalCollectionElement = document.getElementById('totalCollection');
    const auctionsDoneElement = document.getElementById('auctionsDone');
    
    const chitFundsList = document.getElementById('chitFundsList');
    const membersList = document.getElementById('membersList');
    const paymentsList = document.getElementById('paymentsList');
    
    const createChitBtn = document.getElementById('createChitBtn');
    const addMemberBtn = document.getElementById('addMemberBtn');
    const recordAuctionBtn = document.getElementById('recordAuctionBtn');
    const recordPaymentBtn = document.getElementById('recordPaymentBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    // Modal instances
    const createChitModal = new bootstrap.Modal(document.getElementById('createChitModal'));
    const addMemberModal = new bootstrap.Modal(document.getElementById('addMemberModal'));
    const recordAuctionModal = new bootstrap.Modal(document.getElementById('recordAuctionModal'));
    const recordPaymentModal = new bootstrap.Modal(document.getElementById('recordPaymentModal'));

    let currentUser = null;
    let userData = null;

    // Check authentication and role
    auth.onAuthStateChanged(async (user) => {
        try {
            if (user) {
                currentUser = user;
                await loadUserData();
                await checkManagerRole();
                await loadDashboardData();
                updateUI();
                setupEventListeners();
            } else {
                window.location.href = 'auth.html';
            }
        } catch (error) {
            console.error('Error in auth state change:', error);
            window.location.href = 'auth.html';
        }
    });

    function setupEventListeners() {
        // Auto-calculate monthly amount
        document.getElementById('totalAmount')?.addEventListener('input', calculateMonthlyAmount);
        document.getElementById('duration')?.addEventListener('input', calculateMonthlyAmount);
        
        // Auction preview
        document.getElementById('auctionMonth')?.addEventListener('input', updateAuctionPreview);
        
        // Tab buttons
        document.getElementById('addChitBtn')?.addEventListener('click', () => createChitModal.show());
        document.getElementById('addNewMemberBtn')?.addEventListener('click', () => addMemberModal.show());
    }

    // Calculate monthly amount automatically
    function calculateMonthlyAmount() {
        const totalAmount = parseFloat(document.getElementById('totalAmount')?.value) || 0;
        const duration = parseInt(document.getElementById('duration')?.value) || 0;
        
        if (totalAmount > 0 && duration > 0) {
            const monthlyAmount = totalAmount / duration;
            document.getElementById('monthlyAmountDisplay').textContent = `₹${monthlyAmount.toLocaleString()}`;
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
                    role: 'manager',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await db.collection('users').doc(currentUser.uid).set(userData);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    // Check and set manager role
    async function checkManagerRole() {
        try {
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            if (userDoc.exists && userDoc.data().role !== 'manager') {
                window.location.href = 'dashboard-member.html';
            }
        } catch (error) {
            console.error('Error checking role:', error);
        }
    }

    // Load dashboard data
    async function loadDashboardData() {
        await loadChitFunds();
        await loadMembers();
        await loadPayments();
        updateStats();
    }

    // Load chit funds
    async function loadChitFunds() {
        try {
            const chitsSnapshot = await db.collection('chits')
                .where('managerId', '==', currentUser.uid)
                .orderBy('createdAt', 'desc')
                .get();
            
            chitFundsList.innerHTML = '';
            
            if (chitsSnapshot.empty) {
                chitFundsList.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-file-contract fa-3x text-muted mb-3"></i>
                        <h5 class="text-muted">No Chit Funds Created</h5>
                        <p class="text-muted">Create your first chit fund to get started</p>
                    </div>
                `;
                return;
            }
            
            chitsSnapshot.forEach(doc => {
                const chit = { id: doc.id, ...doc.data() };
                renderChitFund(chit);
            });
            
        } catch (error) {
            console.error('Error loading chit funds:', error);
            chitFundsList.innerHTML = `
                <div class="alert alert-danger">
                    Error loading chit funds: ${error.message}
                </div>
            `;
        }
    }

    // Render chit fund
    function renderChitFund(chit) {
        const progress = calculateChitProgress(chit);
        const chitElement = document.createElement('div');
        chitElement.className = 'chit-item';
        chitElement.innerHTML = `
            <div class="chit-header">
                <div>
                    <h4 class="chit-name">${chit.name}</h4>
                    <p class="chit-amount">Total: ₹${chit.totalAmount?.toLocaleString()}</p>
                </div>
                <span class="badge ${chit.status === 'active' ? 'bg-success' : 'bg-secondary'}">
                    ${chit.status}
                </span>
            </div>
            
            <div class="chit-details-grid">
                <div class="detail-item">
                    <label>Monthly Amount:</label>
                    <span>₹${chit.monthlyAmount?.toLocaleString()}</span>
                </div>
                <div class="detail-item">
                    <label>Duration:</label>
                    <span>${chit.duration} months</span>
                </div>
                <div class="detail-item">
                    <label>Members:</label>
                    <span>${chit.currentMembers || 0}</span>
                </div>
                <div class="detail-item">
                    <label>Progress:</label>
                    <span>${progress.monthsPassed}/${chit.duration} months</span>
                </div>
            </div>
            
            <div class="progress mb-2" style="height: 8px;">
                <div class="progress-bar" style="width: ${progress.percentage}%"></div>
            </div>
            
            <div class="chit-footer">
                <span class="chit-date">Started: ${chit.startDate || 'Not set'}</span>
                <button class="btn btn-sm btn-outline-primary view-members-btn" data-chit-id="${chit.id}">
                    View Members
                </button>
            </div>
        `;
        
        chitFundsList.appendChild(chitElement);
        
        // Add event listener
        const viewMembersBtn = chitElement.querySelector('.view-members-btn');
        viewMembersBtn.addEventListener('click', () => viewChitMembers(chit.id));
    }

    // Load members
    async function loadMembers() {
        try {
            const membersSnapshot = await db.collection('members')
                .where('managerId', '==', currentUser.uid)
                .orderBy('joinedAt', 'desc')
                .get();
            
            membersList.innerHTML = '';
            
            if (membersSnapshot.empty) {
                membersList.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-users fa-3x text-muted mb-3"></i>
                        <h5 class="text-muted">No Members Found</h5>
                        <p class="text-muted">Add members to your chit funds</p>
                    </div>
                `;
                return;
            }
            
            membersSnapshot.forEach(doc => {
                const member = { id: doc.id, ...doc.data() };
                renderMember(member);
            });
            
        } catch (error) {
            console.error('Error loading members:', error);
            membersList.innerHTML = `
                <div class="alert alert-danger">
                    Error loading members: ${error.message}
                </div>
            `;
        }
    }

    // Render member
    function renderMember(member) {
        const memberElement = document.createElement('div');
        memberElement.className = 'member-item';
        memberElement.innerHTML = `
            <div class="member-header">
                <div class="member-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="member-info">
                    <h5 class="member-name">${member.name}</h5>
                    <p class="member-contact">
                        <i class="fas fa-phone me-1"></i>${member.phone}
                    </p>
                    <small class="text-muted">Joined: ${member.joinedAt ? 
                        new Date(member.joinedAt.seconds * 1000).toLocaleDateString() : 'Recently'}</small>
                </div>
            </div>
            <div class="member-stats">
                <div class="stat">
                    <label>Active Chits:</label>
                    <span>${member.activeChits || 0}</span>
                </div>
                <div class="stat">
                    <label>Total Paid:</label>
                    <span>₹${(member.totalPaid || 0).toLocaleString()}</span>
                </div>
            </div>
        `;
        
        membersList.appendChild(memberElement);
    }

    // Load payments
    async function loadPayments() {
        try {
            const paymentsSnapshot = await db.collection('payments')
                .where('managerId', '==', currentUser.uid)
                .orderBy('paymentDate', 'desc')
                .limit(50)
                .get();
            
            paymentsList.innerHTML = '';
            
            if (paymentsSnapshot.empty) {
                paymentsList.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-money-bill-wave fa-3x text-muted mb-3"></i>
                        <h5 class="text-muted">No Payments Recorded</h5>
                        <p class="text-muted">Record payments from members</p>
                    </div>
                `;
                return;
            }
            
            paymentsSnapshot.forEach(doc => {
                const payment = { id: doc.id, ...doc.data() };
                renderPayment(payment);
            });
            
        } catch (error) {
            console.error('Error loading payments:', error);
            paymentsList.innerHTML = `
                <div class="alert alert-danger">
                    Error loading payments: ${error.message}
                </div>
            `;
        }
    }

    function renderPayment(payment) {
        const paymentElement = document.createElement('div');
        paymentElement.className = 'payment-item';
        paymentElement.innerHTML = `
            <div class="payment-header">
                <div>
                    <h6 class="payment-chit mb-1">${payment.chitName} - ${payment.memberName}</h6>
                    <p class="mb-0 text-muted small">Month ${payment.month} • ${payment.paymentDate}</p>
                </div>
                <div class="payment-amount">
                    <strong class="text-success">₹${payment.amount?.toLocaleString()}</strong>
                </div>
            </div>
        `;
        
        paymentsList.appendChild(paymentElement);
    }

    // Update dashboard statistics
    async function updateStats() {
        try {
            // Count members
            const membersSnapshot = await db.collection('members')
                .where('managerId', '==', currentUser.uid)
                .get();
            totalMembersElement.textContent = membersSnapshot.size;

            // Count active chits
            const chitsSnapshot = await db.collection('chits')
                .where('managerId', '==', currentUser.uid)
                .where('status', '==', 'active')
                .get();
            activeChitsElement.textContent = chitsSnapshot.size;

            // Calculate monthly collection
            let totalCollection = 0;
            chitsSnapshot.forEach(doc => {
                const chit = doc.data();
                totalCollection += chit.monthlyAmount * (chit.currentMembers || 0);
            });
            totalCollectionElement.textContent = `₹${totalCollection.toLocaleString()}`;

            // Count auctions done
            const auctionsSnapshot = await db.collection('auctions')
                .where('managerId', '==', currentUser.uid)
                .get();
            auctionsDoneElement.textContent = auctionsSnapshot.size;

        } catch (error) {
            console.error('Error updating stats:', error);
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
            const monthsPassed = Math.max(0, Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24 * 30.44)));
            const percentage = Math.min((monthsPassed / chit.duration) * 100, 100);
            
            return {
                monthsPassed: Math.min(monthsPassed, chit.duration),
                percentage: Math.round(percentage)
            };
        } catch (error) {
            return { monthsPassed: 0, percentage: 0 };
        }
    }

    // Event listeners for main buttons
    createChitBtn.addEventListener('click', () => {
        createChitModal.show();
    });

    addMemberBtn.addEventListener('click', () => {
        addMemberModal.show();
    });

    recordAuctionBtn.addEventListener('click', async () => {
        await showRecordAuctionModal();
    });

    recordPaymentBtn.addEventListener('click', async () => {
        await showRecordPaymentModal();
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            await auth.signOut();
            window.location.href = 'auth.html';
        } catch (error) {
            console.error('Logout error:', error);
        }
    });

    // Create chit fund
    async function createChitFund() {
        const name = document.getElementById('chitName').value;
        const totalAmount = parseFloat(document.getElementById('totalAmount').value);
        const duration = parseInt(document.getElementById('duration').value);

        if (!name || !totalAmount || !duration) {
            alert('Please fill all required fields');
            return;
        }

        const monthlyAmount = totalAmount / duration;

        try {
            setLoading(document.getElementById('saveChitBtn'), true);

            const chitData = {
                name: name,
                totalAmount: totalAmount,
                duration: duration,
                monthlyAmount: monthlyAmount,
                startDate: new Date().toISOString().split('T')[0],
                managerId: currentUser.uid,
                currentMembers: 0,
                status: 'active',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('chits').add(chitData);

            document.getElementById('createChitForm').reset();
            createChitModal.hide();
            
            showSuccess('Chit fund created successfully!');
            
            await loadChitFunds();
            await updateStats();

        } catch (error) {
            console.error('Error creating chit fund:', error);
            alert('Error creating chit fund: ' + error.message);
        } finally {
            setLoading(document.getElementById('saveChitBtn'), false);
        }
    }

    // Add member
    async function addMember() {
        const name = document.getElementById('memberName').value;
        const phone = document.getElementById('memberPhone').value;

        if (!name || !phone) {
            alert('Please fill all required fields');
            return;
        }

        try {
            setLoading(document.getElementById('saveMemberBtn'), true);

            const memberData = {
                name: name,
                phone: phone,
                managerId: currentUser.uid,
                activeChits: 0,
                totalPaid: 0,
                status: 'active',
                joinedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('members').add(memberData);

            document.getElementById('addMemberForm').reset();
            addMemberModal.hide();
            
            showSuccess('Member added successfully!');
            
            await loadMembers();
            await updateStats();

        } catch (error) {
            console.error('Error adding member:', error);
            alert('Error adding member: ' + error.message);
        } finally {
            setLoading(document.getElementById('saveMemberBtn'), false);
        }
    }

    // Show record auction modal
    async function showRecordAuctionModal() {
        try {
            // Load chits and members for dropdowns
            const [chitsSnapshot, membersSnapshot] = await Promise.all([
                db.collection('chits').where('managerId', '==', currentUser.uid).where('status', '==', 'active').get(),
                db.collection('members').where('managerId', '==', currentUser.uid).get()
            ]);

            const auctionChitSelect = document.getElementById('auctionChit');
            const auctionMemberSelect = document.getElementById('auctionMember');

            auctionChitSelect.innerHTML = '<option value="">Choose a chit fund...</option>';
            auctionMemberSelect.innerHTML = '<option value="">Choose a member...</option>';

            chitsSnapshot.forEach(doc => {
                const chit = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = `${chit.name} (₹${chit.totalAmount.toLocaleString()})`;
                auctionChitSelect.appendChild(option);
            });

            membersSnapshot.forEach(doc => {
                const member = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = `${member.name} (${member.phone})`;
                auctionMemberSelect.appendChild(option);
            });

            recordAuctionModal.show();
        } catch (error) {
            console.error('Error loading auction data:', error);
            alert('Error loading data: ' + error.message);
        }
    }

    // Update auction preview
    async function updateAuctionPreview() {
        const chitId = document.getElementById('auctionChit').value;
        const month = parseInt(document.getElementById('auctionMonth').value);
        
        if (!chitId || !month) return;

        try {
            const chitDoc = await db.collection('chits').doc(chitId).get();
            if (!chitDoc.exists) return;

            const chit = chitDoc.data();
            const baseMonthlyAmount = chit.monthlyAmount;
            
            // Calculate reduced monthly amount based on auction month
            // Later auctions get lower monthly payments
            const reductionPercentage = Math.min((month - 1) * 5, 40); // Max 40% reduction
            const reducedMonthlyAmount = baseMonthlyAmount * (1 - reductionPercentage / 100);
            const discount = baseMonthlyAmount - reducedMonthlyAmount;

            const preview = document.getElementById('auctionPreview');
            const previewMonthlyAmount = document.getElementById('previewMonthlyAmount');
            const previewDiscount = document.getElementById('previewDiscount');

            previewMonthlyAmount.textContent = `Monthly Payment: ₹${reducedMonthlyAmount.toFixed(0)} (was ₹${baseMonthlyAmount.toFixed(0)})`;
            previewDiscount.textContent = `Discount: ₹${discount.toFixed(0)} per month (${reductionPercentage}%)`;
            
            preview.classList.remove('d-none');
        } catch (error) {
            console.error('Error updating auction preview:', error);
        }
    }

    // Record auction
    async function recordAuction() {
        const chitId = document.getElementById('auctionChit').value;
        const memberId = document.getElementById('auctionMember').value;
        const month = parseInt(document.getElementById('auctionMonth').value);
        const amount = parseFloat(document.getElementById('auctionAmount').value);

        if (!chitId || !memberId || !month || !amount) {
            alert('Please fill all required fields');
            return;
        }

        try {
            setLoading(document.getElementById('saveAuctionBtn'), true);

            // Get chit and member details
            const [chitDoc, memberDoc] = await Promise.all([
                db.collection('chits').doc(chitId).get(),
                db.collection('members').doc(memberId).get()
            ]);

            if (!chitDoc.exists || !memberDoc.exists) {
                alert('Chit fund or member not found!');
                return;
            }

            const chit = chitDoc.data();
            const member = memberDoc.data();

            // Calculate reduced monthly amount
            const reductionPercentage = Math.min((month - 1) * 5, 40);
            const reducedMonthlyAmount = chit.monthlyAmount * (1 - reductionPercentage / 100);

            const auctionData = {
                chitId: chitId,
                chitName: chit.name,
                memberId: memberId,
                memberName: member.name,
                month: month,
                amountTaken: amount,
                monthlyAmount: reducedMonthlyAmount,
                discount: chit.monthlyAmount - reducedMonthlyAmount,
                managerId: currentUser.uid,
                auctionDate: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('auctions').add(auctionData);

            // Update member's active chits count
            await db.collection('members').doc(memberId).update({
                activeChits: (member.activeChits || 0) + 1
            });

            document.getElementById('recordAuctionForm').reset();
            recordAuctionModal.hide();
            
            showSuccess('Auction recorded successfully!');
            
            await updateStats();

        } catch (error) {
            console.error('Error recording auction:', error);
            alert('Error recording auction: ' + error.message);
        } finally {
            setLoading(document.getElementById('saveAuctionBtn'), false);
        }
    }

    // Show record payment modal
    async function showRecordPaymentModal() {
        try {
            const [chitsSnapshot, membersSnapshot] = await Promise.all([
                db.collection('chits').where('managerId', '==', currentUser.uid).where('status', '==', 'active').get(),
                db.collection('members').where('managerId', '==', currentUser.uid).get()
            ]);

            const paymentChitSelect = document.getElementById('paymentChit');
            const paymentMemberSelect = document.getElementById('paymentMember');

            paymentChitSelect.innerHTML = '<option value="">Choose a chit fund...</option>';
            paymentMemberSelect.innerHTML = '<option value="">Choose a member...</option>';

            chitsSnapshot.forEach(doc => {
                const chit = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = chit.name;
                paymentChitSelect.appendChild(option);
            });

            membersSnapshot.forEach(doc => {
                const member = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = `${member.name} (${member.phone})`;
                paymentMemberSelect.appendChild(option);
            });

            recordPaymentModal.show();
        } catch (error) {
            console.error('Error loading payment data:', error);
            alert('Error loading data: ' + error.message);
        }
    }

    // Record payment
    async function recordPayment() {
        const memberId = document.getElementById('paymentMember').value;
        const chitId = document.getElementById('paymentChit').value;
        const month = parseInt(document.getElementById('paymentMonth').value);
        const amount = parseFloat(document.getElementById('paymentAmount').value);

        if (!memberId || !chitId || !month || !amount) {
            alert('Please fill all required fields');
            return;
        }

        try {
            setLoading(document.getElementById('savePaymentBtn'), true);

            const [memberDoc, chitDoc] = await Promise.all([
                db.collection('members').doc(memberId).get(),
                db.collection('chits').doc(chitId).get()
            ]);

            if (!memberDoc.exists || !chitDoc.exists) {
                alert('Member or chit fund not found!');
                return;
            }

            const member = memberDoc.data();
            const chit = chitDoc.data();

            const paymentData = {
                memberId: memberId,
                memberName: member.name,
                chitId: chitId,
                chitName: chit.name,
                month: month,
                amount: amount,
                paymentDate: new Date().toISOString().split('T')[0],
                managerId: currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('payments').add(paymentData);

            // Update member's total paid
            await db.collection('members').doc(memberId).update({
                totalPaid: (member.totalPaid || 0) + amount
            });

            document.getElementById('recordPaymentForm').reset();
            recordPaymentModal.hide();
            
            showSuccess('Payment recorded successfully!');
            
            await loadPayments();
            await updateStats();

        } catch (error) {
            console.error('Error recording payment:', error);
            alert('Error recording payment: ' + error.message);
        } finally {
            setLoading(document.getElementById('savePaymentBtn'), false);
        }
    }

    // View chit members
    async function viewChitMembers(chitId) {
        try {
            const chitDoc = await db.collection('chits').doc(chitId).get();
            if (!chitDoc.exists) {
                alert('Chit fund not found!');
                return;
            }

            const chit = chitDoc.data();
            const membersSnapshot = await db.collection('members')
                .where('managerId', '==', currentUser.uid)
                .get();

            let membersHTML = `
                <div class="modal fade" id="chitMembersModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Members - ${chit.name}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="members-list">
            `;

            if (membersSnapshot.empty) {
                membersHTML += `<p class="text-muted">No members found</p>`;
            } else {
                membersSnapshot.forEach(doc => {
                    const member = doc.data();
                    membersHTML += `
                        <div class="member-item">
                            <div class="member-header">
                                <div class="member-avatar">
                                    <i class="fas fa-user"></i>
                                </div>
                                <div class="member-info">
                                    <h5 class="member-name">${member.name}</h5>
                                    <p class="member-contact">
                                        <i class="fas fa-phone me-1"></i>${member.phone}
                                    </p>
                                </div>
                            </div>
                        </div>
                    `;
                });
            }

            membersHTML += `
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Remove existing modal if any
            const existingModal = document.getElementById('chitMembersModal');
            if (existingModal) {
                existingModal.remove();
            }

            document.body.insertAdjacentHTML('beforeend', membersHTML);
            const membersModal = new bootstrap.Modal(document.getElementById('chitMembersModal'));
            membersModal.show();

        } catch (error) {
            console.error('Error loading chit members:', error);
            alert('Error loading members: ' + error.message);
        }
    }

    // Update UI
    function updateUI() {
        if (userData) {
            userNameElement.textContent = userData.name || 'Manager';
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
            if (button.id === 'saveChitBtn') {
                button.innerHTML = 'Create Chit Fund';
            } else if (button.id === 'saveMemberBtn') {
                button.innerHTML = 'Add Member';
            } else if (button.id === 'saveAuctionBtn') {
                button.innerHTML = 'Record Auction';
            } else if (button.id === 'savePaymentBtn') {
                button.innerHTML = 'Record Payment';
            }
        }
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

    // Attach event listeners to modal buttons
    document.getElementById('saveChitBtn')?.addEventListener('click', createChitFund);
    document.getElementById('saveMemberBtn')?.addEventListener('click', addMember);
    document.getElementById('saveAuctionBtn')?.addEventListener('click', recordAuction);
    document.getElementById('savePaymentBtn')?.addEventListener('click', recordPayment);
});
