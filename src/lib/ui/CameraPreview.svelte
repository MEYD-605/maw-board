<!--
  Floating, draggable + resizable local/remote camera preview window.
  Appears when the user turns their camera on or a remote video track arrives.
-->
<script lang="ts">
  import { createEventDispatcher, onDestroy } from "svelte";
  import { XIcon, VideoIcon } from "svelte-feather-icons";

  export let stream: MediaStream;
  export let label: string = "Camera";
  export let mirror: boolean = true; // mirror local self-view, not remote peers
  export let closable: boolean = true;
  export let index: number = 0; // stagger multiple windows so they don't overlap
  /** Optional ICE / connection status shown under the label (remote only). */
  export let status: string = "";

  const dispatch = createEventDispatcher<{ close: void }>();

  // Window geometry (px). Default: stack down the top-right corner.
  let x =
    (typeof window !== "undefined" ? window.innerWidth - 320 : 40) -
    index * 24;
  let y = 84 + index * 232;
  let w = 288;
  let h = 216;
  let videoEl: HTMLVideoElement | null = null;
  let hasFrame = false;

  const MIN_W = 160;
  const MIN_H = 120;

  // Bind the MediaStream to the <video> element (srcObject is not an attribute).
  // Also call play() — autoplay alone is flaky on some Safari/remote tracks.
  function bindStream(node: HTMLVideoElement, s: MediaStream) {
    videoEl = node;
    node.srcObject = s;
    hasFrame = false;
    const tryPlay = () => {
      node.play().catch(() => {});
    };
    tryPlay();
    const onMeta = () => tryPlay();
    const onPlaying = () => {
      hasFrame = true;
    };
    const onWaiting = () => {
      // Keep hasFrame true once we've seen pixels; waiting is temporary.
    };
    node.addEventListener("loadedmetadata", onMeta);
    node.addEventListener("playing", onPlaying);
    // When track unmutes after ICE connects, force play again.
    const tracks = s.getVideoTracks();
    const onUnmute = () => tryPlay();
    for (const t of tracks) t.addEventListener("unmute", onUnmute);
    return {
      update(s2: MediaStream) {
        if (node.srcObject !== s2) {
          node.srcObject = s2;
          hasFrame = false;
          tryPlay();
        }
      },
      destroy() {
        node.removeEventListener("loadedmetadata", onMeta);
        node.removeEventListener("playing", onPlaying);
        for (const t of tracks) t.removeEventListener("unmute", onUnmute);
        node.srcObject = null;
      },
    };
  }

  // Re-bind when stream identity changes (Svelte may not re-run action).
  $: if (videoEl && stream && videoEl.srcObject !== stream) {
    videoEl.srcObject = stream;
    hasFrame = false;
    videoEl.play().catch(() => {});
  }

  function startDrag(event: PointerEvent) {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const ox = event.clientX - x;
    const oy = event.clientY - y;
    function onMove(e: PointerEvent) {
      x = Math.max(0, Math.min(window.innerWidth - 40, e.clientX - ox));
      y = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - oy));
    }
    function onUp(_e: PointerEvent) {
      target.releasePointerCapture(event.pointerId);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
    }
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
  }

  function startResize(event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);
    const ow = w - event.clientX;
    const oh = h - event.clientY;
    function onMove(e: PointerEvent) {
      w = Math.max(MIN_W, ow + e.clientX);
      h = Math.max(MIN_H, oh + e.clientY);
    }
    function onUp() {
      target.releasePointerCapture(event.pointerId);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
    }
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
  }

  onDestroy(() => {
    if (videoEl) videoEl.srcObject = null;
  });
</script>

<div
  class="cam-window panel"
  style:left={`${x}px`}
  style:top={`${y}px`}
  style:width={`${w}px`}
  style:height={`${h}px`}
>
  <div class="cam-header" on:pointerdown={startDrag}>
    <div class="flex items-center gap-1.5 text-xs text-zinc-300 font-medium min-w-0">
      <VideoIcon size="14" />
      <span class="truncate">{label}</span>
      {#if status}
        <span class="cam-status truncate" title={status}>{status}</span>
      {/if}
    </div>
    {#if closable}
      <button class="cam-close" title="Turn camera off" on:click={() => dispatch("close")}>
        <XIcon size="14" />
      </button>
    {/if}
  </div>

  <!-- svelte-ignore a11y-media-has-caption -->
  <video
    class="cam-video"
    class:mirror
    autoplay
    playsinline
    muted
    use:bindStream={stream}
  />

  {#if !hasFrame && status}
    <div class="cam-overlay">{status}</div>
  {:else if !hasFrame}
    <div class="cam-overlay">Connecting video…</div>
  {/if}

  <!-- Resize handle (bottom-right) -->
  <div class="cam-resize" on:pointerdown={startResize} title="Resize" />
</div>

<style lang="postcss">
  .cam-window {
    @apply fixed z-50 flex flex-col overflow-hidden p-0;
  }

  .cam-header {
    @apply flex items-center justify-between px-2.5 py-1.5 cursor-move select-none;
    @apply bg-zinc-800/70 border-b border-zinc-700/60;
    touch-action: none;
  }

  .cam-close {
    @apply rounded-md p-0.5 text-zinc-400 hover:text-white hover:bg-zinc-700/60 transition-colors;
  }

  .cam-status {
    @apply text-[10px] font-normal text-amber-300/90 ml-1;
  }

  .cam-video {
    @apply flex-1 w-full h-full object-cover bg-black;
  }

  .cam-video.mirror {
    transform: scaleX(-1); /* mirror local self-view like a selfie */
  }

  .cam-overlay {
    @apply absolute inset-x-0 bottom-0 top-8 flex items-center justify-center;
    @apply text-xs text-zinc-300 pointer-events-none;
    background: rgb(0 0 0 / 0.35);
  }

  .cam-resize {
    @apply absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize;
    touch-action: none;
    background: linear-gradient(135deg, transparent 50%, rgb(113 113 122 / 0.8) 50%);
  }
</style>
