// Wait for DOM and Firebase to be loaded
document.addEventListener('DOMContentLoaded', function() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
        console.error('Firebase not loaded');
        window.location.href = 'auth.html';
        return;
    }

    const auth = firebase.auth();
    const db = firebase.firestore();

    // DOM Elements - FIXED: Added missing elements
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

    // Modal instances - FIXED: Added missing modal references
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
        
        // Tab buttons - FIXED: Added proper event listeners
        document.getElementById('addChitBtn')?.addEventListener('click', () => createChitModal.show());
        document.getElementById('addNewMemberBtn')?.addEventListener('click', () => addMemberModal.show());
        
        // Navigation buttons
        document.getElementById('manageAuctionsBtn')?.addEventListener('click', () => {
            document.getElementById('auctions-tab').click();
        });
        
        document.getElementById('viewReportsBtn')?.addEventListener('click', showReports);
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

    // Load members - FIXED: Enhanced member loading with better error handling
    async function loadMembers() {
        try {
            console.log('Loading members for manager:', currentUser.uid);
            
            // Clear existing members list
            if (membersList) {
                membersList.innerHTML = '<div class="text-center py-3"><i class="fas fa-spinner fa-spin"></i> Loading members...</div>';
            }
            
            let membersSnapshot;
            
            // Try multiple approaches to find members
            try {
                // Approach 1: Look in members collection
                membersSnapshot = await db.collection('members')
                    .where('managerId', '==', currentUser.uid)
                    .orderBy('joinedAt', 'desc')
                    .get();
                console.log('Found members in members collection:', membersSnapshot.size);
            } catch (error) {
                console.log('Members collection not accessible, trying users collection');
                
                // Approach 2: Look for users with member role
                membersSnapshot = await db.collection('users')
                    .where('role', '==', 'member')
                    .get();
                console.log('Found members in users collection:', membersSnapshot.size);
            }
            
            // If still no members, check chitMemberships
            if (!membersSnapshot || membersSnapshot.empty) {
                try {
                    console.log('Trying chitMemberships collection...');
                    const membershipsSnapshot = await db.collection('chitMemberships')
                        .where('managerId', '==', currentUser.uid)
                        .get();
                    
                    if (!membershipsSnapshot.empty) {
                        // Extract unique member IDs from memberships
                        const memberIds = [...new Set(membershipsSnapshot.docs.map(doc => doc.data().memberId))];
                        console.log('Found member IDs from memberships:', memberIds);
                        
                        // Fetch member details
                        const memberPromises = memberIds.map(memberId => 
                            db.collection('users').doc(memberId).get()
                        );
                        
                        const memberDocs = await Promise.all(memberPromises);
                        membersSnapshot = {
                            docs: memberDocs.filter(doc => doc.exists).map(doc => ({
                                id: doc.id,
                                data: () => doc.data()
                            })),
                            size: memberDocs.filter(doc => doc.exists).length,
                            empty: memberDocs.filter(doc => doc.exists).length === 0
                        };
                    }
                } catch (membershipError) {
                    console.log('No members found in chitMemberships either');
                }
            }
            
            if (!membersList) {
                console.error('Members list element not found');
                return;
            }
            
            membersList.innerHTML = '';
            
            if (!membersSnapshot || membersSnapshot.empty) {
                membersList.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-users fa-3x text-muted mb-3"></i>
                        <h5 class="text-muted">No Members Found</h5>
                        <p class="text-muted">Add members to your chit funds</p>
                        <button class="btn btn-primary mt-3" id="addMemberFromEmptyBtn">
                            <i class="fas fa-user-plus me-2"></i>Add Member
                        </button>
                    </div>
                `;
                
                // Add event listener to the button
                document.getElementById('addMemberFromEmptyBtn')?.addEventListener('click', () => {
                    addMemberModal.show();
                });
                return;
            }
            
            let validMembersCount = 0;
            
            membersSnapshot.forEach(doc => {
                try {
                    const memberData = doc.data();
                    const member = { id: doc.id, ...memberData };
                    
                    // Validate member data
                    if (member && (member.email || member.name)) {
                        renderMember(member);
                        validMembersCount++;
                    } else {
                        console.warn('Invalid member data:', member);
                    }
                } catch (memberError) {
                    console.error('Error processing member:', memberError);
                }
            });
            
            console.log('Successfully rendered members:', validMembersCount);
            
            if (validMembersCount === 0) {
                membersList.innerHTML = `
                    <div class="text-center py-5">
                        <i class="fas fa-users fa-3x text-muted mb-3"></i>
                        <h5 class="text-muted">No Valid Members Found</h5>
                        <p class="text-muted">Add members using the form above</p>
                        <button class="btn btn-primary mt-3" onclick="addMemberModal.show()">
                            <i class="fas fa-user-plus me-2"></i>Add Member
                        </button>
                    </div>
                `;
            }
            
        } catch (error) {
            console.error('Error loading members:', error);
            if (membersList) {
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
    }

    // Render member - FIXED: Enhanced with better data handling
    function renderMember(member) {
        if (!membersList) {
            console.error('Members list container not found');
            return;
        }
        
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
                <button class="btn btn-sm btn-outline-primary view-member-btn" data-member-id="${member.id}">
                    <i class="fas fa-eye me-1"></i>View
                </button>
                <button class="btn btn-sm btn-outline-warning edit-member-btn" data-member-id="${member.id}">
                    <i class="fas fa-edit me-1"></i>Edit
                </button>
                <button class="btn btn-sm btn-outline-danger delete-member-btn" data-member-id="${member.id}">
                    <i class="fas fa-trash me-1"></i>Delete
                </button>
            </div>
        `;
        
        membersList.appendChild(memberElement);
        
        // Attach event listeners to member buttons
        attachMemberEventListeners(memberElement, member);
    }

    // FIXED: Add member event listeners function
    function attachMemberEventListeners(element, member) {
        const viewBtn = element.querySelector('.view-member-btn');
        const editBtn = element.querySelector('.edit-member-btn');
        const deleteBtn = element.querySelector('.delete-member-btn');

        viewBtn?.addEventListener('click', () => viewMemberDetails(member.id));
        editBtn?.addEventListener('click', () => editMember(member.id));
        deleteBtn?.addEventListener('click', () => deleteMember(member.id));
    }

    // Load auctions
    async function loadAuctions() {
        try {
            const auctionsSnapshot = await db.collection('auctions')
                .where('managerId', '==', currentUser.uid)
                .orderBy('auctionDate', 'desc')
                .get();
            
            if (!auctionsList) {
                console.error('Auctions list element not found');
                return;
            }
            
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
            if (auctionsList) {
                auctionsList.innerHTML = `
                    <div class="alert alert-danger">
                        Error loading auctions: ${error.message}
                    </div>
                `;
            }
        }
    }

    function renderAuction(auction) {
        if (!auctionsList) return;
        
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
                    <button class="btn btn-sm btn-outline-primary view-auction-btn" data-auction-id="${auction.id}">
                        View Details
                    </button>
                </div>
            </div>
        `;
        
        auctionsList.appendChild(auctionElement);
        
        // Add event listener
        const viewBtn = auctionElement.querySelector('.view-auction-btn');
        viewBtn?.addEventListener('click', () => viewAuctionDetails(auction.id));
    }

    // Load payments
    async function loadPayments() {
        try {
            const paymentsSnapshot = await db.collection('payments')
                .where('managerId', '==', currentUser.uid)
                .orderBy('paymentDate', 'desc')
                .get();
            
            if (!paymentsList) {
                console.error('Payments list element not found');
                return;
            }
            
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
            if (paymentsList) {
                paymentsList.innerHTML = `
                    <div class="alert alert-danger">
                        Error loading payments: ${error.message}
                    </div>
                `;
            }
        }
    }

    function renderPayment(payment) {
        if (!paymentsList) return;
        
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

    // Update dashboard statistics - FIXED: Enhanced with better counting
    async function updateStats() {
        try {
            // Count members - FIXED: Better member counting
            let membersCount = 0;
            try {
                const membersSnapshot = await db.collection('members')
                    .where('managerId', '==', currentUser.uid)
                    .get();
                membersCount = membersSnapshot.size;
            } catch (error) {
                console.log('Trying alternative methods for member count');
                try {
                    const usersSnapshot = await db.collection('users')
                        .where('role', '==', 'member')
                        .get();
                    membersCount = usersSnapshot.size;
                } catch (userError) {
                    // If no members found, count from chitMemberships
                    try {
                        const membershipsSnapshot = await db.collection('chitMemberships')
                            .where('managerId', '==', currentUser.uid)
                            .get();
                        
                        if (!membershipsSnapshot.empty) {
                            const uniqueMemberIds = new Set();
                            membershipsSnapshot.forEach(doc => {
                                uniqueMemberIds.add(doc.data().memberId);
                            });
                            membersCount = uniqueMemberIds.size;
                        }
                    } catch (membershipError) {
                        console.warn('Could not count members from any source');
                    }
                }
            }
            
            console.log('Total members count:', membersCount);
            if (totalMembersElement) {
                totalMembersElement.textContent = membersCount;
            }

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
            
            if (activeChitsElement) activeChitsElement.textContent = activeChitsCount;
            if (totalCollectionElement) totalCollectionElement.textContent = `₹${totalCollection.toLocaleString()}`;

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
            if (auctionsThisMonthElement) auctionsThisMonthElement.textContent = auctionsThisMonth;

        } catch (error) {
            console.error('Error updating stats:', error);
            // Set fallback values
            if (totalMembersElement) totalMembersElement.textContent = '0';
            if (activeChitsElement) activeChitsElement.textContent = '0';
            if (totalCollectionElement) totalCollectionElement.textContent = '₹0';
            if (auctionsThisMonthElement) auctionsThisMonthElement.textContent = '0';
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

    // Event listeners - FIXED: Added null checks
    if (createChitBtn) {
        createChitBtn.addEventListener('click', () => {
            try {
                createChitModal.show();
            } catch (error) {
                console.error('Error showing modal:', error);
            }
        });
    }

    if (addMemberBtn) {
        addMemberBtn.addEventListener('click', () => {
            try {
                addMemberModal.show();
            } catch (error) {
                console.error('Error showing modal:', error);
            }
        });
    }

    if (saveChitBtn) {
        saveChitBtn.addEventListener('click', async () => {
            try {
                await createChitFund();
            } catch (error) {
                console.error('Error in chit creation:', error);
            }
        });
    }

    if (saveMemberBtn) {
        saveMemberBtn.addEventListener('click', async () => {
            try {
                await addMember();
            } catch (error) {
                console.error('Error in member addition:', error);
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            try {
                await auth.signOut();
                window.location.href = 'auth.html';
            } catch (error) {
                console.error('Logout error:', error);
                window.location.href = 'auth.html';
            }
        });
    }

    // Create chit fund
    async function createChitFund() {
        const name = document.getElementById('chitName')?.value;
        const chitCode = document.getElementById('chitCode')?.value;
        const totalAmount = parseFloat(document.getElementById('totalAmount')?.value);
        const duration = parseInt(document.getElementById('duration')?.value);
        const monthlyAmount = parseFloat(document.getElementById('monthlyAmount')?.value);
        const startDate = document.getElementById('startDate')?.value;
        const maxMembers = parseInt(document.getElementById('maxMembers')?.value);
        const description = document.getElementById('chitDescription')?.value;

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

            const createChitForm = document.getElementById('createChitForm');
            if (createChitForm) createChitForm.reset();
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
        const name = document.getElementById('memberName')?.value;
        const email = document.getElementById('memberEmail')?.value;
        const phone = document.getElementById('memberPhone')?.value;
        const address = document.getElementById('memberAddress')?.value;

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

            // Also ensure user exists in users collection with member role
            try {
                const userQuery = await db.collection('users')
                    .where('email', '==', email)
                    .get();
                
                if (userQuery.empty) {
                    await db.collection('users').add({
                        name: name,
                        email: email,
                        role: 'member',
                        phone: phone || '',
                        address: address || '',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            } catch (userError) {
                console.warn('Could not create user entry:', userError);
            }

            const addMemberForm = document.getElementById('addMemberForm');
            if (addMemberForm) addMemberForm.reset();
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

        viewBtn?.addEventListener('click', () => viewChitDetails(chit.id));
        editBtn?.addEventListener('click', () => editChitFund(chit.id));
        deleteBtn?.addEventListener('click', () => deleteChitFund(chit.id));
    }

    // View chit details
    async function viewChitDetails(chitId) {
        try {
            const chitDoc = await db.collection('chits').doc(chitId).get();
            if (!chitDoc.exists) {
                alert('Chit fund not found');
                return;
            }

            const chit = { id: chitDoc.id, ...chitDoc.data() };
            
            // FIXED: Use the correct modal element ID
            const modalMembersList = document.getElementById('viewChitMembersList');
            if (!modalMembersList) {
                console.error('View chit members list not found');
                return;
            }

            // Update modal content
            const modalTitle = document.querySelector('#viewChitModal .modal-title');
            if (modalTitle) modalTitle.textContent = chit.name;

            const modalBody = document.querySelector('#viewChitModal .modal-body');
            if (modalBody) {
                modalBody.innerHTML = `
                    <div class="row">
                        <div class="col-md-6">
                            <p><strong>Chit Code:</strong> ${chit.chitCode}</p>
                            <p><strong>Total Amount:</strong> ₹${chit.totalAmount?.toLocaleString()}</p>
                            <p><strong>Monthly Amount:</strong> ₹${chit.monthlyAmount?.toLocaleString()}</p>
                        </div>
                        <div class="col-md-6">
                            <p><strong>Duration:</strong> ${chit.duration} months</p>
                            <p><strong>Members:</strong> ${chit.currentMembers || 0}/${chit.maxMembers}</p>
                            <p><strong>Start Date:</strong> ${chit.startDate}</p>
                        </div>
                    </div>
                    ${chit.description ? `<p><strong>Description:</strong> ${chit.description}</p>` : ''}
                    
                    <div class="mt-4">
                        <h6>Members</h6>
                        <div id="viewChitMembersList" class="members-list">
                            <div class="text-center py-3">
                                <i class="fas fa-spinner fa-spin"></i> Loading members...
                            </div>
                        </div>
                    </div>
                `;
            }

            // Load members for this chit
            await loadChitMembers(chitId);
            
            viewChitModal.show();

        } catch (error) {
            console.error('Error viewing chit details:', error);
            alert('Error loading chit details: ' + error.message);
        }
    }

    // Load members for a specific chit
    async function loadChitMembers(chitId) {
        try {
            const modalMembersList = document.getElementById('viewChitMembersList');
            if (!modalMembersList) return;

            // Get memberships for this chit
            const membershipsSnapshot = await db.collection('chitMemberships')
                .where('chitId', '==', chitId)
                .get();

            if (membershipsSnapshot.empty) {
                modalMembersList.innerHTML = `
                    <div class="text-center py-3 text-muted">
                        <i class="fas fa-users"></i>
                        <p>No members joined yet</p>
                    </div>
                `;
                return;
            }

            modalMembersList.innerHTML = '';
            
            // Get member details for each membership
            for (const membershipDoc of membershipsSnapshot.docs) {
                const membership = membershipDoc.data();
                const memberDoc = await db.collection('members').doc(membership.memberId).get();
                
                if (memberDoc.exists) {
                    const member = memberDoc.data();
                    const memberElement = document.createElement('div');
                    memberElement.className = 'member-item-small';
                    memberElement.innerHTML = `
                        <div class="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>${member.name}</strong>
                                <br>
                                <small class="text-muted">${member.email}</small>
                            </div>
                            <span class="badge bg-success">Joined</span>
                        </div>
                    `;
                    modalMembersList.appendChild(memberElement);
                }
            }

        } catch (error) {
            console.error('Error loading chit members:', error);
            modalMembersList.innerHTML = `
                <div class="alert alert-danger">
                    Error loading members: ${error.message}
                </div>
            `;
        }
    }

    // Edit chit fund
    async function editChitFund(chitId) {
        try {
            const chitDoc = await db.collection('chits').doc(chitId).get();
            if (!chitDoc.exists) {
                alert('Chit fund not found');
                return;
            }

            const chit = chitDoc.data();
            
            // Populate edit form
            document.getElementById('editChitName').value = chit.name || '';
            document.getElementById('editChitCode').value = chit.chitCode || '';
            document.getElementById('editTotalAmount').value = chit.totalAmount || '';
            document.getElementById('editDuration').value = chit.duration || '';
            document.getElementById('editMonthlyAmount').value = chit.monthlyAmount || '';
            document.getElementById('editStartDate').value = chit.startDate || '';
            document.getElementById('editMaxMembers').value = chit.maxMembers || '';
            document.getElementById('editChitDescription').value = chit.description || '';
            
            // Store chit ID for update
            document.getElementById('updateChitBtn').setAttribute('data-chit-id', chitId);
            
            editChitModal.show();

        } catch (error) {
            console.error('Error editing chit fund:', error);
            alert('Error loading chit fund for editing: ' + error.message);
        }
    }

    // Update chit fund
    async function updateChitFund() {
        const chitId = document.getElementById('updateChitBtn').getAttribute('data-chit-id');
        if (!chitId) {
            alert('Chit ID not found');
            return;
        }

        const name = document.getElementById('editChitName').value;
        const chitCode = document.getElementById('editChitCode').value;
        const totalAmount = parseFloat(document.getElementById('editTotalAmount').value);
        const duration = parseInt(document.getElementById('editDuration').value);
        const monthlyAmount = parseFloat(document.getElementById('editMonthlyAmount').value);
        const startDate = document.getElementById('editStartDate').value;
        const maxMembers = parseInt(document.getElementById('editMaxMembers').value);
        const description = document.getElementById('editChitDescription').value;

        if (!name || !chitCode || !totalAmount || !duration || !monthlyAmount || !startDate || !maxMembers) {
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
                startDate: startDate,
                maxMembers: maxMembers,
                description: description,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('chits').doc(chitId).update(updateData);

            editChitModal.hide();
            showSuccess('Chit fund updated successfully!');
            
            await loadChitFunds();

        } catch (error) {
            console.error('Error updating chit fund:', error);
            alert('Error updating chit fund: ' + error.message);
        } finally {
            setLoading(document.getElementById('updateChitBtn'), false);
        }
    }

    // Delete chit fund
    async function deleteChitFund(chitId) {
        if (!confirm('Are you sure you want to delete this chit fund? This action cannot be undone.')) {
            return;
        }

        try {
            await db.collection('chits').doc(chitId).delete();
            showSuccess('Chit fund deleted successfully!');
            await loadChitFunds();
            await updateStats();
        } catch (error) {
            console.error('Error deleting chit fund:', error);
            alert('Error deleting chit fund: ' + error.message);
        }
    }

    // View member details
    async function viewMemberDetails(memberId) {
        try {
            const memberDoc = await db.collection('members').doc(memberId).get();
            if (!memberDoc.exists) {
                alert('Member not found');
                return;
            }

            const member = memberDoc.data();
            alert(`Member Details:\n\nName: ${member.name}\nEmail: ${member.email}\nPhone: ${member.phone || 'Not provided'}\nActive Chits: ${member.activeChits || 0}\nTotal Paid: ₹${member.totalPaid || 0}`);

        } catch (error) {
            console.error('Error viewing member details:', error);
            alert('Error loading member details: ' + error.message);
        }
    }

    // Edit member
    async function editMember(memberId) {
        try {
            const memberDoc = await db.collection('members').doc(memberId).get();
            if (!memberDoc.exists) {
                alert('Member not found');
                return;
            }

            const member = memberDoc.data();
            
            // Populate edit form (you'll need to create this modal)
            alert('Edit member functionality would go here for member: ' + member.name);

        } catch (error) {
            console.error('Error editing member:', error);
            alert('Error loading member for editing: ' + error.message);
        }
    }

    // Delete member
    async function deleteMember(memberId) {
        if (!confirm('Are you sure you want to delete this member?')) {
            return;
        }

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

    // View auction details
    async function viewAuctionDetails(auctionId) {
        try {
            const auctionDoc = await db.collection('auctions').doc(auctionId).get();
            if (!auctionDoc.exists) {
                alert('Auction not found');
                return;
            }

            const auction = auctionDoc.data();
            alert(`Auction Details:\n\nChit: ${auction.chitName}\nDate: ${auction.auctionDate}\nLocation: ${auction.location || 'Not specified'}\nStatus: ${auction.status}`);

        } catch (error) {
            console.error('Error viewing auction details:', error);
            alert('Error loading auction details: ' + error.message);
        }
    }

    // Show profile
    function showProfile() {
        if (!userData) return;
        
        document.getElementById('profileName').textContent = userData.name || 'Not set';
        document.getElementById('profileEmail').textContent = userData.email || 'Not set';
        document.getElementById('profilePhone').textContent = userData.phone || 'Not provided';
        document.getElementById('profileAddress').textContent = userData.address || 'Not provided';
        document.getElementById('profileRole').textContent = userData.role || 'manager';
        
        profileModal.show();
    }

    // Show edit profile
    function showEditProfile() {
        if (!userData) return;
        
        document.getElementById('editName').value = userData.name || '';
        document.getElementById('editPhone').value = userData.phone || '';
        document.getElementById('editAddress').value = userData.address || '';
        
        profileModal.hide();
        editProfileModal.show();
    }

    // Update profile
    async function updateProfile() {
        const name = document.getElementById('editName').value;
        const phone = document.getElementById('editPhone').value;
        const address = document.getElementById('editAddress').value;

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
            
            userData = { ...userData, ...updateData };
            
            editProfileModal.hide();
            showSuccess('Profile updated successfully!');
            
            updateUI();

        } catch (error) {
            console.error('Error updating profile:', error);
            alert('Error updating profile: ' + error.message);
        } finally {
            setLoading(document.getElementById('updateProfileBtn'), false);
        }
    }

    // Show schedule auction
    function showScheduleAuction() {
        // Populate chit funds dropdown
        populateChitFundsDropdown();
        scheduleAuctionModal.show();
    }

    // Populate chit funds dropdown
    async function populateChitFundsDropdown() {
        const chitSelect = document.getElementById('auctionChit');
        if (!chitSelect) return;

        try {
            const chitsSnapshot = await db.collection('chits')
                .where('managerId', '==', currentUser.uid)
                .where('status', '==', 'active')
                .get();

            chitSelect.innerHTML = '<option value="">Select Chit Fund</option>';
            
            chitsSnapshot.forEach(doc => {
                const chit = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = `${chit.name} (${chit.chitCode})`;
                chitSelect.appendChild(option);
            });

        } catch (error) {
            console.error('Error loading chit funds for dropdown:', error);
        }
    }

    // Schedule auction
    async function scheduleAuction() {
        const chitId = document.getElementById('auctionChit').value;
        const auctionDate = document.getElementById('auctionDate').value;
        const location = document.getElementById('auctionLocation').value;
        const notes = document.getElementById('auctionNotes').value;

        if (!chitId || !auctionDate) {
            alert('Please select chit fund and enter auction date');
            return;
        }

        try {
            setLoading(document.getElementById('saveAuctionBtn'), true);

            // Get chit details
            const chitDoc = await db.collection('chits').doc(chitId).get();
            if (!chitDoc.exists) {
                alert('Selected chit fund not found');
                return;
            }

            const chit = chitDoc.data();

            const auctionData = {
                chitId: chitId,
                chitName: chit.name,
                chitCode: chit.chitCode,
                auctionDate: new Date(auctionDate),
                location: location,
                notes: notes,
                managerId: currentUser.uid,
                status: 'scheduled',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
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

    // Show record payment
    function showRecordPayment() {
        populatePaymentDropdowns();
        recordPaymentModal.show();
    }

    // Populate payment dropdowns
    async function populatePaymentDropdowns() {
        const chitSelect = document.getElementById('paymentChit');
        const memberSelect = document.getElementById('paymentMember');

        if (!chitSelect || !memberSelect) return;

        try {
            // Populate chits
            const chitsSnapshot = await db.collection('chits')
                .where('managerId', '==', currentUser.uid)
                .where('status', '==', 'active')
                .get();

            chitSelect.innerHTML = '<option value="">Select Chit Fund</option>';
            chitsSnapshot.forEach(doc => {
                const chit = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = `${chit.name} (${chit.chitCode})`;
                chitSelect.appendChild(option);
            });

            // Populate members
            const membersSnapshot = await db.collection('members')
                .where('managerId', '==', currentUser.uid)
                .get();

            memberSelect.innerHTML = '<option value="">Select Member</option>';
            membersSnapshot.forEach(doc => {
                const member = doc.data();
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = `${member.name} (${member.email})`;
                memberSelect.appendChild(option);
            });

        } catch (error) {
            console.error('Error loading dropdowns:', error);
        }
    }

    // Record payment
    async function recordPayment() {
        const chitId = document.getElementById('paymentChit').value;
        const memberId = document.getElementById('paymentMember').value;
        const amount = parseFloat(document.getElementById('paymentAmount').value);
        const paymentMethod = document.getElementById('paymentMethod').value;
        const paymentDate = document.getElementById('paymentDate').value;
        const notes = document.getElementById('paymentNotes').value;

        if (!chitId || !memberId || !amount || !paymentMethod || !paymentDate) {
            alert('Please fill all required fields');
            return;
        }

        try {
            setLoading(document.getElementById('savePaymentBtn'), true);

            // Get chit and member details
            const [chitDoc, memberDoc] = await Promise.all([
                db.collection('chits').doc(chitId).get(),
                db.collection('members').doc(memberId).get()
            ]);

            if (!chitDoc.exists || !memberDoc.exists) {
                alert('Chit fund or member not found');
                return;
            }

            const chit = chitDoc.data();
            const member = memberDoc.data();

            const paymentData = {
                chitId: chitId,
                chitName: chit.name,
                chitCode: chit.chitCode,
                memberId: memberId,
                memberName: member.name,
                amount: amount,
                paymentMethod: paymentMethod,
                paymentDate: paymentDate,
                notes: notes,
                managerId: currentUser.uid,
                recordedAt: firebase.firestore.FieldValue.serverTimestamp()
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
            await loadMembers();

        } catch (error) {
            console.error('Error recording payment:', error);
            alert('Error recording payment: ' + error.message);
        } finally {
            setLoading(document.getElementById('savePaymentBtn'), false);
        }
    }

    // Show reports
    function showReports() {
        viewReportsModal.show();
        generateReports();
    }

    // Generate reports
    async function generateReports() {
        try {
            // This would generate various reports
            // For now, just show a placeholder
            const reportsContent = document.getElementById('reportsContent');
            if (reportsContent) {
                reportsContent.innerHTML = `
                    <div class="text-center py-4">
                        <i class="fas fa-chart-bar fa-3x text-primary mb-3"></i>
                        <h5>Reports Dashboard</h5>
                        <p class="text-muted">Comprehensive reports and analytics will be displayed here.</p>
                        <div class="row mt-4">
                            <div class="col-md-4">
                                <div class="card">
                                    <div class="card-body text-center">
                                        <h6>Monthly Collection</h6>
                                        <h4 class="text-success">₹0</h4>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card">
                                    <div class="card-body text-center">
                                        <h6>Pending Payments</h6>
                                        <h4 class="text-warning">0</h4>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="card">
                                    <div class="card-body text-center">
                                        <h6>Upcoming Auctions</h6>
                                        <h4 class="text-info">0</h4>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error generating reports:', error);
        }
    }

    // Export reports
    function exportReports() {
        alert('Export functionality would be implemented here');
        // This would generate and download CSV/PDF reports
    }

    // Update UI
    function updateUI() {
        if (userNameElement && userData) {
            userNameElement.textContent = userData.name || 'Manager';
        }
    }

    // Utility functions
    function setLoading(button, isLoading) {
        if (!button) return;
        
        if (isLoading) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        } else {
            button.disabled = false;
            const originalText = button.getAttribute('data-original-text') || 'Save';
            button.innerHTML = originalText;
        }
    }

    function showSuccess(message) {
        // Create a temporary success message
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-success alert-dismissible fade show position-fixed';
        alertDiv.style.cssText = 'top: 20px; right: 20px; z-index: 9999; min-width: 300px;';
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        document.body.appendChild(alertDiv);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 3000);
    }

    // Global function to refresh members (for retry button)
    window.refreshMembers = function() {
        loadMembers();
    };

    console.log('Dashboard Manager initialized successfully');
});
