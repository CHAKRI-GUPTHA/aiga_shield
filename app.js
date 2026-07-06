// AIGA Shield - Comprehensive Frontend Application
// Real-Time Card Fraud Detection System

let appState = {
  user: null,
  role: null,
  name: null,
  token: null,
  stats: { total: 0, blocked: 0, pending: 0, high: 0, approved: 0 },
  transactions: [],
  cases: [],
  merchants: [],
  analysts: [],
  selectedTransaction: null,
  selectedCase: null,
  eventSource: null,
};

const API_BASE = '';
const IS_GH_PAGES = window.location.hostname.endsWith('github.io') || window.location.pathname.includes('/aiga_shield');
const DEMO_STORAGE_KEY = 'aiga_shield_demo_state';

const demoState = loadDemoState();

function saveDemoState() {
  try {
    localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(demoState));
  } catch (e) {
    console.warn('Unable to save demo state:', e);
  }
}

function loadDemoState() {
  try {
    const stored = localStorage.getItem(DEMO_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Unable to read demo state:', e);
  }
  return {
    users: {
      'admin@aiga.com': { email: 'admin@aiga.com', password: '1234', role: 'admin', name: 'Admin User' },
      'customer@aiga.com': { email: 'customer@aiga.com', password: '1234', role: 'customer', name: 'Customer User' },
      'analyst@aiga.com': { email: 'analyst@aiga.com', password: '1234', role: 'analyst', name: 'Analyst User' },
    },
    sessions: {},
    transactions: [],
    cases: [],
  };
}

function getDemoAuthToken(path, options) {
  if (options?.headers?.Authorization && options.headers.Authorization.startsWith('Bearer ')) {
    return options.headers.Authorization.slice(7);
  }
  if (path.includes('?token=')) {
    try {
      return new URL(`http://example.com${path}`).searchParams.get('token');
    } catch {
      return null;
    }
  }
  return null;
}

function demoSnapshot(user) {
  const allTransactions = demoState.transactions;
  const allCases = demoState.cases;
  const transactions = user.role === 'customer'
    ? allTransactions.filter((txn) => txn.customerId === user.email)
    : allTransactions;
  const cases = user.role === 'customer'
    ? allCases.filter((item) => item.customerId === user.email)
    : allCases;
  const blocked = transactions.filter((txn) => txn.decision === 'Blocked').length;
  const pending = transactions.filter((txn) => txn.decision === 'OTP Required' || txn.decision === 'Pending Review').length;
  const high = transactions.filter((txn) => txn.score >= 75).length;
  const approved = transactions.filter((txn) => txn.decision === 'Approved').length;
  const cities = new Map();
  for (const txn of transactions) {
    cities.set(txn.city, (cities.get(txn.city) || 0) + (txn.score >= 45 ? 1 : 0));
  }
  return {
    stats: { total: transactions.length, blocked, pending, high, approved },
    transactions,
    cases,
    analysts: user.role === 'admin' ? Object.values(demoState.users).filter((u) => u.role === 'analyst').map((u) => ({ email: u.email, name: u.name, role: u.role })) : [],
    merchants: user.role === 'customer' ? [] : [],
    heatmap: user.role === 'customer' ? [] : [...cities.entries()].map(([city, count]) => ({ city, count })),
  };
}

function createDemoTransaction(body, user) {
  const now = new Date();
  const customerId = String(body.customerId || body.email || 'customer').trim().toLowerCase();
  const customerName = String(body.customerName || 'Customer').trim();
  const amount = Number(body.amount || 0);
  const merchantName = String(body.merchant || 'Unknown').trim();
  const city = String(body.city || 'Unknown').trim();
  const score = Math.min(99, Math.max(1, Math.round(amount / 1000) + (merchantName.toLowerCase().includes('unknown') ? 20 : 0)));
  const decision = user.role === 'customer' ? 'Pending Review' : score >= 75 ? 'Blocked' : score >= 45 ? 'Pending Review' : 'Approved';
  const transaction = {
    id: `TXN-${Math.floor(Math.random() * 900000) + 100000}`,
    createdAt: now.toISOString(),
    customerId,
    customerName,
    merchant: merchantName,
    amount,
    city,
    location: body.location || { lat: 28.6139, lon: 77.209 },
    deviceHash: body.deviceFingerprint || 'demo-device',
    network: body.network || { online: true, timezone: 'Asia/Kolkata' },
    score,
    level: score >= 75 ? 'High Risk' : score >= 45 ? 'Medium Risk' : 'Low Risk',
    decision,
    status: user.role === 'customer' ? 'Pending Approval' : decision === 'Approved' ? 'Resolved' : decision === 'Blocked' ? 'Blocked' : 'Verification Pending',
    recommendation: user.role === 'customer' ? 'Awaiting admin approval.' : decision === 'Blocked' ? 'Block transaction and investigate' : 'Continue monitoring',
    confidence: Math.min(99, score + 5),
    riskManager: user.role === 'customer' ? 'Manual Review Queue' : score >= 75 ? 'Dedicated Risk Team' : score >= 45 ? 'Manual Review Queue' : 'Behavior Monitoring Team',
    reasons: ['Demo mode transaction'],
    report: `Demo transaction for ${customerName} at ${merchantName}. Risk score ${score}%`,
    createdBy: user.email,
    createdByName: user.name,
    createdByRole: user.role,
  };
  return transaction;
}

function createDemoCase(transaction) {
  const now = new Date();
  if (transaction.score < 45 && transaction.createdByRole !== 'customer') return null;
  const fraudCase = {
    id: `CASE-${Math.floor(Math.random() * 9000) + 1000}-${transaction.id}`,
    transactionId: transaction.id,
    customerId: transaction.customerId,
    customerName: transaction.customerName,
    merchant: transaction.merchant,
    amount: transaction.amount,
    score: transaction.score,
    priority: transaction.score >= 75 ? 'High' : 'Medium',
    status: transaction.createdByRole === 'customer' ? 'Pending Approval' : transaction.score >= 75 ? 'Open' : 'Verification Pending',
    createdBy: transaction.createdBy,
    createdByName: transaction.createdByName,
    createdByRole: transaction.createdByRole,
    timeline: [
      ['Transaction received', now.toISOString()],
      [`Fraud detected (${transaction.score}%)`, now.toISOString()],
      ['AI report generated', now.toISOString()],
    ],
  };
  return fraudCase;
}

function mockResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
    headers: { get: () => 'application/json; charset=utf-8' },
  };
}

async function mockApiRequest(path, options = {}) {
  const url = path.split('?')[0];
  const method = (options.method || 'GET').toUpperCase();
  const token = getDemoAuthToken(path, options);
  const user = token ? demoState.sessions[token] : null;
  const body = options.body ? JSON.parse(options.body) : {};

  if (url === '/api/login' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const found = demoState.users[email];
    if (!found || found.password !== password) {
      return mockResponse(401, { error: 'Invalid email or password' });
    }
    const newToken = `${email}-${Date.now()}`;
    demoState.sessions[newToken] = { email: found.email, role: found.role, name: found.name };
    saveDemoState();
    return mockResponse(200, { token: newToken, email: found.email, role: found.role, name: found.name });
  }

  if (url === '/api/register' && method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || '').trim();
    const password = String(body.password || '');
    if (!name || !email || !password) {
      return mockResponse(400, { error: 'Name, email, and password are required' });
    }
    if (demoState.users[email]) {
      return mockResponse(409, { error: 'This email is already registered' });
    }
    demoState.users[email] = { email, name, password, role: 'customer' };
    saveDemoState();
    return mockResponse(201, { message: 'Customer account created successfully' });
  }

  if (url === '/api/state' && method === 'GET') {
    if (!user) return mockResponse(401, { error: 'Authentication required' });
    return mockResponse(200, demoSnapshot(user));
  }

  if (url === '/api/transactions' && method === 'POST') {
    if (!user) return mockResponse(401, { error: 'Authentication required' });
    const payload = { ...body };
    if (user.role === 'customer') {
      payload.email = user.email;
      payload.customerId = user.email;
      payload.customerName = user.name;
    }
    const txn = createDemoTransaction(payload, user);
    demoState.transactions.unshift(txn);
    const newCase = createDemoCase(txn);
    if (newCase) demoState.cases.unshift(newCase);
    saveDemoState();
    return mockResponse(201, txn);
  }

  if (url.startsWith('/api/transactions/') && method === 'POST') {
    if (!user || !['admin', 'analyst'].includes(user.role)) return mockResponse(403, { error: 'Forbidden' });
    const id = decodeURIComponent(url.split('/').pop());
    const txn = demoState.transactions.find((item) => item.id === id);
    if (!txn) return mockResponse(404, { error: 'Transaction not found' });
    const status = String(body.status || 'Approved');
    txn.decision = status === 'Blocked' ? 'Blocked' : 'Approved';
    const fraudCase = demoState.cases.find((c) => c.transactionId === id);
    if (fraudCase) {
      fraudCase.status = status === 'Blocked' ? 'Open' : 'Resolved';
      fraudCase.timeline.push([`Admin action: ${status}`, new Date().toISOString()]);
    }
    saveDemoState();
    return mockResponse(200, txn);
  }

  if (url.startsWith('/api/transactions/') && method === 'DELETE') {
    if (!user || !['admin', 'analyst'].includes(user.role)) return mockResponse(403, { error: 'Forbidden' });
    const id = decodeURIComponent(url.split('/').pop());
    const index = demoState.transactions.findIndex((txn) => txn.id === id);
    if (index === -1) return mockResponse(404, { error: 'Transaction not found' });
    const removed = demoState.transactions.splice(index, 1)[0];
    demoState.cases = demoState.cases.filter((item) => item.transactionId !== id);
    saveDemoState();
    return mockResponse(200, { message: `Transaction ${id} deleted`, transaction: removed });
  }

  if (url.startsWith('/api/cases/') && method === 'POST') {
    if (!user || !['admin', 'analyst'].includes(user.role)) return mockResponse(403, { error: 'Forbidden' });
    const id = decodeURIComponent(url.split('/').pop());
    const fraudCase = demoState.cases.find((item) => item.id === id);
    if (!fraudCase) return mockResponse(404, { error: 'Case not found' });
    fraudCase.status = String(body.status || 'Resolved');
    fraudCase.timeline.push([`Case ${fraudCase.status}`, new Date().toISOString()]);
    saveDemoState();
    return mockResponse(200, fraudCase);
  }

  if (url.startsWith('/api/cases/') && method === 'DELETE') {
    if (!user || !['admin', 'analyst'].includes(user.role)) return mockResponse(403, { error: 'Forbidden' });
    const id = decodeURIComponent(url.split('/').pop());
    const index = demoState.cases.findIndex((item) => item.id === id);
    if (index === -1) return mockResponse(404, { error: 'Case not found' });
    const removed = demoState.cases.splice(index, 1)[0];
    saveDemoState();
    return mockResponse(200, { message: `Case ${id} deleted`, case: removed });
  }

  return mockResponse(404, { error: 'Not found' });
}

async function apiRequest(path, options = {}) {
  if (IS_GH_PAGES) {
    return mockApiRequest(path, options);
  }
  return fetch(`${API_BASE}${path}`, options);
}

// ============================================================================
// DOM Elements
// ============================================================================
const loginView = document.getElementById('loginView');
const appShell = document.getElementById('appShell');
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const logoutBtnSidebar = document.getElementById('logoutBtnSidebar');

const navAdmin = document.getElementById('navAdmin');
const navCustomer = document.getElementById('navCustomer');
const navAnalyst = document.getElementById('navAnalyst');

const adminView = document.getElementById('adminView');
const customerView = document.getElementById('customerView');
const analystView = document.getElementById('analystView');
const adminCasesList = document.getElementById('adminCasesList');
const adminAnalystsList = document.getElementById('adminAnalystsList');

const userDisplay = document.getElementById('userDisplay');
const engineStatus = document.getElementById('engineStatus');

// Admin Dashboard
const totalTxn = document.getElementById('totalTxn');
const highRiskCount = document.getElementById('highRiskCount');
const blockedCount = document.getElementById('blockedCount');
const pendingCount = document.getElementById('pendingCount');
const approvedCount = document.getElementById('approvedCount');
const transactionsBody = document.getElementById('transactionsBody');
const analysisPanel = document.getElementById('analysisPanel');
const heatMap = document.getElementById('heatMap');
const merchantList = document.getElementById('merchantList');
const simulateBtn = document.getElementById('simulateBtn');
const streamState = document.getElementById('streamState');

// Customer Payment
const paymentForm = document.getElementById('paymentForm');
const locationStatus = document.getElementById('locationStatus');
const captureLocation = document.getElementById('captureLocation');
const customerFreeze = document.getElementById('customerFreeze');
const customerCardStatus = document.getElementById('customerCardStatus');
const customerName = document.getElementById('customerName');
const paymentResult = document.getElementById('paymentResult');
const resultContent = document.getElementById('resultContent');
const customerTransactionsBody = document.getElementById('customerTransactionsBody');

// Analyst
const casesList = document.getElementById('casesList');
const caseDetail = document.getElementById('caseDetail');
const caseSearch = document.getElementById('caseSearch');
const toggleRegisterBtn = document.getElementById('toggleRegisterBtn');
const registerPanel = document.getElementById('registerPanel');
const registerName = document.getElementById('registerName');
const registerEmailField = document.getElementById('registerEmail');
const registerPasswordField = document.getElementById('registerPassword');

const registerBtn = document.getElementById('registerBtn');
const backToLoginBtn = document.getElementById('backToLoginBtn');

// ============================================================================
// Authentication
// ============================================================================
async function login() {
  const email = loginEmail.value.trim().toLowerCase();
  const password = loginPassword.value;

  if (!email || !password) {
    alert('Please fill all fields');
    return;
  }

  try {
    const response = await apiRequest('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Invalid email or password');
    }

    appState.token = result.token;
    appState.user = result.email;
    appState.role = result.role;
    appState.name = result.name;
    userDisplay.textContent = `${result.name} (${result.role.charAt(0).toUpperCase() + result.role.slice(1)})`;
    showApp();
  } catch (error) {
    alert(error.message);
  }
}

function logout() {
  appState.user = null;
  appState.role = null;
  appState.name = null;
  appState.token = null;
  if (appState.eventSource) {
    appState.eventSource.close();
  }
  loginView.classList.add('active');
  appShell.style.display = 'none';
  loginEmail.value = '';
  loginPassword.value = '';
  showRegisterPanel(false);
}

function showRegisterPanel(show) {
  if (!registerPanel) return;
  registerPanel.classList.toggle('hidden', !show);
  if (show) {
    registerName.value = '';
    registerEmailField.value = '';
    registerPasswordField.value = '';
  }
}

async function registerAccount() {
  const name = registerName.value.trim();
  const email = registerEmailField.value.trim().toLowerCase();
  const password = registerPasswordField.value;

  if (!name || !email || !password) {
    alert('Please fill all registration fields.');
    return;
  }

  try {
    const response = await apiRequest('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Registration failed');
    }

    alert(`Customer account created for ${name}. You can now log in.`);
    showRegisterPanel(false);
  } catch (error) {
    alert(error.message);
  }
}

function showApp() {
  loginView.classList.remove('active');
  appShell.style.display = 'flex';
  updateNavigation();

  if (appState.role === 'customer') {
    customerName.textContent = appState.name || 'Customer';
    if (paymentForm) {
      paymentForm.querySelector('input[name="customerName"]').value = appState.name || '';
      paymentForm.querySelector('input[name="email"]').value = appState.user || '';
    }
  }

  connectToLiveStream();
  switchView(appState.role === 'customer' ? 'customer' : appState.role === 'analyst' ? 'analyst' : 'admin');
}

// ============================================================================
// View Management
// ============================================================================
function switchView(viewName) {
  // Hide all views
  adminView.classList.remove('active');
  customerView.classList.remove('active');
  analystView.classList.remove('active');

  // Remove active class from all nav items
  navAdmin.classList.remove('active');
  navCustomer.classList.remove('active');
  navAnalyst.classList.remove('active');

  // Show selected view only if user has permission
  if (viewName === 'admin' && appState.role === 'admin') {
    adminView.classList.add('active');
    navAdmin.classList.add('active');
    return;
  }

  if (viewName === 'analyst' && appState.role === 'analyst') {
    analystView.classList.add('active');
    navAnalyst.classList.add('active');
    loadCases();
    return;
  }

  customerView.classList.add('active');
  navCustomer.classList.add('active');
}

// ============================================================================
// Real-Time Connection
// ============================================================================
async function connectToLiveStream() {
  if (appState.eventSource) {
    appState.eventSource.close();
  }

  await fetchCurrentState();

  const tokenQuery = appState.token ? `?token=${encodeURIComponent(appState.token)}` : '';
  if (IS_GH_PAGES) {
    engineStatus.textContent = 'Static demo mode';
    streamState.textContent = '🟡 Demo';
    streamState.classList.remove('success');
    streamState.classList.add('warn');
    appState.eventSource = {
      close() {
        if (demoState.eventInterval) {
          clearInterval(demoState.eventInterval);
          demoState.eventInterval = null;
        }
      },
    };
    demoState.eventInterval = setInterval(() => fetchCurrentState().catch(() => {}), 3000);
  } else {
    appState.eventSource = new EventSource(`${API_BASE}/api/events${tokenQuery}`);

    appState.eventSource.onopen = () => {
      engineStatus.textContent = 'Connected';
      streamState.textContent = '🟢 Connected';
      streamState.classList.remove('warn');
      streamState.classList.add('success');
    };

    appState.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        updateDashboard(data);
      } catch (e) {
        console.error('Failed to parse event data:', e);
      }
    };

    appState.eventSource.onerror = () => {
      engineStatus.textContent = 'Reconnecting...';
      streamState.textContent = '🟡 Reconnecting...';
      streamState.classList.remove('success');
      streamState.classList.add('warn');

      setTimeout(() => {
        connectToLiveStream().catch(() => {});
      }, 2500);
    };
  }
}

async function fetchCurrentState() {
  try {
    const tokenString = appState.token ? `?token=${encodeURIComponent(appState.token)}` : '';
    const response = await apiRequest(`/api/state${tokenString}`);
    if (!response.ok) return;
    const data = await response.json();
    updateDashboard(data);
  } catch (error) {
    console.error('Could not refresh state:', error);
  }
}

// ============================================================================
// Dashboard Updates
// ============================================================================
function updateDashboard(data) {
  if (!data || !data.stats) return;

  appState.stats = data.stats;
  appState.transactions = data.transactions || [];
  appState.cases = data.cases || [];
  appState.merchants = data.merchants || [];
  appState.analysts = data.analysts || [];

  // Update stats
  totalTxn.textContent = appState.stats.total;
  highRiskCount.textContent = appState.stats.high;
  blockedCount.textContent = appState.stats.blocked;
  pendingCount.textContent = appState.stats.pending;
  approvedCount.textContent = appState.stats.approved;

  // Update transaction table
  renderTransactions();

  // Update heatmap
  renderHeatmap(data.heatmap);

  // Update merchants
  renderMerchants();

  if (appState.role === 'admin') {
    renderAdminAnalysts();
    renderAdminCases();
  }

  // Update analyst case list when new state arrives
  if (appState.role === 'analyst') {
    loadCases();
    if (appState.selectedCase) {
      renderCaseDetail(appState.selectedCase);
    }
  }

  // Update customer view
  if (appState.role === 'customer') {
    renderCustomerTransactions();
  }
}

function renderTransactions() {
  transactionsBody.innerHTML = '';
  appState.transactions.slice(0, 20).forEach((txn) => {
    const row = createTransactionRow(txn);
    transactionsBody.appendChild(row);
  });
}

function createTransactionRow(txn) {
  const row = document.createElement('tr');
  row.className = txn.decision === 'Blocked' ? 'blocked' : txn.score >= 45 ? 'high-risk' : '';
  
  row.innerHTML = `
    <td>
      <strong>${txn.customerName}</strong>
      <br><small>${txn.id}</small>
    </td>
    <td>${txn.merchant}</td>
    <td>₹${txn.amount.toLocaleString('en-IN')}</td>
    <td>${txn.city}</td>
    <td><span class="risk-badge ${getRiskClass(txn.score)}">${txn.score}%</span></td>
    <td>${txn.riskManager || getRiskManagerLabel(txn.score)}</td>
    <td><span class="chip ${getDecisionClass(txn.decision)}">${txn.decision}</span></td>
    <td><small>${new Date(txn.createdAt).toLocaleTimeString()}</small></td>
    <td><button class="delete-transaction">Delete</button></td>
  `;

  row.querySelector('.delete-transaction')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (confirm(`Delete transaction ${txn.id}?`)) {
      deleteTransaction(txn.id);
    }
  });

  row.addEventListener('click', () => {
    appState.selectedTransaction = txn;
    renderAnalysis(txn);
  });

  return row;
}

function getRiskManagerLabel(score) {
  if (score >= 75) return 'Dedicated Risk Team';
  if (score >= 45) return 'Manual Review Queue';
  return 'Automated Approval';
}

function getRiskClass(score) {
  if (score >= 75) return 'danger';
  if (score >= 45) return 'warn';
  return 'success';
}

function getDecisionClass(decision) {
  if (decision === 'Blocked') return 'danger';
  if (decision === 'OTP Required') return 'warn';
  return 'success';
}

function renderAnalysis(txn) {
  const riskLevel = txn.score >= 75 ? 'High' : txn.score >= 45 ? 'Medium' : 'Low';
  const riskColor = txn.score >= 75 ? 'danger' : txn.score >= 45 ? 'warn' : 'success';

  analysisPanel.innerHTML = `
    <div class="analysis-item">
      <div class="risk-score ${riskColor}">${txn.score}%</div>
      <strong>Risk Level: ${riskLevel}</strong>
    </div>

    <div class="analysis-item">
      <strong>Customer:</strong>
      <p>${txn.customerName} (${txn.customerId})</p>
    </div>

    <div class="analysis-item">
      <strong>Transaction Details:</strong>
      <p>
        Merchant: ${txn.merchant}<br>
        Amount: ₹${txn.amount.toLocaleString('en-IN')}<br>
        Location: ${txn.city}${txn.location?.lat && txn.location?.lon ? ` (${txn.location.lat.toFixed(4)}, ${txn.location.lon.toFixed(4)})` : ''}<br>
        Risk Manager: ${txn.riskManager || getRiskManagerLabel(txn.score)}<br>
        Time: ${new Date(txn.createdAt).toLocaleString()}
      </p>
      ${txn.location?.lat && txn.location?.lon ? `<p><strong>Map:</strong> <a href="https://www.google.com/maps?q=${txn.location.lat},${txn.location.lon}" target="_blank">Open GPS location</a></p>` : ''}
    </div>

    <div class="analysis-item">
      <strong>Risk Factors:</strong>
      <div class="reasons-list">
        <ul>
          ${txn.reasons.map(r => `<li>${r}</li>`).join('')}
        </ul>
      </div>
    </div>

    <div class="analysis-item">
      <strong>Decision:</strong>
      <p style="font-weight: 700; color: ${txn.decision === 'Blocked' ? '#dc2626' : txn.decision === 'OTP Required' ? '#f59e0b' : '#10b981'}">
        ${txn.decision}
      </p>
    </div>

    <div class="analysis-item">
      <strong>Recommendation:</strong>
      <p>${txn.recommendation}</p>
    </div>

    <div class="analysis-item">
      <strong>Confidence: ${txn.confidence}%</strong>
      <div style="background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden; margin-top: 0.5rem;">
        <div style="background: #2563eb; height: 100%; width: ${txn.confidence}%;"></div>
      </div>
    </div>

    <div class="analysis-item">
      <strong>AI Report:</strong>
      <p style="font-size: 0.875rem; padding: 1rem; background: #f3f4f6; border-radius: 6px; margin-top: 0.5rem;">
        ${txn.report}
      </p>
    </div>
  `;
}

function renderHeatmap(heatmapData) {
  heatMap.innerHTML = '';
  if (!heatmapData || heatmapData.length === 0) {
    heatMap.innerHTML = '<p style="padding: 1.5rem; text-align: center; color: #999;">No fraud data yet</p>';
    return;
  }

  const maxCount = Math.max(...heatmapData.map(h => h.count));
  heatmapData.forEach((item) => {
    const intensity = item.count / maxCount;
    const div = document.createElement('div');
    div.className = `heatmap-item ${intensity > 0.5 ? 'hot' : ''}`;
    div.innerHTML = `
      <span class="heatmap-item-city">${item.city}</span>
      <span class="heatmap-item-count">${item.count}</span>
    `;
    heatMap.appendChild(div);
  });
}

function renderMerchants() {
  merchantList.innerHTML = '';
  appState.merchants.slice(0, 8).forEach((merchant) => {
    const riskLevel = merchant.risk >= 70 ? 'high' : merchant.risk >= 45 ? 'medium' : 'low';
    const div = document.createElement('div');
    div.className = 'merchant-item';
    div.innerHTML = `
      <span class="merchant-name">${merchant.name}</span>
      <span class="merchant-risk ${riskLevel}">${merchant.risk}%</span>
    `;
    merchantList.appendChild(div);
  });
}

function renderAdminAnalysts() {
  if (!adminAnalystsList) return;
  if (!appState.analysts || appState.analysts.length === 0) {
    adminAnalystsList.innerHTML = '<p style="padding: 1.5rem; text-align: center; color: #999;">No analyst accounts have been registered yet.</p>';
    return;
  }

  adminAnalystsList.innerHTML = '';
  appState.analysts.forEach((analyst) => {
    const div = document.createElement('div');
    div.className = 'case-item';
    div.innerHTML = `
      <div class="case-item-main">
        <div class="case-meta">
          <span class="case-id">${analyst.name}</span>
          <span class="chip success">Analyst</span>
        </div>
        <span class="case-customer">${analyst.email}</span>
      </div>
    `;
    adminAnalystsList.appendChild(div);
  });
}

function renderAdminCases() {
  if (!adminCasesList) return;
  if (!appState.cases || appState.cases.length === 0) {
    adminCasesList.innerHTML = '<p style="padding: 1.5rem; text-align: center; color: #999;">No cases have been created yet.</p>';
    return;
  }

  adminCasesList.innerHTML = '';
  appState.cases.slice(0, 12).forEach((caseItem) => {
    const statusClass = caseItem.status === 'Resolved' ? 'success' : caseItem.status === 'Pending Approval' || caseItem.status === 'Verification Pending' ? 'warn' : 'danger';
    const div = document.createElement('div');
    div.className = 'case-item';
    div.innerHTML = `
      <div class="case-item-main">
        <div class="case-meta">
          <span class="case-id">${caseItem.id}</span>
          <span class="chip ${statusClass}">${caseItem.status}</span>
        </div>
        <span class="case-customer">${caseItem.customerName} - ₹${caseItem.amount}</span>
        <span class="case-customer">Priority: ${caseItem.priority}</span>
        <span class="case-creator">Created by: ${caseItem.createdByName || 'Unknown'} (${caseItem.createdByRole || 'customer'})</span>
      </div>
      <div class="case-actions">
        <button class="btn-primary small approve-case">Approve</button>
        <button class="btn-danger small block-case">Block</button>
      </div>
    `;

    div.querySelector('.approve-case')?.addEventListener('click', () => updateCaseStatus(caseItem.id, 'Approved'));
    div.querySelector('.block-case')?.addEventListener('click', () => updateCaseStatus(caseItem.id, 'Blocked'));

    adminCasesList.appendChild(div);
  });
}

function updateNavigation() {
  navAdmin.style.display = appState.role === 'admin' ? '' : 'none';
  navAnalyst.style.display = appState.role === 'analyst' ? '' : 'none';
  navCustomer.style.display = appState.role === 'customer' ? '' : 'none';
}

// ============================================================================
// Customer Payment
// ============================================================================
function getCurrentTimestamp() {
  return new Date().toLocaleTimeString();
}

let liveLocation = null;

function generateDeviceFingerprint() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f60';
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = '#069';
  ctx.fillText('Browser Fingerprint', 2, 15);
  ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
  ctx.fillText('Canvas FP', 4, 17);

  return canvas.toDataURL();
}

function displayPaymentResult(transaction) {
  paymentResult.style.display = 'block';
  paymentResult.className = '';

  if (transaction.decision === 'Blocked') {
    paymentResult.classList.add('danger');
  } else if (transaction.decision === 'OTP Required' || transaction.decision === 'Pending Review') {
    paymentResult.classList.add('warn');
  } else {
    paymentResult.classList.add('success');
  }

  const riskClass = transaction.score >= 75 ? 'danger' : transaction.score >= 45 ? 'warn' : 'success';

  resultContent.innerHTML = `
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
      <div>
        <p><strong>Transaction ID:</strong> ${transaction.id}</p>
        <p><strong>Amount:</strong> ₹${transaction.amount.toLocaleString('en-IN')}</p>
        <p><strong>Merchant:</strong> ${transaction.merchant}</p>
        <p><strong>Location:</strong> ${transaction.city}${transaction.location?.lat && transaction.location?.lon ? ` (${transaction.location.lat.toFixed(4)}, ${transaction.location.lon.toFixed(4)})` : ''}</p>
        <p><strong>Risk Manager:</strong> ${transaction.riskManager || getRiskManagerLabel(transaction.score)}</p>
      </div>
      <div>
        <p><strong>Decision:</strong> <span style="color: ${transaction.decision === 'Blocked' ? '#dc2626' : transaction.decision === 'OTP Required' ? '#f59e0b' : '#10b981'}; font-weight: 700;">⚡ ${transaction.decision}</span></p>
        <p><strong>Risk Score:</strong> <span class="risk-badge ${riskClass}">${transaction.score}%</span></p>
        <p><strong>Confidence:</strong> ${transaction.confidence}%</p>
        <p><strong>Time:</strong> ${new Date(transaction.createdAt).toLocaleTimeString()}</p>
        <p><strong>Fingerprint:</strong> ${transaction.deviceHash || transaction.deviceFingerprint}</p>
        ${transaction.location?.lat && transaction.location?.lon ? `<p><strong>Map:</strong> <a href="https://www.google.com/maps?q=${transaction.location.lat},${transaction.location.lon}" target="_blank">View on map</a></p>` : ''}
      </div>
    </div>
    <div style="margin-top: 1rem; padding: 1rem; background: rgba(0,0,0,0.05); border-radius: 6px;">
      <strong>AI Report:</strong>
      <p style="margin-top: 0.5rem; font-size: 0.875rem;">${transaction.report}</p>
    </div>
  `;
}

async function deleteTransaction(transactionId) {
  try {
    const response = await apiRequest(`/api/transactions/${encodeURIComponent(transactionId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${appState.token}`,
      },
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || 'Unable to delete transaction');
    }

    appState.transactions = appState.transactions.filter((txn) => txn.id !== transactionId);
    appState.cases = appState.cases.filter((item) => item.transactionId !== transactionId);
    renderTransactions();

    if (appState.selectedTransaction?.id === transactionId) {
      appState.selectedTransaction = null;
      analysisPanel.innerHTML = '<p style="padding: 1.5rem; color: #999;">Transaction deleted or no longer available.</p>';
    }
  } catch (error) {
    console.error('Delete failed:', error);
    alert(`Could not delete transaction. ${error.message}`);
  }
}

function renderCustomerTransactions() {
  customerTransactionsBody.innerHTML = '';
  appState.transactions.slice(0, 10).forEach((txn) => {
    const row = document.createElement('tr');
    const riskClass = txn.score >= 75 ? 'danger' : txn.score >= 45 ? 'warn' : 'success';
    const decisionClass = txn.decision === 'Blocked' ? 'danger' : txn.decision === 'OTP Required' || txn.decision === 'Pending Review' ? 'warn' : 'success';

    row.innerHTML = `
      <td>${new Date(txn.createdAt).toLocaleDateString()}</td>
      <td>${txn.merchant}</td>
      <td>₹${txn.amount.toLocaleString('en-IN')}</td>
      <td><span class="chip ${decisionClass}">${txn.decision}</span></td>
      <td><span class="risk-badge ${riskClass}">${txn.score}%</span></td>
    `;
    customerTransactionsBody.appendChild(row);
  });
}

// ============================================================================
// Case Management
// ============================================================================
function loadCases() {
  if (appState.cases.length === 0) {
    casesList.innerHTML = '<p style="padding: 1.5rem; text-align: center; color: #999;">No cases yet</p>';
    return;
  }

  casesList.innerHTML = '';
  appState.cases.forEach((caseItem) => {
    const statusClass = caseItem.status === 'Resolved' ? 'success' : caseItem.status === 'Verification Pending' ? 'warn' : 'danger';
    const div = document.createElement('div');
    div.className = `case-item ${appState.selectedCase?.id === caseItem.id ? 'selected' : ''}`;
    div.innerHTML = `
      <div class="case-item-main">
        <div class="case-meta">
          <span class="case-id">${caseItem.id}</span>
          <span class="chip ${statusClass}">${caseItem.status}</span>
        </div>
        <span class="case-customer">${caseItem.customerName} - ₹${caseItem.amount}</span>
        <span class="case-customer">Priority: ${caseItem.priority}</span>
        <span class="case-creator">Created by: ${caseItem.createdByName || 'Unknown'} (${caseItem.createdByRole || 'customer'})</span>
      </div>
      <button class="btn-danger btn-secondary small case-delete" title="Delete case" type="button">🗑️</button>
    `;

    div.querySelector('.case-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteCase(caseItem.id);
    });

    div.addEventListener('click', () => {
      appState.selectedCase = caseItem;
      loadCases();
      renderCaseDetail(caseItem);
    });
    casesList.appendChild(div);
  });
}

function renderCaseDetail(caseItem) {
  const linkedTransaction = appState.transactions.find((txn) => txn.id === caseItem.transactionId);
  const gpsLocation = linkedTransaction?.location?.lat && linkedTransaction?.location?.lon
    ? `${linkedTransaction.location.lat.toFixed(4)}, ${linkedTransaction.location.lon.toFixed(4)}`
    : 'Not captured';
  const mapLink = linkedTransaction?.location?.lat && linkedTransaction?.location?.lon
    ? `<p><strong>Map:</strong> <a href="https://www.google.com/maps?q=${linkedTransaction.location.lat},${linkedTransaction.location.lon}" target="_blank">View GPS location</a></p>`
    : '';
  const priorityColor = caseItem.priority === 'High' ? 'danger' : caseItem.priority === 'Medium' ? 'warn' : 'success';

  caseDetail.innerHTML = `
    <div class="analysis-item">
      <strong>Case ID:</strong>
      <p>${caseItem.id}</p>
    </div>

    <div class="analysis-item">
      <strong>Customer:</strong>
      <p>${caseItem.customerName}</p>
    </div>

    <div class="analysis-item">
      <strong>Created By:</strong>
      <p>${caseItem.createdByName || 'Unknown'} (${caseItem.createdByRole || 'customer'})</p>
    </div>

    <div class="analysis-item">
      <strong>Details:</strong>
      <p>
        Merchant: ${caseItem.merchant}<br>
        Amount: ₹${caseItem.amount.toLocaleString('en-IN')}<br>
        Risk Score: ${caseItem.score}%<br>
        Priority: <span class="risk-badge ${priorityColor}">${caseItem.priority}</span><br>
        Status: <span class="chip ${caseItem.status === 'Resolved' ? 'success' : caseItem.status === 'Blocked' ? 'danger' : caseItem.status === 'Open' ? 'danger' : 'warn'}">${caseItem.status}</span><br>
        Decision: ${linkedTransaction?.decision || 'Pending Review'}<br>
        GPS: ${gpsLocation}
      </p>
      ${mapLink}
    </div>

    <div class="case-timeline">
      <strong style="display: block; margin-bottom: 1rem;">Investigation Timeline:</strong>
      ${caseItem.timeline.map((event, idx) => `
        <div class="timeline-item">
          <div class="timeline-marker"></div>
          <div class="timeline-content">
            <div class="timeline-time">${new Date(event[1]).toLocaleTimeString()}</div>
            <div class="timeline-message">${event[0]}</div>
          </div>
        </div>
      `).join('')}
    </div>

    <div style="display: flex; gap: 1rem; margin-top: 1.5rem; flex-wrap: wrap;">
      <button class="btn-warning" onclick="updateCaseStatus('${caseItem.id}', 'Approved')">Approve Transaction</button>
      <button class="btn-danger" onclick="updateCaseStatus('${caseItem.id}', 'Blocked')">Block Transaction</button>
      <button class="btn-danger" onclick="deleteCase('${caseItem.id}')">🗑️ Delete Case</button>
    </div>
  `;
}

async function updateCaseStatus(caseId, status) {
  try {
    const fraudCase = appState.cases.find((item) => item.id === caseId);
    if (!fraudCase) {
      throw new Error('Case not found locally');
    }

    let response;
    if (status === 'Approved' || status === 'Blocked') {
      response = await apiRequest(`/api/transactions/${encodeURIComponent(fraudCase.transactionId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${appState.token}` },
        body: JSON.stringify({ status }),
      });
    } else {
      const resolvedStatus = status === 'Verified' ? 'Resolved' : status;
      response = await apiRequest(`/api/cases/${encodeURIComponent(caseId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${appState.token}` },
        body: JSON.stringify({ status: resolvedStatus }),
      });
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `Unable to update case ${caseId}`);
    }

    alert(`Case ${caseId} marked as ${status}`);
    await fetchCurrentState();
    if (appState.selectedCase?.id === caseId) {
      const refreshedCase = appState.cases.find((item) => item.id === caseId);
      if (refreshedCase) {
        appState.selectedCase = refreshedCase;
        renderCaseDetail(appState.selectedCase);
      }
    }
    loadCases();
  } catch (error) {
    console.error('Failed to update case:', error);
    alert(`Unable to update case status. ${error.message}`);
  }
}

async function deleteCase(caseId) {
  const confirmed = confirm('Delete this case permanently? This cannot be undone.');
  if (!confirmed) return;

  try {
    const response = await apiRequest(`/api/cases/${encodeURIComponent(caseId)}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${appState.token}`,
      },
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `Unable to delete case ${caseId}`);
    }

    alert(`Case ${caseId} deleted successfully.`);
    appState.cases = appState.cases.filter((item) => item.id !== caseId);
    if (appState.selectedCase?.id === caseId) {
      appState.selectedCase = null;
      caseDetail.innerHTML = '<p style="padding: 1.5rem; color: #999;">No case selected.</p>';
    }
    loadCases();
    await fetchCurrentState();
  } catch (error) {
    console.error('Failed to delete case:', error);
    alert(`Unable to delete case. ${error.message}`);
  }
}

// ============================================================================
// Simulation
// ============================================================================
simulateBtn.addEventListener('click', async () => {
  const merchants = ['Amazon', 'Flipkart', 'Unknown Site', 'Fashion Store', 'Gaming Platform'];
  const cities = ['Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Chennai'];
  const customers = ['Durga', 'Rajesh', 'Priya', 'Vikram', 'Neha'];

  const simulation = {
    customerName: customers[Math.floor(Math.random() * customers.length)],
    email: `customer${Math.floor(Math.random() * 1000)}@aiga.com`,
    merchant: merchants[Math.floor(Math.random() * merchants.length)],
    amount: Math.floor(Math.random() * 50000) + 5000,
    city: cities[Math.floor(Math.random() * cities.length)],
    deviceFingerprint: 'device-' + Math.random().toString(36).substr(2, 9),
    location: {
      lat: 28 + Math.random() * 5,
      lon: 77 + Math.random() * 5,
    },
    network: {
      online: true,
      timezone: 'Asia/Kolkata',
    },
  };

  try {
    await apiRequest('/api/transactions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(appState.token ? { Authorization: `Bearer ${appState.token}` } : {}),
      },
      body: JSON.stringify(simulation),
    });
  } catch (error) {
    console.error('Simulation failed:', error);
  }
});

// ============================================================================
// Event Listeners (Deferred)
// ============================================================================
window.addEventListener('load', () => {
  // Set default demo credentials
  loginEmail.value = 'admin@aiga.com';
  loginPassword.value = '1234';

  // Now add all event listeners safely
  loginBtn?.addEventListener('click', login);
  logoutBtn?.addEventListener('click', logout);
  logoutBtnSidebar?.addEventListener('click', logout);

  navAdmin?.addEventListener('click', () => switchView('admin'));
  navCustomer?.addEventListener('click', () => switchView('customer'));
  navAnalyst?.addEventListener('click', () => switchView('analyst'));

  caseSearch?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const items = casesList?.querySelectorAll('.case-item') || [];
    items.forEach((item) => {
      const text = item.textContent.toLowerCase();
      item.style.display = text.includes(query) ? '' : 'none';
    });
  });

  // Payment form listener
  if (paymentForm) {
    paymentForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(paymentForm);
      const transaction = {
        customerName: formData.get('customerName'),
        email: formData.get('email'),
        merchant: formData.get('merchant'),
        amount: parseInt(formData.get('amount')),
        city: formData.get('city'),
        deviceFingerprint: generateDeviceFingerprint(),
        location: liveLocation || { lat: 28.6139, lon: 77.2090 }, // Delhi default
        network: {
          online: navigator.onLine,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };

      try {
        const response = await apiRequest('/api/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${appState.token}`,
          },
          body: JSON.stringify(transaction),
        });

        const result = await response.json();
        displayPaymentResult(result);
      } catch (error) {
        console.error('Payment failed:', error);
        alert('Payment processing failed');
      }
    });
  }

  // GPS capture button
  if (captureLocation) {
    captureLocation.addEventListener('click', () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            liveLocation = {
              lat: position.coords.latitude,
              lon: position.coords.longitude,
            };
            if (locationStatus) {
              locationStatus.textContent = `GPS: ${liveLocation.lat.toFixed(4)}, ${liveLocation.lon.toFixed(4)}`;
            }
          },
          () => {
            if (locationStatus) {
              locationStatus.textContent = 'GPS access denied';
            }
          }
        );
      }
    });
  }

  // Freeze card button
  if (customerFreeze) {
    customerFreeze.addEventListener('click', () => {
      if (customerCardStatus) {
        customerCardStatus.textContent = '🔴 Card Frozen';
        customerCardStatus.classList.remove('success');
        customerCardStatus.classList.add('danger');
        alert('Card has been frozen');
      }
    });
  }

  toggleRegisterBtn?.addEventListener('click', () => showRegisterPanel(true));
  backToLoginBtn?.addEventListener('click', () => showRegisterPanel(false));
  registerBtn?.addEventListener('click', registerAccount);
});
