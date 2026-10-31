# Development log

## 2026-10-31

- Fixed the locally reproduced rate-limit coverage gap on `fix/rate-limit-coverage`: every Worker request now reaches both configured counters before path, host, or request-policy responses, and a per-client denial no longer skips the service counter. The focused red state failed on the prior ordering; the candidate passed 54 tests, a Wrangler dry-run build, dependency audit, syntax/diff checks, and a fresh bypass/regression review. At verification time the branch had not been merged or deployed; those states require separate readback.
- Added a Worker request firewall for the public MCP transport: method and media-type allowlists, a 64 KiB POST-body limit, security response headers, pseudonymized per-client throttling, and a separate service-wide ceiling. Local verification passed 52 tests, a dry-run build, dependency audit, and mutation check. Commit `fc5eea0` was deployed as Cloudflare version `ff12ec8e-cdac-4d54-a5f5-1888b6b95ad9`; live policy probes, rate-limit denial, and an official MCP client smoke passed. The feature branch was fast-forwarded into `main`. Zone-level Managed WAF remains unavailable on the `workers.dev` hostname.
- Split snapshot collection from reading and moved daily source configuration into the source catalog.
- Added source-level snapshot validation and compatibility with existing unversioned data. A new collector emits version 1, which requires the compatible reader to be deployed first.
- Local test suite: 45 tests passed. The compatible reader was deployed and an official MCP client read a version-1 snapshot produced by a manually dispatched cloud workflow. A scheduled execution has not yet been observed.
