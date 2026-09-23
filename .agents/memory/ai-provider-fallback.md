---
name: AI provider fallback
description: Why document quiz generation keeps a local fallback path and how provider failures are exposed safely.
---

Quiz generation should attempt the configured provider with bounded JSON output, but return a clearly marked local quiz when provider access is unavailable.

**Why:** The managed AI integration may require an account upgrade, and BYO provider keys can be invalid or expired. A study flow that fails completely is less useful than a transparent fallback.

**How to apply:** Sanitize provider error bodies before returning them to the browser; expose only a short status message and mark fallback responses so the UI can explain the mode.