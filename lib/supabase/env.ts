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

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readVar(
  name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  compileTimeValue: string | undefined,
  placeholder: string
): string {
  const isValid = (v: string) => Boolean(v) && v !== placeholder;

  const baked = cleanString(compileTimeValue);
  if (isValid(baked)) return baked;

  if (typeof window !== "undefined") {
    const winEnv = window.__COREFORGE_ENV__;
    const fromWin = cleanString(
      name === "NEXT_PUBLIC_SUPABASE_URL"
        ? winEnv?.supabaseUrl
        : winEnv?.supabaseAnonKey
    );
    if (isValid(fromWin)) return fromWin;
    return "";
  }

  const cfStore = (
    globalThis as Record<symbol, { env?: Record<string, unknown> } | undefined>
  )[Symbol.for("__cloudflare-context__")];
  const fromCf = cleanString(cfStore?.env?.[name]);
  if (isValid(fromCf)) return fromCf;

  const dynEnv =
    typeof process !== "undefined" && process.env
      ? (process.env as Record<string, string | undefined>)
      : {};
  const fromProcess = cleanString(dynEnv[name]);
  if (isValid(fromProcess)) return fromProcess;

  return "";
}

/**
 * Resolves Supabase URL and anon key across build-time Next.js inlining,
 * browser runtime injection (`window.__COREFORGE_ENV__`), and Cloudflare
 * Worker / Node.js server runtime environment bindings.
 */
export function readSupabaseEnv(): { url: string; key: string } {
  return {
    url: readVar(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      PLACEHOLDER_URL
    ),
    key: readVar(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      PLACEHOLDER_KEY
    ),
  };
}

/**
 * Returns whether valid Supabase connection credentials are available.
 */
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

