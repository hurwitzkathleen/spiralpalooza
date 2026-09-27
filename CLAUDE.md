# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static event website. The entire front-end is a single `index.html` (inline CSS/JS, **no build
step, no framework**). Persistence and email run on **Google Apps Script** web apps backed by
Google Sheets; their source lives under `apps-script/`.

## Key things to know

- **Submits are fire-and-forget.** Forms POST to Apps Script with `mode:"no-cors"`, so the browser
  **cannot read the response** — success is assumed. Only GETs (Who's-Coming, edit-mode prefetch)
  read JSON back.
- **Email goes through a shared mailer** (`apps-script/mailer/`). Data scripts don't call `MailApp`;
  they POST to the mailer with a shared secret so all mail sends from one address. Secrets live in
  Script Properties, never in code.
- **Sheet I/O is header-keyed** (`rsvpRow_`/`appendByHeader_`): columns resolve by row-1 header text,
  so column order doesn't matter and the front-end payload keys must match those header-mapped keys.
- **`apps-script/` is the canonical copy of the backend**, synced to the live projects with clasp.

## Apps Script deploy (read before editing `apps-script/`)

Full setup is in `README.md`. The thing that will bite you otherwise:

- **`clasp push` updates code but does NOT make it live.** The public `/exec` serves a pinned
  version; you must `clasp deploy -i <deploymentId>` to publish. Leave the Apps Script web editor
  closed when doing this (a stale open tab can overwrite a push). Verify what's live by probing
  `?edit=anything` (current code returns `{"found":false}`).

## Commands

```sh
# Front-end: serve locally — not file:// (Who's-Coming + edit links need a real origin)
python3 -m http.server 8000          # http://localhost:8000/index.html

# Apps Script, from a project dir (e.g. apps-script/rsvp)
clasp pull / clasp push -f / clasp deploy -i <deploymentId> -d "…"
```

Backend tests run **in the Apps Script editor**, not the CLI: run `runAllRsvpTests`,
`runEmailTests`, and `runBroadcastTests` from the Run dropdown (functions ending in `_` are
hidden from it).

**Two of the Run-dropdown entries send real email.** Both are meant to; don't "fix" them:

- **`runAllRsvpTests` sends one confirmation email per run.** `testDoPost_endToEnd_` calls the
  real `doPost`, which is the point of it — the send path is part of what's under test. The
  mail goes to the address in `fullPayload_` and, because it routes through the mailer, it
  spends one of **childrenfirstmail's** 100 daily recipients, not the runner's.
- **`runQuotaRecipientProbe` sends three**, all plus-addressed variants of the runner's own
  address (2 on To, 1 on Cc), to measure whether every address counts against the daily cap,
  which is what the broadcast batching assumes. Run it by hand, once per sending account,
  never as part of a suite.
- **`runBroadcastLiveTest` sends two** (to three recipients), also all the runner's own
  addresses. It points production code at the `RSVP_TEST` tab and exercises the whole send
  path. Usually reached as **Spiralpalooza → Send a test to myself…** in the sheet; the
  Run-dropdown entry is the same function. See the broadcast section of `README.md`.

  It returns `{ok, message}` rather than only logging, because the menu wrapper
  (`testBroadcastFromMenu`) has to tell three outcomes apart: passed, failed (an assertion
  threw), and never ran (no template doc, or too little quota). A bail-out reported as a
  pass would tell an organizer the send path works when it was never exercised — keep that
  distinction if you touch it.

`runEmailTests` and `runBroadcastTests` are pure — HTML generation and grid filtering only.

The quota overlap matters on a broadcast day: the RSVP list send draws from that same
childrenfirstmail pool, so repeatedly re-running `runAllRsvpTests` eats into it.

Bulk email to the RSVP list ("Spiralpalooza" menu in the RSVPs sheet) uses a Google Doc as
the template and **does not go through the mailer**. A menu item runs as whoever clicks it,
so the sender, quota, and authorization are the clicking user's - which is what makes the
same code a safe test run for one person and the real send for childrenfirstmail, with no
deployment involved. The template is a Doc rather than a Gmail draft so the project never
needs mailbox scope. `rsvp/appsscript.json` declares its OAuth scopes explicitly, so any new
service used in `rsvp/Code.js` needs its scope added there too. See "Emailing the whole RSVP
list" in `README.md`.

## Working notes

In-progress and planned work lives in root `*-plan.md` files (clasp/edit-link/email extension,
Cloudflare/domain migration). Check the relevant one before starting related work.
