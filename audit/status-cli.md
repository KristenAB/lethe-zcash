# CLI and Rust audit status

Results: **106 PASS, 1 FAIL, 2 UNTESTED** (CLI-022 and CLI-023: needs ONECLICK_JWT).

All 109 CLI-/RS- rows from AUDIT.md. The 35 rows previously recorded as source/test-contract review have now been executed individually. Their expected-result columns, rather than the erroneous planning restrictions, determine the result. All other row statuses, notes, and evidence logs are unchanged.

Runtime wallet files were isolated under /tmp with umask 077 and removed after each row. Key-bearing stdout was captured only inside a helper, reduced to field names, lengths, nonempty-secret flags and assertions, and never written to a raw evidence file. NEAR credential files were checked for existence and mode 0600, then deleted without reading their private keys. Existing Rust binaries and test executables were reused after byte-for-byte comparison of package source, Rust integration tests, Cargo.toml and Cargo.lock with their build checkout. Credentials were excluded from the runner environment.

Recovery scans stayed within 4522708–4522730. Recorded payment checks were read-only; local HTTP/gRPC fixtures exercised refusal, interruption, recovery-window and scanner-boundary contracts. No transaction, example script, Chrome session, full test suite, or workspace release build was run. Logs distinguish child exit codes, intentional interruption, helper assertions and cleanup. RS-026 records a failed connection-timeout boundary; the source remains unchanged.

| ID | status | evidence | notes |
| --- | --- | --- | --- |
| CLI-001 | PASS | [CLI-001.txt](cli/CLI-001.txt) | Ran `zswap init`, exit 0; exact creation fields, account binding, directory 0700 and files 0600. |
| CLI-002 | PASS | [CLI-002.txt](cli/CLI-002.txt) | Ran `zswap init`, exit 0; existing-file flags false and wallet bytes unchanged. |
| CLI-003 | PASS | [CLI-003.txt](cli/CLI-003.txt) | Ran `zswap init`, exit 2; exact setup prefix and recovery instruction; no book created. |
| CLI-004 | PASS | [CLI-004.txt](cli/CLI-004.txt) | Ran `zswap init --new`, exit 0; exact creation flags and bound empty book. |
| CLI-005 | PASS | [CLI-005.txt](cli/CLI-005.txt) | Ran direct and `pnpm --filter @zswap/cli zswap where`, exits 0; exact fields and repo-root default paths. |
| CLI-006 | PASS | [CLI-006.txt](cli/CLI-006.txt) | Ran `zswap where`, exits 0; exact INIT_CWD-relative overrides and adjacent default book. |
| CLI-007 | PASS | [CLI-007.txt](cli/CLI-007.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-008 | PASS | [CLI-008.txt](cli/CLI-008.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-009 | PASS | [CLI-009.txt](cli/CLI-009.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-010 | PASS | [CLI-010.txt](cli/CLI-010.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-011 | PASS | [CLI-011.txt](cli/CLI-011.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-012 | PASS | [CLI-012.txt](cli/CLI-012.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-013 | PASS | [CLI-013.txt](cli/CLI-013.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-014 | PASS | [CLI-014.txt](cli/CLI-014.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-015 | PASS | [CLI-015.txt](cli/CLI-015.txt) | Single existing vitest file, selected contract(s); isolated TMPDIR and cleanup. |
| CLI-016 | PASS | [CLI-016.txt](cli/CLI-016.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. Real public dry 1Click path, no JWT. |
| CLI-017 | PASS | [CLI-017.txt](cli/CLI-017.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. Real public dry 1Click path, no JWT. |
| CLI-018 | PASS | [CLI-018.txt](cli/CLI-018.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. Real public dry 1Click path, no JWT. |
| CLI-019 | PASS | [CLI-019.txt](cli/CLI-019.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. Real public dry 1Click path, no JWT. |
| CLI-020 | PASS | [CLI-020.txt](cli/CLI-020.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-021 | PASS | [CLI-021.txt](cli/CLI-021.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-022 | UNTESTED | [CLI-022.txt](cli/CLI-022.txt) | needs ONECLICK_JWT |
| CLI-023 | UNTESTED | [CLI-023.txt](cli/CLI-023.txt) | needs ONECLICK_JWT |
| CLI-024 | PASS | [CLI-024.txt](cli/CLI-024.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-025 | PASS | [CLI-025.txt](cli/CLI-025.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-026 | PASS | [CLI-026.txt](cli/CLI-026.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-027 | PASS | [CLI-027.txt](cli/CLI-027.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. Real public dry 1Click path, no JWT. |
| CLI-028 | PASS | [CLI-028.txt](cli/CLI-028.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-029 | PASS | [CLI-029.txt](cli/CLI-029.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-030 | PASS | [CLI-030.txt](cli/CLI-030.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-031 | PASS | [CLI-031.txt](cli/CLI-031.txt) | Single existing vitest file, selected contract(s); isolated TMPDIR and cleanup. |
| CLI-032 | PASS | [CLI-032.txt](cli/CLI-032.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-033 | PASS | [CLI-033.txt](cli/CLI-033.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-034 | PASS | [CLI-034.txt](cli/CLI-034.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-035 | PASS | [CLI-035.txt](cli/CLI-035.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-036 | PASS | [CLI-036.txt](cli/CLI-036.txt) | Ran `zswap quote`, exit 2; missing-book setup prefix; no reservation or quote POST. |
| CLI-037 | PASS | [CLI-037.txt](cli/CLI-037.txt) | Ran `zswap quote`, exit 2; wrong-wallet setup prefix; book unchanged and no quote POST. |
| CLI-038 | PASS | [CLI-038.txt](cli/CLI-038.txt) | Ran `zswap quote`, exits 2 then 0; legacy mismatch refused; matching wallet binds and preserves prior index. |
| CLI-039 | PASS | [CLI-039.txt](cli/CLI-039.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-040 | PASS | [CLI-040.txt](cli/CLI-040.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-041 | PASS | [CLI-041.txt](cli/CLI-041.txt) | Ran selected `vitest run test/book-race.test.ts`, exit 0; six concurrent processes produced indices 0–5 and distinct addresses. |
| CLI-042 | PASS | [CLI-042.txt](cli/CLI-042.txt) | Ran selected `vitest run test/book-race.test.ts`, exit 0; all 30 stale-lock rounds with six processes passed. |
| CLI-043 | PASS | [CLI-043.txt](cli/CLI-043.txt) | Ran selected durability vitest and instrumented `IndexBook.reserve`, exits 0; fsync-file, rename, fsync-directory, return order and mode 0600 verified. |
| CLI-044 | PASS | [CLI-044.txt](cli/CLI-044.txt) | Ran `zswap quote`, exit 1 after 45000 ms lock wait; exact refusal text, unchanged book, zero quote POSTs. |
| CLI-045 | PASS | [CLI-045.txt](cli/CLI-045.txt) | Ran `zswap quote`, intentionally SIGKILLed after HTTP arrival; retry exit 4; durable uncertain reservation protected; next reserve index 1. |
| CLI-046 | PASS | [CLI-046.txt](cli/CLI-046.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-047 | PASS | [CLI-047.txt](cli/CLI-047.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-048 | PASS | [CLI-048.txt](cli/CLI-048.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-049 | PASS | [CLI-049.txt](cli/CLI-049.txt) | Ran `zswap recipients --lookup --probe-ahead --gap 3`, exit 0; restored bound book and stdout next 6; next reservation index 6. |
| CLI-050 | PASS | [CLI-050.txt](cli/CLI-050.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-051 | PASS | [CLI-051.txt](cli/CLI-051.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-052 | PASS | [CLI-052.txt](cli/CLI-052.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-053 | PASS | [CLI-053.txt](cli/CLI-053.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-054 | PASS | [CLI-054.txt](cli/CLI-054.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-055 | PASS | [CLI-055.txt](cli/CLI-055.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-056 | PASS | [CLI-056.txt](cli/CLI-056.txt) | Single existing vitest file, selected contract(s); isolated TMPDIR and cleanup. |
| CLI-057 | PASS | [CLI-057.txt](cli/CLI-057.txt) | Single existing vitest file, selected contract(s); isolated TMPDIR and cleanup. |
| CLI-058 | PASS | [CLI-058.txt](cli/CLI-058.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-059 | PASS | [CLI-059.txt](cli/CLI-059.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-060 | PASS | [CLI-060.txt](cli/CLI-060.txt) | Ran `zswap near-key`, exits 0 and 1 for exclusive-create refusal; stdout has no private key; credential mode 0600; deleted unread. |
| CLI-061 | PASS | [CLI-061.txt](cli/CLI-061.txt) | Ran `zswap near-key`, exits 1 for existing destination and exact missing-argument usage, then 0 for INIT_CWD-relative export; credential deleted unread. |
| CLI-062 | PASS | [CLI-062.txt](cli/CLI-062.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-063 | PASS | [CLI-063.txt](cli/CLI-063.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-064 | PASS | [CLI-064.txt](cli/CLI-064.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-065 | PASS | [CLI-065.txt](cli/CLI-065.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-066 | PASS | [CLI-066.txt](cli/CLI-066.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-067 | PASS | [CLI-067.txt](cli/CLI-067.txt) | Single existing vitest file, selected contract(s); isolated TMPDIR and cleanup. |
| CLI-068 | PASS | [CLI-068.txt](cli/CLI-068.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-069 | PASS | [CLI-069.txt](cli/CLI-069.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-070 | PASS | [CLI-070.txt](cli/CLI-070.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-071 | PASS | [CLI-071.txt](cli/CLI-071.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-072 | PASS | [CLI-072.txt](cli/CLI-072.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-073 | PASS | [CLI-073.txt](cli/CLI-073.txt) | Single existing vitest file, selected contract(s); isolated TMPDIR and cleanup. |
| CLI-074 | PASS | [CLI-074.txt](cli/CLI-074.txt) | Single existing vitest file, selected contract(s); isolated TMPDIR and cleanup. |
| CLI-075 | PASS | [CLI-075.txt](cli/CLI-075.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-076 | PASS | [CLI-076.txt](cli/CLI-076.txt) | Ran `zswap recover 4522708 4522730`, exit 0; no hits, exact default labels and bound next 10; next reserve at least 10. |
| CLI-077 | PASS | [CLI-077.txt](cli/CLI-077.txt) | Ran `zswap recover 4522708 4522730 --gap 2` and default gap, exits 0; exact five/thirteen-refund windows and monotonic next verified. |
| CLI-078 | PASS | [CLI-078.txt](cli/CLI-078.txt) | Ran `zswap recover 4522708 4522730` with synthetic hit fixture and real `zpay-verify scan-range`, exits 0; window through refund-12 and recorded hits verified. |
| CLI-079 | PASS | [CLI-079.txt](cli/CLI-079.txt) | Ran `zswap recover 4522708 4522730 --lookup` with local scan/NEAR fixtures, exit 0; warning and bidirectional window extension verified. |
| CLI-080 | PASS | [CLI-080.txt](cli/CLI-080.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-081 | PASS | [CLI-081.txt](cli/CLI-081.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-082 | PASS | [CLI-082.txt](cli/CLI-082.txt) | Single existing vitest file, selected contract(s); isolated TMPDIR and cleanup. |
| RS-001 | PASS | [RS-001.txt](cli/RS-001.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| RS-002 | PASS | [RS-002.txt](cli/RS-002.txt) | Ran `zswap-keys init` twice, exits 0; exact JSON, 32-byte 0600 seed and no overwrite verified. |
| RS-003 | PASS | [RS-003.txt](cli/RS-003.txt) | Ran `zswap-keys account` with missing and short seeds, exits 2; exact required error prefixes and empty stdout. |
| RS-004 | PASS | [RS-004.txt](cli/RS-004.txt) | Ran `zswap-keys account`, exit 0; helper asserted exact fields, network encodings and seed mode 0600; key-bearing values redacted. |
| RS-005 | PASS | [RS-005.txt](cli/RS-005.txt) | Ran `zswap-keys refund`, exits 0 and 2; helper asserted nested fields and seed mode 0600; malformed-index error exact; key-bearing values redacted. |
| RS-006 | PASS | [RS-006.txt](cli/RS-006.txt) | Ran source-matching `one_time` Rust integration test executable, exit 0; all five tests passed, including 64-index invariants. |
| RS-007 | PASS | [RS-007.txt](cli/RS-007.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| RS-008 | PASS | [RS-008.txt](cli/RS-008.txt) | Ran `zswap-keys near`, exit 0; helper asserted exact fields, path, public-byte/account-ID equivalence and seed mode 0600; values redacted. |
| RS-009 | PASS | [RS-009.txt](cli/RS-009.txt) | Ran `zswap-keys near` and `near-key` for all four invalid indices, exits 2; exact stderr and no credentials created. |
| RS-010 | PASS | [RS-010.txt](cli/RS-010.txt) | Ran source-matching `near_recipient` Rust integration test executable, exit 0; vector, 64-recipient and credential-library tests passed. |
| RS-011 | PASS | [RS-011.txt](cli/RS-011.txt) | Ran `zswap-keys near-key`, exits 0 and 2; exact stdout fields with no private key, mode 0600 and exclusive creation verified; credential deleted unread. |
| RS-012 | PASS | [RS-012.txt](cli/RS-012.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| RS-013 | PASS | [RS-013.txt](cli/RS-013.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| RS-014 | PASS | [RS-014.txt](cli/RS-014.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| RS-015 | PASS | [RS-015.txt](cli/RS-015.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| RS-016 | PASS | [RS-016.txt](cli/RS-016.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. Read-only recorded testnet payment check; published viewing keys loaded internally, never passed as arguments. |
| RS-017 | PASS | [RS-017.txt](cli/RS-017.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. Read-only recorded testnet payment check; published viewing keys loaded internally, never passed as arguments. |
| RS-018 | PASS | [RS-018.txt](cli/RS-018.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. Read-only recorded testnet payment check; published viewing keys loaded internally, never passed as arguments. |
| RS-019 | PASS | [RS-019.txt](cli/RS-019.txt) | Ran `zpay-verify verify`, exits 1 for memo, confirmation and absent-transaction failures; exact reasons matched; payment-rule Rust tests exit 0. |
| RS-020 | PASS | [RS-020.txt](cli/RS-020.txt) | Ran `zpay-verify verify` with and without `--allow-transparent`, exits 1; only policy reason removed; payment-rule Rust tests exit 0. |
| RS-021 | PASS | [RS-021.txt](cli/RS-021.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. Read-only recorded testnet payment check; published viewing keys loaded internally, never passed as arguments. |
| RS-022 | PASS | [RS-022.txt](cli/RS-022.txt) | Ran `zpay-verify inspect`, exit 2 for exact txid-mismatch error and exits 0 for unknown, orphaned and empty transaction reports. |
| RS-023 | PASS | [RS-023.txt](cli/RS-023.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| RS-024 | PASS | [RS-024.txt](cli/RS-024.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. Read-only recorded testnet payment check; published viewing keys loaded internally, never passed as arguments. |
| RS-025 | PASS | [RS-025.txt](cli/RS-025.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| RS-026 | FAIL | [RS-026.txt](cli/RS-026.txt) | Ran `zpay-verify scan-range`, exits 0 and 2; TLS-blackhole connection required SIGKILL after 20005 ms instead of the expected 10-second bound. Inclusive scan, block count, 32 MiB decoding limit and 60-second RPC timeout passed; helper exit 1. |
| RS-027 | PASS | [RS-027.txt](cli/RS-027.txt) | Ran `scanRangeAsync` (child SIGKILL), `chainTipAsync` (child exit 2), and MCP recover/plan commands; helper exit 0; timeout defaults, 300-character stderr cap and responsiveness verified. |
