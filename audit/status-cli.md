# CLI and Rust audit status

Results: **107 PASS, 0 FAIL, 2 UNTESTED** (CLI-022 and CLI-023: needs ONECLICK_JWT).

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
| CLI-046 | PASS | [CLI-046.txt](cli/CLI-046.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-047 | PASS | [CLI-047.txt](cli/CLI-047.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-048 | PASS | [CLI-048.txt](cli/CLI-048.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-049 | PASS | [CLI-049.txt](cli/CLI-049.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
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
| CLI-060 | PASS | [CLI-060.txt](cli/CLI-060.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| CLI-061 | PASS | [CLI-061.txt](cli/CLI-061.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
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
| CLI-076 | PASS | [CLI-076.txt](cli/CLI-076.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| CLI-077 | PASS | [CLI-077.txt](cli/CLI-077.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| CLI-078 | PASS | [CLI-078.txt](cli/CLI-078.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| CLI-079 | PASS | [CLI-079.txt](cli/CLI-079.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| CLI-080 | PASS | [CLI-080.txt](cli/CLI-080.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-081 | PASS | [CLI-081.txt](cli/CLI-081.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| CLI-082 | PASS | [CLI-082.txt](cli/CLI-082.txt) | Single existing vitest file, selected contract(s); isolated TMPDIR and cleanup. |
| RS-001 | PASS | [RS-001.txt](cli/RS-001.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| RS-002 | PASS | [RS-002.txt](cli/RS-002.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| RS-003 | PASS | [RS-003.txt](cli/RS-003.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| RS-004 | PASS | [RS-004.txt](cli/RS-004.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| RS-005 | PASS | [RS-005.txt](cli/RS-005.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| RS-006 | PASS | [RS-006.txt](cli/RS-006.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| RS-007 | PASS | [RS-007.txt](cli/RS-007.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| RS-008 | PASS | [RS-008.txt](cli/RS-008.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| RS-009 | PASS | [RS-009.txt](cli/RS-009.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| RS-010 | PASS | [RS-010.txt](cli/RS-010.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| RS-011 | PASS | [RS-011.txt](cli/RS-011.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| RS-012 | PASS | [RS-012.txt](cli/RS-012.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| RS-013 | PASS | [RS-013.txt](cli/RS-013.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| RS-014 | PASS | [RS-014.txt](cli/RS-014.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| RS-015 | PASS | [RS-015.txt](cli/RS-015.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| RS-016 | PASS | [RS-016.txt](cli/RS-016.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. Read-only recorded testnet payment check; published viewing keys loaded internally, never passed as arguments. |
| RS-017 | PASS | [RS-017.txt](cli/RS-017.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. Read-only recorded testnet payment check; published viewing keys loaded internally, never passed as arguments. |
| RS-018 | PASS | [RS-018.txt](cli/RS-018.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. Read-only recorded testnet payment check; published viewing keys loaded internally, never passed as arguments. |
| RS-019 | PASS | [RS-019.txt](cli/RS-019.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| RS-020 | PASS | [RS-020.txt](cli/RS-020.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| RS-021 | PASS | [RS-021.txt](cli/RS-021.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. Read-only recorded testnet payment check; published viewing keys loaded internally, never passed as arguments. |
| RS-022 | PASS | [RS-022.txt](cli/RS-022.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| RS-023 | PASS | [RS-023.txt](cli/RS-023.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| RS-024 | PASS | [RS-024.txt](cli/RS-024.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. Read-only recorded testnet payment check; published viewing keys loaded internally, never passed as arguments. |
| RS-025 | PASS | [RS-025.txt](cli/RS-025.txt) | Individual command(s), exact output/state assertions, isolated throwaway wallet and cleanup. |
| RS-026 | PASS | [RS-026.txt](cli/RS-026.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
| RS-027 | PASS | [RS-027.txt](cli/RS-027.txt) | Independent source/test-contract review only, as specified; no seed access or execution of the reviewed wallet flow. |
