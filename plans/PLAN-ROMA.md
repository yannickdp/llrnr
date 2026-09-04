# Roma Crescens — the pixel-art reward city

A sub-plan of [PLAN.md](PLAN.md), covering the gamification reward: a pixel-art Rome
that grows from a few huts on the Palatine to the imperial city as XP accumulates.

Read section 3 of the main plan first — the XP rules there are what drives this.

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

| # | Latin | Dutch | Cumulative XP |
|---|---|---|---|
| **Stage 1 — Roma Quadrata** | | | |
| 1 | Casa Romuli | hut van Romulus | 200 |
| 2 | Ovile | schaapskooi | 600 |
| 3 | Murus ligneus | houten palissade | 1 200 |
| 4 | Ficus Ruminalis *(dec.)* | vijgenboom | 1 800 |
| 5 | Ara | altaar | 2 600 |
| **Stage 2 — Regnum** | | | |
| 6 | Forum | marktplein | 4 000 |
| 7 | Cloaca Maxima | hoofdriool | 5 500 |
| 8 | Templum Vestae | tempel van Vesta | 7 500 |
| 9 | Pons Sublicius | eerste brug | 9 500 |
| 10 | Carcer | gevangenis | 11 800 |
| **Stage 3 — Res Publica** | | | |
| 11 | Curia | senaatsgebouw | 14 000 |
| 12 | Rostra | spreekgestoelte | 16 500 |
| 13 | Basilica | rechtsgebouw | 19 500 |
| 14 | Murus Servii | stadsmuur | 23 000 |
| 15 | Via Appia *(dec.)* | de Via Appia | 26 500 |
| **Stage 4 — Imperium** | | | |
| 16 | Aqua Appia | aquaduct | 30 000 |
| 17 | Thermae | badhuis | 34 000 |
| 18 | Circus Maximus | wagenrenbaan | 38 000 |
| 19 | Theatrum | theater | 42 000 |
| 20 | Horti *(dec.)* | tuinen | 46 000 |
| **Stage 5 — Roma Aeterna** | | | |
| 21 | Colosseum | amfitheater | 52 000 |
| 22 | Pantheon | Pantheon | 58 000 |
| 23 | Columna Traiani | zuil van Trajanus | 63 000 |
| 24 | Templum Iovis | tempel van Jupiter | 70 000 |

### How those numbers were chosen — and why they will need retuning

Working from the main plan's XP rates (25 per word graduated out of acquire, 15 per
box promotion, 50 for `learned`, first lesson of the day doubled), a ten-minute lesson
that graduates ~8 new words and promotes ~15 lands somewhere around **400–600 XP**.
At four lessons a week over a school year — roughly 150 lessons — that is about
**70 000 XP**, which is where the capstone sits.

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

## 3. The art: pixel grids in code, not PNG files

The single most important technical decision here, and it follows the main plan's
no-build-step rule.

**Each building is a character grid in a JS module, rendered as rectangles to a
canvas.** No sprite sheets, no image assets, no art pipeline:

```js
export const templumVestae = {
  id: 'templum-vestae',
  latin: 'Templum Vestae',
  dutch: 'tempel van Vesta',
  note: 'Het heilige vuur van Rome mocht nooit uitgaan.',
  w: 20, h: 16,
  palette: { '.': null, 'm': '#efe7d6', 's': '#cdc0aa', 'r': '#9d4038', 'd': '#6b4a3a' },
  px: [
    '.......rrrrrr.......',
    '......rrrrrrrr......',
    '.....rrrrrrrrrr.....',
    '....mmmmmmmmmmmm....',
    '....m.m.m.m.m.m.....',
    // ...
  ],
}
```

Why this beats a PNG tileset here:

- **It is text.** It lives in git, diffs sensibly, needs no binary assets in the
  repo, and no export step from an art tool.
- **It is tiny.** Twenty-four buildings at ~24×20 characters is around 12 KB —
  smaller than a single PNG, and it caches with the rest of the app.
- **It makes the unlock animation free.** Drawing the first *N* rows of the grid is
  all a "building rises from the ground" animation needs. No sprite frames.
- **I can actually author it.** A character grid is something I can write and revise
  directly, where a hand-drawn tileset would need someone with the art skill.

### The honest risk, and the fallback

**The art is the bulk of the work here, and its quality ceiling is my pixel-art
ability, which is unproven.** So do not author twenty-four buildings on faith:

- Build **stage 1 only — five sprites** — then look at it on the actual phone.
- If it reads as charming, continue. If it reads as amateurish, switch the sprite
  source to a free CC0 pixel-art set (Kenney.nl and similar publish usable
  Roman/antiquity tilesets) loaded as a PNG sheet. **The renderer does not care**:
  the interface is "give me pixels for building X at scale N", so swapping the source
  touches one module and nothing else.

Keeping that seam clean is worth more than any individual sprite.

---

## 4. Scene composition

**Side-on elevation, not isometric.** Isometric looks better in screenshots and is
several times the work to author and to compose correctly. A layered side view reads
perfectly at phone width and each building can be drawn independently.

Three layers, back to front:

1. **Hills** — a static backdrop of the Palatine, Capitoline and Aventine, drawn
   once and cached to an offscreen canvas.
2. **Buildings** — each occupies a **fixed slot**: an `(x, y)` position and a
   z-order, assigned when the catalogue is designed. Because slots are fixed and the
   unlock order is fixed, the composition can be laid out on paper once and will
   always be coherent.
3. **Foreground** — the Tiber along the bottom edge, the road, a few citizens.

The scene is a fixed logical size (something like 320×180 pixels) and is scaled up by
an integer factor to fit the screen. Fixed logical dimensions mean slots never have to
be recomputed for different phones.

### The empty-plot teaser

The next building to unlock is drawn **in its slot as a dim silhouette**, with the XP
remaining underneath. This is the highest-value single feature in this document: she
can see what is coming and how close it is. An unknown reward motivates far less than
a visible one just out of reach.

---

## 5. Where it lives

**Rome is the top of the Home screen, not a separate tab.** The main plan's tab bar
stays at four items. The city occupies the hero area of Home, so it is the first thing
she sees on opening the app, with the XP bar beneath it doubling as "progress to the
next building". Tapping it opens a full-screen view that can be pinch-zoomed and
panned.

That placement is the point: the reward should be unavoidable, not somewhere she has
to navigate to.

### The unlock moment

This is the emotional payoff and deserves care:

1. It happens on the **Results screen after a lesson** — never mid-lesson, which would
   break the flow the anticipation gap depends on.
2. The view pans to the empty slot.
3. The building **draws in from the ground up** over ~800 ms, one pixel row at a time
   (free, per section 3), with a short chime.
4. A card slides up: the **Latin name**, the Dutch meaning, and *one* line of real
   history. One line — it is a reward, not a lesson.
5. Multiple unlocks queue rather than overlapping.
6. Crossing into a new stage is bigger: the stage name appears in Latin
   (**Res Publica**), and the hills gain a detail.

---

## 6. Technical notes

Small things that separate crisp pixel art from a blurry mess on an iPhone:

- **`ctx.imageSmoothingEnabled = false`**, and scale by **integer factors only**
  (×2/×3/×4 chosen from viewport width). A fractional scale makes pixel art look
  smeared, and it is the most common way this kind of thing goes wrong.
- **Size the canvas by `devicePixelRatio`**: set `width`/`height` attributes to
  `logical × scale × dpr`, and the CSS size to `logical × scale` px.
- **Redraw only on change.** The scene is static between unlocks; there is no reason
  to run a render loop for it.
- **Animate only what moves, and stop when unseen.** Citizens, smoke and a boat on the
  Tiber run at ~4 fps on a `requestAnimationFrame` loop that is suspended on
  `visibilitychange` and by an `IntersectionObserver` when the city scrolls out of
  view. On a phone, an animation loop nobody is looking at is just battery.
- **Cache the backdrop** to an offscreen canvas; only the animated foreground is
  redrawn per tick.
- **`prefers-reduced-motion`**: skip the draw-in animation and simply show the
  finished building.

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

### Files

```
js/roma/
  catalogue.js   # the 24 entries: latin, dutch, note, cost, slot, stage
  sprites.js     # the character grids and palettes
  render.js      # canvas, integer scaling, layers, draw-in animation
  roma.js        # unlock logic against total XP, new-since-last-seen
```

`render.js` must not know what a building *means*, and `catalogue.js` must not know
how anything is drawn. That is the seam that lets the art source be swapped for a
CC0 tileset if the hand-authored sprites disappoint.

---

## 7. Build order

This is all downstream of the main plan's Phase 4 XP system — the city cannot unlock
anything before XP exists. Slot it in as **Phase 4b**.

1. **Renderer skeleton** — one hardcoded sprite, canvas, integer scaling, correct on a
   real phone. Prove the pixels are crisp before drawing anything else.
2. **Stage 1's five sprites** plus the hills backdrop. **Stop and look at it.** This
   is the go/no-go point for hand-authored art versus a CC0 tileset.
3. **Unlock logic** against total XP, the Home-screen hero placement, and the dim
   silhouette teaser.
4. **The unlock moment** — pan, draw-in, chime, name card. Get this feeling right
   before adding volume; it is the whole reward.
5. **Stages 2 and 3** (ten more buildings), and the stage-crossing moment.
6. **Stages 4 and 5** (nine more), finishing with `Templum Iovis`.
7. **Life** — citizens, smoke, a boat, birds, all inside the suspendable loop.
8. **Retune the XP table** against a week of real lesson data.

Stopping after step 4 still leaves something worth having: a small city that grows for
the first few weeks. Everything after that is extending a working thing, so a
half-finished catalogue is never a broken feature.

---

## 8. Later, if it lands

- **Let her choose** between two or three options at some unlock points. Real agency,
  at the cost of composition control — worth it once the fixed order has proven the
  aesthetic works.
- **Tap a building** to see its Latin name and history again. A voluntary, curiosity
  driven vocabulary list, which is the best kind.
- **A quiet nameplate mode** where each building is labelled in Latin, turning the
  city into a picture dictionary.
- **Export the city as a PNG** she can send to a friend. Almost free with a canvas,
  and it is the only sharing feature this app needs.
