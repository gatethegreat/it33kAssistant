"use client";

import { createClient } from "@/lib/supabase-browser";
import { ShieldIcon } from "@/components/icons";

export default function NotAuthorizedPage() {
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-base)]">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-[var(--border-default)] bg-[#111113] p-8 text-center">
        <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-red-500/10 border border-red-500/15">
          <ShieldIcon size={20} className="text-red-400" />
        </div>
        <h1 className="text-[15px] font-semibold text-[var(--text-primary)]">Access Denied</h1>
        <p className="text-[13px] text-[var(--text-tertiary)]">
          Your account hasn&apos;t been granted access to this app. Contact an
          administrator to request access.
        </p>
        <button
          onClick={handleSignOut}
          className="w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-4 py-2 text-[13px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
