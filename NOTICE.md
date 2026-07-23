# NOTICE — Oracle Board (MEYD-605/maw-board)

## Product
**Oracle Board** is the MEYD / ClubsXai collaborative terminal + workboard
product. Command surface in the maw ecosystem: `maw board`.

## Upstream
This repository is derived from **sshx** by Eric Zhang:
https://github.com/ekzhang/sshx

The original work remains available under the MIT License. See `LICENSE` for the
upstream copyright notice (Copyright (c) 2023 Eric Zhang).

## MEYD modifications
Copyright (c) 2026 MEYD-605 and contributors (Oracle Board productization,
workboard extensions, password gate, /go, sysstat, packaging).

## Branding
User-facing product name is **Oracle Board**, not "sshx". Some internal crate
and protocol identifiers may still use the historical `sshx` name for
compatibility; that does not imply product identity.

## Crypto
Session key-stretching salts that embed the historical string `sshx.io` are
**compatibility constants** and must not be changed lightly (would break
existing session URLs).
