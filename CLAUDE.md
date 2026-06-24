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

Backend tests run **in the Apps Script editor**, not the CLI: run `runAllRsvpTests` and
`runEmailTests` from the Run dropdown (functions ending in `_` are hidden from it).

## Working notes

In-progress and planned work lives in root `*-plan.md` files (clasp/edit-link/email extension,
Cloudflare/domain migration). Check the relevant one before starting related work.
