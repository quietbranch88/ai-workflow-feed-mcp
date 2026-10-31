# To do

- Review and merge `feat/waf-rate-limit` before treating repository `main` as the source of the deployed request-firewall revision.
- Move the production Worker to an owned custom domain before enabling zone-level Cloudflare Managed WAF rules; the current `workers.dev` endpoint has no customer zone.
- Observe a real scheduled run after the workflow is activated; a manual run is not evidence of future scheduled execution.
- Review and update the pinned collector revision when deploying compatible source changes.
