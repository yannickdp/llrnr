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
chapters) are covered without a server.

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

Headless Chrome ignores `--window-size` when taking a screenshot, so it lays the page
out at 500px and then crops — which looks exactly like a horizontal-overflow bug and
is not one. Render through a phone-sized iframe instead. Drop this next to
`index.html` as `_shot.html` (it is deliberately not committed):

```html
<style>html,body{margin:0}iframe{width:390px;height:844px;border:0;display:block}</style>
<iframe id="f" src="index.html"></iframe>
<script>
const target = new URLSearchParams(location.search).get('click');
document.getElementById('f').addEventListener('load', e => {
  if (!target) return;
  const d = e.target.contentDocument;
  for (const sel of target.split(',')) d.querySelector(sel)?.click();
});
</script>
```

Then, with the server running:

```sh
chrome --headless --disable-gpu --hide-scrollbars --force-prefers-reduced-motion \
  --screenshot=lesson.png --window-size=390,844 \
  'http://localhost:8000/_shot.html?click=[data-goto="start"],[data-goto="lesson"]'
```

The `click` parameter is a comma-separated list of selectors clicked in order, so any
screen behind a tap is reachable. `--force-prefers-reduced-motion` freezes the sheet
animation, which would otherwise be caught mid-slide.
