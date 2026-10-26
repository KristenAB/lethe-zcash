# CLI and Rust audit status

All 109 CLI-/RS- rows from AUDIT.md. Each row has its own execution or explicitly requested source-contract review. No protected wallet, repo .demo, environment file, transaction send, Chrome, Vite, full test suite, workspace release build, or heavy-slot used. Runtime wallet files are isolated under /tmp with umask 077 and removed after each row. Existing Rust binaries were reused after byte-for-byte comparison of package source, Cargo.toml and Cargo.lock with their build checkout. Auth credentials were excluded from the runner environment.

Evidence includes stdout, stderr, exit code, command, assertions, and timeout/cleanup information. An exit code of 0 for a source-review log means the review command completed; it does not claim the wallet command was run. Public provider success checks use real dry requests; local HTTP servers are used only for failure and read-only lookup contracts.

| ID | status | evidence | notes |
| --- | --- | --- | --- |
| CLI-001 | PASS | [CLI-001.txt](cli/CLI-001.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| CLI-002 | PASS | [CLI-002.txt](cli/CLI-002.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| CLI-003 | PASS | [CLI-003.txt](cli/CLI-003.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| CLI-004 | PASS | [CLI-004.txt](cli/CLI-004.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| CLI-005 | PASS | [CLI-005.txt](cli/CLI-005.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| CLI-006 | PASS | [CLI-006.txt](cli/CLI-006.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| CLI-007 | PASS | [CLI-007.txt](cli/CLI-007.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-008 | PASS | [CLI-008.txt](cli/CLI-008.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-009 | PASS | [CLI-009.txt](cli/CLI-009.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-010 | PASS | [CLI-010.txt](cli/CLI-010.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-011 | PASS | [CLI-011.txt](cli/CLI-011.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-012 | PASS | [CLI-012.txt](cli/CLI-012.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-013 | PASS | [CLI-013.txt](cli/CLI-013.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-014 | PASS | [CLI-014.txt](cli/CLI-014.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-015 | PASS | [CLI-015.txt](cli/CLI-015.txt) | Single existing vitest file, selected contract(s); isolated TMPDIR and cleanup. |
