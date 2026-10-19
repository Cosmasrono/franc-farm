# Pharmacy shop and POS

An online pharmacy shop with an in-store till (POS), built on Next.js, Prisma and MongoDB.

- **Shop** (`/`): browse health products by category, add over-the-counter items to the bag, and pay by M-Pesa or cash on collection or delivery.
- **Prescriptions**: prescription-only medicines are never sold online. Customers upload a photo or PDF of their prescription (or send it on WhatsApp); a pharmacist reviews it under **Admin → Prescriptions** or from the till, then dispenses and takes payment at the till.
- **Till** (`/pos`): stock-checked sales, barcode search (scan into the search box and press Enter), cash and M-Pesa, website orders and prescriptions to dispense. A ticket with prescription-only medicine cannot be paid for until the cashier records the prescription and confirms they have seen it; the reference is saved on the sale and printed on the receipt.
- **Products & stock** (`/admin/products`): prices, categories, batch numbers and expiry dates. Stock only changes through deliveries, write-offs, count corrections and sales, and every change is in the product's history. Expired products cannot be sold online or at the till.

The pharmacy's name, strapline, licence line and WhatsApp number are in `app/lib/brand.ts`.

Prescription files are stored in `storage/prescriptions/` (outside `public/`, not committed) and are served only to staff and to the customer who sent them. On a host with an ephemeral disk, move this to private object storage.

To try the shop with sample products: `pnpm mock:products` (remove them with `pnpm mock:products:clean`). This writes to the database in `DATABASE_URL`.

## Getting started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Unit tests: `pnpm exec tsx --test tests/*.test.ts`. Browser tests: `pnpm exec playwright test`.

## System reports and M-Pesa

Open **Admin Dashboard → System Reports** for date-filtered sales, payment
statuses, expense categories, estimated profit/loss, users, prescriptions and
inventory (out of stock, low stock, expired, expiring soon, stock value at cost). Export CSV or use Print / Save PDF. Current user/catalogue
counts are labelled separately from activity in the selected period. Payment
records use creation dates, not settlement dates; unrecorded costs, taxes and
refunds are not part of the estimated balance.

M-Pesa uses PayHero. Configure `PAYHERO_API_USERNAME`, `PAYHERO_API_PASSWORD`,
`PAYHERO_CHANNEL_ID`, and a public HTTPS `PAYHERO_CALLBACK_URL` ending in
`/api/mpesa/callback`. Alternatively, set a public HTTPS `APP_URL` from which the
callback is derived. The reports page checks configuration, not provider access.
See [PayHero's documentation](https://docs.payhero.co.ke/).

After setup, a live acceptance check must verify an STK prompt, the full paid
amount, callback/status reconciliation, one receipt, and one entry in reports.
Also test cancellation and repeated callbacks. Never treat a queued prompt as
a completed payment. POS STK payments require whole-shilling totals.

## Chatbot setup

The dashboard includes a chatbot configured by the server-only
`AGENTROUTER_API_KEY`, `AGENTROUTER_BASE_URL`, and `AGENTROUTER_MODEL` variables.
The base URL should include `/v1`; the app calls `/chat/completions`.
Only admins and super admins can use it. Chat history stays in browser memory
until you leave the dashboard. Up to five recent exchanges accompany each question.
The optional summary shares current-month sales, expenses and category totals;
customer records and individual expense descriptions are excluded.
The chatbot cannot change application records. Existing expense insights continue
to use the separate Groq configuration.

## Managing users

In **Admin Dashboard → Staff & User Directory**, use **Disable** to block an
account or **Enable** to allow it to sign in again. Disabling revokes existing
sessions; re-enabling requires a fresh login. Older accounts remain enabled.

**Delete** removes the account from the directory and permanently blocks its
login. This is a soft deletion: the account record is retained so sales, payment
and prescription history remain linked. Its email is replaced with an internal
archive address so you can create a new account using the original email.
New accounts do not inherit the deleted account's history. Use Disable if
you expect to restore access. You cannot change your own account's access, and
only a super admin can manage another super admin.

Creating an account in the directory emails its login URL, email and password
using the server's `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`,
`MAIL_FROM_ADDRESS`, and `MAIL_ENCRYPTION` settings. `APP_URL` must point to the
website users can access. SMTP uses TLS. See the [Nodemailer SMTP guide](https://nodemailer.com/smtp).
The creation notification reports whether the email server accepted the message.
If email fails, the account remains created; share the credentials directly and
check the SMTP settings. Passwords are stored as hashes, never as readable text.

After updating this schema, stop the development server, run
`npx prisma generate`, and restart it to load the new account fields.

## Recording expenses

Sign in as an admin and open **Admin Dashboard → Expenses** (`/admin/expenses`).
Record the date, amount in KSh, category, description and payment method. Supplier
and receipt references are optional. Use the date filters to review spending,
category totals, and sales minus recorded expenses. This balance excludes any
costs that have not been recorded.

**Get insights** uses Groq to summarize the selected period and suggest ways to
manage spending. It sends totals and the ten largest expenses' amounts,
categories, descriptions and dates. Avoid personal details in descriptions.
Customer records, supplier names and receipt references are excluded.

Configure `GROQ_API_KEY` in the server environment to enable AI. Optionally set
`GROQ_MODEL` to override the model in `app/lib/ai.ts`. Restart the server after
changing environment variables. Expense recording works without an AI key.

After schema changes, run `npx prisma generate` and restart the development
server. This project uses MongoDB; expense documents use the `expenses`
collection. Apply schema indexes with `npx prisma db push` when provisioning
the database, after reviewing other pending schema changes.

Run expense validation and report date tests with:

```bash
npx tsx --test tests/expenses.test.ts tests/pos-report-range.test.ts
```

## Next.js resources

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
