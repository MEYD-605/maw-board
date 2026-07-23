# Oracle Board

**MEYD-605 / ClubsXai** collaborative terminal + workboard.

Product name: **Oracle Board**  
CLI (maw ecosystem): **`maw board`**  
Runtime repo: this tree (`MEYD-605/maw-board`)  
Plugin: [`MEYD-605/maw-workboard`](https://github.com/MEYD-605/maw-workboard)

> Derived from open-source [sshx](https://github.com/ekzhang/sshx) (Eric Zhang, MIT).  
> Upstream attribution is required — see `LICENSE` and `NOTICE.md`.  
> User-facing brand is **Oracle Board**, not “sshx”.

## Features (Oracle product)

- Shared multiplayer terminal canvas (`/go` permanent entry)
- Password gate, sysstat / Oracle Board monitor dropdown
- File explorer, workboard extras (voice/image/board UI in fleet builds)
- Sidecar lifecycle via `maw board install|serve|status|stop`

## Install (friends / houses)

```sh
# 1) Plugin
maw plugin install MEYD-605/maw-workboard

# 2) Prebuilt runtime (no Rust toolchain required)
# Download workboard-prebuilt-<os>.tar.gz from:
#   https://github.com/MEYD-605/maw-ssh/releases/tag/workboard-v0.1.0
maw board install --prebuilt ./workboard-prebuilt-<os>.tar.gz

# 3) Run
export SSHX_BOARD_PASSWORD='…'          # optional
export SSHX_BOARD_SHELL="$HOME/.sshx-shell.sh"  # oracle-menu loop
maw board serve --no-open --password "$SSHX_BOARD_PASSWORD"
```

Open: `http://127.0.0.1:3457/go`

Oracle-menu templates: see `maw-workboard/templates/friend-house/` when packed.

## Development

```sh
# Rust + protoc + Bun
git clone https://github.com/MEYD-605/maw-board
cd maw-board && bun install
maw board install --source .
```

## Branding policy

| Layer | Name |
|-------|------|
| Product (search / docs / UI title) | **Oracle Board** |
| maw CLI | `maw board` / `maw workboard` |
| Internal crates (compat) | may still use `sshx*` identifiers |
| Crypto salts mentioning `sshx.io` | **do not change** (session compatibility) |

## License

MIT — see `LICENSE` (upstream copyright) and `NOTICE.md` (MEYD product notice).
