# Crate Escape economy and monetisation proposal

**Status:** The core game-cash balance is implemented: boat prices and specialties, local harbour charters, outfitting fees, bounded cargo pay, service and repairs, and reduced rare-offer frequency. The payout and timing figures remain hypotheses for play testing. Paid products, token currency, ads, daily challenges, cosmetics and purchase infrastructure remain proposals below; they are not in the game.

## What the current build does

- The first new boat costs $250, while Sleepy Cove offers $48–$112 per job and lets the player carry several jobs. The player starts with $80. The next required holds cost $720, $1,650 and $3,400, so the main fleet can be bought in a small number of good runs.
- Harbour requirements jump from 18 cells at Fogbank to 22 at Coral, 31 at Lantern and 44 at Starfall. After Starfall, the required capacity *falls* for several harbours. The largest 50-cell hold is required by Bluecap, harbour 16. Boat ownership and global reputation automatically unlock the whole contiguous chain once requirements are met; there is no local mastery goal.
- Each successful voyage grants `8 + 4 × jobs` reputation, while most later harbour thresholds rise by only 35. A full hold can cross a new threshold in roughly two wins.
- Standard individual job payouts grow from $48–$112 at Sleepy Cove to $1,602–$1,790 at Sunrise Crown. The voyage multiplier rises with global voyage number and harbour index, so revisiting the easiest waters becomes more lucrative without more route risk. A rare job pays `450 + 83 × harbour index` before that multiplier. Broker's Desk increases rare offer chance from 14% to 62% for only $1,440 total. Its offer seed changes after every run, including a failed one, allowing cheap rerolls.
- Repair cost is at most `(100 − condition) × repairRate`; even the most expensive boat's rate is $2.45 per condition point, far below late voyage income. Damage is therefore not a meaningful cash sink. The backup sailboat should remain a free safety net.
- Progress lives in local storage. That is acceptable for a prototype but cannot safely be the sole record for purchased currency or entitlements.

## Design target

Make the first purchase feel attainable, then make each region a meaningful set of voyages. Aim for **10–16 hours to chart all 25 harbours** for a typical engaged player. This is the first campaign milestone, **not total game completion**. A full fleet, mastery medals and optional collections should give interested players roughly 25–40 hours of meaningful goals before the repeatable live cadence becomes their main reason to return. Those are design hypotheses to measure, not industry-standard completion times: real run time, failures, packing time and offer selection need telemetry before locking numbers.

Mobile games are normally measured in short sessions and return visits rather than a fixed lifetime hour count. GameAnalytics' 2026 benchmark of 16,000+ mobile games reports a median 3.1–3.5 minute session and roughly 12 minutes of daily play for active players; these broad cross-genre figures are context, not a target for every Crate Escape player. Standard packing plus sailing should fit a few minutes, while longer voyages should be clearly marked special commissions. [GameAnalytics 2026 benchmarks](https://www.gameanalytics.com/cn/reports/2026-mobile-pc-gaming-benchmarks)

Every harbour and every functional boat stays earnable without payment. A purchase can shorten a clearly stated task, buy a style variant, or add optional content. It must never be needed to repair a stranded player, and bought currency must never be spent by a single ambiguous tap during a run.

## Proposed core loop

1. **Net delivery pay:** Replace the sum of uncapped job face values with a harbour pay budget multiplied by packed cargo cells, risk and condition. Keep a readable receipt: cargo pay, care bonus, damage/delay deductions, service fee. Do not grant a global voyage multiplier without a cap. A full, clean run should earn about 1.2–1.5 times a modest run, not 3–4 times as much.
2. **Local chart progress:** To reach each next harbour, complete the stated number of successful deliveries from the current harbour, including at least two different cargo types and one clean or challenge delivery. Failed runs do not reset progress. This creates time spent learning each coast rather than waiting for one global reputation number.
3. **Expedition outfitting:** Pay a visible one-time cash cost when opening the next harbour. The cost funds charting and gear and is never charged again. Show `deliveries remaining`, `boat hold needed`, and `cash to outfit` on the map. Let players choose any previously unlocked harbour to earn toward the fee.
4. **Fleet and upkeep:** Raise boat prices gradually. Scale repairs with boat tier and actual damage, but show the estimate before sailing. Add a modest 8–12% service deduction on successful paid voyages. Condition below 70% should have a small visible handling penalty, giving repair a reason before the boat becomes unusable. Keep the backup sailboat free to use and repair.
5. **Rare jobs:** Reduce the base chance to roughly 4%; Broker's Desk levels take it to 7%, 10% and 14%. Keep rare jobs exciting but cap their premium to about 1.8× a comparable normal cargo load. Broker upgrades should have a payback period of many voyages rather than one lucky offer. Failed or abandoned voyages should not cheaply reroll the board.
6. **Reputation:** Use it for optional prestige contracts, cosmetics and later region eligibility, with a slower award tied to completion quality. The local charter record remains the main map gate. Never revoke an already opened harbour when reputation falls.

## All 25 harbour gates

`Runs` means successful deliveries in the immediately preceding harbour. Proposed outfitting fees are in **game cash**, never real money. Capacity is the smallest owned usable hold. Each harbour also requires the previous one to be open. The existing global reputation thresholds are included to expose the current pacing; replace them with local chart progress rather than layering the new rules on top.

| # | Harbour | Current rep / hold | Proposed runs | Proposed hold | Outfitting fee |
|---:|---|---:|---:|---:|---:|
| 1 | Sleepy Cove | 0 / 0 | Start | 0 | $0 |
| 2 | Fogbank Harbour | 0 / 0 + Speedboat | 4 | 18 | $0 |
| 3 | Coral Key | 25 / 22 | 5 | 18 | $250 |
| 4 | Lantern Bay | 70 / 31 | 6 | 22 | $500 |
| 5 | Starfall Port | 140 / 44 | 7 | 22 | $750 |
| 6 | Willowmere | 170 / 31 | 5 | 22 | $1,000 |
| 7 | Seabird Point | 205 / 31 | 5 | 22 | $1,250 |
| 8 | Pinewatch Quay | 240 / 36 | 6 | 26 | $1,500 |
| 9 | Glasswater Inlet | 275 / 36 | 6 | 26 | $1,750 |
| 10 | Emberhook | 310 / 36 | 6 | 26 | $2,000 |
| 11 | Tidepool Terrace | 345 / 44 | 7 | 31 | $2,250 |
| 12 | Copperbell Wharf | 380 / 44 | 7 | 31 | $2,500 |
| 13 | Mossy Narrows | 415 / 44 | 7 | 31 | $2,750 |
| 14 | Pearlspire | 450 / 44 | 7 | 31 | $3,000 |
| 15 | Duskfen Landing | 485 / 44 | 8 | 36 | $3,250 |
| 16 | Bluecap Sound | 520 / 50 | 8 | 36 | $3,500 |
| 17 | Frostfern Dock | 555 / 50 | 8 | 36 | $3,750 |
| 18 | Saffron Steps | 590 / 50 | 8 | 36 | $4,000 |
| 19 | Moonmoth Pier | 625 / 50 | 8 | 44 | $4,250 |
| 20 | Gullwing Reach | 660 / 50 | 9 | 44 | $4,500 |
| 21 | Firefly Lagoon | 695 / 50 | 9 | 44 | $4,750 |
| 22 | Opalbreaker | 730 / 50 | 9 | 44 | $5,000 |
| 23 | Cloudglass Haven | 765 / 50 | 9 | 50 | $5,250 |
| 24 | Aurora Shelf | 800 / 50 | 10 | 50 | $5,500 |
| 25 | Sunrise Crown | 835 / 50 | 10 | 50 | $5,750 |

This is **174 successful deliveries** across the preceding harbours if a player advances directly. Checkpoints: Fogbank after 4, Starfall after 22, Tidepool after 57, Bluecap after 94, Sunrise after 174. Revisit voyages still count for cash and endless level progress. The delivery gates are the pacing floor; cash should not add more than a few extra runs at each gate for an average player.

## All boats and purchase roles

The prices below are game cash. A boat is a *choice* within its tier where possible; a harbour checks hold size, not one named boat. Existing owned boats and upgrades must be preserved when balancing rolls out.

| Boat | Hold | Current price | Proposed price | Role |
|---|---:|---:|---:|---|
| Little Dinghy | 12 | $0 | $0 | Starter, viable on early routes. |
| Skipjack Speedboat | 18 | $250 | $750 | First expansion and Fogbank route; fast but delicate. |
| Pip Skiff | 13 | $390 | $950 | Optional nimble time-trial boat; priced for handling, not capacity. |
| Merry Trawler | 22 | $720 | $2,200 | First durable cargo boat; opens Lantern. |
| Twinfin Catamaran | 26 | $1,080 | $4,200 | Midgame route boat; opens Pinewatch. |
| Sunbeam Cruiser | 31 | $1,650 | $6,800 | Larger mixed cargo; opens Tidepool. |
| Hearthside Houseboat | 31 | $1,980 | $8,200 | Alternative 31-cell choice with durability and cosy style. |
| Bluebell Clipper | 36 | $2,850 | $10,500 | Long-route specialist; opens Duskfen. |
| Cloudbreak Freighter | 44 | $3,400 | $14,500 | Large freight; opens Moonmoth. |
| Mossbank Barge | 50 | $4,950 | $28,000 | Late fleet milestone; opens Cloudglass. |
| Patchwork Sailboat | 8 | $0 | $0 | Permanent free recovery boat with a guaranteed fitting job. |

The 36-cell Clipper and 31-cell Houseboat are optional choices with different handling and earning profiles. No boat should be *strictly* better on speed, hold and safety at the same price. Before implementation, simulate each boat's clean and damaged voyage profit so the slow Barge does not become a mandatory but frustrating tax.

## Endless voyage levels

The current voyage number advances on wins without a limit. The first sound patrol appears at voyage 26, weather types unlock around voyages 16/25/34/50, and night missions begin at 61. Those gameplay lessons should remain free and arrive through play; payment must not hide a tutorial or remove a hazard. Retest their pacing once harbours take longer to unlock:

| Voyage band | Proposed purpose | Reward rule |
|---|---|---|
| 1–15 | Learn packing, steering, early fleets and first region. | Normal harbour pay; milestone paint at 10. |
| 16–25 | Wind and rain, first optional challenge contracts. | Small, fixed challenge bonus; no automatic pay escalation. |
| 26–49 | Acoustic patrol lesson and varied coastal routes. | Chart progress, prestige cosmetics and first token earn opportunities. |
| 50–60 | Storm and fog mastery. | Occasional fixed rare commission, bounded by cargo and risk. |
| 61–100 | Night voyages and larger fleet goals. | Milestone cosmetics and harbour contracts; payout remains tied to voyage risk. |
| 101+ | Endless mastery and rotating goals. | No unbounded pay multiplier. Repeatable cosmetic/prestige goals and capped cash rewards. |

The proposed local harbour deliveries and global voyage number are independent. A player can revisit a favourite harbour, and late features still enter the generated voyage system. If faster players reach voyage 26 before the relevant harbour can safely teach acoustic patrols, move that introduction to a clear harbour/voyage condition and show the existing tutorial once.

## Payout and timing bands to test

These are **net cash per successful run after routine service**, assuming a normal cargo load. A perfect full hold or rare job can exceed the band moderately. Short early routes should pay less than long risky routes.

| Harbours | Intended normal net/run | Typical charting time at launch |
|---|---:|---:|
| 1–5 | $110–$500 | 1–3 minutes per voyage |
| 6–10 | $450–$800 | 2–4 minutes |
| 11–15 | $700–$1,100 | 2–4 minutes |
| 16–20 | $950–$1,400 | 3–5 minutes |
| 21–25 | $1,250–$1,850 | 3–5 minutes |

Time includes the normal packing and sailing loop. A clearly labelled rare expedition may take 5–7 minutes; routine late voyages should gain challenge through route choices, hazards and cargo rather than length alone. If the 174-delivery gate creates fatigue in play tests, reduce the delivery counts before stretching trips or cash prices.

Test a new save, a skilled player, a player with 20% failed runs, and one using only required boats. At each harbour, project wallet after its local delivery gate, fee, repairs and the next required boat. Tune payout and fees until the median player can afford the next boat near that gate; never tune by simply adding more forced repeats. Preserve enough early cash for a first mistake and repair.

## Optional monetisation, inspired by Tag with Ryan

Tag with Ryan's official store listings describe free runs, earned Suns and Pizzas, vehicles and upgrades, with ads and in-app purchases. Its App Store listing includes consumable currency and other bundles, and its developer describes ads as optional for extra chances. The useful pattern is an **earnable path plus optional acceleration and collectable extras**. Player reviews on that listing describe frustration with slow premium earning and accidental currency spending; avoid those behaviours here.

**Phase 1 — safest launch offer:** A permanent `Captain's Collection` (suggested test price £3.99–£4.99) with 3–4 distinct hull paint schemes, sail patterns and shipyard decorations. A future optional five-harbour expansion could be a separate, clearly priced permanent add-on after the original 25. Neither changes steering, detection or base pay.

**Phase 2 — optional acceleration after retention data:** Add `Chart Tokens`, earnable at a modest fixed rate from weekly chart challenges and harbour milestones, and sold in clearly priced packs. Example test catalog: 30 / 90 / 220 tokens at approximately £1.99 / £4.99 / £9.99. Tokens may buy an optional boat blueprint or reduce a *cash* outfitting fee, or skip at most half of a harbour's local delivery count. Every player still completes at least one actual delivery there and meets the hold requirement. Show the exact token and real-money cost before purchase; no mystery boxes, random rewards, timers, or pressure after failure. A direct non-consumable unlock may be clearer than tokens for some products; compare conversion and comprehension before choosing.

**Optional rewarded ads:** Only after the audience and platform policy decision. Offer a clearly labelled post-voyage 20% cash bonus or one repair voucher with a daily cap. No forced interstitials, no ad while piloting, and no ad required to recover a stranded boat. Ads must not inflate income enough to collapse the charter pacing.

## Purchase and audience prerequisites

1. Decide whether this is a general-audience game or also directed at children. Its playful art may appeal to younger players; audience declarations and advertising design must match the actual target. If children are included, apply the platform family rules, age handling and certified ad requirements before any SDK is added.
2. Use the platform purchase systems for native digital products. Non-consumables need reliable restoration; consumable tokens need purchase validation, idempotent grant/consume records, refund handling and cross-device recovery. Local storage cannot be the authority for paid value. The GitHub Pages build should remain a free demo until a secure web entitlement/payment path exists.
3. Put the store behind a clearly labelled adult/payment step if the audience includes children. Keep real money amounts visibly different from game cash and tokens. Provide `Restore purchases`, transaction history and support/recovery paths.
4. Roll out balancing separately from billing. First instrument anonymous progression funnels, then rebalance legacy saves without confiscating existing boats, cash, unlocked harbours or upgrades. Add a grandfathered unlock record so future rules do not relock current players.

## Measures and release gates

- Funnel: first delivery, first boat, Fogbank, Coral, Starfall, region boundaries, harbour 25; median and 75th percentile real play time and attempts.
- Economy: cash earned/spent by source, wallet distribution, repairs avoided, rare-offer frequency, time to each boat, percent of players stalled at a cash versus skill gate.
- Enjoyment: repeat failure after a new hazard, return rate after three voyages, route variety, use of old harbours, exit after seeing a price, accidental purchase/restore complaints.
- Monetisation: purchaser conversion, refunded purchases, ad opt-in, token earn/spend balance, completion rate of free paths. Never optimize revenue while early completion or retention drops sharply.
- Release only after simulated progression for all 25 gates, real play tests of the first two regions, and store sandbox tests including cancel, refund, interrupted purchase, reinstall and restore.

The commercial question is whether players *return*, not whether a fast player can spend ten hours on a chart. Track day 1, day 7 and day 30 retention alongside actual median session length and time to each region. Give players layered reasons to return: one complete delivery in a short visit; a fleet or harbour goal across several visits; and rotating, handcrafted chart challenges, cosmetics or optional content across weeks. Infinite generated voyages provide replayability, but need distinct goals and variety so they do not feel like repeated tolls. GameAnalytics' latest report explicitly recommends loops at single-session, same-day and multi-day horizons; Unity's developer survey reports common use of daily missions and achievement challenges as retention tools. [GameAnalytics 2026 benchmarks](https://www.gameanalytics.com/cn/reports/2026-mobile-pc-gaming-benchmarks), [Unity Gaming Report 2025](https://gw-prd.hexagon.unity.com/resources/gaming-report-2025)

## Research basis

- [Tag with Ryan on the App Store](https://apps.apple.com/us/app/tag-with-ryan/id1440073810) and [Google Play](https://play.google.com/store/apps/details?hl=en-US&id=com.WildWorks.RyansTag): current listed free-to-play currencies, upgrades, ads and IAPs.
- [Google Play Families Policy](https://support.google.com/googleplay/android-developer/answer/9893335?hl=en): child-directed monetisation and advertising requirements.
- [Apple StoreKit purchase and restore guidance](https://developer.apple.com/documentation/StoreKit/offering-completing-and-restoring-in-app-purchases) and [Google Play Billing purchase lifecycle](https://developer.android.com/google/play/billing/lifecycle): purchase processing and recovery design.
