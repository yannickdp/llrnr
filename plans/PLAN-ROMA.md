# Roma Crescens — the pixel-art reward city and the coach

A sub-plan of [PLAN.md](PLAN.md), covering the pixel-art half of the gamification:

- **The city** (§1–§8) — a Rome that grows from a few huts on the Palatine to the
  imperial city as XP accumulates. The long-arc reward, paying out every few lessons.
  **This is the one being built.**
- **The coach** (§9) — a pixel Roman who reacts after every answer with Flemish Dutch
  encouragement and a real Latin motto. The short-arc reward, paying out constantly.
  **Parked**: fully designed and kept, deliberately not scheduled. §9 carries the
  reasoning and the test that would revive it.

Read section 3 of the main plan first — the XP rules there are what drives both.

The rendering technique is specified in full in
[plan-roma-updates.md](plan-roma-updates.md): engine primitives, palette, per-building
recipes, day/night and fire systems, and the coach (its §14). This document decides
*what* Rome is and *when* it grows; that one decides *how* a Roman building is drawn.
Where they overlap, that one is the authority on drawing code.

> **[plan-roma-updates.md](plan-roma-updates.md) supersedes `pixel-art-plan.md`.** It
> is the same document plus two things: the night-order fix folded into §6 below, and
> the coach spec. `pixel-art-plan.md` is now redundant and can be deleted; if the two
> ever disagree, the updates file wins.

---

## 1. Why this is the right reward

Most vocabulary apps reward you with a number going up. This rewards her with
something that is *about the subject*:

- **Every building has a real Latin name** — `Curia`, `Thermae`, `Aqua Appia`,
  `Templum Vestae`. The reward screen teaches vocabulary and Roman history as a side
  effect, without a single extra exercise.
- **It grows in historical order**, from Romulus's hut to the Colosseum, so the
  progression is a timeline she is absorbing for free.
- **It is cumulative and permanent.** The main plan's rule is "never lose XP"; a city
  can only ever grow, which fits exactly. Nothing is ever spent, taken away, or
  decayed.
- **It gives XP a purpose.** An abstract level number is a weak sink. A visible city
  with an obvious empty plot next to it is a strong one.

### One consequence for the main plan

**Levels should become stages, named in Latin.** The main plan currently has both an
XP level number *and* this city; that is two abstractions doing one job. Replace
"level 4" with **Imperium** — the growth stage the city has reached. One fewer number,
thematic, and it makes the city the single canonical picture of progress.

---

## 2. Progression — five stages

| Stage | Latin | Era | What appears |
|---|---|---|---|
| 1 | **Roma Quadrata** | 753 BC | Huts on the Palatine, a palisade, an altar |
| 2 | **Regnum** | the kings | The Forum drained, first temple, first bridge |
| 3 | **Res Publica** | republic | Curia, Rostra, Basilica, stone walls |
| 4 | **Imperium** | empire | Aqueduct, baths, Circus Maximus |
| 5 | **Roma Aeterna** | high empire | Colosseum, Pantheon, Trajan's Column |

### The catalogue

Buildings unlock in a **fixed order at cumulative XP thresholds**. Fixed order is a
deliberate choice: it means the composition is designed once and the city always looks
like Rome rather than a scrapyard. Small **decorations** are interleaved between the
big buildings so there is never a long stretch with nothing to look forward to.

The **size** column is the building's authored width class in logical pixels, and it
is not decoration — it is what makes the scene composable. See §5.

| # | Latin | Dutch | Lesson | Cumulative XP | Size |
|---|---|---|---|---|---|
| **Stage 1 — Roma Quadrata** | | | | | |
| 1 | Casa Romuli | hut van Romulus | 1 | 20 | small |
| 2 | Ovile | schaapskooi | 2 | 300 | small |
| 3 | Murus ligneus | houten palissade | 4 | 1 400 | small |
| 4 | Ficus Ruminalis *(dec.)* | vijgenboom | 6 | 2 600 | small |
| 5 | Ara | altaar | 8 | 4 000 | small *(fire)* |
| **Stage 2 — Regnum** | | | | | |
| 6 | Forum | marktplein | 12 | 7 000 | mid |
| 7 | Cloaca Maxima | hoofdriool | 16 | 10 500 | small |
| 8 | Templum Vestae | tempel van Vesta | 20 | 14 000 | mid *(fire)* |
| 9 | Pons Sublicius | eerste brug | 24 | 17 500 | mid |
| 10 | Carcer | gevangenis | 29 | 21 500 | small |
| **Stage 3 — Res Publica** | | | | | |
| 11 | Curia | senaatsgebouw | 34 | 26 000 | mid |
| 12 | Rostra | spreekgestoelte | 40 | 32 500 | small |
| 13 | Basilica | rechtsgebouw | 46 | 38 500 | mid |
| 14 | Murus Servii | stadsmuur | 52 | 45 000 | far band |
| 15 | Via Appia *(dec.)* | de Via Appia | 58 | 51 000 | foreground |
| **Stage 4 — Imperium** | | | | | |
| 16 | Aqua Appia | aquaduct | 65 | 58 500 | repeating |
| 17 | Thermae | badhuis | 72 | 65 500 | hero |
| 18 | Circus Maximus | wagenrenbaan | 80 | 74 000 | hero |
| 19 | Theatrum | theater | 88 | 80 500 | mid |
| 20 | Horti *(dec.)* | tuinen | 96 | 85 000 | small |
| **Stage 5 — Roma Aeterna** | | | | | |
| 21 | Colosseum | amfitheater | 104 | 92 000 | hero |
| 22 | Pantheon | Pantheon | 112 | 98 000 | hero |
| 23 | Columna Traiani | zuil van Trajanus | 120 | 104 000 | small |
| 24 | Arcus Triumphalis | triomfboog | 128 | 109 000 | mid |
| 25 | Templum Iovis | tempel van Jupiter | 136 | 114 000 | hero |

**`Arcus Triumphalis` is new**, added because the drawing spec ships a complete
triumphal-arch recipe (plan-roma-updates §8.4) and it would be perverse to leave a
finished, instantly recognisable Roman monument on the floor. That makes the
catalogue **25 buildings**, not 24.

### How those numbers were chosen — measured, not estimated

The **Lesson** column is the design; the XP column is the means. That is the right way
round, and it took two attempts to get there.

The XP is read off a **simulation of the real lesson loop** — the real ladder, the real
boxes, the real award rules — playing one ten-minute lesson a day with every answer
correct, against a 500-word pool. The thresholds are the XP that curve reaches on the
lesson each building is meant to arrive on. Two tuning rules drive it, and they are
what should survive any future renumbering:

1. **The first building lands on the first lesson.** If the city does not react on day
   one, the hook does not land at all.
2. **No gap longer than eight lessons.** If real rates stretch a step past that, insert
   a decoration rather than the wait.

### Why the first two attempts were wrong

Worth keeping, because both errors came from estimating XP per lesson instead of
measuring it, and that is the trap here.

**The original table assumed a flat 400–600 XP a lesson.** It is not flat. Measured, it
runs **20** for the very first lesson, then 520, 730, 860, settling near **1000** once
reviews are flowing, and falling back toward nothing if the word pool is ever
exhausted. Equal XP steps are therefore *not* equal waits — under the flat assumption
one 8 000-XP step looked like sixteen lessons and another like four.

**`Casa Romuli` at 200 XP was unreachable on day one.** The acquire ladder is 12m35s
long and the lesson box is ten minutes, so **no word can graduate inside a first
lesson** — `lesson.js` says as much in a comment — and the finish bonus, 10 doubled to
20, is the whole of what a first lesson can pay. The hut sat at 200 and arrived on day
*two*, quietly breaking rule 1 by design rather than by tuning. It costs 20 now.

**The second attempt spread stage 5 evenly in XP**, which fixed the arithmetic and not
the problem: against an exhausted 240-word pool the real waits came out at 20 and 27
lessons. That is what sent the tuning to a simulation.

### What it depends on

The pool has to be big enough. XP comes from words moving, so a small chapter list
caps the city no matter how many lessons she does — at 40 words the curve flattens at
about 11 000 XP and two-thirds of Rome is permanently unreachable. Tuned for the
**500–700 words** she is expected to have this year; at 500 the city completes on
lesson 137, at 700 on lesson 110. Real play is slower than the simulation's perfect
play, and 600 words are faster than 500, so the two errors point in opposite
directions.

Re-check against a few weeks of her real data before treating any of it as final — but
re-check by re-running the measurement, not by estimating again.

---

## 3. The art: drawn from code, not PNG files

The single most important technical decision here, and it follows the main plan's
no-build-step rule. **No sprite sheets, no image assets, no art pipeline** — every
pixel comes out of a function.

There are two ways to author a building from code, and this plan uses both.

### Mode A — a draw function (the default)

Taken from [plan-roma-updates.md](plan-roma-updates.md): a building is a short function
built from five shared primitives, painting logical rectangles onto the canvas.

```js
export function drawTemplumVestae(x, gy) {   // x = left edge, gy = ground line
  for (const cx of [x+4, x+8, x+12, x+16])   // columns
    drawColumn(cx, gy-14, gy-2)
  P(x+2, gy-16, 18, 2, marbleShade)          // entablature
  arch(x+11, gy-11, 5, 9, arc)               // doorway
  emitters.push({ x: x+11, by: gy-1, size: 1.6 })   // the eternal flame
}
```

This is the right default because Roman architecture is *repetitive*. One `arch()`
primitive is the whole character of the aqueduct, the Colosseum, the triumphal arch,
the basilica and the theatre. One `drawColumn()` is every temple. A character grid
would mean hand-placing those repetitions pixel by pixel, twenty-odd times, with no
way to review the result — a 52×36 Colosseum grid is 1 900 characters that nobody,
including me, can read. As a function it is forty lines with a **ruin parameter**.

Four of the catalogue's monuments already have complete recipes in the spec:
**Templum Vestae / Templum Iovis** (§8.1), **Colosseum** (§8.2), **Aqua Appia**
(§8.3) and **Arcus Triumphalis** (§8.4). The spec's forum scene (§10) additionally
provides the `mini*` silhouette technique that §5 below leans on for the back band.

### Mode B — a character grid (for the small and the rustic)

The original grid idea is kept, because for a 12×9 hut a function is silly:

```js
export const casaRomuli = {
  id: 'casa-romuli', latin: 'Casa Romuli', dutch: 'hut van Romulus',
  note: 'Hier zou Romulus zelf gewoond hebben.',
  w: 12, h: 9,
  palette: { '.': null, 't': '#8c6a3f', 'd': '#6b4a3a', 's': '#c9b070' },
  px: ['....ss....', '...ssss...', /* ... */],
}
```

Grids stay for `Casa Romuli`, `Ovile`, `Murus ligneus`, `Ficus Ruminalis`, `Ara`,
`Carcer`, `Rostra`, `Columna Traiani` and the decorations — anything organic,
irregular, or too small to have repeating structure worth parameterising.

### One interface either way

Both modes compile down to the same call, and **nothing outside the sprite module
knows which mode a building used**:

```js
draw(ctx, x, groundY, { scale, progress })
```

That seam is what makes the whole thing safe. Every original argument for grids still
holds for code in general: it is text, it lives in git, it diffs, it needs no binary
assets, it is a few KB for the lot, and it caches with the rest of the app.

### The honest risk, and the fallback

The risk has **moved**, and this is the most useful thing the drawing spec told us.

The spec proves out the *impressive* buildings — temple, colosseum, aqueduct, arch.
Those are stages 4 and 5, and she will not see one for months. What the spec does
**not** cover is exactly what she sees in her first ten minutes: a thatched hut, a
sheepfold, a wooden palisade, a fig tree, a stone altar. Rustic, organic, irregular —
the hardest kind of pixel art, with no recipe and no repeating structure to lean on.

So the go/no-go test must be run on **stage 1**, not on the temple:

- Build the engine, then **stage 1's five sprites** plus the hills, and look at it on
  the actual phone.
- Separately, spike **the temple recipe once** as a throwaway. Not to ship — to see
  the ceiling the engine can reach, so the stage-1 judgement is made knowing what
  comes later.
- If stage 1 reads as charming, continue. If it reads as amateurish, switch the
  sprite source to a free CC0 pixel-art set (Kenney.nl and similar publish usable
  Roman/antiquity tilesets) loaded as a PNG sheet. **The renderer does not care**:
  the interface above is the only thing it sees, so swapping the source touches one
  module and nothing else.

Keeping that seam clean is worth more than any individual sprite.

---

## 4. The engine

Shared code that every building leans on. Full listings and coordinates are in
[plan-roma-updates.md](plan-roma-updates.md) §3–§4 and §7; this is what matters at plan
level.

### Five primitives, and that is all

| Primitive | What it does | Why it matters here |
|---|---|---|
| `P(x, y, w, h, col)` | paint one logical rectangle | the only thing that touches the canvas |
| `hash(x, y)` | deterministic 0–1 noise from coords | cracks, rubble, tree height — stable every render |
| `blob(cx, cy, r, …)` | 3-tone shaded circle | domes, treetops, the moon |
| `bloom(…)` | translucent halo + lit core | every light source at night |
| `arch(cx, topY, w, h, col)` | semicircle + shaft opening | **the** Roman primitive; six buildings are mostly this |

`hash()` deserves a note: **all randomness in the city is derived from coordinates**,
never from `Math.random()` and never stored. The city therefore looks pixel-identical
every time she opens the app, which is the difference between a place and a
screensaver.

**Scope that rule to the art.** It is a property the *rendered scene* needs, not a
project-wide ban — the parked coach in §9 deliberately uses `Math.random()` to vary
its messages, since one that says the same thing every time is worthless. Do not
"fix" either to match the other.

### One palette for the whole app

The spec's warm-stone palette (marble / travertine / terracotta / water / foliage /
fire, each in a lit / base / shadow triple) lives in **one module, imported by every
building**. This is not a style preference, it is the mechanism that makes twenty-five
independently authored buildings read as one city. A building that hardcodes a colour
is a bug.

The rule is written as "the whole app" rather than "the whole city" on purpose. The
coach's demo carries its own `K` palette that overlaps this one heavily (skin, gold,
bronze, red, laurel) with slightly different hexes — so **if §9 is ever revived, merge
them rather than shipping both**: `palette.js` gains a figures/armour group and the
coach imports from there. Two near-identical palettes is how the two halves of one app
end up looking like two different games.

The three-tone rule — lit tone upper-left, base, shadow lower-right — is what makes
flat pixels read as volume, and it is the single highest-leverage habit in the whole
art job.

### Two registries

```js
let glowTargets = []   // {x,y,w,h}         lit openings — doorways, arcade arches
let emitters    = []   // {x,by,size,seed}  fire — altars, torches, braziers
```

A building **pushes** to these as it draws and otherwise knows nothing about
lighting. Adding a lit window anywhere is one line; the night pass and the fire system
pick it up automatically. This registry indirection is what keeps §6 from leaking into
twenty-five draw functions.

### Fire, and why it matters more here than in the spec

`Ara` is the **fifth building she ever unlocks** — inside the first week. A procedural
flame is about fifteen lines (three tapering teardrop layers with a `sin` sway) plus a
small smoke particle system, and it is the only motion in the city for the whole of
stage 1. Without it, stage 1 is five static brown shapes on a hill.

And it pays off again at `Templum Vestae`, whose catalogue note is *"het heilige vuur
van Rome mocht nooit uitgaan"*. The flame should actually be burning when she reads
that. Build the fire system with stage 1, not with "life" at step 7.

### Scale props

`drawCypress()`, `drawOlive()` and `drawFigure()` — a ~10px dark teardrop tree, a low
silvery dome on a squat trunk, and a 2×5 toga figure with a walk bob. These are the
"citizens" of the foreground layer in §5, at about ten lines each. The figure count is
a free second progress read: **let the number of citizens on the plaza track words
`learned`**, capped at a dozen or so. Population growth, at no cost.

**Two kinds of tree, and the contrast is the point.** A cypress is tall, narrow and
dark; an olive is short, broad and silvery. Ten wide by eight tall against three by
nine to twelve — get either half of that wrong and the second tree stops reading as a
different plant and starts reading as a row of the same one. The groves are a third,
quietest progress read: **two more olives per era**, so the place greens up as it
grows, from a village on bare hills to a city among groves. Fixed slots in the gaps
the slot map leaves free, for the same reason the buildings have them.

---

## 5. Scene composition

**Side-on elevation, not isometric.** Isometric looks better in screenshots and is
several times the work to author and to compose correctly. A layered side view reads
perfectly at phone width and each building can be drawn independently.

### The width problem — do this arithmetic before drawing anything

The spec authors one building per 64×64 scene, occupying ~44 of those 64 pixels. That
is fine for a showcase and impossible for a city: twenty-five buildings at anything
like that width need well over 600 logical pixels of frontage, and the original
320×180 scene has room for perhaps eight.

Three mechanisms fix it, and all three are needed:

1. **A wider logical scene: 560×180.** The Home hero shows a **320-wide window** onto
   it; the full-screen view pans across the whole thing, which §7 already called for.
   The window scrolls to follow the newest building.
2. **Size tiers.** The catalogue's size column, in authored logical width:
   - **hero** ~40–52 — `Thermae`, `Circus Maximus`, `Colosseum`, `Pantheon`,
     `Templum Iovis`. Roughly the spec's own scale. Five of them, and they are the
     only five that get it.
   - **mid** ~20–28 — temples, `Curia`, `Basilica`, `Theatrum`, `Arcus Triumphalis`.
     The spec's recipes at reduced detail.
   - **small** ~8–16 — huts, altar, `Rostra`, `Carcer`, decorations.
   - **repeating** — `Aqua Appia` is a special case: draw three or four arches and let
     it run off the left edge into the hills. That is how a real aqueduct reads as
     infinite without eating a third of the scene.
   - **far band / foreground** — `Murus Servii` and `Via Appia` are not buildings but
     scene furniture; they frame rather than occupy.
3. **Three depth bands**, so buildings may overlap:
   - **far** — behind the hill line, drawn with the spec's `mini*` silhouette
     technique: reduced detail, colours pulled toward `hillFar`. That desaturation is
     atmospheric perspective for free, and it lets the back band be half-width.
   - **mid** — the main street, most of the catalogue.
   - **near** — the Tiber, the road, cypresses, citizens.

A slot is therefore `(x, band)` — **not** `(x, y)`. Every building's local origin is
its **ground line**, so vertical placement falls out of the band and never has to be
tuned per sprite.

Because slots and unlock order are both fixed, the composition is laid out on paper
once and is always coherent. Lay out all twenty-five slots **before** drawing the
second building — a slot map is cheap on paper and expensive to retrofit.

The scene is scaled to the screen by an **integer factor only** (§8).

### The empty-plot teaser — build it as construction, not silhouette

The next building to unlock is drawn in its slot with the XP remaining underneath.
This is the highest-value single feature in this document: she can see what is coming
and how close it is.

The original design was a dim silhouette. The spec suggests something better. Its
Colosseum recipe carries a `facadeTop(x)` function that decides how much of the wall
exists at each column — that is what makes it a *ruin*. Generalise it into a
`progress` parameter on every draw function (0 → nothing, 1 → finished) and the
teaser becomes a building **under construction, rising as XP accrues**, with
scaffolding on top. For grid-authored buildings `progress` is just a row clip, so it
costs nothing there.

Why it is worth the trouble: a silhouette only changes at the unlock threshold, so
between buildings the city is dead. A construction site changes *every lesson*. That
is feedback on the same schedule as the effort.

**Decide this at step 1.** `progress` is a parameter in the one interface every
building implements; adding it after ten buildings exist means editing all ten.

---

## 6. Day and night

The spec's lighting pass is a genuinely cheap win: one translucent dark rectangle over
the finished scene, then a `bloom()` for each entry in `glowTargets` and `emitters`.
Perhaps sixty lines, because the buildings already registered their own lights in §4.

### The night-order rule — get this right the first time

**Moon and stars belong to the background sky, not the night pass.** Draw them
immediately after `drawSky()` and *before* any building, so the buildings **occlude**
them:

```js
drawSky()
if (night) drawMoonStars(t)   // background — behind everything
drawScene(t)                  // hills, buildings, props; registers lights
if (night) nightPass(t)       // tint + blooms only. No moon, no stars.
drawFlames(t); drawSmoke()
```

Drawn in the night pass instead, the moon floats *in front of* the Pantheon — a
tell-tale amateur-hour bug, and one that is much cheaper to avoid than to notice
later. The tint dims the already-drawn moon along with everything else, which is
correct; **use `rgba(12,16,44,0.45)`**, not the 0.55 the first draft of the spec
had, or the moon goes muddy.

This ordering constraint is the reason the render pipeline is a fixed nine-step list
in the spec rather than something each building decides for itself.

**Drive it from the real clock, not a timer.** Homework happens in the evening; if the
city is lit up with the Vesta flame and torchlit arcades when she opens it after
dinner, and sunlit on a Sunday afternoon, the city feels like a place that exists
while she is not looking. An auto-cycling toggle on the Home hero is a fidget toy and
undoes that — put a manual toggle in the full-screen view only, if anywhere.

Scope note: this is **step 7 work**, not step 2. It needs `glowTargets`/`emitters` to
exist from the start (they do, per §4) but nothing else depends on it, and the unlock
moment must feel right first.

---

## 7. Where it lives

**Rome is the top of the Home screen, not a separate tab.** And nothing else is up
there with it: the hero is the city edge to edge, the XP bar underneath names the
building being worked toward, and the *"x of 25 buildings"* count belongs in the
full-screen view rather than on Home. Two labels under one picture make both of them
wallpaper, and Home is the most crowded screen in the app.

 The main plan's tab bar
stays at four items. The city occupies the hero area of Home — a 320-wide window onto
the 560-wide scene — so it is the first thing she sees on opening the app, with the XP
bar beneath it doubling as "progress to the next building". Tapping it opens a
full-screen view that can be pinch-zoomed and panned across the whole city.

### The full-screen view, and tapping a building

Three constraints, written down before it is built because each one is cheap to
honour and expensive to discover:

1. **Zoom snaps to whole numbers.** §8 bans fractional scaling because it resamples
   the art into a smear, and that reads as bad art rather than as a bug — so "pinch to
   zoom" here means stepped: ×1, ×2, ×3, ×4. Scale the cached bitmap smoothly with a
   CSS transform during the gesture and snap on release; the scene re-caches once, at
   the new integer scale, rather than on every frame of the pinch.
2. **Tapping a building belongs in here, not on the hero.** At the hero's scale every
   building is a 12–26 pixel target on a phone, well under the ~44 px a finger needs.
   So a tap on the hero opens this view and nothing else; inspecting a building
   happens where zoom has made it big enough to hit. Zoom and tap are therefore one
   feature and not two.
3. **A tap resolves front-most first.** The depth bands overlap on purpose, so a tap
   near the river can be over both `Pons Sublicius` in the water band and `Via Appia`
   in the near one. `inDrawOrder()` already encodes the answer — reverse it and take
   the first slot that contains the point.

None of this needs anything the city does not already have: the catalogue carries
`(x, w, band)` per slot, so hit testing is a rectangle test, and it carries `latin`,
`dutch` and `note`, which is exactly what the unlock card already renders. Nothing a
sprite knows has to change.

That placement is the point: the reward should be unavoidable, not somewhere she has
to navigate to.

### The unlock moment

This is the emotional payoff and deserves care:

1. It happens on the **Results screen after a lesson** — never mid-lesson, which would
   break the flow the anticipation gap depends on.
2. The view pans to the slot, which she has been watching fill up as a construction
   site (§5).
3. The scaffolding comes off and the building **completes from the ground up** over
   ~800 ms — a clip rectangle rising over the finished draw, which costs nothing
   because the draw function is already parameterised by `progress` — with a short
   chime.
4. A card slides up: the **Latin name**, the Dutch meaning, and *one* line of real
   history. One line — it is a reward, not a lesson.
5. Multiple unlocks queue rather than overlapping.
6. Crossing into a new stage is bigger: the stage name appears in Latin
   (**Res Publica**), and the hills gain a detail.

---

## 8. Technical notes

Small things that separate crisp pixel art from a blurry mess on an iPhone:

- **`ctx.imageSmoothingEnabled = false`**, plus `image-rendering: pixelated` in CSS,
  and scale by **integer factors only** (×2/×3/×4 chosen from viewport width). A
  fractional scale makes pixel art look smeared, and it is the most common way this
  kind of thing goes wrong.
- **Size the canvas by `devicePixelRatio`**: set `width`/`height` attributes to
  `logical × scale × dpr`, and the CSS size to `logical × scale` px.
- **Redraw only on change.** The scene is static between unlocks; there is no reason
  to run a render loop for it.
- **Layer caching is required here, not an optimisation.** The spec calls 64×64 at
  ~4 000 `fillRect`s per frame trivial, and it is — but this scene is 560×180 with
  twenty-five buildings, which is a different budget on a phone. Cache the sky, hills
  and every finished building to an offscreen canvas, invalidated only on unlock;
  per-tick redraw is limited to fire, smoke, water shimmer and citizens.
- **Animate only what moves, and stop when unseen.** The animated foreground runs at
  ~4 fps on a `requestAnimationFrame` loop suspended on `visibilitychange` and by an
  `IntersectionObserver` when the city scrolls out of view. On a phone, an animation
  loop nobody is looking at is just battery.
- **`prefers-reduced-motion`**: render one static frame — no draw-in animation, no
  flame flicker, no smoke, no citizens bobbing.
- **The escape hatch, if it ever gets slow:** because every frame is deterministic
  code, a building can be rendered once and baked with `canvas.toDataURL()`. Reach for
  this only with a measurement in hand; layer caching should make it unnecessary.

### State

Added to the existing `llrnr.progress.v1` blob — additive, no migration:

```json
"roma": {
  "unlocked": ["casa-romuli", "ovile", "murus-ligneus"],
  "stage": 1,
  "seenXp": 1150
}
```

`unlocked` is derivable from total XP, so it is strictly a cache — but storing it is
what makes "what is new since she last looked?" answerable, which is what `seenXp` is
for. If the two ever disagree, **total XP wins**; that keeps a botched write from
costing her a building.

Nothing about the art is persisted. The teaser's `progress`, the citizen count, the
time of day and every noise value are derived at render time from XP, the clock and
`hash()`.

### Files

```
js/roma/
  engine.js      # P, hash, blob, bloom, arch, drawFlame, smoke, cypress, figures
  palette.js     # the one shared palette — every building imports it
  catalogue.js   # the 25 entries: latin, dutch, note, cost, slot, band, stage
  buildings.js   # the draw functions and character grids, behind one interface
  render.js      # scene layers, integer scaling, layer cache, night pass, animation
  roma.js        # unlock logic against total XP, new-since-last-seen
js/coach/         # PARKED, unbuilt — see §9
  coach.js       # present() / setXp() / setWait(), mood + rank state
  characters.js  # drawCharacter: torso, arms, head, headgear, gestures, flourish
  messages.js    # MSG.good / .improve / .perfect and UNLOCK — Dutch + Latin, data only
```

`render.js` must not know what a building *means*, `catalogue.js` must not know how
anything is drawn, and `buildings.js` must not know why anything unlocks. That is the
seam that lets the art source be swapped for a CC0 tileset if the hand-authored
sprites disappoint.

`messages.js` is **data, not code** — adding a motto must never mean touching a
function. That is what makes the coach's content extensible by anyone, including her.

---

## 9. The coach — parked

> **Status: designed, kept, not being built.** Everything below stands as a finished
> design; none of it is withdrawn. It is parked because the app is complete except for
> getting it onto her phone, and both remaining reward features are guesses about what
> motivates *her* until she has used it for real.
>
> **The test that decides it:** does she read the reveal, or tap straight through it?
> Reading it → the coach costs nothing and should be built. Tapping through → it is
> friction next to the part that actually teaches, and the city carries the reward
> instead.
>
> Two things that make it cheap to revive: the art risk is already retired by a
> working demo, and building it forces `engine.js` and `palette.js` into existence —
> which is §10 step 1 regardless. Its one real weakness (novelty decay, below) is
> fixable in `messages.js`, which is data, so writing more mottos is worth doing any
> time and needs no code.
>
> The parts of this section that outlived the decision are the standing rules, and
> they hold whether or not the coach is ever built: **nothing is added to the
> anticipation gap**, and **the Results screen owns every celebration**.

A pixel Roman bust who appears **after an answer**, says one encouraging line in
Flemish Dutch, and pairs it with a real Latin motto and its translation. Spec:
[plan-roma-updates.md](plan-roma-updates.md) §14; working demo:
[roman-coach.html](roman-coach.html).

The city and the coach are deliberately different instruments. The city pays out once
every few lessons and is the long arc. The coach pays out **dozens of times per
lesson**, which makes it the higher-value feature per line of code written — she will
see the coach a hundred times before the second building appears. It is also the
smaller build: one canvas, six characters, three message arrays, no composition
problem.

The mottos matter for the same reason the building names do. `Errare humanum est` on a
wrong answer, `Repetitio mater studiorum` on a retry — twenty-odd real Latin phrases
with Dutch translations, absorbed passively at the exact moment she is receptive. It is
the §1 argument again, delivered more often.

### The one real weakness: novelty decay

The spec ships 21 messages — 8 praise, 8 encouragement, 5 perfect. At roughly fifteen
appearances a lesson she has seen **the entire repertoire inside two lessons**. After a
week the coach is decoration rather than reward.

This is the honest asymmetry between the two instruments, and it is why the city is
the one that got built first. The city keeps producing genuinely new things for a
school year; the coach produces novelty for a week and then coasts on charm. Decay
into pleasant texture is a survivable outcome — it is not the same as failure — but it
should be expected rather than discovered.

Mitigation is cheap and needs no code: `messages.js` is data, so sixty mottos instead
of twenty-one buys a month instead of a week. It never becomes a year-long arc, and it
should not be asked to be one.

There is also a structural risk worth naming, separate from decay: **the coach is the
only reward feature that touches the lesson loop.** The city sits safely on the Home
screen. If anything in the reward layer is going to damage the part that actually
teaches, it is this. The rules below exist to contain that, and they are not optional
details.

### The one hard rule: not in the anticipation gap

The main plan's §2.3 gap — prompt, then four seconds of nothing, then she types — is
**silence on purpose**: "this silence is the exercise, not dead time." The coach must
never appear there. Three reasons, in order of severity:

1. **A Latin motto on screen during a Latin retrieval task can leak the answer.** Even
   with twenty fixed mottos this will eventually collide with the card being asked.
2. Retrieval under a countdown is the exercise; a talking mascot is exactly the
   distraction the gap exists to eliminate.
3. The coach's own API proves it belongs elsewhere — every mood
   (`good` / `improve` / `perfect`) is a *judgement on an answer already given*. There
   is nothing for it to say before she answers.

So the coach owns the **post-reveal beat**, and the spec's phrase "the Pimsleur wait"
means that beat, not the anticipation gap. Concretely: prompt → gap (silent) → she
types → reveal + coach together → next.

Cheap safety check to write once: **skip any motto sharing a word with the current
card.**

### The timing arithmetic — do this before building it

The demo defaults to `waitMs = 5000`. A ten-minute lesson has roughly sixty answers in
it. Sixty five-second coach beats is **five minutes** — half the lesson spent watching
a mascot. That default cannot ship, and the failure would be invisible in a demo where
you press the buttons yourself.

Three fixes, all needed:

- **Concurrent, not additional.** The reveal step already exists and she already dwells
  on it to read the answer, alternatives and grammar form. The coach renders *beside*
  the reveal in that same beat and adds no time of its own.
- **`waitMs` is a cap, not a wait.** ~1200 ms, and **any tap advances immediately**.
  `onComplete` must be callable early; it must never be the only way forward.
- **Not on every answer.** Sixty appearances a lesson is wallpaper, not a reward. Show
  it always on a `perfect`, always on a drop-back, always on a rank-up — and otherwise
  roughly one answer in four. Scarcity is the whole mechanism.

If coach dwell ever does become significant, it should not eat the lesson's time box
(PLAN §1.4); but keeping the beat this short is the simpler fix and the one to try
first.

### Mood mapping

The coach's three moods map onto the answer outcomes the main plan already defines
(§2.3, and `answer.js`):

| Answer outcome | Mood | Why |
|---|---|---|
| Clean recall — first attempt, no hint, no almost | `perfect` | triggers the victory flourish |
| Correct, but with a hint or a retry | `good` | credit without the fanfare |
| **Almost** (Levenshtein 1) or wrong | `improve` | the reveal already says *"bijna! het is mater"*; the coach carries the encouragement, not the correction |

Both *almost* and *wrong* map to `improve` on purpose: the specific diagnosis belongs
to the reveal, and the coach's job is only to make an error survivable.

### Ranks: bind them to the five stages, not to their own XP ladder

The spec's rank ladder is `servus` 0 / `gladiator` 120 / `centurion` 350 /
`magister` 750 / `senator` 1600 / `emperor` 3200 XP. **Those numbers cannot ship**, and
this is the most important finding in this section.

At the main plan's XP rates — 400–600 XP a lesson, four lessons a week — 3 200 XP is
reached in **about eight lessons**. She would be Imperator inside two weeks, and then
the coach never changes again for the remaining thirty-odd weeks of the school year. A
progression that completes in 5% of its lifetime is not a progression.

Worse, it is a *third* progress ladder in an app that §1 already trimmed to one. XP
level → replaced by stages. City buildings → driven by stages. Coach ranks must not
reintroduce an independent scale.

So **the coach's rank is the city's stage.** Six ranks fit six states exactly:

| Rank | City state | From XP |
|---|---|---|
| **Servus** | before the first building | 0 |
| **Gladiator** | Roma Quadrata | 200 |
| **Centurio** | Regnum | 4 000 |
| **Magister** | Res Publica | 14 000 |
| **Senator** | Imperium | 30 000 |
| **Imperator** | Roma Aeterna | 52 000 |

`Servus` occupies the first lesson only, which is the right feel: she starts as
nobody. `Imperator` arrives with the Colosseum, at the point the city becomes
imperial — the rank and the skyline say the same thing, which is the entire reason to
collapse the two ladders. And retuning the XP table (§2) automatically retunes the
coach, for free, because there is only one set of numbers.

### Rank-up belongs on the Results screen

§7 already fixed the rule: celebrations happen on the Results screen, *never*
mid-lesson. The spec's §14.9 does the opposite — it detects the threshold inside
`present({xp})`, so a rank-up fires in the middle of a lesson, and collides with the
stage-crossing moment §7 already schedules for the same event.

The spec hands us the fix in its own API. Use it:

- **`setXp(xp)` once at lesson start.** It updates the rank *silently*, which is
  exactly what is wanted — the coach's identity is then fixed for the whole lesson.
- **Never pass `xp` to `present()` during a lesson.** Mood only. No threshold
  detection, no mid-lesson fanfare.
- **The Results screen owns the rank-up**, shown together with the stage crossing and
  the building unlock, because they are now one event by construction.

### Two smaller corrections to the spec

- **One coach per lesson, not per answer.** `charForXp()` rerolls on every `present()`,
  so the character can change between consecutive questions. A mascot that shape-shifts
  mid-lesson is unsettling and reads as a bug. Roll once at lesson start; keep the
  growing-pool idea (every rank she has earned stays eligible, higher ranks favoured)
  as the *lesson-start* draw.
- **The coach is text, not speech.** §14 says "spoken feedback", but the demo renders
  HTML text and the main plan keeps audio off the critical path. Text for v1; the
  message bubble is HTML rather than pixels precisely so it stays readable and
  translatable. Dutch `speechSynthesis` voices do exist on iOS, so reading the motto
  aloud is a plausible **Later** item (§11) — the coach must be fully useful silent.

Two things the demo already gets right and should be kept: `lang="nl-BE"` on the
document, which matters for hyphenation now and for voice selection later; and
`prefers-reduced-motion` honoured with a static sprite while the wait bar still
counts. Do drop the demo's reduced-motion `setTimeout(…, 200)` loop, though — under
reduced motion, render once and let CSS animate the bar. §8's rule applies: a loop
nobody is looking at is just battery.

---

## 10. Build order

This is all downstream of the main plan's Phase 4 XP system — neither the city nor the
coach can react before XP exists. Slot the city in as **Phase 4b**; the coach is
**Phase 4c and is parked** (§9).

**Before either: ship what exists.** The app is complete through the main plan's Phase
4.5 — XP, stages, streak, badges, sounds, the word track, offline, export/import,
settings. What it has never had is a real word list and a real user. The city and the
coach are both guesses about what motivates her, and one afternoon of watching her use
the app is worth more than either plan. Get it onto her phone with her chapter 1
first; build the city second; revisit the coach only against the test in §9.

### The city

1. **Engine and renderer skeleton** — the five primitives, the palette module, the
   two registries, canvas with integer scaling and dpr sizing, one hardcoded sprite,
   correct on a real phone. Fix the `draw(ctx, x, groundY, {scale, progress})`
   interface now. Prove the pixels are crisp before drawing anything else.
2. **Stage 1's five sprites**, the hills backdrop, the fire system for `Ara`, and the
   slot map for all twenty-five buildings on paper. Spike the temple recipe as a
   throwaway to see the ceiling. **Stop and look at it on the phone.** This is the
   go/no-go point for hand-authored art versus a CC0 tileset.
3. **Unlock logic** against total XP, the Home-screen hero window, and the
   construction-site teaser with XP remaining.
4. **The unlock moment** — pan, completion reveal, chime, name card. Get this feeling
   right before adding volume; it is the whole reward.
5. **Stages 2 and 3** (ten more buildings) and the stage-crossing moment. The far band
   and the `mini*` silhouette treatment land here with `Murus Servii`.
6. **Stages 4 and 5** (ten more), which is where the spec's recipes are cashed in —
   aqueduct, colosseum, arch — finishing with `Templum Iovis`.
7. **Life and light** — citizens scaling with words learned, smoke, a boat, birds,
   water shimmer, and the day/night pass driven by the real clock, all inside the
   suspendable loop. Get the night-order rule right (§6).
8. **Retune the XP table** against a week of real lesson data — which would retune the
   coach's ranks at the same time, since §9 gave them no numbers of their own.

Stopping after step 4 still leaves something worth having: a small city that grows for
the first few weeks. Everything after that is extending a working thing, so a
half-finished catalogue is never a broken feature.

### The coach *(parked — kept for revival, see §9)*

Not scheduled. Recorded in build order so that picking it up is a matter of starting at
step 1 rather than re-deriving the plan. It needs city step 1 and nothing else.

1. **One character, one mood** — `servus`, drawn from the shared engine and palette,
   in the Results/reveal beat. Prove the bust reads at phone size before drawing six
   of them.
2. **The messages** as data: `MSG.good` / `.improve` / `.perfect`, wired to the answer
   outcomes in §9's mood table, with the motto-overlap check. This is the point the
   coach starts being worth having.
3. **Placement and timing** — beside the reveal, ~1200 ms cap, tap-to-advance, and the
   one-in-four appearance rule. **Run a real lesson and time it** before adding
   characters: this is where the five-minutes-of-mascot failure shows up.
4. **The remaining five characters** and the growing pool, drawn once per lesson.
5. **The flourish** on `perfect`, and the rank-up celebration on the Results screen
   alongside the stage crossing.

Stopping after coach step 2 already leaves something better than a silent reveal.

---

## 11. Later, if it lands

- **Let her choose** between two or three options at some unlock points. Real agency,
  at the cost of composition control — worth it once the fixed order has proven the
  aesthetic works.
- ~~**Tap a building** to see its Latin name and history again.~~ **Promoted** to a
  real phase — it is wanted, and §7 now carries its three constraints. It stays the
  best kind of vocabulary list: voluntary and curiosity-driven.
- **A quiet nameplate mode** where each building is labelled in Latin, turning the
  city into a picture dictionary.
- **Export the city as a PNG** she can send to a friend. Almost free with a canvas
  (`toBlob()` on the full scene), and it is the only sharing feature this app needs.
- **A ruin mode for a neglected city** — the `facadeTop` machinery from §5 run
  backwards. Tempting, and **rejected**: the main plan's rule is that nothing is ever
  taken away, and a decaying city is a punishment. Noted here so it stays rejected.
- **The coach reads the motto aloud** via `speechSynthesis` in `nl-BE`, on the reveal
  only — never during the anticipation gap. Rides along with the main plan's existing
  speech item, and needs the same iOS unlock-on-tap trick.
- **More mottos, and let her add them.** `messages.js` is data; a paste-in box for her
  own favourites costs almost nothing and makes the coach hers.
- **Bake the coach sprites** with the §8 `toDataURL()` trick if six characters ever
  cost more per frame than they are worth. Measure first.
