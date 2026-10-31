# Development log

## 2026-10-31

- Added a Worker request firewall for the public MCP transport: method and media-type allowlists, a 64 KiB POST-body limit, security response headers, pseudonymized per-client throttling, and a separate service-wide ceiling. Zone-level Managed WAF remains unavailable on the `workers.dev` hostname.
- Split snapshot collection from reading and moved daily source configuration into the source catalog.
- Added source-level snapshot validation and compatibility with existing unversioned data. A new collector emits version 1, which requires the compatible reader to be deployed first.
- Local test suite: 45 tests passed. The compatible reader was deployed and an official MCP client read a version-1 snapshot produced by a manually dispatched cloud workflow. A scheduled execution has not yet been observed.
