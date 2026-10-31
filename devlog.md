# Development log

## 2026-10-31

- Split snapshot collection from reading and moved daily source configuration into the source catalog.
- Added source-level snapshot validation and compatibility with existing unversioned data. A new collector emits version 1, which requires the compatible reader to be deployed first.
- Local test suite: 45 tests passed. The compatible reader was deployed and an official MCP client read a version-1 snapshot produced by a manually dispatched cloud workflow. A scheduled execution has not yet been observed.
