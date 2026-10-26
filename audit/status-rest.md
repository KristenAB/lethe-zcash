| ID | status | evidence | notes |
| --- | --- | --- | --- |
| CH-001 | PASS | [CH-001](rest/CH-001.txt) | Authorized repository search; matches are read methods and BLOCKED refusals, no contract deployment/call execution flow. |
| CH-002 | PASS | [CH-002](rest/CH-002.txt) |  |
| CH-003 | FAIL | [CH-003](rest/CH-003.txt) | HTTP 200 |
| CH-004 | PASS | [CH-004](rest/CH-004.txt) |  |
| CH-005 | PASS | [CH-005](rest/CH-005.txt) | Real public echo and real invalid-JWT confidential request; request observer records authorization presence only. Both recipient and refund fields reach provider. |
| CH-006 | PASS | [CH-006](rest/CH-006.txt) |  |
| CH-007 | PASS | [CH-007](rest/CH-007.txt) | Direct dry API helper uses quote() and exits 1 on the actual provider error; CLI has no refund-address override. |
| CH-008 | PASS | [CH-008](rest/CH-008.txt) | Real tip reads with native scanner default and explicit ZSWAP_LWD_URL forwarded by CLI library. No transaction operation. TLS implementation not inferred as runtime proof from source. |
| CH-009 | PASS | [CH-009](rest/CH-009.txt) | Published viewing keys loaded internally from deployment record; only authorized 23 compact blocks scanned. All four txids matched exactly one key. |
| CH-010 | PASS | [CH-010](rest/CH-010.txt) | Published viewing key loaded internally; saved evidence contains verdict only. Key exclusivity observed by CH-009 scan. |
| CH-011 | PASS | [CH-011](rest/CH-011.txt) | Published viewing key loaded internally; saved evidence contains verdict only. Key exclusivity observed by CH-009 scan. |
| CH-012 | PASS | [CH-012](rest/CH-012.txt) | Published viewing key loaded internally; saved evidence contains verdict only. Key exclusivity observed by CH-009 scan. |
| CH-013 | PASS | [CH-013](rest/CH-013.txt) | Published viewing key loaded internally; saved evidence contains verdict only. Key exclusivity observed by CH-009 scan. |
| CH-014 | PASS | [CH-014](rest/CH-014.txt) | Authorized read-only deployment-record exception; no seed was loaded or regenerated. |
| CH-015 | PASS | [CH-015](rest/CH-015.txt) |  |
| CH-016 | PASS | [CH-016](rest/CH-016.txt) |  |
| CH-017 | UNTESTED | [CH-017](rest/CH-017.txt) | Real UNKNOWN_ACCOUNT mapping observed. Positive FT-only/indexed-only use needs a real account in that state; no transaction/funding allowed. |
| CH-018 | UNTESTED | [CH-018](rest/CH-018.txt) | Actual own-destination and explicit-token reads passed; token-only extension requires a funded derived recipient, unavailable without prohibited funding. |
| CH-019 | PASS | [CH-019](rest/CH-019.txt) |  |
| CH-020 | PASS | [CH-020](rest/CH-020.txt) | Real silent TCP endpoint; no response synthesized; CLI and MCP both failed explicitly. |
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
