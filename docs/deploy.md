# Production deploy

maw-board production is a self-hosted VPS behind Cloudflare. The running process
is `sshx-server`; it is not deployed through Fly.io.

## Current production shape

- Public edge: Cloudflare DNS/proxy.
- Origin: VPS running systemd.
- Service: `sshx-server.service`.
- Binary: `/opt/maw-board/bin/sshx-server`.
- Default listener: `127.0.0.1:8051`.
- Health check: loopback `GET http://127.0.0.1:8051/api/healthz` must return
  `200`.
- Environment file: `/etc/maw-board/sshx-server.env`.

The health endpoint is intentionally local-only. Poll it from the VPS, not from
the public Cloudflare hostname.

## One-time VPS setup

```sh
sudo install -d -o maw-board -g maw-board /opt/maw-board/bin /opt/maw-board/app
sudo install -d -m 0755 /etc/maw-board
sudo install -m 0644 deploy/sshx-server.service /etc/systemd/system/sshx-server.service
sudo systemctl daemon-reload
sudo systemctl enable sshx-server.service
```

Populate `/etc/maw-board/sshx-server.env` with production secrets and options,
for example:

```sh
SSHX_SECRET=change-me
SSHX_BOARD_PASSWORD=change-me
SSHX_ORACLE_URL_FILE=/var/lib/maw-board/oracle-url
RUST_LOG=info
```

Keep Cloudflare pointed at the VPS origin path that reaches the local
`sshx-server` listener, typically through the host reverse proxy or tunnel.

## Deploy / swap

Run this on the VPS from a checked-out repo:

```sh
deploy/swap.sh
```

The script:

1. builds `sshx-server` with `cargo build --release --bin sshx-server`,
2. atomically swaps `/opt/maw-board/bin/sshx-server`,
3. restarts `sshx-server.service`,
4. polls the loopback `/api/healthz` endpoint until it returns `200`, and
5. restores the previous binary and restarts the service if health does not
   pass.

Useful overrides:

```sh
SERVICE=sshx-server.service \
LIVE_BINARY=/opt/maw-board/bin/sshx-server \
HEALTH_URL=http://127.0.0.1:8051/api/healthz \
deploy/swap.sh
```

## Unused upstream deploy files

`fly.toml`, `Dockerfile`, and `scripts/release.sh` are inherited from upstream
sshx packaging/release flows. They are stale for maw-board production and should
not be treated as the live deploy path. The legacy Fly deploy job in
`.github/workflows/ci.yaml` is disabled for the same reason. Keep these files
only as upstream reference until a separate cleanup removes or replaces them
intentionally.

## Manual GitHub Actions CD

`.github/workflows/deploy-vps.yml` provides an optional manual dispatch job. It
SSHes to the VPS, checks out the requested ref in an existing repo path, and
runs `deploy/swap.sh` there.

Required repository secrets:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- optional `VPS_PORT`
- optional `VPS_REPO_PATH` variable, defaulting to `/opt/maw-board/app`
