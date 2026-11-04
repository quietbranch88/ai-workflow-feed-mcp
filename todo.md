# To do

- Move the production Worker to an owned custom domain before enabling zone-level Cloudflare Managed WAF rules; the current `workers.dev` endpoint has no customer zone.
- Observe a naturally triggered scheduled run after the workflow activation; the successful post-merge manual dispatch verifies the workflow path but is not evidence that GitHub's cron trigger has fired.
