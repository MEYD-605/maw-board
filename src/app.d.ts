/// <reference types="@sveltejs/kit" />

// Injected by vite.config.ts
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  readonly VITE_RTC_ICE_SERVERS?: string;
  readonly VITE_RTC_STUN_URLS?: string;
  readonly VITE_RTC_TURN_URLS?: string;
  readonly VITE_RTC_TURN_USERNAME?: string;
  readonly VITE_RTC_TURN_CREDENTIAL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// See https://kit.svelte.dev/docs/types#the-app-namespace
// for information about these interfaces
declare namespace App {
  // interface Locals {}
  // interface Platform {}
  // interface Session {}
  // interface Stuff {}
}

// Type declarations for external libraries.
declare module "fontfaceobserver";
