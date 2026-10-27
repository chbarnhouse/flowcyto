#!/usr/bin/env bash
#
# Deploy FlowCyto to the Proxmox homelab: static files served by python3's http.server as its
# own user and systemd unit inside a container (shares CT 150 with Step 1 Pathways). Reached
# through the Proxmox host with pct. Settings come from deploy.env (not committed):
#   PVE_HOST (ssh target), CTID, CT_IP, PORT, PUBLIC_URL, optional SSH_OPTS
#
#   ./deploy.sh            push the files, restart, verify
#   ./deploy.sh --setup    first run: also create the user and the systemd unit
set -euo pipefail

cd "$(dirname "$0")"
[ -f deploy.env ] && . ./deploy.env
: "${PVE_HOST:?set PVE_HOST in deploy.env}" "${CTID:?set CTID in deploy.env}" "${CT_IP:?set CT_IP in deploy.env}"
APPDIR="${APPDIR:-/opt/flowcyto}"
PORT="${PORT:-8020}"
PUBLIC_URL="${PUBLIC_URL:-}"
SSH="ssh ${SSH_OPTS:-}"; SCP="scp ${SSH_OPTS:-}"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "==> Checking every board still has one answer"
node tools/check.js 60 >/dev/null || { echo "!! deploy stopped: tools/check.js failed" >&2; exit 1; }

echo "==> Packing"
COPYFILE_DISABLE=1 tar czf "$STAGE/flowcyto.tgz" --no-xattrs index.html style.css game.css favicon.svg apple-touch-icon.png manifest.webmanifest icons js
$SCP -q "$STAGE/flowcyto.tgz" "$PVE_HOST:/tmp/flowcyto.tgz"

echo "==> Installing into CT $CTID:$APPDIR"
$SSH "$PVE_HOST" bash -s -- "$CTID" "$APPDIR" "$PORT" "${1:-}" <<'REMOTE'
set -euo pipefail
CTID="$1"; APPDIR="$2"; PORT="$3"; MODE="${4:-}"
pct push "$CTID" /tmp/flowcyto.tgz /tmp/flowcyto.tgz
if [[ "$MODE" == "--setup" ]]; then
  pct exec "$CTID" -- bash -c "
    id flowcyto >/dev/null 2>&1 || useradd --system --home $APPDIR --shell /usr/sbin/nologin flowcyto
    mkdir -p $APPDIR/app
    cat > /etc/systemd/system/flowcyto.service <<UNIT
[Unit]
Description=FlowCyto study game (static files)
After=network.target

[Service]
User=flowcyto
ExecStart=/usr/bin/python3 -m http.server $PORT --bind 0.0.0.0 --directory $APPDIR/app
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT
    systemctl daemon-reload
    systemctl enable flowcyto
  "
fi
# Unpack beside the live files and swap, so a failed extract never leaves it half-replaced.
pct exec "$CTID" -- bash -c "
  set -e
  rm -rf $APPDIR/app.new && mkdir -p $APPDIR/app.new
  tar xzf /tmp/flowcyto.tgz -C $APPDIR/app.new
  rm -rf $APPDIR/app.old
  [ -d $APPDIR/app ] && mv $APPDIR/app $APPDIR/app.old || true
  mv $APPDIR/app.new $APPDIR/app
  rm -rf $APPDIR/app.old /tmp/flowcyto.tgz
  chown -R flowcyto:flowcyto $APPDIR
  systemctl restart flowcyto
"
rm -f /tmp/flowcyto.tgz
REMOTE

echo "==> Verifying"
# the restarted server can take a few seconds to answer
ok=""; for i in 1 2 3 4 5 6; do
  sleep 2
  curl -fsS --max-time 10 "http://$CT_IP:$PORT/" | grep -q "<title>FlowCyto</title>" \
    && curl -fsS --max-time 10 "http://$CT_IP:$PORT/js/gen.js" | grep -q "function generate" && { ok=1; break; }
done
[ -n "$ok" ] || { echo "!! the page or its scripts did not load" >&2; exit 1; }
echo "==> OK — http://$CT_IP:$PORT  ${PUBLIC_URL:+·  $PUBLIC_URL}"
