# 0003 — Structured summary output via tool-use, not markdown

- **Status:** Accepted
- **Date:** 2026-06-06
- **Context tags:** Summary, Section, LLM contract

## Context

The summarizer needs Claude to return a **Summary** — a `language` code plus an
ordered list of **Section**s, each `{ sec, title, summary }` — that every client
(Chrome now, iOS later) renders into its own native view. Two ways to get that out
of Claude:

1. **Markdown.** Ask Claude to write the summary as formatted text and parse it back
   into structure on the client.
2. **Tool-use.** Force Claude to call a `submit_summary` tool whose `input_schema`
   *is* the Summary shape, and read the structured tool input directly.

The hard requirement that drives the decision: every emitted `sec` must line up with a
real transcript-segment start time, because a left-clicked timestamp seeks the video.
Structure integrity matters more than prose.

## Decision

Claude returns the Summary **exclusively via a forced `submit_summary` tool call**
(`tool_choice: { type: "tool", name: "submit_summary" }`). The tool's `input_schema`
lives in `shared/schema.json` and is the single canonical contract bundled into every
client at build time. Clients never parse markdown.

## Consequences

**Positive**

- **No parsing layer.** The tool input arrives as a typed object — no markdown grammar
  to reverse-engineer, no regex for timestamps. `summarize.ts` validates shape and
  returns it.
- **Schema is the contract.** `shared/schema.json` is both what we send Claude (tool
  schema) and what we validate against. One source of truth; clients cannot drift.
- **`integer` `sec` by construction.** The schema types `sec` as an integer, so we never
  parse `"12:03"`-style strings — it is already seconds, ready for both the timestamp
  snapper (later slice) and the seek call.
- **Forced call removes a failure mode.** `tool_choice` guarantees Claude emits the tool
  rather than chatting; the orchestrator still guards and throws if the block is absent.

**Negative / costs**

- **Server-side schema enforcement is not total.** Anthropic validates against the tool
  schema, but we still validate client-side (`validateSummary`) because we own the seek
  guarantee. Minor duplication of intent between schema and validator.
- **No streaming.** A forced tool call is delivered whole, not streamed token-by-token.
  This is fine — and in fact required — because timestamp validation/snapping must run
  once against a complete Summary (see the plan's "wait-then-render" decision).

## Alternatives considered

- **Markdown + client parser.** Rejected: fragile timestamp parsing, brittle to prose
  variation, and a parser to maintain per client — exactly the drift `shared/` exists to
  prevent.
- **JSON mode without a named tool.** Weaker schema guarantees than a typed
  `input_schema`, and no forced-call affordance. Tool-use is the stronger contract.
