# To do

- Obtain explicit default-branch integration approval and update the snapshot repository's scheduled workflow to pin `a49cc18`; the production reader and one manual public snapshot are verified, but recurring collection still uses the prior pin.
- Move the production Worker to an owned custom domain before enabling zone-level Cloudflare Managed WAF rules; the current `workers.dev` endpoint has no customer zone.
- Observe a real scheduled run after the workflow is activated; a manual run is not evidence of future scheduled execution.
