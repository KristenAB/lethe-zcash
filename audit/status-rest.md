| ID | status | evidence | notes |
| --- | --- | --- | --- |
| MCP-001 | PASS | [MCP-001](rest/MCP-001.txt) | Real stdio initialization and discovery; every stdout line parsed as JSON-RPC. |
| MCP-002 | PASS | [MCP-002](rest/MCP-002.txt) |  |
| MCP-003 | PASS | [MCP-003](rest/MCP-003.txt) | Unset log startup and existing 0666 file tightened to 0600. |
| MCP-004 | PASS | [MCP-004](rest/MCP-004.txt) | Runtime log keys checked; successful indexed result also checked in MCP-006. |
| MCP-005 | PASS | [MCP-005](rest/MCP-005.txt) |  |
| MCP-006 | PASS | [MCP-006](rest/MCP-006.txt) |  |
| MCP-007 | PASS | [MCP-007](rest/MCP-007.txt) |  |
| MCP-008 | PASS | [MCP-008](rest/MCP-008.txt) |  |
| MCP-009 | PASS | [MCP-009](rest/MCP-009.txt) |  |
| MCP-010 | PASS | [MCP-010](rest/MCP-010.txt) |  |
| MCP-011 | PASS | [MCP-011](rest/MCP-011.txt) |  |
| MCP-012 | UNTESTED | [MCP-012](rest/MCP-012.txt) | needs ONECLICK_JWT |
| MCP-013 | PASS | [MCP-013](rest/MCP-013.txt) | Real default 1Click endpoint, deliberately invalid nonsecret credential; authorization bytes excluded from logs. |
| MCP-014 | PASS | [MCP-014](rest/MCP-014.txt) |  |
| MCP-015 | PASS | [MCP-015](rest/MCP-015.txt) |  |
| MCP-016 | PASS | [MCP-016](rest/MCP-016.txt) |  |
| MCP-017 | PASS | [MCP-017](rest/MCP-017.txt) |  |
| MCP-018 | UNTESTED | [MCP-018](rest/MCP-018.txt) | Live MCP recovery scans to current tip beyond 4522730; safety guard refused before scan. Needs an authorized bounded end-height option or historical node. |
| MCP-019 | PASS | [MCP-019](rest/MCP-019.txt) |  |
| MCP-020 | PASS | [MCP-020](rest/MCP-020.txt) |  |
| MCP-021 | PASS | [MCP-021](rest/MCP-021.txt) | Real silent TCP listener; concurrent plan 3ms; recovery 3010ms; scanner timeout uses SIGKILL. |
| MCP-022 | UNTESTED | [MCP-022](rest/MCP-022.txt) | Real recover lookup called; scanner refused current tip beyond authorized range. No completed both-chain result. |
| MCP-023 | PASS | [MCP-023](rest/MCP-023.txt) |  |
| MCP-024 | PASS | [MCP-024](rest/MCP-024.txt) |  |
| MCP-025 | UNTESTED | [MCP-025](rest/MCP-025.txt) | Gap lookup and local advancement observed; extension past a used account needs a funded derived recipient, prohibited in this run. |
| MCP-026 | PASS | [MCP-026](rest/MCP-026.txt) |  |
| MCP-027 | UNTESTED | [MCP-027](rest/MCP-027.txt) | Common-destination warning observed; token-only warning needs a real token-funded derived account. No funding allowed. |
| MCP-028 | PASS | [MCP-028](rest/MCP-028.txt) | Tool ran without ZSWAP_SEED; no wallet required. |
| MCP-029 | PASS | [MCP-029](rest/MCP-029.txt) |  |
| MCP-030 | PASS | [MCP-030](rest/MCP-030.txt) |  |
