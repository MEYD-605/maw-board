# Security model

This document describes the confidentiality boundary for the maw-board
deployment as it exists today. It is intentionally precise about what is
end-to-end encrypted and what is only protected by the board access gate plus
transport security.

## Current boundary

The browser-visible board is private only to callers who can pass the
`SSHX_BOARD_PASSWORD` gate and reach the service over TLS. The board layer is
not part of sshx's Argon2/AES end-to-end encryption scheme.

When `SSHX_BOARD_PASSWORD` is configured, the server requires a signed
`sshx_board_auth` cookie for:

- `/go`, the board entry point that embeds the active session URL;
- direct `/s/*` browser session URLs;
- `/api/s/*`, including the WebSocket upgrade used by the live session; and
- `/api/files` and `/api/file`, the read-only file browser APIs.

When `SSHX_BOARD_PASSWORD` is not configured, this HTTP board gate is disabled.
In that mode, board confidentiality depends on network and deployment controls
only.

## What is end-to-end encrypted

Terminal stream data uses sshx's client-side key flow: the terminal key is
stretched with Argon2 and used with AES for terminal byte streams between the
terminal source and browser client. The server routes encrypted terminal chunks
and does not need the terminal plaintext to proxy the stream.

This terminal encryption boundary does not currently cover board items.

## What is not end-to-end encrypted

Board state is sent to the server as plaintext WebSocket messages. This includes
notes, document/file-view board entries, image data URLs, and small shared video
data URLs. The server accepts `boardPut` messages containing raw board item
payloads, keeps them in session state, broadcasts them to peers, and includes
them in persisted/snapshotted board state.

Therefore, anyone who can observe server-side WebSocket payloads, server memory,
logs that include board payloads, Redis/session snapshots, or storage backups
containing snapshots must be treated as able to read board content. TLS protects
board traffic on the network between the browser and the deployment endpoint,
but TLS terminates before server-side processing and persistence.

## Threat model summary

Protected today:

- passive network observers outside the TLS endpoint;
- unauthenticated browsers when `SSHX_BOARD_PASSWORD` is configured; and
- casual discovery of `/go`, `/s/*`, WebSocket, and file API routes without the
  board auth cookie.

Not protected today:

- a compromised or malicious application server;
- server-side memory inspection;
- Redis/session snapshot readers;
- reverse proxies or infrastructure components that terminate TLS and can see
  plaintext HTTP/WebSocket payloads; and
- authorized board users, who receive plaintext board items by design.

The file browser APIs have separate path confinement and denylist protections
(`safe_join`, `confine_to_root`, dotfile blocking, and credential-name
blocking). Those controls reduce accidental file disclosure through the board
UI, but they do not make board payloads end-to-end encrypted once a file's text
is opened and shared as a board item.

## Follow-up: board end-to-end encryption

A future PR should extend the existing client encryption boundary to board
payloads before they are sent via `boardPut` and decrypt them on receive. A
minimal shape for that work:

1. Add board-payload encryption/decryption helpers in `src/lib/encrypt.ts`,
   reusing the session key material with domain-separated stream numbers or a
   separate board key derivation.
2. Encrypt board `dataUrl` and text/document payload fields in
   `src/lib/Session.svelte` before `srocket.send({ boardPut: item })`.
3. Decrypt received board items before `upsertBoardItem`, while keeping legacy
   plaintext handling for migration if needed.
4. Ensure Redis/session snapshots only contain encrypted board payload fields.
5. Add cross-client tests for image/note/file-view board items and downgrade or
   migration behavior.

That follow-up should be reviewed as a protocol change. This PR documents the
current boundary and hardens test coverage for the existing password gate only.
