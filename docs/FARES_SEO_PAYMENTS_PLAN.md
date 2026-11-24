# Fares board, search indexing and payment marks

Goal: make thrillrwanda.com ready for Google Search Console, give `/flights` a
"Cheap flights / Best deals / Trending destinations" board backed by real data,
and show the ways to pay in the footer.

Rule that shapes all of it: **no price, deal or trend appears unless it is real.**
Flights are sold by written quotation, so the site has no fares of its own. The
board shows only fares our daily check actually found (with the date it found
them), deals measured against our own history, and trends counted from our own
enquiries. Until there is data, those tabs stay hidden and the board shows the
destinations people ask for, as before.

## Phases

- [x] **1. Search Console readiness.**
  - Verification meta tags from the environment (`GOOGLE_SITE_VERIFICATION`, `BING_SITE_VERIFICATION`).
  - TravelAgency structured data on the home page, with the real contacts.
  - Canonical URL on the home page.
  - Remove the old "travel demo" default description.
  - Owner steps in this file.
  - *Accept:* the live `<head>` has the tag once the variable is set; the structured data validates; the sitemap lists only public pages.
- [x] **2. Payment marks in the footer.**
  - UrubutoPay, MTN MoMo, Airtel Money, Visa and Mastercard on white tiles, with one plain line: mobile money or a debit or credit card, through UrubutoPay.
  - Only methods the checkout really runs (`src/lib/urubuto-pay.ts`: MOMO, AIRTEL_MONEY, CARD).
  - *Accept:* readable at 390 px and 1280 px, alt text on each mark, no layout shift.
- [x] **3. Fare data.**
  - `fare_snapshots` table (additive migration).
  - A daily `fare-watch` job: one-way economy, one adult, from Kigali to about 12 destinations, dates rotating 2 to 9 weeks out.
  - Runs only with a **live** Duffel token, so sandbox prices can never reach the public page. (Phase 5 moved the on/off switch to Admin → Fares.)
  - *Accept:* unit tests for the job, deal maths and trend counting; the job is a no-op without the switch.
- [x] **4. Fares board on /flights.**
  - Tabs: Cheap flights, Best deals, Trending, By region (on phones: Cheapest, Deals, Trending, Regions). A tab without data is not shown; with no data at all the board is the regional list, as before.
  - Rows fill the search with the city and date.
  - The globe shows price pins for the tab in view.
  - A footnote says what the prices are: when checked, one-way, one adult, economy, confirmed by the desk in writing.
  - *Accept:* screenshots at 390, 820, 1280 and 1536 px with and without data; keyboard through the tabs; no overflow; typecheck, lint and tests pass.

- [x] **5. Choose the price source in the dashboard.**
  - Admin → Fares: Off, Duffel or Skyscanner, each showing whether its key is in place; check now; the latest fares found.
  - Skyscanner Indicative Prices adapter: cached lowest fares for the month, kept only if Skyscanner found them in the last 4 days, stored with that time.
  - The public board shows only the chosen source's fares; Off hides every price. With Skyscanner it shows "Powered by Skyscanner", linking to skyscanner.net, as their usage guidelines require.
  - All four tabs are always visible; a tab without data lists the popular routes (with distance from Kigali) or explains what it will show.
  - *Accept:* tests for readiness and Skyscanner quote parsing; the switch changes /flights at once; typecheck, lint, tests and build pass.

## Definitions (what the board claims)

| Tab | Shows | Shown when |
| --- | --- | --- |
| Cheap flights | Lowest fare per destination from the last 3 days of checks, cheapest first | At least 3 destinations have a fare |
| Best deals | Destinations whose latest fare is at least 10% below that route's average over the previous 30 days | The route has 5 or more earlier checks |
| Trending | Destinations most asked for in flight enquiries over the last 30 days | 10 or more flight enquiries in that window |
| By region | The regional list people ask the desk for (no prices) | Always |

Before there is data, Cheap flights and Trending list the popular routes with their distance from Kigali (no prices), and Best deals explains what it will show.

## Owner steps: Google Search Console

1. Go to <https://search.google.com/search-console> and click **Add property**, then **URL prefix**, then `https://thrillrwanda.com`.
2. Choose **HTML tag** and copy only the `content="..."` value.
3. On the server, add `GOOGLE_SITE_VERIFICATION=<that value>` to `/opt/thrill/.env` and restart the app (`/opt/thrill/bin/thrill up -d --no-deps --force-recreate app`), or ask Claude to.
4. Back in Search Console, click **Verify**.
5. Open **Sitemaps**, submit `sitemap.xml`, and use **URL inspection** to request indexing for `/`, `/flights` and `/experiences`.

The optional Bing Webmaster Tools step works the same way, with `BING_SITE_VERIFICATION`.

The DNS method (domain property) also works, but it adds a TXT record at Spaceship. That's fine, as long as the existing MX, SPF and TXT records for the mailbox stay as they are.

## Owner steps: turning on fares

1. Get a key from one source:
   - **Skyscanner:** apply at <https://www.partners.skyscanner.net> for the Travel API (Flights Indicative Prices). Their FAQ says the API is for sites whose searches lead to bookings with their partners, so confirm with them that a quote-by-desk agency may show their prices.
   - **Duffel:** a **live** access token, with `DUFFEL_ALLOW_LIVE=true`.
2. Put the key in `/opt/thrill/.env` (`SKYSCANNER_API_KEY=...` or `DUFFEL_ACCESS_TOKEN=...`) and restart the app.
3. In **Admin → Fares**, choose the source, save, and click **Check fares now**.
4. With Skyscanner, swap the text credit for their official logo from the brand kit linked in their usage guidelines.

The check then runs daily at 06:15 Kigali time. Best deals needs about a week of history.

## Progress log

- 2026-11-24: Plan written.
- 2026-11-24: All four phases built.
  - **SEO:** verification meta tags from env; TravelAgency JSON-LD and canonical on `/`; demo description removed from the code default.
  - **Footer:** "Ways to pay" with UrubutoPay, MTN MoMo, Airtel Money, Visa, Mastercard.
  - **Data:** `fare_snapshots` (migration `20261124120000_fare_snapshots`, additive), `src/lib/fare-watch.ts`, `/api/cron/fare-watch` at 06:15 Kigali, rules in `src/lib/fare-board-rules.ts` (12 tests).
  - **Board:** `src/components/booking/flight-departures-board.tsx`; the globe takes `prices` for gold pins; choosing a fare sets one way, the city and the date in the search.
  - **Phone fixes:** the airlines grid is 3 compact tiles a row (was 2 tall ones); short tab names; the airline and "one way" drop from the fare line.
  - **Verified:** headless Chrome at 390, 820 and 1280 px with `/flights?fares=sample` (development only) and without data; no horizontal overflow, no console errors; fare click fills the search; typecheck, lint, 428 tests and the production build pass.
  - **Not yet seen:** real Duffel fares (needs the live token and the switch), and Search Console verification (needs the owner's tag).
- 2026-11-24: Search Console verified by DNS TXT record (domain property).
- 2026-11-25: Phase 5 built. Admin → Fares with Off / Duffel / Skyscanner; Skyscanner adapter (`src/lib/skyscanner.ts`); migration `20261125090000_fare_source` (additive); board tabs always visible. Tests cover readiness and quote parsing.
  - **Not yet seen:** a real Skyscanner response (no key yet; the amount encoding follows their documented price units), and the admin page in a browser (the local admin needs a two-step code).
