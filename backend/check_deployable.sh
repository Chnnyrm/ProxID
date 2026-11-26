#!/usr/bin/env bash
# Prove the deployment can boot before shipping it.
#
# Three production outages came from defects that could not appear locally: the
# virtualenv had packages requirements.txt never declared, so importing the app
# succeeded here and failed on Vercel. This builds an environment from the declared
# requirements only, and imports the application in it the way the platform does.
#
# Run before every push. Five seconds, and it catches what the test suite cannot.
set -euo pipefail
cd "$(dirname "$0")"
ROOT_REQ="$(cd .. && pwd)/requirements.txt"
VENV="${TMPDIR:-/tmp}/proxid-deployable"

# Rebuild whenever the requirements change. Reusing a stale environment is how this
# check first passed while a dependency was missing, which makes it worthless.
STAMP="$VENV/.requirements-stamp"
if [ ! -x "$VENV/bin/python" ] || [ ! -f "$STAMP" ] || ! cmp -s "$ROOT_REQ" "$STAMP"; then
  echo "building a clean environment from requirements.txt"
  rm -rf "$VENV"
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q -r "$ROOT_REQ"
  cp "$ROOT_REQ" "$STAMP"
fi

echo "importing the application exactly as the platform does"
"$VENV/bin/python" - <<'PY'
import sys
sys.path.insert(0, ".")
from app.main import app
routes = len(app.routes)
assert routes > 40, f"only {routes} routes; the router did not load"
print(f"[OK] deployable: {routes} routes, imports with only declared requirements")
PY
