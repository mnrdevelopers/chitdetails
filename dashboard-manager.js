// Wait for DOM and Firebase to be loaded
document.addEventListener('DOMContentLoaded', function() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
        console.error('Firebase not loaded');
        window.location.href = 'auth.html';
        return;
    }

      // New event listeners
    document.getElementById('profileBtn')?.addEventListener('click', showProfile);
    document.getElementById('editProfileBtn')?.addEventListener('click', showEditProfile);
    document.getElementById('updateProfileBtn')?.addEventListener('click', updateProfile);
    document.getElementById('scheduleAuctionBtn')?.addEventListener('click', showScheduleAuction);
    document.getElementById('saveAuctionBtn')?.addEventListener('click', scheduleAuction);
    document.getElementById('recordPaymentBtn')?.addEventListener('click', showRecordPayment);
    document.getElementById('savePaymentBtn')?.addEventListener('click', recordPayment);
    document.getElementById('viewReportsBtn')?.addEventListener('click', showReports);
    document.getElementById('exportReportsBtn')?.addEventListener('click', exportReports);
    document.getElementById('updateChitBtn')?.addEventListener('click', updateChitFund);
    
    // Tab buttons
    document.getElementById('addChitBtn')?.addEventListener('click', () => createChitModal.show());
    document.getElementById('addNewMemberBtn')?.addEventListener('click', () => addMemberModal.show());
});

    const auth = firebase.auth();
    const db = firebase.firestore();

    // DOM Elements
    const userNameElement = document.getElementById('userName');
    const totalMembersElement = document.getElementById('totalMembers');
    const activeChitsElement = document.getElementById('activeChits');
    const totalCollectionElement = document.getElementById('totalCollection');
    const auctionsThisMonthElement = document.getElementById('auctionsThisMonth');
    
    const chitFundsList = document.getElementById('chitFundsList');
    const membersList = document.getElementById('membersList');
    const auctionsList = document.getElementById('auctionsList');
    const paymentsList = document.getElementById('paymentsList');
    
    const createChitBtn = document.getElementById('createChitBtn');
    const addMemberBtn = document.getElementById('addMemberBtn');
    const saveChitBtn = document.getElementById('saveChitBtn');
    const saveMemberBtn = document.getElementById('saveMemberBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    // Modal instances
    const createChitModal = new bootstrap.Modal(document.getElementById('createChitModal'));
    const addMemberModal = new bootstrap.Modal(document.getElementById('addMemberModal'));
    const viewChitModal = new bootstrap.Modal(document.getElementById('viewChitModal'));
    const editChitModal = new bootstrap.Modal(document.getElementById('editChitModal'));

    const profileModal = new bootstrap.Modal(document.getElementById('profileModal'));
    const editProfileModal = new bootstrap.Modal(document.getElementById('editProfileModal'));
    const scheduleAuctionModal = new bootstrap.Modal(document.getElementById('scheduleAuctionModal'));
    const recordPaymentModal = new bootstrap.Modal(document.getElementById('recordPaymentModal'));
    const viewReportsModal = new bootstrap.Modal(document.getElementById('viewReportsModal'));

    let currentUser = null;
    let userData = null;

    // Check authentication and role with enhanced error handling
    auth.onAuthStateChanged(async (user) => {
        try {
            if (user) {
                currentUser = user;
                await loadUserData();
                await checkManagerRole();
                await loadDashboardData();
                updateUI();
            } else {
                window.location.href = 'auth.html';
            }
        } catch (error) {
            console.error('Error in auth state change:', error);
            window.location.href = 'auth.html';
        }
    });

    // Load user data with enhanced role management
    async function loadUserData() {
        try {
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            if (userDoc.exists) {
                userData = userDoc.data();
                if (userData.role !== 'manager') {
                    try {
                        await db.collection('users').doc(currentUser.uid).update({
                            role: 'manager',
                            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                        userData.role = 'manager';
                    } catch (updateError) {
                        console.warn('Could not update user role:', updateError);
                    }
                }
            } else {
                userData = {
                    name: currentUser.displayName || currentUser.email.split('@')[0],
                    email: currentUser.email,
                    role: 'manager',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                try {
                    await db.collection('users').doc(currentUser.uid).set(userData);
                } catch (setError) {
                    console.warn('Could not create user profile:', setError);
                }
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            userData = {
                name: currentUser.displayName || currentUser.email.split('@')[0],
                email: currentUser.email,
                role: 'manager'
            };
        }
    }

    // Check and set manager role
    async function checkManagerRole() {
        try {
            const userDoc = await db.collection('users').doc(currentUser.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                
                if (!userData.role) {
                    window.location.href = 'auth.html';
                    return;
                }
                
                if (userData.role !== 'manager') {
                    window.location.href = 'dashboard-member.html';
                }
            } else {
                window.location.href = 'auth.html';
            }
        } catch (error) {
            console.error('Error checking role:', error);
            window.location.href = 'auth.html';
        }
    }

    // Load dashboard data
    async function loadDashboardData() {
        await loadChitFunds();
        await loadMembers();
        await loadAuctions();
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
                    <p class="chit-code">Code: <strong>${chit.chitCode}</strong></p>
                </div>
                <div class="chit-actions">
                    <button class="btn btn-sm btn-outline-primary view-chit-btn" data-chit-id="${chit.id}">
                        <i class="fas fa-eye me-1"></i>View
                    </button>
                    <button class="btn btn-sm btn-outline-warning edit-chit-btn" data-chit-id="${chit.id}">
                        <i class="fas fa-edit me-1"></i>Edit
                    </button>
                    <button class="btn btn-sm btn-outline-danger delete-chit-btn" data-chit-id="${chit.id}">
                        <i class="fas fa-trash me-1"></i>Delete
                    </button>
                </div>
            </div>
            
            <div class="chit-details-grid">
                <div class="detail-item">
                    <label>Total Amount:</label>
                    <span>₹${chit.totalAmount?.toLocaleString()}</span>
                </div>
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
                    <span>${chit.currentMembers || 0}/${chit.maxMembers}</span>
                </div>
            </div>
            
            <div class="progress mb-2" style="height: 8px;">
                <div class="progress-bar" style="width: ${progress.percentage}%"></div>
            </div>
            <div class="chit-footer">
                <span class="chit-status badge ${chit.status === 'active' ? 'bg-success' : 'bg-secondary'}">
                    ${chit.status || 'active'}
                </span>
                <span class="chit-date">Started: ${chit.startDate}</span>
            </div>
        `;
        
        chitFundsList.appendChild(chitElement);
        attachChitEventListeners(chitElement, chit);
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
                        <h5 class="text-muted">No Members Added</h5>
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
                        <i class="fas fa-envelope me-1"></i>${member.email}
                        ${member.phone ? `<br><i class="fas fa-phone me-1"></i>${member.phone}` : ''}
                    </p>
                </div>
            </div>
            <div class="member-stats">
                <div class="stat">
                    <label>Active Chits:</label>
                    <span>${member.activeChits || 0}</span>
                </div>
                <div class="stat">
                    <label>Total Paid:</label>
                    <span>₹${member.totalPaid || 0}</span>
                </div>
            </div>
            <div class="member-actions">
                <button class="btn btn-sm btn-outline-primary" onclick="viewMember('${member.id}')">
                    <i class="fas fa-eye me-1"></i>View
                </button>
                <button class="btn btn-sm btn-outline-warning" onclick="editMember('${member.id}')">
                    <i class="fas fa-edit me-1"></i>Edit
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteMember('${member.id}')">
                    <i class="fas fa-trash me-1"></i>Delete
                </button>
            </div>
        `;
        
        membersList.appendChild(memberElement);
    }

    // Load auctions
    async function loadAuctions() {
        auctionsList.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-gavel fa-3x text-muted mb-3"></i>
                <h5 class="text-muted">Auctions Management</h5>
                <p class="text-muted">Schedule and manage chit fund auctions</p>
            </div>
        `;
    }

    // Load payments
    async function loadPayments() {
        paymentsList.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-money-bill-wave fa-3x text-muted mb-3"></i>
                <h5 class="text-muted">Payments Tracking</h5>
                <p class="text-muted">Track member payments and collections</p>
            </div>
        `;
    }

    // Update dashboard statistics
    async function updateStats() {
        try {
            let membersCount = 0;
            try {
                const membersSnapshot = await db.collection('members')
                    .where('managerId', '==', currentUser.uid)
                    .get();
                membersCount = membersSnapshot.size;
            } catch (error) {
                console.warn('Error counting members:', error);
                membersCount = 0;
            }
            totalMembersElement.textContent = membersCount;

            let activeChitsCount = 0;
            let totalCollection = 0;
            try {
                const chitsSnapshot = await db.collection('chits')
                    .where('managerId', '==', currentUser.uid)
                    .where('status', '==', 'active')
                    .get();
                
                activeChitsCount = chitsSnapshot.size;
                
                chitsSnapshot.forEach(doc => {
                    const chit = doc.data();
                    totalCollection += (chit.monthlyAmount || 0) * (chit.currentMembers || 0);
                });
            } catch (error) {
                console.warn('Error counting chits:', error);
                activeChitsCount = 0;
                totalCollection = 0;
            }
            
            activeChitsElement.textContent = activeChitsCount;
            totalCollectionElement.textContent = `₹${totalCollection.toLocaleString()}`;

            let auctionsThisMonth = 0;
            try {
                const currentMonth = new Date().getMonth();
                const currentYear = new Date().getFullYear();
                
                const auctionsSnapshot = await db.collection('auctions')
                    .where('managerId', '==', currentUser.uid)
                    .get();
                
                auctionsSnapshot.forEach(doc => {
                    const auction = doc.data();
                    if (auction.auctionDate) {
                        const auctionDate = auction.auctionDate.toDate();
                        if (auctionDate.getMonth() === currentMonth && 
                            auctionDate.getFullYear() === currentYear) {
                            auctionsThisMonth++;
                        }
                    }
                });
            } catch (error) {
                console.warn('Error counting auctions:', error);
                auctionsThisMonth = 0;
            }
            auctionsThisMonthElement.textContent = auctionsThisMonth;

        } catch (error) {
            console.error('Error updating stats:', error);
            totalMembersElement.textContent = '0';
            activeChitsElement.textContent = '0';
            totalCollectionElement.textContent = '₹0';
            auctionsThisMonthElement.textContent = '0';
        }
    }

    // Calculate chit progress
    function calculateChitProgress(chit) {
        if (!chit.startDate || !chit.duration) {
            return {
                monthsPassed: 0,
                totalMonths: chit.duration || 0,
                percentage: 0
            };
        }

        const startDate = new Date(chit.startDate);
        const currentDate = new Date();
        
        if (isNaN(startDate.getTime())) {
            return {
                monthsPassed: 0,
                totalMonths: chit.duration,
                percentage: 0
            };
        }

        const monthsPassed = Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24 * 30));
        const percentage = Math.min((monthsPassed / chit.duration) * 100, 100);
        
        return {
            monthsPassed: Math.min(monthsPassed, chit.duration),
            totalMonths: chit.duration,
            percentage: Math.round(percentage)
        };
    }

    // Enhanced event listeners with error handling
    createChitBtn.addEventListener('click', () => {
        try {
            createChitModal.show();
        } catch (error) {
            console.error('Error showing modal:', error);
        }
    });

    addMemberBtn.addEventListener('click', () => {
        try {
            addMemberModal.show();
        } catch (error) {
            console.error('Error showing modal:', error);
        }
    });

    saveChitBtn.addEventListener('click', async () => {
        try {
            await createChitFund();
        } catch (error) {
            console.error('Error in chit creation:', error);
        }
    });

    saveMemberBtn.addEventListener('click', async () => {
        try {
            await addMember();
        } catch (error) {
            console.error('Error in member addition:', error);
        }
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            await auth.signOut();
            window.location.href = 'auth.html';
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = 'auth.html';
        }
    });

    // Create chit fund
    async function createChitFund() {
        const name = document.getElementById('chitName').value;
        const chitCode = document.getElementById('chitCode').value;
        const totalAmount = parseFloat(document.getElementById('totalAmount').value);
        const duration = parseInt(document.getElementById('duration').value);
        const monthlyAmount = parseFloat(document.getElementById('monthlyAmount').value);
        const startDate = document.getElementById('startDate').value;
        const maxMembers = parseInt(document.getElementById('maxMembers').value);
        const description = document.getElementById('chitDescription').value;

        if (!name || !chitCode || !totalAmount || !duration || !monthlyAmount || !startDate || !maxMembers) {
            alert('Please fill all required fields');
            return;
        }

        try {
            setLoading(saveChitBtn, true);

            const chitData = {
                name: name,
                chitCode: chitCode.toUpperCase(),
                totalAmount: totalAmount,
                duration: duration,
                monthlyAmount: monthlyAmount,
                startDate: startDate,
                maxMembers: maxMembers,
                description: description,
                managerId: currentUser.uid,
                currentMembers: 0,
                status: 'active',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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
            setLoading(saveChitBtn, false);
        }
    }

    // Add member
    async function addMember() {
        const name = document.getElementById('memberName').value;
        const email = document.getElementById('memberEmail').value;
        const phone = document.getElementById('memberPhone').value;
        const address = document.getElementById('memberAddress').value;

        if (!name || !email || !phone) {
            alert('Please fill all required fields');
            return;
        }

        try {
            setLoading(saveMemberBtn, true);

            const memberData = {
                name: name,
                email: email,
                phone: phone,
                address: address,
                managerId: currentUser.uid,
                activeChits: 0,
                totalPaid: 0,
                status: 'active',
                joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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
            setLoading(saveMemberBtn, false);
        }
    }

    // Attach event listeners to chit actions
    function attachChitEventListeners(element, chit) {
        const viewBtn = element.querySelector('.view-chit-btn');
        const editBtn = element.querySelector('.edit-chit-btn');
        const deleteBtn = element.querySelector('.delete-chit-btn');

        viewBtn.addEventListener('click', () => viewChitDetails(chit.id));
        editBtn.addEventListener('click', () => editChit(chit.id));
        deleteBtn.addEventListener('click', () => deleteChit(chit.id));
    }

    // Enhanced view chit details function
    async function viewChitDetails(chitId) {
        try {
            const chitDoc = await db.collection('chits').doc(chitId).get();
            if (!chitDoc.exists) {
                alert('Chit fund not found!');
                return;
            }

            const chit = chitDoc.data();
            const progress = calculateChitProgress(chit);

            // Safely populate view modal elements
            const viewChitName = document.getElementById('viewChitName');
            const viewChitCode = document.getElementById('viewChitCode');
            const viewTotalAmount = document.getElementById('viewTotalAmount');
            const viewMonthlyAmount = document.getElementById('viewMonthlyAmount');
            const viewDuration = document.getElementById('viewDuration');
            const viewStartDate = document.getElementById('viewStartDate');
            const viewMaxMembers = document.getElementById('viewMaxMembers');
            const viewDescription = document.getElementById('viewDescription');
            const progressBar = document.getElementById('viewProgressBar');
            const progressText = document.getElementById('viewProgressText');

            if (viewChitName) viewChitName.textContent = chit.name || '-';
            if (viewChitCode) viewChitCode.textContent = chit.chitCode || '-';
            if (viewTotalAmount) viewTotalAmount.textContent = `₹${chit.totalAmount?.toLocaleString() || '0'}`;
            if (viewMonthlyAmount) viewMonthlyAmount.textContent = `₹${chit.monthlyAmount?.toLocaleString() || '0'}`;
            if (viewDuration) viewDuration.textContent = `${chit.duration || '0'} months`;
            if (viewStartDate) viewStartDate.textContent = chit.startDate || '-';
            if (viewMaxMembers) viewMaxMembers.textContent = `${chit.currentMembers || 0}/${chit.maxMembers || 0}`;
            if (viewDescription) viewDescription.textContent = chit.description || 'No description provided';
            
            if (progressBar) progressBar.style.width = `${progress.percentage}%`;
            if (progressText) progressText.textContent = `${progress.monthsPassed} of ${progress.totalMonths} months completed (${Math.round(progress.percentage)}%)`;

            const viewChitModalElement = document.getElementById('viewChitModal');
            if (viewChitModalElement) {
                viewChitModalElement.setAttribute('data-current-chit', chitId);
            }
            
            await loadChitMembers(chitId);
            
            const membersCount = document.getElementById('membersCount');
            const maxMembersCount = document.getElementById('maxMembersCount');
            if (membersCount) membersCount.textContent = chit.currentMembers || 0;
            if (maxMembersCount) maxMembersCount.textContent = chit.maxMembers || 0;

            const refreshMembersBtn = document.getElementById('refreshMembersBtn');
            if (refreshMembersBtn) {
                refreshMembersBtn.onclick = () => loadChitMembers(chitId);
            }
            
            const viewChitEditBtn = document.getElementById('viewChitEditBtn');
            if (viewChitEditBtn) {
                viewChitEditBtn.onclick = () => {
                    viewChitModal.hide();
                    setTimeout(() => editChit(chitId), 300);
                };
            }

            viewChitModal.show();
        } catch (error) {
            console.error('Error loading chit details:', error);
            alert('Error loading chit details: ' + error.message);
        }
    }
    
    // Edit chit
    async function editChit(chitId) {
        try {
            const chitDoc = await db.collection('chits').doc(chitId).get();
            if (!chitDoc.exists) {
                alert('Chit fund not found!');
                return;
            }

            const chit = chitDoc.data();

            document.getElementById('editChitId').value = chitId;
            document.getElementById('editChitName').value = chit.name || '';
            document.getElementById('editChitCode').value = chit.chitCode || '';
            document.getElementById('editTotalAmount').value = chit.totalAmount || '';
            document.getElementById('editDuration').value = chit.duration || '';
            document.getElementById('editMonthlyAmount').value = chit.monthlyAmount || '';
            document.getElementById('editStartDate').value = chit.startDate || '';
            document.getElementById('editMaxMembers').value = chit.maxMembers || '';
            document.getElementById('editDescription').value = chit.description || '';
            document.getElementById('editStatus').value = chit.status || 'active';

            editChitModal.show();
        } catch (error) {
            console.error('Error loading chit for editing:', error);
            alert('Error loading chit for editing: ' + error.message);
        }
    }
    
    // Delete chit
    async function deleteChit(chitId) {
        if (confirm('Are you sure you want to delete this chit fund? This action cannot be undone.')) {
            try {
                await db.collection('chits').doc(chitId).delete();
                showSuccess('Chit fund deleted successfully!');
                await loadChitFunds();
                await updateStats();
            } catch (error) {
                console.error('Error deleting chit:', error);
                alert('Error deleting chit fund: ' + error.message);
            }
        }
    }

    // Update UI
   function updateUI() {
    const userNameElement = document.getElementById('userName');
    if (userNameElement && userData.name) {
        userNameElement.textContent = userData.name;
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
            if (button === saveChitBtn) {
                button.innerHTML = 'Create Chit Fund';
            } else if (button === saveMemberBtn) {
                button.innerHTML = 'Add Member';
            } else if (button.id === 'updateChitBtn') {
                button.innerHTML = 'Update Chit Fund';
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
            alertDiv.remove();
        }, 5000);
    }

    // Load members for a specific chit
    async function loadChitMembers(chitId) {
        try {
            const membershipsSnapshot = await db.collection('chitMemberships')
                .where('chitId', '==', chitId)
                .get();
            
            const membersList = document.getElementById('membersList');
            if (!membersList) return;
            
            membersList.innerHTML = '';
            
            if (membershipsSnapshot.empty) {
                membersList.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-users fa-3x text-muted mb-3"></i>
                        <h5 class="text-muted">No Members Yet</h5>
                        <p class="text-muted">Members will appear here after they join and get approved</p>
                    </div>
                `;
                return;
            }
            
            for (const doc of membershipsSnapshot.docs) {
                const membership = { id: doc.id, ...doc.data() };
                const userDoc = await db.collection('users').doc(membership.memberId).get();
                
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    renderChitMember(userData, membership);
                }
            }
            
        } catch (error) {
            console.error('Error loading chit members:', error);
        }
    }

    // Render member in chit members list
    function renderChitMember(user, membership) {
        const membersList = document.getElementById('membersList');
        if (!membersList) return;
        
        const memberElement = document.createElement('div');
        memberElement.className = 'member-item';
        memberElement.innerHTML = `
            <div class="member-header">
                <div class="member-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="member-info">
                    <h5 class="member-name">${user.name}</h5>
                    <p class="member-contact">
                        <i class="fas fa-envelope me-1"></i>${user.email}
                        ${user.phone ? `<br><i class="fas fa-phone me-1"></i>${user.phone}` : ''}
                    </p>
                </div>
                <div class="member-status">
                    <span class="badge ${membership.status === 'approved' ? 'bg-success' : membership.status === 'pending' ? 'bg-warning' : 'bg-secondary'}">
                        ${membership.status}
                    </span>
                </div>
            </div>
            <div class="member-stats">
                <div class="stat">
                    <label>Joined:</label>
                    <span>${membership.joinedAt ? new Date(membership.joinedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</span>
                </div>
                <div class="stat">
                    <label>Total Paid:</label>
                    <span>₹${membership.totalPaid || 0}</span>
                </div>
            </div>
            <div class="member-actions">
                ${membership.status === 'pending' ? `
                    <button class="btn btn-sm btn-success approve-member-btn" data-membership-id="${membership.id}">
                        <i class="fas fa-check me-1"></i>Approve
                    </button>
                    <button class="btn btn-sm btn-danger reject-member-btn" data-membership-id="${membership.id}">
                        <i class="fas fa-times me-1"></i>Reject
                    </button>
                ` : ''}
                ${membership.status === 'approved' ? `
                    <button class="btn btn-sm btn-warning suspend-member-btn" data-membership-id="${membership.id}">
                        <i class="fas fa-pause me-1"></i>Suspend
                    </button>
                ` : ''}
                <button class="btn btn-sm btn-info view-payments-btn" data-member-id="${user.id}" data-chit-id="${membership.chitId}">
                    <i class="fas fa-money-bill me-1"></i>Payments
                </button>
            </div>
        `;
        
        membersList.appendChild(memberElement);
        attachMemberActionListeners(memberElement, membership);
    }

    // Member approval functions
    function attachMemberActionListeners(element, membership) {
        const approveBtn = element.querySelector('.approve-member-btn');
        const rejectBtn = element.querySelector('.reject-member-btn');
        const suspendBtn = element.querySelector('.suspend-member-btn');
        const viewPaymentsBtn = element.querySelector('.view-payments-btn');

        if (approveBtn) {
            approveBtn.addEventListener('click', () => approveMember(membership.id));
        }
        if (rejectBtn) {
            rejectBtn.addEventListener('click', () => rejectMember(membership.id));
        }
        if (suspendBtn) {
            suspendBtn.addEventListener('click', () => suspendMember(membership.id));
        }
        if (viewPaymentsBtn) {
            viewPaymentsBtn.addEventListener('click', () => viewMemberPayments(membership.memberId, membership.chitId));
        }
    }

    // Approve member
    async function approveMember(membershipId) {
        if (!confirm('Approve this member to join the chit fund?')) return;

        try {
            await db.collection('chitMemberships').doc(membershipId).update({
                status: 'approved',
                approvedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            showSuccess('Member approved successfully!');
            
            const currentChitId = document.getElementById('viewChitModal')?.getAttribute('data-current-chit');
            if (currentChitId) {
                await loadChitMembers(currentChitId);
            }

        } catch (error) {
            console.error('Error approving member:', error);
            alert('Error approving member: ' + error.message);
        }
    }

    // Reject member
    async function rejectMember(membershipId) {
        if (!confirm('Reject this member from joining the chit fund?')) return;

        try {
            await db.collection('chitMemberships').doc(membershipId).update({
                status: 'rejected',
                rejectedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            showSuccess('Member rejected successfully!');
            
            const currentChitId = document.getElementById('viewChitModal')?.getAttribute('data-current-chit');
            if (currentChitId) {
                await loadChitMembers(currentChitId);
            }

        } catch (error) {
            console.error('Error rejecting member:', error);
            alert('Error rejecting member: ' + error.message);
        }
    }

    // Suspend member
    async function suspendMember(membershipId) {
        if (!confirm('Suspend this member from the chit fund?')) return;

        try {
            await db.collection('chitMemberships').doc(membershipId).update({
                status: 'suspended',
                suspendedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            showSuccess('Member suspended successfully!');
            
            const currentChitId = document.getElementById('viewChitModal')?.getAttribute('data-current-chit');
            if (currentChitId) {
                await loadChitMembers(currentChitId);
            }

        } catch (error) {
            console.error('Error suspending member:', error);
            alert('Error suspending member: ' + error.message);
        }
    }

    // View member payments
    async function viewMemberPayments(memberId, chitId) {
        alert(`View payments for member: ${memberId} in chit: ${chitId}`);
    }

    // Global functions for member actions
    window.viewMember = function(memberId) {
        alert('View member: ' + memberId);
    };

    window.editMember = function(memberId) {
        alert('Edit member: ' + memberId);
    };

    window.deleteMember = async function(memberId) {
        if (confirm('Are you sure you want to delete this member?')) {
            try {
                await db.collection('members').doc(memberId).delete();
                showSuccess('Member deleted successfully!');
                await loadMembers();
                await updateStats();
            } catch (error) {
                console.error('Error deleting member:', error);
                alert('Error deleting member: ' + error.message);
            }
        }
    };
});

// Enhanced updateChitFund function
async function updateChitFund() {
    const chitId = document.getElementById('editChitId').value;
    const name = document.getElementById('editChitName').value;
    const chitCode = document.getElementById('editChitCode').value;
    const totalAmount = parseFloat(document.getElementById('editChitAmount').value);
    const duration = parseInt(document.getElementById('editChitDuration').value);
    const monthlyAmount = parseFloat(document.getElementById('editMonthlyAmount').value);
    const membersLimit = parseInt(document.getElementById('editMembersLimit').value);
    const startDate = document.getElementById('editStartDate').value;
    const description = document.getElementById('editChitDescription').value;

    if (!name || !chitCode || !totalAmount || !duration || !monthlyAmount || !membersLimit) {
        alert('Please fill all required fields');
        return;
    }

    try {
        setLoading(document.getElementById('updateChitBtn'), true);

        const updateData = {
            name: name,
            chitCode: chitCode,
            totalAmount: totalAmount,
            duration: duration,
            monthlyAmount: monthlyAmount,
            membersLimit: membersLimit,
            description: description,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (startDate) {
            updateData.startDate = new Date(startDate);
        }

        await db.collection('chits').doc(chitId).update(updateData);

        editChitModal.hide();
        showSuccess('Chit fund updated successfully!');
        
        await loadChits();

    } catch (error) {
        console.error('Error updating chit fund:', error);
        alert('Error updating chit fund: ' + error.message);
    } finally {
        setLoading(document.getElementById('updateChitBtn'), false);
    }
}

// Profile Management Functions
async function showProfile() {
    try {
        // Load profile data
        document.getElementById('profileName').textContent = userData.name || 'Manager';
        document.getElementById('profileEmail').textContent = userData.email || '-';
        document.getElementById('profilePhone').textContent = userData.phone || 'Not provided';
        document.getElementById('profileAddress').textContent = userData.address || 'Not provided';
        document.getElementById('profileRole').textContent = userData.role || 'Manager';
        document.getElementById('profileJoinDate').textContent = userData.createdAt ? 
            new Date(userData.createdAt.seconds * 1000).toLocaleDateString() : 'Recently';

        // Load profile statistics
        await loadProfileStats();
        
        profileModal.show();
    } catch (error) {
        console.error('Error loading profile:', error);
        alert('Error loading profile: ' + error.message);
    }
}

async function loadProfileStats() {
    try {
        // Total chits created
        const chitsSnapshot = await db.collection('chits')
            .where('managerId', '==', currentUser.uid)
            .get();
        document.getElementById('profileTotalChits').textContent = chitsSnapshot.size;

        // Active members
        const membersSnapshot = await db.collection('members')
            .where('managerId', '==', currentUser.uid)
            .where('status', '==', 'active')
            .get();
        document.getElementById('profileActiveMembers').textContent = membersSnapshot.size;

        // Total collection
        let totalCollection = 0;
        const paymentsSnapshot = await db.collection('payments')
            .where('managerId', '==', currentUser.uid)
            .get();
        
        paymentsSnapshot.forEach(doc => {
            const payment = doc.data();
            totalCollection += payment.amount || 0;
        });
        document.getElementById('profileTotalCollection').textContent = `₹${totalCollection.toLocaleString()}`;

        // Completed auctions
        const auctionsSnapshot = await db.collection('auctions')
            .where('managerId', '==', currentUser.uid)
            .where('status', '==', 'completed')
            .get();
        document.getElementById('profileCompletedAuctions').textContent = auctionsSnapshot.size;

    } catch (error) {
        console.error('Error loading profile stats:', error);
    }
}

function showEditProfile() {
    document.getElementById('editProfileName').value = userData.name || '';
    document.getElementById('editProfileEmail').value = userData.email || '';
    document.getElementById('editProfilePhone').value = userData.phone || '';
    document.getElementById('editProfileAddress').value = userData.address || '';
    
    profileModal.hide();
    setTimeout(() => editProfileModal.show(), 300);
}

async function updateProfile() {
    const name = document.getElementById('editProfileName').value;
    const phone = document.getElementById('editProfilePhone').value;
    const address = document.getElementById('editProfileAddress').value;

    if (!name) {
        alert('Please enter your name');
        return;
    }

    try {
        setLoading(document.getElementById('updateProfileBtn'), true);

        const updateData = {
            name: name,
            phone: phone,
            address: address,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('users').doc(currentUser.uid).update(updateData);
        
        // Update local userData
        userData = { ...userData, ...updateData };
        updateUI();
        
        editProfileModal.hide();
        showSuccess('Profile updated successfully!');
        
        // Refresh profile modal if open
        await showProfile();
        
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Error updating profile: ' + error.message);
    } finally {
        setLoading(document.getElementById('updateProfileBtn'), false);
    }
}

// Auction Management Functions
async function showScheduleAuction() {
    try {
        // Load active chits for dropdown
        const chitsSnapshot = await db.collection('chits')
            .where('managerId', '==', currentUser.uid)
            .where('status', '==', 'active')
            .get();
        
        const auctionChitSelect = document.getElementById('auctionChit');
        auctionChitSelect.innerHTML = '<option value="">Choose a chit fund...</option>';
        
        chitsSnapshot.forEach(doc => {
            const chit = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${chit.name} (${chit.chitCode})`;
            auctionChitSelect.appendChild(option);
        });
        
        // Set default date to next week
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        document.getElementById('auctionDate').value = nextWeek.toISOString().slice(0, 16);
        
        scheduleAuctionModal.show();
    } catch (error) {
        console.error('Error loading chits for auction:', error);
        alert('Error loading chit funds: ' + error.message);
    }
}

async function scheduleAuction() {
    const chitId = document.getElementById('auctionChit').value;
    const auctionDate = document.getElementById('auctionDate').value;
    const location = document.getElementById('auctionLocation').value;
    const minBid = parseInt(document.getElementById('auctionMinBid').value);
    const notes = document.getElementById('auctionNotes').value;

    if (!chitId || !auctionDate) {
        alert('Please fill all required fields');
        return;
    }

    try {
        setLoading(document.getElementById('saveAuctionBtn'), true);

        // Get chit details
        const chitDoc = await db.collection('chits').doc(chitId).get();
        if (!chitDoc.exists) {
            alert('Selected chit fund not found!');
            return;
        }

        const chit = chitDoc.data();
        const auctionData = {
            chitId: chitId,
            chitName: chit.name,
            chitCode: chit.chitCode,
            auctionDate: new Date(auctionDate),
            location: location,
            minBidPercentage: minBid,
            notes: notes,
            managerId: currentUser.uid,
            status: 'scheduled',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('auctions').add(auctionData);

        document.getElementById('scheduleAuctionForm').reset();
        scheduleAuctionModal.hide();
        
        showSuccess('Auction scheduled successfully!');
        
        await loadAuctions();

    } catch (error) {
        console.error('Error scheduling auction:', error);
        alert('Error scheduling auction: ' + error.message);
    } finally {
        setLoading(document.getElementById('saveAuctionBtn'), false);
    }
}

// Enhanced loadAuctions function
async function loadAuctions() {
    try {
        const auctionsSnapshot = await db.collection('auctions')
            .where('managerId', '==', currentUser.uid)
            .orderBy('auctionDate', 'desc')
            .get();
        
        const auctionsList = document.getElementById('auctionsList');
        auctionsList.innerHTML = '';
        
        if (auctionsSnapshot.empty) {
            auctionsList.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-gavel fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No Auctions Scheduled</h5>
                    <p class="text-muted">Schedule your first auction to get started</p>
                </div>
            `;
            return;
        }
        
        auctionsSnapshot.forEach(doc => {
            const auction = { id: doc.id, ...doc.data() };
            renderAuction(auction);
        });
        
    } catch (error) {
        console.error('Error loading auctions:', error);
        auctionsList.innerHTML = `
            <div class="alert alert-danger">
                Error loading auctions: ${error.message}
            </div>
        `;
    }
}

function renderAuction(auction) {
    const auctionsList = document.getElementById('auctionsList');
    const auctionElement = document.createElement('div');
    auctionElement.className = 'chit-item';
    
    const auctionDate = auction.auctionDate?.toDate ? auction.auctionDate.toDate() : new Date(auction.auctionDate);
    const now = new Date();
    const isUpcoming = auctionDate > now;
    
    auctionElement.innerHTML = `
        <div class="chit-header">
            <div>
                <h4 class="chit-name">${auction.chitName}</h4>
                <p class="chit-code">Code: <strong>${auction.chitCode}</strong></p>
            </div>
            <div class="chit-actions">
                <span class="badge ${isUpcoming ? 'bg-warning' : 'bg-secondary'}">
                    ${isUpcoming ? 'Upcoming' : 'Completed'}
                </span>
            </div>
        </div>
        
        <div class="chit-details-grid">
            <div class="detail-item">
                <label>Auction Date:</label>
                <span>${auctionDate.toLocaleString()}</span>
            </div>
            <div class="detail-item">
                <label>Location:</label>
                <span>${auction.location || 'Not specified'}</span>
            </div>
            <div class="detail-item">
                <label>Min Bid:</label>
                <span>${auction.minBidPercentage}%</span>
            </div>
            <div class="detail-item">
                <label>Status:</label>
                <span class="badge ${auction.status === 'scheduled' ? 'bg-primary' : 
                                  auction.status === 'completed' ? 'bg-success' : 'bg-secondary'}">
                    ${auction.status}
                </span>
            </div>
        </div>
        
        ${auction.notes ? `
            <div class="mt-2">
                <label class="fw-bold">Notes:</label>
                <p class="mb-0">${auction.notes}</p>
            </div>
        ` : ''}
        
        <div class="chit-footer">
            <span class="chit-date">Scheduled: ${auctionDate.toLocaleDateString()}</span>
            <div>
                ${isUpcoming ? `
                    <button class="btn btn-sm btn-success me-1 complete-auction-btn" data-auction-id="${auction.id}">
                        <i class="fas fa-check me-1"></i>Complete
                    </button>
                    <button class="btn btn-sm btn-warning me-1 edit-auction-btn" data-auction-id="${auction.id}">
                        <i class="fas fa-edit me-1"></i>Edit
                    </button>
                ` : ''}
                <button class="btn btn-sm btn-danger delete-auction-btn" data-auction-id="${auction.id}">
                    <i class="fas fa-trash me-1"></i>Delete
                </button>
            </div>
        </div>
    `;
    
    auctionsList.appendChild(auctionElement);
    attachAuctionEventListeners(auctionElement, auction);
}

function attachAuctionEventListeners(element, auction) {
    const completeBtn = element.querySelector('.complete-auction-btn');
    const editBtn = element.querySelector('.edit-auction-btn');
    const deleteBtn = element.querySelector('.delete-auction-btn');

    if (completeBtn) {
        completeBtn.addEventListener('click', () => completeAuction(auction.id));
    }
    if (editBtn) {
        editBtn.addEventListener('click', () => editAuction(auction.id));
    }
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => deleteAuction(auction.id));
    }
}

async function completeAuction(auctionId) {
    if (!confirm('Mark this auction as completed?')) return;

    try {
        await db.collection('auctions').doc(auctionId).update({
            status: 'completed',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showSuccess('Auction marked as completed!');
        await loadAuctions();
    } catch (error) {
        console.error('Error completing auction:', error);
        alert('Error completing auction: ' + error.message);
    }
}

async function deleteAuction(auctionId) {
    if (!confirm('Are you sure you want to delete this auction?')) return;

    try {
        await db.collection('auctions').doc(auctionId).delete();
        showSuccess('Auction deleted successfully!');
        await loadAuctions();
    } catch (error) {
        console.error('Error deleting auction:', error);
        alert('Error deleting auction: ' + error.message);
    }
}

// Payment Management Functions
async function showRecordPayment() {
    try {
        // Load members for dropdown
        const membersSnapshot = await db.collection('members')
            .where('managerId', '==', currentUser.uid)
            .where('status', '==', 'active')
            .get();
        
        const paymentMemberSelect = document.getElementById('paymentMember');
        paymentMemberSelect.innerHTML = '<option value="">Choose a member...</option>';
        
        membersSnapshot.forEach(doc => {
            const member = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${member.name} (${member.email})`;
            paymentMemberSelect.appendChild(option);
        });

        // Load chits for dropdown
        const chitsSnapshot = await db.collection('chits')
            .where('managerId', '==', currentUser.uid)
            .where('status', '==', 'active')
            .get();
        
        const paymentChitSelect = document.getElementById('paymentChit');
        paymentChitSelect.innerHTML = '<option value="">Choose a chit fund...</option>';
        
        chitsSnapshot.forEach(doc => {
            const chit = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${chit.name} (${chit.chitCode})`;
            paymentChitSelect.appendChild(option);
        });

        // Set default date to today
        document.getElementById('paymentDate').value = new Date().toISOString().split('T')[0];
        
        recordPaymentModal.show();
    } catch (error) {
        console.error('Error loading data for payment:', error);
        alert('Error loading data: ' + error.message);
    }
}

async function recordPayment() {
    const memberId = document.getElementById('paymentMember').value;
    const chitId = document.getElementById('paymentChit').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const paymentDate = document.getElementById('paymentDate').value;
    const paymentMethod = document.getElementById('paymentMethod').value;
    const notes = document.getElementById('paymentNotes').value;

    if (!memberId || !chitId || !amount || !paymentDate) {
        alert('Please fill all required fields');
        return;
    }

    try {
        setLoading(document.getElementById('savePaymentBtn'), true);

        // Get member and chit details
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
            chitCode: chit.chitCode,
            amount: amount,
            paymentDate: paymentDate,
            paymentMethod: paymentMethod,
            notes: notes,
            managerId: currentUser.uid,
            status: 'completed',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('payments').add(paymentData);

        // Update member's total paid
        const newTotalPaid = (member.totalPaid || 0) + amount;
        await db.collection('members').doc(memberId).update({
            totalPaid: newTotalPaid,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
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

// Enhanced loadPayments function
async function loadPayments() {
    try {
        const paymentsSnapshot = await db.collection('payments')
            .where('managerId', '==', currentUser.uid)
            .orderBy('paymentDate', 'desc')
            .get();
        
        const paymentsList = document.getElementById('paymentsList');
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
        
        let totalAmount = 0;
        paymentsSnapshot.forEach(doc => {
            const payment = { id: doc.id, ...doc.data() };
            totalAmount += payment.amount || 0;
            renderPayment(payment);
        });

        // Update payment summary
        const summaryHTML = `
            <div class="row mb-4">
                <div class="col-md-3 col-6">
                    <div class="summary-card text-success">
                        <i class="fas fa-rupee-sign"></i>
                        <span>Total Collected</span>
                        <strong>₹${totalAmount.toLocaleString()}</strong>
                    </div>
                </div>
                <div class="col-md-3 col-6">
                    <div class="summary-card text-primary">
                        <i class="fas fa-receipt"></i>
                        <span>Total Payments</span>
                        <strong>${paymentsSnapshot.size}</strong>
                    </div>
                </div>
                <div class="col-md-3 col-6">
                    <div class="summary-card text-info">
                        <i class="fas fa-users"></i>
                        <span>Active Payers</span>
                        <strong>${new Set(paymentsSnapshot.docs.map(doc => doc.data().memberId)).size}</strong>
                    </div>
                </div>
                <div class="col-md-3 col-6">
                    <div class="summary-card text-warning">
                        <i class="fas fa-file-contract"></i>
                        <span>Active Chits</span>
                        <strong>${new Set(paymentsSnapshot.docs.map(doc => doc.data().chitId)).size}</strong>
                    </div>
                </div>
            </div>
        `;
        
        paymentsList.innerHTML = summaryHTML + paymentsList.innerHTML;
        
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
    const paymentsList = document.getElementById('paymentsList');
    const paymentElement = document.createElement('div');
    paymentElement.className = 'payment-item';
    
    paymentElement.innerHTML = `
        <div class="payment-header">
            <div>
                <h6 class="payment-chit mb-1">${payment.chitName}</h6>
                <p class="mb-0 text-muted small">Paid by: ${payment.memberName}</p>
            </div>
            <div class="payment-amount">
                <strong class="text-success">₹${payment.amount?.toLocaleString()}</strong>
            </div>
        </div>
        <div class="payment-details">
            <span><i class="fas fa-calendar me-1"></i>${payment.paymentDate}</span>
            <span><i class="fas fa-wallet me-1"></i>${payment.paymentMethod}</span>
            <span class="badge bg-success">${payment.status}</span>
        </div>
        ${payment.notes ? `<p class="mt-2 mb-0 small text-muted">${payment.notes}</p>` : ''}
    `;
    
    paymentsList.appendChild(paymentElement);
}

// Reports Functions
async function showReports() {
    try {
        await loadFinancialReports();
        await loadMembersReport();
        await loadChitsReport();
        
        viewReportsModal.show();
    } catch (error) {
        console.error('Error loading reports:', error);
        alert('Error loading reports: ' + error.message);
    }
}

async function loadFinancialReports() {
    try {
        const financialReports = document.getElementById('financialReports');
        
        // Get total collections
        let totalCollections = 0;
        const paymentsSnapshot = await db.collection('payments')
            .where('managerId', '==', currentUser.uid)
            .get();
        
        paymentsSnapshot.forEach(doc => {
            totalCollections += doc.data().amount || 0;
        });

        // Get pending amounts (simplified calculation)
        const chitsSnapshot = await db.collection('chits')
            .where('managerId', '==', currentUser.uid)
            .get();
        
        let totalExpected = 0;
        chitsSnapshot.forEach(doc => {
            const chit = doc.data();
            totalExpected += chit.totalAmount || 0;
        });

        const pendingAmount = Math.max(0, totalExpected - totalCollections);

        financialReports.innerHTML = `
            <div class="col-md-6 mb-4">
                <div class="card border-success">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="card-title text-success">Total Collections</h6>
                                <h3 class="text-success">₹${totalCollections.toLocaleString()}</h3>
                            </div>
                            <i class="fas fa-money-bill-wave fa-2x text-success"></i>
                        </div>
                        <p class="small text-muted mb-0">Total amount collected from all chits</p>
                    </div>
                </div>
            </div>
            <div class="col-md-6 mb-4">
                <div class="card border-warning">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="card-title text-warning">Pending Collections</h6>
                                <h3 class="text-warning">₹${pendingAmount.toLocaleString()}</h3>
                            </div>
                            <i class="fas fa-clock fa-2x text-warning"></i>
                        </div>
                        <p class="small text-muted mb-0">Amount yet to be collected</p>
                    </div>
                </div>
            </div>
            <div class="col-md-6 mb-4">
                <div class="card border-primary">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="card-title text-primary">Active Chits</h6>
                                <h3 class="text-primary">${chitsSnapshot.size}</h3>
                            </div>
                            <i class="fas fa-file-contract fa-2x text-primary"></i>
                        </div>
                        <p class="small text-muted mb-0">Total active chit funds</p>
                    </div>
                </div>
            </div>
            <div class="col-md-6 mb-4">
                <div class="card border-info">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="card-title text-info">Total Members</h6>
                                <h3 class="text-info">${(await db.collection('members').where('managerId', '==', currentUser.uid).get()).size}</h3>
                            </div>
                            <i class="fas fa-users fa-2x text-info"></i>
                        </div>
                        <p class="small text-muted mb-0">Registered members across all chits</p>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading financial reports:', error);
        document.getElementById('financialReports').innerHTML = `
            <div class="alert alert-danger">Error loading financial reports: ${error.message}</div>
        `;
    }
}

async function loadMembersReport() {
    try {
        const membersReport = document.getElementById('membersReport');
        const membersSnapshot = await db.collection('members')
            .where('managerId', '==', currentUser.uid)
            .get();
        
        if (membersSnapshot.empty) {
            membersReport.innerHTML = '<p class="text-muted">No members found</p>';
            return;
        }

        let reportHTML = `
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Total Paid</th>
                            <th>Status</th>
                            <th>Join Date</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        membersSnapshot.forEach(doc => {
            const member = doc.data();
            const joinDate = member.createdAt?.toDate ? member.createdAt.toDate().toLocaleDateString() : 'Recently';
            
            reportHTML += `
                <tr>
                    <td>${member.name}</td>
                    <td>${member.email}</td>
                    <td>${member.phone || '-'}</td>
                    <td>₹${(member.totalPaid || 0).toLocaleString()}</td>
                    <td><span class="badge ${member.status === 'active' ? 'bg-success' : 'bg-secondary'}">${member.status}</span></td>
                    <td>${joinDate}</td>
                </tr>
            `;
        });

        reportHTML += `
                    </tbody>
                </table>
            </div>
        `;

        membersReport.innerHTML = reportHTML;
    } catch (error) {
        console.error('Error loading members report:', error);
        document.getElementById('membersReport').innerHTML = `
            <div class="alert alert-danger">Error loading members report: ${error.message}</div>
        `;
    }
}

async function loadChitsReport() {
    try {
        const chitsReport = document.getElementById('chitsReport');
        const chitsSnapshot = await db.collection('chits')
            .where('managerId', '==', currentUser.uid)
            .get();
        
        if (chitsSnapshot.empty) {
            chitsReport.innerHTML = '<p class="text-muted">No chit funds found</p>';
            return;
        }

        let reportHTML = `
            <div class="table-responsive">
                <table class="table table-striped">
                    <thead>
                        <tr>
                            <th>Chit Name</th>
                            <th>Code</th>
                            <th>Total Amount</th>
                            <th>Members</th>
                            <th>Status</th>
                            <th>Start Date</th>
                            <th>Duration</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        for (const doc of chitsSnapshot.docs) {
            const chit = doc.data();
            
            // Count members in this chit
            const membersCount = await db.collection('members')
                .where('chitIds', 'array-contains', doc.id)
                .get();
            
            const startDate = chit.startDate?.toDate ? chit.startDate.toDate().toLocaleDateString() : 'Not set';
            
            reportHTML += `
                <tr>
                    <td>${chit.name}</td>
                    <td>${chit.chitCode}</td>
                    <td>₹${(chit.totalAmount || 0).toLocaleString()}</td>
                    <td>${membersCount.size}</td>
                    <td><span class="badge ${chit.status === 'active' ? 'bg-success' : 'bg-secondary'}">${chit.status}</span></td>
                    <td>${startDate}</td>
                    <td>${chit.duration || 0} months</td>
                </tr>
            `;
        }

        reportHTML += `
                    </tbody>
                </table>
            </div>
        `;

        chitsReport.innerHTML = reportHTML;
    } catch (error) {
        console.error('Error loading chits report:', error);
        document.getElementById('chitsReport').innerHTML = `
            <div class="alert alert-danger">Error loading chits report: ${error.message}</div>
        `;
    }
}

function exportReports() {
    // Simple CSV export implementation
    const financialData = document.querySelector('#financialReports');
    const membersData = document.querySelector('#membersReport table');
    const chitsData = document.querySelector('#chitsReport table');
    
    let csvContent = "Chit Fund Manager Reports\n\n";
    
    // Add financial summary
    csvContent += "FINANCIAL SUMMARY\n";
    csvContent += "Total Collections," + document.querySelector('#financialReports .text-success h3')?.textContent + "\n";
    csvContent += "Pending Collections," + document.querySelector('#financialReports .text-warning h3')?.textContent + "\n";
    csvContent += "Active Chits," + document.querySelector('#financialReports .text-primary h3')?.textContent + "\n";
    csvContent += "Total Members," + document.querySelector('#financialReports .text-info h3')?.textContent + "\n\n";
    
    // Export as CSV file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chit-manager-reports-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showSuccess('Reports exported successfully!');
}

// Utility function to show success messages
function showSuccess(message) {
    // Create and show a success toast/alert
    const alertDiv = document.createElement('div');
    alertDiv.className = 'alert alert-success alert-dismissible fade show position-fixed';
    alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
    alertDiv.innerHTML = `
        <strong>Success!</strong> ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 3000);
}
