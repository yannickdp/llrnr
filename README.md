# llrnr

A gamified Latin (and friends) vocabulary trainer, built as an installable PWA.
No build step, no `npm install` — plain HTML, CSS and ES modules.

- Design: [plans/PLAN.md](plans/PLAN.md) · the reward city: [plans/PLAN-ROMA.md](plans/PLAN-ROMA.md)
- Progress: [plans/TODO.md](plans/TODO.md)

## Run it locally

Any static file server works. From the project root:

```sh
npx serve .            # then open the printed http://localhost:3000
# or
python -m http.server  # http://localhost:8000
```

`localhost` counts as a secure origin, so service workers and installability work
there. Opening `index.html` as a `file://` URL does **not** — ES modules are blocked
by CORS. Always go through a server.

### Testing on the iPhone over the LAN

Find the laptop's IP (`ipconfig` on Windows) and open `http://<ip>:3000` on the phone,
with both on the same wifi. Good enough for layout and lesson-flow work, but a plain
`http://` LAN address is not a secure origin: **the service worker will not register
and "Add to Home Screen" will not behave like the real thing.** For anything touching
offline use or installation, deploy and test on the real HTTPS URL.

## Tests

```sh
node --test test/
```

Node's built-in runner, so there is still nothing to install. `parse.js`, and the
scheduler that follows it, are pure functions — they are the parts most likely to be
tuned, and the only parts where a quiet mistake would corrupt her progress rather
than just look wrong. `test/lists.test.mjs` stubs `fetch` with an in-memory set of
files, so the cross-chapter cases (a word revisited, a homograph split over two
chapters) are covered without a server. `test/roma-engine.test.mjs` does the same for
the canvas, recording every `fillRect` against a stub context — for pixel art the
exact position and size of a rectangle is the thing worth asserting, and reading
pixels back off a real canvas would only prove the colour landed somewhere.

### Measuring the XP curve

```sh
node test/xp-curve.mjs [words] [lessons]
```

Not a test — the instrument the city's XP thresholds are tuned against. It drives the
real lesson loop one ten-minute lesson a day with every answer correct, and reports
what XP that actually produces and where the city has got to. Estimating this went
wrong twice: XP per lesson is 20 for the first lesson, ~520 by the fifth and near 1000
once reviews are flowing, so equal XP steps are nowhere near equal waits. Retune by
re-running it, not by arithmetic.

### The city, by eye

Two pages rather than tests, for the parts of the pixel-art city that a passing
assertion cannot vouch for. Open both **on the phone**.

```
test/roma-probe.html     is it crisp?
test/roma-stage1.html    is it any good?
```

The first reports the device pixel ratio and the scale that follows from it, draws a
calibration sprite at each integer scale, and puts a deliberately fractional ×2.5
beside a crisp ×3 so there is something to compare against. Look for soft edges.

The second is the **go/no-go**: stage 1 on the hills with the altar burning, the five
sprites on their own, and the construction-progress reveal. The question it settles is
whether hand-authored pixel art is good enough to carry the reward, or whether the
sprite source should be swapped for a CC0 tileset — which touches `buildings.js` and
nothing else, because everything is behind `draw(ctx, x, groundY, {scale, progress})`.
It carries the throwaway temple too, so the verdict is reached knowing what the engine
can do later.

## Deploy (GitHub Pages)

1. Create an empty GitHub repo and add it as `origin`.
2. Push `main`.
3. Repo → Settings → Pages → Source: *Deploy from a branch*, branch `main`, folder `/`.
4. The site appears at `https://<user>.github.io/<repo>/`.

Updating is one `git push`. HTTPS comes free, which is what the service worker and
home-screen install both require.

`.nojekyll` is committed so Pages serves the files as-is instead of running them
through Jekyll.

### Installing on the iPhone

Open the HTTPS URL in Safari → Share → **Add to Home Screen**. It then launches
full-screen with its own icon. Installing properly also protects `localStorage` from
Safari's 7-day eviction of unused sites — but export the progress JSON now and then
anyway.

## Checking the layout without a phone

Two traps make headless Chrome lie about this app:

1. It **ignores `--window-size` when screenshotting** — it lays the page out at
   500px and crops to whatever you asked for, which looks exactly like a
   horizontal-overflow bug and is not one. Render through a phone-sized iframe.
2. It **takes the screenshot when `load` fires**, and virtual time (`--virtual-time-budget`)
   stops advancing once the lesson's `requestAnimationFrame` loop starts. So a
   lesson never gets past its first five-second step. The fix is to hold `load`
   open with a deliberately slow image, which buys real wall-clock time.

`scratchpad/serve.py` (a `SimpleHTTPRequestHandler` with one extra route,
`/__slow?ms=N`, that sleeps before replying) plus a `_shot.html` harness beside
`index.html` cover both. The harness loads `index.html` in a 390x844 iframe,
holds `load` open for `?hold=`ms, and then walks a comma-separated `?click=`
list of steps against the iframe document:

| Step | Does |
|---|---|
| `<css selector>` | waits for it, then clicks it |
| `until:<selector>` | waits for it to appear |
| `wait:<ms>` | sleeps |
| `type:<text>` | fills the answer field and submits it |

Neither file is committed; both are a few lines to retype.

```sh
chrome --headless --disable-gpu --hide-scrollbars --force-prefers-reduced-motion   --screenshot=lesson.png --window-size=390,844   'http://localhost:8124/_shot.html?hold=14000&click=[data-goto="start"],%23start-lesson'
```

Escape `#` as `%23` in that URL, or everything after it is parsed as a fragment
and the rest of the click list is silently dropped. Attach the harness to the
**iframe's** load event, not the parent's `DOMContentLoaded`: at that point the
iframe is still `about:blank`, and the steps race the real document.
`--force-prefers-reduced-motion` freezes the sheet animation, which would
otherwise be caught mid-slide.
