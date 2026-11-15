# Customer/company portals, supplier reviews and optional channels

## Verified access and customer acceptance

Guest submissions do not automatically join an account, even when email addresses match. An administrator or assigned sales owner must verify the existing active account's owner, travel authority and sharing consent through an established channel, then grant the named enquiry in the staff detail page. Record evidence, not identity-document copies. Customer access and permission to accept quotations are separate switches; revocation takes effect through fresh reads rather than cached session claims.

My travel requests paginates explicitly shared cases. Detail paginates immutable issued quotations and permits protected historical downloads beyond the first page, alongside acceptance state, current service stage, approved payment instructions and support references/status. Quote downloads are private and integrity-checked. Contact/travel information in a quote is visible only to explicitly authorized recipients; internal supplier costs, staff notes, financial audit and support narratives are not exposed.

An individually authorized customer can accept only the latest unexpired quotation before its payment deadline, using their full name and an explicit exact-version terms checkbox. The accepted content hash and authenticated actor are retained. Acceptance and access are checked under transaction locks; concurrent retries cannot duplicate acceptance. A different signature/version or stale case cannot replace existing acceptance. Acceptance does not take payment, reserve stock or issue a ticket.

Customer support requests are duplicate-safe and routed to the case's active staff owner. Requests do not themselves change/cancel a service or settle a refund. The next action is an internal follow-up field, not a public response-time promise. Existing customer booking views remain separate.

## Company travel

Administrators create company workspaces, explicitly assign existing authorized accounts and share each named case after company/customer consent. No email-domain inference, automatic invitation or blanket access exists. Disabling a company, membership or case share removes access. Company sharing is read-only for quotations unless the same user separately receives individual acceptance authority. Company members can request support for shared cases; these messages do not create financial commitments.

The company portal is a controlled case-sharing workspace, not a corporate credit facility, monthly billing integration or HR directory. Company account ownership, representative authority and commercial contracts need real verification before use.

## Supplier follow-through and quotation assistance

Operations and administrators record case-linked supplier scores (1–5), observed outcome, evidence, corrective action and next review. Operations can review only suppliers committed to their accessible cases. Finance does not receive private service narratives through this review view. History is append-only; a later review corrects or updates the operational picture rather than rewriting past evidence. Scores do not establish certification or permission to publish claims.

The quote editor can prefill an editable revision from an integrity-checked previous version. Currency, descriptions, terms and line values are copied, but validity/payment deadlines must be set afresh and supplier/commercial checks reconfirmed. Nothing automatically issues a quote, refreshes live fares or changes an accepted contract. Approved per-offer itinerary curation remains in Launch controls.

## Optional WhatsApp status updates

The prepared transport uses the fixed Meta Cloud API template endpoint. To enable it, record a company-owned account, approved reference/status template, correct language, billing/ownership and actual test receipt in the WHATSAPP_CHANNEL readiness record; set the server-only configuration and WHATSAPP_ENABLED=true. No Meta account, paid subscription, phone registration or template is activated by these files.

Each enquiry needs a separately verified international phone and explicit status-template opt-in, with wording/scope/time evidence recorded by an administrator or assigned sales owner. Generic enquiry contact permission is not treated as template consent. Opt-out cancels queued/blocked jobs. Only reference and current service status go into template body parameters; itinerary, fares, names, documents, internal notes and supplier costs are excluded. A reference itself is still customer information: approve its channel handling and retention.

Status changes/issued revisions enter the existing durable notification outbox. The worker checks current consent/version, approval/configuration, current service status and lease ownership before a send. Superseded status messages are cancelled. Provider acceptance records SENT, not handset delivery/read receipt. Meta's send endpoint is not assumed to provide an idempotency key: once an external attempt may have occurred, any uncertain response/crash is blocked for human provider-side review, not automatically resent. Revocation cannot recall an already in-flight/accepted message. Never clear first-attempt evidence to force a retry.

Unconfigured jobs remain visibly blocked. The existing retry control can retry a configuration block before any external attempt, subject to attempt limits. Actual inbox/delivery verification, approved Meta policy/template changes, costs and support ownership remain deployment tasks. Existing email/in-app transports and gateway ledgers are preserved.

## Integration boundary

Supplier APIs are not interchangeable. A live integration needs an approved named provider, contract, authentication method, sandbox, event schema, privacy scope, rate/settlement/refund rules and failure/reconciliation tests. No unknown airline/hotel/transport API or automatic financial/ticketing action has been fabricated. Use existing checked supplier fulfilment until a separately approved provider contract is supplied. Live GDS, automatic ticketing, wallets, payouts, credit, native apps and AI planning remain outside this project scope.
