#!/usr/bin/env bash
#
# Run the development server on a port of your choosing.
#
#   scripts/dev.sh           # 5173, the usual one
#   scripts/dev.sh 5174      # somewhere else, to leave 5173 running
#   scripts/dev.sh --local   # this machine's own database instead of the site's
#
# Signed in as `admin` from this machine without a password, the way the
# editor's preview does it. Set HANZI_DEV_USER yourself to sign in as someone
# else, or to an empty string to stop at the sign-in page like a tablet does:
#
#   HANZI_DEV_USER= scripts/dev.sh
#
# With POSTGRES_URL in .env this runs on the deployed site's database, so it is
# the same account and the same work as the site — nothing is copied, because
# there is only one copy. `--local` puts it back on the SQLite file for working
# without the internet, or for trying something out where it cannot matter.
set -euo pipefail

port=5173
for arg in "$@"; do
  case "$arg" in
    --local) export HANZI_DB="${HANZI_DB:-.data/hanzi-workshop.db}" ;;
    *) port="$arg" ;;
  esac
done

if ! [[ "$port" =~ ^[0-9]+$ ]] || (( port < 1 || port > 65535 )); then
  echo "dev.sh: “$port” is not a port number." >&2
  exit 2
fi

# Run from the repository root whichever directory this was called from, so
# the database, the data files and Vite's config are all found where expected.
cd "$(dirname "$0")/.."

# Homebrew's node first: the system one on a Mac is usually too old for tsx.
node="$(command -v /opt/homebrew/bin/node || command -v node || true)"
if [[ -z "$node" ]]; then
  echo "dev.sh: no node on this machine — install it with “brew install node”." >&2
  exit 1
fi

# The server prints its own message for a port in use, but it has opened the
# database by then; saying so first keeps that from happening at all.
if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "dev.sh: port $port is already in use — is the app already running?" >&2
  exit 1
fi

export PORT="$port"
export HANZI_DEV_USER="${HANZI_DEV_USER-admin}"

exec "$node" --disable-warning=ExperimentalWarning --import tsx server/src/dev.ts
