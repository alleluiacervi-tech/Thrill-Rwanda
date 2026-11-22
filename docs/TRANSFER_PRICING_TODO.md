# Kigali transfer pricing

- [x] Compare current zone fares with an itemized operating-cost model in RWF.
- [x] Add an [admin rate card](/admin/transfers/pricing) for approved sedan costs by distance and direction, including night work, dispatch costs and contribution.
- [x] Use Google Places and Routes for a one-way Kigali airport estimate. Keep a written quote available for every trip.
- [x] Pass the traveller's own pickup, drop-off, date, local time, flight and group size to the transport desk.
- [x] Correct the legacy USD night surcharge rounding.
- [x] Verify the estimator with simulated Google responses and test the manual fallback and rate-card editing in Chrome against local PostgreSQL.
- [ ] Get comparable written rates from two licensed operators. Record airport parking, included waiting, extra waiting, no-show charges, night fees, luggage capacity and tax treatment. Confirm applicable taxi tariffs with RURA.
- [ ] Configure Places API (New) and Routes API in the company Google Cloud project. Verify the passenger terminal place ID, restrict the server key to both APIs, set API quotas and billing alerts, and review the published terms and privacy notice.
- [ ] Run a two-week airport sedan pilot. Compare estimates with written quotes and actual supplier cost, and review quote conversion, contribution, pickup punctuality and exceptions. Use those results to decide whether to extend to vans, Nyabugogo or intercity trips.

## Cost comparison

These examples are internal planning figures. They assume 2,938 RWF/L, 8.4 L/100 km, 150 RWF/km for vehicle ownership and wear, 2% variable payment cost and a 22% target contribution, before fixed overhead and any applicable taxes. Check the pump price and replace operating estimates with signed supplier rates before enabling public estimates.

| Passenger route | Empty vehicle travel | Driver and wait | Parking | Dispatch | Estimated direct cost | Illustrative fare |
| --- | --- | --- | --- | --- | --- | --- |
| 5 km | 5 km | 3,500 RWF | 1,000 RWF | 1,000 RWF | 9,468 RWF | 13,000 RWF |
| 12 km | 5 km | 4,500 RWF | 1,500 RWF | 1,000 RWF | 13,745 RWF | 19,000 RWF |
| 22 km | 8 km | 6,000 RWF | 2,000 RWF | 1,000 RWF | 20,904 RWF | 28,000 RWF |

The estimate divides direct costs by the share of fare remaining after the variable payment cost and target contribution, then rounds up to the next 1,000 RWF. For a contracted service, enter the supplier's all-in cost and separately enter only costs Thrill actually incurs. Use the written quote to confirm the complete price, tax, availability, wait allowance and payment deadline.

## Staging and rollout

1. Apply the airport pricing migration and deploy the app. Transport publication in Admin → Launch should be **Enquiry** for the pilot. Use **Admin → Transfers → Airport pricing** to save both directions and the expiry of the supplier rate card. The default card is empty and paused.
2. Set `GOOGLE_MAPS_API_KEY` and `GOOGLE_MAPS_KGL_PLACE_ID` on the server. Set `TRANSFER_ROUTE_ESTIMATES_ENABLED=true` only for the environment running the pilot. Toggle the current rate card on after confirming the signed terms. The key currently present in the local workspace received HTTP 403 from Places API (New).
3. Verify the airport entrance by testing rides to and from a known hotel. Check directions, arrival parking, night rates, a route outside 25 km, a missing map result, and a group over four. Confirm the receipt and transport enquiry appear in the desk's queue.
4. The app caps Maps calls at 40 per client address per 15 minutes and 700 across all clients per UTC day. Set Google Cloud quotas and monitor spending separately. An administrator can pause the rate card immediately. The estimator automatically pauses when the supplier agreement expires.
5. Record the published estimate, written quote, actual cost and pickup result in your pilot sheet from desk and partner records. Use first-party quote and supplier totals for analysis. The app keeps the traveller's route details and the selected Place ID and displays Google road data during the lookup.

Reference material includes the [RURA tariffs directory](https://www.rura.rw/publications/tariffs), [Google Maps pricing](https://developers.google.com/maps/billing-and-pricing/pricing), [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) and [Routes policies](https://developers.google.com/maps/documentation/routes/policies).
