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
    const editChitModal = new bootstrap.Modal(document.getElementById('editChitModal'));

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
    }

    // Generate chit code automatically from chit name
    function generateChitCode() {
        const chitName = document.getElementById('chitName').value;
        if (chitName) {
            const words = chitName.split(' ');
            let code = '';
            
            for (let i = 0; i < Math.min(words.length, 3); i++) {
                if (words[i].length > 0) {
                    code += words[i][0].toUpperCase();
                }
            }
            
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
        const chitElement = document.createElement('div');
        chitElement.className = 'chit-item';
        chitElement.innerHTML = `
            <div class="chit-header">
                <div>
                    <h4 class="chit-name">${chit.name}</h4>
                    <p class="chit-code">Code: <strong>${chit.chitCode}</strong></p>
                </div>
                <div class="chit-actions">
                    <span class="badge ${chit.status === 'active' ? 'bg-success' : 'bg-secondary'}">
                        ${chit.status}
                    </span>
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
                for (const doc of membershipsSnapshot.docs) {
                    const membership = doc.data();
                    
                    // Get member details
                    let memberName = 'Unknown Member';
                    let memberPhone = 'Not available';
                    
                    try {
                        const memberDoc = await db.collection('members').doc(membership.memberId).get();
                        if (memberDoc.exists) {
                            const memberData = memberDoc.data();
                            memberName = memberData.name;
                            memberPhone = memberData.phone || 'Not provided';
                        } else {
                            // Try users collection for registered members
                            const userDoc = await db.collection('users').doc(membership.memberId).get();
                            if (userDoc.exists) {
                                const userData = userDoc.data();
                                memberName = userData.name || userData.email;
                            }
                        }
                    } catch (error) {
                        console.warn('Error loading member details:', error);
                    }

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
                                    <small class="text-muted">Joined: ${new Date(membership.joinedAt?.seconds * 1000).toLocaleDateString()}</small>
                                </div>
                            </div>
                            <div class="member-actions">
                                <button class="btn btn-sm btn-outline-danger" onclick="removeMemberFromChit('${doc.id}', '${chitId}')">
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
        const name = document.getElementById('editChitName').value;
        const totalAmount = parseFloat(document.getElementById('editTotalAmount').value);
        const duration = parseInt(document.getElementById('editDuration').value);
        const monthlyAmount = parseFloat(document.getElementById('editMonthlyAmount').value);
        const startDate = document.getElementById('editStartDate').value;
        const status = document.getElementById('editStatus').value;

        if (!name || !totalAmount || !duration || !monthlyAmount || !startDate) {
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
                // First check if there are members
                const membersSnapshot = await db.collection('chitMemberships')
                    .where('chitId', '==', chitId)
                    .get();

                if (!membersSnapshot.empty) {
                    if (!confirm('This chit fund has members. Are you sure you want to delete it? This will also remove all member associations.')) {
                        return;
                    }

                    // Delete all member associations
                    const deletePromises = [];
                    membersSnapshot.forEach(doc => {
                        deletePromises.push(db.collection('chitMemberships').doc(doc.id).delete());
                    });
                    await Promise.all(deletePromises);
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

    // Load members - FIXED VERSION
    async function loadMembers() {
        try {
            // Load only members from members collection (manager's own members)
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

            // Render all members
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

        viewBtn.addEventListener('click', () => viewMemberDetails(member.id));
        editBtn.addEventListener('click', () => editMember(member.id));
        deleteBtn.addEventListener('click', () => deleteMember(member.id));
    }

    // View member details
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
                                                <span>${member.phone || 'Not provided'}</span>
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
                                                <span class="badge ${member.status === 'active' ? 'bg-success' : 'bg-secondary'}">${member.status || 'active'}</span>
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

    // Edit member
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
                                            <option value="active" ${(member.status === 'active' || !member.status) ? 'selected' : ''}>Active</option>
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

    // Update member - FIXED VERSION
    async function updateMember(memberId) {
        const name = document.getElementById('editMemberName').value;
        const phone = document.getElementById('editMemberPhone').value;
        const status = document.getElementById('editMemberStatus').value;

        if (!name || !phone) {
            alert('Please fill all required fields');
            return;
        }

        try {
            setLoading(document.getElementById('updateMemberBtn'), true);

            const updateData = {
                name: name,
                phone: phone,
                status: status,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('members').doc(memberId).update(updateData);

            // Close modal
            const editModal = document.getElementById('editMemberModal');
            const bsModal = bootstrap.Modal.getInstance(editModal);
            bsModal.hide();

            showSuccess('Member updated successfully!');
            await loadMembers();
            await updateStats();

        } catch (error) {
            console.error('Error updating member:', error);
            alert('Error updating member: ' + error.message);
        } finally {
            setLoading(document.getElementById('updateMemberBtn'), false);
        }
    }

    // Delete member - FIXED VERSION
    async function deleteMember(memberId) {
        if (confirm('Are you sure you want to delete this member? This action cannot be undone.')) {
            try {
                // Check if member has active chits
                const membershipsSnapshot = await db.collection('chitMemberships')
                    .where('memberId', '==', memberId)
                    .get();

                if (!membershipsSnapshot.empty) {
                    if (!confirm('This member is part of chit funds. Are you sure you want to delete? This will remove them from all chit funds.')) {
                        return;
                    }

                    // Remove member from all chit funds and update chit counts
                    const deletePromises = [];
                    membershipsSnapshot.forEach(async (doc) => {
                        const membership = doc.data();
                        deletePromises.push(db.collection('chitMemberships').doc(doc.id).delete());
                        
                        // Update chit member count
                        const chitDoc = await db.collection('chits').doc(membership.chitId).get();
                        if (chitDoc.exists) {
                            const chit = chitDoc.data();
                            await db.collection('chits').doc(membership.chitId).update({
                                currentMembers: Math.max(0, (chit.currentMembers || 0) - 1)
                            });
                        }
                    });
                    await Promise.all(deletePromises);
                }

                // Delete the member
                await db.collection('members').doc(memberId).delete();
                
                showSuccess('Member deleted successfully!');
                await loadMembers();
                await loadChitFunds(); // Reload chits to update member counts
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

    // Render payment item
    function renderPayment(payment) {
        const paymentElement = document.createElement('div');
        paymentElement.className = 'payment-item';
        paymentElement.innerHTML = `
            <div class="payment-header">
                <div class="payment-info">
                    <h5 class="payment-member">${payment.memberName || 'Unknown Member'}</h5>
                    <p class="payment-chit">${payment.chitName || 'Unknown Chit'}</p>
                </div>
                <div class="payment-amount">
                    <span class="amount">₹${payment.amount?.toLocaleString()}</span>
                    <span class="badge ${payment.status === 'paid' ? 'bg-success' : 'bg-warning'}">
                        ${payment.status}
                    </span>
                </div>
            </div>
            <div class="payment-details">
                <div class="detail">
                    <label>Date:</label>
                    <span>${payment.paymentDate}</span>
                </div>
                <div class="detail">
                    <label>Month:</label>
                    <span>${payment.month}</span>
                </div>
                <div class="detail">
                    <label>Method:</label>
                    <span>${payment.paymentMethod || 'Cash'}</span>
                </div>
            </div>
            <div class="payment-actions">
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

        viewBtn.addEventListener('click', () => viewPaymentDetails(payment.id));
        editBtn.addEventListener('click', () => editPayment(payment.id));
        deleteBtn.addEventListener('click', () => deletePayment(payment.id));
    }

    // View payment details
    async function viewPaymentDetails(paymentId) {
        try {
            const paymentDoc = await db.collection('payments').doc(paymentId).get();
            if (!paymentDoc.exists) {
                alert('Payment not found!');
                return;
            }

            const payment = paymentDoc.data();
            
            const paymentHTML = `
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
                                        <label>Amount:</label>
                                        <span class="text-success"><strong>₹${payment.amount?.toLocaleString()}</strong></span>
                                    </div>
                                    <div class="detail-item">
                                        <label>Payment Date:</label>
                                        <span>${payment.paymentDate}</span>
                                    </div>
                                    <div class="detail-item">
                                        <label>Month:</label>
                                        <span>${payment.month}</span>
                                    </div>
                                    <div class="detail-item">
                                        <label>Payment Method:</label>
                                        <span>${payment.paymentMethod || 'Cash'}</span>
                                    </div>
                                    <div class="detail-item">
                                        <label>Status:</label>
                                        <span class="badge ${payment.status === 'paid' ? 'bg-success' : 'bg-warning'}">${payment.status}</span>
                                    </div>
                                    ${payment.notes ? `
                                    <div class="detail-item">
                                        <label>Notes:</label>
                                        <span>${payment.notes}</span>
                                    </div>
                                    ` : ''}
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

            document.body.insertAdjacentHTML('beforeend', paymentHTML);
            const viewModal = new bootstrap.Modal(document.getElementById('viewPaymentModal'));
            viewModal.show();

        } catch (error) {
            console.error('Error loading payment details:', error);
            alert('Error loading payment details: ' + error.message);
        }
    }

    // Edit payment
    async function editPayment(paymentId) {
        try {
            const paymentDoc = await db.collection('payments').doc(paymentId).get();
            if (!paymentDoc.exists) {
                alert('Payment not found!');
                return;
            }

            const payment = paymentDoc.data();

            // Create edit modal HTML
            const editModalHTML = `
                <div class="modal fade" id="editPaymentModal" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">Edit Payment</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <form id="editPaymentForm">
                                    <input type="hidden" id="editPaymentId" value="${paymentId}">
                                    <div class="mb-3">
                                        <label for="editPaymentAmount" class="form-label">Amount *</label>
                                        <input type="number" class="form-control" id="editPaymentAmount" value="${payment.amount}" required>
                                    </div>
                                    <div class="mb-3">
                                        <label for="editPaymentDate" class="form-label">Payment Date *</label>
                                        <input type="date" class="form-control" id="editPaymentDate" value="${payment.paymentDate}" required>
                                    </div>
                                    <div class="mb-3">
                                        <label for="editPaymentMonth" class="form-label">Month *</label>
                                        <input type="month" class="form-control" id="editPaymentMonth" value="${payment.month}" required>
                                    </div>
                                    <div class="mb-3">
                                        <label for="editPaymentMethod" class="form-label">Payment Method</label>
                                        <select class="form-select" id="editPaymentMethod">
                                            <option value="cash" ${payment.paymentMethod === 'cash' ? 'selected' : ''}>Cash</option>
                                            <option value="bank_transfer" ${payment.paymentMethod === 'bank_transfer' ? 'selected' : ''}>Bank Transfer</option>
                                            <option value="upi" ${payment.paymentMethod === 'upi' ? 'selected' : ''}>UPI</option>
                                            <option value="cheque" ${payment.paymentMethod === 'cheque' ? 'selected' : ''}>Cheque</option>
                                        </select>
                                    </div>
                                    <div class="mb-3">
                                        <label for="editPaymentStatus" class="form-label">Status</label>
                                        <select class="form-select" id="editPaymentStatus">
                                            <option value="paid" ${payment.status === 'paid' ? 'selected' : ''}>Paid</option>
                                            <option value="pending" ${payment.status === 'pending' ? 'selected' : ''}>Pending</option>
                                            <option value="overdue" ${payment.status === 'overdue' ? 'selected' : ''}>Overdue</option>
                                        </select>
                                    </div>
                                    <div class="mb-3">
                                        <label for="editPaymentNotes" class="form-label">Notes</label>
                                        <textarea class="form-control" id="editPaymentNotes" rows="3">${payment.notes || ''}</textarea>
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

            document.body.insertAdjacentHTML('beforeend', editModalHTML);
            
            // Add event listener for update button
            document.getElementById('updatePaymentBtn').addEventListener('click', () => updatePayment(paymentId));
            
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
    async function updatePayment(paymentId) {
        const amount = parseFloat(document.getElementById('editPaymentAmount').value);
        const paymentDate = document.getElementById('editPaymentDate').value;
        const month = document.getElementById('editPaymentMonth').value;
        const paymentMethod = document.getElementById('editPaymentMethod').value;
        const status = document.getElementById('editPaymentStatus').value;
        const notes = document.getElementById('editPaymentNotes').value;

        if (!amount || !paymentDate || !month) {
            alert('Please fill all required fields');
            return;
        }

        try {
            setLoading(document.getElementById('updatePaymentBtn'), true);

            const updateData = {
                amount: amount,
                paymentDate: paymentDate,
                month: month,
                paymentMethod: paymentMethod,
                status: status,
                notes: notes,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('payments').doc(paymentId).update(updateData);

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
            setLoading(document.getElementById('updatePaymentBtn'), false);
        }
    }

    // Delete payment
    async function deletePayment(paymentId) {
        if (confirm('Are you sure you want to delete this payment record?')) {
            try {
                await db.collection('payments').doc(paymentId).delete();
                showSuccess('Payment deleted successfully!');
                await loadPayments();
                await updateStats();

            } catch (error) {
                console.error('Error deleting payment:', error);
                alert('Error deleting payment: ' + error.message);
            }
        }
    }

    // Create chit fund
    async function createChitFund() {
        const name = document.getElementById('chitName').value;
        const chitCode = document.getElementById('chitCode').value;
        const totalAmount = parseFloat(document.getElementById('totalAmount').value);
        const duration = parseInt(document.getElementById('duration').value);
        const monthlyAmount = totalAmount / duration;
        const startDate = document.getElementById('startDate').value;

        if (!name || !chitCode || !totalAmount || !duration || !startDate) {
            alert('Please fill all required fields');
            return;
        }

        try {
            setLoading(document.getElementById('saveChitBtn'), true);

            // Check if chit code already exists
            const existingChit = await db.collection('chits')
                .where('chitCode', '==', chitCode)
                .get();

            if (!existingChit.empty) {
                alert('Chit code already exists. Please use a different code.');
                return;
            }

            const chitData = {
                name: name,
                chitCode: chitCode,
                totalAmount: totalAmount,
                duration: duration,
                monthlyAmount: monthlyAmount,
                startDate: startDate,
                currentMembers: 0,
                status: 'active',
                managerId: currentUser.uid,
                managerName: userData.name,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('chits').add(chitData);

            createChitModal.hide();
            document.getElementById('createChitForm').reset();
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

    // Add member - FIXED VERSION
    async function addMember() {
        const name = document.getElementById('memberName').value;
        const phone = document.getElementById('memberPhone').value;

        if (!name || !phone) {
            alert('Please fill all required fields');
            return;
        }

        try {
            setLoading(document.getElementById('saveMemberBtn'), true);

            // Check if member with same phone already exists for this manager
            const existingMember = await db.collection('members')
                .where('managerId', '==', currentUser.uid)
                .where('phone', '==', phone)
                .get();

            if (!existingMember.empty) {
                alert('A member with this phone number already exists.');
                return;
            }

            const memberData = {
                name: name,
                phone: phone,
                managerId: currentUser.uid,
                managerName: userData.name,
                activeChits: 0,
                totalPaid: 0,
                status: 'active',
                joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('members').add(memberData);

            addMemberModal.hide();
            document.getElementById('addMemberForm').reset();
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

    // Record auction
    async function recordAuction() {
        const chitId = document.getElementById('auctionChit').value;
        const winnerId = document.getElementById('auctionWinner').value;
        const month = document.getElementById('auctionMonth').value;
        const auctionAmount = parseFloat(document.getElementById('auctionAmount').value);
        const commission = parseFloat(document.getElementById('commission').value);
        const auctionDate = document.getElementById('auctionDate').value;

        if (!chitId || !winnerId || !month || !auctionAmount || !commission || !auctionDate) {
            alert('Please fill all required fields');
            return;
        }

        try {
            setLoading(document.getElementById('saveAuctionBtn'), true);

            const auctionData = {
                chitId: chitId,
                winnerId: winnerId,
                month: month,
                auctionAmount: auctionAmount,
                commission: commission,
                auctionDate: auctionDate,
                managerId: currentUser.uid,
                status: 'completed',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('auctions').add(auctionData);

            recordAuctionModal.hide();
            document.getElementById('recordAuctionForm').reset();
            showSuccess('Auction recorded successfully!');
            
            await updateStats();

        } catch (error) {
            console.error('Error recording auction:', error);
            alert('Error recording auction: ' + error.message);
        } finally {
            setLoading(document.getElementById('saveAuctionBtn'), false);
        }
    }

    // Record payment
    async function recordPayment() {
        const memberId = document.getElementById('paymentMember').value;
        const chitId = document.getElementById('paymentChit').value;
        const amount = parseFloat(document.getElementById('paymentAmount').value);
        const paymentDate = document.getElementById('paymentDate').value;
        const month = document.getElementById('paymentMonth').value;
        const paymentMethod = document.getElementById('paymentMethod').value;
        const notes = document.getElementById('paymentNotes').value;

        if (!memberId || !chitId || !amount || !paymentDate || !month) {
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
                alert('Member or chit fund not found');
                return;
            }

            const member = memberDoc.data();
            const chit = chitDoc.data();

            const paymentData = {
                memberId: memberId,
                memberName: member.name,
                chitId: chitId,
                chitName: chit.name,
                amount: amount,
                paymentDate: paymentDate,
                month: month,
                paymentMethod: paymentMethod,
                notes: notes,
                status: 'paid',
                managerId: currentUser.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('payments').add(paymentData);

            // Update member's total paid amount
            await db.collection('members').doc(memberId).update({
                totalPaid: firebase.firestore.FieldValue.increment(amount),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            recordPaymentModal.hide();
            document.getElementById('recordPaymentForm').reset();
            showSuccess('Payment recorded successfully!');
            
            await loadPayments();
            await loadMembers();
            await updateStats();

        } catch (error) {
            console.error('Error recording payment:', error);
            alert('Error recording payment: ' + error.message);
        } finally {
            setLoading(document.getElementById('savePaymentBtn'), false);
        }
    }

    // Update auction preview
    function updateAuctionPreview() {
        const month = document.getElementById('auctionMonth').value;
        const chitId = document.getElementById('auctionChit').value;
        
        if (month && chitId) {
            // Calculate and display preview information
            document.getElementById('auctionPreview').style.display = 'block';
            document.getElementById('previewMonth').textContent = month;
        }
    }

    // Calculate chit progress
    function calculateChitProgress(chit) {
        if (!chit.startDate) {
            return { percentage: 0, monthsCompleted: 0 };
        }

        const startDate = new Date(chit.startDate);
        const currentDate = new Date();
        const monthsCompleted = Math.floor((currentDate - startDate) / (30 * 24 * 60 * 60 * 1000));
        const percentage = Math.min(100, Math.max(0, (monthsCompleted / chit.duration) * 100));

        return {
            percentage: percentage,
            monthsCompleted: Math.min(monthsCompleted, chit.duration)
        };
    }

    // Update dashboard statistics
    async function updateStats() {
        try {
            // Get total members count
            const membersSnapshot = await db.collection('members')
                .where('managerId', '==', currentUser.uid)
                .get();
            const totalMembers = membersSnapshot.size;

            // Get active chits count
            const chitsSnapshot = await db.collection('chits')
                .where('managerId', '==', currentUser.uid)
                .where('status', '==', 'active')
                .get();
            const activeChits = chitsSnapshot.size;

            // Get total collection
            const paymentsSnapshot = await db.collection('payments')
                .where('managerId', '==', currentUser.uid)
                .get();
            let totalCollection = 0;
            paymentsSnapshot.forEach(doc => {
                totalCollection += doc.data().amount || 0;
            });

            // Get auctions done count
            const auctionsSnapshot = await db.collection('auctions')
                .where('managerId', '==', currentUser.uid)
                .get();
            const auctionsDone = auctionsSnapshot.size;

            // Update UI
            if (totalMembersElement) totalMembersElement.textContent = totalMembers;
            if (activeChitsElement) activeChitsElement.textContent = activeChits;
            if (totalCollectionElement) totalCollectionElement.textContent = `₹${totalCollection.toLocaleString()}`;
            if (auctionsDoneElement) auctionsDoneElement.textContent = auctionsDone;

        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    // Update UI based on user data
    function updateUI() {
        if (userNameElement && userData) {
            userNameElement.textContent = userData.name || 'Manager';
        }
    }

    // Set loading state for buttons
    function setLoading(button, isLoading) {
        if (isLoading) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';
        } else {
            button.disabled = false;
            button.innerHTML = button.getAttribute('data-original-text') || button.textContent;
        }
    }

    // Show success message
    function showSuccess(message) {
        // Create toast notification
        const toastHTML = `
            <div class="toast align-items-center text-white bg-success border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">
                        <i class="fas fa-check-circle me-2"></i>${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;
        
        const toastContainer = document.getElementById('toastContainer') || createToastContainer();
        toastContainer.insertAdjacentHTML('beforeend', toastHTML);
        
        const toastElement = toastContainer.lastElementChild;
        const toast = new bootstrap.Toast(toastElement);
        toast.show();
        
        // Remove toast after it's hidden
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    }

    // Create toast container if it doesn't exist
    function createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
        return container;
    }

    // Logout function
    logoutBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
            auth.signOut().then(() => {
                window.location.href = 'auth.html';
            }).catch((error) => {
                console.error('Error signing out:', error);
            });
        }
    });

    // Global functions for modal interactions
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

    window.addMemberToChit = async function(chitId) {
        // Implementation for adding member to chit
        alert('Add member to chit functionality would go here');
    };

    window.removeMemberFromChit = async function(membershipId, chitId) {
        if (confirm('Are you sure you want to remove this member from the chit fund?')) {
            try {
                await db.collection('chitMemberships').doc(membershipId).delete();
                
                // Update chit member count
                const chitDoc = await db.collection('chits').doc(chitId).get();
                if (chitDoc.exists) {
                    const chit = chitDoc.data();
                    await db.collection('chits').doc(chitId).update({
                        currentMembers: Math.max(0, (chit.currentMembers || 0) - 1)
                    });
                }
                
                showSuccess('Member removed from chit fund successfully!');
                
                // Close and reopen modal to refresh data
                const viewModal = document.getElementById('viewChitModal');
                if (viewModal) {
                    const bsModal = bootstrap.Modal.getInstance(viewModal);
                    if (bsModal) bsModal.hide();
                }
                
                // Reload chit details
                await loadChitFunds();
                await loadMembers();
                await updateStats();
                
            } catch (error) {
                console.error('Error removing member from chit:', error);
                alert('Error removing member from chit: ' + error.message);
            }
        }
    };
});
