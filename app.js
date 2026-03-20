// ===== State Management & API Integration =====

let SCRIPT_URL = localStorage.getItem('lms_script_url') || '';

let appState = {
    users: [],
    leaves: [],
    isLoading: false
};

async function fetchDatabase() {
    if (!SCRIPT_URL) return false;
    try {
        appState.isLoading = true;
        renderApp(); // Show loading state

        const response = await fetch(SCRIPT_URL);
        const data = await response.json();
        
        // Ensure string IDs are handled consistently
        appState.users = data.users || [];
        appState.leaves = data.leaves || [];
        
        return true;
    } catch (error) {
        console.error("Failed to fetch database:", error);
        showToast('Failed to connect to Google Sheets. Check your URL.', 'error');
        return false;
    } finally {
        appState.isLoading = false;
        renderApp();
    }
}

async function apiAddLeave(leaveObj) {
    appState.leaves.push(leaveObj); // Optimistic UI update
    renderApp(); 
    
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'addLeave',
                data: leaveObj
            }) // Send as text/plain to avoid CORS preflight errors in Apps Script
        });
        showToast('Leave application synced to Google Sheets!');
    } catch (error) {
        showToast('Error syncing to database!', 'error');
        console.error(error);
    }
}

async function apiUpdateLeaveStatus(leaveId, newStatus) {
    // Optimistic UI update
    const idx = appState.leaves.findIndex(l => l.id == leaveId);
    if (idx !== -1) {
        appState.leaves[idx].status = newStatus;
        renderApp();
    }

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'updateLeaveStatus',
                leaveId: leaveId,
                status: newStatus
            })
        });
        showToast(`Leave officially ${newStatus.toLowerCase()} in database!`);
    } catch (error) {
        showToast('Error syncing status to database!', 'error');
        console.error(error);
    }
}

function getCurrentUser() {
    return JSON.parse(localStorage.getItem('lms_current_user'));
}

function setCurrentUser(user) {
    if (user) {
        localStorage.setItem('lms_current_user', JSON.stringify(user));
    } else {
        localStorage.removeItem('lms_current_user');
    }
}

// ===== UI Utilities =====

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span style="font-size: 1.2rem;">${type === 'success' ? '✓' : '⚠'}</span>
        ${message}
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

function calculateDays(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.abs(e - s);
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1; // Inclusive
}

function getStatusBadge(status) {
    if (!status) status = 'Pending';
    const statusLower = status.toLowerCase();
    return `<span class="badge badge-${statusLower}">${status}</span>`;
}

// ===== Routing & Views =====

const appContainer = document.getElementById('app');

function renderSetupView() {
    appContainer.innerHTML = `
        <div class="auth-wrapper">
            <div class="glass-pane auth-card" style="max-width: 500px;">
                <h2>Database Setup</h2>
                <p style="margin-bottom: 2rem; color: var(--text-secondary); font-size: 0.9rem;">
                    Please enter your Google Apps Script <strong>Web App URL</strong> to connect your Google Sheets database.
                </p>
                <form id="setupForm">
                    <div class="form-group">
                        <label>Google Script URL</label>
                        <input type="url" id="scriptUrl" class="form-control" placeholder="https://script.google.com/macros/s/..." required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">Connect Database</button>
                </form>
            </div>
        </div>
    `;

    document.getElementById('setupForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const url = document.getElementById('scriptUrl').value.trim();
        localStorage.setItem('lms_script_url', url);
        SCRIPT_URL = url;
        showToast('URL Saved! Fetching data...');
        fetchDatabase();
    });
}

function renderLoadingView() {
    appContainer.innerHTML = `
        <div class="auth-wrapper">
            <div style="text-align: center;">
                <div style="width: 50px; height: 50px; border: 4px solid var(--glass-bg); border-top: 4px solid var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 1rem;"></div>
                <h3 style="color: var(--text-secondary)">Syncing with Google Sheets...</h3>
                <style>
                    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                </style>
            </div>
        </div>
    `;
}

function renderAuthView() {
    appContainer.innerHTML = `
        <div class="auth-wrapper">
            <div class="glass-pane auth-card">
                <h2>Welcome Back</h2>
                <div class="brand" style="margin-bottom: 2rem;">LMS Portal</div>
                <form id="loginForm">
                    <div class="form-group">
                        <label>Username</label>
                        <input type="text" id="username" class="form-control" placeholder="john or admin" required>
                    </div>
                    <div class="form-group">
                        <label>Password</label>
                        <input type="password" id="password" class="form-control" placeholder="123" required>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">Sign In</button>
                    <p style="margin-top: 1rem; font-size: 0.8rem; color: var(--text-secondary);">
                        Hint: employee (john/123), manager (admin/123) <br><br>
                        <a href="#" id="resetDb" style="color: var(--warning-color);">Change Database URL</a>
                    </p>
                </form>
            </div>
        </div>
    `;

    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const u = document.getElementById('username').value;
        const p = document.getElementById('password').value;
        
        const user = appState.users.find(x => x.username == u && x.password == p);
        if (user) {
            setCurrentUser(user);
            showToast('Login successful!');
            renderApp();
        } else {
            showToast('Invalid credentials. Check your Google Sheet "Users" tab.', 'error');
        }
    });

    document.getElementById('resetDb').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('lms_script_url');
        SCRIPT_URL = '';
        renderApp();
    });
}

function renderEmployeeDashboard() {
    const user = getCurrentUser();
    const myLeaves = appState.leaves.filter(l => l.employeeId == user.id);
    const totalLeaves = parseInt(user.totalLeaves) || 0;
    
    // Calculate total days of Approved leaves
    const approvedLeaves = myLeaves
        .filter(l => l.status === 'Approved')
        .reduce((acc, l) => acc + parseInt(l.days || 0), 0);
        
    const balance = totalLeaves - approvedLeaves;

    appContainer.innerHTML = `
        <div class="container glass-pane" style="min-height: 95vh; margin: 1rem auto; padding: 0;">
            <header>
                <div class="brand">LMS Portal</div>
                <nav class="profile-info">
                    <span>Hi, <strong>${user.name}</strong></span>
                    <button id="refreshBtn" class="btn btn-outline btn-sm">Sync DB</button>
                    <button id="logoutBtn" class="btn btn-outline btn-sm">Logout</button>
                </nav>
            </header>

            <div style="padding: 0 2rem 2rem;">
                <h2 style="margin-bottom: 2rem;">Employee Dashboard</h2>

                <div class="stats-grid">
                    <div class="stat-box">
                        <div class="stat-value">${totalLeaves}</div>
                        <div class="stat-label">Total Leaves</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value" style="color: var(--warning-color);">${approvedLeaves}</div>
                        <div class="stat-label">Used</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value" style="color: #38ef7d;">${balance}</div>
                        <div class="stat-label">Balance</div>
                    </div>
                </div>

                <div class="dashboard-grid">
                    <!-- Apply Leave Form -->
                    <div class="card glass-pane">
                        <div class="card-header">
                            <h3>Apply for Leave</h3>
                        </div>
                        <form id="applyLeaveForm">
                            <div class="form-group">
                                <label>Leave Type</label>
                                <select id="leaveType" class="form-control" required>
                                    <option value="">Select Type...</option>
                                    <option value="Sick">Sick Leave</option>
                                    <option value="Annual">Annual Leave</option>
                                    <option value="Casual">Casual Leave</option>
                                </select>
                            </div>
                            <div class="form-group" style="display: flex; gap: 1rem;">
                                <div style="flex: 1">
                                    <label>Start Date</label>
                                    <input type="date" id="startDate" class="form-control" required>
                                </div>
                                <div style="flex: 1">
                                    <label>End Date</label>
                                    <input type="date" id="endDate" class="form-control" required>
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Reason</label>
                                <textarea id="reason" class="form-control" rows="3" placeholder="Brief reason..." required></textarea>
                            </div>
                            <button type="submit" id="submitBtn" class="btn btn-primary btn-block">Submit Application</button>
                        </form>
                    </div>

                    <!-- Leave History -->
                    <div class="card glass-pane">
                        <div class="card-header">
                            <h3>My Leave History</h3>
                        </div>
                        <div class="table-responsive">
                            ${myLeaves.length > 0 ? `
                            <table>
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>Duration</th>
                                        <th>Days</th>
                                        <th>Applied On</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${[...myLeaves].reverse().map(l => `
                                    <tr>
                                        <td><strong>${l.type}</strong></td>
                                        <td>${l.startDate} to ${l.endDate}</td>
                                        <td>${l.days}</td>
                                        <td>${l.appliedOn}</td>
                                        <td>${getStatusBadge(l.status)}</td>
                                    </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                            ` : `<div class="empty-state">No leaves applied yet.</div>`}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('logoutBtn').addEventListener('click', () => {
        setCurrentUser(null);
        renderApp();
    });

    document.getElementById('refreshBtn').addEventListener('click', () => {
        fetchDatabase(); // Manually sync
    });

    document.getElementById('applyLeaveForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const start = document.getElementById('startDate').value;
        const end = document.getElementById('endDate').value;
        const type = document.getElementById('leaveType').value;
        const reason = document.getElementById('reason').value;

        if (new Date(start) > new Date(end)) {
            showToast('End date must be after Start date', 'error');
            return;
        }

        const days = calculateDays(start, end);

        if (days > balance) {
            showToast('Insufficient leave balance!', 'error');
            return;
        }

        const newLeave = {
            id: 'l_' + Date.now(),
            employeeId: user.id,
            employeeName: user.name,
            type: type,
            startDate: start,
            endDate: end,
            days: days,
            reason: reason,
            status: 'Pending',
            appliedOn: new Date().toISOString().split('T')[0]
        };

        const btn = document.getElementById('submitBtn');
        btn.innerText = 'Syncing...';
        btn.disabled = true;

        apiAddLeave(newLeave);
    });
}

function renderManagerDashboard() {
    const user = getCurrentUser();
    const allLeaves = appState.leaves;
    
    const pendingCount = allLeaves.filter(l => l.status === 'Pending').length;
    const approvedCount = allLeaves.filter(l => l.status === 'Approved').length;
    const rejectedCount = allLeaves.filter(l => l.status === 'Rejected').length;

    appContainer.innerHTML = `
        <div class="container glass-pane" style="min-height: 95vh; margin: 1rem auto; padding: 0;">
            <header>
                <div class="brand">LMS Portal <span style="font-size: 0.8rem; font-weight: 400; color: var(--text-secondary)">Manager</span></div>
                <nav class="profile-info">
                    <span>Hi, <strong>${user.name}</strong></span>
                    <button id="refreshBtn" class="btn btn-outline btn-sm">Sync DB</button>
                    <button id="logoutBtn" class="btn btn-outline btn-sm">Logout</button>
                </nav>
            </header>

            <div style="padding: 0 2rem 2rem;">
                <h2 style="margin-bottom: 2rem;">Manager Dashboard</h2>

                <div class="stats-grid">
                    <div class="stat-box">
                        <div class="stat-value" style="color: var(--warning-color);">${pendingCount}</div>
                        <div class="stat-label">Pending Requests</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value" style="color: #38ef7d;">${approvedCount}</div>
                        <div class="stat-label">Approved</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-value" style="color: #ff6b6b;">${rejectedCount}</div>
                        <div class="stat-label">Rejected</div>
                    </div>
                </div>

                <div class="card glass-pane">
                    <div class="card-header">
                        <h3>Employee Leave Requests</h3>
                    </div>
                    <div class="table-responsive">
                        ${allLeaves.length > 0 ? `
                        <table>
                            <thead>
                                <tr>
                                    <th>Employee</th>
                                    <th>Leave Info</th>
                                    <th>Reason</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${[...allLeaves].reverse().map(l => `
                                <tr>
                                    <td>
                                        <strong>${l.employeeName}</strong>
                                        <div style="font-size: 0.8rem; color: var(--text-secondary)">Applied: ${l.appliedOn}</div>
                                    </td>
                                    <td>
                                        ${l.type} (${l.days} days)<br>
                                        <span style="font-size: 0.8rem; color: var(--text-secondary)">
                                            ${l.startDate} to ${l.endDate}
                                        </span>
                                    </td>
                                    <td style="max-width: 200px; word-wrap: break-word;">${l.reason}</td>
                                    <td>${getStatusBadge(l.status)}</td>
                                    <td>
                                        ${l.status === 'Pending' ? `
                                        <div class="action-buttons">
                                            <button class="btn btn-success btn-sm" onclick="handleAction('${l.id}', 'Approved')">Approve</button>
                                            <button class="btn btn-danger btn-sm" onclick="handleAction('${l.id}', 'Rejected')">Reject</button>
                                        </div>
                                        ` : `
                                        <span style="font-size: 0.85rem; color: var(--text-secondary)">Done</span>
                                        `}
                                    </td>
                                </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        ` : `<div class="empty-state">No leave requests found in Google Sheets.</div>`}
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('logoutBtn').addEventListener('click', () => {
        setCurrentUser(null);
        renderApp();
    });

    document.getElementById('refreshBtn').addEventListener('click', () => {
        fetchDatabase(); // Manually sync
    });
}

// Global hook for inline manager actions
window.handleAction = function(leaveId, newStatus) {
    if (confirm(`Are you sure you want to ${newStatus.toUpperCase()} this leave request?`)) {
        apiUpdateLeaveStatus(leaveId, newStatus);
    }
}

function renderApp() {
    if (appState.isLoading) {
        return renderLoadingView();
    }

    if (!SCRIPT_URL) {
        return renderSetupView();
    }

    const user = getCurrentUser();
    if (!user) {
        return renderAuthView();
    }

    if (user.role === 'manager') {
        renderManagerDashboard();
    } else {
        renderEmployeeDashboard();
    }
}

// Boot sequence
if (SCRIPT_URL && appState.users.length === 0) {
    fetchDatabase();
} else {
    renderApp();
}
