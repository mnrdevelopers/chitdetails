let currentEditingPaymentId = null;

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
    const myProfileNavBtn = document.getElementById('myProfileNavBtn'); // NAV BAR LINK
    const saveProfileBtn = document.getElementById('saveProfileBtn'); // PROFILE MODAL BUTTON
    const savePayoutOrderBtn = document.getElementById('savePayoutOrderBtn'); // PAYOUT MODAL BUTTON

    // Profile Modal Inputs
    const editProfileNameInput = document.getElementById('editProfileName');
    const editProfilePhoneInput = document.getElementById('editProfilePhone');
    const editProfileEmailInput = document.getElementById('editProfileEmail');
    const editProfileRoleInput = document.getElementById('editProfileRole');

    // Modal instances
    const createChitModal = new bootstrap.Modal(document.getElementById('createChitModal'));
    const addMemberModal = new bootstrap.Modal(document.getElementById('addMemberModal'));
    const recordAuctionModal = new bootstrap.Modal(document.getElementById('recordAuctionModal'));
    const recordPaymentModal = new bootstrap.Modal(document.getElementById('recordPaymentModal'));
    const editChitModal = new bootstrap.Modal(document.getElementById('editChitModal'));
    const editProfileModal = new bootstrap.Modal(document.getElementById('editProfileModal')); // PROFILE MODAL
    const managePayoutsModal = new bootstrap.Modal(document.getElementById('managePayoutsModal')); // PAYOUT MODAL


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
                window.location.href = 'index.html'; // Redirect to index on logout
            }
        } catch (error) {
            console.error('Error in auth state change:', error);
            window.location.href = 'index.html';
        }
    });

    function setupEventListeners() {
        // Auto-calculate monthly amount
        document.getElementById('totalAmount')?.addEventListener('input', calculateMonthlyAmount);
        document.getElementById('duration')?.addEventListener('input', calculateMonthlyAmount);
        
        // Auto-generate chit code
        document.getElementById('chitName')?.addEventListener('input', generateChitCode);
        
        // Auction preview
        document.getElementById('auctionMonth')?.addEventListener('input', updateAuctionPreview);
        
        // Tab buttons
        document.getElementById('addChitBtn')?.addEventListener('click', () => createChitModal.show());
        document.getElementById('addNewMemberBtn')?.addEventListener('click', () => addMemberModal.show());
        
        // Modal button events
        document.getElementById('saveChitBtn')?.addEventListener('click', createChitFund);
        document.getElementById('saveMemberBtn')?.addEventListener('click', addMember);
        document.getElementById('saveAuctionBtn')?.addEventListener('click', recordAuction);
        document.getElementById('savePaymentBtn')?.addEventListener('click', recordPayment);
        document.getElementById('updateChitBtn')?.addEventListener('click', updateChitFund);
        document.getElementById('updateMemberBtn')?.addEventListener('click', updateMember); // Listener for dynamically created modal
        document.getElementById('updatePaymentBtn')?.addEventListener('click', updatePayment); // Listener for dynamically created modal

        // NEW: Profile & Payout Listeners
        myProfileNavBtn?.addEventListener('click', showEditProfileModal);
        saveProfileBtn?.addEventListener('click', updateProfile);
        savePayoutOrderBtn?.addEventListener('click', savePayoutOrder);
    }

    // Generate chit code automatically from chit name
    function generateChitCode() {
        const chitName = document.getElementById('chitName').value;
        if (chitName) {
            // Create code from first letters and random numbers
            const words = chitName.split(' ');
            let code = '';
            
            // Take first letter of each word (max 3 words)
            for (let i = 0; i < Math.min(words.length, 3); i++) {
                if (words[i].length > 0) {
                    code += words[i][0].toUpperCase();
                }
            }
            
            // Add random 4-digit number
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            code += randomNum;
            
            document.getElementById('chitCode').value = code;
        }
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
        await updateStats();
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

    // Render chit fund with CRUD operations
    function renderChitFund(chit) {
        const progress = calculateChitProgress(chit);
        const isFriendshipChit = chit.chitType === 'friendship';
        const chitElement = document.createElement('div');
        chitElement.className = 'chit-item';
        chitElement.innerHTML = `
            <div class="chit-header">
                <div>
                    <h4 class="chit-name">${chit.name}</h4>
                    <p class="chit-code">Code: <strong>${chit.chitCode}</strong></p>
                </div>
                <div class="chit-actions">
                    <span class="badge ${chit.status === 'active' ? 'bg-success' : 'bg-secondary'} me-1">
                        ${chit.status}
                    </span>
                    <span class="badge ${isFriendshipChit ? 'bg-info' : 'bg-warning'} me-2">
                        ${isFriendshipChit ? 'Friendship' : 'Auction'}
                    </span>
                    ${isFriendshipChit ? `
                        <button class="btn btn-sm btn-outline-info manage-payouts-btn" data-chit-id="${chit.id}" title="Manage Payout Order">
                            <i class="fas fa-list-ol me-1"></i>Payouts
                        </button>
                    ` : ''}
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
                    <span>${chit.currentMembers || 0}</span>
                </div>
            </div>
            
            <div class="progress mb-2" style="height: 8px;">
                <div class="progress-bar" style="width: ${progress.percentage}%"></div>
            </div>
            
            <div class="chit-footer">
                <span class="chit-date">Started: ${chit.startDate || 'Not set'}</span>
                <small class="text-muted">Code: ${chit.chitCode}</small>
            </div>
        `;
        
        chitFundsList.appendChild(chitElement);
        
        // Add event listeners for CRUD operations
        attachChitEventListeners(chitElement, chit);
    }

    // Attach event listeners to chit actions
    function attachChitEventListeners(element, chit) {
        const viewBtn = element.querySelector('.view-chit-btn');
        const editBtn = element.querySelector('.edit-chit-btn');
        const deleteBtn = element.querySelector('.delete-chit-btn');
        const managePayoutsBtn = element.querySelector('.manage-payouts-btn');

        viewBtn?.addEventListener('click', () => viewChitDetails(chit.id));
        editBtn?.addEventListener('click', () => editChit(chit.id));
        deleteBtn?.addEventListener('click', () => deleteChit(chit.id));
        managePayoutsBtn?.addEventListener('click', () => showManagePayoutsModal(chit.id));
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
        const isFriendshipChit = chit.chitType === 'friendship';
        
        // Load actual members for this chit
        const membershipsSnapshot = await db.collection('chitMemberships')
            .where('chitId', '==', chitId)
            .get();

        let membersHTML = `
            <div class="modal fade" id="viewChitModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Chit Details - ${chit.name}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="row">
                                <div class="col-md-6">
                                    <h6>Chit Information</h6>
                                    <div class="detail-card">
                                        <div class="detail-item">
                                            <label>Chit Type:</label>
                                            <span><strong>${isFriendshipChit ? 'Friendship' : 'Auction'}</strong></span>
                                        </div>
                                        <div class="detail-item">
                                            <label>Chit Code:</label>
                                            <span><strong>${chit.chitCode}</strong></span>
                                        </div>
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
                                            <label>Start Date:</label>
                                            <span>${chit.startDate}</span>
                                        </div>
                                        <div class="detail-item">
                                            <label>Status:</label>
                                            <span class="badge ${chit.status === 'active' ? 'bg-success' : 'bg-secondary'}">${chit.status}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="col-md-6">
                                    <div class="d-flex justify-content-between align-items-center mb-3">
                                        <h6>Members (${membershipsSnapshot.size})</h6>
                                        <button class="btn btn-sm btn-outline-primary" onclick="addMemberToChit('${chitId}')">
                                            <i class="fas fa-plus me-1"></i>Add Member
                                        </button>
                                    </div>
                                    ${isFriendshipChit ? `
                                        <div class="d-grid mb-3">
                                            <button class="btn btn-info btn-sm" onclick="window.showManagePayoutsModal('${chitId}')">
                                                <i class="fas fa-list-ol me-1"></i>Manage Payout Order
                                            </button>
                                        </div>
                                    ` : ''}
                                    <div class="members-list" style="max-height: 300px; overflow-y: auto;">
        `;

        if (membershipsSnapshot.empty) {
            membersHTML += `
                <div class="text-center py-4">
                    <i class="fas fa-users fa-2x text-muted mb-2"></i>
                    <p class="text-muted">No members joined yet</p>
                </div>
            `;
        } else {
            // Pre-fetch all member details for efficiency
            const memberIds = membershipsSnapshot.docs.map(doc => doc.data().memberId);
            const memberDetailsMap = new Map();
            
            const membersDetailsPromises = memberIds.map(async (memberId) => {
                let memberData = { name: 'Unknown Member', phone: 'Not available' };
                try {
                    const memberDoc = await db.collection('members').doc(memberId).get();
                    if (memberDoc.exists) {
                        memberData = memberDoc.data();
                    } else {
                        const userDoc = await db.collection('users').doc(memberId).get();
                        if (userDoc.exists) {
                            const userData = userDoc.data();
                            memberData = { name: userData.name || userData.email, phone: userData.phone || 'Not provided' };
                        }
                    }
                } catch (error) {
                    console.warn('Error loading member details:', error);
                }
                memberDetailsMap.set(memberId, memberData);
            });
            await Promise.all(membersDetailsPromises);


            for (const doc of membershipsSnapshot.docs) {
                const membership = doc.data();
                const memberData = memberDetailsMap.get(membership.memberId);
                const memberName = memberData?.name || 'Unknown Member';
                const memberPhone = memberData?.phone || 'Not provided';
                
                membersHTML += `
                    <div class="member-item">
                        <div class="member-header">
                            <div class="member-avatar">
                                <i class="fas fa-user"></i>
                            </div>
                            <div class="member-info">
                                <h6 class="member-name">${memberName}</h6>
                                <small class="text-muted">${memberPhone}</small>
                                <br>
                                <small class="text-muted">Joined: ${membership.joinedAt ? new Date(membership.joinedAt.seconds * 1000).toLocaleDateString() : 'Recently'}</small>
                            </div>
                        </div>
                        <div class="member-actions">
                            <button class="btn btn-sm btn-outline-danger" onclick="removeMemberFromChit('${doc.id}', '${chitId}', '${membership.memberId}')">
                                <i class="fas fa-times me-1"></i>Remove
                            </button>
                        </div>
                    </div>
                `;
            }
        }

        membersHTML += `
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" onclick="window.editChitFromView('${chitId}')">Edit Chit</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('viewChitModal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', membersHTML);
        const viewModal = new bootstrap.Modal(document.getElementById('viewChitModal'));
        viewModal.show();

    } catch (error) {
        console.error('Error loading chit details:', error);
        alert('Error loading chit details: ' + error.message);
    }
}

    // Edit chit fund
    async function editChit(chitId) {
        try {
            const chitDoc = await db.collection('chits').doc(chitId).get();
            if (!chitDoc.exists) {
                alert('Chit fund not found!');
                return;
            }

            const chit = chitDoc.data();

            // Populate edit form
            document.getElementById('editChitId').value = chitId;
            document.getElementById('editChitType').value = chit.chitType || 'auction';
            document.getElementById('editChitName').value = chit.name;
            document.getElementById('editChitCode').value = chit.chitCode;
            document.getElementById('editTotalAmount').value = chit.totalAmount;
            document.getElementById('editDuration').value = chit.duration;
            document.getElementById('editMonthlyAmount').value = chit.monthlyAmount;
            document.getElementById('editStartDate').value = chit.startDate;
            document.getElementById('editStatus').value = chit.status;

            // Close view modal if open
            const viewModal = document.getElementById('viewChitModal');
            if (viewModal) {
                const bsModal = bootstrap.Modal.getInstance(viewModal);
                if (bsModal) bsModal.hide();
            }

            editChitModal.show();

        } catch (error) {
            console.error('Error loading chit for editing:', error);
            alert('Error loading chit for editing: ' + error.message);
        }
    }

    // Update chit fund
    async function updateChitFund() {
        const chitId = document.getElementById('editChitId').value;
        const chitType = document.getElementById('editChitType').value;
        const name = document.getElementById('editChitName').value;
        const totalAmount = parseFloat(document.getElementById('editTotalAmount').value);
        const duration = parseInt(document.getElementById('editDuration').value);
        const monthlyAmount = parseFloat(document.getElementById('editMonthlyAmount').value);
        const startDate = document.getElementById('editStartDate').value;
        const status = document.getElementById('editStatus').value;

        if (!name || !totalAmount || !duration || !monthlyAmount || !startDate || !chitType) {
            alert('Please fill all required fields');
            return;
        }

        try {
            setLoading(document.getElementById('updateChitBtn'), true);

            const updateData = {
                chitType: chitType,
                name: name,
                totalAmount: totalAmount,
                duration: duration,
                monthlyAmount: monthlyAmount,
                startDate: startDate,
                status: status,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('chits').doc(chitId).update(updateData);

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

    // Delete chit fund
    async function deleteChit(chitId) {
        if (confirm('Are you sure you want to delete this chit fund? This action cannot be undone.')) {
            try {
                // Check if there are members and remove associations
                const membersSnapshot = await db.collection('chitMemberships')
                    .where('chitId', '==', chitId)
                    .get();

                if (!membersSnapshot.empty) {
                    if (!confirm('This chit fund has members. Are you sure you want to delete it? This will also remove all member associations and affect member stats.')) {
                        return;
                    }

                    // Delete all member associations and update member active chit counts
                    const updatePromises = [];
                    membersSnapshot.forEach(doc => {
                        const memberId = doc.data().memberId;
                        // Decrement activeChits count on member document (if it exists)
                        updatePromises.push(db.collection('members').doc(memberId).update({
                            activeChits: firebase.firestore.FieldValue.increment(-1)
                        }).catch(e => console.warn("Could not decrement member active chits count:", e.message)));
                        
                        // Delete membership document
                        updatePromises.push(db.collection('chitMemberships').doc(doc.id).delete());
                    });
                    
                    // Delete all payments associated with this chit
                    const paymentsSnapshot = await db.collection('payments')
                        .where('chitId', '==', chitId)
                        .get();
                    
                    paymentsSnapshot.forEach(doc => {
                        updatePromises.push(db.collection('payments').doc(doc.id).delete());
                    });

                    // Delete all auctions associated with this chit
                    const auctionsSnapshot = await db.collection('auctions')
                        .where('chitId', '==', chitId)
                        .get();

                    auctionsSnapshot.forEach(doc => {
                        updatePromises.push(db.collection('auctions').doc(doc.id).delete());
                    });
                    
                    // Delete all payout orders associated with this chit
                    const payoutsSnapshot = await db.collection('payoutOrders')
                        .where('chitId', '==', chitId)
                        .get();

                    payoutsSnapshot.forEach(doc => {
                        updatePromises.push(db.collection('payoutOrders').doc(doc.id).delete());
                    });

                    await Promise.all(updatePromises);
                }

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

    // Load members with CRUD operations (Improved to handle self-registered users)
   async function loadMembers() {
    try {
        // 1. Load all self-registered members (role: 'member')
        const usersSnapshot = await db.collection('users').where('role', '==', 'member').get();
        const memberUserIds = new Set();
        const memberDataToSync = [];
        
        usersSnapshot.forEach(doc => {
            const user = doc.data();
            const memberId = doc.id;
            memberUserIds.add(memberId);
            memberDataToSync.push({
                id: memberId,
                name: user.name || user.email,
                email: user.email,
                phone: user.phone || 'Not provided',
                joinedAt: user.createdAt,
                // These stats are usually calculated and stored in the 'members' collection
                activeChits: user.activeChits || 0,
                totalPaid: user.totalPaid || 0,
                status: 'active'
            });
        });

        // 2. Load members manually created by this manager (if any)
        const membersSnapshot = await db.collection('members')
            .where('managerId', '==', currentUser.uid)
            .get();

        // Map to hold final member data, keyed by member ID
        const finalMembersMap = new Map();

        // Prioritize manually created member data (as manager may have updated info)
        membersSnapshot.forEach(doc => {
            const member = { id: doc.id, ...doc.data() };
            finalMembersMap.set(member.id, member);
        });
        
        // Add self-registered users who are not already in the manager's member list
        const syncPromises = [];
        memberDataToSync.forEach(member => {
            // Check if user is associated with any of the manager's chits
            // This is a simplified check. A proper check would be to see if they are in 'chitMemberships'
            
            // For now, if they are self-registered and not managed yet, add them.
            if (!finalMembersMap.has(member.id)) {
                
                // Create a record in the 'members' collection for the manager to track them
                const memberRecord = {
                    ...member,
                    managerId: currentUser.uid,
                    // Remove redundant fields
                    id: undefined,
                    email: undefined,
                };
                
                // Use member.id (which is user.uid) as the document ID
                syncPromises.push(db.collection('members').doc(member.id).set(memberRecord, { merge: true }));
                finalMembersMap.set(member.id, { ...member, managerId: currentUser.uid });
            }
        });
        
        // Wait for all synchronization writes to complete
        await Promise.all(syncPromises);

        membersList.innerHTML = '';

        if (finalMembersMap.size === 0) {
            membersList.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-users fa-3x text-muted mb-3"></i>
                    <h5 class="text-muted">No Members Found</h5>
                    <p class="text-muted">Add members to your chit funds or wait for registered users to join</p>
                </div>
            `;
            return;
        }

        // Render all members (sorted by join date)
        Array.from(finalMembersMap.values())
            .sort((a, b) => (b.joinedAt?.seconds || 0) - (a.joinedAt?.seconds || 0))
            .forEach(member => {
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

    // Render member with CRUD operations
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
                        <i class="fas fa-phone me-1"></i>${member.phone || 'Not provided'}
                    </p>
                    <small class="text-muted">ID: ${member.id}</small>
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
        
        // Add event listeners
        attachMemberEventListeners(memberElement, member);
    }

    // Attach event listeners to member actions
    function attachMemberEventListeners(element, member) {
        const viewBtn = element.querySelector('.view-member-btn');
        const editBtn = element.querySelector('.edit-member-btn');
        const deleteBtn = element.querySelector('.delete-member-btn');

        viewBtn?.addEventListener('click', () => viewMemberDetails(member.id));
        editBtn?.addEventListener('click', () => editMember(member.id));
        deleteBtn?.addEventListener('click', () => deleteMember(member.id));
    }

    // View member details - (Function body remains the same as previous step, ensuring member data fetching is robust)
    async function viewMemberDetails(memberId) {
        try {
            const memberDoc = await db.collection('members').doc(memberId).get();
            if (!memberDoc.exists) {
                alert('Member not found!');
                return;
            }

            const member = memberDoc.data();
            
            // Load member's chit funds
            const membershipsSnapshot = await db.collection('chitMemberships')
                .where('memberId', '==', memberId)
                .get();

            let memberHTML = `
                <div class="modal fade" id="viewMemberModal" tabindex="-1">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Member Details - ${member.name}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <div class="row">
                                    <div class="col-md-6">
                                        <h6>Personal Information</h6>
                                        <div class="detail-card">
                                            <div class="detail-item">
                                                <label>Name:</label>
                                                <span>${member.name}</span>
                                            </div>
                                            <div class="detail-item">
                                                <label>Phone:</label>
                                                <span>${member.phone}</span>
                                            </div>
                                            <div class="detail-item">
                                                <label>Joined Date:</label>
                                                <span>${member.joinedAt ? new Date(member.joinedAt.seconds * 1000).toLocaleDateString() : 'Recently'}</span>
                                            </div>
                                            <div class="detail-item">
                                                <label>Total Paid:</label>
                                                <span>₹${(member.totalPaid || 0).toLocaleString()}</span>
                                            </div>
                                            <div class="detail-item">
                                                <label>Status:</label>
                                                <span class="badge ${member.status === 'active' ? 'bg-success' : 'bg-secondary'}">${member.status}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="col-md-6">
                                        <h6>Chit Funds (${membershipsSnapshot.size})</h6>
                                        <div class="chit-list" style="max-height: 300px; overflow-y: auto;">
            `;

            if (membershipsSnapshot.empty) {
                memberHTML += `<p class="text-muted">Not joined any chit funds yet</p>`;
            } else {
                for (const doc of membershipsSnapshot.docs) {
                    const membership = doc.data();
                    const chitDoc = await db.collection('chits').doc(membership.chitId).get();
                    if (chitDoc.exists) {
                        const chit = chitDoc.data();
                        memberHTML += `
                            <div class="chit-item">
                                <h6>${chit.name}</h6>
                                <small class="text-muted">Code: ${chit.chitCode} | Monthly: ₹${chit.monthlyAmount}</small>
                            </div>
                        `;
                    }
                }
            }

            memberHTML += `
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                                <button type="button" class="btn btn-primary" onclick="window.editMemberFromView('${memberId}')">Edit Member</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Remove existing modal if any
            const existingModal = document.getElementById('viewMemberModal');
            if (existingModal) {
                existingModal.remove();
            }

            document.body.insertAdjacentHTML('beforeend', memberHTML);
            const viewModal = new bootstrap.Modal(document.getElementById('viewMemberModal'));
            viewModal.show();

        } catch (error) {
            console.error('Error loading member details:', error);
            alert('Error loading member details: ' + error.message);
        }
    }

    // Edit member - (Function body remains the same, ensuring dynamic modal creation)
    async function editMember(memberId) {
        try {
            const memberDoc = await db.collection('members').doc(memberId).get();
            if (!memberDoc.exists) {
                alert('Member not found!');
                return;
            }

            const member = memberDoc.data();

            // Create edit modal HTML
            const editModalHTML = `
                <div class="modal fade" id="editMemberModal" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Edit Member</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <form id="editMemberForm">
                                    <input type="hidden" id="editMemberId" value="${memberId}">
                                    <div class="mb-3">
                                        <label for="editMemberName" class="form-label">Full Name *</label>
                                        <input type="text" class="form-control" id="editMemberName" value="${member.name}" required>
                                    </div>
                                    <div class="mb-3">
                                        <label for="editMemberPhone" class="form-label">Phone Number *</label>
                                        <input type="tel" class="form-control" id="editMemberPhone" value="${member.phone || ''}" required>
                                    </div>
                                    <div class="mb-3">
                                        <label for="editMemberStatus" class="form-label">Status</label>
                                        <select class="form-select" id="editMemberStatus">
                                            <option value="active" ${member.status === 'active' ? 'selected' : ''}>Active</option>
                                            <option value="inactive" ${member.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                                        </select>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                                <button type="button" class="btn btn-primary" id="updateMemberBtn">Update Member</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Remove existing modal if any
            const existingModal = document.getElementById('editMemberModal');
            if (existingModal) {
                existingModal.remove();
            }

            document.body.insertAdjacentHTML('beforeend', editModalHTML);
            
            // Add event listener for update button
            document.getElementById('updateMemberBtn').addEventListener('click', () => updateMember(memberId));
            
            const editModal = new bootstrap.Modal(document.getElementById('editMemberModal'));
            editModal.show();

            // Close view modal if open
            const viewModal = document.getElementById('viewMemberModal');
            if (viewModal) {
                const bsModal = bootstrap.Modal.getInstance(viewModal);
                if (bsModal) bsModal.hide();
            }

        } catch (error) {
            console.error('Error loading member for editing:', error);
            alert('Error loading member for editing: ' + error.message);
        }
    }

    // Update member
    async function updateMember(memberId) {
        const name = document.getElementById('editMemberName').value;
        const phone = document.getElementById('editMemberPhone').value;
        const status = document.getElementById('editMemberStatus').value;

        if (!name || !phone) {
            alert('Please fill all required fields');
            return;
        }

        try {
            setLoading(document.getElementById('updateMemberBtn'), true, 'Update Member');

            const updateData = {
                name: name,
                phone: phone,
                status: status,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('members').doc(memberId).update(updateData);
            
            // If the member is a self-registered user (doc ID matches user.uid), update the users collection too
            if (memberId === currentUser.uid) { 
                await db.collection('users').doc(memberId).update(updateData);
            }

            // Close modal
            const editModal = document.getElementById('editMemberModal');
            const bsModal = bootstrap.Modal.getInstance(editModal);
            bsModal.hide();

            showSuccess('Member updated successfully!');
            await loadMembers();

        } catch (error) {
            console.error('Error updating member:', error);
            alert('Error updating member: ' + error.message);
        } finally {
            setLoading(document.getElementById('updateMemberBtn'), false, 'Update Member');
        }
    }

    // Delete member
    async function deleteMember(memberId) {
        if (confirm('Are you sure you want to delete this member? This action cannot be undone.')) {
            try {
                // Collect promises for batch deletion
                const deletePromises = [];
                
                // 1. Get payments for this member to update member's totalPaid stat (though not strictly necessary as member doc is deleted)
                // We mainly do this to clean up the 'payments' collection
                const paymentsSnapshot = await db.collection('payments')
                    .where('memberId', '==', memberId)
                    .where('managerId', '==', currentUser.uid)
                    .get();

                paymentsSnapshot.forEach(doc => {
                    deletePromises.push(db.collection('payments').doc(doc.id).delete());
                });

                // 2. Get memberships for this member to update chit counts
                const membershipsSnapshot = await db.collection('chitMemberships')
                    .where('memberId', '==', memberId)
                    .get();
                
                membershipsSnapshot.forEach(doc => {
                    const membership = doc.data();
                    const chitId = membership.chitId;
                    
                    // Decrement currentMembers count on the chit document
                    deletePromises.push(db.collection('chits').doc(chitId).update({
                        currentMembers: firebase.firestore.FieldValue.increment(-1)
                    }));
                    
                    // Delete the membership document
                    deletePromises.push(db.collection('chitMemberships').doc(doc.id).delete());
                });

                // 3. Delete the member document itself (from manager's tracking collection)
                deletePromises.push(db.collection('members').doc(memberId).delete());
                
                // 4. Delete PayoutOrders associated with this member (if any)
                const payoutsSnapshot = await db.collection('payoutOrders')
                    .where('memberId', '==', memberId)
                    .get();
                payoutsSnapshot.forEach(doc => {
                    deletePromises.push(db.collection('payoutOrders').doc(doc.id).delete());
                });

                // Execute all deletions/updates
                await Promise.all(deletePromises);

                showSuccess('Member and all associated data deleted successfully!');
                await loadMembers();
                await updateStats();

            } catch (error) {
                console.error('Error deleting member:', error);
                alert('Error deleting member: ' + error.message);
            }
        }
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
        
        // Add summary card
        let totalAmount = 0;
        paymentsSnapshot.forEach(doc => {
            totalAmount += doc.data().amount || 0;
        });

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
        
        paymentsList.innerHTML = summaryHTML;

        // Render payment items
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
        <div class="payment-actions mt-2">
            <button class="btn btn-sm btn-outline-primary view-payment-btn" data-payment-id="${payment.id}">
                <i class="fas fa-eye me-1"></i>View
            </button>
            <button class="btn btn-sm btn-outline-warning edit-payment-btn" data-payment-id="${payment.id}">
                <i class="fas fa-edit me-1"></i>Edit
            </button>
            <button class="btn btn-sm btn-outline-danger delete-payment-btn" data-payment-id="${payment.id}">
                <i class="fas fa-trash me-1"></i>Delete
            </button>
        </div>
    `;
    
    paymentsList.appendChild(paymentElement);
    
    // Add event listeners
    attachPaymentEventListeners(paymentElement, payment);
}
    // Attach event listeners to payment actions
function attachPaymentEventListeners(element, payment) {
    const viewBtn = element.querySelector('.view-payment-btn');
    const editBtn = element.querySelector('.edit-payment-btn');
    const deleteBtn = element.querySelector('.delete-payment-btn');

    viewBtn?.addEventListener('click', () => viewPaymentDetails(payment.id));
    editBtn?.addEventListener('click', () => editPayment(payment.id));
    deleteBtn?.addEventListener('click', () => deletePayment(payment.id));
}

    // View payment details - (Function body remains the same)
async function viewPaymentDetails(paymentId) {
    try {
        const paymentDoc = await db.collection('payments').doc(paymentId).get();
        if (!paymentDoc.exists) {
            alert('Payment not found!');
            return;
        }

        const payment = paymentDoc.data();

        const viewHTML = `
            <div class="modal fade" id="viewPaymentModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Payment Details</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="detail-card">
                                <div class="detail-item">
                                    <label>Member:</label>
                                    <span>${payment.memberName}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Chit Fund:</label>
                                    <span>${payment.chitName}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Month:</label>
                                    <span>${payment.month}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Amount:</label>
                                    <span class="text-success">₹${payment.amount?.toLocaleString()}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Payment Date:</label>
                                    <span>${payment.paymentDate}</span>
                                </div>
                                <div class="detail-item">
                                    <label>Recorded On:</label>
                                    <span>${payment.createdAt ? new Date(payment.createdAt.seconds * 1000).toLocaleDateString() : 'Unknown'}</span>
                                </div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                            <button type="button" class="btn btn-primary" onclick="window.editPaymentFromView('${paymentId}')">Edit Payment</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('viewPaymentModal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', viewHTML);
        const viewModal = new bootstrap.Modal(document.getElementById('viewPaymentModal'));
        viewModal.show();

    } catch (error) {
        console.error('Error loading payment details:', error);
        alert('Error loading payment details: ' + error.message);
    }
}

    // Edit payment - (Function body remains the same)
async function editPayment(paymentId) {
    try {
        const paymentDoc = await db.collection('payments').doc(paymentId).get();
        if (!paymentDoc.exists) {
            alert('Payment not found!');
            return;
        }

        const payment = paymentDoc.data();
        currentEditingPaymentId = paymentId;

        // Load current chits and members for dropdowns
        const [chitsSnapshot, membersSnapshot] = await Promise.all([
            db.collection('chits').where('managerId', '==', currentUser.uid).get(),
            db.collection('members').where('managerId', '==', currentUser.uid).get()
        ]);

        let chitOptions = '';
        let memberOptions = '';

        chitsSnapshot.forEach(doc => {
            const chit = doc.data();
            chitOptions += `<option value="${doc.id}" ${doc.id === payment.chitId ? 'selected' : ''}>${chit.name}</option>`;
        });

        membersSnapshot.forEach(doc => {
            const member = doc.data();
            memberOptions += `<option value="${doc.id}" ${doc.id === payment.memberId ? 'selected' : ''}>${member.name} (${member.phone || 'N/A'})</option>`;
        });

        const editHTML = `
            <div class="modal fade" id="editPaymentModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Edit Payment</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="editPaymentForm">
                                <div class="mb-3">
                                    <label for="editPaymentMember" class="form-label">Member *</label>
                                    <select class="form-select" id="editPaymentMember" required>
                                        <option value="">Select member...</option>
                                        ${memberOptions}
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label for="editPaymentChit" class="form-label">Chit Fund *</label>
                                    <select class="form-select" id="editPaymentChit" required>
                                        <option value="">Select chit fund...</option>
                                        ${chitOptions}
                                    </select>
                                </div>
                                <div class="mb-3">
                                    <label for="editPaymentMonth" class="form-label">Month *</label>
                                    <input type="number" class="form-control" id="editPaymentMonth" value="${payment.month}" required>
                                </div>
                                <div class="mb-3">
                                    <label for="editPaymentAmount" class="form-label">Amount *</label>
                                    <input type="number" class="form-control" id="editPaymentAmount" value="${payment.amount}" required>
                                </div>
                                <div class="mb-3">
                                    <label for="editPaymentDate" class="form-label">Payment Date *</label>
                                    <input type="date" class="form-control" id="editPaymentDate" value="${payment.paymentDate}" required>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="updatePaymentBtn">Update Payment</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('editPaymentModal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', editHTML);
        
        // Add event listener
        document.getElementById('updatePaymentBtn').addEventListener('click', updatePayment);
        
        const editModal = new bootstrap.Modal(document.getElementById('editPaymentModal'));
        editModal.show();

        // Close view modal if open
        const viewModal = document.getElementById('viewPaymentModal');
        if (viewModal) {
            const bsModal = bootstrap.Modal.getInstance(viewModal);
            if (bsModal) bsModal.hide();
        }

    } catch (error) {
        console.error('Error loading payment for editing:', error);
        alert('Error loading payment for editing: ' + error.message);
    }
}

    // Update payment
async function updatePayment() {
    const memberId = document.getElementById('editPaymentMember').value;
    const chitId = document.getElementById('editPaymentChit').value;
    const month = parseInt(document.getElementById('editPaymentMonth').value);
    const amount = parseFloat(document.getElementById('editPaymentAmount').value);
    const paymentDate = document.getElementById('editPaymentDate').value;

    if (!memberId || !chitId || !month || !amount || !paymentDate) {
        alert('Please fill all required fields');
        return;
    }

    try {
        setLoading(document.getElementById('updatePaymentBtn'), true, 'Update Payment');

        // Get current payment data to calculate difference
        const currentPaymentDoc = await db.collection('payments').doc(currentEditingPaymentId).get();
        if (!currentPaymentDoc.exists) {
            alert('Payment not found!');
            return;
        }

        const currentPayment = currentPaymentDoc.data();
        const amountDifference = amount - currentPayment.amount;

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

        const updateData = {
            memberId: memberId,
            memberName: member.name,
            chitId: chitId,
            chitName: chit.name,
            month: month,
            amount: amount,
            paymentDate: paymentDate,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('payments').doc(currentEditingPaymentId).update(updateData);

        // Update member's total paid if amount changed and member doc exists
        if (amountDifference !== 0) {
            // Note: Update logic is simplified here. A proper implementation would recalculate totalPaid 
            // from all payments if the memberId changes, but for simplicity, we rely on increment/decrement.
            if (currentPayment.memberId === memberId) {
                 // Same member, just update
                await db.collection('members').doc(memberId).update({
                    totalPaid: firebase.firestore.FieldValue.increment(amountDifference)
                });
            } else {
                // Member changed: Decrement old member, Increment new member
                await db.collection('members').doc(currentPayment.memberId).update({
                    totalPaid: firebase.firestore.FieldValue.increment(-currentPayment.amount)
                });
                await db.collection('members').doc(memberId).update({
                    totalPaid: firebase.firestore.FieldValue.increment(amount)
                });
            }
            
        }

        // Close modal
        const editModal = document.getElementById('editPaymentModal');
        const bsModal = bootstrap.Modal.getInstance(editModal);
        bsModal.hide();

        showSuccess('Payment updated successfully!');
        await loadPayments();
        await updateStats();

    } catch (error) {
        console.error('Error updating payment:', error);
        alert('Error updating payment: ' + error.message);
    } finally {
        setLoading(document.getElementById('updatePaymentBtn'), false, 'Update Payment');
        currentEditingPaymentId = null;
    }
}

// Delete payment
async function deletePayment(paymentId) {
    if (!confirm('Are you sure you want to delete this payment record? This action cannot be undone.')) {
        return;
    }

    try {
        // Get payment details to update member's total paid
        const paymentDoc = await db.collection('payments').doc(paymentId).get();
        if (!paymentDoc.exists) {
            alert('Payment not found!');
            return;
        }

        const payment = paymentDoc.data();

        // Delete the payment
        await db.collection('payments').doc(paymentId).delete();

        // Update member's total paid
        if (payment.memberId) {
            const memberDoc = await db.collection('members').doc(payment.memberId).get();
            if (memberDoc.exists) {
                await db.collection('members').doc(payment.memberId).update({
                    totalPaid: firebase.firestore.FieldValue.increment(-payment.amount)
                });
            }
        }

        showSuccess('Payment deleted successfully!');
        await loadPayments();
        await updateStats();

    } catch (error) {
        console.error('Error deleting payment:', error);
        alert('Error deleting payment: ' + error.message);
    }
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

            // Calculate Total Revenue (Actual Collection)
            const paymentsSnapshot = await db.collection('payments')
                .where('managerId', '==', currentUser.uid)
                .get();
            let totalCollection = 0;
            paymentsSnapshot.forEach(doc => {
                totalCollection += doc.data().amount || 0;
            });
            totalCollectionElement.textContent = `₹${totalCollection.toLocaleString()}`;

            // Count auctions done
            const auctionsSnapshot = await db.collection('auctions')
                .where('managerId', '==', currentUser.uid)
                .get();
            auctionsDoneElement.textContent = auctionsSnapshot.size;
            
            // Check if there are ANY Auction chits to determine if recordAuctionBtn should be enabled
            const auctionChitsSnapshot = await db.collection('chits')
                .where('managerId', '==', currentUser.uid)
                .where('chitType', '==', 'auction')
                .where('status', '==', 'active')
                .limit(1)
                .get();

            recordAuctionBtn.disabled = auctionChitsSnapshot.empty;
            
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
        if (!recordAuctionBtn.disabled) {
            await showRecordAuctionModal();
        }
    });

    recordPaymentBtn.addEventListener('click', async () => {
        await showRecordPaymentModal();
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            await auth.signOut();
            window.location.href = 'index.html'; // Redirect to index on logout
        } catch (error) {
            console.error('Logout error:', error);
        }
    });

    // Create chit fund
    async function createChitFund() {
        const chitType = document.getElementById('chitType').value;
        const name = document.getElementById('chitName').value;
        const chitCode = document.getElementById('chitCode').value;
        const totalAmount = parseFloat(document.getElementById('totalAmount').value);
        const duration = parseInt(document.getElementById('duration').value);

        if (!name || !chitCode || !totalAmount || !duration || !chitType) {
            alert('Please fill all required fields');
            return;
        }

        const monthlyAmount = totalAmount / duration;

        try {
            setLoading(document.getElementById('saveChitBtn'), true, 'Create Chit Fund');

            // Check if chit code already exists
            const existingChit = await db.collection('chits')
                .where('chitCode', '==', chitCode)
                .get();

            if (!existingChit.empty) {
                alert('Chit code already exists. Please use a different code.');
                return;
            }

            const chitData = {
                chitType: chitType,
                name: name,
                chitCode: chitCode,
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
            document.getElementById('monthlyAmountDisplay').textContent = '₹0';
            createChitModal.hide();
            
            showSuccess('Chit fund created successfully! Members can join using code: ' + chitCode);
            
            await loadChitFunds();
            await updateStats();

        } catch (error) {
            console.error('Error creating chit fund:', error);
            alert('Error creating chit fund: ' + error.message);
        } finally {
            setLoading(document.getElementById('saveChitBtn'), false, 'Create Chit Fund');
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
            setLoading(document.getElementById('saveMemberBtn'), true, 'Add Member');

            const memberData = {
                name: name,
                phone: phone,
                managerId: currentUser.uid,
                activeChits: 0,
                totalPaid: 0,
                status: 'active',
                joinedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Add member to manager's tracking collection ('members')
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
            setLoading(document.getElementById('saveMemberBtn'), false, 'Add Member');
        }
    }

    // Show record auction modal
    async function showRecordAuctionModal() {
        try {
            // Load only Auction chits
            const [chitsSnapshot, membersSnapshot] = await Promise.all([
                db.collection('chits')
                    .where('managerId', '==', currentUser.uid)
                    .where('chitType', '==', 'auction')
                    .where('status', '==', 'active').get(),
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
                option.textContent = `${member.name} (${member.phone || 'N/A'})`;
                auctionMemberSelect.appendChild(option);
            });
            
            if (chitsSnapshot.empty) {
                alert("You must have at least one active 'Auction' type chit fund to record an auction.");
                return;
            }

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
            setLoading(document.getElementById('saveAuctionBtn'), true, 'Record Auction');

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
            
            // Check if member is part of this chit
            const membershipSnapshot = await db.collection('chitMemberships')
                .where('chitId', '==', chitId)
                .where('memberId', '==', memberId)
                .get();
                
            if (membershipSnapshot.empty) {
                alert("The selected member is not a part of this chit fund.");
                return;
            }


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

            // Update member's active chits count (NOTE: This should only increment if they weren't already active)
            // Since we are not tracking payout status month by month here, we rely on the member doc to track chits joined.
            // The activeChits count is updated when the member joins/is removed from the chit in other functions.

            document.getElementById('recordAuctionForm').reset();
            recordAuctionModal.hide();
            
            showSuccess('Auction recorded successfully!');
            
            await updateStats();

        } catch (error) {
            console.error('Error recording auction:', error);
            alert('Error recording auction: ' + error.message);
        } finally {
            setLoading(document.getElementById('saveAuctionBtn'), false, 'Record Auction');
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
                option.textContent = `${member.name} (${member.phone || 'N/A'})`;
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
            setLoading(document.getElementById('savePaymentBtn'), true, 'Record Payment');

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
                totalPaid: firebase.firestore.FieldValue.increment(amount)
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
            setLoading(document.getElementById('savePaymentBtn'), false, 'Record Payment');
        }
    }

    // NEW: Show Edit Profile Modal
    function showEditProfileModal() {
        if (!userData) {
            alert('User data not loaded. Please try again.');
            return;
        }
        
        // Populate modal inputs
        editProfileNameInput.value = userData.name || '';
        editProfilePhoneInput.value = userData.phone || '';
        editProfileEmailInput.value = userData.email || currentUser.email || '';
        editProfileRoleInput.value = (userData.role || 'Manager').charAt(0).toUpperCase() + (userData.role || 'Manager').slice(1);

        editProfileModal.show();
    }
    
    // NEW: Update Profile Function
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
            
            // 2. Update the manager's specific member record (if the manager is also tracked as a member)
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

    // NEW: Show Manage Payouts Modal (Friendship Chits)
    async function showManagePayoutsModal(chitId) {
        try {
            const chitDoc = await db.collection('chits').doc(chitId).get();
            if (!chitDoc.exists) {
                alert('Chit fund not found!');
                return;
            }

            const chit = chitDoc.data();
            document.getElementById('payoutChitId').value = chitId;
            document.getElementById('managePayoutsModal').querySelector('.modal-title').textContent = `Manage Payout Order - ${chit.name}`;
            document.getElementById('payoutDuration').textContent = chit.duration;

            // 1. Get all approved members for this chit
            const membershipsSnapshot = await db.collection('chitMemberships')
                .where('chitId', '==', chitId)
                .where('status', '==', 'approved')
                .get();
                
            const memberIds = membershipsSnapshot.docs.map(doc => doc.data().memberId);
            const memberDetailsMap = new Map();
            
            // Pre-fetch member details
            for (const memberId of memberIds) {
                const memberDoc = await db.collection('members').doc(memberId).get();
                if (memberDoc.exists) {
                    memberDetailsMap.set(memberId, memberDoc.data());
                } else {
                    const userDoc = await db.collection('users').doc(memberId).get();
                    if (userDoc.exists) {
                        memberDetailsMap.set(memberId, userDoc.data());
                    }
                }
            }

            // 2. Get existing payout order
            const payoutDoc = await db.collection('payoutOrders').doc(chitId).get();
            let payoutOrder = payoutDoc.exists ? payoutDoc.data().order : [];
            
            // 3. Initialize or clean up payout order
            const currentMemberIds = new Set(memberIds);
            const validPayoutOrder = [];
            
            // Add existing members from the order first
            for (const item of payoutOrder) {
                if (currentMemberIds.has(item.memberId)) {
                    validPayoutOrder.push(item.memberId);
                    currentMemberIds.delete(item.memberId);
                }
            }
            
            // Add any new members (those left in currentMemberIds) to the end
            currentMemberIds.forEach(memberId => validPayoutOrder.push(memberId));
            
            // 4. Render the list
            const payoutOrderList = document.getElementById('payoutOrderList');
            payoutOrderList.innerHTML = '';
            document.getElementById('payoutMemberCount').textContent = validPayoutOrder.length;
            
            validPayoutOrder.forEach((memberId, index) => {
                const member = memberDetailsMap.get(memberId);
                const listItem = document.createElement('div');
                listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
                listItem.setAttribute('data-member-id', memberId);
                listItem.innerHTML = `
                    <span class="badge bg-dark rounded-pill me-3">${index + 1}</span>
                    <i class="fas fa-arrows-alt-v me-3 text-muted" style="cursor: move;"></i>
                    <span class="flex-grow-1">${member?.name || 'Unknown Member'} (${memberId})</span>
                `;
                payoutOrderList.appendChild(listItem);
            });
            
            // Initialize Sortable.js
            if (!window.sortableInstance) {
                window.sortableInstance = new Sortable(payoutOrderList, {
                    animation: 150,
                    handle: '.fa-arrows-alt-v'
                });
            } else {
                 // Update the existing instance's element if necessary
                window.sortableInstance.option('el', payoutOrderList);
            }

            // Show modal
            managePayoutsModal.show();

        } catch (error) {
            console.error('Error loading payout order:', error);
            alert('Error loading payout order: ' + error.message);
        }
    }
    
    // NEW: Save Payout Order
    async function savePayoutOrder() {
        const chitId = document.getElementById('payoutChitId').value;
        const payoutOrderList = document.getElementById('payoutOrderList');
        const payoutError = document.getElementById('payoutOrderError');
        payoutError.textContent = '';
        
        if (!chitId) {
            payoutError.textContent = 'Error: Chit ID is missing.';
            return;
        }

        const listItems = Array.from(payoutOrderList.children);
        const newOrder = listItems.map((item, index) => ({
            month: index + 1,
            memberId: item.getAttribute('data-member-id')
        }));
        
        if (newOrder.length === 0) {
            payoutError.textContent = 'The payout list cannot be empty.';
            return;
        }

        try {
            setLoading(savePayoutOrderBtn, true, 'Save Payout Order');

            const orderData = {
                chitId: chitId,
                managerId: currentUser.uid,
                order: newOrder,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Use chitId as the document ID for easy lookup
            await db.collection('payoutOrders').doc(chitId).set(orderData);

            managePayoutsModal.hide();
            showSuccess('Payout order saved successfully!');

        } catch (error) {
            console.error('Error saving payout order:', error);
            payoutError.textContent = 'Error saving order: ' + error.message;
        } finally {
            setLoading(savePayoutOrderBtn, false, 'Save Payout Order');
        }
    }


    // Update UI
    function updateUI() {
        if (userData) {
            userNameElement.textContent = userData.name || 'Manager';
        }
    }

    // Set loading state
    function setLoading(button, isLoading, originalText = 'Processing...') {
        if (!button) return;
        
        if (isLoading) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';
        } else {
            button.disabled = false;
            // Restore original text based on button ID or provided text
            if (button.id === 'saveChitBtn') {
                button.innerHTML = 'Create Chit Fund';
            } else if (button.id === 'saveMemberBtn') {
                button.innerHTML = 'Add Member';
            } else if (button.id === 'saveAuctionBtn') {
                button.innerHTML = 'Record Auction';
            } else if (button.id === 'savePaymentBtn') {
                button.innerHTML = 'Record Payment';
            } else if (button.id === 'updateChitBtn') {
                button.innerHTML = 'Update Chit Fund';
            } else {
                button.innerHTML = originalText;
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

    // Global functions for modal buttons
    window.editChitFromView = function(chitId) {
        const viewModal = document.getElementById('viewChitModal');
        if (viewModal) {
            const bsModal = bootstrap.Modal.getInstance(viewModal);
            if (bsModal) bsModal.hide();
        }
        editChit(chitId);
    };

    window.editMemberFromView = function(memberId) {
        const viewModal = document.getElementById('viewMemberModal');
        if (viewModal) {
            const bsModal = bootstrap.Modal.getInstance(viewModal);
            if (bsModal) bsModal.hide();
        }
        editMember(memberId);
    };

    window.editPaymentFromView = function(paymentId) {
        const viewModal = document.getElementById('viewPaymentModal');
        if (viewModal) {
            const bsModal = bootstrap.Modal.getInstance(viewModal);
            if (bsModal) bsModal.hide();
        }
        editPayment(paymentId);
    };
    
    window.showManagePayoutsModal = showManagePayoutsModal;

});

// Add member to chit function
async function addMemberToChit(chitId) {
    // Current user and db references (re-established globally/in scope)
    const auth = firebase.auth();
    const db = firebase.firestore();
    const currentUser = auth.currentUser;
    if (!currentUser) return; // Should not happen but good guard

    try {
        // Load all available members
        const [membersSnapshot, chitDoc] = await Promise.all([
            db.collection('members').where('managerId', '==', currentUser.uid).get(),
            db.collection('chits').doc(chitId).get()
        ]);

        if (!chitDoc.exists) {
            alert('Chit fund not found!');
            return;
        }

        const chit = chitDoc.data();
        
        // Get current members to exclude already joined ones
        const currentMembersSnapshot = await db.collection('chitMemberships')
            .where('chitId', '==', chitId)
            .get();

        const currentMemberIds = new Set();
        currentMembersSnapshot.forEach(doc => {
            currentMemberIds.add(doc.data().memberId);
        });

        let memberOptionsHTML = '<option value="">Select a member to add...</option>';
        membersSnapshot.forEach(doc => {
            const member = doc.data();
            if (!currentMemberIds.has(doc.id)) {
                memberOptionsHTML += `<option value="${doc.id}">${member.name} (${member.phone || 'N/A'})</option>`;
            }
        });
        
        if (memberOptionsHTML.length === 0) {
            alert('All available members are already joined to this chit fund.');
            return;
        }

        const addMemberHTML = `
            <div class="modal fade" id="addMemberToChitModal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Add Member to ${chit.name}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label for="selectMemberToAdd" class="form-label">Select Member</label>
                                <select class="form-select" id="selectMemberToAdd">
                                    ${memberOptionsHTML}
                                </select>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="confirmAddMemberBtn">Add Member</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Remove existing modal if any
        const existingModal = document.getElementById('addMemberToChitModal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', addMemberHTML);
        
        // Add event listener
        document.getElementById('confirmAddMemberBtn').addEventListener('click', async () => {
            await confirmAddMemberToChit(chitId);
        });

        const addMemberModal = new bootstrap.Modal(document.getElementById('addMemberToChitModal'));
        addMemberModal.show();

    } catch (error) {
        console.error('Error loading members for chit:', error);
        alert('Error loading members: ' + error.message);
    }
}

// Confirm add member to chit
async function confirmAddMemberToChit(chitId) {
    const memberId = document.getElementById('selectMemberToAdd').value;
    
    if (!memberId) {
        alert('Please select a member');
        return;
    }
    
    // Current user and db references (re-established globally/in scope)
    const auth = firebase.auth();
    const db = firebase.firestore();
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    const confirmBtn = document.getElementById('confirmAddMemberBtn');
    
    try {
        // Set loading state
        const originalText = confirmBtn.textContent;
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';

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

        const membershipData = {
            chitId: chitId,
            memberId: memberId,
            chitName: chit.name,
            chitCode: chit.chitCode,
            memberName: member.name,
            managerId: currentUser.uid,
            joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'approved',
            totalPaid: 0
        };

        await db.collection('chitMemberships').add(membershipData);

        // Update chit member count
        await db.collection('chits').doc(chitId).update({
            currentMembers: firebase.firestore.FieldValue.increment(1)
        });

        // Update member's active chits count
        await db.collection('members').doc(memberId).update({
            activeChits: firebase.firestore.FieldValue.increment(1)
        });

        // Close modals
        const addMemberModal = document.getElementById('addMemberToChitModal');
        const bsAddModal = bootstrap.Modal.getInstance(addMemberModal);
        if (bsAddModal) bsAddModal.hide();

        const viewModal = document.getElementById('viewChitModal');
        const bsViewModal = bootstrap.Modal.getInstance(viewModal);
        if (bsViewModal) bsViewModal.hide();

        // Show success message
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-success alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
        alertDiv.style.zIndex = '9999';
        alertDiv.innerHTML = `<i class="fas fa-check-circle me-2"></i>Member added to chit fund successfully!<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
        document.body.appendChild(alertDiv);
        setTimeout(() => { if (alertDiv.parentNode) alertDiv.remove(); }, 5000);
        
        // Reload the view
        await viewChitDetails(chitId);

    } catch (error) {
        console.error('Error adding member to chit:', error);
        alert('Error adding member to chit: ' + error.message);
    } finally {
        // Reset button state
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = originalText;
    }
}

// Remove member from chit
async function removeMemberFromChit(membershipId, chitId, memberId) {
    if (!confirm('Are you sure you want to remove this member from the chit fund?')) {
        return;
    }
    
    // Current user and db references (re-established globally/in scope)
    const auth = firebase.auth();
    const db = firebase.firestore();
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
        // Get membership details
        const membershipDoc = await db.collection('chitMemberships').doc(membershipId).get();
        if (!membershipDoc.exists) {
            alert('Membership not found!');
            return;
        }

        // Delete the membership
        await db.collection('chitMemberships').doc(membershipId).delete();

        // Update chit member count
        await db.collection('chits').doc(chitId).update({
            currentMembers: firebase.firestore.FieldValue.increment(-1)
        });

        // Update member's active chits count
        try {
            const memberDoc = await db.collection('members').doc(memberId).get();
            if (memberDoc.exists) {
                await db.collection('members').doc(memberId).update({
                    activeChits: firebase.firestore.FieldValue.increment(-1)
                });
            }
        } catch (error) {
            console.warn('Error updating member active chits:', error);
        }
        
        // Show success message
        const alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-success alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
        alertDiv.style.zIndex = '9999';
        alertDiv.innerHTML = `<i class="fas fa-check-circle me-2"></i>Member removed from chit fund successfully!<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
        document.body.appendChild(alertDiv);
        setTimeout(() => { if (alertDiv.parentNode) alertDiv.remove(); }, 5000);

        
        // Reload the view
        const viewModal = document.getElementById('viewChitModal');
        const bsViewModal = bootstrap.Modal.getInstance(viewModal);
        if (bsViewModal) bsViewModal.hide();

        await viewChitDetails(chitId);

    } catch (error) {
        console.error('Error removing member from chit:', error);
        alert('Error removing member from chit: ' + error.message);
    }
}

// Global functions for member operations
window.removeMemberFromChit = removeMemberFromChit;
window.addMemberToChit = addMemberToChit;
