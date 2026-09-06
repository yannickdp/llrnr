# Pixel-Art Roman Buildings — Generation Spec

A self-contained blueprint for rendering animated pixel-art Roman monuments
(temple, colosseum, aqueduct, triumphal arch, forum) on an HTML `<canvas>`.
It is written so an AI or a developer can reproduce the full renderer from this
document alone, and adapt it as gamification art for another project.

Target stack: plain HTML + `<canvas>` 2D + vanilla JS. No libraries, no assets,
no external images — every pixel is drawn from code, which makes the output
deterministic, tiny, themeable, and trivially exportable as sprites.

---

## 1. How to use this spec to generate code

Give an AI this whole file plus a request like:

> "Using the spec, generate a single self-contained `index.html` that renders the
> Roman **temple**. Follow the engine contracts in §3, the palette in §4, the
> pipeline in §5, and the temple recipe in §8.1. Include the day/night system
> (§6) and the fire system (§7)."

Generate **one building at a time** for best results, then ask for the selector
and the combined forum. Each building recipe (§8) is independent and self-contained.

---

## 2. Rendering model

| Setting | Value | Notes |
|---|---|---|
| Logical grid | `N = 64` | The art is authored on a 64×64 pixel grid. |
| Pixel scale | `SCALE = 8` | Each logical pixel = 8 device px. |
| Canvas size | `N * SCALE = 512` | `<canvas width=512 height=512>`. |
| Coordinate origin | top-left | `x` →right, `y` →down. |
| Smoothing | off | `ctx.imageSmoothingEnabled = false`. |
| CSS | `image-rendering: pixelated; width:100%; max-width:512px` | Crisp when scaled on mobile. |

Ground line convention: sky occupies roughly `y 0..49`; the ground/plaza (or
water) occupies `y 50..63`. Buildings stand on `y ≈ 49`.

To change fidelity: pick any `N`, set `SCALE = 512 / N`. Coordinates below are
ratios of 64 — multiply by `N/64` to rescale. Higher `N` = finer detail.

---

## 3. Engine contracts (core helpers)

Every drawing routine is built from these. Reimplement them exactly.

```js
// Paint one logical rectangle (w,h default 1). Null color = no-op (transparent).
function P(x, y, w, h, color) {
  if (!color) return;
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x*SCALE), Math.round(y*SCALE),
               Math.round(w*SCALE), Math.round(h*SCALE));
}

// Deterministic 0..1 noise from integer coords (stable across frames).
function hash(x, y) {
  let h = (x*374761393 + y*668265263) >>> 0;
  h = ((h ^ (h>>13)) * 1274126177) >>> 0;
  return h / 4294967296;
}

// Filled circle with 3-tone shading (upper-left lit, lower-right shadowed).
function blob(cx, cy, r, main, lite, dark) {
  for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++)
    if (dx*dx + dy*dy <= r*r) {
      let col = main;
      if (dx+dy < -r*0.4) col = lite;
      else if (dx+dy > r*0.6) col = dark;
      P(cx+dx, cy+dy, 1, 1, col);
    }
}

// Soft glow behind a lit area: two translucent halos + solid core.
function bloom(lx, ly, lw, lh, color, core, k) {
  const x=lx*SCALE, y=ly*SCALE, w=lw*SCALE, h=lh*SCALE, s=SCALE;
  ctx.save();
  ctx.globalAlpha = 0.15*k; ctx.fillStyle = color; ctx.fillRect(x-3*s,y-3*s,w+6*s,h+6*s);
  ctx.globalAlpha = 0.28*k;                        ctx.fillRect(x-1.5*s,y-1.5*s,w+3*s,h+3*s);
  ctx.globalAlpha = 1;                             ctx.fillRect(x,y,w,h);
  ctx.fillStyle = core;                            ctx.fillRect(x+0.6*s,y+0.6*s,w-1.2*s,h-1.2*s);
  ctx.restore();
}

// THE key Roman primitive: a rounded-top arch opening (semicircle + shaft),
// painted in `col` (usually the interior-shadow color). Reused everywhere.
function arch(cx, topY, w, totalH, col) {
  const r = Math.floor((w-1)/2);
  P(cx-r, topY+r, r*2+1, totalH-r, col);              // rectangular shaft
  for (let dy=0; dy<=r; dy++) {                       // semicircular head
    const dx = Math.round(Math.sqrt(r*r - dy*dy));
    P(cx-dx, topY+r-dy, 2*dx+1, 1, col);
  }
}
```

Two shared, per-frame-reset registries drive the lighting:

```js
let glowTargets = [];  // {x,y,w,h}   lit openings (windows, arch passages, cellae)
let emitters    = [];  // {x,by,size,seed}  fire sources (altars, torches, braziers)
```

Each building function starts by resetting both, then pushes to them as it
places lit openings and flames. The night pass (§6) reads both.

---

## 4. Palette

One coordinated warm-stone palette. Keep these exact for a consistent look;
swap the group values to re-theme (e.g. a "marble → sandstone" reskin).

```
// Marble / stone
marbleLite #f8f4ea  marble #efe9db  marbleShade #d6ccb6  marbleDark #b7ac91
trav       #e6d6b2  travShade #cbb98d  travDark  #a8945f            // travertine
stone      #d8ccae  stoneShade #b7a984 stoneDark #8d7f5f  mortar #c1b48f
arc        #2c281b  arcLite   #4a4330                                // shadow inside arches

// Terracotta roof / metal
tile #b5502f  tileLite #cd6440  tileDark #8c3c22
gold #e6b64a  bronze #6f9c86

// Ground / nature
plaza #cfc2a2  plazaDark #b4a682  weed #7c8a4a
water #4f86a8  waterLite #83b6cd  waterDark #37627d
bank  #6fae4f  bankDark #4f8a3a  hill #8fb08a  hillFar #a9c3aa
cypress #2f5e3a  cypressLite #3f7a49  cypressDark #214a2c

// Figures (for scale)
skin #e0ac7e  toga #efe7d6  tunicR #b5402f  tunicB #3d5f9e

// Fire / light
flameCore #fff2b0  flame #ffab38  flameDeep #f0631f  smoke #c9cccf
glow #ffce74  glowCore #fff3cf

// Sky — day
skyDayTop #7ec8ee  skyDayBot #dff2fb  sun #ffe14d  sunGlow #fff2a8
cloud #ffffff  cloudShad #dbe7ee  bird #3a4a63
// Sky — night
skyNightTop #0e1230  skyNightBot #2c2554  moon #f4f0d8  moonShad #d7d1b2  star #fff6d8
```

**Shading rule of thumb:** every surface gets a *lit* tone (upper/left),
a *base* tone, and a *shadow* tone (lower/right). That three-tone treatment is
what makes flat pixels read as volume. Interiors of all openings use `arc`.

---

## 5. Render pipeline (draw order)

Order matters — later layers paint over earlier ones.

1. **Sky** — vertical gradient, day or night colors.
2. **Celestial (background layer):** day → sun + glow, clouds, birds; **night → moon + stars, drawn HERE**, immediately after the sky and *before* any building. This is essential: because later layers paint over earlier ones, drawing the moon/stars now means the **building occludes them** (moon behind the temple, not floating in front of it).
3. **Background scenery:** distant hills (aqueduct/forum), colonnade backdrop (forum).
4. **Ground:** plaza (temple/colosseum/arch/forum) or water+banks (aqueduct).
5. **The building** — draws its masonry, carves arches, places columns/roof,
   and *registers* `glowTargets` (lit openings) and `emitters` (fires).
6. **Scale props:** cypress trees and figures (drawn in front of the base).
7. **Night pass (if night):** dark tint overlay → bloom every `glowTarget` and
   every `emitter`. **Do NOT draw the moon or stars here** — they belong to
   step 2. (The tint dims the already-drawn moon/stars along with the scene,
   which is correct; lower the tint alpha to ~0.45 if the moon gets too dark.)
8. **Fire:** draw the procedural flame for every emitter (kept above the tint so
   it stays vivid at night).
9. **Smoke:** particles rising from emitters.

> **Night-order rule (common bug):** moon and stars are part of the *background
> sky*, never the foreground night pass. If they render in front of the
> buildings, you drew them after the building — move the `drawMoonStars(t)` call
> to step 2 (right after `drawSky()`), and remove it from the night pass.

---

## 6. Day / night + lighting

```js
let night = false;              // toggled by UI

function drawSky() {
  const g = ctx.createLinearGradient(0,0,0,canvas.height);
  g.addColorStop(0, night ? skyNightTop : skyDayTop);
  g.addColorStop(1, night ? skyNightBot : skyDayBot);
  ctx.fillStyle = g; ctx.fillRect(0,0,canvas.width,canvas.height);
}

// Precompute ~70 stars once: {x, y in 0..25, ph: random phase}.
// Moon + stars are drawn in the BACKGROUND (right after drawSky, before the
// building) so buildings occlude them. The night pass only dims + glows.
function render(t){
  drawSky();
  if (night) drawMoonStars(t);        // <-- background layer, BEHIND the building
  drawBuilding(t);                     // registers glowTargets + emitters
  if (night) nightPass(t);
  drawFlames(t); drawSmoke();
}

function nightPass(t) {
  ctx.fillStyle = "rgba(12,16,44,0.45)";                 // dim everything
  ctx.fillRect(0,0,canvas.width,canvas.height);
  glowTargets.forEach((g,i) =>
    bloom(g.x,g.y,g.w,g.h, glow, glowCore, 0.8 + 0.15*Math.sin(t*2+i)));
  emitters.forEach((e,i) =>
    bloom(e.x-1.5, e.by-e.size*2, 3, e.size*2, glow, glowCore, 0.85 + 0.15*Math.sin(t*5+i)));
  // NO drawMoonStars here — that would paint them over the buildings.
}
```

Day-only glass/openings show `arc`/sky colors; the same opening becomes a warm
`bloom` at night because it was registered in `glowTargets`. That single
registry is why "add a lit window" is one line anywhere.

`drawMoonStars(t)`: for each star, `alpha = 0.35 + 0.65*|sin(t*1.6 + ph)|`; skip
stars overlapping the moon; then `bloom` a pale halo and a `blob` moon with 2–3
`moonShad` crater pixels.

---

## 7. Animation systems

All animation is time-driven (`t` = seconds). **Respect reduced motion:** if
`matchMedia('(prefers-reduced-motion: reduce)').matches`, render one static
frame and skip the loop.

**Loop:**
```js
function loop(now){
  const dt = Math.min(0.05, (now-last)/1000); last = now;
  if (!reduceMotion) updateSmoke(dt, now/1000);
  render(now/1000);
  requestAnimationFrame(loop);
}
```

**Procedural flame** (per emitter) — three stacked teardrop layers, deep→core:
```js
function flameLayer(cx, by, w, h, color, t, seed){
  const rows = Math.max(1, Math.round(h));
  for (let i=0; i<rows; i++){
    const tt = i/rows;                                   // 0 base → 1 tip
    const width = Math.max(1, Math.round(w*(1 - tt*tt)));// tapers upward
    const sway  = Math.round(Math.sin(t*7 + seed + tt*3) * tt * w*0.6);
    P(cx - width/2 + sway, by - i, width, 1, color);
  }
}
function drawFlame(cx, by, s, t, seed){
  const flick = 1 + Math.sin(t*9 + seed)*0.15;
  flameLayer(cx, by, s*2.0, s*3.4*flick, flameDeep, t, seed);
  flameLayer(cx, by, s*1.4, s*2.6*flick, flame,     t, seed+1);
  flameLayer(cx, by, s*0.8, s*1.7*flick, flameCore, t, seed+2);
}
```

**Smoke** (particle system, emitted from each flame tip `by - size*3`):
- Spawn cadence ~every 0.26 s; skip small emitters half the time.
- Particle: `{x, y, vx:(±1), vy:-2.4..-3.4, age, life:2.4..3.4, size:1}`.
- Update: `age += dt; x += (vx + sin(age*2)*1.1)*dt; y += vy*dt; size = 1 + age*1.2`.
- Draw: gray square, `alpha = 0.42*(1 - age/life)`; cull when `age >= life`.

**Water shimmer** (aqueduct): horizontal highlight dashes whose x = function of
`sin(t + y)`, plus wavy reflected pier shadows offset by `sin(t*2 + y*0.6)`.

---

## 8. Building recipes

Coordinates are on the 64 grid. Each recipe: reset `emitters`/`glowTargets`,
draw day celestials if `!night`, draw ground, then the building, then scale props.

### 8.1 Temple (hexastyle, front elevation — Maison Carrée type)

Anatomy, top to bottom: **pediment** (triangle) → **entablature** (horizontal
band) → **6 columns** → **cella wall + doorway** behind them → **podium** with
**front steps** → **altar** with flame, flanked by **torch braziers**.

| Element | x range | y range | Detail |
|---|---|---|---|
| Pediment | 9–53 (triangle, apex x31) | 8–17 | Marble; lighter raking-cornice edges; terracotta `tile` sima along the two rakes; tympanum `marbleShade` with a `gold` rosette; acroterion at apex (x31,y6) and both base corners. |
| Entablature | 10–53 | 17–20 | 3 bands (architrave/frieze/cornice); `marbleShade` top, `marbleDark` bottom; `marbleShade` "triglyph" ticks every 4px on the frieze. |
| Columns ×6 | left edges 12,19,26,33,40,47 (each 3 wide) | 21–43 | See `drawColumn`. |
| Cella wall | 12–49 | 21–43 | Fill with `arcLite` **before** columns so gaps read as depth. |
| Doorway | 28–35 | 29–43 | `arc` (darkest); a `marbleDark` statue silhouette inside; register `glowTargets {28,32,8,11}`. |
| Podium | 10–53 | 44–49 | Marble blocks, `((x+y)&3)==0 ? shade : marble`. |
| Front steps | 21→18 widening | 45–48 | 4 courses, alternating lite/shade. |
| Altar | 29–34 | 46–49 | Emitter `{x:31, by:45, size:2.2}`. |
| Torch braziers ×2 | 15, 48 | 44–49 | `bronze` stand; emitters `{by:42, size:1.2}`. |

```js
function drawColumn(x, top, bot){                 // x = left edge, 3 wide
  P(x-1,bot,5,1,marbleDark); P(x-1,bot-1,5,1,marbleShade);       // base
  for (let y=top+2; y<bot; y++){                                  // fluted shaft
    P(x,y,1,1,marbleLite); P(x+1,y,1,1,marble); P(x+2,y,1,1,marbleShade);
  }
  P(x-1,top+1,5,1,marbleLite); P(x-1,top,5,1,marble);            // capital
  P(x,top+1,1,1,marbleShade); P(x+2,top+1,1,1,marbleShade);      // Corinthian hint
}
```

### 8.2 Colosseum (tiered arcade, partially ruined)

Anatomy: a broad **travertine facade** with **3 tiers of arches** (aligned
columns), **engaged pilasters** between arches, tier **cornices**, an **attic**
storey with small windows, and a **ruined right flank** with **rubble**.

- Facade span `x 6..58`, base `y 49`. Fill each column `x` from `facadeTop(x)`
  to base with checkerboard `trav/travShade` + occasional `travDark` cracks.
- **Ruin driver:** `facadeTop(x)` returns 14 normally, but for `x>38` returns
  `14 + (x-38)*1.5` (plus 1px jagged noise from `hash`). Higher `facadeTop`
  means the wall — and its upper tiers — simply don't exist there.
- **Arch grid:** centers `[8,16,24,32,40,48,56]`, three tiers
  `[{y0:39,h:9},{y0:29,h:8},{y0:20,h:7}]`. For each center+tier, carve
  `arch(cx, y0, 6, h, arc)` **only if** `facadeTop(cx) < y0` (so the ruin auto-
  removes upper arches on the right).
- Pilasters: vertical `travShade` at `x 12,20,28,36,44,52`. Cornices: horizontal
  `travDark` at `y 38,28,19` where wall exists.
- Attic: `y 14–19`; small `arc` windows `2×3` under each center. Rubble:
  ~10 `2×2` `travShade/travDark` blocks scattered at `x 44..60, y 45..49`.
- Fire/light: torch emitters at `x 26,38 (by:46)`; at night register a few
  ground-tier arches as `glowTargets` (torchlit gateway).

### 8.3 Aqueduct (Pont du Gard — three tiers over a river)

Anatomy: **distant hills** → **bottom tier** (few tall wide arches) → **middle
tier** (same pitch, aligned piers) → **top tier** (many small arches) → **specus**
(water channel capstone) on top → **river** with reflection + banks.

| Tier | y band | Arch centers / pitch | Arch size |
|---|---|---|---|
| Bottom | 28–48 | `x 8,24,40,56` | `arch(cx,29,12,H)` tall |
| Middle | 18–27 | `x 8,24,40,56` (aligned) | `arch(cx,19,12,8)` |
| Top | 9–17 | every 5px from x3 | `arch(cx,10,3,7)` small |
| Specus | 7–8 | full width | solid `stoneShade` + `mortar` line |

- Fill each tier band with checkerboard `stone/stoneShade` + `stoneDark` cracks;
  draw `mortar` courses every 3 rows for rustication, then carve the arches.
- **River** `y 48..63`: vertical gradient (`waterLite` near surface → `water`/
  `waterDark`). Reflected piers: short `waterDark` verticals with `sin`-sway.
  Shimmer: moving `waterLite` dashes. At night sprinkle a few reflected `star`
  pixels. Banks: `bank` strips at both bottom corners.

### 8.4 Triumphal Arch (Arch of Constantine type)

Anatomy: a **rectangular marble mass** pierced by a **central large arch** and
**two small side arches**, framed by **4 engaged columns** on pedestals, capped
by an **entablature**, an **attic** with a gilded **inscription panel**, roundel
**reliefs** on the spandrels, and a **quadriga** (chariot + horses) plus corner
statues on top.

| Element | x | y | Detail |
|---|---|---|---|
| Body | 13–50 | 8–49 | Marble blocks; lit top edge, `marbleShade/Dark` right edge. |
| Central arch | cx31, w9 | 24–44 | `arch(31,24,9,20,arc)`; glow `{28,30,6,12}`. |
| Side arches ×2 | cx20, cx43, w5 | 34–44 | `arch(...,5,10,arc)`; glows `{18,36,4,6}`,`{41,36,4,6}`. |
| Columns ×4 | 16,25,38,47 (3 wide) | 25–43 | Fluted like temple; `gold` capital band; pedestal at y44. |
| Entablature | 12–51 | 20–23 | 3 bands. |
| Attic | 14–49 | 9–19 | `marbleShade` inscription panel `20–43,12–16`; `gold` letter ticks every 2px. |
| Roundels | 25,37 | 26 | `2×2 travShade` spandrel reliefs. |
| Quadriga + statues | center + corners | 5–8 | `bronze` chariot group; `marble` corner statues. |
| Braziers ×2 | 12,51 | 45–49 | Emitters `{by:44, size:1.1}`. |

---

## 9. Scale props (figures & foliage)

Small elements sell the monumental scale and add life for gamification.

```js
// Italian cypress: tall dark teardrop, ~3 wide at base.
function drawCypress(x, gy){
  const h = 9 + Math.floor(hash(x,31)*4);
  for (let i=0; i<h; i++){
    const w = Math.max(1, Math.round(3*(1 - i/h)));
    for (let dx=0; dx<w; dx++){
      let c = cypress;
      if (dx===0) c = cypressLite; else if (dx===w-1) c = cypressDark;
      P(x-((w-1)>>1)+dx, gy-i, 1, 1, c);
    }
  }
}

// Toga/tunic figure: ~2 wide, 5 tall, with a subtle walk bob.
function drawFigure(fx, gy, robe, t, seed){
  const y = gy - Math.round(Math.abs(Math.sin(t*3+seed)));  // bob
  P(fx,   y-4, 1, 1, skin);       // head
  P(fx,   y-3, 1, 3, robe);       // body
  P(fx-1, y-2, 1, 1, robe);       // shoulder/arm
  P(fx,   y,   1, 1, stoneDark);  // foot shadow
}
```

Place 3–6 figures per scene on the plaza (`gy ≈ 54..60`) in mixed robes
(`toga`, `tunicR`, `tunicB`) and 2–3 cypresses near the building edges.

---

## 10. Forum scene (all monuments combined)

At 64px a full forum reads best with **simplified silhouettes** side by side,
not full-detail buildings. Draw: a faint **colonnade backdrop** (vertical
`marbleShade` posts every 3px at `y 42..48`), the plaza, then:

- `miniTemple(ox=2)` — small podium + 5 short columns + triangular pediment.
- `miniArch(ox=25)` — 14×14 block with one central `arch` + gilded attic line.
- `miniColosseum(ox=42)` — 20-wide curved block with 2 rows of small arches.
- Cypresses at `x 21, 40, 63`; a central **altar flame** emitter; **torches**
  by the arch; 5–6 figures crossing the plaza.

Each `mini*` is ~15 lines using the same `P`/`arch` helpers at reduced size.

---

## 11. UI & state

- **Building selector:** buttons `Temple / Colosseum / Aqueduct / Arch / Forum`
  set a `building` string; `render()` switches on it. Highlight the active button.
- **Day/Night toggle** + optional **auto-cycle** (`setInterval` flipping `night`
  every ~6 s).
- `render(t)` = pipeline §5, switching the building function on `building`.

---

## 12. Gamification integration notes

- **Sprite export:** because every frame is deterministic code, you can render a
  building at any `night`/`t`, then `canvas.toDataURL()` or `toBlob()` to bake
  PNG sprites (day/night/lit variants) for use in another engine (Unity, MonoGame,
  web). Pause the loop, set state, one `render()`, capture.
- **Offscreen render:** for a game, render to an `OffscreenCanvas` at the logical
  size (64×64) and let the game scale it — keeps memory tiny and pixels crisp.
- **Progression / tiers:** map game progress to `facadeTop` ruin (rebuild the
  colosseum as the player restores it), to lit `glowTargets` (light windows as
  quests complete), or to number of `figures` (population growth).
- **Theming / factions:** swap the palette groups in §4 (marble→sandstone,
  terracotta→slate) to reskin without touching geometry.
- **Determinism:** all randomness comes from `hash(x,y)` and fixed seeds, so a
  given building looks identical every run — safe for cached/shared assets.
- **Performance:** 64×64 logical = ~4k `fillRect` worst case per frame, trivial
  at 60 fps. If you render many buildings, cache static layers to an offscreen
  canvas and only redraw fire/smoke/water each frame.
- **Accessibility:** honor `prefers-reduced-motion` (static frame); keep
  keyboard focus styles on the controls.

---

## 13. Minimal function inventory (checklist)

Engine: `P`, `hash`, `blob`, `bloom`, `arch`.
Sky/celestial: `drawSky`, `drawSun`, `drawCloud`, `drawBird`, `drawMoonStars`.
Grounds: `drawPlaza`, `drawHills`, `drawWater` (inside aqueduct).
Lighting/anim: `nightPass`, `drawFlame`(+`flameLayer`), `updateSmoke`, `drawSmoke`.
Props: `drawCypress`, `drawFigure`.
Buildings: `drawTemple`(+`drawColumn`), `drawColosseum`(+`facadeTop`),
`drawAqueduct`, `drawTriumphArch`, `drawForum`(+`miniTemple`/`miniArch`/`miniColosseum`).
Shell: `render`, `loop`, selector + toggle wiring.

Build in this order: engine → sky/ground → one building → day/night → fire →
remaining buildings → props → forum → UI.

---

## 14. Motivational coach (gamified Pimsleur wait screen)

A companion piece to the buildings: an animated Roman character that appears
during the app's Pimsleur wait (the pause before a new word) and gives spoken
feedback in **Flemish Dutch**, paired with a real **Latin motto + translation**
so the wait doubles as passive review. It reuses the same `P()` pixel engine and
`bloom()`, so the art style matches the XP-reward buildings.

### 14.1 Grid & layout
Portrait bust on a `GRID = 64`, `SCALE = 6` (→ 384) canvas: head `y16–28`,
torso `y31–60`, one raised gesturing arm, one lowered prop arm. The speech text
is **HTML**, not pixels (a styled bubble above the canvas) — keep readable copy
out of the pixel grid.

### 14.2 Characters & XP ranks
Six characters, drawn by one parametric `drawCharacter(type, mood, t, talk, flourish)`
built from `torso` / `arms` / `head` / `headgear`, each switching on `type`. The
character shown scales with the learner's XP — higher XP unlocks higher rank,
**Imperator only at the top**:

| Rank (type) | Min XP | Visual signature |
|---|---|---|
| `servus` (Servus) | 0 | drab exomis (one bare shoulder), cropped dark hair, rope belt |
| `gladiator` (Gladiator) | 120 | crested helmet + nasal guard, bare chest, wide belt, arm `manica`, gladius |
| `centurion` (Centurio) | 350 | iron helmet + transverse red crest, lorica segmentata, red cloak, vitis |
| `magister` (Magister) | 750 | grey hair + beard, plain tunic, holds a scroll |
| `senator` (Senator) | 1600 | toga with purple `clavus` stripe, green laurel wreath |
| `emperor` (Imperator) | 3200 | purple toga + gold trim, **gold** laurel wreath, medallion |

```js
const TIERS = [ {min:0,type:"servus"},{min:120,type:"gladiator"},{min:350,type:"centurion"},
                {min:750,type:"magister"},{min:1600,type:"senator"},{min:3200,type:"emperor"} ];
function tierIndex(xp){ let i=0; for(let k=0;k<TIERS.length;k++) if(xp>=TIERS[k].min) i=k; return i; }
function charForXp(xp){ const top=tierIndex(xp);
  if(top===0 || Math.random()<0.6) return TIERS[top].type;   // usually your current rank
  return TIERS[Math.floor(Math.random()*(top+1))].type;      // sometimes a lower rank, for variety
}
```

**The coach pool grows with XP.** Every rank from Servus up to the current tier
stays in rotation — old coaches remain available — and each new tier simply adds
its coach to the pool. Higher/newer ranks are favored so advancement feels
rewarding, but the learner keeps seeing the whole cast they have earned. (For a
strict "current rank only" feel instead, return `TIERS[tierIndex(xp)].type`.)

### 14.3 Moods
Three moods drive gesture + message + accent color:
- `good` — smile, thumb-up, green aura → praise messages.
- `improve` — raised brows, index-finger-up, warm aura → gentle "try again".
- `perfect` — **victory flourish** (see 14.5) → top praise.

Gestures are one `handG(hx,hy,kind)` with `kind` `"thumb" | "index" | "open"`;
the raised arm uses the character's sleeve material (metal `manica` for the
gladiator).

### 14.4 Messages (Flemish Dutch + Latin)
Each message is `{ nl, la?, tr? }` — Dutch line, optional Latin motto, optional
Dutch translation of the motto. Keep three arrays: `MSG.good`, `MSG.improve`,
`MSG.perfect`. Pairing errors with kind Latin (e.g. *Errare humanum est* —
"Vergissen is menselijk") keeps the improve mood encouraging, never punishing.
Use a couple of Belgicisms ("Allez", "goe bezig") for a native Flemish feel.
Examples: praise → *Veni, vidi, vici*; improve → *Repetitio mater studiorum*;
perfect → *Summa cum laude*. Extend by adding entries to the arrays.

### 14.5 Victory flourish (perfect answers)
On `mood:"perfect"` (or `perfect:true`), trigger `startFlourish()`:
- set `flourishUntil = now + 2s`;
- spawn ~26 gold/laurel/red confetti particles from the character's chest with a
  radial burst (`vx,vy` from a random angle, gravity `vy += 22*dt`, fade with age);
- while flourishing, `drawCharacter` raises **both** arms (open "cheer" hands),
  adds an extra bounce, and boosts the aura to gold.

```js
let flourishUntil=0, parts=[];
function startFlourish(){ flourishUntil=performance.now()/1000+2;
  const cols=[gold,goldL,laurelL,red];
  for(let i=0;i<26;i++){ const a=Math.random()*6.28, sp=8+Math.random()*14;
    parts.push({x:32,y:24,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-6,age:0,life:1.4+Math.random()*0.8,c:cols[i%4]}); } }
// update: age+=dt; vy+=22*dt; x+=vx*dt; y+=vy*dt; cull age>=life
// draw:  alpha = 1-age/life, one pixel per particle
```

### 14.6 Idle life
`prefers-reduced-motion` aware. When motion is allowed: whole-bust breathing
(`sin(t*2)`), periodic blink (`sin(t*1.3) > 0.94`), and mouth "talking" toggling
for ~1.4 s after each new message (`talkUntil`). Reduced motion → static sprite,
but the wait bar still counts down.

### 14.7 Wait timer + host API
The coach owns the Pimsleur wait: a progress bar fills over `waitMs`, then fires
`onComplete` so the host reveals the next word.

```js
romanCoach.present({ mood:'good'|'improve'|'perfect', xp, waitMs, onComplete });
romanCoach.setXp(xp);     // set learner XP → picks the rank shown
romanCoach.setWait(ms);
```

Integration: when a wait begins, call `present({ mood: answeredWell ? 'good' : 'improve',
xp: learnerXp, waitMs: pimsleurDelay, onComplete: revealNextWord })`. For a
flawless answer use `mood:'perfect'`. That way the coach fills exactly the dead
time and hands control back at the end — the wait stops being idle and becomes a
tiny reward + review beat.

### 14.8 Coach function inventory
`P`, `bloom` (shared engine) · `torso`, `head`, `headgear`, `arms`(+`raisedArm`,
`handG`), `drawCharacter` · `startFlourish`/`updateParts`/`drawParts` ·
`TIERS`/`tierIndex`/`charForXp` · `MSG`/`UNLOCK` · `present`/`unlockCelebration`/`setXp`/`setWait` · `lastTier` ·
`stepWait` + loop. Same sprite-export trick from §12 applies: set `type`/`mood`,
render once, `toDataURL()` to bake character sprites for the host engine.

### 14.9 Rank-up unlock celebration
When XP crosses a tier threshold, fire a **one-time** celebration: the newly
unlocked coach appears with a dedicated Dutch+Latin unlock line and a doubled
victory flourish (extra confetti). This is separate from ordinary per-answer
feedback and from the growing pool of 14.2 — the pool is *which* coaches can show
up on a normal wait; the unlock is the *moment* a new one joins.

Detection lives inside `present({xp})`: compare the previous tier to the new one
and persist it in `lastTier` so each threshold fires exactly once. `setXp()`
updates `lastTier` **silently** (no fanfare) so initial loads and manual sets
don't celebrate; only an XP *increase* routed through `present({xp})` triggers it.
`UNLOCK` holds one message per rank (`gladiator`…`emperor`); `servus` is the
starting rank and has none.

```js
const UNLOCK = {
  gladiator:{nl:"Je bent nu Gladiator! Vecht voor je Latijn.", la:"Ad arenam!", tr:"Naar de arena!"},
  centurion:{nl:"Rang behaald: Centurio! Leid je woorden.",    la:"Sequere me", tr:"Volg mij."},
  magister: {nl:"Je bent nu Magister! Ware wijsheid wacht.",   la:"Scientia potentia est", tr:"Kennis is macht."},
  senator:  {nl:"Verheven tot Senator! De stad luistert.",     la:"Pro bono publico", tr:"Voor het algemeen belang."},
  emperor:  {nl:"Ave, Imperator! Je heerst over het Latijn.",  la:"Alea iacta est", tr:"De teerling is geworpen."},
};
let lastTier = 0;

function present(opts={}){
  const mood = opts.mood || "good";
  if (typeof opts.xp === "number") {
    const prev = lastTier;
    currentXp = opts.xp; updateRank();
    const nt = tierIndex(currentXp);
    if (nt > prev) { lastTier = nt; return unlockCelebration(nt, opts); } // crossed → celebrate once
    lastTier = nt;                                                        // same/lower → normal
  }
  /* …normal feedback: charForXp(currentXp) + MSG[mood]… */
}

function unlockCelebration(ti, opts={}){
  const type = TIERS[ti].type, m = UNLOCK[type] || MSG.perfect[0];
  showBubble(NAMES[type], m);          // gold border
  startFlourish(); startFlourish();    // doubled confetti
  startWaitTimer(opts);                // keeps the Pimsleur flow going
}

function setXp(xp){ currentXp = xp; lastTier = tierIndex(xp); updateRank(); }  // silent
```

**Host flow:** call `present({ mood, xp: newTotalXp, waitMs, onComplete })` after
every answer. If that answer pushed the learner over a threshold, the wait screen
automatically becomes the rank-up moment; otherwise it's ordinary feedback drawn
from the full unlocked cast. Use `setXp()` once at session start to seed the
learner's XP without triggering a spurious celebration.
