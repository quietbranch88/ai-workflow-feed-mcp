# To do

- After explicit merge and production-deployment approval, merge `fix/rate-limit-coverage`, deploy it, read back the exact Worker version and bindings, and repeat safe policy plus official MCP smoke checks.
- Move the production Worker to an owned custom domain before enabling zone-level Cloudflare Managed WAF rules; the current `workers.dev` endpoint has no customer zone.
- Observe a real scheduled run after the workflow is activated; a manual run is not evidence of future scheduled execution.
- Review and update the pinned collector revision when deploying compatible source changes.
