"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowUpRight, ShieldCheck } from "lucide-react";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";

export default function AdminEntry() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@coreforgeindia.com");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const supabaseEnabled = isSupabaseConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage(
        "Supabase URL & Anon Key are not set in .env.local yet. Add them and run supabase/schema.sql in Supabase SQL Editor."
      );
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error || !data.user) {
        throw new Error(error?.message || "Invalid credentials.");
      }
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();
      if (profErr || profile?.role !== "admin") {
        await supabase.auth.signOut();
        throw new Error("Only Admin accounts can sign in from /admin.");
      }
      router.push("/");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Sign in failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-screen">
      <form className="login-box" onSubmit={handleSubmit}>
        <div className="brand-mark">
          CORE<span>FORGE.</span>
        </div>
        <div className="eyebrow">ADMINISTRATION · /ADMIN</div>
        <h1>Administrator access</h1>
        <p className="muted">
          Manage CoreForge team accounts, project settings, coupons and audit
          activity.
        </p>
        <label>
          Email address
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter administrator password"
            required
          />
        </label>
        <button className="primary wide" type="submit" disabled={loading}>
          {loading ? "Verifying..." : "Continue to admin"}{" "}
          <ArrowUpRight size={16} />
        </button>
        {message && (
          <div className="note-box">
            <ShieldCheck size={17} />
            <div>
              <b>{supabaseEnabled ? "Authentication" : "Supabase required"}</b>
              <p>{message}</p>
            </div>
          </div>
        )}
        <p className="small muted">
          Admin email: <code>admin@coreforgeindia.com</code>
        </p>
        <Link href="/" className="text-button">
          <ArrowLeft size={14} /> Back to workspace
        </Link>
      </form>
    </main>
  );
}
