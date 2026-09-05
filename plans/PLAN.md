# llrnr — Language Word Trainer (Latin & friends)

A small, gamified vocabulary trainer for one user (my daughter). No App Store, no
developer account, no Mac required.

The scheduler is a **hybrid**: Pimsleur-style micro-intervals to *acquire* a word
inside a single session, simple day-level boxes to *retain* it between sessions, and
a **test-date mode** that compresses everything in scope so she is ready by Friday.
That last part is the reason for the hybrid — every classic algorithm (Pimsleur,
SM-2, FSRS) optimises for "remember forever with least effort", and a schoolkid needs
"be solid on chapters 4–5 by the eleventh".

---

## 1. Technical approach: a PWA ("Add to Home Screen")

**Decision: build a Progressive Web App with plain HTML + CSS + JavaScript.**

On iPhone, Safari can install any website to the home screen. It then gets its own
icon, launches full-screen with no browser chrome, and works offline. For a
single-user vocabulary app this is indistinguishable from a native app — and it
skips every hard part of iOS development.

### Why not the alternatives

| Approach | Blocker |
|---|---|
| Native Swift / SwiftUI | Needs a Mac + Xcode. Free Apple ID signing expires every **7 days** — the app dies weekly until you re-plug the phone. |
| React Native / Expo Go | Needs Node tooling, an Expo account, and the dev build also expires. Extra moving parts for zero benefit here. |
| Flutter | Same signing problem, plus a whole SDK to install. |
| Capacitor / Cordova wrapper | Still requires Xcode signing — it just wraps the PWA we would build anyway. |
| **PWA** | **None.** Any editor, any OS, install in 10 seconds, no expiry, updates instantly. |

### Stack (deliberately minimal — no build step)

- **Vanilla JS, ES modules** — no React, no bundler, no `npm install`. Edit a file,
  reload, done.
- **CSS** hand-written, mobile-first, using CSS variables for theming.
- **`localStorage`** for all progress. Single user, a few hundred words, a few KB.
- **`manifest.webmanifest`** — makes it installable, sets icon + full-screen mode.
- **`service-worker.js`** — caches all files so it works in the car, on the train,
  at school with no wifi.
- **Word lists as plain pipe-separated text** (section 4) — add a new chapter without
  touching code, or paste one in from the phone.

### The app speaks Dutch

**Every user-visible string is in Dutch.** She is a Flemish schoolkid being examined
in Dutch; an app that talks to her in English adds a second language to a tool whose
whole job is teaching a first. This covers all of it — screens, buttons, badge names,
the readiness panel, error messages, and the parser's rejected-line reasons, which she
reads whenever she pastes in a new chapter.

Three things stay as they are:

- **Code stays English.** Identifiers, screen names, card fields, git history,
  comments and these plans. The convention is the ordinary one: English in the source,
  Dutch on the screen.
- **Latin stays Latin.** The stage names (*Roma Quadrata* … *Roma Aeterna*) and the
  building names in [PLAN-ROMA.md](PLAN-ROMA.md) are vocabulary, not chrome. Each is
  glossed in Dutch where it appears.
- **The lesson content is whatever the word list says**, which is the point of the
  generic `term | form | translation` format.

Dutch is also the *interface* language rather than a locale setting: there is one
user, so there is no language picker and no string table indirection. Dutch text sits
directly in the markup and the modules that render it. Where a pure module has to
report something to her — the parser's rejects and warnings — it carries a stable
English `code` alongside the Dutch message, so the wording can change without breaking
the tests that assert on it.

Dates and numbers use `nl-BE`, which also settles the small things: `05/09/2026`
rather than `9/5/2026`, a comma as the decimal separator, and Monday as the first day
of the practice heatmap.

### Hosting

Two options, both free:

1. **GitHub Pages** (recommended) — push the folder, get an `https://` URL. HTTPS is
   *required* for service workers and installability. Updating = one `git push`.
2. **Local dev**: `npx serve` (or `python -m http.server`) on the laptop, open the
   LAN IP from the iPhone. Fine for testing, but the service worker needs HTTPS or
   `localhost`, so ship via option 1.

### iOS caveats to design around

- **Notifications are available** — the phone is iOS 16.4+ — but *only* once the app
  is installed to the home screen, and only after she grants permission from a tap.
  So they are a real option rather than a v1 dependency: the app has to be useful
  when she opens it herself, and a "test in 3 days" nudge is a bonus on top. Silent
  fallback if permission is denied, never a nag screen.
- Safari can evict `localStorage` after ~7 days of *no use* for non-installed sites.
  Installed PWAs are safe — so: **install it properly, and add JSON export/import**
  as a backup escape hatch.
- Timers in a backgrounded Safari tab are throttled or frozen. Never trust
  `setTimeout` to measure an interval — always store an absolute `dueAt` timestamp
  and compare against `Date.now()` on wake.
- Set `viewport-fit=cover` and `env(safe-area-inset-*)` padding so nothing hides
  behind the notch or home bar.
- Disable double-tap zoom and text selection on buttons — it feels non-native fast.
- `100vh` is wrong on iOS Safari; use `100dvh`.
- If spoken prompts get added later (section 7, Phase 4): iOS will not speak until
  the user has tapped something, so fire a silent warm-up utterance on the
  "Start lesson" tap.

---

## 2. Learning model

Every word is in one of four phases: **new → acquire → retain → learned**.

### 2.1 Acquire — the in-session micro-ladder

This is the part worth keeping from Pimsleur. A word she has just met is re-tested
at expanding intervals measured in *seconds*, all inside one session:

| Micro-step | Interval |
|---|---|
| 1 | 5 seconds |
| 2 | 25 seconds |
| 3 | 2 minutes |
| 4 | 10 minutes |

- A brand-new word first gets a **presentation card**: see it, read its grammar
  form, tap to continue. New material is introduced, not tested.
- Then it must be recalled correctly at each micro-step in turn.
- **Correct** → next micro-step. **Wrong** → back to micro-step 1. This is cheap;
  it all happens within a few minutes and carries no lasting penalty.
- Clearing the 10-minute step **graduates** the word into retain, due tomorrow.

Most SRS apps underuse this. Anki bolted on "learning steps" of 1m/10m for exactly
this reason — a word needs a few successful retrievals close together before
day-scale spacing does anything useful.

### 2.2 Retain — the between-session boxes

| Box | Next review |
|---|---|
| 1 | 1 day |
| 2 | 3 days |
| 3 | 7 days |
| 4 | 21 days |
| 5 | 60 days → then marked **learned** |

- **Correct** → up one box.
- **Almost** (typo, close enough) → stay in the same box, due tomorrow.
- **Wrong** → the word drops back into **acquire**, at micro-step 1, *in the current
  session*. It gets properly re-learned in the next few minutes rather than merely
  being scheduled for tomorrow. On graduating it re-enters retain at box 1.

That last rule is the main thing the two-phase design buys: a forgotten word is
repaired on the spot instead of limping back once a day.

### 2.3 Anticipation

Retrieval must happen *before* the answer is visible — recognising a right answer in
a list is a different mental act from producing one, and only the second builds
recall. So every question is:

1. **Prompt** — the word appears, alone.
2. **Anticipation gap** — a countdown ring, default 4 seconds (adjustable). The
   answer is nowhere on screen. This silence is the exercise, not dead time.
3. **She types the answer.**
4. **Reveal** — the correct answer, all its accepted alternatives, and the grammar
   form.

Consequences:

- **Typed recall is the default.** It is real retrieval, it is objective (no
  self-grading, which children get wrong in both directions), and it trains the
  spelling she is actually marked on. Matching is forgiving: case-insensitive,
  accents stripped, whitespace trimmed, any `/`-separated alternative accepted, and
  a Levenshtein distance of 1 counts as **almost** ("bijna! het is *mater*").
- **Multiple choice appears only on a presentation card's first check**, as a gentle
  first contact. It never appears again for that word.

### 2.4 Direction

**She is examined in both directions, so knowing a word means knowing it both ways.**
That is the definition the app holds itself to: mastery and test-readiness always
require Latin→Dutch *and* Dutch→Latin.

On top of that, every lesson starts with a three-way choice — a practice tool for
drilling one side, not a change to what counts as learned. The last choice is
remembered as the default.

| Mode (as labelled) | Prompt → answer | When to pick it |
|---|---|---|
| **Latijn → Nederlands** | `mater` → *moeder* | Comprehension. The easier way round. |
| **Nederlands → Latijn** | `moeder` → *mater* | Production and spelling. The hard one, and where marks are lost. |
| **Beide** | mixed per word | The default, and what the exam looks like. |

In **Both** mode the direction is not random: for each word the engine picks the
direction with the *weaker* record, alternating on a tie. So "Both" quietly spends
more time on whichever way round she is worse at — almost always Dutch→Latin.

Only the headword is ever typed in reverse — `mater`, not `mater, matris, f.` — which
is exactly why the grammar form is its own field in the list format.

#### The picker must not be able to create a dead end

An earlier draft blocked a word from leaving box 2 until it had been answered
correctly both ways. That was safe when direction was fixed, but with a picker it
becomes a trap: a run of Latin→Dutch lessons would leave every word stuck at box 2
with no visible cause. So the requirement moves to the top of the ladder instead of
the middle:

- **Boxes climb on whatever direction was actually tested.** No stalling, ever.
- **A word becomes `learned` only when both directions have a clean recall.**
  Otherwise it parks at box 5 with a visible **one-way** marker and keeps coming
  back occasionally.
- The Words screen shows the one-way count with a button that starts a lesson in
  exactly the missing direction. The requirement stays, but as a suggestion with the
  fix attached rather than an invisible wall.

#### Per-direction evidence, shared scheduling

Each word keeps **one** box and **one** `dueAt` — not two cards. Splitting every word
into a forward and a reverse card (the Anki approach) turns a 40-word chapter into 80
reviews, too much for a ten-minute lesson. The scheduling clock is shared; only the
*evidence* is per direction, so `dirOk` and `cleanDays` each have a `fwd` and a `rev`
side.

#### One honest wrinkle in reverse mode

Several Latin words can share a Dutch translation — prompt *zeggen* and there is more
than one right answer. In reverse mode, accept **any** word in the current pool with
that translation and credit the card that was asked. Anything stricter marks a correct
answer wrong, which is the fastest way to make her stop trusting the app. The import
preview flags translations that map to several terms so the collisions are at least
known about.

### 2.5 Session shape

A lesson is **time-boxed**, not count-boxed: default 10 minutes (adjustable 5/10/15).
The engine is a priority queue on `dueAt`, always serving the most overdue item.

The two phases interleave neatly, which is the practical reason this design works:
the 2-minute and 10-minute gaps in one word's micro-ladder are filled with quick
retain reviews of other words. Almost no dead time, so throughput is far better than
pure Pimsleur's — around **8–10 new words per session** rather than five, which is
what a 40-word school chapter needs.

Order of business within a lesson:

1. Overdue retain reviews (cheap, a few seconds each).
2. New-word presentations, spread through the lesson rather than front-loaded.
3. Micro-ladder repeats as they come due, which always win on priority.

**Backlog protection.** After a two-week holiday, hundreds of words will be overdue.
Cap the review load (~40 items per lesson) and order candidates by *lowest box first,
then most overdue* — rescue the shaky words before polishing the solid ones. Never
show a wall of 300 due cards; it is the fastest way to make her quit.

### 2.6 Test-date mode

The feature no off-the-shelf algorithm provides, and the one that matters most for
schoolwork. She (or I) creates a test: **a date, and which chapters are in scope.**

**Definition of "test-ready":** a word needs **3 clean recalls on 3 separate days,
in each direction** — because the exam asks both ways, and a word she can only
recognise is not a word she can write. A *clean recall* is correct on the first
attempt, no hint, no "almost". Anything less does not count; this number has to mean
something or the readiness display is worthless.

Requiring both directions roughly doubles the work behind every "test-ready", so the
minutes-a-day estimate must be computed from *remaining clean recalls across both
directions*, not from word count. An estimate that quietly assumes one direction
would tell her she is fine three days before she is.

While a test is active and within its run-up:

- **The pool narrows** to the chapters in scope. Other chapters stop introducing new
  words, though their genuinely overdue reviews still get served if there is room.
- **Intervals are compressed** so that no interval reaches past the test date:
  `interval = clamp(floor(daysLeft / recallsStillNeeded), 1 day, normal interval)`.
  With the test tomorrow, everything collapses to within-session spacing.
- **Ordering is weakest-first**: fewest clean recalls, then most overdue — counted
  per direction, so the weaker side of a word is what gets asked.
- **Breadth beats depth when time is short.** If the work required exceeds the time
  available, get *every* word in scope to one clean recall in *each* direction before
  pushing *any* word to three. On a vocab test, partial credit across forty words
  beats mastery of twenty. The app should say this out loud rather than silently
  reordering.

**The readiness panel is the whole point:**

> **Latijn — hoofdstuk 4–5** · toets over 3 dagen
> **24 van de 40 woorden klaar in beide richtingen**
> 11 woorden zitten goed van Latijn naar Nederlands, nog niet omgekeerd
> 5 woorden zijn nog wankel · 0 nog niet begonnen
> ≈ 14 minuten per dag om op tijd klaar te zijn
>
> [ Nederlands → Latijn oefenen ]

The middle line is the most useful diagnostic in the whole app: it names the exact
gap that loses marks, because recognition always runs ahead of production. The button
under it starts a lesson in precisely that direction.

The last line — an honest estimate of whether she is on track, and what it costs to
get there — is more motivating than any badge, and it is the thing a parent actually
wants to see.

After the test date passes, the words in scope return to normal retain intervals from
whatever box they reached. Nothing is lost.

---

## 3. Gamification

Kept honest — it should reward *doing the work*, not grinding.

**The XP reward is a growing pixel-art Rome** — see
**[PLAN-ROMA.md](PLAN-ROMA.md)** for the full design. XP unlocks buildings in
historical order, from Romulus's hut to the Colosseum, each named in Latin with its
Dutch meaning, so the reward screen teaches the subject it is rewarding. The city
lives at the top of the Home screen and is the app's single canonical picture of
progress.

- **XP is awarded for lasting progress, never per answer.** With micro-ladder
  repeats a word can be answered correctly four times in ten minutes, so paying per
  answer would make 5-second churn the optimal way to farm XP. Instead:
  **25 XP** for graduating a word out of acquire, **15 XP** for each box promotion,
  **50 XP** for reaching *learned*, and a small flat bonus for finishing a lesson.
- **First lesson of the day is worth double.**
- **There are no abstract levels — there are stages, named in Latin.** "Level 4"
  becomes **Imperium**, the growth stage the city has reached. A level number and a
  visible city are two abstractions doing one job; the city wins, and the stage names
  are themselves vocabulary. Stages: *Roma Quadrata → Regnum → Res Publica →
  Imperium → Roma Aeterna*.
- **Streak**: consecutive days with at least one finished lesson. One "freeze" per
  week so a single busy day does not wipe a 30-day streak — this matters a lot for
  morale.
- **Daily goal**: one lesson a day; a ring fills on the home screen.
- **During exam week the readiness ring replaces the daily ring** as the headline
  number. Progress toward Friday is more motivating than an abstract streak when
  Friday is the thing she cares about.
- **Lesson results screen**: words graduated, boxes climbed, XP, badge popups, and
  the list of words that dropped back.
- **Badges**: first word learned, ten words learned, a chapter fully learned, 7-day
  streak, 30-day streak, a lesson with no drop-backs, 100 typed answers, and
  **test-ready with a day to spare** — the badge that rewards not cramming.
- **Progress is shown as position, not percentage.** Each word is a dot on the
  new → acquire → box 1–5 → learned track, so she can see exactly what moved today.
- **The next reward is always visible.** The building she is working toward is drawn
  as a dim silhouette in its empty plot with the XP remaining under it. A reward she
  can see just out of reach motivates far more than a surprise.
- **No punishment**: never lose XP. A wrong answer costs box position, and that is
  re-earnable in the same session by design.

---

## 4. Data model

### Word list format — `data/latin-chapter-01.txt`

Plain UTF-8 text, one word per line, three pipe-separated fields:

```
# Chapter 1 — Familia
pater  | patris, m.       | vader
mater  | matris, f.       | moeder / mama
liber  | libri, m.        | boek
liber  | libera, liberum  | vrij
ad     |                  | naar / bij / tot
donum  | doni, n.         | geschenk / cadeau
```

```
term | form | translation
```

- **`|` separates the fields.** It appears in neither Latin nor Dutch, so there is
  no quoting, no escaping, no delimiter guessing, and no ambiguity — ever.
- **Field 2, the grammar form, is optional.** Leave it blank (`ad |  | naar`) or
  omit it entirely: a line with only two fields is read as `term | translation`.
  Two things means a word and its meaning; three means a word, its form, and its
  meaning.
- **`/` separates alternative translations.** Any one of them counts as correct. The
  full string is shown on reveal as the canonical answer.
- **`#` starts a comment**, and the first `#` line is taken as the chapter title —
  so the file names itself and no metadata lives anywhere else.
- **Whitespace is trimmed everywhere**, so columns can be aligned for readability (as
  above) or typed loosely. Blank lines and stray `\r` are ignored.

The fields are generic on purpose — `term | form | translation` works just as well
for French, English or German, where field 2 holds a verb group or an irregular
plural instead of a declension.

#### Why this rather than CSV

Because I get to pick, and CSV costs a page of defensive code for nothing gained
here. Choosing `|` and `/` as two *distinct* delimiters with two *distinct* meanings
deletes all of the following, none of which is a hypothetical problem:

| CSV would need | Why it disappears |
|---|---|
| Delimiter auto-detection (`;` vs `,` vs tab) | One delimiter, fixed. |
| RFC 4180 quote parsing | Nothing needs quoting. |
| Header-row detection | `#` comments are explicit. |
| Excel's Windows-1252 mangling of `ë` and `ï` | A `.txt` file typed in any editor is UTF-8. |
| Guessing whether a comma splits a grammar form or an alternative translation | `,` stays *inside* a form; `/` splits alternatives. |

That last row is the real win. In `mater, matris, f.;moeder, mama` the two commas
mean completely different things, and any parser has to guess which is which. Here
they cannot be confused.

A `.txt` extension rather than something custom, so the file opens on a phone, in
Notepad, in an IDE, in a mail attachment — with no "what opens this" friction.

**Tolerance, deliberately limited:** if the first data line contains no `|` but does
contain a `;` or a tab, that character is used as the field separator for the whole
file, and the import preview says so. This makes a list pasted straight out of a
spreadsheet work, without reintroducing per-line guessing. A line the parser cannot
read is reported with its line number — never silently dropped.

Also strip a UTF-8 BOM if present. One line of code, and it otherwise puts an
invisible character on the very first headword.

#### Word IDs must be content-derived, not positional

The one genuine trap in any line-based pipeline. If IDs come from row position
(`l1-001`), then inserting or reordering a single line shifts every later ID and
silently reattaches her progress to the wrong words — corruption with no error
message.

So: **`id = hash(normalize(term))`**, using a small deterministic string hash
(FNV-1a, about ten lines) and normalising by lowercasing, trimming, collapsing
whitespace and stripping accents. Consequences, all of them wanted:

- Reordering, inserting or realigning lines changes nothing.
- Fixing a typo in a *translation* or a *form* keeps the word's progress.
- Fixing a typo in a *term* creates a new word, which is correct — it was a
  different word before.
- **The same word in two chapters is one card.** Chapter 7 revisiting chapter 3's
  vocabulary does not reset it; she either knows `pater` or she does not. The card
  records which lists it belongs to, and its accepted answers are the union across
  them.

**Homographs** are the exception, and Latin has real ones — `liber` (book) and
`liber` (free) above would collide on a term-only hash. Rule: when a normalised term
appears more than once in the corpus, the colliding cards include the first word of
their form in the hash (`liber`+`libri` vs `liber`+`libera`), and the import preview
flags the pair so it can be checked by eye. Keying on the form only when it is
actually needed keeps typo-resilience for the vast majority of words that are not
homographs.

#### Cache busting

The service worker caches `data/*.txt`, so an edited chapter would otherwise keep
serving the old version. Give each list an integer `rev` in `index.json` and fetch it
as `latin-chapter-01.txt?v=3`.

### Progress — one `localStorage` key, `llrnr.progress.v1`

```json
{
  "version": 1,
  "xp": 1240,
  "stage": 1,
  "streak": { "current": 5, "best": 12, "lastDay": "2026-09-04", "freezes": 1 },
  "badges": ["first10", "streak7"],
  "roma": { "unlocked": ["casa-romuli", "ovile"], "seenXp": 1150 },
  "settings": {
    "lessonMinutes": 10,
    "newPerLesson": 8,
    "anticipationSeconds": 4,
    "sound": true,
    "lastDirection": "both"
  },
  "tests": [
    {
      "id": "t1",
      "title": "Latin SO ch. 4–5",
      "date": "2026-09-11",
      "lists": ["latin-ch04", "latin-ch05"],
      "targetRecalls": 3,
      "directions": "both"
    }
  ],
  "cards": {
    "h3f9a21c": {
      "term": "mater",
      "lists": ["latin-ch01", "latin-ch07"],
      "phase": "retain",
      "micro": 0,
      "box": 3,
      "dueAt": "2026-09-11T06:00:00.000Z",
      "cleanDays": {
        "fwd": ["2026-08-30", "2026-09-01", "2026-09-04"],
        "rev": ["2026-09-04"]
      },
      "seen": 11,
      "correct": 9,
      "slips": 2,
      "dirOk": { "fwd": true, "rev": false }
    }
  }
}
```

Notes on the shape:

- The card key is the content hash from the previous section, not a row number. The
  `term` is stored alongside it purely so the progress file stays human-readable when
  debugging or hand-editing — the hash alone would be unreadable.
- `lists` records every chapter the word appears in, so removing a chapter from the
  pool does not lose the card.
- `phase` is `new` | `acquire` | `retain` | `learned`; `micro` matters only in
  acquire, `box` only in retain.
- `dueAt` is a **full ISO timestamp, not a date** — the acquire ladder needs
  second-level precision. Day granularity would break it.
- `cleanDays` holds the distinct days with a clean recall, **split by direction** —
  this is what powers the readiness count and the "solid one way only" diagnostic.
  Cap each side at the largest `targetRecalls` in use.
- `dirOk` is the fast answer to "has this ever been right each way": it gates
  `learned`, drives the one-way marker, and tells Both mode which side to ask. The
  card above is the common case — she recognises `mater` but cannot yet produce it.
- `lastDirection` is only the pre-selected default on the lesson-start picker, not a
  constraint on anything.
- `stage` and `roma.unlocked` are both derived from `xp` and stored only as a cache,
  so that "what is new since she last looked?" is answerable via `roma.seenXp`. If a
  cache ever disagrees with `xp`, **`xp` wins** — a botched write must never cost her
  a building. See [PLAN-ROMA.md](PLAN-ROMA.md).
- `directions` on a test stays "both" because that is how she is examined; the field
  exists for the occasional one-way quiz, not as a normal setting.
- Keep it as one blob, written on every change. Version it from day one so the schema
  can change later without losing her progress.

### Pasted lists — `llrnr.lists.v1`

A chapter can arrive two ways, and both end up in the same shape:

1. **Committed** — a `.txt` file in `data/`, listed in `index.json`. Needs a
   `git push`, survives everything, good for the chapters I add myself.
2. **Pasted** — she or I paste the text straight into the app, which parses it with
   the same `parse.js` and stores it under `llrnr.lists.v1`.

The second path matters more than it looks: a new vocabulary list arrives every
couple of weeks, and needing a laptop and a git push each time is exactly the friction
that kills a tool like this. Pasting from a phone takes fifteen seconds — and it is
another reason to prefer readable pipe-separated lines over CSV, since the pasted text
is something a person reads and edits in a textarea, not a machine format.

Pasted lists are included in the JSON export alongside progress, so they are not the
fragile copy.

**The import preview is not optional.** After a paste or a file drop, show what was
understood before saving: the parsed table, the count, which separator was used, and
every rejected line with its number and reason. A silent parse failure on a
malformed list is the single most maddening bug this app could have.

---

## 5. Screens

1. **Home** — the **pixel-art Rome** as the hero at the top
   ([PLAN-ROMA.md](PLAN-ROMA.md)), with the XP bar under it doubling as progress
   toward the next building; then the stage name, streak flame, daily-goal ring, a big
   **Start lesson** button, and the honest numbers: "12 words due, 8 new available".
   If a test is active, its readiness panel pushes above the city and takes over as
   the headline — Friday outranks the reward. Stats live below the fold: words
   learned, accuracy, and a calendar heatmap of practice days.
2. **Start lesson** — a three-way direction picker (Latin→Dutch / Dutch→Latin /
   Both), pre-selected with last time's choice, and Go. One tap for the usual case,
   two if she wants to drill a side. If a test is active and words are solid only one
   way, this screen recommends that direction and says why.
3. **Lesson** — lesson time remaining, a small marker showing which way round the
   current question is, the prompt, the anticipation ring, the answer field, then the
   reveal with the grammar form and any other accepted translations. No back button
   mid-lesson, just an X that asks to confirm.
4. **Results** — words graduated, boxes climbed, XP, badge popups, and the words
   that dropped back. During a test run-up, the change in readiness ("+4 test-ready
   today") is the top line.
5. **Words** — chapters, each showing how its words spread across new → learned plus
   a **one-way** count with a button that starts a lesson in the missing direction; a
   toggle for which chapters are in the pool; and **Add list**: paste the text of a
   new chapter, check the parsed preview, save. No laptop needed.
6. **Tests** — add or edit a test (title, date, chapters in scope), and see the
   readiness panel with its per-direction breakdown and the daily-minutes estimate.
7. **Settings** — lesson length, new words per lesson, anticipation gap, default
   direction, sound, export/import progress JSON, reset a chapter.

Navigation: a bottom tab bar — **Home / Woorden / Toetsen / Instellingen**.
Thumb-reachable, four items, and instantly familiar because every iPhone app looks
like that. The lesson flow — **Les starten**, **Les**, **Resultaat** — is a modal over
the top rather than a fifth tab, so there is no way to wander out of a lesson by
mistake.

The screen names above are the English ones used in the code and in the rest of this
plan; the labels she sees are the Dutch ones. The mapping, once, so it is written
down somewhere:

| Code | Label |
|---|---|
| `home` | Home |
| `words` | Woorden |
| `tests` | Toetsen |
| `settings` | Instellingen |
| `start` | Les starten |
| `lesson` | Les |
| `results` | Resultaat |

---

## 6. File layout

```
llrnr/
  index.html                 # shell + all screens as hidden sections
  manifest.webmanifest
  service-worker.js
  css/
    style.css
  js/
    app.js                   # boot, routing between screens
    parse.js                 # word-list parser, content-hash ids
    store.js                 # localStorage load / save / migrate
    schedule.js              # micro-ladder + boxes, phase transitions
    cram.js                  # test-date compression, readiness maths
    lesson.js                # lesson loop, priority queue, anticipation gap
    answer.js                # forgiving matching, clean-recall rules
    gamify.js                # xp, stages, streaks, badges
    ui.js                    # rendering helpers, animations
    roma/                    # the reward city — see PLAN-ROMA.md
      engine.js              #   P/hash/blob/bloom/arch, flame, smoke, scale props
      palette.js             #   the one shared palette
      catalogue.js           #   the 25 buildings: latin, dutch, cost, slot, band
      buildings.js           #   draw functions + character grids, one interface
      render.js              #   scene layers, integer scaling, layer cache, night
      roma.js                #   unlock logic against total XP
  data/
    index.json               # available lists: id, file, rev
    latin-chapter-01.txt
  icons/
    icon-180.png             # apple-touch-icon
    icon-192.png
    icon-512.png
  PLAN.md
```

`schedule.js` and `cram.js` are deliberately separate from the lesson loop and hold
nothing but interval arithmetic. They are the heart of the app and the things most
likely to be tuned, so each should be readable on one screen and testable on its own
against a fake clock.

`parse.js` is pure too: text in, `{term, form, translations[], id}` out, plus a list
of rejected lines with reasons. One parser serves both the committed `.txt` files and
the paste-in flow, so there is no second code path to keep in sync.

---

## 7. Build order

**Phase 1 — walking skeleton (get it on her phone on day one)**

1. `index.html` + CSS shell.
2. `parse.js` + one real chapter as `data/latin-chapter-01.txt`. Do this first rather
   than hardcoding an array — it is a small file, and it means every later phase is
   exercised against real data with real accents, real homographs and real
   multi-translation lines.
3. `schedule.js`: the micro-ladder, the boxes, and the phase transitions. This is the
   app. Drive it from a throwaway script with a fake clock and confirm a word really
   does come back at 5s, 25s, 2m, 10m, then tomorrow.
4. `lesson.js`: a 10-minute lesson — presentation cards, typed recall with the
   anticipation gap, reveal, results screen. In-memory progress only.
5. `manifest.webmanifest` + icons, push to GitHub Pages, **install on her iPhone**.
   Doing this early proves the whole delivery path works before writing more code.

**Phase 2 — it teaches properly**

6. `store.js` with persistent progress, so the boxes mean something across days.
7. `answer.js`: forgiving matching, the "almost" case, and the clean-recall rule.
8. The direction picker, per-direction `dirOk`/`cleanDays`, weak-side selection in
   Both mode, and the `learned` gate with its one-way marker.
9. Backlog capping and lowest-box-first ordering.

**Phase 3 — it is useful for school** *(the differentiator — do not defer this)*

10. `cram.js`: test objects, interval compression, weakest-first ordering.
11. The readiness panel and the minutes-a-day estimate.
12. Breadth-before-depth triage when time is short, with the honest message.
13. The rest of her chapters, plus the paste-in importer and its preview, so adding a
    list needs neither a laptop nor a code edit.

**Phase 4 — it is fun and durable**

14. XP, stages, streak, daily goal ring, readiness ring during exam week.
15. Badges and results-screen celebration, sounds.
16. The new → learned track visualisation on the Words screen.
17. Service worker for full offline use.
18. Export / import progress JSON.

**Phase 4b — the reward city** *(full plan: [PLAN-ROMA.md](PLAN-ROMA.md))*

Strictly downstream of item 14 — the city cannot unlock anything before XP exists.
Its own build order stops at a useful point after four steps, so a half-finished
catalogue is never a broken feature.

**Later, if wanted**

- A "test in 3 days, you are 12 words behind" notification — the one notification
  that earns its keep, since it carries real information rather than nagging. Needs
  the app installed to the home screen; the phone itself is already new enough.
- Spoken prompts via `speechSynthesis` for modern languages, where real voices exist.
- Grading the grammar forms (genitive, gender) as a harder mode.
- A second language list (French / English) to prove the generic model.

---

## 8. Open questions

- **Word lists: settled — send them as `term | form | translation` text**, one word
  per line, per section 4. Field 2 blank or omitted where there is no grammar form,
  `/` between alternative translations. One file per chapter, first line a `#` title.
  A single real chapter unblocks Phase 1 item 2; the rest can follow whenever.
- **Native language: settled — Dutch, and the app itself speaks Dutch too.** She and
  her father are Flemish, so every user-visible string is Dutch (section 1), while the
  code stays English. `nl-BE` for dates and numbers.
- **Are the grammar forms examined?** If she is marked on "matris, f." then field 2
  needs grading rather than just display, which changes the answer UI. Assumed
  display-only for v1 — but the field is in the format from the start precisely so
  that switching it on later needs no re-typing of the lists.
- **Three clean recalls on three days** — a guess at what "test-ready" should mean.
  Easy to tune once we can compare the readiness number against an actual mark.
- **Latin pronunciation is no longer a blocker.** Audio dropped off the critical path
  when the plan stopped being audio-first, so the missing iOS Latin voice can wait.
- **iOS 16.4+: settled.** Above every threshold this plan cares about. It makes web
  push notifications a real option (section 1 for the conditions), and it also gives
  the Screen Wake Lock API — which, now that lessons are typed rather than
  hands-free audio, is probably not needed: she taps a key every few seconds, so the
  screen never idles long enough to lock. Worth knowing it is there if a
  listening mode ever comes back.
