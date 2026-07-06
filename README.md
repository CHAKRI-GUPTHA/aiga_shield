# AIGA Shield

Real-time local engine for an AI-powered card fraud detection dashboard.

## How to Run

### Option 1: Double-click and Open Browser

Double-click:

```text
open-aiga.bat
```

It starts the server and opens:

```text
http://localhost:5173
```

### Option 2: Server Window Only

Double-click:

```text
run-aiga.bat
```

Then manually open `http://localhost:5173`.

### Option 3: PowerShell

Run these commands:

```powershell
cd C:\Users\hp\OneDrive\Documents\aiga_final
node server.js
```

Then open:

```text
http://localhost:5173
```

Keep the terminal open while using the app.

## How to Test the Real-Time Flow

1. Open the Customer tab.
2. Enter customer, merchant, amount, city, and card last 4 digits.
3. Optional: click `Use Live GPS` and allow browser location.
4. Click `Pay Now`.
5. Open the Dashboard tab to see the transaction appear instantly.
6. Open the Cases tab if the transaction is medium or high risk.

The system does not use predefined transactions. Every transaction is created from the payment form and analyzed by the backend.

## Note

`npm start` may be blocked on this computer because PowerShell script execution is disabled. Use `node server.js` or `run-aiga.bat` instead.

## Production Integrations Needed

For a direct real banking/payment system, connect these providers:

- Payment gateway or bank webhook: Razorpay, Stripe, banking API, or ISO 8583 simulator.
- Customer database: previous transactions, trusted devices, profile, limits.
- Merchant risk source: internal merchant fraud history or risk vendor.
- Notification provider: SMS, email, WhatsApp, or push notifications.
- Card control API: freeze card, block transaction, request OTP.
