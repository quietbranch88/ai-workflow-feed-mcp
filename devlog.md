# Development log

## 2026-10-31

- Split snapshot collection from reading and moved daily source configuration into the source catalog.
- Added source-level snapshot validation and compatibility with existing unversioned data. A new collector emits version 1, which requires the compatible reader to be deployed first.
- Local test suite: 45 tests passed. An official MCP client against a local Worker read the existing public snapshot; cloud rollout of this revision is not yet verified.
