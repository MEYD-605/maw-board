<script lang="ts">
  import { createEventDispatcher } from "svelte";
  import {
    XIcon,
    SearchIcon,
    Minimize2Icon,
    Maximize2Icon,
  } from "svelte-feather-icons";

  export let open = false;

  const dispatch = createEventDispatcher<{ close: void }>();

  let query = "";
  let active = ""; // the query currently loaded into the player
  let minimized = false;

  function play() {
    const q = query.trim();
    if (q) active = q;
  }

  // YouTube's IFrame embed can search-and-play with `listType=search` — no API
  // key needed. First match autoplays; the player's next/prev walk the results.
  // Accept a pasted link too (extract the id) for power users.
  function parseId(input: string): string {
    const patterns = [
      /(?:youtu\.be\/)([\w-]{11})/,
      /(?:[?&]v=)([\w-]{11})/,
      /(?:\/embed\/)([\w-]{11})/,
      /(?:\/shorts\/)([\w-]{11})/,
    ];
    for (const re of patterns) {
      const m = input.match(re);
      if (m) return m[1];
    }
    return "";
  }

  $: embedSrc = (() => {
    if (!active) return "";
    const id = parseId(active);
    if (id) return `https://www.youtube.com/embed/${id}?autoplay=1`;
    return `https://www.youtube.com/embed?listType=search&list=${encodeURIComponent(
      active,
    )}&autoplay=1`;
  })();
</script>

{#if open}
  <div class="yt-popup panel" class:min={minimized}>
    <div class="head">
      <span class="title">
        🎵 {minimized && active ? active : "YouTube Music"}
      </span>
      <div class="actions">
        <button
          class="icon-btn"
          title={minimized ? "Expand" : "Hide (keeps playing)"}
          on:click={() => (minimized = !minimized)}
        >
          {#if minimized}
            <Maximize2Icon size="14" />
          {:else}
            <Minimize2Icon size="14" />
          {/if}
        </button>
        <button
          class="icon-btn"
          title="Close"
          on:click={() => dispatch("close")}
        >
          <XIcon size="16" />
        </button>
      </div>
    </div>
    <!-- Body stays mounted while minimized (clipped, not removed) so the audio
         keeps playing — destroying the iframe would stop the music. -->
    <div class="body" class:clipped={minimized}>
      <form class="row" on:submit|preventDefault={play}>
        <!-- svelte-ignore a11y-autofocus -->
        <input
          class="url"
          placeholder="Search a song…"
          bind:value={query}
          autofocus
        />
        <button class="go" type="submit" title="Search">
          <SearchIcon size="16" />
        </button>
      </form>
      {#if embedSrc}
        <div class="frame">
          <iframe
            title="YouTube Music player"
            src={embedSrc}
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            allowfullscreen
          />
        </div>
      {:else}
        <p class="hint">
          Search a song and hit play to listen while you work 🎵
        </p>
      {/if}
    </div>
  </div>
{/if}

<style lang="postcss">
  .yt-popup {
    @apply fixed z-40 flex flex-col overflow-hidden;
    @apply left-2 right-2 bottom-2 sm:left-auto sm:right-4 sm:w-96;
    max-height: 70vh;
  }
  /* Minimized: collapse to the header pill, hug the corner. */
  .yt-popup.min {
    @apply left-auto right-2 sm:right-4 w-auto max-w-[70vw];
  }
  .head {
    @apply flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-700/60;
  }
  .yt-popup.min .head {
    @apply border-b-0;
  }
  .title {
    @apply text-sm font-medium text-red-400 truncate;
  }
  .actions {
    @apply flex items-center gap-1 shrink-0;
  }
  .icon-btn {
    @apply p-1 rounded hover:bg-white/5 text-zinc-400;
  }
  .body {
    @apply p-3 flex flex-col gap-2 transition-all duration-200;
  }
  /* Clip (don't unmount) so the iframe keeps playing while hidden. */
  .body.clipped {
    @apply p-0 max-h-0 opacity-0 pointer-events-none;
  }
  .row {
    @apply flex gap-2;
  }
  .url {
    @apply flex-1 px-3 py-2 text-sm rounded-md bg-transparent border border-zinc-700;
    @apply outline-none focus:ring-2 focus:ring-indigo-500/50;
  }
  .go {
    @apply px-3 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-500;
    @apply grid place-items-center;
  }
  .frame {
    @apply relative w-full rounded-md overflow-hidden;
    aspect-ratio: 16 / 9;
  }
  .frame iframe {
    @apply absolute inset-0 w-full h-full border-0;
  }
  .hint {
    @apply text-xs text-zinc-400 text-center py-4;
  }
</style>
