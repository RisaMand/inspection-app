# The Project Log

*Everything that actually happened, in order, told straight.*

This isn't a changelog in the boring sense — dates and diffs nobody reads. It's the record of every real decision this project made, every time it caught itself doing something dumb and fixed it, and every fork in the road where "the easy thing" and "the right thing" were two different options. Commit hashes are included wherever they exist, so nothing here is just a story — you can go check.

One honest scope note: this log covers the **frontend, PWA, and document-generation** side of the build — the part that's actually been built. The computer-vision/OCR half and the legal rule-engine half of this system are referenced constantly, because everything here was built *around the shape of where they'll plug in* — but they don't exist yet. That's not a secret. It's the single biggest open question hanging over this project, and it gets named plainly every time it matters.

---

## Part 0 — The decisions made before a single line of code existed

Every project has a shape before it has a body. Here's the shape this one was given, and why.

**It's a PWA, not an app-store app, not a website.** That sounds like a small choice. It isn't. A field inspector needs something that lives on their phone's home screen, opens the camera without ceremony, and keeps working when the signal doesn't — without anyone having to survive an app-store review process first. A Progressive Web App gets you all of that for the cost of a website. The alternative — a native Android build — was seriously on the table and deliberately set aside.

**Everything runs on the phone. Nothing waits on a server.** An earlier draft of this project's architecture leaned on a heavier setup — a real backend, jobs queued up, results polled for. That got thrown out. If an inspector is standing in a shop with one bar of signal, "please wait while we process this" is not an acceptable sentence. So the camera, the quality checks, and eventually the OCR and rule-checking are all meant to happen right there, in the browser, fast enough that nothing ever needs a spinner that says "processing."

**Offline is not a feature bolted on later — it's the foundation.** Everything that persists lives in IndexedDB, the browser's real local database, not the flimsier `localStorage` that can't reliably hold photos and forgets things it shouldn't.

**The law lives in data, not in code.** Whatever eventually checks a label against the actual Legal Metrology rules will read those rules from a versioned config file, never hardcode them into application logic. That's someone else's build, still to come — but it shaped how every screen here was written to accept *whatever* verdict comes back, generically, instead of being wired to expect one specific shape.

**Four things make this different, and they were earned, not assumed.** Before any of this got built, real competitive research went into what already exists — a prior national-competition winner's hardware-and-dashboard approach, a consumer-complaint app, adjacent open-source work. Out of that came four deliberate bets on where this project is actually different: it reads labels that mix English, Hindi, and regional scripts on the same package (most tools choke on this); it's built for an *inspector's* workflow, not a shopper's; it specifically hunts for a real, legally-defined fraud — a sticker pasted over the true price; and it tells the difference between a font-size slip-up and a genuinely missing MRP, instead of a flat pass/fail. These four ideas show up again and again in how screens were designed, because they weren't slogans — they were commitments.

**The team, honestly.** Six people are attached to this project on paper. As of the most recent working session, one of them had produced working code. That fact was written down plainly rather than danced around, because pretending otherwise would have meant quietly waiting on people who hadn't shown up, instead of making a real decision about what to do next.

**Two different kinds of "how bad is this violation" got kept separate, on purpose.** Whether a label breaks the law is a legal question. How urgently an inspector with forty products and one hour should care about it is a completely different, operational question. Rather than force those into one flattened field, the project kept them as two — a legal severity, and an inspection priority — because collapsing them would have quietly smuggled a legal opinion into a UI decision.

**Uncertain evidence gets to say "I don't know."** Long before any of the visual fraud-detection logic existed, the interface for it was scoped to four honest states, not two: a confirmed violation, a likely one, a perfectly legal pattern that must never *look* suspicious, and — critically — a state for when a sticker fully hides the original price and the system genuinely cannot tell what's underneath. That fourth state matters more than it sounds like it should. A tool that quietly defaults uncertainty into "pass" is a tool that lies by omission.

**No raw machine numbers in front of an inspector.** A confidence score of `0.87` means nothing to someone standing in a shop. Anything like that gets translated into plain language — "review this photo" instead of a percentage — before it's allowed anywhere near the primary screen. The number can live in a details panel for anyone who wants it. It never gets to be the headline.

---

## Part 1 — Laying the floor

The very first version of this app was, deliberately, almost embarrassingly simple: a login screen where any password works, a form to start a visit, and a camera that takes a photo. That simplicity was the point. Before anything clever could be built, something *honest and swappable* had to exist first.

The fake login wasn't laziness — it was a seam, built on purpose. One small function pretends to check a password today. Replacing it later with a real check means touching that one function, not rewiring the whole app around it. That pattern — mock something small and contained now, leave a clean seam for the real thing later — became the project's signature move, used again and again for every piece that wasn't ready yet.

From there, the actual inspector's journey got built piece by piece: a real login form with role-aware routing, a real "start a visit" screen with GPS capture and a manual fallback for when permission gets denied, and — the meatiest piece — a real capture screen. Live camera. Multiple photos per item, with thumbnails you could remove. A fake quality-check standing in for the computer vision that doesn't exist yet, flagged in plain comments as something that *must* be swapped before this ever meets a real judge. A file-upload fallback for when the camera isn't the right tool. A barcode-scan button that, refreshingly, just told the truth: *not built yet*, instead of pretending to work.

By the end of this stretch, photographs an inspector took were actually landing in a real session record, and the whole thing was safely pushed to a personal GitHub repository — a small, unglamorous, genuinely important decision, made explicitly so that nine commits of real, working code weren't one bad afternoon away from vanishing.

---

## Part 2 — Making it feel like a real tool

With the skeleton standing, the next stretch was about turning "a few working screens" into something that could survive being handed to a stranger.

Login and session state got moved out of fragile browser memory and into IndexedDB, so a refresh — or a dropped connection, or a phone that decided to nap — stopped meaning "start over." A sync-status indicator was added, honestly labeled as counting *locally saved* items rather than confirmed server syncs, because there's no server yet to sync to — a small piece of honesty that got explicitly debated and deliberately kept, on the reasoning that once a real backend exists, the same label becomes true without a single word needing to change.

The Item Report and Consolidated Visit Report screens came together next, and they were built to render *only real data* — actual photos, actual visit and shop details — with an unapologetic "compliance check pending" message everywhere a verdict would eventually go. No invented pass/fail. No pretend confidence. Both report types could be exported as real PDFs with embedded evidence photos, and shortly after, as editable Word documents too — closing a promise that had been sitting unfulfilled since the very beginning.

The seizure memo — the single highest-stakes document this system can produce — got its skeleton here too: a genuine draft-versus-confirmed toggle, because a legal notice that looks final before a human has actually signed off on it is a liability, not a feature. Every field inside it was marked plainly as waiting on the rule-engine, rather than filled with anything invented.

Somewhere in here, the app also stopped being a collection of screens you had to reach by typing URLs by hand, and became something you could actually click through start to finish: capture an item, see its report, scan the next one, close out the visit. It sounds small. It's the difference between a tech demo and a tool.

---

## Part 3 — The reckoning

This is the long stretch, and it deserves to be told honestly, because it's where this project stopped being merely functional and started being *trustworthy*.

A hard rule got set at the start of it: no more building forward, no talking about the pieces still waiting on other people, until this thing had been tested by fire — repeatedly, deliberately, looking for every gap, not just the obvious ones — with nothing left unexamined.

**The first thing the fire found was embarrassing.** Role-based access had been wired up, screens gated, everything looking correct — except the one piece of data that made the gate actually work had never been passed through. Every single login, regardless of role, was quietly landing on the same screen. A one-line fix. A real lesson about the gap between "looks right" and "is right."

**Then it found something worse than a bug — an absence.** There was no way to log out. None. And worse: the login screen had no idea whether someone was already logged in, meaning a second person could type one URL and silently hijack an active session mid-work, no warning, no trace. Both got fixed together — a real Log Out button, and a login screen that now recognizes when it's being visited by someone who's already signed in.

**Then it found something that would have been genuinely dangerous.** Deny the camera permission — deliberately, as a test — and the capture button kept working anyway, quietly producing a *black, empty photograph* and letting it flow into the evidence trail like it was real. For a tool whose entire purpose is producing legally defensible evidence, a fake photo masquerading as a real one is about as bad as bugs get. It's fixed now — no stream, no capture, full stop, with a clear message instead of a silent lie.

**Manual GPS entry accepted nonsense.** Letters where numbers should be. No range checking. A field meant to record a real location happily swallowed garbage and would have written it straight into a legal record. Fixed with real number constraints and honest range validation — while still letting a genuinely empty field mean exactly what it should: *not captured*, not *invented*.

**Nothing stopped an item from collecting fifty photographs, or a visit from swallowing hundreds of them.** Not a theoretical risk — every photo is a real, full-sized image, held in memory, written to local storage, and eventually baked into a PDF. A two-tier answer was chosen deliberately: gently warn an inspector piling up photos on one item, because there's rarely a real reason to need more than a handful of angles on one product — but only *nudge*, never block, on the number of items in a single visit, because a real inspection could legitimately need forty.

**Then the search got more serious, and it found four real, separate things in one pass.** The camera was quietly staying on after leaving the capture screen — genuinely, physically, the little indicator light stayed lit — because of a subtle timing bug in how the camera stream was being tracked and released, made worse by a development quirk that briefly opens *two* camera streams instead of one. It took a few tries to actually pin down, and it wasn't trusted as fixed until the physical light on the laptop was watched turning off in real time — because a log claiming success and a camera that's still visibly on are not the same thing, and only one of them can be believed.

In the same pass: photographs captured but never finished as an item were being saved under one shared, unscoped slot — meaning an abandoned draft from one visit could silently reappear, misattributed, inside an entirely different one later. And every uploaded photo that wasn't already a plain JPEG — anything from an iPhone, anything saved as a PNG or WEBP — was quietly being mislabeled in the exported documents, a real risk of corrupted or broken evidence images in the one place they absolutely cannot fail: the final report. Both were fixed at the root, not patched around.

**And then the fourth thing in that pass turned out to be the whole rest of the story.**

---

## Part 4 — The session that ate the day

What started as "make sure two people sharing a device can't step on each other's work" turned into the most significant architectural rebuild in this project's history, and it's worth walking through slowly, because the reasoning matters more than the fix.

The first instinct was small: tag each visit with whoever started it, and warn if someone else's login stumbled into it. That got tested against reality and found wanting almost immediately — a warning that only fires on one specific button doesn't help if there are five other doors into the same room. So the next instinct was to guard *every* door — every screen, every route. But that just moved the real problem one step over: the moment a second person is blocked from someone else's unfinished visit, *something* still has to happen to that visit. Force them to log out and lose their own moment of momentum? Or let them past — but at the cost of quietly destroying the first person's evidence?

Both of those were the same bad trade wearing different clothes. And the reason kept being the same bad trade, no matter how the warning dialog was reworded, was the actual root of it: there was only ever **one slot** for a visit to live in. With one slot, somebody's data was always going to lose.

So the fix wasn't a smarter dialog box. It was getting rid of the scarcity entirely. Visits stopped being one overwritable record and became a real, permanent, tagged list — every visit remembers who made it, and ending a visit now means *archiving* it, not deleting it. Two different logins on the same device now simply don't collide, because there's finally room for both of them to exist.

That meant solving a smaller, sharper question first: who actually *is* "a person" in a system where the login is fake and any password works? The tempting shortcut — tag visits by username and password together — got tossed out almost as soon as it was proposed, and for a reason worth keeping: the password isn't checked against anything real, so it adds no genuine uniqueness, and there's no good reason to ever store a password anywhere, even a fake one nobody's verifying. What actually solved it: the first time any username shows up, it's given a real, permanent, randomly generated identity behind the scenes — and every visit is tagged with *that*, not with anything typed into a form. No password touches the database. Not once.

One more real fork came up along the way: should a person be able to have several visits open at once, switching between them freely? It's tempting, and it maps to how a real inspector's day might actually feel. But it was set aside deliberately, in favor of something narrower and more honest: one open visit at a time, with a permanent, retrievable history of everything that came before. That choice traded a flashier feature for something more important — it closes off an entire category of "which visit was I even looking at" mistakes before they can happen, and it satisfies, almost as a side effect, a real requirement this system was always going to need anyway: a genuine, searchable record of past inspections.

The rebuild itself happened in five careful, individually verified stages — the new storage shape first, then real identity, then the actual redesign of how a visit gets found and updated, then a small but important correction to a warning message that had quietly become a lie the moment archiving replaced deleting, and finally wiring the real identity through to make all of it live.

And even after all five stages landed, testing it end-to-end — really testing it, not just glancing at it — turned up two more real problems hiding in the wiring. A couple of functions had quietly become asynchronous partway through the rebuild, and a couple of call sites hadn't caught up, which meant a freshly finished item briefly tried to navigate to a web address that was, quite literally, the word "Promise" instead of a real ID. And choosing to deliberately override an unfinished visit — the "yes, start fresh anyway" path — was creating a second, silently simultaneous "active" visit instead of properly closing out the first, which would have reopened a smaller version of the exact ambiguity this whole rebuild existed to kill. Both were caught by refusing to accept "it looks like it worked" as good enough, and both are fixed and proven now — not with a glance, but with two different logins, run through a full visit each, on a clean and deliberately reset database, checked directly against what was actually sitting in storage afterward.

That's the difference between a bug getting patched and a system actually earning trust.

---

## Part 5 — Meeting the real device

Every single test up to this point had happened on a laptop. That's a comfortable place to build, and a genuinely misleading one — because the actual person this app is for will never once open it on a laptop.

Testing on a real phone turned out to be its own small adventure. The obvious first attempt — same Wi-Fi network, laptop and phone talking directly — ran straight into a wall that had nothing to do with this app's code: browsers simply refuse to hand over a camera or a location fix to anything that isn't served securely, and a plain local network address doesn't count as secure, no matter how private it feels. No error, no permission prompt, no explanation — just silence, exactly where a working feature should have been.

The fix was to get this thing a real, secure address on the actual internet — a small, unglamorous deployment step that turned out to be the only way to genuinely test a camera on a phone at all. And the very first real result was exactly what had been quietly predicted beforehand: the camera opened facing the wrong way. A selfie camera, on a tool built for photographing products, would have been a visibly bad first impression in front of anyone judging this live. It's fixed now — the rear camera is requested explicitly, with a safe fallback for laptops and any device that only has the one — and it wasn't trusted as fixed on faith. It was confirmed live, on an actual Android phone, camera pointed the right way, before it was allowed to be called done.

As a genuinely nice surprise along the way: the app installed cleanly to a real phone's home screen as its own icon, proof that the Progressive Web App groundwork laid at the very start of this project actually works, not just in theory.

---

## Where things stand

The core loop — log in, start a visit, photograph products, close it out, get a real report — works, is safe on a shared device, survives a dropped connection, and has been tested against its own worst-case scenarios more than once. That's not a small claim, and it wasn't earned casually.

What's still missing is missing for a real, external reason, not neglect: nothing here can yet *read* a label or *judge* one, because the computer-vision and legal rule-engine pieces of this system haven't been built by the people responsible for them. Every screen that would eventually show a verdict is honest about that gap right now, rather than papering over it.

A few things are also missing on purpose, by deliberate choice rather than oversight — the visual design pass, the pitch materials, and formal outward-facing documentation beyond this log all sit in a "not yet, and that's fine" pile, waiting for their moment rather than competing for attention with the parts of this system that actually needed to be bulletproof first.

One small, cosmetic thing is still sitting there too — evidence photos in the exported reports occasionally get squeezed into the wrong proportions. It's noticed, it's logged, and it's been deliberately left alone, because a slightly stretched photo in a government document is the kind of thing that's forgivable, and chasing it wasn't worth the hours that mattered more elsewhere.
