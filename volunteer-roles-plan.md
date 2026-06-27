# Sheet-driven volunteer roles with live signup counts

Make the volunteer form's role list come from the spreadsheet instead of being
hardcoded in `index.html`, and show how full each role is so people can see
where help is still needed.

## Goal

1. Roles (name, description, group, how many are needed) are edited in the
   spreadsheet, not in code. No redeploy to add a role or change a count.
2. The form shows each role's current signups vs. how many are needed, and
   draws attention to roles that still need people.

## Decisions locked in

- **Source of truth: a new `Roles` tab** in the existing Volunteers spreadsheet.
  The volunteer script is container-bound to that file, so no extra OAuth scope,
  Script Property, or auth prompt is needed.
- **Name-matching**, not role IDs. Signups keep storing the role's display text in
  `Volunteer Roles`; counts match that text to the `Role` column on the `Roles`
  tab. Trade-off accepted: don't rename a role mid-campaign or its prior signups
  stop matching. (See the discussion in the session that produced this plan.)
- **Counts only, no names.** No personal data leaves the sheet, so no consent
  field or gating is needed. The display steers attention to under-filled roles.
- **Dynamic fetch at load.** The form fetches roles + counts from the volunteer
  Apps Script on page load and builds the cards from the response. Needs a
  loading state and a fallback.

## `Roles` tab schema

Row 1 is headers; the script is header-keyed like the rest of the backend, so
column order doesn't matter.

| Group                                | Role                          | Description                                      | Needed |
|--------------------------------------|-------------------------------|--------------------------------------------------|--------|
| Saturday, October 3rd - Day of Event | Check-In & Shirts             | One hour shift - welcome guests, hand out shirts | 4      |
| Saturday, October 3rd - Day of Event | Photography                   | One hour shift - 2 photographers needed          | 2      |
| Before the Weekend                   | Flexible - Before the Weekend | Available for any task during this period        |        |

- **Group**: reproduces the current time-period section headers.
- **Role**: the exact display label. This is also what gets stored in a signup's
  `Volunteer Roles` cell, so the strings must match for counting to work.
- **Description**: the small grey text under each role title today.
- **Needed**: integer capacity. **Blank = uncapped** (handles the "Flexible -
  whatever is needed" roles, which have no target).
- **No sort column.** Display order is group then row order: roles cluster under
  their group in the order the group first appears in the sheet, keeping row order
  within each group. The coordinator controls order just by arranging rows. A blank
  `Role` row is skipped, so spacer rows are fine.

Seed this tab from the roles currently hardcoded in `index.html` (the four groups:
Before the Weekend, Friday Oct 2nd, Saturday Oct 3rd, Sunday Oct 4th).

## Backend changes (`apps-script/volunteer/Code.js`)

Add one `doGet` branch and the supporting reads. Everything stays in the existing
project.

1. **`doGet` summary branch**, alongside the existing `?edit=` branch:
   ```javascript
   if (e && e.parameter && e.parameter.summary) return getRoleSummary_();
   ```

2. **`getRoleSummary_()`** returns:
   ```json
   {
     "roles": [
       {"group": "...", "role": "Photography", "description": "...", "needed": 2}
     ],
     "counts": {"Photography": 2, "Check-In & Shirts": 4}
   }
   ```
   - `readRoles_` reads the `Roles` tab (header-keyed) into the `roles` array in
     group-then-row order. `needed` is `null` when the cell is blank (uncapped).
   - `countRoleSignups_` reads the `Volunteers` tab and tallies signups per role via
     the shared `splitRoles_` helper. Roles with zero signups simply don't appear in
     `counts`; the role list itself comes from `readRoles_`, and the front-end
     renders every role in it, treating a missing count as 0.
   - Wrap in try/catch and return `{ roles: [], counts: {}, error: ... }` on failure
     so the front-end can fall back cleanly.

3. **No change to the write path.** Signups still store the joined role string. The
   `", "` split is now a shared `splitRoles_` helper used by both the count and the
   confirmation email (`genEmailHTML_`), so the split rule lives in one place.

4. **Counting is computed live.** Volume is tiny, so scan-on-request is fine. If we
   ever want to cut reads, a short `CacheService` TTL on the summary is available,
   but it's almost certainly unnecessary.

## Frontend changes (`index.html`, volunteer section)

The hardcoded role-card markup (the `vol-roles-grid` contents) gets replaced by
cards built at runtime from the summary fetch.

1. **`loadVolunteerRoles()`** on page load: GET `VOL_WEBHOOK + "?summary=1"`, then
   render grouped cards into `vol-roles-grid`. Mirror the Who's Coming fetch
   pattern (loading / loaded / error states).
   - **Loading state**: a "Loading roles..." line while the fetch is in flight.
   - **Fallback** if the fetch fails: no caching. Because roles are fetched-only,
     a failed fetch means there are no role cards to show, so the form can't be
     filled. Show a clear error with a retry and the coordinator email
     (childrenfirstmail@gmail.com) rather than a half-working form. Accepted
     consequence of dynamic-only with no local cache.

2. **Card rendering** per role:
   - Title + description (as today).
   - Capacity line: `3 of 6 filled` plus a small progress bar. Uncapped roles show
     just the signup count (e.g. "3 signed up"), no bar, no "full".
   - **Gap emphasis**: roles under their `Needed` get a highlight and a "Still needs
     help" badge; roles at/over `Needed` look "full" / de-emphasized. The exact
     treatment (per-card badge, a top-of-form "most needed" callout, sorting gaps to
     the top, or some mix) is left as a UI experiment to try once the data is
     flowing, not pinned down here.

3. **Card highlight listener**: today the checkbox highlight handler is attached
   once at load via `querySelectorAll`. Cards are now built async, so either attach
   the handler after render or switch to event delegation on `vol-roles-grid`.

4. **Edit mode sequencing**: `enterEditMode` fetches the signup record and calls
   `populateVolunteerForm`, which checks boxes by role-name value. The cards must
   exist first, so the roles fetch has to complete before populate runs. Coordinate
   the two (await roles render, then populate). Name-matching means `populate`
   needs no change beyond that ordering.

5. **Post-submit refresh**: the POST is no-cors so we can't read confirmation.
   After a successful-looking submit, re-fetch the summary (short delay) so the
   counts the next visitor sees reflect the new signup.

## Counting and capacity rules

- Missing role in `counts` = 0 signups.
- `Needed` blank = uncapped: show count, no "X of N", never "full".
- Count >= Needed = full: de-emphasize, no "needs help" badge.
- A signup string that doesn't match any `Roles` row (e.g. a role deleted from the
  tab after someone signed up) is counted for nothing and just doesn't render. The
  signup row is untouched. Worth a note to the coordinator.

## Caveats

- **Rename drift**: renaming a role on the `Roles` tab orphans prior signups that
  stored the old label. Add a note on the tab: edit descriptions and counts freely,
  but don't rename a `Role` once signups are coming in.
- **Stale counts**: counts reflect the moment the page loaded (plus the post-submit
  refetch). Not real-time across simultaneous visitors, which is fine here.
- **Ordering** is just the sheet's row order (grouped by Group). To reorder roles
  or groups, move the rows. Keep a group's rows together; if the same group appears
  in non-adjacent rows they still cluster under the group's first appearance.

## Testing

- Backend: done, wired into `runAllVolunteerTests`. `testSplitRoles_`,
  `testReadRoles_` (group-then-row order with interleaved groups, blank `Needed`
  becomes uncapped, spacer rows skipped), `testCountRoleSignups_` (multi-role rows,
  zero-signup role absent from the map), and `testGetRoleSummary_` end-to-end over a
  `Roles_TEST` + `Volunteer_TEST` pair.
- Frontend: manual check that cards render from the sheet, gap emphasis shows,
  uncapped roles render without a bar, edit-link prefill still checks the right
  boxes, and the fallback path renders when the fetch is blocked.

## Rollout

1. Create and seed the `Roles` tab from the current hardcoded roles.
2. Add the backend `doGet` summary branch + `getRoleSummary_` + tests; run tests in
   the editor; `clasp push -f` then `clasp deploy -i <volunteer deploymentId>`.
3. Swap the hardcoded role cards in `index.html` for the dynamic render; verify
   against the deployed summary endpoint locally; commit + push.

Deploy order matters: ship the backend summary endpoint before the front-end that
depends on it, so there's no window where the form fetches an endpoint that 404s
its summary branch. (The branch is additive, so deploying it early is harmless.)

## Out of scope / possible follow-ups

- Showing names (would need a consent field, deliberately excluded).
- Real-time count updates / websockets (overkill at this volume).
- Closing a role automatically once full (today it just shows "full"; disabling the
  checkbox could be a later tweak).

## Related

- Pattern precedent: the Who's Coming GET + render in `index.html` (`loadWhoComing`).
- Backend conventions: `apps-script/volunteer/Code.js`, `apps-script/rsvp/Code.js`.
- The volunteer email + edit-link work this builds on: [[add-email-shirts-volunteer-plan]],
  [[edit-link-extend-plan]].
