# Roma Crescens — the pixel-art reward city

A sub-plan of [PLAN.md](PLAN.md), covering the gamification reward: a pixel-art Rome
that grows from a few huts on the Palatine to the imperial city as XP accumulates.

Read section 3 of the main plan first — the XP rules there are what drives this.

The rendering technique is specified in full in
[pixel-art-plan.md](pixel-art-plan.md): engine primitives, palette, per-building
recipes, day/night and fire systems. This document decides *what* Rome is and *when*
it grows; that one decides *how* a Roman building is drawn. Where they overlap, that
one is the authority on drawing code.

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

| # | Latin | Dutch | Cumulative XP | Size |
|---|---|---|---|---|
| **Stage 1 — Roma Quadrata** | | | | |
| 1 | Casa Romuli | hut van Romulus | 200 | small |
| 2 | Ovile | schaapskooi | 600 | small |
| 3 | Murus ligneus | houten palissade | 1 200 | small |
| 4 | Ficus Ruminalis *(dec.)* | vijgenboom | 1 800 | small |
| 5 | Ara | altaar | 2 600 | small *(fire)* |
| **Stage 2 — Regnum** | | | | |
| 6 | Forum | marktplein | 4 000 | mid |
| 7 | Cloaca Maxima | hoofdriool | 5 500 | small |
| 8 | Templum Vestae | tempel van Vesta | 7 500 | mid *(fire)* |
| 9 | Pons Sublicius | eerste brug | 9 500 | mid |
| 10 | Carcer | gevangenis | 11 800 | small |
| **Stage 3 — Res Publica** | | | | |
| 11 | Curia | senaatsgebouw | 14 000 | mid |
| 12 | Rostra | spreekgestoelte | 16 500 | small |
| 13 | Basilica | rechtsgebouw | 19 500 | mid |
| 14 | Murus Servii | stadsmuur | 23 000 | far band |
| 15 | Via Appia *(dec.)* | de Via Appia | 26 500 | foreground |
| **Stage 4 — Imperium** | | | | |
| 16 | Aqua Appia | aquaduct | 30 000 | repeating |
| 17 | Thermae | badhuis | 34 000 | hero |
| 18 | Circus Maximus | wagenrenbaan | 38 000 | hero |
| 19 | Theatrum | theater | 42 000 | mid |
| 20 | Horti *(dec.)* | tuinen | 46 000 | small |
| **Stage 5 — Roma Aeterna** | | | | |
| 21 | Colosseum | amfitheater | 52 000 | hero |
| 22 | Pantheon | Pantheon | 58 000 | hero |
| 23 | Columna Traiani | zuil van Trajanus | 63 000 | small |
| 24 | Arcus Triumphalis | triomfboog | 66 000 | mid |
| 25 | Templum Iovis | tempel van Jupiter | 74 000 | hero |

**`Arcus Triumphalis` is new**, added because the drawing spec ships a complete
triumphal-arch recipe (pixel-art-plan §8.4) and it would be perverse to leave a
finished, instantly recognisable Roman monument on the floor. That makes the
catalogue **25 buildings**, not 24, and pushes the capstone from 70 000 to 74 000 XP.
Both numbers were always estimates — see below.

### How those numbers were chosen — and why they will need retuning

Working from the main plan's XP rates (25 per word graduated out of acquire, 15 per
box promotion, 50 for `learned`, first lesson of the day doubled), a ten-minute lesson
that graduates ~8 new words and promotes ~15 lands somewhere around **400–600 XP**.
At four lessons a week over a school year — roughly 150 lessons — that is about
**70 000 XP**, which is roughly where the capstone sits.

So the whole city is achievable in one school year of steady use, and the last temple
is a genuine achievement rather than a formality.

**But that 400–600 figure is an estimate built on an estimate**, and it cannot be
checked until the XP system in Phase 4 of the main plan actually runs. Two tuning
rules matter more than the table itself, and should survive any renumbering:

1. **The first building unlocks inside the first lesson.** `Casa Romuli` at 200 XP is
   set so she sees the city react before she has finished her first ten minutes. If
   the hook does not land immediately it does not land.
2. **No gap longer than about eight lessons.** If real XP rates make any step wider
   than that, insert a decoration rather than stretching the wait.

Recalculate the table from one week of real data before treating it as final.

---

## 3. The art: drawn from code, not PNG files

The single most important technical decision here, and it follows the main plan's
no-build-step rule. **No sprite sheets, no image assets, no art pipeline** — every
pixel comes out of a function.

There are two ways to author a building from code, and this plan uses both.

### Mode A — a draw function (the default)

Taken from [pixel-art-plan.md](pixel-art-plan.md): a building is a short function
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
[pixel-art-plan.md](pixel-art-plan.md) §3–§4 and §7; this is what matters at plan
level.

### Five primitives, and that is all

| Primitive | What it does | Why it matters here |
|---|---|---|
| `P(x, y, w, h, col)` | paint one logical rectangle | the only thing that touches the canvas |
| `hash(x, y)` | deterministic 0–1 noise from coords | cracks, rubble, tree height — stable every render |
| `blob(cx, cy, r, …)` | 3-tone shaded circle | domes, treetops, the moon |
| `bloom(…)` | translucent halo + lit core | every light source at night |
| `arch(cx, topY, w, h, col)` | semicircle + shaft opening | **the** Roman primitive; six buildings are mostly this |

`hash()` deserves a note: **all randomness is derived from coordinates**, never from
`Math.random()` and never stored. The city therefore looks pixel-identical every time
she opens the app, which is the difference between a place and a screensaver.

### One palette for the whole city

The spec's warm-stone palette (marble / travertine / terracotta / water / foliage /
fire, each in a lit / base / shadow triple) lives in **one module, imported by every
building**. This is not a style preference, it is the mechanism that makes twenty-five
independently authored buildings read as one city. A building that hardcodes a colour
is a bug.

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

`drawCypress()` and `drawFigure()` — a ~10px dark teardrop tree and a 2×5 toga figure
with a walk bob. These are the "citizens" of the foreground layer in §5, at about ten
lines each. The figure count is a free second progress read: **let the number of
citizens on the plaza track words `learned`**, capped at a dozen or so. Population
growth, at no cost.

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
the finished scene, then a `bloom()` for each entry in `glowTargets` and `emitters`,
then moon and twinkling stars. Perhaps sixty lines, because the buildings already
registered their own lights in §4.

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

**Rome is the top of the Home screen, not a separate tab.** The main plan's tab bar
stays at four items. The city occupies the hero area of Home — a 320-wide window onto
the 560-wide scene — so it is the first thing she sees on opening the app, with the XP
bar beneath it doubling as "progress to the next building". Tapping it opens a
full-screen view that can be pinch-zoomed and panned across the whole city.

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
```

`render.js` must not know what a building *means*, `catalogue.js` must not know how
anything is drawn, and `buildings.js` must not know why anything unlocks. That is the
seam that lets the art source be swapped for a CC0 tileset if the hand-authored
sprites disappoint.

---

## 9. Build order

This is all downstream of the main plan's Phase 4 XP system — the city cannot unlock
anything before XP exists. Slot it in as **Phase 4b**.

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
   suspendable loop.
8. **Retune the XP table** against a week of real lesson data.

Stopping after step 4 still leaves something worth having: a small city that grows for
the first few weeks. Everything after that is extending a working thing, so a
half-finished catalogue is never a broken feature.

---

## 10. Later, if it lands

- **Let her choose** between two or three options at some unlock points. Real agency,
  at the cost of composition control — worth it once the fixed order has proven the
  aesthetic works.
- **Tap a building** to see its Latin name and history again. A voluntary, curiosity
  driven vocabulary list, which is the best kind.
- **A quiet nameplate mode** where each building is labelled in Latin, turning the
  city into a picture dictionary.
- **Export the city as a PNG** she can send to a friend. Almost free with a canvas
  (`toBlob()` on the full scene), and it is the only sharing feature this app needs.
- **A ruin mode for a neglected city** — the `facadeTop` machinery from §5 run
  backwards. Tempting, and **rejected**: the main plan's rule is that nothing is ever
  taken away, and a decaying city is a punishment. Noted here so it stays rejected.
