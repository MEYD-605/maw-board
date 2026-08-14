<script lang="ts">
  import { onDestroy, onMount, createEventDispatcher } from "svelte";
  import { XIcon, MoveIcon } from "svelte-feather-icons";

  const STORAGE_KEY = "sshx:numpad-position";
  const PANEL_W = 292;
  const PANEL_H = 452; // tall enough for the keypad arrows + snap page
  const MARGIN = 12;

  const dispatch = createEventDispatcher<{
    press: string;
    snap: string;
    close: void;
  }>();

  let x = 0;
  let y = 0;
  let dragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let pointerId: number | null = null;

  const rows: string[][] = [
    ["7", "8", "9"],
    ["4", "5", "6"],
    ["1", "2", "3"],
    ["0", ".", "Enter", "Backspace"],
    ["ArrowLeft", "ArrowDown", "ArrowUp", "ArrowRight"],
  ];

  const keyLabel: Record<string, string> = {
    Backspace: "Bksp",
    ArrowLeft: "←",
    ArrowDown: "↓",
    ArrowUp: "↑",
    ArrowRight: "→",
  };

  const snapGroups = [
    [
      { a: "leftHalf", g: "◧", k: "⌃⌥←", t: "Left half" },
      { a: "rightHalf", g: "◨", k: "⌃⌥→", t: "Right half" },
      { a: "topHalf", g: "⬒", k: "⌃⌥↑", t: "Top half" },
      { a: "bottomHalf", g: "⬓", k: "⌃⌥↓", t: "Bottom half" },
    ],
    [
      { a: "topLeft", g: "◰", k: "⌃⌥U", t: "Top-left quarter" },
      { a: "topRight", g: "◳", k: "⌃⌥I", t: "Top-right quarter" },
      { a: "bottomLeft", g: "◱", k: "⌃⌥J", t: "Bottom-left quarter" },
      { a: "bottomRight", g: "◲", k: "⌃⌥K", t: "Bottom-right quarter" },
    ],
    [
      { a: "maximize", g: "⬜", k: "⌃⌥F", t: "Maximize" },
      { a: "center", g: "⊡", k: "⌃⌥C", t: "Center" },
      { a: "firstThird", g: "⅓", k: "⌃⌥1", t: "First third" },
      { a: "centerThird", g: "⅓", k: "⌃⌥2", t: "Center third" },
      { a: "lastThird", g: "⅓", k: "⌃⌥3", t: "Last third" },
      { a: "restore", g: "↩", k: "⌃⌥0", t: "Restore previous layout" },
    ],
  ];

  // ── Three pages: keypad + calculator + focused-terminal snap controls ──
  let page: "pad" | "calc" | "snap" = "pad";

  // Classic calculator state machine — evaluates left-to-right like a physical
  // calculator (no operator precedence), so it matches what people expect from
  // a keypad calc. Plain arithmetic only; no dynamic code execution.
  let calcEntry = "0";
  let calcAcc: number | null = null;
  let calcOp: string | null = null;
  let calcReplace = true; // next digit starts a fresh entry

  const OPS = ["÷", "×", "−", "+"];
  const calcRows: string[][] = [
    ["C", "⌫", "÷", "×"],
    ["7", "8", "9", "−"],
    ["4", "5", "6", "+"],
    ["1", "2", "3", "="],
  ];

  function fmt(n: number): string {
    if (!isFinite(n)) return "Error";
    return String(Math.round(n * 1e10) / 1e10); // trim binary-float noise
  }

  function calcApply(a: number, b: number, op: string): number {
    if (op === "+") return a + b;
    if (op === "−") return a - b;
    if (op === "×") return a * b;
    if (op === "÷") return b === 0 ? NaN : a / b;
    return b;
  }

  function calcDigit(d: string) {
    if (calcEntry === "Error") calcClear();
    if (d === ".") {
      if (calcReplace) {
        calcEntry = "0.";
        calcReplace = false;
      } else if (!calcEntry.includes(".")) {
        calcEntry += ".";
      }
      return;
    }
    if (calcReplace) {
      calcEntry = d;
      calcReplace = false;
    } else {
      calcEntry = calcEntry === "0" ? d : calcEntry + d;
    }
  }

  function calcOperator(op: string) {
    if (calcEntry === "Error") return;
    const cur = parseFloat(calcEntry);
    if (calcAcc === null) calcAcc = cur;
    else if (!calcReplace) calcAcc = calcApply(calcAcc, cur, calcOp ?? "+");
    calcOp = op;
    calcReplace = true;
    calcEntry = fmt(calcAcc);
  }

  function calcEquals() {
    if (calcOp === null || calcAcc === null) return;
    calcEntry = fmt(calcApply(calcAcc, parseFloat(calcEntry), calcOp));
    calcAcc = null;
    calcOp = null;
    calcReplace = true;
  }

  function calcClear() {
    calcEntry = "0";
    calcAcc = null;
    calcOp = null;
    calcReplace = true;
  }

  function calcBack() {
    if (calcReplace || calcEntry === "Error") return;
    calcEntry = calcEntry.length > 1 ? calcEntry.slice(0, -1) : "0";
    if (calcEntry === "" || calcEntry === "-") calcEntry = "0";
  }

  function calcKey(k: string) {
    if (k === "C") calcClear();
    else if (k === "⌫") calcBack();
    else if (k === "=") calcEquals();
    else if (OPS.includes(k)) calcOperator(k);
    else calcDigit(k);
  }

  // Push the current result into the focused terminal (reuses the same dispatch
  // path as the keypad, so it honors canEdit and target selection).
  function calcSend() {
    if (calcEntry !== "Error") dispatch("press", calcEntry);
  }

  function tap(event: PointerEvent, fn: () => void) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    fn();
  }

  function clampPosition(nx: number, ny: number) {
    const maxX = Math.max(MARGIN, window.innerWidth - PANEL_W - MARGIN);
    const maxY = Math.max(MARGIN, window.innerHeight - PANEL_H - MARGIN);
    return {
      x: Math.min(Math.max(MARGIN, nx), maxX),
      y: Math.min(Math.max(MARGIN, ny), maxY),
    };
  }

  function savePosition() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ x, y }));
    } catch {
      // Ignore private-mode storage failures; position memory is a convenience.
    }
  }

  function loadPosition() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const pos = JSON.parse(stored);
        if (typeof pos?.x === "number" && typeof pos?.y === "number") {
          ({ x, y } = clampPosition(pos.x, pos.y));
          return;
        }
      }
    } catch {
      // Fall through to the default thumb-friendly lower-right placement.
    }
    ({ x, y } = clampPosition(
      window.innerWidth - PANEL_W - 16,
      window.innerHeight - PANEL_H - 24,
    ));
  }

  function startDrag(event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dragging = true;
    pointerId = event.pointerId;
    dragOffsetX = event.clientX - x;
    dragOffsetY = event.clientY - y;
  }

  function onMove(event: PointerEvent) {
    if (!dragging || (pointerId !== null && event.pointerId !== pointerId))
      return;
    event.preventDefault();
    const pos = clampPosition(
      event.clientX - dragOffsetX,
      event.clientY - dragOffsetY,
    );
    x = pos.x;
    y = pos.y;
  }

  function endDrag(event: PointerEvent) {
    if (!dragging || (pointerId !== null && event.pointerId !== pointerId))
      return;
    dragging = false;
    pointerId = null;
    savePosition();
  }

  function handleResize() {
    const pos = clampPosition(x, y);
    x = pos.x;
    y = pos.y;
    savePosition();
  }

  function press(key: string, event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dispatch("press", key);
  }

  function snap(action: string, event: PointerEvent) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    dispatch("snap", action);
  }

  onMount(() => {
    loadPosition();
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    window.addEventListener("resize", handleResize);
  });

  onDestroy(() => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    window.removeEventListener("resize", handleResize);
  });
</script>

<div
  class="numpad"
  class:dragging
  style:left={`${x}px`}
  style:top={`${y}px`}
  on:pointerdown={(event) => event.stopPropagation()}
>
  <div class="handle" on:pointerdown={startDrag}>
    <MoveIcon size="16" />
    <div class="tabs">
      <button
        class="tab"
        class:active={page === "pad"}
        on:pointerdown={(event) => tap(event, () => (page = "pad"))}
      >
        123
      </button>
      <button
        class="tab"
        class:active={page === "calc"}
        on:pointerdown={(event) => tap(event, () => (page = "calc"))}
      >
        Calc
      </button>
      <button
        class="tab"
        class:active={page === "snap"}
        on:pointerdown={(event) => tap(event, () => (page = "snap"))}
      >
        Snap
      </button>
    </div>
    <button
      class="close"
      title="Hide numpad"
      on:pointerdown={(event) => tap(event, () => dispatch("close"))}
    >
      <XIcon size="16" />
    </button>
  </div>

  {#if page === "pad"}
    <div class="keys">
      {#each rows as row}
        <div
          class="key-row"
          style:grid-template-columns={`repeat(${row.length}, minmax(0, 1fr))`}
        >
          {#each row as key}
            <button
              class="key"
              class:wide={key === "Enter" || key === "Backspace"}
              class:arrow={key.startsWith("Arrow")}
              title={key}
              on:pointerdown={(event) => press(key, event)}
            >
              {keyLabel[key] ?? key}
            </button>
          {/each}
        </div>
      {/each}
    </div>
  {:else if page === "calc"}
    <div class="calc">
      <div class="display" title={calcEntry}>{calcEntry}</div>
      <div class="calc-grid">
        {#each calcRows as row}
          {#each row as k}
            <button
              class="key calc-key"
              class:op={OPS.includes(k)}
              class:eq={k === "="}
              class:util={k === "C" || k === "⌫"}
              title={k}
              on:pointerdown={(event) => tap(event, () => calcKey(k))}
            >
              {k}
            </button>
          {/each}
        {/each}
        <button
          class="key calc-key zero"
          title="0"
          on:pointerdown={(event) => tap(event, () => calcKey("0"))}
        >
          0
        </button>
        <button
          class="key calc-key"
          title="."
          on:pointerdown={(event) => tap(event, () => calcKey("."))}
        >
          .
        </button>
        <button
          class="key calc-key send"
          title="Send result to terminal"
          on:pointerdown={(event) => tap(event, calcSend)}
        >
          ↵
        </button>
      </div>
    </div>
  {:else}
    <div class="snap">
      {#each snapGroups as group}
        <div class="snap-grid">
          {#each group as s}
            <button
              class="snap-key"
              title={s.t}
              on:pointerdown={(event) => snap(s.a, event)}
            >
              <span class="snap-icon">{s.g}</span>
              <span class="snap-shortcut">{s.k}</span>
            </button>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style lang="postcss">
  .numpad {
    @apply fixed z-50 w-[292px] max-w-[calc(100vw-24px)] rounded-lg border border-zinc-700 bg-zinc-900/95 shadow-2xl backdrop-blur-md;
    @apply text-zinc-100 select-none overflow-hidden;
  }

  .numpad.dragging {
    @apply shadow-indigo-900/40;
  }

  .handle {
    @apply flex items-center gap-2 px-3 py-2 border-b border-zinc-700/70 text-sm font-medium text-zinc-300 cursor-move touch-none;
  }

  .close {
    @apply ml-auto rounded-md p-1 text-zinc-400 hover:bg-zinc-700 hover:text-white active:bg-indigo-600;
  }

  .tabs {
    @apply flex gap-1;
  }
  .tab {
    @apply rounded px-2 py-0.5 text-xs font-semibold text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100;
  }
  .tab.active {
    @apply bg-indigo-600 text-white;
  }

  .calc {
    @apply flex flex-col gap-2 p-3;
  }
  .display {
    @apply flex h-12 items-center justify-end overflow-hidden rounded-lg bg-zinc-950 px-3 font-mono text-2xl text-zinc-100;
  }
  .calc-grid {
    @apply grid grid-cols-4 gap-2;
  }
  .calc-key {
    @apply h-12 rounded-lg bg-zinc-800 text-lg font-semibold text-zinc-100 shadow-sm;
    @apply hover:bg-zinc-700 active:bg-indigo-600 active:text-white;
    @apply focus:outline-none focus:ring-2 focus:ring-indigo-500/70;
    touch-action: manipulation;
  }
  .calc-key.op {
    @apply bg-zinc-700 text-indigo-300;
  }
  .calc-key.util {
    @apply text-zinc-400;
  }
  .calc-key.eq {
    @apply bg-indigo-600 text-white;
  }
  .calc-key.send {
    @apply bg-emerald-700 text-white hover:bg-emerald-600;
  }
  .calc-key.zero {
    grid-column: span 2;
  }

  .keys {
    @apply flex flex-col gap-2 p-3;
  }

  .key-row {
    @apply grid gap-2;
  }

  .key {
    @apply h-14 rounded-lg bg-zinc-800 text-xl font-semibold text-zinc-100 shadow-sm;
    @apply hover:bg-zinc-700 active:bg-indigo-600 active:text-white;
    @apply focus:outline-none focus:ring-2 focus:ring-indigo-500/70;
    touch-action: manipulation;
  }

  .key.wide {
    @apply text-sm;
  }
  .key.arrow {
    @apply bg-zinc-700 text-indigo-200;
  }

  .snap {
    @apply flex flex-col gap-2 p-3;
  }
  .snap-grid {
    @apply grid grid-cols-4 gap-2;
  }
  .snap-key {
    @apply flex h-14 flex-col items-center justify-center rounded-lg bg-zinc-800 text-zinc-100 shadow-sm;
    @apply hover:bg-indigo-600 hover:text-white active:bg-indigo-500;
    @apply focus:outline-none focus:ring-2 focus:ring-indigo-500/70;
    touch-action: manipulation;
  }
  .snap-icon {
    @apply text-lg leading-none;
  }
  .snap-shortcut {
    @apply mt-1 text-[10px] font-semibold leading-none text-zinc-400;
  }
  .snap-key:hover .snap-shortcut,
  .snap-key:active .snap-shortcut {
    @apply text-white/80;
  }

  @media (hover: none), (pointer: coarse) {
    .numpad {
      @apply w-[304px];
    }
    .key {
      @apply h-16 text-2xl;
    }
    .key.wide {
      @apply text-base;
    }
    .calc-key {
      @apply h-14 text-xl;
    }
    .snap-key {
      @apply h-16;
    }
    .snap-icon {
      @apply text-2xl;
    }
    .snap-shortcut {
      @apply text-[11px];
    }
    .display {
      @apply h-14 text-3xl;
    }
  }
</style>
