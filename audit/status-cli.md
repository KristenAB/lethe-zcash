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
| CLI-036 | PASS | [CLI-036.txt](cli/CLI-036.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| CLI-037 | PASS | [CLI-037.txt](cli/CLI-037.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| CLI-038 | PASS | [CLI-038.txt](cli/CLI-038.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| CLI-039 | PASS | [CLI-039.txt](cli/CLI-039.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-040 | PASS | [CLI-040.txt](cli/CLI-040.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-041 | PASS | [CLI-041.txt](cli/CLI-041.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| CLI-042 | PASS | [CLI-042.txt](cli/CLI-042.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| CLI-043 | PASS | [CLI-043.txt](cli/CLI-043.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| CLI-044 | PASS | [CLI-044.txt](cli/CLI-044.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| CLI-045 | PASS | [CLI-045.txt](cli/CLI-045.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
