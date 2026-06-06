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

All types support a `tags` array (used for triage state — see `triage-labels.md`) and `status` (workflow state, type-specific).

## When a skill says "publish to the issue tracker"

Call `mcp__nimbalyst-mcp__tracker_create` with the appropriate `type`, `title`, and `description`. Apply the triage tag (e.g. `needs-triage` for new incoming items, `ready-for-agent` for AFK-ready ones) via the `tags` field.

## When a skill says "fetch the relevant ticket"

Call `mcp__nimbalyst-mcp__tracker_get` with the item ID (e.g. `bug_01HX…`, `tsk_…`, `feat_…`). The user normally passes the ID directly; if they give a title or fuzzy reference, use `tracker_list` with `search` to find it first.

## When a skill says "comment on / update an issue"

- Add a comment: `mcp__nimbalyst-mcp__tracker_add_comment`
- Update fields (status, priority, tags, owner, title, description): `mcp__nimbalyst-mcp__tracker_update`
- Link a file to the item: `mcp__nimbalyst-mcp__tracker_link_file`
- Link the current agent session to the item: `mcp__nimbalyst-mcp__tracker_link_session`

Then — per the reminder below — actually move the issue's `status` and tick its checkboxes; a comment alone leaves the issue looking untouched.

## ⚠️ Don't forget to update the issue again!

When you finish work, **a comment is not an update.** Three *different* systems are in play and it's easy to think you've updated the tracker when you haven't:

1. **`tracker_add_comment`** appends a comment. It does **not** change `status` and does **not** tick the acceptance-criteria checkboxes in the body — the issue header looks unchanged.
2. **`tracker_update`** is what actually moves the issue:
   - **Change `status`** — `in-progress` when you start, `in-review` when the code is done and awaiting verification. **Never set `done` without explicit user approval.**
   - **Tick acceptance-criteria checkboxes.** There is no per-checkbox toggle: `description` *replaces* the whole body, so re-send the full description identical except `[ ]` → `[x]` on the genuinely-verified items. Don't over-claim — leave boxes that still need a manual/human step unchecked.
3. **`mcp__nimbalyst-session-naming__update_session_meta`** updates **this chat's card on the kanban board** (name, tags, phase) — the *session*, **not** the tracker issue. It changes nothing on the issue.

Closing ritual for any issue you worked: **(a)** comment what you did, **(b)** `tracker_update` the `status`, **(c)** `tracker_update` the `description` to tick the verified boxes.

## Triage workflow

A new incoming item starts with `needs-triage`. The `/triage` skill moves it through the state machine by *swapping* the triage tag — only one of the five canonical triage tags should be present at a time. Workflow `status` is separate (it tracks `to-do` → `in-progress` → `in-review` → `done`).

## Discovery

- `tracker_list` — list/filter items. Use `type`, `status`, `priority`, `typeTag`, or `where` field filters.
- `tracker_list_types` — inspect available types and their fields.
