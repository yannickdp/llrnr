# llrnr — build checklist

Task breakdown of [PLAN.md](PLAN.md) and [PLAN-ROMA.md](PLAN-ROMA.md), in build order.
Mark `[x]` as things land. Section references point at the plan text that defines
"done" for each item.

Phases are ordered but not strictly gated: Phase 3 is the differentiator and must not
slip behind Phase 4.

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
- [ ] Phases `new → acquire → retain → learned` with transitions (PLAN §2)
- [ ] Acquire micro-ladder: 5s / 25s / 2m / 10m
- [ ] Correct → next micro-step; wrong → back to micro-step 1
- [ ] Clearing the 10m step graduates to retain, box 1, due tomorrow
- [ ] Retain boxes: 1d / 3d / 7d / 21d / 60d → `learned`
- [ ] Correct → up a box; almost → same box, due tomorrow
- [ ] Wrong in retain → back to acquire micro-step 1 **in the current session**
- [ ] All scheduling on absolute `dueAt` ISO timestamps vs `Date.now()` — never `setTimeout`
- [ ] Pure module, injectable clock, readable on one screen
- [ ] Throwaway fake-clock script: prove 5s / 25s / 2m / 10m / tomorrow

### 1.4 `lesson.js` — the loop
- [ ] Priority queue on `dueAt`, most overdue first
- [ ] Time-boxed lesson, default 10 min (5/10/15)
- [ ] Presentation card for brand-new words (see it, form, tap on)
- [ ] New-word presentations spread through the lesson, not front-loaded
- [ ] Multiple choice on a presentation card's first check only, never again
- [ ] Prompt → anticipation gap (countdown ring, default 4s) → type → reveal
- [ ] Reveal shows correct answer, all accepted alternatives, grammar form
- [ ] Micro-ladder repeats win on priority; interleave retain reviews into the gaps
- [ ] ~8–10 new words per session in practice
- [ ] X button with confirm; no back button mid-lesson
- [ ] Results screen: graduated, boxes climbed, drop-backs
- [ ] In-memory progress only at this stage

### 1.5 Ship it
- [ ] `manifest.webmanifest` — name, icon, full-screen display
- [ ] `icons/icon-180.png` (apple-touch-icon), `icon-192.png`, `icon-512.png`
- [ ] Push to GitHub Pages over HTTPS
- [ ] **Install on her iPhone from Safari and run one real lesson**

---

## Phase 2 — it teaches properly

### 2.1 `store.js`
- [ ] `llrnr.progress.v1` single blob, shape per PLAN §4, `version: 1` from day one
- [ ] Load / save on every change; migrate hook in place
- [ ] Cards keyed by content hash, `term` stored alongside for readability
- [ ] `lists[]` per card — union of chapters, keeps the card when a chapter leaves the pool
- [ ] `settings` persisted (lessonMinutes, newPerLesson, anticipationSeconds, sound, lastDirection)

### 2.2 `answer.js`
- [ ] Case-insensitive, accent-stripped, whitespace-trimmed matching
- [ ] Any `/`-separated alternative accepted
- [ ] Levenshtein distance 1 → **almost**, with "nearly! it is *mater*"
- [ ] Clean recall = correct first attempt, no hint, no almost
- [ ] Reverse mode: accept any word in the pool sharing that translation, credit the
      card that was asked

### 2.3 Direction
- [ ] Three-way picker on Start lesson: Latin→Dutch / Dutch→Latin / Both
- [ ] Pre-select `lastDirection`; remember the choice
- [ ] Per-direction `dirOk.{fwd,rev}` and `cleanDays.{fwd,rev}` (cap at max `targetRecalls`)
- [ ] Both mode picks the weaker-record direction, alternating on a tie
- [ ] Boxes climb on whatever direction was tested — no stalling at box 2, ever
- [ ] `learned` gated on a clean recall **both** ways; otherwise park at box 5
- [ ] **one-way** marker on parked cards, and they keep returning occasionally
- [ ] Only the headword is typed in reverse (`mater`, not `mater, matris, f.`)
- [ ] Small marker in-lesson showing which way round the question is

### 2.4 Backlog protection
- [ ] Cap review load at ~40 items per lesson
- [ ] Order candidates lowest box first, then most overdue
- [ ] Never render a wall of hundreds of due cards

---

## Phase 3 — it is useful for school *(the differentiator — do not defer)*

### 3.1 `cram.js`
- [ ] Test objects: `id`, `title`, `date`, `lists[]`, `targetRecalls`, `directions`
- [ ] Test-ready = 3 clean recalls on 3 separate days, **in each direction**
- [ ] Pool narrows to chapters in scope; other chapters stop introducing new words
      but still serve genuinely overdue reviews if there is room
- [ ] Interval compression: `clamp(floor(daysLeft / recallsStillNeeded), 1d, normal)`
- [ ] Weakest-first ordering: fewest clean recalls, then most overdue, per direction
- [ ] After the test date, words return to normal retain intervals from their box
- [ ] Pure module, fake-clock tested, separate from the lesson loop

### 3.2 Readiness panel
- [ ] "N of M words test-ready both ways"
- [ ] "K words solid Latin→Dutch, not yet the other way round" (the key diagnostic)
- [ ] Shaky count and not-started count
- [ ] Minutes-a-day estimate from **remaining clean recalls across both directions**
- [ ] [ Practise Dutch → Latin ] button starting a lesson in exactly that direction
- [ ] Panel pushes above the city on Home while a test is in its run-up
- [ ] Results screen leads with the readiness change ("+4 test-ready today")

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
- [ ] One-way count per chapter with its fix-it button

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

- [ ] 1. Renderer skeleton — one hardcoded sprite, canvas, integer scaling, crisp on a
      real phone
- [ ] 2. Stage 1's five sprites + hills backdrop — **stop and look**: go/no-go on
      hand-authored art vs a CC0 tileset
- [ ] 3. Unlock logic against total XP, Home-screen hero placement, dim silhouette
      teaser with XP remaining
- [ ] 4. The unlock moment — pan, draw-in, chime, name card *(stopping point: still
      worth having)*
- [ ] 5. Stages 2 and 3 (ten buildings) + the stage-crossing moment
- [ ] 6. Stages 4 and 5 (nine buildings), ending at `Templum Iovis`
- [ ] 7. Life — citizens, smoke, a boat, birds, in a suspendable loop
- [ ] 8. Retune the XP table against a week of real lesson data
- [ ] `roma.unlocked` / `stage` treated as caches: if they disagree with `xp`, **`xp` wins**
- [ ] `roma.seenXp` powers "what is new since she last looked?"

---

## Later, if wanted

- [ ] "Test in 3 days, you are 12 words behind" push notification (installed PWA,
      permission from a tap, silent fallback if denied, never a nag screen)
- [ ] Spoken prompts via `speechSynthesis` for modern languages
- [ ] Silent warm-up utterance on the Start-lesson tap (iOS speech unlock)
- [ ] Grading grammar forms as a harder mode
- [ ] A second language list (French / English) to prove the generic model
- [ ] Roma extras: choice at some unlocks, tap-a-building history, nameplate mode,
      export the city as a PNG

---

## Open questions to close

- [ ] Confirm Dutch as the native language for translations
- [ ] Are grammar forms examined? (assumed display-only for v1)
- [ ] Tune "3 clean recalls on 3 days" against a real mark once one exists
- [x] Word list format — settled: `term | form | translation` text, one word per line
- [x] Latin pronunciation — no longer a blocker (audio off the critical path)
- [x] iOS 16.4+ — settled; web push and Screen Wake Lock both available
