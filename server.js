const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const port = Number(process.env.PORT) || 5173;

const state = {
  transactions: [],
  cases: [],
  customers: new Map(),
  merchants: new Map(),
  clients: new Set(),
};

const users = new Map([
  ['admin@aiga.com', { email: 'admin@aiga.com', password: '1234', role: 'admin', name: 'Admin User' }],
  ['customer@aiga.com', { email: 'customer@aiga.com', password: '1234', role: 'customer', name: 'Customer User' }],
  ['analyst@aiga.com', { email: 'analyst@aiga.com', password: '1234', role: 'analyst', name: 'Analyst User' }],
]);

const sessions = new Map();

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        request.destroy();
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
  });
  response.end(JSON.stringify(payload));
}

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

function getAuthToken(request) {
  const authHeader = request.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    return url.searchParams.get('token');
  } catch {
    return null;
  }
}

function authenticate(request) {
  const token = getAuthToken(request);
  if (!token) return null;
  return sessions.get(token) || null;
}

function authorize(request, allowedRoles = []) {
  const user = authenticate(request);
  if (!user) {
    return { authorized: false, status: 401, error: 'Authentication required' };
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return { authorized: false, status: 403, error: 'Forbidden' };
  }
  return { authorized: true, user };
}

function broadcast() {
  for (const client of state.clients) {
    const payload = `data: ${JSON.stringify(snapshot(client.user))}\n\n`;
    client.response.write(payload);
  }
}

function merchantRisk(merchantName) {
  const key = merchantName.trim().toLowerCase();
  const merchant = state.merchants.get(key) || {
    name: merchantName,
    total: 0,
    blocked: 0,
    risk: 25,
  };

  const suspiciousWords = ["unknown", "gift", "crypto", "bet", "loan", "gateway", "foreign", "dark"];
  const keywordRisk = suspiciousWords.some((word) => key.includes(word)) ? 38 : 0;
  const historyRisk = merchant.total ? Math.round((merchant.blocked / merchant.total) * 60) : 0;
  return Math.min(100, merchant.risk + keywordRisk + historyRisk);
}

function distanceKm(a, b) {
  if (!a?.lat || !a?.lon || !b?.lat || !b?.lon) return null;
  const toRad = (value) => (value * Math.PI) / 180;
  const radius = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * radius * Math.asin(Math.sqrt(h)));
}

function riskLevel(score) {
  if (score >= 75) return "High Risk";
  if (score >= 45) return "Medium Risk";
  return "Low Risk";
}

function analyzeTransaction(input) {
  const now = new Date();
  const customerId = String(input.customerId || input.email || "customer").trim().toLowerCase();
  const customerName = String(input.customerName || "Customer").trim();
  const amount = Number(input.amount || 0);
  const merchantName = String(input.merchant || "Unknown Merchant").trim();
  const city = String(input.city || "Unknown").trim();
  const deviceHash = String(input.deviceFingerprint || "unknown-device");
  const location = input.location || {};
  const customer = state.customers.get(customerId) || {
    id: customerId,
    name: customerName,
    devices: new Set(),
    locations: [],
    transactions: [],
    avgAmount: 0,
  };

  const previous = customer.transactions[0];
  const tenMinutesAgo = now.getTime() - 10 * 60 * 1000;
  const recent = customer.transactions.filter((txn) => new Date(txn.createdAt).getTime() >= tenMinutesAgo);
  const avgAmount = customer.avgAmount || amount;
  const merchRisk = merchantRisk(merchantName);
  const km = previous ? distanceKm(previous.location, location) : null;
  const minutesSinceLast = previous
    ? Math.max(1, Math.round((now.getTime() - new Date(previous.createdAt).getTime()) / 60000))
    : null;

  const reasons = [];
  let score = 8;

  if (!customer.devices.has(deviceHash) && customer.transactions.length > 0) {
    score += 20;
    reasons.push("New device fingerprint detected");
  }

  if (amount > Math.max(15000, avgAmount * 2.5)) {
    score += 22;
    reasons.push("Transaction amount is unusually high for this customer");
  }

  if (recent.length >= 3) {
    score += 18;
    reasons.push("Transaction velocity is higher than normal");
  }

  if (merchRisk >= 70) {
    score += 24;
    reasons.push("Merchant risk is high based on name and live history");
  } else if (merchRisk >= 45) {
    score += 12;
    reasons.push("Merchant has medium risk signals");
  }

  if (previous && previous.city !== city) {
    score += 10;
    reasons.push(`Location changed from ${previous.city} to ${city}`);
  }

  if (km && minutesSinceLast && km > 500 && minutesSinceLast < 120) {
    score += 28;
    reasons.push(`Impossible travel detected: ${km} km in ${minutesSinceLast} minutes`);
  }

  if (input.network?.timezone && previous?.network?.timezone && input.network.timezone !== previous.network.timezone) {
    score += 8;
    reasons.push("Timezone changed from previous transaction");
  }

  if (input.network?.online === false) {
    score += 8;
    reasons.push("Browser reported unstable network state");
  }

  if (reasons.length === 0) {
    reasons.push("Known customer context, normal amount, familiar device, and acceptable velocity");
  }

  score = Math.min(99, Math.max(1, score));
  const decision = score >= 75 ? "Blocked" : "Pending Review";
  const recommendation =
    decision === "Blocked"
      ? "Block transaction, freeze card temporarily, notify customer, and create analyst case."
      : "Hold transaction pending administrative review and approval.";

  const riskManager =
    score >= 75
      ? "Dedicated Risk Team"
      : score >= 45
        ? "Manual Review Queue"
        : "Behavior Monitoring Team";

  const id = `TXN-${crypto.randomInt(100000, 999999)}`;
  const report = `Customer ${customerName} attempted a payment of Rs ${amount.toLocaleString("en-IN")} at ${merchantName} from ${city}. AIGA Shield analyzed customer history, merchant risk, location, device fingerprint, network context, and transaction velocity. Risk score is ${score}%. Decision: ${decision}. Recommendation: ${recommendation}`;
  const transaction = {
    id,
    createdAt: now.toISOString(),
    customerId,
    customerName,
    merchant: merchantName,
    amount,
    city,
    location,
    deviceHash,
    network: input.network || {},
    score,
    level: riskLevel(score),
    decision,
    recommendation,
    confidence: Math.min(99, score + 3),
    riskManager,
    reasons,
    report,
  };

  customer.name = customerName;
  customer.devices.add(deviceHash);
  customer.locations.unshift({ city, location, at: now.toISOString() });
  customer.transactions.unshift(transaction);
  customer.avgAmount = Math.round(
    customer.transactions.reduce((sum, txn) => sum + txn.amount, 0) / customer.transactions.length
  );
  state.customers.set(customerId, customer);

  const merchantKey = merchantName.toLowerCase();
  const merchant = state.merchants.get(merchantKey) || { name: merchantName, total: 0, blocked: 0, risk: 25 };
  merchant.total += 1;
  if (decision === "Blocked") merchant.blocked += 1;
  merchant.risk = Math.min(100, Math.round(25 + (merchant.blocked / merchant.total) * 70));
  state.merchants.set(merchantKey, merchant);

  state.transactions.unshift(transaction);
  state.transactions = state.transactions.slice(0, 100);

  if (decision !== "Blocked" || score >= 45) {
    state.cases.unshift({
      id: `CASE-${crypto.randomInt(1000, 9999)}-${id}`,
      transactionId: id,
      customerId,
      customerName,
      merchant: merchantName,
      amount,
      score,
      priority: score >= 75 ? "High" : score >= 45 ? "Medium" : "Low",
      status: score >= 75 ? "Open" : "Verification Pending",
      createdBy: input.createdBy || customerId,
      createdByName: input.createdByName || customerName,
      createdByRole: input.createdByRole || 'customer',
      timeline: [
        ["Transaction received", now.toISOString()],
        [`Fraud detected (${score}%)`, now.toISOString()],
        [decision, now.toISOString()],
        ["Customer notification prepared", now.toISOString()],
        ["AI report generated", now.toISOString()],
      ],
    });
    state.cases = state.cases.slice(0, 50);
  }

  return transaction;
}

function snapshot(user) {
  const allTransactions = state.transactions;
  const allCases = state.cases;

  const transactions = user && user.role === 'customer'
    ? allTransactions.filter((txn) => txn.customerId === user.email)
    : allTransactions;

  const cases = user && user.role === 'customer'
    ? allCases.filter((item) => item.customerId === user.email)
    : allCases;

  const blocked = transactions.filter((txn) => txn.decision === 'Blocked').length;
  const pending = transactions.filter((txn) => txn.decision === 'OTP Required').length;

  const analysts = user && user.role === 'admin'
    ? [...users.values()]
        .filter((u) => u.role === 'analyst')
        .map((u) => ({ email: u.email, name: u.name, role: u.role }))
    : [];
  const high = transactions.filter((txn) => txn.score >= 75).length;
  const cities = new Map();
  for (const txn of transactions) {
    cities.set(txn.city, (cities.get(txn.city) || 0) + (txn.score >= 45 ? 1 : 0));
  }

  return {
    stats: {
      total: transactions.length,
      blocked,
      pending,
      high,
      approved: transactions.filter((txn) => txn.decision === 'Approved').length,
    },
    transactions,
    cases,
    analysts,
    merchants: user && user.role === 'customer' ? [] : [...state.merchants.values()].sort((a, b) => b.risk - a.risk),
    heatmap: user && user.role === 'customer' ? [] : [...cities.entries()].map(([city, count]) => ({ city, count })),
  };
}

function serveStatic(request, response) {
  const requestPath = request.url === "/" ? "/index.html" : request.url;
  const cleanPath = requestPath.split("?")[0];
  const filePath = path.normalize(path.join(root, cleanPath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "Content-Type": types[path.extname(filePath)] || "application/octet-stream" });
    response.end(data);
  });
}

const server = http.createServer(async (request, response) => {
  try {
    const parsedUrl = new URL(request.url, `http://${request.headers.host}`);
    const pathname = parsedUrl.pathname;

    if (request.method === "OPTIONS") {
      response.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
      });
      response.end();
      return;
    }

    if (request.method === 'POST' && pathname === '/api/login') {
      const body = await readBody(request);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const user = users.get(email);
      if (!user || user.password !== password) {
        sendJson(response, 401, { error: 'Invalid email or password' });
        return;
      }
      const token = generateToken();
      sessions.set(token, { email: user.email, role: user.role, name: user.name });
      sendJson(response, 200, { token, email: user.email, role: user.role, name: user.name });
      return;
    }

    if (request.method === 'POST' && pathname === '/api/register') {
      const body = await readBody(request);
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      if (!name || !email || !password) {
        sendJson(response, 400, { error: 'Name, email, and password are required' });
        return;
      }

      if (users.has(email)) {
        sendJson(response, 409, { error: 'This email is already registered' });
        return;
      }

      users.set(email, { email, password, role: 'customer', name });
      sendJson(response, 201, { message: 'Customer account created successfully' });
      return;
    }

    if (request.method === 'GET' && pathname === '/api/events') {
      const user = authenticate(request);
      if (!user) {
        sendJson(response, 401, { error: 'Authentication required' });
        return;
      }
      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      const client = { response, user };
      state.clients.add(client);
      response.write(`data: ${JSON.stringify(snapshot(user))}\n\n`);
      request.on('close', () => state.clients.delete(client));
      return;
    }

    if (request.method === 'GET' && pathname === '/api/state') {
      const auth = authorize(request, ['admin', 'analyst', 'customer']);
      if (!auth.authorized) {
        sendJson(response, auth.status, { error: auth.error });
        return;
      }
      sendJson(response, 200, snapshot(auth.user));
      return;
    }

    if (request.method === 'POST' && pathname === '/api/transactions') {
      const auth = authorize(request, ['admin', 'analyst', 'customer']);
      if (!auth.authorized) {
        sendJson(response, auth.status, { error: auth.error });
        return;
      }
      const body = await readBody(request);
      body.createdBy = auth.user.email;
      body.createdByName = auth.user.name;
      body.createdByRole = auth.user.role;
      if (auth.user.role === 'customer') {
        body.email = auth.user.email;
        body.customerId = auth.user.email;
        body.customerName = auth.user.name;
      }
      const transaction = analyzeTransaction(body);
      broadcast();
      sendJson(response, 201, transaction);
      return;
    }

    if (request.method === 'POST' && pathname.startsWith('/api/transactions/')) {
      const auth = authorize(request, ['admin', 'analyst']);
      if (!auth.authorized) {
        sendJson(response, auth.status, { error: auth.error });
        return;
      }
      const id = decodeURIComponent(request.url.split('/').pop());
      const body = await readBody(request);
      const txn = state.transactions.find((item) => item.id === id);
      if (!txn) {
        sendJson(response, 404, { error: 'Transaction not found' });
        return;
      }
      const status = body.status;
      if (status === 'Approved') {
        txn.decision = 'Approved';
        txn.status = 'Approved';
        txn.timeline = txn.timeline || [];
        txn.timeline.push(['Admin approved transaction', new Date().toISOString()]);
      } else if (status === 'Blocked') {
        txn.decision = 'Blocked';
        txn.status = 'Blocked';
        txn.timeline = txn.timeline || [];
        txn.timeline.push(['Admin blocked transaction', new Date().toISOString()]);
      }
      const linkedCase = state.cases.find((c) => c.transactionId === id);
      if (linkedCase) {
        linkedCase.status = status === 'Approved' ? 'Resolved' : status === 'Blocked' ? 'Open' : linkedCase.status;
        linkedCase.timeline.push([`Admin action: ${status}`, new Date().toISOString()]);
      }
      broadcast();
      sendJson(response, 200, txn);
      return;
    }

    if (request.method === 'DELETE' && pathname.startsWith('/api/transactions/')) {
      const auth = authorize(request, ['admin', 'analyst']);
      if (!auth.authorized) {
        sendJson(response, auth.status, { error: auth.error });
        return;
      }
      const id = decodeURIComponent(request.url.split('/').pop());
      const index = state.transactions.findIndex((txn) => txn.id === id);
      if (index === -1) {
        sendJson(response, 404, { error: 'Transaction not found' });
        return;
      }
      const removed = state.transactions.splice(index, 1)[0];
      state.cases = state.cases.filter((item) => item.transactionId !== id);
      broadcast();
      sendJson(response, 200, { message: `Transaction ${id} deleted`, transaction: removed });
      return;
    }

    if (request.method === 'POST' && pathname.startsWith('/api/cases/')) {
      const auth = authorize(request, ['admin', 'analyst']);
      if (!auth.authorized) {
        sendJson(response, auth.status, { error: auth.error });
        return;
      }
      const id = decodeURIComponent(request.url.split('/').pop());
      const body = await readBody(request);
      const fraudCase = state.cases.find((item) => item.id === id);
      if (!fraudCase) {
        sendJson(response, 404, { error: 'Case not found' });
        return;
      }
      fraudCase.status = body.status || 'Resolved';
      fraudCase.timeline.push([`Case ${fraudCase.status}`, new Date().toISOString()]);
      broadcast();
      sendJson(response, 200, fraudCase);
      return;
    }

    if (request.method === 'DELETE' && pathname.startsWith('/api/cases/')) {
      const auth = authorize(request, ['admin', 'analyst']);
      if (!auth.authorized) {
        sendJson(response, auth.status, { error: auth.error });
        return;
      }
      const id = decodeURIComponent(request.url.split('/').pop());
      const index = state.cases.findIndex((item) => item.id === id);
      if (index === -1) {
        sendJson(response, 404, { error: 'Case not found' });
        return;
      }
      const removed = state.cases.splice(index, 1)[0];
      broadcast();
      sendJson(response, 200, { message: `Case ${id} deleted`, case: removed });
      return;
    }

    serveStatic(request, response);
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`AIGA Shield real-time engine running at http://localhost:${port}`);
});
