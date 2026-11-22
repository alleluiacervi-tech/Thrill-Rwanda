# Payment production checklist

- [x] Review the repository and official v2 collections and webhook contracts.
- [x] Keep historical payment records and cut new checkout over to the controlled UrubutoPay route.
- [x] Add durable attempts, invoice links, provider verification, separate settlement records and finance role controls.
- [x] Apply the migration locally and verify concurrency, invoice access, callbacks, settlement and mobile invoice downloads using local fixtures.
- [ ] Apply and verify the migration in a production-like environment. Rehearse rollback without deleting ledger history.
- [ ] Obtain the signed BK TecHouse agreement, approved merchant products, settlement accounts and credentials. Confirm all fees, funds availability, static IP and callback requirements, and the travel merchant refund/chargeback terms.
- [ ] Complete merchant staging validation for all enabled channels and independently confirm document/receipt handling and bank settlement.
- [ ] Review hosting logs and access monitoring, provider webhook timing, worker alarm thresholds, network requirements, data processing and credential rotation.
- [ ] Agree the RRA fiscal invoice flow and tax treatment with the accountant. Confirm who issues the fiscal invoice for each type of arrangement.
- [ ] Approve live service publication and limits, then record evidence in Admin. Run any first live smoke transaction only under explicit company authorization.
- [ ] Train Finance and support on stuck payments, late credits, duplicate attempts, statement discrepancies and manual refund approvals.

Start with a few accepted RWF quotes across services. Add direct inventory checkout after qualifying the catalogue's charge currency. Enable USD cards, alternative providers, disbursements and settlement automation only after their separate technical and merchant approvals.
