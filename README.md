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

## GitHub Pages Deployment

This repository includes a GitHub Actions workflow to publish the site to GitHub Pages (branch `gh-pages`). The workflow file is `.github/workflows/deploy-gh-pages.yml` and is triggered on pushes to `master`.

Current status:
- A Pages deploy workflow has been added and pushed to `master`. If the Actions job fails with "Permission to <repo> denied to github-actions[bot]" you may need to enable write permissions for workflows or use a Personal Access Token (PAT) as a fallback.

How to re-run the deployment:
1. Open the repository on GitHub: `https://github.com/CHAKRI-GUPTHA/aiga_shield`
2. Go to the `Actions` tab and select the `Deploy GitHub Pages` workflow run.
3. Click `Re-run jobs` to trigger the workflow again.

If the workflow still fails with a permission error:
- In the repo settings go to `Settings → Actions → General` and set `Workflow permissions` to "Read and write permissions" and enable "Allow GitHub Actions to create and approve pull requests" if present.

Fallback: use a Personal Access Token (PAT)
1. Create a PAT at https://github.com/settings/tokens with scope `repo` (or `public_repo` for public repositories) and `workflow`.
2. In the repository Settings → Secrets → Actions, add a new secret named `GH_PAGES_PAT` containing the PAT value.
3. Edit `.github/workflows/deploy-gh-pages.yml` and replace the `github_token: ${{ secrets.GITHUB_TOKEN }}` input with `github_token: ${{ secrets.GH_PAGES_PAT }}` for the `peaceiris/actions-gh-pages` step.
4. Commit and push the change and re-run the workflow.

Local test and debugging
- Run the app locally to verify everything prior to deployment:
```powershell
cd C:\Users\hp\OneDrive\Documents\aiga_final
node server.js
# then open http://localhost:5173
```

If you want me to run any of these steps (edit the workflow to use a PAT secret placeholder, create the README change commit, or trigger a re-run), tell me which one and I'll proceed.
