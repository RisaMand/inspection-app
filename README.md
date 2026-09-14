# Legal Metrology Compliance Inspector

*A phone in an inspector's pocket, standing between a mislabeled bag of rice and the law.*

---

## The two-sentence version

Every packaged product you buy — biscuits, shampoo, rice — is legally required to tell you the truth about itself: price, weight, who made it, when. Nobody has time to check that by eye across a million shops, so this app lets a field inspector photograph a label and walk away with a real record — evidence, timestamp, GPS, the works — instead of a notepad and a prayer.

## What it's actually like to use

You're an inspector. You open the app. You log in, tell it which shop you're standing in, and the camera pops open — pointed *at the product*, not at your own face, because someone on this team once watched it default to a selfie camera on a real phone and fixed that before it could embarrass anyone in front of a judge.

You photograph a label. Maybe two, front and back. You tap done. Move to the next product. Repeat for however many items are on the shelf. When you're done with the shop, you get a report — one item, or the whole visit — as a PDF or an editable Word doc, photos and all, ready to hand to whoever needs it next.

If your signal drops in a shop basement, nothing is lost. Everything you've done lives on the device the whole time.

**What changed, and what still can't.** For a long time this line read *it can't read the label, and it can't decide whether it's legal* — the two hardest pieces of the whole system, built separately by two other teammates, sitting completely unconnected to everything above. That's no longer true. A real OCR pipeline and a real, config-driven rule-engine are now wired straight into the capture flow: a label genuinely gets read, and a defined slice of it — the mandatory declarations being present at all, MRP format, that kind of thing — genuinely gets checked against real rule config, live, in the browser, landing on screen as **COMPLIANT**, **COMPLIANT WITH WARNINGS**, or **NON-COMPLIANT** instead of a placeholder. Multilingual reading is wired in too now — English and Hindi in one pass — though a real bug in it was caught the night before this project's first pitch: combined-script recognition measurably degrades even the English half of a mixed-script read, and can hallucinate Devanagari characters onto a label that's purely in English. The honest fix — reading each detected zone in both languages separately and keeping whichever pass scores higher confidence — is designed but not yet shipped; see `PROJECT_LOG.md`, Part 12, for the whole story. What's still honestly out of scope, and still says so rather than guessing: font-size and on-panel placement checks (out of scope for this round per Person 4's confirmed scoping — legal panel identity and measured font size — so they're filtered out of evaluation rather than faked), the sticker/price-tamper detection this project was originally conceived to specialize in, and a barcode scanner (the button on the Capture screen still just says it isn't built). The pipeline also hasn't yet been run through the two structured real-product test cases that would formally close its own milestone out — parked, not skipped. Nothing here fakes a result. A wrong guess dressed up as a verdict is worse than an honest blank, and this project has tried hard not to make that mistake even once.

**And the official side is no longer a placeholder either.** A full dashboard now exists — summary stats, violation-tier and trend charts, a filterable drill-down table, unrestricted search, a per-item report viewer, per-officer activity, and PDF export of both a filtered set and the whole dataset — every bit of it real, working UI, deliberately built against a hand-crafted mock dataset rather than a real backend, because a real backend didn't exist yet when this work started and waiting for one would have meant not building any of it at all. A real backend does now exist, in this same repository under `backend/`, with real authentication, a real (if still incomplete) sessions-and-products schema, and real offline-sync conflict handling — reviewed and independently live-tested against a real Postgres instance, twice, not just read. The frontend and this backend aren't fully wired together yet, on purpose, until the backend's own remaining, tracked gaps close — the dashboard's mock data is deliberately shaped to match the backend's real, corrected contracts, so that swap is meant to stay small and contained rather than becoming a second rebuild.

**And, because this project has never left out the parts that are hard to say:** this build was submitted to, and demonstrated live in, the first internal round of the Smart India Hackathon, and did not advance to the next stage. The judge's feedback was specific, and is being taken seriously rather than waved off: the location-accuracy standard a real government deployment needs likely calls for a native, multi-constellation GNSS layer rather than a browser's Geolocation API, and shipping this as an installable web app rather than a native application was read as trading real-world accuracy for lower build cost, for a customer whose stated priority is the opposite. Both were deliberate, named trade-offs from day one of this project (see `PROJECT_LOG.md`, Part 0) — they simply turned out to be the wrong trade-offs for this particular audience. The full account, including what's genuinely being weighed as next steps, is in `PROJECT_LOG.md`, Part 13.

## Under the hood, for the people who care

A mobile-first Progressive Web App — React, Vite — with a real Node/Express + PostgreSQL backend now living in the same repository under `backend/`. Everything a field inspector does still happens in-browser first and lands in IndexedDB on their own device before anything is ever sent anywhere; the backend exists for accounts, sync, and the official dashboard, not for the safety-critical, no-signal-required capture-to-verdict loop, which stays fully on-device on purpose. The whole thing runs over real HTTPS, because browsers flatly refuse to hand out a camera or a GPS fix to anything less.

A few decisions worth knowing about before you go digging in the code:

- **Inspector login now attempts a real, backend-issued token first.** It tries the real thing, and if the network call fails — no signal, backend not reachable — it degrades to continuing the visit locally rather than blocking an inspector who's standing in a shop with no bars. Official-side login and the dashboard it unlocks are, as of this writing, still running against hand-built mock data rather than this same real backend; see the status table below for exactly which is which.
- **No password is ever stored on the device, anywhere.** The backend hashes and checks real credentials server-side; the client never holds anything but the token that login hands back.
- **A visit belongs to exactly one person, permanently.** Sessions aren't a single slot that gets clobbered when someone new logs in — they're a real, tagged, never-deleted history. Hand this phone to a colleague mid-shift, and your unfinished work is still exactly where you left it when you come back. Nobody's evidence gets silently erased because somebody forgot to log out.
- **Every photo gets normalized before it becomes evidence.** Whatever format a phone hands over — and phones hand over some strange formats — it comes out the other side as a clean, correctly-oriented JPEG. An upside-down photo in a legal document is the kind of small thing that quietly wrecks trust in the whole system.

## Where it stands right now

| Piece | Status |
|---|---|
| Login, roles, logout (inspector path) | Real — attempts a real backend login first, falls back to continuing offline if the call fails |
| Starting a visit (GPS, shop/visit details) | Real, on-device |
| Capturing evidence (camera, multi-photo, upload) | Real |
| One visit per person, safely, always | Real |
| Item & visit reports, PDF + editable Word export | Real |
| Seizure memo (the serious legal document) | Real — populated with real verdicts, clause citations, and extracted fields |
| Actually reading the label (OCR) | Wired in and running (Tesseract, in-browser, English + Hindi) — a real combined-script accuracy bug is open, see Part 12 of the log |
| Actually judging compliance | Wired in and running, for presence & format rules — font-size and placement checks deliberately excluded as out of scope for this round (Person 4), not pending data |
| Barcode scanning | Not built — button on the Capture screen says so honestly |
| Backend — auth, sync, sessions, products, rule config | Real, live-tested against a real Postgres instance — genuine remaining gaps tracked as GitHub issues in this repo, not hidden |
| Official-side dashboard (UI) | Real, full-featured — summary, tier/trend charts, filter/drilldown, search, per-item report viewer, officer activity, PDF export |
| Official-side dashboard (data source) | Deliberately mocked, contract-matched to the real backend — not yet swapped to live calls |
| Smart India Hackathon, internal Round 1 | Submitted, demonstrated live, not advanced — see Part 13 of the log for exactly why |

## Running it

```bash
npm install
npm run dev
```

Camera and GPS won't work over plain `http://` on a phone — that's a browser rule, not a bug. Use a deployed HTTPS URL, or deploy your own.

## Want the whole story?

**[`PROJECT_LOG.md`](./PROJECT_LOG.md)** has it — every real decision this project made, every bug it survived, and why things are shaped the way they are. It's long because the truth usually is.
