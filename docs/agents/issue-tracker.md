# Issue tracker: Nimbalyst local tracker

Issues, tasks, ideas, features, decisions, and plans for this repo live in the **Nimbalyst tracker**, persisted under `.nimbalyst/trackers/` and accessed via the `mcp__nimbalyst-mcp__tracker_*` MCP tools. There is no GitHub Issues fallback — even bug reports from `/feedback:bug-report` go here.

## Item types

Use the most specific built-in type:

| Skill term                          | Tracker type |
| ----------------------------------- | ------------ |
| bug / defect                        | `bug`        |
| task / chore                        | `task`       |
| feature request                     | `feature`    |
| idea / spike                        | `idea`       |
| PRD / multi-step plan               | `plan`       |
| architectural decision / ADR        | `decision`   |

All types support a `tags` array (used for triage state — see `triage-labels.md`) and a `status` (workflow state — for a `task` that's `to-do` → `in-progress` → `in-review` → `done`). Run `tracker_list_types` to see the exact statuses a given type allows.

## Conventions

- **Create an item**: `mcp__nimbalyst-mcp__tracker_create` with `type`, `title`, `description`. Apply the triage tag (e.g. `needs-triage`, `ready-for-agent`) via the `tags` field.
- **Read an item**: `mcp__nimbalyst-mcp__tracker_get` with the item ID or issue key (e.g. `NIM-123`, `bug_01HX…`, `tsk_…`). If the user gives a fuzzy reference, find it first with `tracker_list` + `search`.
- **List / filter items**: `mcp__nimbalyst-mcp__tracker_list` — filter by `type`, `status`, `priority`, `typeTag`, or `where` field filters.
- **Comment on an item**: `mcp__nimbalyst-mcp__tracker_add_comment`.
- **Update fields** (status, priority, tags, owner, title, description): `mcp__nimbalyst-mcp__tracker_update`.
- **Link a file** to the item: `mcp__nimbalyst-mcp__tracker_link_file`.
- **Link the current agent session** to the item: `mcp__nimbalyst-mcp__tracker_link_session`.
- **Inspect a type's schema / valid statuses**: `mcp__nimbalyst-mcp__tracker_list_types`.

## ⚠️ Don't forget to update the issue again!

When you finish work on an issue, **a comment is not an update.** These are different systems and it's easy to think you've updated the tracker when you haven't:

1. **`tracker_add_comment`** appends a comment. It does **not** change the issue's `status` and does **not** tick the acceptance-criteria checkboxes in the body. The issue header looks unchanged — the comment lives in a separate tab.
2. **`tracker_update`** is what actually moves the issue. Use it to:
   - **Change `status`** as work progresses — `in-progress` when you start, `in-review` when the code is done and awaiting verification. **Never set `done`/`completed` without explicit user approval** — only the user decides when work is truly done.
   - **Tick acceptance-criteria checkboxes.** There is no per-checkbox toggle: `description` *replaces* the whole body, so re-send the full description identical except `[ ]` → `[x]` on the items that are genuinely verified. Don't over-claim — leave boxes that still need a manual/human step unchecked.
3. **`mcp__nimbalyst-session-naming__update_session_meta`** (and `update_session_board`) update **this chat's card on the Nimbalyst kanban board** — its name, tags, and phase. This is the *session*, **not** the tracker issue. Updating session meta changes nothing on the issue.
4. **Roll the change up to the parent.** When an item has a parent (e.g. a `task` whose body names a parent `plan`), finishing the child usually moves the parent too: a plan whose first child just shipped should move from `ready-for-development` to `in-development`; a plan whose last child is done is a candidate for `in-review`/`completed` (still needs explicit user approval). Note that types have *different* status vocabularies — a `plan` runs `draft → ready-for-development → in-development → in-review → completed`, a `task` runs `to-do → in-progress → in-review → done` — so check `tracker_list_types` before setting a parent's status. Parent issues are not auto-updated when a child changes; you must do it.

**Closing ritual** for any issue you worked: **(a)** comment what you did, **(b)** `tracker_update` the issue's `status`, **(c)** `tracker_update` the `description` to tick the verified boxes, **(d)** `tracker_update` the **parent's** `status` if this child changes where the parent sits.

## ⚠️ `update_session_meta` always requires updating the issue too

**Every `update_session_meta` call that reflects completed work must be accompanied by the closing ritual above — in the same response, before or after the session meta call.**

- `update_session_meta` and `tracker_update` are **not alternatives**; they update different things. One without the other leaves the tracker stale.
- After updating the child issue, **check the parent issue(s)**. If completing this child advances the parent's state, update the parent's `status` and/or tick its checkboxes. If not, no call needed — but consciously verify rather than skip.
- The pattern to enforce: issue update → parent check → session meta. In that order, in one response, every time.

## When a skill says "publish to the issue tracker"

Call `tracker_create` with the appropriate `type`, `title`, and `description`, applying the right triage tag.

## When a skill says "fetch the relevant ticket"

Call `tracker_get` with the item ID or issue key. The user normally passes it directly; resolve fuzzy references via `tracker_list` + `search`.

## When a skill says "comment on / update an issue"

Comment with `tracker_add_comment`, then — per the reminder above — `tracker_update` the `status` and (if acceptance criteria are involved) the `description`. Link files/sessions with `tracker_link_file` / `tracker_link_session`.

## Triage workflow

A new incoming item starts with `needs-triage`. The `/triage` skill moves it through the state machine by *swapping* the triage tag — only one of the five canonical triage tags should be present at a time (see `triage-labels.md`). Workflow `status` is separate and tracks `to-do` → `in-progress` → `in-review` → `done`.
