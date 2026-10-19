# Code and documentation review — 4 October 2026

Reviewed all project Markdown documentation present at the start: `AGENTS.md`, `CLAUDE.md`, `README.md`, and `docs/mpesa-review.md`. Read the installed Next.js image and proxy guides and inspected the associated authentication, checkout, inventory, prescription and POS code. Findings below are based on the current working tree, which contains an ongoing pharmacy conversion. This is a focused review, not a certification of every execution path.

## Findings, in priority order

### 1. High: verified POS payments can remain stuck in COMPLETING

Location: `app/lib/pos-mpesa.ts:28–46`.

The request is claimed as `COMPLETING` before recording the sale. The final request update is returned without `await` inside the `try`. If that update rejects, its rejection bypasses the local `catch`; the request remains `COMPLETING` even though the sale and stock transaction committed. Subsequent reconciliation immediately returns for any status other than `PENDING`, so it cannot recover. A process interruption after claiming has the same stuck-state risk.

Make settlement idempotent using a unique request-to-sale link, atomically persist the sale/request state where possible, and provide recovery for interrupted claims. Adding `await` alone is insufficient: resetting an already-recorded sale to `PENDING` would allow a duplicate sale and stock deduction.

### 2. High: provider timeouts are treated as definitive payment failure

Location: `app/api/pos/mpesa/route.ts:45–66`.

Every initiation error marks the request `FAILED`, including a timeout after the provider accepted the prompt or a database failure while storing the provider reference. The user is told to try again. The customer can therefore receive another prompt while the first payment is still possible; reconciliation skips the failed request.

Distinguish definitive rejection from an unknown outcome. Preserve an unresolved state and reconcile using the external reference before allowing another attempt. This concern in `docs/mpesa-review.md` still applies.

### 3. High: prescription dispensing is not claimed atomically with the sale

Location: `app/lib/pos-sale.ts:236–245` and `app/lib/pos-sale.ts:283–324`.

Two tills can both pass the `ready` check before either sale commits. Both can then create sales and deduct stock. The prescription is marked `dispensed` only afterward, outside the sale transaction, and the update count is ignored. If that final write fails, the endpoint reports failure after the sale has already committed, making a retry unsafe as well.

Claim a ready prescription within the sale transaction and require one successful claim. Add a durable sale/prescription association for retry detection.

### 4. High: collection of an older website order bypasses current expiry checks

Location: `app/lib/pos-sale.ts:165–206`, `app/lib/pos-sale.ts:217–220`, and `app/lib/products.ts:93–109`.

Direct till items use `unavailableReason`, but website orders are reconstructed from stored items. At collection, stock deduction checks quantity only; it does not check current expiry or active status. An item that expires between placing a cash-on-collection order and collecting it can still be sold. This contradicts the README's statement that expired products cannot be sold at the till.

Revalidate the current products before dispensing a stored order, preserving its agreed price separately. Handle already-paid orders through a resolution/refund workflow rather than permitting expired stock to be dispensed.

### 5. Medium: duplicate manual M-Pesa receipts can race

Location: `app/lib/pos-sale.ts:125–132`, `app/api/pos/sales/route.ts:74–77`, and `prisma/schema.prisma:168–193`.

The receipt lookup and sale creation are separate operations. Two administrators submitting the same code concurrently can both pass the lookup. `PosSale.mpesaCode` has no unique constraint, and the check also spans the separate Payment collection.

Use an atomic receipt claim with a unique normalized receipt identifier shared across payment paths. A read-before-write check alone cannot enforce uniqueness.

### 6. Medium: the repository-wide lint check fails

The check reports **32 errors and 9 warnings**. Errors occur in:

- `app/api/orders/user/[userId]/route.ts`: explicit `any` at lines 27, 28 and 34.
- `app/components/HomeTab.tsx`: unescaped JSX punctuation at lines 269, 627, 746 and 797.
- `app/payment/PaymentContent.tsx`: explicit `any` at line 34.
- `app/pos/PosTerminalClient.tsx`: multiple lint errors, including explicit `any`.

Replace untyped payloads with concrete types and runtime validation; escape literal JSX punctuation. Resolve remaining hook-rule errors according to the reported call sites. These are separate from TypeScript compilation, which passes.

### 7. Low: an unused middleware file misrepresents route protection

Location: `app/api/middleware.ts:1–26`.

This nested file is not a framework middleware/proxy entry point. The installed Next.js guide specifies a root-level `proxy.ts` beside `app`, and deprecates the middleware naming convention. The stale function also admits only `ADMIN`, excluding `SUPER_ADMIN`.

Current admin layout and inspected API routes have their own session/role checks, so this is not evidence that all admin routes are public. Remove the dead file or deliberately replace it with a correctly located proxy, retaining authorization in server-side data/API handlers.

## Documentation discrepancies

- `docs/mpesa-review.md:5` still refers to course fees, although the course/enrollment routes are removed in the working tree.
- `docs/mpesa-review.md:30–33` describes a duplicate-sale retry after the final request update fails. In the current implementation that specific rejection bypasses `catch` because the update is returned without `await`, leaving `COMPLETING` stuck instead. Duplicate recording remains possible through other failure paths, particularly the post-sale prescription update described above.
- The old review's successful provider lookup and localhost callback statements describe an earlier environment inspection. They were not reverified in this review and should not be treated as current runtime results.
- The README recommends Vercel but upload helpers write to local disk (`app/lib/uploads.ts:24–45`). Its private-storage caveat must be addressed for such a deployment; product uploads also need durable storage.

## Validation

- TypeScript: `node node_modules/typescript/bin/tsc --noEmit --incremental false` passed after the login change.
- Unit tests: all **37 passed**. The first sandboxed attempt failed in the Windows user-info call; rerunning with the required access passed.
- Full ESLint: **32 errors, 9 warnings**. Login-page ESLint passed.
- Login browser smoke check against the existing development server: image decoded at desktop 1440×1000 and mobile 390×844; no horizontal overflow and no browser page errors. Screenshots are in `test-results/clinic-login-desktop.png` and `test-results/clinic-login-mobile.png`.
- No production build, full browser suite, live payment, database mutation, or concurrency integration test was performed. The failure cases above were identified by code inspection.

## Login background delivered

`app/login/page.tsx` uses the local `public/images/clinic-login.webp` through `next/image`, with responsive cropping, preload, an empty decorative alt, a light overlay and solid readable form panel. The asset is 1672×940 and 134,822 bytes. Existing sign-in logic is unchanged.

Generated with the built-in image generation tool, then converted to WebP with Sharp. Final generation prompt:

> Use case: photorealistic-natural. Asset type: full-screen background photograph for a pharmacy login page. Create a wide photograph of a clean, welcoming modern clinic reception and consultation area, soft daylight, pale walls, subtle teal upholstery, light wood reception desk, a few plants, a discreet examination room visible to the side. Composition: recognizable clinic details towards the edges with a calm uncluttered center behind a centered login card. Realistic architectural photography, no people, no readable text, no logos, no watermark.
