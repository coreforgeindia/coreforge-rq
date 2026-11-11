import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isSupabaseConfigured,
  readSupabaseEnv,
  type RuntimeSupabaseEnv,
} from "@/lib/supabase/env";

export { isSupabaseConfigured, readSupabaseEnv, type RuntimeSupabaseEnv };

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!browserClient) {
    const { url, key } = readSupabaseEnv();
    browserClient = createBrowserClient(url, key);
  }
  return browserClient;
}
