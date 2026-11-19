# To do

- Move the production Worker to an owned custom domain before enabling zone-level Cloudflare Managed WAF rules; the current `workers.dev` endpoint has no customer zone.
- Observe a naturally triggered scheduled run after the workflow activation; the successful post-merge manual dispatch verifies the workflow path but is not evidence that GitHub's cron trigger has fired.

- [x] Verified the 2026-11-19 deployed parser fix: 35 live sources and eight snapshot sources succeeded.

- [x] Upgrade vulnerable XML parser; verify full dependency audit, tests, build and one complete deployed scan (2026-11-19).
