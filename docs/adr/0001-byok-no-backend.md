# ADR 0001 — BYOK: User-supplied Anthropic API keys, no hosted backend

**Status:** Accepted  
**Date:** 2026-06-07

## Context

The YouTube Summarizer extension calls the Anthropic Claude API to produce video summaries. We had to choose between two models:

1. **Hosted backend** — we operate a server that holds one Anthropic API key, all users share it, the extension talks to our server.
2. **BYOK (Bring Your Own Key)** — each user supplies their own Anthropic API key; the extension calls the Anthropic API directly from the browser.

## Decision

We use BYOK. The user enters their Anthropic API key in the extension's settings page; the key is stored locally in `chrome.storage.local` and sent directly to `api.anthropic.com` from the browser.

## Rationale

**No infrastructure to operate.** A hosted backend requires a server, auth, rate limiting, billing management, key rotation, uptime monitoring, and incident response. BYOK has none of this — there is no backend.

**Cost stays with the user, not us.** Every API call is billed to the user's Anthropic account. We never touch money, never need a payment system, and never face surprise bills from heavy users.

**Privacy by default.** Video transcripts contain the full content of whatever the user is watching. With BYOK, transcripts travel only between the user's browser and Anthropic — we never see them. With a hosted backend, we would receive every transcript.

**No API key management.** We never hold, rotate, or audit API keys. A compromised key is the user's to revoke, not ours.

**Acceptable for MVP audience.** The initial audience is technical users comfortable with API keys. The friction of signing up for Anthropic access and copying a key into a settings page is acceptable at this stage.

## Consequences

- **Positive:** Zero infrastructure, zero cost to us, strong privacy posture, ships faster.
- **Negative:** Requires users to have an Anthropic account and pay per use. Not suitable for a consumer product targeting non-technical users.
- **Neutral:** The key lives in `chrome.storage.local` — it survives extension updates but is not synced across browsers (per-device). This is intentional: keys are credentials and should not roam.

## Revisit when

- We want a consumer-facing product where "get an API key" is too much friction.
- We need to control model versions, add server-side caching, or enforce usage limits.
