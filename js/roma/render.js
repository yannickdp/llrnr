/* render.js — the scene: sky, hills, ground, buildings, and what moves.

   This file knows how to paint the city and nothing about what any of it
   means. It never reads a Latin name and never decides what is unlocked; it is
   handed a list of ids and paints them at the slots the catalogue gives. That
   is the seam that lets the art be swapped for a CC0 tileset without the
   progression noticing.

   The one structural idea worth stating up front: the scene splits into a
   layer that changes only when a building unlocks, and a layer that changes
   every frame.

   The static half is the sky, the celestials, the hills, the ground and every
   finished building — around 17 700 rectangles for the completed city, and no
   reason at all to repaint them sixty times a second for the sake of one flame.
   It is cached to an offscreen canvas and blitted. The animated half is the
   water, a boat, the citizens, birds, the night tint with its blooms and the
   seven fires: 200 rectangles by day, 290 by night. Measured, that is a ratio
   of about 1:70, and it is the whole argument for the cache.

   Order in the animated pass is the spec's pipeline and each step earns its
   place: scenery first so the night tint dims it, then the tint, then the
   blooms, then fire and smoke on top so they stay vivid — a flame that dims at
   night looks painted on, when the entire point of it is that it is the light.

   Reduced motion is honoured by simply never running the animated pass: the
   city is a static picture, which is what it mostly is anyway. */

import { C, T } from './palette.js';
import {
  painter, fitCanvas, chooseScale, drawFlame, drawCypress, drawFigure, smokeField, hash,
} from './engine.js';
import { SCENE, BANDS, BY_ID, inDrawOrder } from './catalogue.js';
import { SPRITES } from './buildings.js';

/* ============================================================== sky ====== */

/**
 * A vertical gradient, day or night. The only place in the city that is not
 * made of rectangles, because a gradient is what a sky is.
 */
export function drawSky(g, { night = false } = {}) {
  const { ctx, scale } = g;
  const grad = ctx.createLinearGradient(0, 0, 0, SCENE.h * scale);
  grad.addColorStop(0, night ? C.skyNightTop : C.skyDayTop);
  grad.addColorStop(1, night ? C.skyNightBot : C.skyDayBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SCENE.w * scale, SCENE.h * scale);
}

/* ======================================================== day / night ==== */

/**
 * Is it dark out?
 *
 * Driven by the real clock rather than by a timer, which is the whole point:
 * homework happens in the evening, so if the city is lit up with the Vesta
 * flame and torchlit arcades when she opens it after dinner, and sunlit on a
 * Sunday afternoon, the city feels like a place that carries on existing while
 * she is not looking. An auto-cycling toggle would undo exactly that.
 *
 * Seasonal, because it is four lines and because in Belgium it is dark at five
 * in December and light at ten in June — a fixed 19:00 cutoff would have the
 * city sunlit on a black December afternoon, which is the opposite of the
 * effect. The constants approximate Brussels; there is one user and she lives
 * there.
 *
 * @param {Date|number} [when]
 * @returns {boolean}
 */
export function isNight(when = Date.now()) {
  const date = when instanceof Date ? when : new Date(when);
  const dayOfYear = Math.floor((date - new Date(date.getFullYear(), 0, 0)) / 86_400_000);
  const season = Math.cos((2 * Math.PI * (dayOfYear - 172)) / 365);

  const sunrise = 7.1 - 1.6 * season;
  const sunset = 19.3 + 2.6 * season;
  const hour = date.getHours() + date.getMinutes() / 60;

  return hour < sunrise || hour >= sunset;
}

/* Stars, placed once from `hash` so the constellations are the same every
   night. They do not twinkle, and that is a decision rather than an omission:
   anything behind the buildings has to live in the cached static layer, and a
   twinkle would mean either drawing stars *over* the city — the night-order bug
   §6 warns about — or keeping a second cache just for a flicker. */
const STARS = Array.from({ length: 70 }, (_, i) => ({
  x: Math.round(hash(i, 11) * SCENE.w),
  y: Math.round(hash(i, 23) * 44),
  bright: hash(i, 37) > 0.6,
}));

const CLOUDS = [
  { x: 74, y: 20, w: 26 }, { x: 208, y: 32, w: 34 },
  { x: 330, y: 16, w: 22 }, { x: 452, y: 28, w: 30 },
];

const SUN = { x: 96, y: 30 };
const MOON = { x: 468, y: 28 };

/**
 * Sun and clouds by day, moon and stars by night.
 *
 * **This is a background layer.** PLAN-ROMA §6 is emphatic and it is the one
 * ordering mistake in the whole renderer worth naming: the moon belongs behind
 * the city, drawn between the sky and the hills, so the buildings occlude it.
 * Painted in the night pass instead it floats in front of the Pantheon, which
 * looks like a bug because it is one.
 */
export function drawCelestial(g, { night = false } = {}) {
  if (night) {
    for (const star of STARS) {
      g.dot(star.x, star.y, star.bright ? C.star : C.moonShad);
    }
    g.bloom(MOON.x - 5, MOON.y - 5, 11, 11, C.glow, C.glowCore, 0.35);
    g.blob(MOON.x, MOON.y, 5, C.moon, C.star, C.moonShad);
    g.dot(MOON.x - 2, MOON.y + 1, C.moonShad);
    g.dot(MOON.x + 2, MOON.y - 2, C.moonShad);
    return;
  }

  g.bloom(SUN.x - 4, SUN.y - 4, 9, 9, C.sunGlow, C.sun, 0.5);
  g.blob(SUN.x, SUN.y, 4, C.sun, C.sunGlow, C.sun);

  for (const cloud of CLOUDS) {
    const half = Math.round(cloud.w / 2);
    g.P(cloud.x - half, cloud.y, cloud.w, 2, C.cloud);
    g.P(cloud.x - half + 3, cloud.y - 2, cloud.w - 6, 2, C.cloud);
    g.P(cloud.x - half + 1, cloud.y + 2, cloud.w - 2, 1, C.cloudShad);
    g.dot(cloud.x - half + 5, cloud.y - 3, C.cloud);
  }
}

/**
 * The night pass: dim everything, then bloom every light the buildings
 * registered.
 *
 * Runs per frame over the blitted city rather than into the cache, so the
 * blooms can pulse — and it deliberately does **not** draw the moon or the
 * stars. Those are `drawCelestial`'s, in the background, where the tint dims
 * them along with the rest of the scene. That is correct; the alpha is 0.45
 * rather than the spec's first-draft 0.55 so the moon does not go muddy.
 */
export function nightPass(g, lights, t) {
  const { ctx, scale } = g;
  ctx.save();
  ctx.fillStyle = 'rgba(12, 16, 44, 0.45)';
  ctx.fillRect(0, 0, SCENE.w * scale, SCENE.h * scale);
  ctx.restore();

  lights.glowTargets.forEach((light, i) => {
    g.bloom(light.x, light.y, light.w, light.h, C.glow, C.glowCore,
      0.8 + 0.15 * Math.sin(t * 2 + i));
  });
  lights.emitters.forEach((fire, i) => {
    g.bloom(fire.x - 1.5, fire.by - fire.size * 2, 3, fire.size * 2, C.glow, C.glowCore,
      0.85 + 0.15 * Math.sin(t * 5 + i));
  });
}

/* ============================================================ hills ====== */

/* The three hills that matter, placed under the stages that belong to them:
   the Palatine over the huts at the left end, the Aventine behind the Circus,
   the Capitoline at the right where the temple of Jupiter is the capstone.
   Rome had seven; drawing seven at this width would be a lumpy horizon. */
const HILLS = [
  { name: 'Palatinus', cx: 62, halfW: 78, rise: 30 },
  { name: 'Aventinus', cx: 340, halfW: 92, rise: 24 },
  { name: 'Capitolinus', cx: 522, halfW: 74, rise: 36 },
];

/** Where the far range sits at a given column — two sine waves, so it wanders. */
function rangeTop(x) {
  return BANDS.far.groundY - 10 - Math.sin(x / 37) * 6 - Math.sin(x / 13) * 3;
}

/**
 * The backdrop. A far range in the pale tone, then the three named hills in
 * the near tone with a lit rim along the top — which is the three-tone rule
 * doing the only thing that separates a hill from a green triangle.
 */
/* What each stage adds to the skyline.
 *
 * PLAN-ROMA §7 asks for the hills to gain a detail when she crosses into a new
 * era, so the backdrop marks the passage of time and not only the foreground.
 * Cheap, and it means a stage crossing changes something she will still see on
 * every visit afterwards — the Latin name on the results card is a moment, this
 * is a permanent one. Cumulative: stage 3 keeps what stages 1 and 2 added.
 *
 * Each era names the hill it belongs on. It used to pick one with `era % 3`,
 * which is how the aqueduct ended up marching across the Palatine directly
 * above Romulus's huts and the crowning temple ended up on the Aventine —
 * reported from the phone, accurately, as buildings standing a bit odd.
 *
 * And every one of them now sits *on* the ridge. Two were floating: the
 * arcade by two rows and the temple by one, which at this scale is the whole
 * difference between a building on a hill and a building above one. */
const HILL_DETAIL = [
  /* Roma Quadrata — bare hills, a shepherd's landscape. */
  { hill: 0, draw: () => {} },

  /* Regnum — cypresses take the Palatine, the oldest of the hills. */
  {
    hill: 0,
    draw(g, hill, farGround) {
      for (let i = 0; i < 3; i++) {
        const x = Math.round(hill.cx + (hash(hill.cx, i) - 0.5) * hill.halfW * 1.4);
        if (x < 2 || x > SCENE.w - 3) continue;
        drawCypress(g, x, ridgeAt(hill, x, farGround));
      }
    },
  },

  /* Res Publica — a farmstead on the slope below the Capitoline citadel.
     It began on the Aventine, which is the better history — that was the
     plebeian hill and still half countryside — but by stage 4 the real
     aqueduct stands across the Aventine's crown and by stage 5 the baths
     stand across its flank, so the farm was buried twice over. The Palatine
     and the Capitoline are the only two crowns that stay clear of the mid
     band all the way to the end, and the Palatine is spoken for. */
  {
    hill: 2,
    draw(g, hill, farGround) {
      const x = Math.round(hill.cx - hill.halfW * 0.55);
      const gy = ridgeAt(hill, x, farGround);
      g.P(x, gy - 2, 6, 3, C.marbleShade);
      g.P(x - 1, gy - 4, 8, 2, C.tileDark);
    },
  },

  /* Imperium — arches stepping down the Aventine's flank toward the real
     aqueduct, which stands in the far band just to their right. An aqueduct
     crosses valleys and comes down off high ground; one sitting on a hilltop,
     which is what this drew before, is not a thing that happens. */
  {
    hill: 1,
    draw(g, hill, farGround) {
      for (let i = 0; i < 4; i++) {
        const cx = hill.cx - 84 + i * 12;
        const gy = ridgeAt(hill, cx, farGround);
        g.P(cx - 5, gy - 5, 11, 6, C.stoneShade);
        g.arch(cx, gy - 4, 5, 5, C.hillFar);
        g.P(cx - 6, gy - 6, 13, 1, C.stone);
      }
    },
  },

  /* Roma Aeterna — the imperial palace, back on the Palatine. Which is where
     the word palace comes from, and it is the right note to end the skyline
     on: the emperors built over the hill Romulus's hut stands on, and at this
     stage both are on screen at once.
     Deliberately not a temple: `Templum Iovis` is a hero building in the mid
     band directly in front of the Capitoline by now, and a second temple
     silhouette stacked above it would read as a duplicate. */
  {
    hill: 0,
    draw(g, hill, farGround) {
      const cx = hill.cx + 26;
      const gy = ridgeAt(hill, cx, farGround);
      g.P(cx - 11, gy - 6, 22, 7, C.marbleShade);
      g.P(cx - 11, gy - 7, 22, 1, C.marble);
      g.P(cx - 12, gy - 9, 24, 2, C.tileDark);
      for (let i = 0; i < 6; i++) g.dot(cx - 9 + i * 4, gy - 4, C.arcLite);
      g.dot(cx, gy - 10, C.gold);
    },
  },
];

/** The ridge row of a hill at a given column. */
function ridgeAt(hill, x, farGround) {
  const u = (x - hill.cx) / hill.halfW;
  return Math.round(farGround - hill.rise * (1 - u * u));
}

/**
 * @param {object} g
 * @param {object} [options]
 * @param {number} [options.stage]  0..4; each era adds to the skyline
 */
export function drawHills(g, { stage = 0 } = {}) {
  const farGround = BANDS.far.groundY;
  const midGround = BANDS.mid.groundY;

  /* The distant range, and it fills all the way down to the mid street.
     It used to stop two rows under the far band's own ground line, which left
     bare sky between the named hills from row 128 to 149 — a hole in the
     ground with the sky showing through it, reported from the phone as "blue
     rectangles between the hills". The backdrop is one continuous landmass
     from the skyline to the street; the named hills draw over it in the nearer
     tone, and the far band's ground line is only where far buildings stand. */
  for (let x = 0; x < SCENE.w; x++) {
    const top = Math.round(rangeTop(x));
    g.P(x, top, 1, midGround - top, C.hillFar);
  }

  /* The named hills, as parabolas. Anything more elaborate is invisible at
     this size.

     Speckled rather than checkerboarded. `course` is the right texture for a
     masonry wall a few pixels across, and quite wrong here: over a slope
     thirty rows deep its one-in-four diagonal reads as a rug, not as ground.
     A sparse scatter from `hash` is what a hillside looks like, and it is
     stable between renders for the same reason everything else is. */
  for (const hill of HILLS) {
    for (let x = hill.cx - hill.halfW; x <= hill.cx + hill.halfW; x++) {
      if (x < 0 || x >= SCENE.w) continue;
      const u = (x - hill.cx) / hill.halfW;
      const top = Math.round(farGround - hill.rise * (1 - u * u));
      if (top >= farGround) continue;

      g.P(x, top, 1, midGround - top, C.hill);
      for (let y = top + 1; y < midGround; y++) {
        const n = hash(x, y);
        if (n > 0.93) g.dot(x, y, C.weed);
        else if (n < 0.07) g.dot(x, y, C.hillFar);
      }
      /* Lit rim: brighter where the slope faces up and left. */
      g.dot(x, top, u < 0.35 ? C.hillFar : C.hill);
    }
  }

  /* Everything each era has added, oldest first, one hill each so the three
     do not all sprout the same thing. Positions come from `hash`, so the
     skyline is varied and identical every time she opens the app. */
  for (let era = 0; era <= stage; era++) {
    const detail = HILL_DETAIL[era];
    if (detail) detail.draw(g.hazed(FAR_HAZE * 0.6), HILLS[detail.hill], farGround);
  }
}

/* =========================================================== ground ====== */

/**
 * The earth each band stands on, and the Tiber along the bottom edge.
 *
 * Sprites never paint their own ground — a building that did would sit on a
 * visible seam, and the same sprite has to work in any band.
 */
export function drawGround(g) {
  const mid = BANDS.mid.groundY;
  const near = BANDS.near.groundY;

  /* The plaza, from the mid street down to the near one.
     Flat fill plus a sparse scatter of the shadow tone and the odd weed. The
     first version checkerboarded it with `course`, which is right for a wall
     and badly wrong for an expanse this size — five hundred pixels of
     one-in-four diagonal reads as a woven rug under the whole city. */
  g.P(0, mid, SCENE.w, near + 4 - mid, T.plaza.base);
  for (let x = 0; x < SCENE.w; x++) {
    for (let y = mid + 1; y < near + 4; y++) {
      const n = hash(x + 977, y);
      if (n > 0.94) g.dot(x, y, T.plaza.shadow);
      else if (n < 0.03) g.dot(x, y, C.weed);
    }
  }

  /* A kerb where the near street starts, so the two levels read as two. */
  g.P(0, near, SCENE.w, 1, T.plaza.shadow);

  /* The Tiber. Its highlights move, so it is drawn by the animated pass; this
     is the still water underneath it. */
  const water = near + 4;
  for (let y = water; y < SCENE.h; y++) {
    const shade = y < water + 2 ? T.water.lit : y < water + 7 ? T.water.base : T.water.shadow;
    g.P(0, y, SCENE.w, 1, shade);
  }
  for (let x = 0; x < SCENE.w; x++) g.dot(x, water - 1, C.bankDark);
}

/* ======================================================== buildings ====== */

/* How far the far band is pulled toward the hill colour. Enough to read as
   distance, not so much that a stone wall turns green. */
const FAR_HAZE = 0.42;

/**
 * Paint a set of buildings at their slots.
 *
 * @param {object} g          painter
 * @param {string[]} ids      which buildings exist
 * @param {object} [options]
 * @param {Object<string, number>} [options.progress]  id to 0..1, for anything
 *   still under construction; missing means finished
 * @returns {string[]} the ids that had a sprite and were actually drawn
 */
export function drawBuildings(g, ids, { progress = {} } = {}) {
  const wanted = new Set(ids);
  const drawn = [];

  for (const entry of inDrawOrder()) {
    if (!wanted.has(entry.id)) continue;
    const sprite = SPRITES[entry.id];
    if (!sprite) continue;                       // not authored yet; simply absent

    const p = progress[entry.id] ?? 1;
    /* The far band is hazed toward the hills, which is all the "reduced
       detail" treatment PLAN-ROMA §5 asks for and rather better than actually
       drawing less: the same sprite could stand in any band and the band
       decides how distant it looks. */
    const shared = entry.band === 'far' ? g.hazed(FAR_HAZE) : g;

    sprite.draw(g.ctx, entry.x, BANDS[entry.band].groundY, {
      scale: g.scale,
      progress: p,
      /* One shared set of light registries for the whole scene, so the night
         pass reads twenty-five buildings' lights in one list — but only from
         finished ones. Handing an unfinished building the shared painter would
         let it register a fire it has not built the altar for yet; letting it
         make its own throwaway painter suppresses that, and dropping those
         registrations is exactly what should happen to them. */
      painter: p >= 1 ? shared : undefined,
    });
    drawn.push(entry.id);
  }

  return drawn;
}

/* ============================================================= life ====== */

/* Everything in this section moves, so none of it can live in the cached
   static layer. It is also the cheapest part of the whole renderer: a dozen
   figures, four birds and a boat come to maybe eighty rectangles a frame
   against the seventeen thousand the city itself costs. That ratio is the
   entire argument for the cache. */

const ROBES = [C.toga, C.tunicR, C.tunicB, C.toga];

/**
 * The citizens, and the second reading of progress the plan asks for: the
 * crowd grows as she learns words, so a busy street means a full vocabulary.
 * Capped, because past a dozen it stops registering as growth and starts
 * being a queue.
 *
 * Positions come from `hash`, so the same citizen is always in the same place
 * and only the walk bob moves. Adding the thirteenth word does not shuffle the
 * other twelve people.
 */
export function drawCitizens(g, learned, t) {
  const count = Math.min(12, Math.max(2, Math.round(learned / 8) + 2));
  const groundY = BANDS.near.groundY;

  for (let i = 0; i < count; i++) {
    const x = 24 + Math.round(hash(i, 71) * (SCENE.w - 60));
    const drift = Math.round(Math.sin(t * 0.35 + i * 1.7) * 6);
    drawFigure(g, x + drift, groundY, ROBES[i % ROBES.length], t, i * 1.3);
  }
}

/**
 * A boat on the Tiber, working its way upstream and round again.
 *
 * Rome was a river port before it was anything else — the whole reason the
 * city is where it is, at the first crossing point upstream of the sea.
 */
export function drawBoat(g, t) {
  const { P, dot } = g;
  const waterline = BANDS.near.groundY + 8;
  const x = Math.round(((t * 5) % (SCENE.w + 60)) - 30);
  const bob = Math.round(Math.sin(t * 1.6)) - 1;
  const y = waterline + bob;

  P(x, y, 14, 2, C.scaffold);                    // hull
  P(x + 1, y - 1, 12, 1, C.scaffoldLite);        // gunwale
  P(x + 6, y - 8, 1, 8, C.scaffoldLite);         // mast
  P(x + 7, y - 7, 5, 5, C.toga);                 // sail
  dot(x + 3, y - 2, C.tunicR);                   // and someone sailing it
}

/**
 * Birds. Four of them, in a loose skein, each a two-pixel chevron that flaps.
 * Three pixels of bird is enough for the eye to finish the job.
 */
export function drawBirds(g, t) {
  for (let i = 0; i < 4; i++) {
    const x = Math.round(((t * 7 + i * 37) % (SCENE.w + 40)) - 20);
    const y = 18 + i * 5 + Math.round(Math.sin(t * 0.9 + i) * 3);
    const up = Math.sin(t * 6 + i * 2) > 0;
    g.dot(x, y, C.bird);
    g.dot(x - 1, y + (up ? -1 : 1), C.bird);
    g.dot(x + 1, y + (up ? -1 : 1), C.bird);
  }
}

/**
 * The Tiber's surface: highlight dashes sliding along, and the reflections of
 * whatever stands in the water wobbling underneath them.
 */
export function drawWater(g, t) {
  const { P, dot } = g;
  const top = BANDS.near.groundY + 4;

  for (let y = top; y < SCENE.h; y += 3) {
    const phase = Math.sin(t * 0.8 + y * 0.7);
    for (let i = 0; i < 9; i++) {
      const x = Math.round((i * 63 + phase * 14 + y * 5) % SCENE.w);
      P(x, y, 5, 1, T.water.lit);
    }
  }

  /* Reflected piers, swaying. Only the bridge and the drain stand in the
     water, so this is a short list by construction. */
  for (const id of ['pons-sublicius', 'cloaca-maxima']) {
    const entry = BY_ID[id];
    for (let cx = entry.x + 2; cx < entry.x + entry.w; cx += 6) {
      const sway = Math.round(Math.sin(t * 2 + cx * 0.6));
      for (let y = top + 1; y < SCENE.h; y += 2) {
        dot(cx + sway, y, T.water.shadow);
      }
    }
  }
}

/* ============================================================ scene ====== */

/**
 * The whole city, still. Everything here changes only when a building unlocks,
 * which is why it can be painted once into an offscreen canvas and then
 * blitted for free.
 *
 * @returns {object} the painter used, carrying the light and fire registries
 *   that the animated pass and the night pass read
 */
export function drawStatic(g, ids, options = {}) {
  drawSky(g, options);
  /* Celestials here, between the sky and the hills — never in the night pass.
     See drawCelestial and PLAN-ROMA §6. */
  drawCelestial(g, options);
  drawHills(g, options);
  drawGround(g);
  drawBuildings(g, ids, options);
  return g;
}

/* ======================================================= scaffolding ===== */

/**
 * Scaffolding over a building that is still going up.
 *
 * The teaser is a construction site rather than a dim silhouette, and this is
 * what says so. Without it a half-drawn building just looks like a bug — a
 * chopped-off temple — where poles and a plank read as *not finished yet*,
 * which is the entire message.
 *
 * Drawn only strictly between 0 and 1, so a finished building never carries it.
 */
export function drawScaffold(g, entry, progress) {
  if (!(progress > 0) || progress >= 1) return;

  const { x, w, band } = entry;
  const groundY = BANDS[band].groundY;

  /* The sprite's own height when it exists, and a plausible one when it does
     not. Most of the catalogue is unauthored until 4b.4, and the teaser still
     has to read as a plot with work happening on it. */
  const height = SPRITES[entry.id]?.h ?? Math.min(28, Math.round(w * 0.8));
  const built = Math.max(1, Math.round(height * progress));
  const top = groundY - height;

  /* Two uprights just outside the footprint, so they frame the work rather
     than hide it, and a plank at the top of the frame. */
  for (const px of [x - 1, x + w]) {
    g.P(px, top, 1, groundY - top + 1, C.scaffold);
  }
  g.P(x - 1, top, w + 2, 1, C.scaffold);

  /* A working platform at the height the build has actually reached. This is
     the part that moves between lessons, and the reason the teaser is worth
     more than a silhouette. */
  g.P(x - 1, groundY - built, w + 2, 1, C.scaffoldLite);
}

/* ============================================================= a view ==== */

/**
 * A view onto the city, bound to one canvas.
 *
 * The scene is 560 logical pixels wide and a phone is not, so a view shows a
 * window onto it and pans. The static layer — sky, hills, ground, finished
 * buildings — is cached at full scene width once per unlock; the window is a
 * blit out of that cache, which makes panning free. Only fire and smoke are
 * repainted per frame.
 *
 * Two of these exist at once: the Home hero and the unlock moment on the
 * Results screen. That is exactly why the painter is bound per canvas rather
 * than being module-global.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} [options]
 * @param {number} [options.view]    logical width of the window; default the whole scene
 * @param {number} [options.scale]   omit to fit the element's width
 * @param {boolean} [options.motion] false for a still frame (reduced motion)
 * @returns {object} the view
 */
export function createScene(canvas, {
  view = SCENE.w, scale, motion = true, night = isNight(),
} = {}) {
  const viewW = Math.min(view, SCENE.w);
  const chosen = scale ?? chooseScale(viewW, canvas.clientWidth || viewW);
  const ctx = fitCanvas(canvas, { w: viewW, h: SCENE.h, scale: chosen });
  const dpr = canvas.width / (viewW * chosen);

  const smoke = smokeField();
  let cache = null;         // the whole scene, as an offscreen canvas
  let lights = { glowTargets: [], emitters: [] };
  let ids = [];
  let progress = {};
  let stage = 0;
  let learned = 0;
  let live = null;          // {id, progress} drawn per frame, not cached
  let panX = 0;
  let panTarget = 0;
  let running = false;
  let last = 0;

  const maxPan = Math.max(0, SCENE.w - viewW);
  const clampPan = x => Math.min(maxPan, Math.max(0, x));

  /** Repaint the static layer. Called on unlock, not per frame. */
  function invalidate() {
    /* OffscreenCanvas landed in Safari 16.4, which is the floor this app
       already assumes — but a cache is an optimisation, and an optimisation
       that can throw is worse than none. A plain detached canvas caches just
       as well. */
    const w = Math.round(SCENE.w * chosen * dpr);
    const h = Math.round(SCENE.h * chosen * dpr);
    const off = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const offCtx = off.getContext('2d');
    offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    offCtx.imageSmoothingEnabled = false;

    const g = painter(offCtx, chosen);
    const shown = live ? ids.filter(id => id !== live.id) : ids;
    drawStatic(g, shown, { night, progress, stage });

    /* Scaffolding over whatever is under construction. */
    for (const [id, p] of Object.entries(progress)) {
      const entry = BY_ID[id];
      if (entry && p > 0 && p < 1) drawScaffold(g, entry, p);
    }

    lights = { glowTargets: [...g.glowTargets], emitters: [...g.emitters] };
    cache = off;
  }

  /** Blit the visible slice of the cache, then paint what moves. */
  function paint(t) {
    const sliceX = Math.round(panX * chosen * dpr);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (cache) {
      ctx.drawImage(cache, sliceX, 0, canvas.width, canvas.height,
        0, 0, canvas.width, canvas.height);
    }
    ctx.restore();

    /* Everything after this is in scene coordinates, shifted by the pan. */
    ctx.save();
    ctx.translate(-panX * chosen, 0);
    const g = painter(ctx, chosen);

    /* The building being revealed is drawn here rather than cached, because it
       changes every frame for the ~800 ms the reveal lasts. */
    if (live) {
      const entry = BY_ID[live.id];
      const sprite = SPRITES[live.id];
      if (entry && sprite) {
        sprite.draw(ctx, entry.x, BANDS[entry.band].groundY, {
          scale: chosen,
          progress: live.progress,
          /* Same rule as the static pass: it lights up on the frame it is
             finished, not while it is still rising. Which is the right moment
             anyway — the altar catching is the end of the animation. */
          painter: live.progress >= 1 ? g : undefined,
        });
      }
    }

    /* The spec's pipeline, with everything that does not move already baked
       into the blit above. Order matters and each step earns its place:
       the scenery goes down first so the night tint dims it, then the tint,
       then the lights, and fire and smoke last so they stay vivid against it —
       a flame that dims at night looks painted on, when the whole point of it
       is that it is the light source. */
    if (motion) {
      drawWater(g, t);
      drawBoat(g, t);
      drawCitizens(g, learned, t);
      drawBirds(g, t);
    }

    const allLights = {
      glowTargets: [...lights.glowTargets, ...g.glowTargets],
      emitters: [...lights.emitters, ...g.emitters],
    };
    if (night) nightPass(g, allLights, t);

    for (const emitter of allLights.emitters) drawFlame(g, emitter, t);
    smoke.draw(g);
    ctx.restore();
  }

  return {
    get scale() { return chosen; },
    get lights() { return lights; },
    get pan() { return panX; },
    get viewWidth() { return viewW; },

    /* The app never sets this — it comes from the clock, and a switch on the
       Home hero would undo the point of that. It is settable for the viewer
       page, which has to be able to show both halves on demand. */
    get night() { return night; },
    set night(value) {
      night = Boolean(value);
      invalidate();
      paint(0);
    },

    /**
     * Which buildings exist, how far along any unfinished one is, and which era
     * the skyline should show.
     *
     * @param {string[]} nextIds
     * @param {object} [options]
     * @param {Object<string, number>} [options.progress]
     * @param {number} [options.stage]  0..4; the hills gain a detail per era
     */
    show(nextIds, {
      progress: nextProgress = {}, stage: nextStage = stage, learned: nextLearned = learned,
    } = {}) {
      ids = [...nextIds];
      progress = nextProgress;
      stage = nextStage;
      learned = nextLearned;
      invalidate();
      paint(0);
    },

    /** Move the window. Clamped, so it can be handed a raw building x. */
    panTo(x, { animate = false } = {}) {
      panTarget = clampPan(x);
      if (!animate || !motion) {
        panX = panTarget;
        paint(0);
      }
      return panTarget;
    },

    /** Centre the window on a slot, which is what a caller actually wants. */
    focus(entry, options) {
      return this.panTo(entry.x + entry.w / 2 - viewW / 2, options);
    },

    /**
     * The unlock moment: pan to the slot, then complete the building from the
     * ground up.
     *
     * Resolves when it has finished, so a lesson that landed two buildings can
     * await them one after another rather than playing both at once.
     *
     * @param {object} entry     catalogue entry
     * @param {object} [options]
     * @param {number} [options.duration]  ms; PLAN-ROMA section 7 says ~800
     * @returns {Promise<void>}
     */
    async reveal(entry, { duration = 800 } = {}) {
      /* Reduced motion gets the finished building and no animation at all —
         it is a celebration, not information, so there is nothing to lose. */
      if (!motion) {
        live = null;
        ids = [...new Set([...ids, entry.id])];
        this.focus(entry);
        this.show(ids, { progress, stage });
        return;
      }

      this.focus(entry);
      live = { id: entry.id, progress: 0 };
      ids = [...new Set([...ids, entry.id])];
      invalidate();

      await new Promise(resolve => {
        const started = performance.now();
        const step = now => {
          const p = Math.min(1, (now - started) / duration);
          live.progress = p;
          paint(now / 1000);
          if (p < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });

      /* Fold it into the cache now that it is finished, so the per-frame path
         goes back to fire and smoke only. */
      live = null;
      invalidate();
      paint(0);
    },

    /** One frame, for a caller driving its own loop. */
    frame(t, dt = 0) {
      if (motion && dt > 0) smoke.update(dt, lights.emitters);
      paint(motion ? t : 0);
    },

    /**
     * Run the animated pass. Suspended on `visibilitychange` and by an
     * IntersectionObserver by the caller: on a phone, a render loop nobody is
     * looking at is just battery.
     */
    start() {
      if (running || !motion) {
        if (!motion) paint(0);
        return;
      }
      running = true;
      last = performance.now();
      const tick = now => {
        if (!running) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        smoke.update(dt, lights.emitters);
        /* Ease toward the pan target, so a jump to a new building glides. */
        if (Math.abs(panTarget - panX) > 0.4) panX += (panTarget - panX) * 0.12;
        else panX = panTarget;
        paint(now / 1000);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },

    stop() {
      running = false;
    },
  };
}

/* Re-exported so a caller needs one import to place a citizen or a tree. */
export { drawCypress, drawFigure };
