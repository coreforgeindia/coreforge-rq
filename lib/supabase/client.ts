import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const PLACEHOLDER_URL = "https://YOUR_PROJECT.supabase.co";
const PLACEHOLDER_KEY = "YOUR_SUPABASE_ANON_KEY";

export interface RuntimeSupabaseEnv {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

declare global {
  interface Window {
    __COREFORGE_ENV__?: RuntimeSupabaseEnv;
  }
}

export function readSupabaseEnv(): { url: string; key: string } {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  let key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  if (typeof window !== "undefined" && window.__COREFORGE_ENV__) {
    if (!url || url === PLACEHOLDER_URL) {
      url = window.__COREFORGE_ENV__.supabaseUrl?.trim() ?? "";
    }
    if (!key || key === PLACEHOLDER_KEY) {
      key = window.__COREFORGE_ENV__.supabaseAnonKey?.trim() ?? "";
    }
  } else if (typeof process !== "undefined" && process.env) {
    const dynEnv = process.env as Record<string, string | undefined>;
    if (!url || url === PLACEHOLDER_URL) {
      url = dynEnv["NEXT_PUBLIC_SUPABASE_URL"]?.trim() ?? "";
    }
    if (!key || key === PLACEHOLDER_KEY) {
      key = dynEnv["NEXT_PUBLIC_SUPABASE_ANON_KEY"]?.trim() ?? "";
    }
  }

  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = readSupabaseEnv();
  return (
    Boolean(url) &&
    Boolean(key) &&
    url !== PLACEHOLDER_URL &&
    key !== PLACEHOLDER_KEY &&
    url.startsWith("https://")
  );
}

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!browserClient) {
    const { url, key } = readSupabaseEnv();
    browserClient = createBrowserClient(url, key);
  }
  return browserClient;
}


