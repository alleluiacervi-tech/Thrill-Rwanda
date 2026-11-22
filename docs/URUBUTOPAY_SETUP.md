# UrubutoPay onboarding and setup

The official OpenAPI reference publishes separate testing and live hosts, raw API-key authorization, v2 initiation/status and the merchant-issued bearer token callback flow. Card details are entered on provider-hosted checkout. Thrill sends a unique merchant reference for each attempt and binds verification to the configured merchant and service. [UrubutoPay v2 reference](https://developers.urubutopay.rw/reference/) · [BK TecHouse products](https://www.bktechouse.rw/products.html)

## Environment and merchant settings

1. Apply the additive collection migration to the testing database. Use the company-owned UrubutoPay merchant portal to get the testing merchant, service and `upg:test_` API key. The reference calls staging its integration testing environment.
2. Set `APP_ENV=staging`, `URUBUTOPAY_ENVIRONMENT=staging`, `PAYMENT_PUBLIC_ORIGIN`, `URUBUTOPAY_API_KEY`, `URUBUTOPAY_MERCHANT_CODE` and `URUBUTOPAY_SERVICE_CODE` server-side. Set `URUBUTOPAY_APPROVED_METHODS` and the verified minimum and maximum RWF limits. Use distinct production and testing databases, callback credentials and gateway keys.
3. Register `/api/payments/urubutopay/auth` and `/api/payments/urubutopay/callback` with BK TecHouse. Register `URUBUTOPAY_WEBHOOK_USERNAME` and the independently generated `URUBUTOPAY_WEBHOOK_PASSWORD`. Keep `URUBUTOPAY_WEBHOOK_SECRET` private to Thrill for token signing. Use a reachable HTTPS origin. Agree whether the configured merchant service can omit the optional payer validation webhook.
4. Set `URUBUTOPAY_ENABLED=true` after configuration. In **Admin → Payments → Provider settings**, record approval and staging evidence, select methods inside the approved amount range and explicitly enable routing. Test each method and confirm status and bank settlement independently. For production also require `APP_ENV=production`, `URUBUTOPAY_ENVIRONMENT=live` and `URUBUTOPAY_LIVE_APPROVED=true`. Keep keys in deployment secret storage.
5. The operator can pause new attempts in Admin or via `URUBUTOPAY_ENABLED=false`. Keep prior status/webhook credentials until outstanding transactions finish reconciliation. Confirm merchant/service changes with BK TecHouse before withdrawing old credentials.

## Capability and commercial assessment

| Capability | Verified public information and Thrill scope |
| --- | --- |
| MTN MoMo and Airtel Money | RWF collections via the documented v2 channels. Confirm contracted limits, fees and exact mobile approval/rejection scenarios before activation. |
| Cards | Hosted Visa, Mastercard and BK prepaid are documented. RWF is implemented. The site advertises USD, but the v2 initiation schema omits a charge currency parameter. Confirm how USD is configured and echoed, international acceptance, country/BIN restrictions, 3D Secure behavior and settlement currency before offering it. |
| Invoice collections and payment links | Provider documents invoice operations and portal payment links. Thrill uses its own invoices and secured links to keep orchestration and amounts in one ledger. |
| USSD | The public site advertises merchant USSD. Confirm enrollment, reference matching and settlement before adding it as a checkout method. |
| Recurring | Public v2 instructions describe customer authorization and restricted merchant access. Keep disabled for ordinary payments. |
| Refunds and disputes | The public v2 spec provides no collection refund or dispute endpoint. Confirm full and partial refunds, refund fees, chargeback notifications, timelines, evidence and reserves. Use the existing authorized manual process for reconciled quote funds. |
| Bulk disbursements | Public API documents payouts, batch and transfer status and source-of-funds variants. Obtain explicit payout approval, beneficiary validation, maker-checker terms, static egress requirements, limits and fees. Supplier obligations remain in the existing finance workspace. No payout automation is enabled. |
| Settlement | Public descriptions include wallet, BK and SACCO options and optional bank settlement fields. Obtain per-channel schedules, reporting access, net/gross and fee treatment, timing and chargeback reversals. The app requires a bank statement match. |

Confirm tourism/travel eligibility, merchant KYC documents, owners/signatories, registration and tax IDs, settlement account and bank ownership, reserve policy, card and wallet fees, cross-border pricing, refunds, tax, and approval lead times with BK TecHouse. The public sources describe the portal flow and do not confirm Thrill-specific commercial terms. Provider support is listed as **bktechouse@bk.rw**. [Merchant onboarding and advertised features](https://urubutopay.rw/) · [Developer API](https://developers.urubutopay.rw/reference/)

Ask whether the subscribed collection endpoints require static egress and whether callbacks require a specific registered domain or TLS configuration. The public materials describe IP allowlisting for wallet and payout calls. If collections also require allowlisting, verify the Vercel team's plan and approved network configuration or use the existing VPS deployment. [Vercel outbound networking](https://vercel.com/academy/optimize-your-vercel-account/backend-egress)
