import type { Metadata } from "next";
import { readSupabaseEnv } from "@/lib/supabase/env";
import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CoreForge | Company Portal",
  description: "CoreForge project and client requirement management workspace",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { url: supabaseUrl, key: supabaseAnonKey } = readSupabaseEnv();
  const runtimeEnvScript = `window.__COREFORGE_ENV__=${JSON.stringify({
    supabaseUrl,
    supabaseAnonKey,
  }).replaceAll("<", "\\u003c")};`;

  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: runtimeEnvScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
