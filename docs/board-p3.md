# Board P3 design note

## Goal

P3 turns the current single live `/go` board into a multi-board collaboration
surface while preserving the existing one-session path. This PR ships only
increment 1: a minimal session index/picker backed by `oracle_url_file`.

## Full P3 plan

### 1. Session index and picker

- Keep the current `oracle_url_file` contract: one non-empty URL still opens
  directly in the full-page `/go` iframe.
- Extend the same file additively: multiple non-empty lines represent multiple
  live boards. A line can be either:
  - `<session-url>` (label derived from `/s/<name>`), or
  - `<label>\t<session-url>` (explicit picker label).
- `/go` behavior:
  - zero sessions: `503 no active session`;
  - one session: current iframe behavior, no picker;
  - multiple sessions: render a lightweight server-side picker;
  - `/go?session=N`: render the selected board in the same iframe wrapper so
    session IDs and keys stay out of the browser address bar except inside the
    frame.

### 2. Board/BoardPut/BoardMove echo parity

- Current model: `Board` is the join snapshot, `BoardPut` adds/replaces a board
  item, `BoardMove` updates item coordinates, and `BoardDelete` removes it.
- P3 parity target: every mutating board message should have the same visible
  outcome for the sender and peers, whether it arrives as the initial `Board`
  snapshot or as later echo/broadcast messages.
- Implementation shape:
  - keep server validation and persistence centralized in session methods;
  - keep client reducers idempotent (`BoardPut` upsert, `BoardMove` no-op if
    unknown, delete releases stream URLs);
  - add protocol tests that drive two clients through add/move/delete and assert
    both clients converge.

### 3. Multi-item snapshot restore roundtrip

- Current snapshot restore persists board items and already has a single-item
  roundtrip test.
- P3 target: multi-item restore preserves independent image/stream placeholders,
  deduplicates by ID deterministically, rejects invalid entries, and truncates
  to server limits without corrupting valid items.
- Test shape:
  - snapshot at least three items with different kinds/positions/sizes;
  - restore and assert the full board snapshot matches expected items;
  - include one overwrite-by-ID case and one invalid-entry skip case when
    testing restore internals.

## Increment 1 delivered here

- Parse multiple sessions from `oracle_url_file` without changing the existing
  single-line behavior.
- Add a server-rendered `/go` picker for multi-line files.
- Add `/go?session=N` selection that reuses the existing iframe page.
- Avoid touching `Session.svelte`, because image-viewer work is expected to
  merge first.

## Deferred work

- Persist a richer session index source if newline text becomes insufficient.
- Add peer-convergence tests for `BoardPut`/`BoardMove` echo parity.
- Expand snapshot tests to cover multi-item restore and invalid/dedup cases.
