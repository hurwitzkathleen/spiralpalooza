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
   clasp show-authorized-user   # show which account is currently logged in
   clasp logout                 # sign out, so you can clasp login as a different account
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

## Emailing the whole RSVP list

The organizer writes the email in a Google Doc, then sends it to every party from a menu in
the RSVPs spreadsheet. One personalized message per party: addressed to the primary contact,
copying any party members who gave their own email address. No BCC blast, and no party ever
sees another party's addresses.

**The mailer is not involved.** A spreadsheet menu runs as whoever clicks it, so the mail
goes out from *that person's* account, on their sending quota, under their authorization.
That is the point: a test run sends from the tester, and the identical code sends from
`childrenfirstmail@gmail.com` when they run it. There is nothing to deploy and no dev/prod
switch.

**Sending:**

1. Write the email in a Google Doc. **The doc's name becomes the subject line.** Use
   `{{First Name}}`, `{{Last Name}}`, `{{Years}}`, `{{Total in Party}}`, or `{{Edit Link}}`
   in the text and each recipient gets their own values. Share the doc so the sending
   account can view it.
2. Open the RSVPs spreadsheet → **Spiralpalooza → Choose template doc…** and paste the link.
   This is remembered, so it's only needed when the doc changes.
3. **Spiralpalooza → Preview recipients…** to check the counts and how the first recipient's
   copy reads. Sends nothing.
4. **Spiralpalooza → Send a test to myself…** to see the real thing in your own inbox before
   anyone else does. Recommended whenever the doc has changed.
5. **Spiralpalooza → Send to RSVP list…**, confirm the summary.

**Who gets a copy.** One message per party, with the whole party on the To line: the `Email`
column first, then any party members stored as `Name (rel) [email]`. Party members listed
without an address just don't get one. Every address receives at most one copy per campaign,
so if someone is both a party member on one row and a primary contact on their own row, the
first row in the sheet claims them and the other is skipped.

**What it skips:** anyone with `Attending = No`, a blank or malformed `Email`, a duplicate
address, or `Do Not Email = Yes`. Put `Yes` in **Do Not Email** to take a whole party off the
list for good.

**Why it may take more than one run.** A consumer Gmail account is capped at **100 mail
recipients per day**, and Google counts *recipients, not messages*, so a party of four costs
four (see https://developers.google.com/apps-script/guides/services/quotas). Parties are
never split across days: the run stops at the last whole party that fits. Each successful
send is stamped on that row in **Broadcast Sent** / **Broadcast Sent At**, so a later run
picks up exactly where it stopped and never double-sends. Renaming the doc starts a fresh
campaign that includes everyone again, since the subject is the campaign key.

**The "sends left today" figure is approximate.** Google documents
`MailApp.getRemainingDailyQuota()` as valid "for the current execution", warning it "might
vary between executions", and it has been seen drifting both up and down with no sends in
between. Don't read anything into a move of one or two, and don't try to infer the reset
schedule from it.

**When to re-run.** The reset mechanism isn't documented and third-party accounts disagree,
so the safe rule is: **re-run about a day after the previous run, at the same time of day or
later.** Avoid "just wait until tomorrow" - the morning after an evening send may only be
~11 hours later.

`BROADCAST_DAILY_RESERVE` (default 10) exists partly to absorb that jitter, so a noisy
reading can't push a run past the real cap. Lower it only if you understand you're spending
that margin.

The preview reports both numbers - parties and people - so check the people count against the
100/day cap when estimating how many runs it will take.

Google documents the cap as "Email recipients per day" and says quotas are "based on the
number of email recipients", but no first-party page spells out how the individual address
fields are counted. The batching assumes every address costs one, which is the safe
assumption: if it's wrong the send just takes more passes than strictly necessary, and can
never overrun the cap.

To settle it for a given account, run **`runQuotaRecipientProbe`** from the Apps Script Run
dropdown. It sends one message to three plus-addressed variants of the runner's own address,
**2 on To and 1 on Cc**, and reads the counter. A drop of 3 is conclusive that every address
counts in both fields: counting messages would give 1, counting only To would give 2, and
only Cc would give 1, so nothing else produces 3. Both fields are covered so the answer
stays valid if party members are ever moved back to Cc. It spends three real sends, so run
it once per account, not routinely.

**Testing it safely.** Use **Spiralpalooza → Send a test to myself…**. It builds an
`RSVP_TEST` tab of made-up rows, runs the real send path against it, and emails only
plus-addressed variants of whoever clicked (2 messages, 3 addresses, 3 of their own daily
sends). The `RSVPs` tab is never read or written, so no real guest can be reached. It checks
the filtering, party addressing, write-back and resume behaviour automatically, and then
tells you what to look for in your inbox — the things no test can see, like the From name,
reply-to, formatting and images.

Three outcomes, kept deliberately distinct: **passed**, **FAILED** (an assertion threw; don't
send to the list), and **did not run** (no template doc, or fewer than 5 sends left). The same
function is `runBroadcastLiveTest` in the Run dropdown if you want the execution log.

**Token gotcha.** The Docs HTML export splits text into spans wherever formatting changes, so
a token that got partly bolded or autocorrected won't substitute. Preview warns about any
`{{…}}` left unreplaced; retype those in the doc as plain text and preview again.

**Formatting that survives:** the doc is exported as HTML, so headings, bold, italic, colour,
links and lists come through, and images are converted to inline attachments so they render
in Gmail. Three quirks of the export are corrected automatically in `tidyDocHtml_` /
`makeImagesResponsive_`, all because Docs exports for a printed page rather than an email:

- The page's one-inch margins arrive as `padding:72pt` on `<body>`.
- List bullets are drawn with CSS `:before`, which Gmail strips, leaving markerless lists.
- Images arrive as `data:` URIs, which Gmail refuses to render, at a fixed pixel size that
  overflows a phone.

**One thing to fix in the doc rather than in code:** if bullets look more spaced out in the
email than in the doc, that's paragraph spacing on the list items. Docs hides it via "don't
add space between paragraphs of the same style" but still exports it. Select the list and use
**Format → Line & paragraph spacing → Remove space before/after paragraph**, or paint-format
from a list that already looks right.

**The Drive API has to be enabled, via the manifest.** The template is fetched by calling the
Drive REST API directly rather than through the built-in `DriveApp` service (which would drag
in a full read/write Drive scope). Built-in services need no setup, but a direct REST call
makes the script an ordinary API client, metered against the Cloud project behind the script,
and that project must have the API switched on. Otherwise every doc load fails with
`HTTP 403, accessNotConfigured`.

This is already handled: `rsvp/appsscript.json` declares the Drive advanced service under
`dependencies.enabledAdvancedServices`, and **declaring the service is what enables the API**
on the script's default Cloud project. Keep that block — deleting it breaks every doc load.

Do **not** try to enable the API from the Cloud console. The script's default Cloud project
isn't administrable there: the console reports a missing `resourcemanager.projects.get` and
offers to request a role, but no administrator exists to grant it. That path is a dead end.

If the editor's Services list ever loses Drive API (v3), re-add it there; it writes the same
manifest block, so it won't fight with `clasp push -f`.

**Scopes.** `apps-script/rsvp/appsscript.json` now declares its OAuth scopes explicitly
rather than letting Apps Script infer them, because the Doc export calls the Drive REST API
directly (inference only sees `UrlFetchApp` and would leave the token without Drive access).
Declaring them also means scope changes show up in a diff instead of appearing silently.
**Adding a service to `rsvp/Code.js` now requires adding its scope to that file**, or the
call fails at runtime. `drive.readonly` is deliberate: reading a *Gmail draft* instead would
require `https://mail.google.com/`, which grants read, send and delete over the whole
mailbox of whoever clicks the menu.

The next time someone cuts a **new RSVP web app version**, the deploying account has to
re-consent to the expanded scope list. The current live deployment is pinned to its existing
version and keeps working until then.

---

## Front-end

`index.html` is plain static HTML — open it directly or serve it:

```sh
python3 -m http.server 8000   # then open http://localhost:8000/index.html
```

Form submissions and the "Who's Coming" fetch hit the live Apps Script endpoints, so they
only fully work against the deployed backends (and edit links need `SITE_URL` set to the
real domain).
