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
        // Profile and additional buttons
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
    }

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
                    <span>₹${chit.totalAmount?.toLocaleString() || '0'}</span>
                </div>
                <div class="detail-item">
                    <label>Monthly Amount:</label>
                    <span>₹${chit.monthlyAmount?.toLocaleString() || '0'}</span>
                </div>
                <div class="detail-item">
                    <label>Duration:</label>
                    <span>${chit.duration || '0'} months</span>
                </div>
                <div class="detail-item">
                    <label>Members:</label>
                    <span>${chit.currentMembers || 0}/${chit.maxMembers || 0}</span>
                </div>
            </div>
            
            <div class="progress mb-2" style="height: 8px;">
                <div class="progress-bar" style="width: ${progress.percentage}%"></div>
            </div>
            <div class="chit-footer">
                <span class="chit-status badge ${chit.status === 'active' ? 'bg-success' : 'bg-secondary'}">
                    ${chit.status || 'active'}
                </span>
                <span class="chit-date">Started: ${chit.startDate || 'Not set'}</span>
            </div>
        `;
        
        chitFundsList.appendChild(chitElement);
        attachChitEventListeners(chitElement, chit);
    }

    // Load members
    async function loadMembers() {
        try {
            console.log('Loading members for manager:', currentUser.uid);
            
            // Try to load from members collection first
            let membersSnapshot;
            try {
                membersSnapshot = await db.collection('members')
                    .where('managerId', '==', currentUser.uid)
                    .orderBy('joinedAt', 'desc')
                    .get();
            } catch (error) {
                console.log('Members collection not found, trying users collection');
                // Fallback to users collection with role 'member'
                membersSnapshot = await db.collection('users')
                    .where('role', '==', 'member')
                    .get();
            }
            
            console.log('Raw members snapshot:', membersSnapshot.size, 'members found');
            
            membersList.innerHTML = '';
            
            if (membersSnapshot.empty) {
                membersList.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-users fa-3x text-muted mb-3"></i>
                        <h5 class="text-muted">No Members Found</h5>
                        <p class="text-muted">Add members to your chit funds</p>
                        <button class="btn btn-primary mt-3" onclick="addMemberModal.show()">
                            <i class="fas fa-user-plus me-2"></i>Add Member
                        </button>
                    </div>
                `;
                return;
            }
            
            let validMembersCount = 0;
            
            membersSnapshot.forEach(doc => {
                const member = { id: doc.id, ...doc.data() };
                console.log('Processing member:', member);
                
                // Only render if member has basic data
                if (member.email && member.name) {
                    renderMember(member);
                    validMembersCount++;
                }
            });
            
            console.log('Successfully rendered members:', validMembersCount);
            
            if (validMembersCount === 0) {
                membersList.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-users fa-3x text-muted mb-3"></i>
                        <h5 class="text-muted">No Valid Members Found</h5>
                        <p class="text-muted">Add members using the form above</p>
                    </div>
                `;
            }
            
        } catch (error) {
            console.error('Error loading members:', error);
            membersList.innerHTML = `
                <div class="alert alert-danger">
                    <h5>Error Loading Members</h5>
                    <p>${error.message}</p>
                    <button class="btn btn-sm btn-warning mt-2" onclick="loadMembers()">
                        <i class="fas fa-redo me-1"></i>Retry
                    </button>
                </div>
            `;
        }
    }

    // Render member
    function renderMember(member) {
        const memberElement = document.createElement('div');
        memberElement.className = 'member-item';
        
        // Safe data extraction with fallbacks
        const memberName = member.name || 'Unknown Member';
        const memberEmail = member.email || 'No email';
        const memberPhone = member.phone || 'Not provided';
        const activeChits = member.activeChits || 0;
        const totalPaid = member.totalPaid || 0;
        const joinDate = member.joinedAt ? 
            new Date(member.joinedAt.seconds * 1000).toLocaleDateString() : 
            (member.createdAt ? new Date(member.createdAt.seconds * 1000).toLocaleDateString() : 'Recently');
        
        memberElement.innerHTML = `
            <div class="member-header">
                <div class="member-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="member-info">
                    <h5 class="member-name">${memberName}</h5>
                    <p class="member-contact">
                        <i class="fas fa-envelope me-1"></i>${memberEmail}
                        ${memberPhone ? `<br><i class="fas fa-phone me-1"></i>${memberPhone}` : ''}
                    </p>
                    <small class="text-muted">Joined: ${joinDate}</small>
                </div>
            </div>
            <div class="member-stats">
                <div class="stat">
                    <label>Active Chits:</label>
                    <span>${activeChits}</span>
                </div>
                <div class="stat">
                    <label>Total Paid:</label>
                    <span>₹${totalPaid.toLocaleString()}</span>
                </div>
                <div class="stat">
                    <label>Status:</label>
                    <span class="badge ${member.status === 'active' ? 'bg-success' : 'bg-warning'}">
                        ${member.status || 'active'}
                    </span>
                </div>
            </div>
            <div class="member-actions">
                <button class="btn btn-sm btn-outline-primary" onclick="viewMemberDetails('${member.id}')">
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
        try {
            const auctionsSnapshot = await db.collection('auctions')
                .where('managerId', '==', currentUser.uid)
                .orderBy('auctionDate', 'desc')
                .get();
            
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
        const auctionElement = document.createElement('div');
        auctionElement.className = 'chit-item';
        
        const auctionDate = auction.auctionDate?.toDate ? auction.auctionDate.toDate() : new Date(auction.auctionDate);
        const now = new Date();
        const isUpcoming = auctionDate > now;
        
        auctionElement.innerHTML = `
            <div class="chit-header">
                <div>
                    <h4 class="chit-name">${auction.chitName}</h4>
                    <p class="chit-code">Chit: ${auction.chitCode}</p>
                </div>
                <div class="chit-actions">
                    <span class="badge ${isUpcoming ? 'bg-warning' : 'bg-success'}">
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
                    <label>Status:</label>
                    <span class="badge ${auction.status === 'scheduled' ? 'bg-primary' : 'bg-success'}">
                        ${auction.status}
                    </span>
                </div>
            </div>
            
            <div class="chit-footer">
                <span class="chit-date">Scheduled: ${auctionDate.toLocaleDateString()}</span>
                <div>
                    <button class="btn btn-sm btn-outline-primary" onclick="viewAuctionDetails('${auction.id}')">
                        View Details
                    </button>
                </div>
            </div>
        `;
        
        auctionsList.appendChild(auctionElement);
    }

    // Load payments
    async function loadPayments() {
        try {
            const paymentsSnapshot = await db.collection('payments')
                .where('managerId', '==', currentUser.uid)
                .orderBy('paymentDate', 'desc')
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
            
            let totalAmount = 0;
            paymentsSnapshot.forEach(doc => {
                const payment = { id: doc.id, ...doc.data() };
                totalAmount += payment.amount || 0;
                renderPayment(payment);
            });

            // Add summary
            const summaryHTML = `
                <div class="row mb-4">
                    <div class="col-md-6">
                        <div class="summary-card text-success">
                            <i class="fas fa-rupee-sign"></i>
                            <span>Total Collected</span>
                            <strong>₹${totalAmount.toLocaleString()}</strong>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="summary-card text-primary">
                            <i class="fas fa-receipt"></i>
                            <span>Total Payments</span>
                            <strong>${paymentsSnapshot.size}</strong>
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
        const paymentElement = document.createElement('div');
        paymentElement.className = 'payment-item';
        
        paymentElement.innerHTML = `
            <div class="payment-header">
                <div>
                    <h6 class="payment-chit mb-1">${payment.chitName} - ${payment.memberName}</h6>
                    <p class="mb-0 text-muted small">${payment.paymentMethod || 'Cash'} • ${payment.paymentDate}</p>
                </div>
                <div class="payment-amount">
                    <strong class="text-success">₹${payment.amount?.toLocaleString()}</strong>
                </div>
            </div>
            ${payment.notes ? `<p class="mt-2 mb-0 small text-muted">${payment.notes}</p>` : ''}
        `;
        
        paymentsList.appendChild(paymentElement);
    }

    // Update dashboard statistics
    async function updateStats() {
        try {
            // Count members
            let membersCount = 0;
            try {
                const membersSnapshot = await db.collection('members')
                    .where('managerId', '==', currentUser.uid)
                    .get();
                membersCount = membersSnapshot.size;
            } catch (error) {
                console.log('Trying users collection for member count');
                const usersSnapshot = await db.collection('users')
                    .where('role', '==', 'member')
                    .get();
                membersCount = usersSnapshot.size;
            }
            console.log('Total members count:', membersCount);
            totalMembersElement.textContent = membersCount;

            // Count active chits and calculate collection
            let activeChitsCount = 0;
            let totalCollection = 0;
            try {
                const chitsSnapshot = await db.collection('chits')
                    .where('managerId', '==', currentUser.uid)
                    .where('status', '==', 'active')
                    .get();
                
                activeChitsCount = chitsSnapshot.size;
                
                // Calculate potential monthly collection
                chitsSnapshot.forEach(doc => {
                    const chit = doc.data();
                    const monthly = chit.monthlyAmount || 0;
                    const members = chit.currentMembers || 0;
                    totalCollection += monthly * members;
                });
            } catch (error) {
                console.warn('Error counting chits:', error);
                activeChitsCount = 0;
                totalCollection = 0;
            }
            
            activeChitsElement.textContent = activeChitsCount;
            totalCollectionElement.textContent = `₹${totalCollection.toLocaleString()}`;

            // Count auctions this month
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
            // Set fallback values
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

        try {
            const startDate = new Date(chit.startDate);
            const currentDate = new Date();
            
            if (isNaN(startDate.getTime())) {
                return {
                    monthsPassed: 0,
                    totalMonths: chit.duration,
                    percentage: 0
                };
            }

            const monthsPassed = Math.max(0, Math.floor((currentDate - startDate) / (1000 * 60 * 60 * 24 * 30.44)));
            const percentage = Math.min((monthsPassed / chit.duration) * 100, 100);
            
            return {
                monthsPassed: Math.min(monthsPassed, chit.duration),
                totalMonths: chit.duration,
                percentage: Math.round(percentage)
            };
        } catch (error) {
            return {
                monthsPassed: 0,
                totalMonths: chit.duration || 0,
                percentage: 0
            };
        }
    }

    // Event listeners
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

        if (!name || !email) {
            alert('Please fill name and email fields');
            return;
        }

        try {
            setLoading(saveMemberBtn, true);

            const memberData = {
                name: name,
                email: email,
                phone: phone || '',
                address: address || '',
                managerId: currentUser.uid,
                activeChits: 0,
                totalPaid: 0,
                status: 'active',
                joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Add to members collection
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

    // View chit details
    async function viewChitDetails(chitId) {
        try {
            const chitDoc = await db.collection('chits').doc(chitId).get();
            if (!chitDoc.exists) {
                alert('Chit fund not found!');
                return;
            }

            const chit = chitDoc.data();
            const progress = calculateChitProgress(chit);

            // Populate view modal
            document.getElementById('viewChitName').textContent = chit.name || '-';
            document.getElementById('viewChitCode').textContent = chit.chitCode || '-';
            document.getElementById('viewTotalAmount').textContent = `₹${chit.totalAmount?.toLocaleString() || '0'}`;
            document.getElementById('viewMonthlyAmount').textContent = `₹${chit.monthlyAmount?.toLocaleString() || '0'}`;
            document.getElementById('viewDuration').textContent = `${chit.duration || '0'} months`;
            document.getElementById('viewMaxMembers').textContent = `${chit.currentMembers || 0}/${chit.maxMembers || 0}`;
            
            const progressBar = document.getElementById('viewProgressBar');
            const progressText = document.getElementById('viewProgressText');
            if (progressBar) progressBar.style.width = `${progress.percentage}%`;
            if (progressText) progressText.textContent = `${progress.monthsPassed} of ${progress.totalMonths} months completed (${Math.round(progress.percentage)}%)`;

            await loadChitMembers(chitId);
            
            document.getElementById('membersCount').textContent = chit.currentMembers || 0;
            document.getElementById('maxMembersCount').textContent = chit.maxMembers || 0;

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
            if (alertDiv.parentNode) {
                alertDiv.remove();
            }
        }, 5000);
    }

    // Load members for a specific chit
    async function loadChitMembers(chitId) {
        try {
            const membersListElement = document.getElementById('membersList');
            if (!membersListElement) return;
            
            membersListElement.innerHTML = '<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Loading members...</div>';
            
            // For now, show all members since we don't have chit memberships set up
            const membersSnapshot = await db.collection('members')
                .where('managerId', '==', currentUser.uid)
                .get();
            
            membersListElement.innerHTML = '';
            
            if (membersSnapshot.empty) {
                membersListElement.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-users fa-3x text-muted mb-3"></i>
                        <h5 class="text-muted">No Members Available</h5>
                        <p class="text-muted">Members will appear here when they register</p>
                    </div>
                `;
                return;
            }
            
            membersSnapshot.forEach(doc => {
                const member = { id: doc.id, ...doc.data() };
                renderChitMember(member);
            });
            
        } catch (error) {
            console.error('Error loading chit members:', error);
            document.getElementById('membersList').innerHTML = `
                <div class="alert alert-danger">
                    Error loading members: ${error.message}
                </div>
            `;
        }
    }

    // Render member in chit members list
    function renderChitMember(member) {
        const membersListElement = document.getElementById('membersList');
        if (!membersListElement) return;
        
        const memberElement = document.createElement('div');
        memberElement.className = 'member-item';
        memberElement.innerHTML = `
            <div class="member-header">
                <div class="member-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="member-info">
                    <h5 class="member-name">${member.name || 'Unknown Member'}</h5>
                    <p class="member-contact">
                        <i class="fas fa-envelope me-1"></i>${member.email || 'No email'}
                    </p>
                </div>
                <div class="member-status">
                    <span class="badge bg-success">Available</span>
                </div>
            </div>
            <div class="member-actions">
                <button class="btn btn-sm btn-success" onclick="addMemberToChit('${member.id}')">
                    <i class="fas fa-plus me-1"></i>Add to Chit
                </button>
            </div>
        `;
        
        membersListElement.appendChild(memberElement);
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
            let membersCount = 0;
            try {
                const membersSnapshot = await db.collection('members')
                    .where('managerId', '==', currentUser.uid)
                    .where('status', '==', 'active')
                    .get();
                membersCount = membersSnapshot.size;
            } catch (error) {
                const usersSnapshot = await db.collection('users')
                    .where('role', '==', 'member')
                    .get();
                membersCount = usersSnapshot.size;
            }
            document.getElementById('profileActiveMembers').textContent = membersCount;

            // Total collection
            let totalCollection = 0;
            try {
                const paymentsSnapshot = await db.collection('payments')
                    .where('managerId', '==', currentUser.uid)
                    .get();
                
                paymentsSnapshot.forEach(doc => {
                    const payment = doc.data();
                    totalCollection += payment.amount || 0;
                });
            } catch (error) {
                console.log('No payments found');
            }
            document.getElementById('profileTotalCollection').textContent = `₹${totalCollection.toLocaleString()}`;

            // Completed auctions
            let completedAuctions = 0;
            try {
                const auctionsSnapshot = await db.collection('auctions')
                    .where('managerId', '==', currentUser.uid)
                    .where('status', '==', 'completed')
                    .get();
                completedAuctions = auctionsSnapshot.size;
            } catch (error) {
                console.log('No auctions found');
            }
            document.getElementById('profileCompletedAuctions').textContent = completedAuctions;

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
            try {
                const paymentsSnapshot = await db.collection('payments')
                    .where('managerId', '==', currentUser.uid)
                    .get();
                
                paymentsSnapshot.forEach(doc => {
                    totalCollections += doc.data().amount || 0;
                });
            } catch (error) {
                console.log('No payments found for reports');
            }

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

            // Get members count
            let membersCount = 0;
            try {
                const membersSnapshot = await db.collection('members')
                    .where('managerId', '==', currentUser.uid)
                    .get();
                membersCount = membersSnapshot.size;
            } catch (error) {
                const usersSnapshot = await db.collection('users')
                    .where('role', '==', 'member')
                    .get();
                membersCount = usersSnapshot.size;
            }

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
                                    <h3 class="text-info">${membersCount}</h3>
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
            let membersSnapshot;
            try {
                membersSnapshot = await db.collection('members')
                    .where('managerId', '==', currentUser.uid)
                    .get();
            } catch (error) {
                membersSnapshot = await db.collection('users')
                    .where('role', '==', 'member')
                    .get();
            }
            
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
                const joinDate = member.joinedAt ? 
                    new Date(member.joinedAt.seconds * 1000).toLocaleDateString() : 
                    (member.createdAt ? new Date(member.createdAt.seconds * 1000).toLocaleDateString() : 'Recently');
                
                reportHTML += `
                    <tr>
                        <td>${member.name}</td>
                        <td>${member.email}</td>
                        <td>${member.phone || '-'}</td>
                        <td>₹${(member.totalPaid || 0).toLocaleString()}</td>
                        <td><span class="badge ${member.status === 'active' ? 'bg-success' : 'bg-secondary'}">${member.status || 'active'}</span></td>
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
                
                const startDate = chit.startDate || 'Not set';
                
                reportHTML += `
                    <tr>
                        <td>${chit.name}</td>
                        <td>${chit.chitCode}</td>
                        <td>₹${(chit.totalAmount || 0).toLocaleString()}</td>
                        <td>${chit.currentMembers || 0}/${chit.maxMembers || 0}</td>
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
        let csvContent = "Chit Fund Manager Reports\n\n";
        
        // Add financial summary
        csvContent += "FINANCIAL SUMMARY\n";
        csvContent += "Total Collections," + (document.querySelector('#financialReports .text-success h3')?.textContent || '₹0') + "\n";
        csvContent += "Pending Collections," + (document.querySelector('#financialReports .text-warning h3')?.textContent || '₹0') + "\n";
        csvContent += "Active Chits," + (document.querySelector('#financialReports .text-primary h3')?.textContent || '0') + "\n";
        csvContent += "Total Members," + (document.querySelector('#financialReports .text-info h3')?.textContent || '0') + "\n\n";
        
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

    // Update chit fund function
    async function updateChitFund() {
        const chitId = document.getElementById('editChitId').value;
        const name = document.getElementById('editChitName').value;
        const totalAmount = parseFloat(document.getElementById('editTotalAmount').value);
        const duration = parseInt(document.getElementById('editDuration').value);
        const monthlyAmount = parseFloat(document.getElementById('editMonthlyAmount').value);
        const startDate = document.getElementById('editStartDate').value;
        const maxMembers = parseInt(document.getElementById('editMaxMembers').value);
        const description = document.getElementById('editDescription').value;
        const status = document.getElementById('editStatus').value;

        if (!name || !totalAmount || !duration || !monthlyAmount || !startDate || !maxMembers) {
            alert('Please fill all required fields');
            return;
        }

        try {
            setLoading(document.getElementById('updateChitBtn'), true);

            const updateData = {
                name: name,
                totalAmount: totalAmount,
                duration: duration,
                monthlyAmount: monthlyAmount,
                startDate: startDate,
                maxMembers: maxMembers,
                description: description,
                status: status,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('chits').doc(chitId).update(updateData);

            document.getElementById('editChitForm').reset();
            editChitModal.hide();
            
            showSuccess('Chit fund updated successfully!');
            
            await loadChitFunds();
            await updateStats();

        } catch (error) {
            console.error('Error updating chit fund:', error);
            alert('Error updating chit fund: ' + error.message);
        } finally {
            setLoading(document.getElementById('updateChitBtn'), false);
        }
    }

    // Global functions for member actions
    window.viewMemberDetails = function(memberId) {
        alert('View member details: ' + memberId);
    };

    window.editMember = function(memberId) {
        alert('Edit member: ' + memberId);
    };

    window.deleteMember = async function(memberId) {
        if (confirm('Are you sure you want to delete this member?')) {
            try {
                await db.collection('members').doc(memberId).delete();
                showSuccess('Member deleted successfully!');
                loadMembers();
                updateStats();
            } catch (error) {
                console.error('Error deleting member:', error);
                alert('Error deleting member: ' + error.message);
            }
        }
    };

    window.addMemberToChit = function(memberId) {
        alert('Add member to chit: ' + memberId);
    };

    window.viewAuctionDetails = function(auctionId) {
        alert('View auction details: ' + auctionId);
    };
});
