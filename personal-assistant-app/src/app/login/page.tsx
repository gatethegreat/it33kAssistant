"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)]">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-[var(--border-default)] bg-[#111113] p-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--accent-text)]">
              <path d="M8 2C5.8 2 4 3.8 4 6c0 1.2.5 2.2 1.3 3L6 10.5v1a.5.5 0 00.5.5h3a.5.5 0 00.5-.5v-1L10.7 9A4 4 0 0012 6c0-2.2-1.8-4-4-4z" />
              <path d="M6.5 13h3M7 14h2" />
            </svg>
          </div>
          <h1 className="text-[15px] font-semibold text-[var(--text-primary)]">PAI Dashboard</h1>
          <p className="text-[13px] text-[var(--text-tertiary)]">Sign in to your personal assistant</p>
        </div>

        {error && (
          <div className="rounded-md bg-red-500/10 border border-red-500/15 px-4 py-3 text-[13px] text-red-400">
            {error}
          </div>
        )}

        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-md bg-white px-4 py-2.5 text-[13px] font-medium text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.26c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {loading ? "Signing in..." : "Continue with Google"}
        </button>
      </div>
    </div>
  );
}
