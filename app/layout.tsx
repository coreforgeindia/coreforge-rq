import type { Metadata } from "next";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CoreForge | Company Portal",
  description: "CoreForge project and client requirement management workspace",
};

function getServerSupabaseRuntimeEnv() {
  const dynEnv =
    typeof process !== "undefined" && process.env
      ? (process.env as Record<string, string | undefined>)
      : {};
  const cfStore = (
    globalThis as Record<symbol, { env?: Record<string, unknown> } | undefined>
  )[Symbol.for("__cloudflare-context__")];
  const cfEnv = cfStore?.env ?? {};

  const supabaseUrl =
    dynEnv["NEXT_PUBLIC_SUPABASE_URL"]?.trim() ||
    (typeof cfEnv.NEXT_PUBLIC_SUPABASE_URL === "string"
      ? cfEnv.NEXT_PUBLIC_SUPABASE_URL.trim()
      : "") ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "";

  const supabaseAnonKey =
    dynEnv["NEXT_PUBLIC_SUPABASE_ANON_KEY"]?.trim() ||
    (typeof cfEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string"
      ? cfEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY.trim()
      : "") ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";

  return { supabaseUrl, supabaseAnonKey };
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const runtimeEnv = getServerSupabaseRuntimeEnv();
  const runtimeEnvScript = `window.__COREFORGE_ENV__=${JSON.stringify(
    runtimeEnv
  ).replaceAll("<", "\\u003c")};`;

  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: runtimeEnvScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

