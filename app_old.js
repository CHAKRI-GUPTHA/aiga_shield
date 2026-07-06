let appState = {
  stats: { total: 0, blocked: 0, pending: 0, high: 0, approved: 0 },
  transactions: [],
  cases: [],
  merchants: [],
  heatmap: [],
};

let selectedId = null;
let lastResult = null;
let liveLocation = null;
const API_BASE = "";

const statsGrid = document.querySelector("#statsGrid");
const transactionsBody = document.querySelector("#transactionsBody");
const analysisPanel = document.querySelector("#analysisPanel");
const heatMap = document.querySelector("#heatMap");
const merchantList = document.querySelector("#merchantList");
const caseList = document.querySelector("#caseList");
const assistantBox = document.querySelector("#assistantBox");
const cardState = document.querySelector("#cardState");
const streamState = document.querySelector("#streamState");
const simulateBtn = document.querySelector("#simulateBtn");

function riskClass(score) {
  if (score >= 75) return "danger";
  if (score >= 45) return "warn";
  return "success";
}

function formatMoney(amount) {
  return `Rs ${Number(amount || 0).toLocaleString("en-IN")}`;
}

function hashText(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return `fp-${Math.abs(hash).toString(16)}`;
}

function collectDeviceContext() {
  const screenData = `${screen.width}x${screen.height}x${screen.colorDepth}`;
  const plugins = Array.from(navigator.plugins || []).map((plugin) => plugin.name).join(",");
  const raw = [
    navigator.userAgent,
    navigator.language,
    navigator.platform,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    screenData,
    navigator.hardwareConcurrency,
    navigator.deviceMemory,
    plugins,
  ].join("|");

  return {
    deviceFingerprint: hashText(raw),
    network: {
      online: navigator.onLine,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      screen: screenData,
    },
  };
}

function requestLocation() {
  if (!navigator.geolocation) return;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      liveLocation = {
        lat: Number(position.coords.latitude.toFixed(5)),
        lon: Number(position.coords.longitude.toFixed(5)),
      };
      updateLocationText("Live GPS captured");
    },
    () => updateLocationText("GPS denied; city input will be used"),
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
  );
}

function updateLocationText(text) {
  const node = document.querySelector("#locationStatus");
  if (node) node.textContent = text;
}

function renderStats() {
  const stats = [
    ["Total Transactions", appState.stats.total],
    ["Fraud Detected", appState.stats.high],
    ["Blocked", appState.stats.blocked],
    ["Pending Review", appState.stats.pending],
    ["Approved", appState.stats.approved],
  ];

  statsGrid.innerHTML = stats
    .map(([label, value]) => `<article class="stat"><span>${label}</span><strong>${value}</strong></article>`)
    .join("");
}

function renderTransactions() {
  if (!appState.transactions.length) {
    transactionsBody.innerHTML = `<tr><td colspan="6">No live payments yet. Submit a payment from the customer panel.</td></tr>`;
    return;
  }

  transactionsBody.innerHTML = appState.transactions
    .map(
      (txn) => `
      <tr class="${txn.id === selectedId ? "selected" : ""}" data-id="${txn.id}">
        <td><strong>${txn.customerName}</strong><br><span>${txn.id}</span></td>
        <td>${txn.merchant}</td>
        <td>${formatMoney(txn.amount)}</td>
        <td>${txn.city}</td>
        <td><span class="chip ${riskClass(txn.score)}">${txn.score}%</span></td>
        <td><span class="chip ${riskClass(txn.score)}">${txn.decision}</span></td>
      </tr>`
    )
    .join("");

  document.querySelectorAll("tbody tr[data-id]").forEach((row) => {
    row.addEventListener("click", () => {
      selectedId = row.dataset.id;
      render();
    });
  });
}

function renderAnalysis() {
  const txn = appState.transactions.find((item) => item.id === selectedId) || appState.transactions[0];

  if (!txn) {
    analysisPanel.innerHTML = `
      <div class="empty-state">
        <strong>Waiting for a real payment</strong>
        <p>Submit a transaction from the customer dashboard. The backend will analyze it instantly.</p>
      </div>
    `;
    return;
  }

  selectedId = txn.id;
  const fillClass = txn.score >= 75 ? "high" : txn.score >= 45 ? "medium" : "";
  analysisPanel.innerHTML = `
    <div class="risk-meter">
      <div class="risk-score">${txn.score}%</div>
      <div class="meter-track"><div class="meter-fill ${fillClass}" style="width: ${txn.score}%"></div></div>
    </div>
    <div class="reason-list">
      ${txn.reasons.map((reason) => `<div class="reason">${reason}</div>`).join("")}
    </div>
    <div class="recommendation">
      <strong>Decision:</strong> ${txn.decision}<br>
      <strong>Recommendation:</strong> ${txn.recommendation}<br>
      <strong>Confidence:</strong> ${txn.confidence}%<br>
      <strong>AI Report:</strong> ${txn.report}
    </div>
  `;
}

function renderHeatMap() {
  if (!appState.heatmap.length) {
    heatMap.innerHTML = `<div class="map-empty">Fraud locations appear here as real payments arrive.</div>`;
    return;
  }

  heatMap.innerHTML = appState.heatmap
    .map((city, index) => {
      const positions = [
        [47, 25],
        [34, 62],
        [52, 65],
        [49, 78],
        [56, 84],
        [42, 48],
      ];
      const [x, y] = positions[index % positions.length];
      const size = 42 + city.count * 10;
      return `<div class="city" style="left:${x}%; top:${y}%; --size:${size}px" title="${city.city}">${city.count}</div>`;
    })
    .join("");
}

function renderMerchants() {
  if (!appState.merchants.length) {
    merchantList.innerHTML = `<div class="reason">Merchant risk will adapt from submitted transaction history.</div>`;
    return;
  }

  merchantList.innerHTML = appState.merchants
    .map((merchant) => `<div class="merchant"><strong>${merchant.name}</strong><span class="chip ${riskClass(merchant.risk)}">${merchant.risk}%</span></div>`)
    .join("");
}

function renderCases() {
  if (!appState.cases.length) {
    caseList.innerHTML = `<div class="reason">No analyst cases yet. Medium and high risk payments create cases automatically.</div>`;
    return;
  }

  caseList.innerHTML = appState.cases
    .map(
      (item) => `
      <div class="case-item">
        <div>
          <strong>${item.id}</strong>
          <span>${item.customerName} - ${item.merchant} - ${formatMoney(item.amount)} - ${item.priority} priority</span>
        </div>
        <button class="primary-button case-resolve" data-id="${item.id}">${item.status}</button>
      </div>`
    )
    .join("");

  document.querySelectorAll(".case-resolve").forEach((button) => {
    button.addEventListener("click", async () => {
      await resolveCase(button.dataset.id);
    });
  });
}

function renderAssistant() {
  if (!lastResult) {
    assistantBox.innerHTML = "Submit a payment to receive the customer notification and AI explanation.";
    return;
  }

  assistantBox.innerHTML = `
    <strong>${lastResult.decision}</strong><br>
    ${lastResult.report}<br><br>
    Customer message: Did you make a payment of <strong>${formatMoney(lastResult.amount)}</strong> at <strong>${lastResult.merchant}</strong> from <strong>${lastResult.city}</strong>?
  `;
}

function renderCardState() {
  const blocked = lastResult?.decision === "Blocked";
  cardState.textContent = blocked ? "Temporarily Frozen" : "Active";
  cardState.className = `chip ${blocked ? "danger" : "success"}`;
}

function renderPortWarning() {
  if (location.port === "5173" || document.querySelector(".port-warning")) return;

  const warning = document.createElement("div");
  warning.className = "port-warning";
  warning.innerHTML = `Use <strong>http://localhost:5173</strong> for the real-time engine.`;
  document.querySelector(".main").prepend(warning);
}

function render() {
  renderPortWarning();
  renderStats();
  renderTransactions();
  renderAnalysis();
  renderHeatMap();
  renderMerchants();
  renderCases();
  renderAssistant();
  renderCardState();
}

async function submitPayment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const context = collectDeviceContext();

  const payload = {
    customerName: formData.get("customerName"),
    email: formData.get("email"),
    customerId: formData.get("email"),
    merchant: formData.get("merchant"),
    amount: Number(formData.get("amount")),
    city: formData.get("city"),
    cardLast4: formData.get("cardLast4"),
    location: liveLocation || {},
    ...context,
  };

  let response;
  try {
    response = await fetch(`${API_BASE}/api/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    alert("Real-time engine is not running. Start open-aiga.bat, then open http://localhost:5173");
    return;
  }

  if (!response.ok) {
    alert("Transaction failed because the page is not connected to the real-time engine. Open http://localhost:5173 and try again.");
    return;
  }

  lastResult = await response.json();
  selectedId = lastResult.id;
  form.reset();
  document.querySelector("#lastPaymentResult").innerHTML = `
    <span class="chip ${riskClass(lastResult.score)}">${lastResult.decision}</span>
    <strong>${lastResult.score}% Risk</strong>
    <p>${lastResult.recommendation}</p>
  `;
}

async function resolveCase(id) {
  await fetch(`${API_BASE}/api/cases/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "Resolved" }),
  });
}

function connectEvents() {
  const events = new EventSource(`${API_BASE}/api/events`);
  events.onopen = () => {
    streamState.textContent = "Real-time connected";
    streamState.className = "chip success";
  };
  events.onerror = () => {
    streamState.textContent = "Reconnecting";
    streamState.className = "chip warn";
  };
  events.onmessage = (message) => {
    appState = JSON.parse(message.data);
    if (!selectedId && appState.transactions[0]) selectedId = appState.transactions[0].id;
    render();
  };
}

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((nav) => nav.classList.remove("active"));
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
    item.classList.add("active");
    document.querySelector(`#${item.dataset.view}View`).classList.add("active");
  });
});

simulateBtn.textContent = "Pay";
simulateBtn.title = "Open customer payment";
simulateBtn.addEventListener("click", () => {
  document.querySelector('[data-view="customer"]').click();
});

document.querySelector("#paymentForm").addEventListener("submit", submitPayment);
document.querySelector("#captureLocation").addEventListener("click", requestLocation);
document.querySelector("#freezeBtn").addEventListener("click", () => {
  alert("In production this calls your card processor or bank API to freeze the card.");
});
document.querySelector("#customerFreeze").addEventListener("click", () => {
  alert("In production this calls your card processor or bank API to freeze the card.");
});

connectEvents();
render();
