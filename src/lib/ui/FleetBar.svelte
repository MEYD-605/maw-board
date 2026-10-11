<script lang="ts">
  import { createEventDispatcher } from "svelte";

  const dispatch = createEventDispatcher<{
    select: string;
    detach: void;
    create: void;
  }>();

  export let canEdit = true;

  const agents = [
    { code: "00", name: "00 gmgrok", icon: "🤖", color: "#34d399" },
    { code: "01", name: "01 No.1", icon: "👑", color: "#fbbf24" },
    { code: "02", name: "02 Wizard", icon: "🧙", color: "#a855f7" },
    { code: "04", name: "04 Mimo", icon: "📱", color: "#38bdf8" },
    { code: "05", name: "05 GmForge", icon: "🔨", color: "#ff6b35" },
    { code: "06", name: "06 Gemini", icon: "🔮", color: "#60a5fa" },
    { code: "08", name: "08 Agy", icon: "🎨", color: "#f472b6" },
    { code: "88", name: "88 Sombo", icon: "🛡️", color: "#4ade80" },
  ];
</script>

<div class="fleet-bar">
  <div class="chips-scroll">
    {#each agents as a}
      <button
        type="button"
        class="f-chip"
        style="--accent: {a.color};"
        title="เปิด {a.name} ใน tmux"
        disabled={!canEdit}
        on:click={() => dispatch("select", a.code)}
      >
        <span class="icon">{a.icon}</span>
        <span class="label">{a.name}</span>
      </button>
    {/each}

    <div class="divider" />

    <button
      type="button"
      class="f-chip detach-btn"
      title="ออกจาก session กลับหน้าเมนูหลัก (Ctrl-B D)"
      disabled={!canEdit}
      on:click={() => dispatch("detach")}
    >
      <span class="icon">↩️</span>
      <span class="label">กลับเมนู</span>
    </button>

    <button
      type="button"
      class="f-chip create-btn"
      title="เปิด Terminal หน้าต่างใหม่"
      disabled={!canEdit}
      on:click={() => dispatch("create")}
    >
      <span class="icon">➕</span>
      <span class="label">หน้าต่างใหม่</span>
    </button>
  </div>
</div>

<style lang="postcss">
  .fleet-bar {
    @apply fixed left-1/2 bottom-4 z-40 -translate-x-1/2 max-w-[calc(100vw-16px)] select-none;
    @apply p-1.5 rounded-2xl bg-zinc-900/90 border border-zinc-700/80 shadow-2xl backdrop-blur-md;
  }
  .chips-scroll {
    @apply flex items-center gap-1.5 overflow-x-auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .chips-scroll::-webkit-scrollbar {
    display: none;
  }
  .f-chip {
    @apply flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl font-mono text-xs font-semibold;
    @apply bg-zinc-800/80 text-zinc-200 border border-zinc-700/60 transition-all duration-150;
    @apply hover:bg-zinc-700 hover:text-white active:scale-95;
    @apply disabled:opacity-40 disabled:pointer-events-none;
    white-space: nowrap;
  }
  .f-chip:hover {
    border-color: var(--accent, #6366f1);
    box-shadow: 0 0 12px var(--accent, #6366f1) 40;
  }
  .f-chip .icon {
    @apply text-sm leading-none;
  }
  .divider {
    @apply h-5 w-[1px] bg-zinc-700 mx-0.5 flex-shrink-0;
  }
  .detach-btn {
    @apply bg-amber-950/40 text-amber-300 border-amber-600/40 hover:bg-amber-900/60 hover:text-amber-100;
  }
  .create-btn {
    @apply bg-indigo-950/40 text-indigo-300 border-indigo-600/40 hover:bg-indigo-900/60 hover:text-indigo-100;
  }
</style>
