#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
/usr/bin/time -p bash -c 'echo "capture setup"'
/usr/bin/time -p test -n "${CAPTURE_URL:-}" || { echo 'Set CAPTURE_URL.' >&2; exit 1; }
/usr/bin/time -p test -n "${CAPTURE_DIR:-}" || { echo 'Set CAPTURE_DIR.' >&2; exit 1; }
/usr/bin/time -p test -n "${RUNTIME_DIR:-}" || { echo 'Set RUNTIME_DIR.' >&2; exit 1; }
/usr/bin/time -p mkdir -p "${CAPTURE_DIR:?}"
/usr/bin/time -p bash -c 'echo "capturing $CAPTURE_URL -> $CAPTURE_DIR"'
/usr/bin/time -p node "${RUNTIME_DIR:?}/scripts/default-capture.mjs"
/usr/bin/time -p bash -c 'ls -l "$CAPTURE_DIR/final-desktop.png" "$CAPTURE_DIR/final-mobile.png"'
/usr/bin/time -p bash -c 'python3 -c "import sys; ds=sys.argv[1:]; data=[open(p,\"rb\").read(8) for p in ds]; assert all(d==bytes.fromhex(\"89504e470d0a1a0a\") for d in data), \"not PNG\"; print(\"PNG OK\")" "$CAPTURE_DIR/final-desktop.png" "$CAPTURE_DIR/final-mobile.png"'
