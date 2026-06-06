# Triage Labels

The skills speak in terms of five canonical triage roles. In this repo they are applied as **tags on Nimbalyst tracker items** (see `issue-tracker.md`).

| Label in mattpocock/skills | Tag value in our tracker | Meaning                                  |
| -------------------------- | ------------------------ | ---------------------------------------- |
| `needs-triage`             | `needs-triage`           | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`             | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`        | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`        | Requires human implementation            |
| `wontfix`                  | `wontfix`                | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), set the corresponding string in the item's `tags` array via `mcp__nimbalyst-mcp__tracker_update`. Only one of these five values should be present on an item at a time — swap, don't accumulate.

Edit the right-hand column if you adopt different vocabulary.
