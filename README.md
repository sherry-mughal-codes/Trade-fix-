# TradeFix - Complete Trade & Finance Management System

TradeFix is a complete ERP and POS application built with Next.js 14 (App Router), Prisma ORM, PostgreSQL, Tailwind CSS, and NextAuth.

## Modules & Features
- **Dashboard:** Operational KPI statistics, quick navigation, recent activity.
- **Customers & Suppliers:** Comprehensive CRM/SRM with currency, balances, transactions.
- **Invoices:** Sales invoices, purchase invoices, multi-currency conversion, auto-invoice scheduling.
- **Payments:** Payment recording, allocations against invoices, Cash/Bank filtering, payment receipts.
- **POS (Point of Sale):**
  - Counter register, fast barcode/item checkout, split tenders, discounts.
  - Cashier shifts, Opening balance float, Shift closing summary.
  - X Reports (live shift reading) and Z Reports (closed shift financial audit).
  - Refunds with Invoice Reversals (restoring inventory & reversing journal entries) and Standalone refunds.
  - POS Profiles with default Cash and Bank account mapping.
- **Inventory:** Stock entries, warehouse transfers, adjustments, batches, real-time inventory ledger.
- **HR & Payroll:** Employees, salary processing (end-of-month validation), salary payments, and bulk payroll disbursements.
- **General Ledger & Accounting:** Double-entry journal entries, General Ledger drilldown, Chart of Accounts with live balances, and Cash Flow statement.
- **Settings & Security:** RBAC (Roles & Rights), Multi-tenancy, User management, Company branding & Logos.

## Running with Docker (Recommended)

1. Make sure Docker Desktop is running.
2. Clone or extract this directory.
3. Start the application:
   ```bash
   docker compose up -d --build
   ```
4. Access the application at:
   `http://localhost:3000`

## Default Admin Credentials
- **Superadmin Email:** `zeeshan@firmeleven.com`
- **Password:** `password123`

## Running Locally (without Docker)
1. Ensure PostgreSQL is running.
2. Configure `.env` with your `DATABASE_URL` and `NEXTAUTH_SECRET`.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run database migrations:
   ```bash
   npx prisma migrate deploy
   ```
5. Start development server:
   ```bash
   npm run dev
   ```
