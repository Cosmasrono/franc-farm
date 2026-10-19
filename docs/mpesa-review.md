# M-Pesa review

## Current environment

The integration uses PayHero for website checkout, course fees and POS STK
prompts. The final runtime check found the PayHero credentials configured.
A read-only `/payment_channels` request returned HTTP 200 and included the
configured channel. The derived callback still pointed to localhost.
Live payments and callback delivery cannot be confirmed in this configuration.
No payment prompt or charge was initiated during this review.

## Checked and corrected

- Protected payment endpoints check the signed-in user and role.
- Checkout amounts are priced on the server.
- Callback payloads trigger an authenticated provider lookup; a callback's
  claimed success alone does not mark a payment completed.
- Verification checks the full amount and rejects a conflicting reference.
- Reports exclude incomplete payments and avoid counting online POS settlements twice.
- POS now checks provider configuration before creating a request.
- POS rejects fractional STK totals, which otherwise would be rounded up by the
  provider and fail the exact-amount verification.
- Channel IDs must be positive integers.

## Remaining failure cases to address before production

- POS initiation currently marks a request failed on any provider error,
  including an ambiguous timeout. The provider may have accepted a timed-out
  request. Staff should confirm provider status before requesting payment again.
- POS reconciliation records the sale and marks the request completed in
  separate writes. If saving the final request status fails after the sale is
  recorded, a retry can produce a duplicate sale. An atomic settlement or a
  unique sale/request link is needed to close this failure window.
- Live provider response compatibility, cancelled prompts, callbacks and
  repeated callbacks still require an end-to-end test with configured credentials.

Provider reference: [PayHero documentation](https://docs.payhero.co.ke/).
