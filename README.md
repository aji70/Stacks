# 🧾 Stacks Account History

A **Next.js** application for viewing **Stacks blockchain** account transaction history.  
Search for any Stacks address or connect your wallet to view transaction history on both **mainnet** and **testnet**.

---

## 🚀 Features

- **🔗 Wallet Integration** – Connect your Stacks wallet using **Stacks Connect**.  
- **🔍 Address Search** – Search and view transaction history for any Stacks address.  
- **🌐 Multi-Network Support** – Supports both **mainnet (SP...)** and **testnet (ST...)** addresses.  
- **📜 Transaction History** – View detailed transaction information including:
  - Token transfers (STX)
  - Smart contract deployments
  - Contract calls
  - Coinbase transactions
  - NFT and FT events
- **📄 Pagination** – Load more transactions with a “Load More” button (20 per page).  
- **🧭 Network Indicator** – Visual indicator showing whether you're viewing mainnet or testnet data.

---

## 🧰 Tech Stack

| Category | Technology |
|-----------|-------------|
| **Framework** | Next.js 15.5.4 (App Router) |
| **UI** | React 19, Tailwind CSS 4 |
| **Blockchain** | Stacks Connect, Stacks Transactions |
| **Icons** | Lucide React |
| **Notifications** | Sonner |
| **Language** | TypeScript |

---

## 🧑‍💻 Getting Started

### ✅ Prerequisites
- Node.js **20** or higher  
- npm, yarn, pnpm, or bun package manager

---

### ⚙️ Installation

Clone the repository:

```bash
git clone <repository-url>
cd account-history
Install dependencies:
```
# using npm
```bash
npm install
```

# or yarn
```bash
yarn install
```

# or pnpm
```bash
pnpm install
```

🧩 Run the development server
```bash
npm run dev
```
# or
```bash
yarn dev
```
# or
```bash
pnpm dev
```
# or
```bash
bun dev
```


Open your browser and navigate to 👉 http://localhost:3000


## 💡 Usage

1. **Connect Wallet** – Click **“Connect Wallet”** in the navigation bar to connect your Stacks wallet.  
2. **Search Address** – Enter any Stacks address (**SP...** for mainnet or **ST...** for testnet).  
3. **View Transactions** – Browse through the transaction history.  
4. **Load More** – Click **“Load More”** to fetch additional transactions.

## 📂 Project Structure

account-history/
├── app/
│   ├── [address]/              # Dynamic route for address pages
│   ├── layout.tsx              # Root layout with navbar
│   └── page.tsx                # Home page
├── components/
│   ├── navbar.tsx              # Navigation bar with search and wallet controls
│   ├── txn-details.tsx         # Transaction detail component
│   ├── txn-details-top.tsx     # Transaction page header
│   └── txns-list.tsx           # Transaction list with pagination
├── hooks/
│   └── use-stacks.tsx          # Stacks wallet connection hook
├── lib/
│   ├── fetch-address-transactions.ts  # API functions for fetching transactions
│   └── stx-utils.ts            # Utility functions for Stacks addresses
└── public/                     # Static assets

## 🌐 API

This application uses the Hiro API to fetch transaction data.

Network	API Endpoint
```bash
Mainnet	https://api.hiro.so/extended/v2
```

## Testnet	https://api.testnet.hiro.so/extended/v2
🛠️ Development Commands

## Run development server:
```bash
npm run dev
```

## Build for production:
```bash
npm run build
```
## 📚 Learn More

Next.js Documentation

Stacks Documentation

Hiro API Documentation

Author: [Ajidokwu Sabo]
License: MIT
