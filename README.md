# Legal Metrology Compliance Inspector

*A phone in an inspector's pocket, standing between a mislabeled bag of rice and the law.*

---

## The two-sentence version

Every packaged product you buy — biscuits, shampoo, rice — is legally required to tell you the truth about itself: price, weight, who made it, when. Nobody has time to check that by eye across a million shops, so this app lets a field inspector photograph a label and walk away with a real record — evidence, timestamp, GPS, the works — instead of a notepad and a prayer.

## What it's actually like to use

You're an inspector. You open the app. You log in, tell it which shop you're standing in, and the camera pops open — pointed *at the product*, not at your own face, because someone on this team once watched it default to a selfie camera on a real phone and fixed that before it could embarrass anyone in front of a judge.

You photograph a label. Maybe two, front and back. You tap done. Move to the next product. Repeat for however many items are on the shelf. When you're done with the shop, you get a report — one item, or the whole visit — as a PDF or an editable Word doc, photos and all, ready to hand to whoever needs it next.

If your signal drops in a shop basement, nothing is lost. Everything you've done lives on the device the whole time.

**What it can't do yet:** it can't *read* the label, and it can't *decide* whether it's legal. Those are the two hardest, most interesting pieces of the whole system — computer vision to extract the text, and a rule-engine to check it against actual statute — and they're not built yet. Every screen that would show a compliance verdict says so plainly: **pending**. Nothing here fakes a result. A wrong guess dressed up as a verdict is worse than an honest blank, and this project has tried hard not to make that mistake even once.

## Under the hood, for the people who care

A mobile-first Progressive Web App — React, Vite, no backend, deliberately. Everything a field inspector does happens in-browser and lands in IndexedDB on their own device. It runs over real HTTPS, because browsers flatly refuse to hand out a camera or a GPS fix to anything less.

A few decisions worth knowing about before you go digging in the code:

- **Login is fake, on purpose.** Any username and password "works." What's real is the *seam* underneath it — a single function standing in for a future real auth check, built so that swapping it out later touches one file, not the whole app.
- **No password is ever stored, anywhere.** Not even the fake one. Instead, the first time a username shows up, it gets a real, permanent internal ID generated for it — and that's what everything else in the system actually trusts.
- **A visit belongs to exactly one person, permanently.** Sessions aren't a single slot that gets clobbered when someone new logs in — they're a real, tagged, never-deleted history. Hand this phone to a colleague mid-shift, and your unfinished work is still exactly where you left it when you come back. Nobody's evidence gets silently erased because somebody forgot to log out.
- **Every photo gets normalized before it becomes evidence.** Whatever format a phone hands over — and phones hand over some strange formats — it comes out the other side as a clean, correctly-oriented JPEG. An upside-down photo in a legal document is the kind of small thing that quietly wrecks trust in the whole system.

## Where it stands right now

| Piece | Status |
|---|---|
| Login, roles, logout | Real |
| Starting a visit (GPS, shop/visit details) | Real |
| Capturing evidence (camera, multi-photo, upload) | Real |
| One visit per person, safely, always | Real |
| Item & visit reports, PDF + editable Word export | Real |
| Seizure memo (the serious legal document) | The mechanics work; the words inside are waiting on the rule-engine |
| Actually reading the label (OCR) | Not built yet |
| Actually judging compliance | Not built yet |
| Official-side dashboard | Not built — no real data to show yet |
| A real server, real accounts, real sync | Not built yet |

## Running it

```bash
npm install
npm run dev
```

Camera and GPS won't work over plain `http://` on a phone — that's a browser rule, not a bug. Use a deployed HTTPS URL, or deploy your own.

## Want the whole story?

**[`PROJECT_LOG.md`](./PROJECT_LOG.md)** has it — every real decision this project made, every bug it survived, and why things are shaped the way they are. It's long because the truth usually is.
