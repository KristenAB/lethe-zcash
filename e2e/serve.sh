#!/usr/bin/env bash
# The real Lethe stack for the browser E2E, bound to 127.0.0.1:
#   serve.sh dashboard  the dashboard's Vite dev server on :5182 (the published run from deployments/)
#   serve.sh landing    packages/landing as static files on :8431
# No keys are passed on; nothing here can move funds (every quote on the pages is a recorded dry quote).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
case "${1:-}" in
  dashboard)
    cd "$root/packages/dashboard"
    exec ./node_modules/.bin/vite --host 127.0.0.1 --port 5182 --strictPort
    ;;
  landing)
    exec python3 -m http.server 8431 --bind 127.0.0.1 --directory "$root/packages/landing"
    ;;
  *)
    echo "usage: serve.sh dashboard|landing" >&2
    exit 2
    ;;
esac
