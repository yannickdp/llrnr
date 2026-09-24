# Her progress, off this browser — accounts and sync

Everything llrnr knows lives in two `localStorage` keys in one browser on one phone.
That is fine until the phone is replaced, Safari clears site data for an app she has
not opened in a while, or she wants to practise on a laptop. This plan adds an account
and a server copy.

Companion to [PLAN.md](PLAN.md) and [PLAN-ROMA.md](PLAN-ROMA.md), and downstream of
both: nothing here changes what the app teaches or how it rewards.

**Scope: her, and then her class.** Section 8 is about the second half of that, and it
is not a bigger version of the first half — it is a different kind of project, because
the data stops being family data. Read section 8 before building section 5.

> **Free-tier facts in section 6 were checked on 9 September 2026.** Free tiers rot
> faster than any other part of a plan — Heroku's is gone, Railway's is gone,
> PlanetScale's free MySQL is gone, PythonAnywhere's free MySQL is gone. Re-check
> before building, and treat section 6 as a snapshot rather than as a decision.

---

## 1. The decision that shapes everything else

**The server is a replica, not the source of truth.** `localStorage` stays where the
app reads and writes; sync copies that up and back down in the background.

This is not a hedge, it is the only shape consistent with what the app already
promises. The service worker exists, in its own words, "so it works in the car, on the
train, at school". PLAN §4 is built on never losing her progress to a bad write.
An app that needs the network to answer a question would be a worse app than the one
that exists today, and it would break in exactly the place it is used — a school with
patchy wifi.

Five consequences, and they are what make this project small:

1. **A sleeping backend is acceptable.** Free hosting spins down after fifteen minutes
   and takes up to a minute to wake. If sync is a background retry after a lesson,
   nobody ever waits for it. This single fact makes the cheapest tier viable and is
   why section 6 does not need an always-on host.
2. **The API is tiny.** Read a blob, write a blob, plus auth. No per-card endpoints, no
   ORM gymnastics over the scheduler, no server-side lesson logic.
3. **Failure is invisible.** No network, expired token, backend down, free tier
   cancelled — she keeps practising and the sync catches up later or never. The one
   thing that must never happen is a lesson blocked on a request.
4. **The free tier dying costs nothing.** If the host disappears, the app is exactly
   the app it is today. That is worth more than any uptime figure a free plan quotes.
5. **The existing backup stays.** Export/import to a file is the escape hatch that
   depends on nobody. Sync does not replace it.

**Not built, on purpose:** server-side lesson state, leaderboards, sharing, a teacher
view, anything that makes the server necessary to answer a question.

---

## 2. What is actually synced

Two `localStorage` keys, and they are already defined and already validated:

| Key | Contents |
|---|---|
| `llrnr.progress.v1` | xp, streak, badges, roma cache, settings, tests, and every card |
| `llrnr.lists.v1` | chapters she pasted in, as the raw text she pasted |

**The wire format already exists.** `exportBackup()` in [store.js](../js/store.js)
produces `{ app, backupVersion, exportedAt, progress, lists }`, and `inspectBackup()`
parses one, migrates it and summarises it without applying it. That is the payload,
the validator and the "here is what you are about to overwrite" screen, all written and
all under test. **The sync endpoint should carry exactly that object and nothing else.**
Inventing a second wire format would mean two schemas to migrate in step, and §4's
`MIGRATIONS` hook only exists once.

### There is no import step, and there is nothing to import

Worth stating because it looks like a task and is not one. Nothing migrates from "the
app she uses now" into "the API version": they are the same app, and the first
`PUT /profile` sends whatever `localStorage` holds using the same code path as every
later push. A carried-over profile and a clean slate cost exactly the same — nothing.

Two consequences:

- **Every classmate's account starts empty by construction.** A new user has no
  profile row; their first push creates one. There is no concept of importing anyone
  into anything.
- **A clean start is a choice, not a migration.** `store.reset()` already exists on the
  Settings screen.

And one wrinkle that follows from taking the clean start seriously. As of now she has
never run a real lesson — TODO 1.2's real chapter 1 and 1.5's "install it on her phone"
are both still open — so whatever is in that browser is practice against the stand-in
list. **If it is still there at first sync it becomes her permanent record**, and
because XP drives both of them she would arrive with a city and a coach rank she did
not earn on words she is not being tested on. So: reset before the first sync, once,
deliberately.

Size: a few hundred cards at roughly 300 bytes each, plus the pasted text. Well under a
megabyte, so the server stores it as one JSON column and never parses it. **The server
does not understand a card and must not start.** Every rule about boxes, clean days and
XP lives in `schedule.js` and `gamify.js`; a server that re-implemented any of it would
be a second scheduler drifting out of step with the first.

---

## 3. Conflicts

One girl, one or two devices, and she is not editing in two places at once. The
answer is **last write wins, guarded by a revision counter** — not a merge, and
certainly not a CRDT.

- The profile gains `rev`, an integer bumped on every local save, and `syncedRev`, the
  revision the server last acknowledged.
- `PUT /profile` carries `baseRev`. If the server's `rev` is higher, it answers **409**
  with its own copy rather than overwriting.
- On a 409 the client does **not** guess. It shows the same summary `inspectBackup()`
  already renders for a restore — cards, XP, badges, date — for both sides, in Dutch,
  and she picks. Two buttons, no merge.

**The real conflict case, so it is not a surprise:** phone offline through a school day,
laptop used that evening, phone comes back online. Both have real work in them and
neither is wrong. The count of clean recalls is the thing at stake, and PLAN §2.6 says
that number has to mean something — so it is worth a question rather than a silent
choice.

**Never destroy the loser.** `store.js` copies unreadable data to a `.broken` key
before starting fresh, and the server keeps the same discipline: every overwrite writes
the previous payload to `profile_snapshots` first. Storage is free at this size and a
lost month of practice is not recoverable any other way.

---

## 4. Login

**Decided: a username and a password. No social login at all.**

Google was the recommendation here until it wasn't: **her school runs on Microsoft**,
so the account she actually has and actually remembers the password for is an Entra
one, not a Gmail. A Google button would be a button for an account she does not use.

Facebook was already out and stays out, for two reasons that are about this app rather
than about effort: **Meta's own minimum age is 13** and she is twelve, so it is a
button she cannot legitimately press; and serving anyone past your own test users needs
Advanced Access, which means App Review and **business verification** — company
documents, for a family homework app.

That leaves Microsoft Entra as the only provider that would fit, and it is not worth it
for one user. Entra ID's OAuth is straightforward, but it is still a tenant, an app
registration, a redirect URI, a client secret to rotate, and a school administrator who
can disable third-party sign-in for the whole tenant on any given Tuesday. A password
this app owns cannot be switched off by someone else's policy.

**If social login is ever wanted, Microsoft is the one to add** — see the Later list.
It is not a build-it-now item.

### What to build

- **Username, not email.** With no reset mail and no verification mail, an address adds
  a field to a form and a piece of a child's personal data to a database, and buys
  nothing.
- **Argon2id** via `argon2-cffi`, at the library's defaults. Never anything else.
- **A length minimum of ten characters and no composition rules.** No uppercase-digit-
  symbol theatre and no expiry — both make passwords worse, and this one is going into
  a password manager anyway.
- **A nickname, not a real name.** *Vossie* rather than *Marie D.* This costs nothing
  and it is the single biggest lever on everything in section 8: a database holding
  self-chosen nicknames, password hashes and Latin vocabulary scores is about as close
  to harmless as a database of children can get.
- **No public registration endpoint.** Accounts come from a one-time **invite code**,
  issued by `admin invite`. An app with no open sign-up form has no sign-up abuse, no
  email verification, no CAPTCHA and no bot floods — and the invite scales to a class
  without becoming a sign-up form.
- **A recovery code, shown once at sign-up**, that resets the password without any
  email in the loop. Print it, put it in the back of the Latin book. `admin
  reset-password <name>` stays as the last resort.
- **Rate-limit the login endpoint** — that one is still exposed, and it is the only
  thing standing between a guessed password and a school year of practice. Exponential
  backoff per username, and a lockout after ten failures in five minutes.

### Sessions across two origins

The frontend is `https://<user>.github.io` and the API will not be. That is cross-site,
and it decides more than it looks like it does:

- **Cookies** would need `SameSite=None; Secure`, CORS with `credentials`, and Safari
  caps script-writable cross-site cookie lifetime at seven days — she would be logged
  out every week, on the browser this app targets.
- **A bearer token in `localStorage`** is the usual thing to argue against, because XSS
  steals it. But this app's XSS surface is unusually small and deliberately so:
  [ui.js](../js/ui.js) opens by stating that everything is built with `createElement`
  and `textContent`, precisely because word lists are pasted text, and there is no
  `innerHTML` anywhere in the codebase.

**Take the bearer token** — a short-lived access token and a long-lived refresh token —
and add a test asserting no `innerHTML` ever appears in `js/`. That test is what keeps
the choice honest.

Log her in **once, and then not again**: a refresh token measured in months, renewed on
use. A twelve-year-old re-entering a password on a phone before every practice session
is the kind of friction that ends the habit the whole app exists to build.

## 5. The API

Seven endpoints. If it grows past ten, something has been misunderstood.

```
POST   /auth/google      { code }            -> { access, refresh, user }
POST   /auth/refresh     { refresh }         -> { access }
POST   /auth/logout      
GET    /me                                   -> { id, email, name }
DELETE /me                                   -> everything, gone
GET    /profile                              -> { rev, updatedAt, payload }
PUT    /profile          { baseRev, payload} -> { rev } | 409 { rev, payload }
```

`payload` is the `exportBackup()` object, verbatim.

### Schema

Per-user from the first migration, even though there is one user. It costs nothing now
and a retrofit later would touch every row.

```sql
users             (id, username UNIQUE, password_hash,
                   created_at, last_seen_at, failed_logins, locked_until)
profiles          (user_id PK, rev, payload JSON, updated_at, device_label)
profile_snapshots (id, user_id, rev, payload JSON, created_at, reason)
```

`profile_snapshots` is section 3's never-destroy rule. Cap it at the last 50 per user
and prune on write.

---

## 6. Hosting and tech

*Checked 9 September 2026. Verify before building.*

### Recommended stack

| Piece | Choice | Why |
|---|---|---|
| API | **FastAPI** | Python as asked. Pydantic validates the payload envelope, and the OpenAPI docs come free — useful when the client is written weeks later |
| DB access | **SQLAlchemy** | Makes Postgres-vs-MySQL a connection string rather than a decision to defend |
| Database | **Neon** (Postgres) | 0.5 GB per project, 100 CU-hours/month, projects are *not* deleted for inactivity — computes suspend after 5 min and wake on demand. The blob is under 1 MB |
| API host | **Render** free web service | 750 instance-hours/month, deploys from GitHub, no card to start. Spins down after 15 min idle, ~1 min cold start — which §1 already made harmless |
| Passwords | **argon2-cffi** | Argon2id at the library's defaults. No OAuth library needed at all now |

### Postgres, settled

Agreed and closed. Free MySQL is the scarcer thing now — PlanetScale's free tier is
gone and PythonAnywhere's went with it — and Neon's free Postgres is the most durable
of what is left. Nothing here needs anything Postgres has that MySQL does not; it is a
JSON column and four verbs. The decision is about which free tier will still exist next
spring, not about the database.

*(Recorded in case it is ever reopened: **TiDB Cloud Starter** is MySQL wire compatible
with 5 GiB free, and **Aiven** has a free 1 GB MySQL. With SQLAlchemy either is a
connection string.)*

### Ruled out, with reasons

- **PythonAnywhere** — the obvious "free Python hosting" answer, and it does not fit.
  The free Beginner account allows outbound access to whitelisted **HTTP(S) sites
  only**, so it cannot open a Postgres connection to Neon at all, and it gives 100 CPU
  seconds a day. Its own free MySQL is gone too, so there is not even a local database
  to fall back on.
- **Render free Postgres** — expires 30 days after creation. Fine for a demo, wrong for
  the thing holding a school year of practice. Use Render for the API and Neon for the
  data.
- **Fly.io** — no free tier any more, a card is required, and a 256 MB machine left
  running is about $2/month. A good cheap option; not a free one.

### The alternative worth considering seriously

**Supabase** — 500 MB Postgres, 50 000 monthly active users, auth and a generated REST
API — would once have deleted most of this plan. **Dropping social login has weakened
that case considerably**, and it is worth saying so rather than leaving the section
standing as written.

Supabase's pull was that OAuth became configuration instead of code. What is left to
avoid is a login route, a password hash and a management command — perhaps two hundred
lines, and the two hundred lines are the interesting part of building a backend. Its
catch also remains: **free projects pause after a week of inactivity** and need a manual
restore from the dashboard. Never during term; certainly over the summer. Data is kept.

**Recommendation: build the Python backend.** With no OAuth in the picture there is no
longer much being traded away, and §1's architecture means the door stays open — the
client talks to one module, so switching later is a rewrite of that module and nothing
else.

---

## 7. What must not change

The invariants this plan is not allowed to break, collected so they can be checked:

- **No build step.** The frontend stays plain ES modules served as files. Sync is new
  modules under `js/sync/`, not a bundler.
- **It works offline, fully.** Every feature that works today works with the API
  unreachable. A test should run the whole lesson flow with `fetch` stubbed to reject.
- **Nothing is ever destroyed.** Client-side `.broken` keys and server-side snapshots.
- **The app speaks Dutch.** Every new string — sign-in, sync status, the conflict
  question, account deletion — is Flemish Dutch. PLAN §1.
- **The server knows nothing about Latin.** No scheduling, no XP, no grading.
- **No analytics, no third-party scripts, no tracking.** These are children's homework
  records. Store a nickname, a password hash and a progress blob — no email, no real
  name, no school, no class, no third party told any of them exists. Dropping social
  login made this easier to hold to than it would otherwise have been: there is no
  identity provider in the picture at all.
- **Nobody can see anybody else.** No leaderboard, no class ranking, no "Marie has 12
  more words than you". See section 8.
- **EU region, everywhere.** Neon and Render both offer Frankfurt. Choosing it at
  creation costs one dropdown and removes the international-transfer question entirely.
  It cannot be changed later without a migration.

---

## 8. Her class too

Giving accounts to other children in her class is a good idea and entirely doable at
this size. It is also **not the same project**, and the difference is worth stating
plainly before any of it is built.

### What actually changes

Two things. Everything else is the same code with more rows in it.

**1. The household exemption falls away.** GDPR does not apply to processing "by a
natural person in the course of a purely personal or household activity". While this is
his daughter's app on his daughter's phone, that is what it is. **The moment another
family's child has an account, that exemption is gone** and the app has a data
controller, who is you.

That is less dramatic than it sounds at this scale, but one part is not optional:
**Belgium sets the digital age of consent at 13**, in Article 7 of the Data Protection
Act of 30 July 2018 — the floor the GDPR permits. A twelve-year-old cannot consent for
herself, so processing needs **the parent's permission**, per child, before the account
exists. The Belgian DPA has already applied exactly this reasoning to a school tool
(APD/GBA 31/2020, Smartschool).

In practice that is one page of Dutch, given to a parent, saying what is stored, where
it is stored, who can see it, and how to have it deleted. Not a lawyer's document — a
page a parent can actually read. The design decisions above are what keep it to one
page: no email, no real name, nothing but a nickname and some Latin.

**2. Password resets stop being a terminal command.** One user forgetting a password is
a thirty-second job. Twenty-five eleven- and twelve-year-olds forgetting passwords in
the first fortnight is a support desk, and you are it. That is what the recovery code
in section 4 is for, and it is why it is worth building before the class arrives rather
than after.

### What does not change

- **The free tiers.** Twenty-five children at well under a megabyte each is about 25 MB
  against Neon's 500 MB, and a class practising four evenings a week is nothing against
  Render's 750 instance-hours. No plan change, no cost.
- **The architecture.** Section 1 holds exactly as written. Every device still owns its
  own copy and still works with the API unreachable, which matters *more* with
  twenty-five users on twenty-five kinds of phone and connection.
- **The schema.** Per-user from the first migration, which is why section 5 wrote it
  that way when there was one user.

### Three things to decide against, now

- **No leaderboard, no class ranking, no comparing.** This is the one that would be
  tempting and it would be a mistake. The whole reward layer is deliberately private
  and non-competitive: the city grows at her pace and takes nothing away (PLAN-ROMA
  §11). A child who is bottom of a class ranking learns that she is bottom of the
  class, and stops opening the app — and the child who most needs a vocabulary trainer
  is exactly the one at the bottom.
- **No teacher view, no parent dashboard.** Adding one turns a practice tool into a
  monitoring tool, and a child who knows her mistakes are being watched stops guessing
  — which is the behaviour spaced repetition runs on.
- **No shared progress of any kind.** The only thing worth sharing is the *word lists*,
  and that already works: chapters committed to `data/` are shared by construction and
  cost nothing. Putting the class's real chapters there is TODO 1.2's outstanding item
  anyway, and it is the one feature the class actually buys.

### Things that become obligations rather than niceties

- **Deletion has to work, and has to be easy to ask for.** `DELETE /me` was a nicety in
  section 5. It is now somebody else's right.
- **A backup you control.** `profile_snapshots` protects against a bad write, not
  against the free tier being cancelled with a fortnight's notice. A nightly `pg_dump`
  to a machine at home is enough, and it needs to exist before other people's children
  depend on it.
- **Retention.** Delete an account that has not been opened in, say, six months. Nobody
  is served by holding a child's homework record forever.

### The honest recommendation

Do it — after her own account has run for a term. Section 10's first question is
whether sync is even worth having, and the answer to that costs nothing to find out
with one user and a great deal to find out with twenty-six. Ship it for her, watch it
for a term, and hand out invite codes once you know the thing works.

---

## 9. Build order

Each step ends somewhere it is worth stopping.

**5.1 — The seam, client only.** `rev` and `syncedRev` on the profile, bumped in
`save()`. A `js/sync/client.js` with the whole surface — `push`, `pull`, `status` —
against a stub. No backend, no account.
*Stopping here:* nothing visible, but every later step is additive and the riskiest
schema change is already migrated.

**5.2 — The API, on your laptop.** FastAPI, SQLAlchemy, SQLite locally, all seven
endpoints, auth stubbed to a fixed user. `pytest` over the conflict rules: a stale
`baseRev` is a 409, an overwrite writes a snapshot first, a payload that fails the
envelope check is a 422.
*Stopping here:* a working API nobody can reach. The conflict logic is the part worth
testing hardest and it is done.

**5.3 — Login.** Argon2id hashing, the `create-user` and `reset-password` management
commands, access and refresh tokens, and a rate limit on the one exposed endpoint.
*Stopping here:* real accounts, still local.

**5.4 — Deploy.** Neon project, Render service, CORS pinned to the Pages origin,
secrets in environment variables and not in git. Run the client against it by hand.
*Stopping here:* the backend exists and the app does not know about it.

**5.5 — Sync, in the app.** Push after a lesson and on Settings-save, pull on boot,
retry with backoff, never block anything. A quiet line on Settings: *laatst
gesynchroniseerd om 18:42* — or *niet verbonden*, without an alarm.
*Stopping here:* this is the feature. Everything below is polish and safety.

**5.6 — The conflict question.** The Dutch two-way choice, reusing the restore preview.

**5.7 — Account deletion**, and a plain-language note on Settings saying what is stored
and where.

**5.8 — Her class.** Only after 5.1–5.7 have run for a term on her own account. Invite
codes, recovery codes, the parents' page, the nightly `pg_dump`, and the retention job.
Nothing here is hard; it is section 8's list, and it is gated on the app being known to
work rather than on the code being ready.

---

## 10. Open questions

*Closed: the database is Postgres, and login is a username and a password with no
social provider — the school runs on Microsoft, so Google was the wrong door. Her class
is in scope, on the terms in section 8.*


- **How many, and whose?** Twenty-five classmates is comfortably inside every free
  tier. Two hundred children across a school is a different question, and the answer to
  it is probably "the school should be paying for a tool with a support contract".
- **Does she ever actually use a second device?** If not, the value here is backup
  rather than sync — and export/import already does backup. Worth answering before
  building, in the spirit of PLAN-ROMA §9's parked coach.
