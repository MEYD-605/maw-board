<script lang="ts">
  import {
    CastIcon,
    DownloadIcon,
    GitBranchIcon,
    HardDriveIcon,
    ImageIcon,
    LockIcon,
    PackageIcon,
    RefreshCwIcon,
    Share2Icon,
  } from "svelte-feather-icons";

  import logotypeDark from "$lib/assets/logotype-dark.svg";
  import landingGraphic from "$lib/assets/landing-graphic.svg";
  import landingBackground from "$lib/assets/landing-background.svg";
  import TeaserVideo from "$lib/ui/TeaserVideo.svelte";
  import CopyableCode from "$lib/ui/CopyableCode.svelte";
  import DownloadLink from "$lib/ui/DownloadLink.svelte";

  let installationEl: HTMLDivElement;

  const socials = [
    {
      title: "🤖\xa0 GitHub",
      href: "https://github.com/MEYD-605/maw-board",
    },
    {
      title: "📦\xa0 Plugin",
      href: "https://github.com/MEYD-605/maw-workboard",
    },
  ];

  function scrollToInstallation() {
    installationEl.scrollIntoView({ behavior: "smooth" });
  }
</script>

<main
  class="max-w-screen-xl mx-auto px-4 md:px-8 lg:px-16 text-zinc-100 overflow-x-hidden"
>
  <header class="mt-6 mb-4 sm:my-8 md:my-12">
    <img class="h-12 sm:h-16 -mx-1" src={logotypeDark} alt="Oracle Board logo" />
    <p class="mt-3 text-sm sm:text-base text-zinc-400 font-medium tracking-wide">
      Oracle Board · MEYD-605
    </p>
  </header>
  <h1
    class="font-medium text-3xl sm:text-4xl md:text-5xl max-w-[26ch] py-2 mb-6 md:mb-0 sm:tracking-tight leading-[1.15]"
  >
    Oracle Board —
    <span class="title-gradient">collaborative</span> terminal + workboard
  </h1>

  <div class="relative">
    <div
      class="absolute scale-150 md:scale-100 md:left-[180px] md:top-[-200px] md:w-[1000px] -z-10"
    >
      <img class="select-none" src={landingBackground} alt="" />
    </div>
    <div class="md:absolute md:left-[500px] md:w-[1000px]">
      <img
        class="mt-5 mb-8 w-[720px]"
        width={813}
        height={623}
        src={landingGraphic}
        alt="Oracle Board collaborative terminals and live cursors"
      />
    </div>
  </div>

  <section class="my-12 space-y-6 sm:text-lg md:max-w-[460px] text-zinc-400">
    <p>
      <code class="name">Oracle Board</code> is the MEYD collaborative terminal
      and workboard — multiplayer canvas, files, sysstat, password gate — run via
      <code class="name">maw board</code>.
    </p>
    <p>
      Real-time collaboration, remote cursors, and end-to-end encryption on a
      lightweight Rust server. Derived from open-source <code class="name">sshx</code>
      (see NOTICE / LICENSE).
    </p>
    <p>
      Install the workboard plugin, then open with <code class="name">maw board</code>.
      Use it for fleet ops, teaching, debugging, and house agent terminals.
    </p>
  </section>

  <div class="pb-12 md:pb-36">
    <button
      class="bg-pink-700 hover:bg-pink-600 active:ring-4 active:ring-pink-500/50 text-lg font-medium px-8 py-2 rounded-full"
      on:click={scrollToInstallation}
    >
      Get Started
    </button>
  </div>

  <div class="mt-8 md:mt-32 grid md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
    <div class="feature-block">
      <div class="feature-icon">
        <CastIcon size="14" />
      </div>
      <h3>Collaborative</h3>
      <p>Invite people by sharing a secure, unique browser link.</p>
    </div>
    <div class="feature-block">
      <div class="feature-icon">
        <LockIcon size="14" />
      </div>
      <h3>End-to-end encrypted</h3>
      <p>Send data securely; the server never sees what you're typing.</p>
    </div>
    <div class="feature-block">
      <div class="feature-icon">
        <HardDriveIcon size="14" />
      </div>
      <h3>Cross-platform</h3>
      <p>Use the command-line tool on macOS, Linux, and Windows.</p>
    </div>
    <div class="feature-block">
      <div class="feature-icon">
        <ImageIcon size="14" />
      </div>
      <h3>Infinite canvas</h3>
      <p>Move and resize multiple terminals at once, in any arrangement.</p>
    </div>
    <div class="feature-block">
      <div class="feature-icon">
        <RefreshCwIcon size="14" />
      </div>
      <h3>Live presence</h3>
      <p>See other people's names and cursors within the app.</p>
    </div>
    <div class="feature-block">
      <div class="feature-icon">
        <Share2Icon size="14" />
      </div>
      <h3>Ultra-fast mesh networking</h3>
      <p>
        Connect from anywhere to the nearest distributed peer in a global
        network.
      </p>
    </div>
  </div>

  <div class="my-48 hidden md:block">
    <TeaserVideo />
  </div>

  <h2
    bind:this={installationEl}
    class="mt-32 mb-12 font-medium text-3xl sm:text-4xl md:text-center scroll-mt-16"
  >
    Installation
  </h2>

  <section class="installation-section">
    <h3 class="text-xl sm:text-lg">
      <DownloadIcon size="20" class="text-zinc-400 inline-block mr-1 mb-0.5" />
      macOS / Linux
    </h3>
    <div class="text-sm text-zinc-400 md:text-base md:pt-0.5">
      <p class="mb-3">Install the maw plugin, then the prebuilt workboard runtime:</p>
      <CopyableCode value="maw plugin install MEYD-605/maw-workboard" />
      <p class="mt-4 mb-3">Prebuilt bundles (Linux / macOS) from MEYD releases:</p>
      <CopyableCode
        value="maw board install --prebuilt ./workboard-prebuilt-<os>.tar.gz"
      />
      <p class="mt-4 mb-3">
        Release assets:
        <a
          class="underline text-zinc-200"
          href="https://github.com/MEYD-605/maw-ssh/releases/tag/workboard-v0.1.0"
          target="_blank"
          rel="noreferrer">workboard-v0.1.0</a
        >
      </p>
      <CopyableCode value="maw board serve" />
      <p class="mt-3">Then open <code class="name">http://127.0.0.1:3457/go</code></p>
    </div>
  </section>

  <section class="installation-section">
    <h3 class="text-xl sm:text-lg">
      <PackageIcon size="20" class="text-zinc-400 inline-block mr-1 mb-0.5" />
      Build from source
    </h3>
    <div class="text-sm text-zinc-400 md:text-base md:pt-0.5">
      <p class="mb-3">
        Clone <code class="name">MEYD-605/maw-board</code>, install Rust + protoc +
        Bun, then build and install via the workboard plugin.
      </p>
      <CopyableCode
        value="git clone https://github.com/MEYD-605/maw-board && maw board install --source ./maw-board"
      />
    </div>
  </section>

  <section class="installation-section">
    <h3 class="text-xl sm:text-lg">
      <GitBranchIcon size="20" class="text-zinc-400 inline-block mr-1 mb-0.5" />
      Friend house
    </h3>
    <div class="text-sm text-zinc-400 md:text-base md:pt-0.5">
      <p class="mb-3">
        Board + oracle-menu pack notes live in
        <code class="name">maw-workboard</code> templates (friend-house pack).
        Product name to search: <b>Oracle Board</b> — not bare “sshx”.
      </p>
    </div>
  </section>

  <hr class="mt-32 mb-12" />

  <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6">
    {#each socials as social}
      <a
        target="_blank"
        rel="noreferrer"
        href={social.href}
        class="border border-white/10 hover:border-white/30 transition-colors p-4 text-center text-lg font-medium rounded-lg"
      >
        {social.title}
      </a>
    {/each}
  </div>

  <p class="mb-12 text-center text-zinc-400">
    Oracle Board · MEYD-605 · open source (MIT) · derived from sshx by Eric Zhang —
    see NOTICE
  </p>
</main>

<style lang="postcss">
  b {
    @apply text-zinc-300 font-medium;
  }

  code.name {
    @apply text-[0.9em] text-zinc-100 border border-white/25 px-1 py-0.5 rounded;
  }

  hr {
    @apply mx-auto md:w-1/2 border-zinc-800;
  }

  .title-gradient {
    @apply text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-blue-500;
  }

  .feature-block {
    @apply relative border rounded-lg border-transparent p-6 sm:p-8;
    background: #111111 padding-box;
  }

  .feature-block::before {
    content: "";
    @apply absolute inset-0;
    z-index: -1;
    margin: -1px;
    border-radius: inherit;
    background: linear-gradient(
      160deg,
      rgba(255, 255, 255, 0.36) 5%,
      rgba(255, 255, 255, 0.08) 25%,
      rgba(255, 255, 255, 0.24) 50%,
      rgba(255, 255, 255, 0.08) 75%,
      rgba(255, 255, 255, 0.28) 95%
    );
    opacity: 0.5;
    transition: opacity 200ms;
  }

  .feature-block:hover::before {
    opacity: 1;
  }

  .feature-block h3 {
    @apply font-medium mb-2;
  }

  .feature-block p {
    @apply text-zinc-400;
  }

  .feature-icon {
    @apply inline-block p-3 rounded-full mb-3 shadow-md border border-zinc-600;
  }

  .installation-section {
    @apply grid sm:grid-cols-[200px,1fr] gap-x-10 gap-y-4 max-w-4xl mx-auto sm:border-t sm:border-white/10 sm:py-6 lg:px-2;
    @apply mb-16 lg:mb-8;
  }
</style>
