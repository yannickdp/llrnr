# llrnr — build checklist

Task breakdown of [PLAN.md](PLAN.md) and [PLAN-ROMA.md](PLAN-ROMA.md), in build order.
Mark `[x]` as things land. Section references point at the plan text that defines
"done" for each item.

Phases are ordered but not strictly gated: Phase 3 is the differentiator and must not
slip behind Phase 4.

**Standing rule — the app speaks Dutch.** Every user-visible string is Dutch: screens,
buttons, badge names, the readiness panel, error messages and the parser's
rejected-line reasons. Code stays English (identifiers, card fields, comments, these
plans), Latin stays Latin (stage and building names, each glossed in Dutch), and dates
and numbers use `nl-BE`. See PLAN §1. Any new checkbox below that puts words on the
screen inherits this without saying so again.

---

## Phase 0 — scaffolding

- [x] Create the folder layout of PLAN §6 (`css/`, `js/`, `js/roma/`, `data/`, `icons/`)
- [x] `index.html` shell: all screens as hidden `<section>`s, one visible at a time
- [x] `viewport-fit=cover` + `env(safe-area-inset-*)` padding (notch / home bar)
- [x] `100dvh` everywhere instead of `100vh`
- [x] Disable double-tap zoom and text selection on buttons
- [x] Local dev server documented (`npx serve` / `python -m http.server`)
- [x] Git repo initialised, scaffolding committed on `main`
- [ ] Add the GitHub `origin` remote and enable Pages *(needs the repo URL)*

---

## Phase 1 — walking skeleton (on her phone on day one)

### 1.1 CSS shell
- [x] `css/style.css`: mobile-first, CSS variables for theming
- [x] Bottom tab bar — Home / Words / Tests / Settings (PLAN §5)
- [x] Lesson flow styled as a modal over the tabs, not a tab

### 1.1b Dutch throughout *(added after the shell was built in English)*
- [x] Translate the shell: tab bar, screen headings, buttons, placeholder copy
- [x] Direction picker reads **Latijn → Nederlands / Nederlands → Latijn / Beide**
- [x] Parser rejects and warnings carry a stable English `code` **and** a Dutch message
- [x] Loader and boot failures report in Dutch ("De lijsten konden niet geladen worden")
- [x] Tests assert on `code`, not on the Dutch wording
- [x] `<html lang="nl">`
- [x] Manifest `name` / `short_name` in Dutch
- [ ] Dates and numbers formatted `nl-BE` *(nothing renders one yet — due with the
      streak, the heatmap and the test dates)*
- [x] Check the Dutch copy still fits a 390px screen — it runs longer than the English

### 1.2 `parse.js` + a real chapter
- [x] Parse `term | form | translation`; 2-field lines read as `term | translation`
- [x] `/` splits alternative translations; full string kept as canonical answer
- [x] `#` comments; first `#` line becomes the chapter title
- [x] Trim whitespace, ignore blank lines and stray `\r`, strip UTF-8 BOM
- [x] Fallback separator: `;` or tab if the first data line has no `|` (report which)
- [x] Rejected lines returned with line number + reason (never silently dropped)
- [x] `normalize()`: lowercase, trim, collapse whitespace, strip accents
- [x] FNV-1a hash → `id = hash(normalize(term))` (content-derived, not positional)
- [x] Homograph rule: on a duplicate normalised term, add the form's first word to the
      hash for the colliding cards, and flag the pair
- [x] Detect translations mapping to several terms; expose them as collision warnings
- [x] `data/latin-chapter-01.txt` — **stand-in** list carrying the awkward cases
- [ ] Swap in her real chapter 1 and bump `rev` *(no real list available yet)*
- [x] `data/index.json` — list `id`, `file`, `rev`
- [x] Fetch lists as `file.txt?v=<rev>` (cache busting)

### 1.3 `schedule.js` — the heart
- [x] Phases `new → acquire → retain → learned` with transitions (PLAN §2)
- [x] Acquire micro-ladder: 5s / 25s / 2m / 10m
- [x] Correct → next micro-step; wrong → back to micro-step 1
- [x] Clearing the 10m step graduates to retain, box 1, due tomorrow
- [x] Retain boxes: 1d / 3d / 7d / 21d / 60d → `learned`
- [x] Correct → up a box; almost → same box, due tomorrow
- [x] Wrong in retain → back to acquire micro-step 1 **in the current session**
- [x] All scheduling on absolute `dueAt` ISO timestamps vs `Date.now()` — never `setTimeout`
- [x] Pure module, injectable clock, readable on one screen
- [x] Throwaway fake-clock script: prove 5s / 25s / 2m / 10m / tomorrow

### 1.4 `lesson.js` — the loop
- [x] Priority queue on `dueAt`, most overdue first
- [x] Time-boxed lesson, default 10 min *(5/10/15 is a parameter; the Settings
      control for it is Phase 4.5)*
- [x] Presentation card for brand-new words (see it, form, tap on)
- [x] New-word presentations spread through the lesson, not front-loaded
- [x] Multiple choice on a presentation card's first check only, never again
- [x] Prompt → anticipation gap (countdown ring, default 4s) → type → reveal
- [x] Reveal shows correct answer, all accepted alternatives, grammar form
- [x] Micro-ladder repeats win on priority; interleave retain reviews into the gaps
- [x] ~8–10 new words per session in practice
- [x] X button with confirm; no back button mid-lesson
- [x] Results screen: graduated, boxes climbed, drop-backs
- [x] In-memory progress only at this stage

### 1.5 Ship it
- [x] `manifest.webmanifest` — Dutch name, icons, standalone, portrait, `nl-BE`
- [x] `icons/icon-180.png` (apple-touch-icon), `icon-192.png`, `icon-512.png`,
      drawn by `icons/make-icons.py` (stdlib only, re-run to redraw)
- [x] `<link rel="manifest">` + `apple-touch-icon`, verified served and fetchable
- [ ] Add the GitHub `origin` remote and push *(needs the repo URL)*
- [ ] Turn on Pages: Settings → Pages → branch `main`, folder `/`
- [ ] **Install on her iPhone from Safari and run one real lesson**

---

## Phase 2 — it teaches properly

### 2.1 `store.js`
- [x] `llrnr.progress.v1` single blob, shape per PLAN §4, `version: 1` from day one
- [x] Load / save on every change; migrate hook in place
- [x] Cards keyed by content hash, `term` stored alongside for readability
- [x] `lists[]` per card — union of chapters, keeps the card when a chapter leaves the pool
- [x] `settings` persisted (lessonMinutes, newPerLesson, anticipationSeconds, sound,
      lastDirection) and honoured by the lesson *(the Settings screen to edit them
      is Phase 4.5)*
- [x] Unreadable or newer-version data is set aside under `.broken`, never overwritten
- [x] A refused write (Safari private mode) is reported on Home, not swallowed
- [x] Home shows real due / new counts instead of illustrative ones

### 2.2 `answer.js`
- [x] Case-insensitive, accent-stripped, whitespace-trimmed matching
- [x] Any `/`-separated alternative accepted
- [x] Levenshtein distance 1 → **almost**, with "bijna! het is *mater*"
- [x] Clean recall = correct first attempt, no hint, no almost — and a slip that
      day in that direction disqualifies the day, in either order
- [x] Words shorter than 4 letters are never "almost" (ad/ab, et/ex are different
      words, not typos)
- [x] Reverse mode: accept any word in the pool sharing that translation, credit the
      card that was asked

### 2.3 Direction
- [x] Three-way picker on Start lesson: Latin→Dutch / Dutch→Latin / Both
- [x] Pre-select `lastDirection`; remember the choice
- [x] Per-direction `dirOk.{fwd,rev}` and `cleanDays.{fwd,rev}` (cap at max `targetRecalls`)
- [x] Both mode picks the weaker-record direction, alternating on a tie
- [x] Boxes climb on whatever direction was tested — no stalling at box 2, ever
- [x] `learned` gated on a clean recall **both** ways; otherwise park at box 5
- [x] **one-way** marker on parked cards, and they keep returning occasionally
- [x] Words screen shows the one-way count per chapter with a button that drills
      exactly those words in the missing direction *(a focused lesson: it serves
      them even though a parked word is not due for 60 days)*
- [x] Only the headword is typed in reverse (`mater`, not `mater, matris, f.`)
- [x] Small marker in-lesson showing which way round the question is

### 2.4 Backlog protection
- [x] Cap review load at ~40 items per lesson
- [x] Order candidates lowest box first, then most overdue
- [x] Never render a wall of hundreds of due cards — the remainder is one number
      on the results screen, never a list
- [x] Micro-ladder repeats are exempt from the cap, or a repair would break
      mid-session
- [x] A card whose chapter has left `index.json` is skipped, not crashed on

---

## Phase 3 — it is useful for school *(the differentiator — do not defer)*

### 3.1 `cram.js`
- [x] Test objects: `id`, `title`, `date`, `lists[]`, `targetRecalls`, `directions`
- [x] Test-ready = 3 clean recalls on 3 separate days, **in each direction**
- [x] Pool narrows to chapters in scope; other chapters stop introducing new words
      but still serve genuinely overdue reviews if there is room
- [x] Interval compression: `clamp(floor(daysLeft / recallsStillNeeded), 1d, normal)`
- [x] Weakest-first ordering: fewest clean recalls, then most overdue, per direction
- [x] After the test date, words return to normal retain intervals from their box
- [x] Pure module, fake-clock tested, separate from the lesson loop — `schedule.js`
      gained a `capInterval` seam so the exam logic stays out of the plain
      interval arithmetic

### 3.2 Readiness panel
- [x] "N van de M woorden klaar in beide richtingen"
- [x] "K woorden zitten goed van Latijn naar Nederlands, nog niet omgekeerd"
      (the key diagnostic)
- [x] Shaky count and not-started count ("wankel", "nog niet begonnen")
- [x] Minutes-a-day estimate from **remaining clean recalls across both directions**
- [x] [ Nederlands → Latijn oefenen ] button starting a lesson in that direction
- [x] Panel pushes above the city on Home while a test is in its run-up
- [x] Results screen leads with the readiness change ("+4 klaar voor de toets")
- [x] **A Tests screen that can create one** — title, date, chapters, and remove
      *(not in the original checklist: the panel is unreachable without it)*

### 3.3 Breadth before depth
- [ ] When required work exceeds time available: every word to one clean recall each
      direction before pushing any word to three
- [ ] Say so out loud on screen — no silent reordering

### 3.4 Lists without a laptop
- [ ] Remaining chapters added under `data/`
- [ ] Paste-in importer (textarea) using the same `parse.js`
- [ ] Pasted lists stored under `llrnr.lists.v1`, same shape as committed lists
- [ ] **Import preview before saving**: parsed table, count, separator used, every
      rejected line with number and reason, homograph + collision flags
- [ ] Pool toggle per chapter on the Words screen

---

## Phase 4 — it is fun and durable

### 4.1 `gamify.js`
- [ ] XP for lasting progress only: 25 graduate acquire, 15 box promotion, 50 learned,
      small flat lesson-finish bonus — never per answer
- [ ] First lesson of the day worth double
- [ ] Stages, not levels: Roma Quadrata → Regnum → Res Publica → Imperium → Roma Aeterna
- [ ] Streak: consecutive days with a finished lesson; one freeze per week
- [ ] Daily goal ring (one lesson a day)
- [ ] Readiness ring replaces the daily ring during exam week
- [ ] Never lose XP for a wrong answer

### 4.2 Badges + celebration
- [ ] Badges: first word learned, ten learned, chapter fully learned, 7-day streak,
      30-day streak, lesson with no drop-backs, 100 typed answers,
      test-ready with a day to spare
- [ ] Badge popups on the Results screen
- [ ] Sounds, respecting the `sound` setting

### 4.3 Words screen visualisation
- [ ] new → acquire → box 1–5 → learned dot track per word (position, not percentage)
- [ ] Per-chapter spread across the track
- [x] One-way count per chapter with its fix-it button *(done in 2.3)*

### 4.4 Offline + backup
- [ ] `service-worker.js` caching shell, CSS, JS, icons and `data/*.txt`
- [ ] Cache-busting honours list `rev` so edited chapters actually update
- [ ] Export progress + pasted lists as JSON
- [ ] Import JSON back, with a confirm step
- [ ] Reset a chapter from Settings

### 4.5 Settings screen
- [ ] Lesson length, new words per lesson, anticipation gap, default direction, sound
- [ ] Export / import, reset a chapter

---

## Phase 4b — the reward city *(downstream of 4.1; see [PLAN-ROMA.md](PLAN-ROMA.md))*

Drawing technique is specified in [pixel-art-plan.md](pixel-art-plan.md) — engine
primitives, palette, and complete recipes for the temple, Colosseum, aqueduct and
triumphal arch. Section refs below point at PLAN-ROMA.

### 4b.1 Engine *(PLAN-ROMA §4)*
- [ ] 1. `js/roma/engine.js` — the five primitives `P` / `hash` / `blob` / `bloom` /
      `arch` (pixel-art-plan §3)
- [ ] `js/roma/palette.js` — the one shared palette; **no building hardcodes a colour**
- [ ] Three-tone shading rule (lit upper-left / base / shadow lower-right) applied
      throughout
- [ ] `glowTargets` + `emitters` registries — buildings push, never read
- [ ] All randomness from `hash(x, y)`, never `Math.random()`, never stored
- [ ] Renderer skeleton: canvas, `imageSmoothingEnabled = false`,
      `image-rendering: pixelated`, integer scale only, `devicePixelRatio` sizing,
      one hardcoded sprite, **crisp on a real phone**
- [ ] Fix the interface `draw(ctx, x, groundY, { scale, progress })` **now** — both
      the grid and the draw-function modes compile to it, and `progress` is expensive
      to retrofit *(§3, §5)*

### 4b.2 Stage 1 + the go/no-go *(§3)*
- [ ] 2. Stage 1's five sprites (character grids — hut, sheepfold, palisade, fig tree,
      altar) + the hills backdrop
- [ ] Fire system with stage 1, not later: procedural flame + smoke for `Ara`, the
      only motion in the city until stage 2 *(§4)*
- [ ] Slot map for all **25** buildings on paper — `(x, band)`, before the second
      building is drawn *(§5)*
- [ ] Throwaway spike of the temple recipe, to see the engine's ceiling
- [ ] **Stop and look on the phone** — go/no-go on hand-authored art vs a CC0 tileset.
      Judge it on **stage 1**, the rustic sprites with no recipe, not on the temple

### 4b.3 Unlock + the moment
- [ ] 3. Unlock logic against total XP; Home hero = a 320-wide window on the 560-wide
      scene *(§5, §7)*
- [ ] 3. Teaser is a **construction site**, not a dim silhouette: `progress` driven by
      XP, scaffolding on top, XP remaining underneath *(§5)*
- [ ] 4. The unlock moment — pan, scaffolding off, completion reveal via clip rect,
      chime, name card *(stopping point: still worth having)*

### 4b.4 Volume
- [ ] 5. Stages 2 and 3 (ten buildings) + the stage-crossing moment
- [ ] 5. Far band with the `mini*` silhouette treatment, colours pulled toward
      `hillFar` for atmospheric perspective — lands with `Murus Servii` *(§5)*
- [ ] 6. Stages 4 and 5 (**ten** buildings, incl. the new `Arcus Triumphalis`), ending
      at `Templum Iovis` — where the spec's recipes are cashed in
- [ ] `Aqua Appia` drawn as 3–4 arches running off the left edge, not full width *(§5)*

### 4b.5 Life, light and tuning
- [ ] 7. Life — citizens, smoke, a boat, birds, water shimmer, in a suspendable loop
- [ ] 7. Citizen count tracks words `learned` (capped ~12) — a free second progress
      read *(§4)*
- [ ] 7. Day/night pass driven by the **real clock**, not an auto-cycling timer
      *(§6)*
- [ ] 8. Retune the XP table against a week of real lesson data — the capstone moved to
      74 000 with `Arcus Triumphalis` and was always an estimate *(§2)*

### 4b.6 Invariants
- [ ] Layer cache: sky, hills and finished buildings offscreen, invalidated on unlock;
      per-tick redraw limited to fire, smoke, water, citizens *(§8 — required at
      560×180, not an optimisation)*
- [ ] Loop suspended on `visibilitychange` and by `IntersectionObserver`
- [ ] `prefers-reduced-motion` → one static frame, no flame flicker, no smoke, no bob
- [ ] Module seam holds: `render.js` knows no meanings, `catalogue.js` knows no
      drawing, `buildings.js` knows no unlock rules *(§8)*
- [ ] `roma.unlocked` / `stage` treated as caches: if they disagree with `xp`, **`xp` wins**
- [ ] `roma.seenXp` powers "what is new since she last looked?"
- [ ] Nothing about the art is persisted — `progress`, citizen count and time of day
      are derived at render time

---

## Later, if wanted

- [ ] "Test in 3 days, you are 12 words behind" push notification (installed PWA,
      permission from a tap, silent fallback if denied, never a nag screen)
- [ ] Spoken prompts via `speechSynthesis` for modern languages
- [ ] Silent warm-up utterance on the Start-lesson tap (iOS speech unlock)
- [ ] Grading grammar forms as a harder mode
- [ ] A second language list (French / English) to prove the generic model
- [ ] Roma extras: choice at some unlocks, tap-a-building history, nameplate mode,
      export the city as a PNG (`toBlob()` on the full scene), manual day/night toggle
      in the full-screen view only
- [ ] ~~Ruin mode for a neglected city~~ — **rejected** on purpose: nothing is ever
      taken away (PLAN-ROMA §10)

---

## Open questions to close

- [x] Dutch confirmed as the native language — and as the app's own language
- [ ] Are grammar forms examined? (assumed display-only for v1)
- [ ] Tune "3 clean recalls on 3 days" against a real mark once one exists
- [x] Word list format — settled: `term | form | translation` text, one word per line
- [x] Latin pronunciation — no longer a blocker (audio off the critical path)
- [x] iOS 16.4+ — settled; web push and Screen Wake Lock both available
