# spiralpalooza

Event website for the Spiralpalooza Remembering Party (Children First, Durham NC —
October 3, 2026).

## What's here

- **`index.html`** — the entire front-end. A single static page (no build step) with
  inline CSS/JS. Deployed as static hosting; it talks to Google Apps Script endpoints
  for RSVP, t-shirt orders, volunteer sign-ups, and the public "Who's Coming" list.
- **`apps-script/`** — source for the Google Apps Script backends, managed with
  [`clasp`](https://github.com/google/clasp) (see below). Each subfolder is one
  Apps Script project:
  - `rsvp/` — RSVP form backend + "Who's Coming" + edit-by-link (bound to the RSVPs sheet)
  - `mailer/` — standalone mailer microservice (sends confirmation emails)
  - `shirts/` — t-shirt order backend (bound to the shirts sheet)
  - `volunteer/` — volunteer sign-up backend (bound to the volunteer sheet)
- **`*-plan.md`** — working notes for in-progress / future work.

## Architecture in one paragraph

The static page submits forms to Apps Script web apps (one per form), which append
rows to Google Sheets. Confirmation emails are not sent by the data scripts directly;
instead each data script calls the **mailer** microservice server-to-server (with a
shared secret), and the mailer sends from `childrenfirstmail@gmail.com`. RSVP supports
"edit by link": the confirmation email includes a unique token link that re-opens the
form pre-filled and updates the existing row instead of adding a new one.

---

## Working on the Apps Script backends with clasp

The canonical copy of each backend lives **here in the repo** (`apps-script/`). `clasp`
(Google's official Apps Script CLI) syncs it to the live Apps Script projects so the code
can live in git.

**Keep the repo and the live scripts in sync — don't let them drift.** The normal flow is
edit in the repo → commit → `clasp push`. If you instead edit only the live version in the
Apps Script web editor, the repo goes stale, and the next `clasp push` will overwrite your
web edits (a `clasp pull` would do the reverse and clobber the repo). If you ever do edit
live, `clasp pull` and commit right away.

clasp isn't strictly required: you *can* hand-copy code between the repo and the browser
editor if you'd rather not set it up. Just copy **both directions** so the two stay in sync.

### One-time machine setup

0. **Use Node.js 20.x.** clasp's OAuth login/refresh breaks with `Invalid response body
   while trying to fetch https://oauth2.googleapis.com/token: Premature close` on newer
   Node (22.23.0+, 24.17.0+, 25.x, 26.x); the Node 20 line is the known-good pick. See
   https://github.com/google/clasp/issues/1158. For example:
   ```sh
   brew install node@20      # then make sure `node --version` reports v20.x
   ```
1. Install clasp (requires Node.js / npm — see step 0). Pin the exact version:
   ```sh
   npm install -g @google/clasp@3.3.0
   ```
2. Enable the Apps Script API for your Google account (one-time toggle):
   https://script.google.com/home/usersettings
3. Log in:
   ```sh
   clasp login
   ```
   This opens a browser OAuth screen — **sign in there as the Google account that has
   edit access to the project you're syncing** (clasp acts as whoever you pick). There is
   no account flag on the command; account selection happens in the browser. Useful related
   commands:
   ```sh
   clasp login --status   # show which account is currently logged in
   clasp logout           # sign out, so you can clasp login as a different account
   ```
   On the consent screen, **check "Select all"** — these are clasp's declared scopes
   (Apps Script projects/deployments, the narrow `drive.file`, GCP config, logs), and
   partial grants tend to break commands with confusing auth errors. To minimize instead,
   the must-haves for push/pull are the two Apps Script scopes, `drive.file`, and the
   Cloud data + email scope (skip the web-app-publish and log-data scopes if you deploy
   from the web UI).

   Credentials are stored in `~/.clasprc.json` (outside this repo; never commit it —
   it's gitignored as a safeguard).

### Wiring up each project (one-time per project)

Each `apps-script/<project>/.clasp.json` ships with a placeholder `scriptId`. Replace it
with the real Script ID, found in the Apps Script editor under **Project Settings → IDs →
Script ID**.

Then, because the live project is the source of truth until clasp adopts it, pull first so
your local manifest (`appsscript.json`) matches the deployment settings, before pushing code:

```sh
cd apps-script/rsvp
# 1. paste the real scriptId into .clasp.json
clasp pull          # brings down the live appsscript.json (and current code)
# 2. reconcile: keep the pulled appsscript.json; make Code.gs the version you want to ship
clasp push          # uploads local code to the live project
```

`clasp pull` will overwrite local files with what's live, so on first adoption pull into a
scratch copy (or commit your intended `Code.gs` first) and keep the version you actually want.

### Day-to-day

```sh
cd apps-script/<project>
clasp pull          # before editing, to avoid clobbering anything changed in the web UI
# ...edit Code.gs locally, commit to git...
clasp push          # deploy code changes to the live project
clasp open          # open the project in the browser editor
```

After `clasp push`, **reload (or close) the Apps Script web editor before touching it** — an
open tab still shows the pre-push code and can silently overwrite your push on its next save,
which then gets captured by the next "New version" deploy. Simplest: deploy with `clasp deploy
-i <deploymentId>` and leave the web editor closed.

### Deploying a new version (web apps)

`clasp push` updates the code, but the public `/exec` URL serves a **deployed version**.
After pushing, publish a new version. You can do it from the CLI:

```sh
clasp deploy
```

…but **deployment identity ("Execute as") follows whoever deploys.** The mailer and the
data scripts must run as `childrenfirstmail@gmail.com`, so it's usually cleanest to push
code with clasp and create the new deployment **in the web editor** (Manage deployments →
Edit → New version → Deploy) under the correct account. Either way the `/exec` URL stays
the same, so `index.html` needs no change.

### Notes & gotchas

- **One project per folder.** Each `apps-script/<project>/` has its own `.clasp.json` /
  Script ID. Run clasp commands from inside the relevant folder.
- **Account switching.** clasp holds one active login at a time. The data scripts and the
  mailer may be owned by different accounts; `clasp login` again to switch.
- **Secrets stay in Script Properties**, never in these files: `MAIL_SECRET` (mailer +
  each data script) and `MAILER_URL` (each data script). The `.gs` files reference them
  via `PropertiesService`. `SITE_URL` in `rsvp/Code.gs` must be set to the live domain.
- **`shirts/` and `volunteer/`** are scaffolded but not yet populated — set their Script
  IDs and `clasp pull` to bring down their current code when you start on them. See
  `edit-link-extend-plan.md` and `add-email-shirts-volunteer-plan.md`.

---

## Front-end

`index.html` is plain static HTML — open it directly or serve it:

```sh
python3 -m http.server 8000   # then open http://localhost:8000/index.html
```

Form submissions and the "Who's Coming" fetch hit the live Apps Script endpoints, so they
only fully work against the deployed backends (and edit links need `SITE_URL` set to the
real domain).
