# Checkout integration

## Supported entry points

| Entry point | Payment flow |
| --- | --- |
| Accepted flight, stay, transfer, tour, groups, school, corporate, events and other quotations | Admin or Finance opens the accepted enquiry, sets the first payment if needed, and issues a guest invoice link. The customer sees approved digital methods for eligible RWF invoices or the existing approved off-site payment route. |
| Direct tours and car hire | Accepted terms and inventory hold precede invoice creation. The signed-in owner sees the deposit or balance and eligible methods. Existing USD bookings use the desk flow. |
| Direct hotel reservations | Payment remains with the property. A desk-arranged hotel quote can use the quotation flow. |
| Transfers without capacity-confirmed inventory | Staff confirm availability and issue the written quotation before collecting. |

Guest links expire at the earlier of the chosen validity period and the accepted quotation's payment deadline. Creating a replacement revokes the previous link. Staff share a link through the existing approved email, WhatsApp or SMS channel. Receipts and commercial invoices can be downloaded from authenticated or guest checkout while access is valid. The provider return URL contains a separate random status reference and exposes only the lifecycle state.

The invoice can use full payment or an approved fixed deposit and balance. Existing direct booking deposits retain their configured percentage. Collections use the original currency in integer minor units. RWF uses whole francs. Verified bank transfers and grouped receipts remain available through Finance. FX conversion, instalment calendars, a multi-party payer portal and automatic currencies or routing changes need separate implementation. Customer payment and supplier confirmation remain separate.

## Optional direct providers

- **MTN Rwanda** publishes a sandbox and a Rwanda-specific commercial go-live process. The separate sandbox adapter implements token renewal, EUR RequestToPay and independent status verification. Customer routing remains disabled. Obtain Collections subscription credentials, confirm the live base and target environment in the merchant pack, register the callback host, confirm fees and RWF settlement, and run MTN's test scenarios before activation. [MTN Collections sandbox](https://momodeveloper.mtn.com/apis) · [MTN Rwanda go-live](https://momodeveloper.mtn.co.rw/go-live)
- **Airtel Rwanda** exposes an official developer portal. Obtain the merchant-approved Collections product spec, both environments, OAuth requirements, API version, encryption/key exchange, callback authentication, pricing and RWF settlement in writing. Direct routing remains disabled. [Airtel Rwanda Developer Portal](https://developers.airtel.co.rw/) · [Airtel Africa Developer Portal](https://developers.airtel.africa/)
- **PayPal** lists Rwanda as send-only in its seller onboarding matrix. Keep Wallet, guest cards, Pay Later, Apple Pay, Google Pay, Venmo and regional methods out of Thrill's routing while receiving eligibility is unconfirmed. For an eligible merchant, the official integration uses Orders v2 create and capture, Payments refunds, authenticated webhooks and dispute workflows. Support for an exchange-rate currency does not establish Checkout support. [PayPal seller eligibility](https://developer.paypal.com/platforms/seller-onboarding) · [Orders v2](https://developer.paypal.com/api/orders/v2) · [Checkout currencies](https://developer.paypal.com/api/rest/reference/currency-codes/)

## Fiscal invoicing

The downloadable payment invoice and receipt are commercial records. RRA requires the applicable EBM/EIS invoice for sales by taxpayers subject to its rules. The company accountant should confirm treatment for deposits, agency fees, supplier pass-through charges, cancellations and credit notes, and arrange RRA certification before connecting Thrill's invoicing to VSDC. [RRA EBM guidance](https://www.rra.gov.rw/en/about-ebm)
