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

    let currentUser = null;
    let userData = null;

    // Check authentication and role
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            await loadUserData();
            await checkManagerRole();
            await loadDashboardData();
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
                // Ensure user has manager role
                if (userData.role !== 'manager') {
                    await db.collection('users').doc(currentUser.uid).update({
                        role: 'manager'
                    });
                    userData.role = 'manager';
                }
            } else {
                // Create manager profile
                userData = {
                    name: currentUser.displayName || currentUser.email.split('@')[0],
                    email: currentUser.email,
                    role: 'manager',
                    createdAt: new Date()
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
                // Redirect members to member dashboard
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
        
        // Add event listeners
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
        // Implementation for auctions
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
        // Implementation for payments
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

            // Calculate total monthly collection
            let totalCollection = 0;
            chitsSnapshot.forEach(doc => {
                const chit = doc.data();
                totalCollection += (chit.monthlyAmount || 0) * (chit.currentMembers || 0);
            });
            totalCollectionElement.textContent = `₹${totalCollection.toLocaleString()}`;

            // Count auctions this month
            const currentMonth = new Date().getMonth();
            const auctionsSnapshot = await db.collection('auctions')
                .where('managerId', '==', currentUser.uid)
                .get();
            
            let auctionsThisMonth = 0;
            auctionsSnapshot.forEach(doc => {
                const auction = doc.data();
                const auctionMonth = auction.auctionDate?.toDate().getMonth();
                if (auctionMonth === currentMonth) {
                    auctionsThisMonth++;
                }
            });
            auctionsThisMonthElement.textContent = auctionsThisMonth;

        } catch (error) {
            console.error('Error updating stats:', error);
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

    // Event Listeners
    createChitBtn.addEventListener('click', () => {
        createChitModal.show();
    });

    addMemberBtn.addEventListener('click', () => {
        addMemberModal.show();
    });

    saveChitBtn.addEventListener('click', async () => {
        await createChitFund();
    });

    saveMemberBtn.addEventListener('click', async () => {
        await addMember();
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

            // Reset form and close modal
            document.getElementById('createChitForm').reset();
            createChitModal.hide();
            
            // Show success message
            showSuccess('Chit fund created successfully!');
            
            // Reload chit funds
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

            // Reset form and close modal
            document.getElementById('addMemberForm').reset();
            addMemberModal.hide();
            
            // Show success message
            showSuccess('Member added successfully!');
            
            // Reload members
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

    // View chit details
    function viewChitDetails(chitId) {
        // Implementation for viewing chit details
        alert('View chit details: ' + chitId);
    }

    // Edit chit
    function editChit(chitId) {
        // Implementation for editing chit
        alert('Edit chit: ' + chitId);
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
        if (userData) {
            userNameElement.textContent = userData.name || 'Manager';
        }
    }

    // Set loading state
    function setLoading(button, isLoading) {
        if (isLoading) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';
        } else {
            button.disabled = false;
            button.innerHTML = button === saveChitBtn ? 'Create Chit Fund' : 'Add Member';
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
