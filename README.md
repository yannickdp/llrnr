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
