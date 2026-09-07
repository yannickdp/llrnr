# llrnr — build checklist

Task breakdown of [PLAN.md](PLAN.md) and [PLAN-ROMA.md](PLAN-ROMA.md), in build order.
Mark `[x]` as things land. Section references point at the plan text that defines
"done" for each item.

Phases are ordered but not strictly gated: Phase 3 is the differentiator and must not
slip behind Phase 4.

**Phase 4c (the coach) is parked** — designed, kept, deliberately not scheduled. See
its own note for the test that decides whether it ever gets built.

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
- [x] Add the GitHub `origin` remote and enable Pages — `github.com/yannickdp/llrnr`

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
- [x] Add the GitHub `origin` remote and push
- [x] Turn on Pages: Settings → Pages → branch `main`, folder `/`
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
- [x] When required work exceeds time available: every word to one clean recall each
      direction before pushing any word to three
- [x] Say so out loud on screen — no silent reordering
- [x] Triggered by `feasible`: any word owing more clean days than there are days
      left makes three-recall readiness arithmetically unreachable

### 3.4 Lists without a laptop
- [ ] Remaining chapters added under `data/` *(blocked: no real lists yet — and
      the paste-in importer below means they never strictly need a laptop)*
- [x] Paste-in importer (textarea) using the same `parse.js`
- [x] Pasted lists stored under `llrnr.lists.v1`, same shape as committed lists
- [x] **Import preview before saving**: parsed table, count, separator used, every
      rejected line with number and reason, homograph + collision flags
- [x] Pool toggle per chapter on the Words screen — excluded chapters keep their
      cards, and Start goes dead if every chapter is switched off
- [x] Remove a pasted list again, leaving its cards in place

---

## Phase 4 — it is fun and durable

### 4.1 `gamify.js`
- [x] XP for lasting progress only: 25 graduate acquire, 15 box promotion, 50 learned,
      small flat lesson-finish bonus — never per answer
- [x] First lesson of the day worth double
- [x] Stages, not levels: Roma Quadrata → Regnum → Res Publica → Imperium → Roma Aeterna
- [x] Streak: consecutive days with a finished lesson; one freeze per week,
      refilled at the start of each new week
- [x] Daily goal ring (one lesson a day)
- [x] Readiness ring replaces the daily ring during exam week
- [x] Never lose XP for a wrong answer

### 4.2 Badges + celebration
- [x] Badges: first word learned, ten learned, chapter fully learned, 7-day streak,
      30-day streak, lesson with no drop-backs, 100 typed answers,
      test-ready with a day to spare
- [x] Badge popups on the Results screen
- [x] Sounds, respecting the `sound` setting — synthesised, no audio files, and
      created only after a tap so iOS allows them *(the toggle to turn them off
      arrives with Settings in 4.5; heard-on-device still unverified)*

### 4.3 Words screen visualisation
- [x] new → acquire → box 1–5 → learned dot track per word (position, not percentage)
- [x] Per-chapter spread across the track, with a count under each stop
- [x] Words answered today are ringed, so "what moved today" is on the screen
      and not only in a results panel she has dismissed
- [x] One-way count per chapter with its fix-it button *(done in 2.3)*

### 4.4 Offline + backup
- [x] `service-worker.js` caching shell, CSS, JS, icons and `data/*.txt`
- [x] Cache-busting honours list `rev` so edited chapters actually update
- [x] Export progress + pasted lists as JSON
- [x] Import JSON back, with a preview naming what is in it *and* what it replaces;
      the profile being overwritten is copied aside first
- [x] Reset a chapter from Settings, behind a confirmation — a word shared with
      another chapter is left alone, since the card is shared

### 4.5 Settings screen
- [x] Lesson length, new words per lesson, anticipation gap, default direction, sound —
      each a segmented control carrying the settings key it edits, so adding one is
      markup rather than another handler
- [x] Export / import, reset a chapter

---

## Phase 4b — the reward city *(downstream of 4.1; see [PLAN-ROMA.md](PLAN-ROMA.md))*

Drawing technique is specified in [plan-roma-updates.md](plan-roma-updates.md) — engine
primitives, palette, and complete recipes for the temple, Colosseum, aqueduct and
triumphal arch. Section refs below point at PLAN-ROMA.

### 4b.1 Engine *(PLAN-ROMA §4)*
- [x] 1. `js/roma/engine.js` — the five primitives `P` / `hash` / `blob` / `bloom` /
      `arch`, plus `dot` for the commonest call (plan-roma-updates §3)
- [x] `js/roma/palette.js` — the one shared palette, frozen; **no building hardcodes
      a colour**
- [x] Three-tone shading rule as *data* (`T.marble.lit/base/shadow`), so a recipe asks
      for a material by name and the test can check none is missing a tone. Two
      documented exceptions: the ground planes are two-tone, `flame` inverts
- [x] `glowTargets` + `emitters` registries — buildings push via `g.light()` /
      `g.fire()`, never read
- [x] All randomness from `hash(x, y)`, never `Math.random()`, never stored
- [x] Renderer skeleton: `fitCanvas` (`imageSmoothingEnabled = false`,
      `devicePixelRatio` sizing) + `chooseScale` (integer only), `.roma-canvas`
      carrying `image-rendering: pixelated`
- [x] One hardcoded sprite — `js/roma/probe.js`, a calibration pattern rather than a
      building, exercising all five primitives and both authoring modes
- [x] **Crisp on a real phone** — confirmed on the iPhone via
      `test/roma-probe.html`. Integer scaling and the dpr sizing are right
- [x] Fix the interface `draw(ctx, x, groundY, { scale, progress })` — `fromDraw` and
      `fromGrid` both compile to it; `progress` clips to the bottom rows, so the
      teaser and the unlock reveal are the same call *(§3, §5)*
- [x] Painter is bound per canvas (`painter(ctx, scale)`) rather than module-global as
      in the spec — the Home hero and the full-screen view are two canvases *(§7)*
- [x] `test/roma-engine.test.mjs` — 45 tests against a recording stub context

Three deviations from the spec, all commented at their definition:
- `arch` measures its radius at each row's centre (`+ 0.25`). The spec's version gives
  every arch a **one-pixel crown** — a 5-wide opening steps 1-5-5 and reads as a
  keyhole with a spike. Now 3-5-5, and 3-5-7-7 at 7 wide. `arch` carries six buildings,
  so this would have been wrong in a hundred places
- `P` rounds rectangle *edges*, not sizes, so neighbours never leave a hairline gap at
  fractional coordinates — and the flame is drawn at `cx - width / 2`
- Lights are suppressed while `progress < 1`: a half-built temple must not glow through
  its unfinished wall

Two findings for 4b.2, learned from drawing the probe:
- **7 is the minimum width for an arch that reads as curved**, not 5
- An arcade needs solid wall between its openings more than it needs another opening:
  three 7-wide arches need a 29-wide wall, and forcing them into 22 butts them into a
  row of slots

### 4b.2 Stage 1 + the go/no-go *(§3)*
- [x] 2. Stage 1's five sprites in `js/roma/buildings.js` — `casa-romuli`, `ovile`,
      `murus-ligneus`, `ficus-ruminalis`, `ara`, all character grids
- [x] The hills backdrop in `js/roma/render.js` — a far range plus the Palatine,
      Aventine and Capitoline, each under the stage that belongs to it, with
      cypresses on the ridges
- [x] Ground: the plaza, the near street and the Tiber, so **no sprite paints its own
      earth** (tested by colour, not geometry — a palisade's base is legitimately
      full width)
- [x] Fire system with stage 1, not later: `drawFlame` + `smokeField` in engine.js,
      registered by `Ara` through a new `lights` hook on `fromGrid` — a grid can only
      paint, and this is a grid that has to burn *(§4)*
- [x] Slot map for all **25** buildings — `js/roma/catalogue.js`, as data rather than
      on paper, so the test can check it. `(x, band)`, three bands, all 25 laid out
      before the second building was drawn *(§5)*
- [x] Latin name, Dutch meaning and one line of real Dutch history for all 25
- [x] `js/roma/spike-temple.js` — the throwaway temple, to see the engine's ceiling.
      **Delete after the go/no-go**
- [x] Layer split in `render.js`: static layer (sky, hills, ground, finished
      buildings) cached offscreen; per-frame work is fire and smoke only
- [x] `test/roma-city.test.mjs` — 37 tests, mostly on the slot map
- [x] **Stop and look on the phone** — done. **GO**: it reads very well on the
      phone, so the art stays hand-authored and the CC0-tileset fallback is retired.
      The seam that made it a cheap fallback stays anyway — it is also what keeps
      `render.js` from knowing what a building means
- [x] Spike deleted, having done its job. `drawColumn` in it is worth recovering
      from commit `cbfb25d` when `Templum Vestae` is drawn in 4b.4

Two findings that came out of building it:

- **The catalogue was breaking PLAN-ROMA's own eight-lesson rule.** Making the slot
  map data made the gaps checkable, and stage 5's last five steps were 12, 12, 10, 6
  and **16 lessons** apart — the capstone sat a month of work past the one before it,
  at exactly the point she is most invested. Re-spaced evenly in XP here, and then
  **properly, against a measurement, in 4b.3b** — spreading them evenly was itself
  wrong, because XP per lesson is not constant
- **`course()` is for masonry, not for ground.** The checkerboard that made the
  arcade's wall read as blocks turns a 560-pixel plaza into a woven rug. Ground and
  hillsides use a sparse `hash` scatter instead

Still to reconcile before 4b.3: `gamify.js` stages sit at 0 / 400 / 1200 / 2800 /
6000, the catalogue assumes 0 / 200 / 4000 / 14000 / 30000 / 50000. Both are marked
provisional pending step 8, but they have to agree the moment unlocks read real XP.

### 4b.3 Unlock + the moment
- [x] 3. `js/roma/roma.js` — unlock logic against total XP: `unlockedAt`, `nextAt`,
      `stageAt`, `unlockedBy`, `newSince`, `reconcile`, `markSeen`. Pure, like
      `schedule.js` and `cram.js`
- [x] 3. **Total XP wins.** `roma.unlocked` / `stage` reconciled on boot and after
      every award; a cache that disagrees is recomputed and discarded *(§8)*
- [x] 3. Home hero = a 320-wide window on the 560-wide scene, panning to follow the
      work *(§5, §7)*
- [x] 3. Teaser is a **construction site**, not a dim silhouette: `progress` from XP,
      scaffolding with a working platform at the height reached, XP remaining
      underneath *(§5)*
- [x] 3. The XP bar under the city now measures the next **building** rather than the
      next stage — a stage is five buildings wide, so a bar against it barely moves
      per lesson *(PLAN §5)*
- [x] 3. Added `js/roma/*.js` to the service worker's `SHELL`
- [x] 4. The unlock moment on the **Results screen** — pan to the plot, scaffolding
      off, completion reveal via the clip rect, chime, Latin name + Dutch + one line
      of history. Queued, never overlapping *(§7)*
- [x] 4. `seenXp` only advances once the moment has actually played, so a lesson
      finished and closed early still has its buildings waiting
- [x] Two chimes in `sound.js`: `unlocked` for a building, `stageUp` for an era.
      Deliberately not the badge fanfare — lower and slower, a bell not a trumpet
- [x] Hero loop suspended by `visibilitychange` **and** by leaving the Home screen
- [x] `test/roma-unlock.test.mjs` — 33 tests, most of them on "XP wins"

Two shape fixes that fell out:

- **One ladder, one home.** `gamify.js` carried its own stage thresholds
  (0/400/1200/2800/6000) against the catalogue's (0/4000/14000/30000/50000). The
  catalogue wins — a stage begins when its first building appears, which is the only
  definition that keeps the name and the skyline saying the same thing — so `STAGE_XP`
  is derived there and `gamify.js` imports it
- `stage` sat at the top level of the progress blob *and* belonged in `roma`; nothing
  read the outer one. Now only inside `roma`, with `unlocked` and `seenXp`. PLAN §4
  updated to match

One bug worth recording: `render.js` used `BY_ID` after an earlier tidy-up removed its
import. Nothing in the suite reached that code, so it would have thrown on the first
paint in a browser and nowhere else. There are now three tests that exercise
`drawStatic` / `drawScaffold` / `drawBuildings` against a stub context for exactly
that reason.

### 4b.3b The XP table, measured *(prompted by "is 0 to 4000 not a big gap?")*
- [x] Built `test/xp-curve.mjs` — drives the real lesson loop, one 10-minute lesson a
      day, every answer correct, and reports XP per lesson against the catalogue.
      A measuring instrument, not a test; PLAN-ROMA §2 now says to retune by re-running
      it rather than by estimating
- [x] **`Casa Romuli` moved from 200 XP to 20.** A first lesson can only ever pay the
      finish bonus: the acquire ladder is 12m35s against a ten-minute box, so no word
      can graduate inside it. At 200 the first building arrived on day *two* and
      PLAN-ROMA's rule 1 was broken by design rather than by tuning
- [x] All 25 thresholds re-derived from the measured curve at each building's intended
      lesson. Capstone 114 000 on lesson 136 — a school year of steady use
- [x] `lesson` added to every catalogue entry: the design intent, and the field the
      eight-lesson rule is now checked against. The old test divided the XP gap by a
      flat 500 a lesson, which was wrong at both ends — 20 for a first lesson, ~1000
      for a settled one, near nothing against an exhausted word pool
- [x] Verified by simulation: first building lesson 1, longest drought 8–9 lessons
      (was **27**), city complete lesson 110–137 across a 500–700 word pool

Worth knowing: **XP comes from words moving, so the word pool caps the city.** At 40
words the curve flattens near 11 000 XP and 18 of the 25 buildings are permanently
unreachable. Tuned for the 500–700 words she is expected to have this year; if that
turns out much lower, the table needs compressing, not patience.

### 4b.4 Volume
- [x] 5. **Stage 2 (Regnum)** — `forum`, `cloaca-maxima`, `templum-vestae`,
      `pons-sublicius`, `carcer`
- [x] 5. **Stage 3 (Res Publica)** — `curia`, `rostra`, `basilica`, `murus-servii`,
      `via-appia`. Mostly draw functions: republican Rome is arcades and colonnades,
      and a loop beats two thousand hand-placed characters
- [x] 5. Far band: colours pulled toward `hillFar` by a `haze` option on the painter,
      so a distant building is drawn from *exactly* the same code as a near one and
      the band decides how far away it looks. Better than the spec's `mini*`
      silhouettes — no second version of any sprite to keep in step *(§5)*
- [x] 5. The stage-crossing moment: **the hills gain a detail per era** *(§7)* —
      cypresses on the ridges, then a farmstead, then aqueduct arches on the horizon,
      then a temple crowning the hill. Cumulative, so it is a permanent mark of
      having crossed rather than only a card on the Results screen
- [x] `masonry()` takes a course datum, so a tower and the wall it stands in share
      their mortar lines. They did not, and a wall whose courses jog at a tower reads
      as a mistake rather than as two structures
- [x] **A `water` band, at the scene floor.** §5 lumps the Tiber in with the near
      band and the first two river buildings showed why that cannot work: the near
      street stands at 166 and the water starts at 170, so the bridge would have
      spanned dry land and the drain emptied onto the pavement
- [x] `test/roma-stage1.html` replaced by `test/roma-city.html` — an era picker
      rather than a go/no-go, since that question is settled
- [x] 6. **Stage 4 (Imperium)** — `aqua-appia`, `thermae`, `circus-maximus`,
      `theatrum`, `horti`
- [x] 6. **Stage 5 (Roma Aeterna)** — `colosseum`, `pantheon`, `columna-traiani`,
      `arcus-triumphalis`, `templum-iovis`. **All 25 buildings are now drawn**
- [x] `Aqua Appia` is a continuous two-tier arcade with no finished end either side,
      so it reads as a length of aqueduct passing through rather than a monument
      *(§5)*
- [x] `fatColumn` — the three-pixel fluted column recovered from `cbfb25d`, for the
      two hero temple fronts. The two-pixel `column()` stays for colonnades seen at a
      distance
- [x] `pediment()` shared by the Pantheon and `Templum Iovis` — triangle, terracotta
      rakes, gilded rosette
- [x] The finished city is 17 663 rects, 7 fires and 14 lit openings; the static layer
      builds in ~7 ms and is cached per unlock, so per-frame work stays the fires

**The Colosseum is drawn intact, not ruined.** The spec's recipe removes the upper
tiers on the right via `facadeTop(x)`, and it is true that the broken silhouette is
the recognisable one — but the stage is called *Roma Aeterna* and the city is being
built up, so a half-collapsed monument at the top of the growth curve reads as damage.
The ruin machinery was not wasted: generalised into `progress`, it is what draws every
building under construction.

Four faults, all found by rendering to ASCII and looking:

- **The triumphal arch and the Colosseum both had one-pixel piers.** Three arches in
  24 pixels, and six seven-wide arches in 52, leave no mass between the openings — the
  arch read as a colander. The arch is single-bay now (perfectly Roman: so is the Arch
  of Titus) and the Colosseum uses five-wide arches, **knowingly breaking the
  seven-pixel rule from 4b.2**: for that one building the *number* of arches is what
  makes it recognisable and the crown curve is not
- The baths' dome was a whole sphere with nothing under it, so it tapered to a point
  in mid-air between the wings. It needed a drum
- The Circus Maximus inset every course of seating and came out a stepped pyramid —
  a building famous for being long. Only the top three courses draw in now
- `Templum Iovis` had its colonnade at a pitch of seven, which put the axis a pixel
  and a half off centre on the capstone of the whole catalogue. Six at eight spans
  2..46 exactly

Three faults this phase turned up, all found by looking rather than by the suite:

- **`test/roma-stage1.html` had been broken since 4b.3** — it imported the throwaway
  temple that phase deleted, so the only way to see the city was a blank screen. Two
  commits. There is now a test that every module the viewer pages import exists
- The temple of Vesta had **seven columns at a pitch of three**, which ran off the
  right of its own drum and left two bare pixels on the left. Six at four spans
  twenty-two exactly. Also: draw the colonnade *last*, so the cella door reads as
  being behind it — a tholos is peripheral, and painting the door last put a flat
  black slot in front of the columns
- The Curia's bronze doors were banded every second row, which turned the one thing
  anybody remembers about the building into a humbug stripe

### 4b.5 Life, light and tuning
- [x] 7. Life — `drawWater` (sliding highlights + swaying reflections), `drawBoat`,
      `drawCitizens`, `drawBirds`, plus the smoke from 4b.2, all in the suspendable
      loop
- [x] 7. Citizen count tracks words `learned`, capped at 12 — a free second reading
      of progress. Positions from `hash`, so learning a word never shuffles the
      street *(§4)*
- [x] 7. Day/night from the **real clock**, and seasonal: `isNight()` approximates
      Brussels sunrise/sunset, because a fixed 19:00 cutoff would leave the city
      sunlit on a black December afternoon *(§6)*
- [x] 7. `drawCelestial` — sun and clouds by day, moon and stars by night,
      **in the background layer** between the sky and the hills so the buildings
      occlude them. Tint `rgba(12,16,44,0.45)` and the moon is never drawn in the
      night pass *(§6)*
- [x] 7. `nightPass` runs per frame over the blit rather than into the cache, so the
      blooms pulse; the animated order is scenery → tint → blooms → fire → smoke,
      so a flame never gets dimmed by the night it is lighting
- [x] Measured: static layer 17 700 rects (~8 ms, once per unlock), animated frame
      200 by day and 290 by night. A ratio of about 1:70 — the cache's whole point
- [x] Day/night and a crowd slider added to `test/roma-city.html`; the app itself
      still offers no switch, because a toggle on the hero would undo the point

Two faults reported from the phone after 4b.5, both real:

- **"Blue rectangles between the hills."** The sky showing through a hole in the
  ground: the far range stopped two rows below the far band's ground line, so between
  the named hills there was bare sky from row 128 down to the plaza at 150. The
  backdrop is one continuous landmass to the street now, and a test asserts every
  column below the skyline is solid
- **"Buildings on the first hill stand a bit odd."** Two causes. The details picked
  their hill with `era % 3`, which marched the aqueduct across the Palatine directly
  above Romulus's huts and crowned the Aventine with the temple that belongs to the
  Capitoline; and two of them *floated* — the arcade by two rows, the temple by one,
  which at this scale is the difference between a building on a hill and a building
  above one. Each era names its hill now, and everything sits on the ridge

Re-sited while fixing it: the republic's farmstead moved from the Aventine to the
Capitoline's slope. The Aventine is the better history — the plebeian hill, half
countryside — but the real aqueduct lands across that crown in stage 4 and the baths
across its flank in stage 5, so the farm was buried twice over. The Palatine and the
Capitoline are the only two crowns that stay clear to the end. There is a test that a
detail added by an era is still visible when the city is finished, because a permanent
mark that quietly vanishes is worse than none.

And Roma Aeterna crowns the **Palatine with the imperial palace** rather than putting a
second temple silhouette above `Templum Iovis`. Which is where the word palace comes
from, and it is the right note to end on: the emperors built over the hill Romulus's
hut still stands on, and at that stage both are on screen together.

### 4b.5b Olive groves *(asked for after looking at the city)*
- [x] `drawOlive` in engine.js — low, broad, silvery, on a squat kinked trunk. **Ten
      wide by eight tall** against a cypress's three by nine-to-twelve; the first draft
      was as tall as a cypress, which lost the whole contrast the second tree is for
- [x] `olive` added to the palette as a three-tone material plus a trunk colour — the
      second documented addition to the spec's list, after the scaffolding
- [x] `OLIVES` — fourteen fixed slots, **two more per era**, so the city greens up as
      it grows. Ten along the near street, four as groves on the hill slopes (hazed
      with the backdrop). Fixed rather than scattered at runtime, for the reason §5
      gives for the buildings
- [x] A tree once planted is never moved or felled — tested
- [x] No olive stands inside a building, **checked against every band**. The first
      pass used the near band's free gaps alone and put a tree's roots through the
      deck of `Pons Sublicius`, which stands in the water band but rises two rows
      above the near street

**Stars do not twinkle, and that is a decision.** Anything behind the buildings has to
live in the cached static layer, so a twinkle would mean either drawing stars *over*
the city — the exact night-order bug §6 warns about — or keeping a second cache for a
flicker. The constellations are placed from `hash`, so they are at least the same
every night.
- [ ] 8. Re-check the XP table against a few weeks of **her** real lesson data —
      by re-running `node test/xp-curve.mjs` with numbers matching what her lessons
      actually produce, not by estimating again *(§2)*

### 4b.6 The full-screen view — zoom and tap *(§7)*

Never a checkbox before this, only prose in §7, which is how it stayed invisible for
four phases. Zoom and tap are **one** feature: at the hero's scale a building is a
12–26 pixel target, well under the ~44 px a finger needs, so inspecting one only works
somewhere it has been zoomed.

- [x] The Home hero is a button and opening this is all it does; drag to pan across
      the whole 560-wide scene
- [x] **Zoom snaps to whole numbers** — ×1 to ×4. A pinch scales the canvas element
      with a CSS transform while the fingers are down, which is cheap and stays crisp
      because it stretches an already-rendered bitmap, then snaps on release and
      re-caches once *(§8)*
- [x] `createScene` gains `setScale(n)`, and two sizing modes rather than one:
      **fixed view** (the hero — the window is a set number of logical pixels and the
      element picks the scale) and **fixed element** (this view — zooming changes the
      scale and the window narrows). `setScale` is inert in the first, which is tested
- [x] Zooming keeps whatever was in the middle of the window in the middle of it,
      rather than throwing her back to the left edge of the city
- [x] Tap a building → Latin name, Dutch meaning, one line of history. The catalogue
      already carried all three and the unlock card already rendered exactly that trio
- [x] `hitTest(x, y, ids)` — a rectangle test against the slot, resolved **front-most
      first** by walking `inDrawOrder()` backwards. Limited to what she has unlocked,
      so a building she has not earned never answers a tap
- [x] The box is the slot, not the pixels — a per-pixel test would be more precise and
      worse, since the fig tree and Trajan's column are a few pixels wide and a tap
      that has to land on the trunk is a tap that misses
- [x] `toScene()` turns a canvas tap into a scene point through the scale and the pan
- [x] Wheel and trackpad zoom too, for looking at it on a laptop
- [x] Escape closes it; the hero's loop stops while it is up, because two canvases
      animating the same city is twice the battery for one thing to look at
- [x] Nothing tappable on the hero itself beyond opening this

### 4b.7 Invariants
- [x] Layer cache: sky, celestials, hills, ground and finished buildings offscreen,
      invalidated on unlock; per-frame redraw is water, boat, citizens, birds, the
      night tint and the fires. Measured at **1:70** *(§8 — required at 560×180, not
      an optimisation)*
- [x] Loop suspended three ways: `visibilitychange`, leaving the Home screen, **and an
      `IntersectionObserver`** — Home scrolls, so the city can be off the top while
      she reads the word track below, and neither of the other two catches that
- [x] The full-screen view stops the hero's loop while it is up: two canvases
      animating the same city is twice the battery for one thing to look at
- [x] `prefers-reduced-motion` → one static frame, no flame flicker, no smoke, no bob;
      the unlock reveal shows the finished building instead of animating
- [x] Module seam holds, and it is **tested** rather than trusted — the import graph
      is checked, since the seam is only ever one careless import away from being
      untrue *(§8)*
- [x] `roma.unlocked` / `stage` treated as caches: if they disagree with `xp`, **`xp`
      wins**. Reconciled on boot and after every award, tested in both directions
- [x] `roma.seenXp` powers "what is new since she last looked?", and only advances once
      the unlock moment has actually played
- [x] Nothing about the art is persisted — `progress`, the citizen count, the era's
      hill details, the groves and the time of day are all derived at render time

---

## Phase 4c — the coach — **PARKED, not scheduled**

> **Decided: not being built for now.** Nothing here is abandoned or wrong — the
> design is finished, the art risk is already retired by a working demo, and the whole
> section is kept ready to pick up. It is parked because the app is finished except
> for shipping it, and both remaining reward features are guesses about what motivates
> *her* until she has actually used it.
>
> **The test that decides it**, from her first real lessons: **does she read the
> reveal, or tap straight through it?** Reading it → the coach lands in a beat she is
> already dwelling in and costs nothing; build it. Tapping through → it is pure
> friction; leave it parked for good and let the city carry the reward.
>
> If it is picked up: it needs 4.1 + 4b.1 only — no catalogue, no composition — so it
> slots in before 4b.4–4b.6. Building it also forces `engine.js` and `palette.js` into
> existence, which is 4b.1 anyway, so it is not a detour from the city.
>
> Known weakness to fix *if* it is built: 21 messages at ~15 appearances a lesson is
> the whole repertoire seen inside two lessons. `messages.js` is data, so more mottos
> is the cheap mitigation — and the one task here that can be done any time, with no
> engine and no decision. See [PLAN-ROMA.md](PLAN-ROMA.md) §9.

Spec: [plan-roma-updates.md](plan-roma-updates.md) §14 · demo:
[roman-coach.html](roman-coach.html).

### 4c.1 The bust
- [ ] 1. `js/coach/characters.js` — `servus` only, from the shared `engine.js` `P`
      and `bloom`, on a 64-grid canvas. Prove it reads at phone size first
- [ ] Coach imports `palette.js` — **merge the demo's `K` palette into it**, don't
      ship two near-identical palettes *(§4)*
- [ ] `bloom()` reconciled to one signature in `engine.js` (demo's differs)
- [ ] `lang="nl-BE"` on the document (hyphenation now, voice selection later)

### 4c.2 Messages — the point at which it earns its keep
- [ ] 2. `js/coach/messages.js` as **data, not code**: `MSG.good` / `.improve` /
      `.perfect` + `UNLOCK`, Dutch line + optional Latin motto + Dutch translation
- [ ] Mood mapping: clean recall → `perfect`; correct with hint/retry → `good`;
      **almost or wrong → `improve`** (the reveal carries the correction, the coach
      carries the encouragement) *(§9)*
- [ ] **Skip any motto sharing a word with the current card** — answer-leak guard

### 4c.3 Placement and timing — where this feature fails
- [ ] 3. Renders **beside the reveal**, concurrent with it, adding no time of its own
- [ ] 3. **Never in the anticipation gap** — that stays silent and empty *(PLAN §2.3)*
- [ ] 3. `waitMs` is a **cap of ~1200 ms, not a wait**; any tap advances immediately;
      `onComplete` callable early and never the only way forward
- [ ] 3. **Not on every answer** — always on `perfect`, drop-back and rank-up,
      otherwise ~1 in 4. Sixty appearances a lesson is wallpaper
- [ ] 3. **Run a real lesson and time it** before adding characters: 60 answers × 5 s
      of the demo's default would be five minutes of a ten-minute lesson

### 4c.4 The cast
- [ ] 4. The remaining five busts: gladiator, centurion, magister, senator, emperor
- [ ] 4. Rank = **the city's stage**, not the spec's own XP ladder: Servus (0) →
      Gladiator (200) → Centurio (4 000) → Magister (14 000) → Senator (30 000) →
      Imperator (52 000). The spec's 120/350/750/1600/3200 would all be passed in
      two weeks *(§9)*
- [ ] 4. **One coach per lesson, not per answer** — roll `charForXp()` once at lesson
      start; growing pool (earned ranks stay eligible, higher favoured) applies to
      that draw
- [ ] 5. Victory flourish on `perfect` — both arms up, gold confetti

### 4c.5 Rank-up
- [ ] 5. `setXp(xp)` **once at lesson start** (silent); never pass `xp` to `present()`
      mid-lesson, so no threshold detection and no mid-lesson fanfare *(§9)*
- [ ] 5. Rank-up celebrated **on the Results screen**, together with the stage
      crossing and building unlock — one event, not three
- [ ] `lastTier` persisted so each threshold fires exactly once

### 4c.6 Invariants
- [ ] `Math.random()` is **correct** in the coach (variety) and **banned** in the city
      art (determinism) — don't "fix" either to match the other *(§4)*
- [ ] `prefers-reduced-motion` → static sprite, wait bar still counts; **no
      `setTimeout` render loop** — render once, animate the bar in CSS *(§8)*
- [ ] Text, not speech, for v1 — `speechSynthesis` is a Later item and the coach must
      be fully useful silent

---

## Later, if wanted

- [ ] "Test in 3 days, you are 12 words behind" push notification (installed PWA,
      permission from a tap, silent fallback if denied, never a nag screen)
- [ ] Spoken prompts via `speechSynthesis` for modern languages
- [ ] Silent warm-up utterance on the Start-lesson tap (iOS speech unlock)
- [ ] Grading grammar forms as a harder mode
- [ ] A second language list (French / English) to prove the generic model
- [ ] Roma extras: choice at some unlocks, nameplate mode, export the city as a PNG
      (`toBlob()` on the full scene), manual day/night toggle in the full-screen view
      only *(tap-a-building was here and is now Phase 4b.6 — it was asked for)*
- [ ] Coach extras *(only if the parked Phase 4c is ever picked up)*: read the motto
      aloud in `nl-BE` **on the reveal only**; a paste-in box so she can add her own
      mottos; bake the busts with `toDataURL()` if six characters ever cost more per
      frame than they are worth *(measure first)*
- [ ] ~~Ruin mode for a neglected city~~ — **rejected** on purpose: nothing is ever
      taken away (PLAN-ROMA §11)

---

## Open questions to close

- [x] Dutch confirmed as the native language — and as the app's own language
- [ ] Are grammar forms examined? (assumed display-only for v1)
- [ ] Tune "3 clean recalls on 3 days" against a real mark once one exists
- [x] Word list format — settled: `term | form | translation` text, one word per line
- [x] Latin pronunciation — no longer a blocker (audio off the critical path)
- [x] iOS 16.4+ — settled; web push and Screen Wake Lock both available
